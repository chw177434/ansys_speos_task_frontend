# SPEOS 求解过程进度信息不显示 - 排查指南

> **问题描述**：任务执行成功（约 40 分钟），但执行过程中只显示「等待中/运行中」，看不到 Pass、Sensor、剩余时间等进度信息，最后直接显示成功和结果。

---

## 一、整体架构

```
┌─────────────────┐    每 30 秒轮询     ┌─────────────────────────┐
│   前端          │  ─────────────────►  │  GET /api/tasks/{id}/detail │
│   TasksTable    │                      │  应返回 progress_info      │
└─────────────────┘                      └────────────┬──────────────┘
        │                                                      │
        │ 显示 progress_info                                   │
        ▼                                                      │
┌─────────────────┐                      ┌─────────────────────▼──────┐
│ 进度卡片        │                      │  后端 detail 接口            │
│ (Pass/Sensor/   │  ◄── 数据来源        │  需从 Celery AsyncResult    │
│  剩余时间)      │                      │  或 Redis 读取 meta          │
└─────────────────┘                      └────────────┬────────────────┘
                                                       │
                                                       ▼
                                            ┌─────────────────────────┐
                                            │  Celery Worker           │
                                            │  需用 task.update_state  │
                                            │  实时写入 progress_info   │
                                            └─────────────────────────┘
```

**关键点**：progress_info 必须在**任务执行过程中**由 Worker 写入，detail 接口才能返回；若只在任务**完成**时写入 result，执行期间前端永远拿不到。

---

## 二、前端排查

### 1. 确认轮询是否触发

打开浏览器开发者工具 → Network：

1. 提交一个 SPEOS 任务
2. 任务状态变为「运行中」后，观察是否有 `GET /api/tasks/{task_id}/detail` 请求
3. 预期：每 30 秒出现一次 detail 请求

**若无 detail 请求**，可能原因：
- 任务状态未被识别为「运行中」（如后端返回 `PROGRESS` 而前端只认 `RUNNING`）
- 检查 `TasksTable.tsx` 中 `runningStatuses` 是否包含后端实际返回的状态

```typescript
// components/TasksTable.tsx 约 1395 行
const runningStatuses = ["RUNNING", "PROGRESS", "STARTED", "DOWNLOADING"];
```

### 2. 确认 detail 响应内容

在 Network 中点击某次 detail 请求，查看 Response：

```json
{
  "task_id": "xxx",
  "status": "RUNNING",
  "progress_info": {           // ← 关键：执行中应有此字段
    "progress_percent": 45.2,
    "estimated_time": "20 minutes",
    "current_pass": 3,
    "total_passes": 10,
    "current_sensor": 2,
    "total_sensors": 5
  }
}
```

- 若 `progress_info` 为 `null` 或空对象 → **问题在后端**
- 若有数据但界面不显示 → 检查 `renderProgressInfo` 逻辑及 `taskStatus === "SUCCESS"` 是否误判

### 3. 前端轮询间隔

当前运行中任务轮询间隔为 **30 秒**（`TasksTable.tsx` 约 1444 行）。若希望更频繁更新，可改为 10–15 秒，但会增加后端压力。

### 4. API 地址

确认 `API_BASE` 正确：
- 默认：`/api`（通过 Next.js 代理到后端）
- 若使用 `NEXT_PUBLIC_API_BASE`，需指向实际后端地址

---

## 三、后端排查（重点）

### 1. detail 接口是否返回 progress_info

```bash
# 任务运行中时执行
curl "http://localhost:8000/api/tasks/{运行中的task_id}/detail" | jq .
```

检查响应中是否有 `progress_info` 字段，以及其内容。

### 2. Celery 是否在执行中更新 progress

**核心**：Celery 的 `result` 默认只在任务**完成**时写入。要在执行中拿到进度，必须用 `task.update_state()` 把进度写入 result backend（Redis 等）。

后端 Worker 中应有类似逻辑：

```python
# 伪代码：Worker 执行 speoshpc 时
from celery import current_task

def run_speos_task(task_id, ...):
    process = subprocess.Popen(["speoshpc", ...], stdout=subprocess.PIPE, ...)
    progress_info = {"progress_percent": 0, "current_pass": 0, ...}
    
    for line in iter(process.stdout.readline, b''):
        # 解析 speoshpc 输出
        parsed = parse_speos_progress(line)
        if parsed:
            progress_info.update(parsed)
            # ⭐ 关键：实时更新到 Celery result backend
            current_task.update_state(
                state='PROGRESS',
                meta={'progress_info': progress_info}
            )
    
    return {"status": "SUCCESS", "progress_info": progress_info, ...}
```

若没有 `update_state`，执行期间 detail 接口无法拿到 progress_info。

### 3. detail 接口是否从 AsyncResult 读取 meta

detail 接口应类似：

```python
# 伪代码
def get_task_detail(task_id):
    result = AsyncResult(task_id)
    
    # 任务执行中：从 meta 读取 progress_info
    if result.state == 'PROGRESS' and result.info:
        progress_info = result.info.get('progress_info')
    # 任务已完成：从 result 读取
    elif result.ready() and result.successful():
        progress_info = result.result.get('progress_info')
    else:
        progress_info = None
    
    return {
        "task_id": task_id,
        "status": result.state,
        "progress_info": progress_info,
        ...
    }
```

若 detail 只从 `result.result` 读取，而 `result.result` 仅在任务完成时才有，则执行中必然为 `null`。

### 4. SPEOS GPU 模式输出差异

使用 GPU（`-G`）时，`speoshpc` 的输出格式可能与 CPU 不同。需确认：

- 正则或解析逻辑是否同时支持 CPU/GPU 输出
- Worker 日志中是否有解析到的进度行

### 5. 后端日志

在 Worker 中增加日志，便于排查：

```python
# 每次解析到进度时
logger.info(f"[{task_id}] SPEOS progress: {progress_info}")
```

确认：
- 是否有进度解析日志
- `update_state` 是否被调用

---

## 四、排查清单

| 步骤 | 检查项 | 命令/方法 |
|------|--------|-----------|
| 1 | 前端是否发起 detail 请求 | F12 → Network → 过滤 `detail` |
| 2 | detail 响应是否含 progress_info | 查看 Response JSON |
| 3 | progress_info 是否非空 | `jq .progress_info` |
| 4 | 后端 Worker 是否解析 SPEOS 输出 | 查看 Worker 日志 |
| 5 | Worker 是否调用 update_state | 搜索 `update_state` |
| 6 | detail 是否从 AsyncResult.info 读取 | 查看 detail 接口实现 |
| 7 | GPU 模式输出是否被正确解析 | 对比 CPU/GPU 日志 |

---

## 五、常见根因与修复方向

### 根因 A：后端未实现执行中进度更新

**现象**：detail 在任务运行中返回 `progress_info: null`。

**修复**：在 Worker 中解析 speoshpc 输出，并调用 `current_task.update_state(state='PROGRESS', meta={'progress_info': ...})`。

### 根因 B：detail 只读最终 result

**现象**：执行中 progress_info 为空，完成后才有值。

**修复**：detail 接口需根据 `result.state` 分支：`PROGRESS` 时从 `result.info` 取 progress_info，`SUCCESS` 时从 `result.result` 取。

### 根因 C：SPEOS GPU 输出格式不同

**现象**：CPU 有进度，GPU 无进度。

**修复**：对比 GPU 模式下 speoshpc 的实际输出，调整正则或解析逻辑。

### 根因 D：前端轮询条件不匹配

**现象**：没有 detail 请求。

**修复**：确认后端返回的状态值（如 `PROGRESS`）已包含在 `runningStatuses` 中。

---

## 六、验证步骤

1. 提交一个短时 SPEOS 任务（或使用测试用例）
2. 任务进入「运行中」后：
   - 前端：确认每 30 秒有 detail 请求，且 Response 含 progress_info
   - 后端：确认 Worker 有进度解析和 update_state 日志
3. 若 detail 有 progress_info 但界面不显示，再检查 `renderProgressInfo` 和状态判断逻辑

---

## 七、相关文件

| 位置 | 文件 | 说明 |
|------|------|------|
| 前端 | `components/TasksTable.tsx` | 轮询、fetchProgressForTask、renderProgressInfo |
| 前端 | `lib/api.ts` | ProgressInfo 类型、getTaskDetail |
| 后端 | detail 接口 | 从 AsyncResult 返回 progress_info |
| 后端 | Worker (speoshpc 任务) | 解析输出并 update_state |

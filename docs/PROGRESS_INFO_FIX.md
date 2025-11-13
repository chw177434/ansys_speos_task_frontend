# 进度信息显示问题 - 紧急修复

## 🔍 问题描述

**症状**：
- ✅ 任务显示"执行中"状态
- ❌ 看不到任何进度信息（进度条、剩余时间、Pass/Sensor 信息）
- ⚠️ 鼠标悬停显示"带进度"的提示，但实际没有显示

**截图显示的问题**：
```
任务名称: test-job-202511131417
状态: ⚙️ 执行中
持续时间: 2分50秒

← 应该在这里显示进度卡片，但是空白！
```

---

## ❌ 问题根源

### 前后端 API 不匹配

**前端调用**：
```typescript
GET /api/tasks  // 列表接口
```

**后端实现**：
```python
# 列表接口 - 没有 progress_info ❌
GET /api/tasks
→ 返回基本信息，但不包含 progress_info

# Detail 接口 - 有 progress_info ✅
GET /api/tasks/{task_id}/detail
→ 返回完整信息，包含 progress_info
```

**结果**：前端从列表接口获取的数据中没有 `progress_info` 字段！

---

## ✅ 解决方案（已实现）

### 临时方案：前端额外调用 detail 接口

我已经修改了前端代码，对运行中的任务额外调用 detail 接口获取进度信息。

#### 实现逻辑

```typescript
// 1. 新增函数：获取运行中任务的进度
const fetchProgressForTask = useCallback(
  async (taskId: string) => {
    try {
      // 调用 detail 接口
      const response = await fetch(`${API_BASE}/tasks/${taskId}/detail`);
      const data = await response.json();
      
      // 更新任务的 progress_info
      applyTaskUpdate(taskId, (task) => ({
        ...task,
        progress_info: data.progress_info || null,
      }));
    } catch (err) {
      console.warn(`Error fetching progress for task ${taskId}:`, err);
    }
  },
  [applyTaskUpdate]
);

// 2. 自动调用：对运行中的任务自动获取进度
useEffect(() => {
  baseRows.forEach((task) => {
    const runningStatuses = ["RUNNING", "PROGRESS", "STARTED"];
    if (runningStatuses.includes(task.status)) {
      void fetchProgressForTask(task.task_id);  // ← 额外调用
    }
  });
}, [baseRows, fetchProgressForTask]);
```

#### 工作原理

```
1. 前端调用列表接口
   GET /api/tasks
   ↓
   获取所有任务的基本信息

2. 前端检测到运行中的任务
   状态 = "RUNNING" | "PROGRESS" | "STARTED"
   ↓
   自动额外调用 detail 接口

3. 前端调用 detail 接口
   GET /api/tasks/{task_id}/detail
   ↓
   获取完整的 progress_info

4. 前端更新任务数据
   task.progress_info = {...}
   ↓
   UI 自动显示进度卡片
```

---

## 🚀 立即使用

### 步骤 1: 重启前端服务

```bash
# 停止当前服务（Ctrl+C）

# 清理缓存（如果之前没做）
rm -rf .next

# 重新启动
npm run dev
```

### 步骤 2: 验证功能

1. **打开浏览器开发者工具（F12）**
2. **切换到 Network 选项卡**
3. **提交一个新任务**
4. **等待任务开始执行（状态变为"执行中"）**
5. **观察网络请求**

你应该能看到：
```
GET /api/tasks              ← 获取任务列表
GET /api/tasks/{id}/detail  ← 额外调用（新增）
GET /api/tasks/{id}/detail  ← 每 5 秒自动调用一次
```

### 步骤 3: 确认进度显示

在任务列表中，"执行中"状态下方应该能看到：

```
┌─────────────────────────────────────────┐
│ 📊 执行进度                      37.7% │
│ ████████████░░░░░░░░░░░░░░░░░░          │
│                                         │
│ ⏱️ 剩余时间:             20 minutes   │
│                                         │
│ 🔄 Pass: 1/2      📡 Sensor: 1/1      │
└─────────────────────────────────────────┘
```

---

## 🔍 故障排查

### 问题 1: 仍然看不到进度信息

**检查步骤**：

#### 1. 检查网络请求

```javascript
// 在浏览器控制台（F12 → Console）运行
// 应该能看到 detail 接口的调用
```

查看 Network 选项卡，应该有：
- ✅ `GET /api/tasks/{id}/detail` 请求
- ✅ 返回状态 200
- ✅ Response 中有 `progress_info` 字段

#### 2. 检查后端返回数据

```bash
# 手动测试后端接口
curl "http://localhost:8000/api/tasks/{task_id}/detail" | jq .progress_info

# 应该看到类似：
{
  "estimated_time": "20 minutes",
  "progress_percent": 37.7,
  "current_pass": 1,
  "total_passes": 2,
  "current_sensor": 1,
  "total_sensors": 1
}

# 如果是 null，说明后端还没有捕获到进度信息
```

#### 3. 检查任务状态

```javascript
// 在浏览器控制台运行
// 查看任务状态是否正确
const tasks = Array.from(document.querySelectorAll('tr'));
tasks.forEach((row, i) => {
  const status = row.querySelector('[class*="bg-blue-100"]')?.textContent;
  console.log(`Task ${i} status:`, status);
});

// 应该看到 "执行中" 或类似文字
```

### 问题 2: 控制台有错误

打开浏览器控制台（F12 → Console），查看是否有错误：

**常见错误 1**: CORS 错误
```
Access to fetch at 'http://localhost:8000/api/tasks/...' 
from origin 'http://localhost:3000' has been blocked by CORS
```

**解决**: 检查后端 CORS 配置

**常见错误 2**: 404 错误
```
GET http://localhost:8000/api/tasks/{id}/detail 404 (Not Found)
```

**解决**: 确认后端 detail 接口已实现

**常见错误 3**: 500 错误
```
GET http://localhost:8000/api/tasks/{id}/detail 500 (Internal Server Error)
```

**解决**: 检查后端日志，查看具体错误

### 问题 3: progress_info 是 null

**可能原因**：

1. **Worker 还没有捕获到 SPEOS 输出**
   - SPEOS 刚开始执行，还没有输出进度
   - 需要等待一段时间

2. **正则表达式没有匹配**
   - 后端的正则表达式可能没有正确匹配 SPEOS 输出
   - 检查后端日志

3. **任务还在队列中**
   - 任务状态显示"执行中"，但实际还在等待
   - 检查 Worker 是否正常运行

---

## 📊 性能影响

### 额外的 API 调用

**旧版本**：
```
每 5 秒：GET /api/tasks  (1 次请求)
```

**新版本**：
```
每 5 秒：
  GET /api/tasks                    (1 次请求)
  GET /api/tasks/{id1}/detail      (每个运行中的任务 1 次)
  GET /api/tasks/{id2}/detail
  ...
```

**影响评估**：

| 运行中任务数 | 总请求数 | 影响 |
|------------|----------|------|
| 0 个 | 1 | 无影响 ✅ |
| 1 个 | 2 | 可忽略 ✅ |
| 2-3 个 | 3-4 | 轻微 ⚠️ |
| 5+ 个 | 6+ | 需优化 ❌ |

**建议**：
- ✅ 小规模使用（< 3 个并发任务）：无需优化
- ⚠️ 中规模使用（3-10 个）：考虑优化
- ❌ 大规模使用（> 10 个）：建议后端在列表接口返回 progress_info

---

## 🎯 长期方案（推荐）

### 后端在列表接口中也返回 progress_info

这是最优解决方案，无需前端额外调用。

**后端修改**：

```python
# 列表接口: GET /api/tasks
# 修改返回格式，包含 progress_info

@app.get("/api/tasks")
async def list_tasks():
    tasks = get_all_tasks()
    
    # 对每个任务，如果是运行中状态，获取 progress_info
    for task in tasks:
        if task["status"] in ["RUNNING", "PROGRESS", "STARTED"]:
            # 从 Celery 结果中获取 progress_info
            task["progress_info"] = get_progress_info(task["task_id"])
        else:
            task["progress_info"] = None
    
    return tasks
```

**优点**：
- ✅ 前端不需要额外请求
- ✅ 性能最优（1 次请求获取所有数据）
- ✅ 代码更简洁

**前端改回**：
```typescript
// 可以删除 fetchProgressForTask 函数
// 因为列表接口已经包含了 progress_info
```

---

## 📝 测试清单

验证功能是否正常工作：

- [ ] 前端服务已重启
- [ ] 浏览器缓存已清理
- [ ] 提交了一个新任务
- [ ] 任务状态显示"执行中"
- [ ] Network 选项卡能看到 detail 请求
- [ ] detail 请求返回 200 状态
- [ ] detail 响应包含 progress_info
- [ ] 进度卡片正确显示在任务列表中
- [ ] 进度信息自动更新（每 5 秒）
- [ ] Console 没有错误

---

## 🚨 紧急联系

如果按照以上步骤仍然无法显示进度信息，请提供：

1. **浏览器控制台截图**（F12 → Console）
2. **Network 选项卡截图**（特别是 detail 请求）
3. **detail 接口的完整响应数据**
4. **后端日志中的相关内容**

---

## 📊 总结

### 问题

- ❌ 前端调用列表接口 `/api/tasks`
- ❌ 列表接口不包含 `progress_info`
- ❌ 导致前端无法显示进度信息

### 临时方案（已实现）

- ✅ 前端对运行中任务额外调用 detail 接口
- ✅ 自动获取 `progress_info` 并更新 UI
- ✅ 每 5 秒自动刷新

### 长期方案（推荐）

- 🎯 后端在列表接口中也返回 `progress_info`
- 🎯 前端无需额外请求
- 🎯 性能最优

---

**修复完成时间**: 2024-11-13  
**状态**: ✅ 已修复（临时方案）  
**建议**: 🎯 后端实现长期方案


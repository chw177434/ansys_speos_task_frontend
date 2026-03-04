# GPU 参数后端适配指南

> **版本**: v1.0  
> **更新日期**: 2025-03-04  
> **变更说明**: 将 `use_gpu` 从 SPEOS 扩展参数提升为**所有求解器的基础配置参数**

## 一、变更概述

前端已将所有求解器（SPEOS、FLUENT、Maxwell、Mechanical）的 **是否使用 GPU** 选项统一提升为**基础配置**，位于表单外层，便于业务专家根据自主求解设置是否使用 GPU。

### 前端变更要点

1. **UI 位置**：GPU 选项从「高级配置」中移出，置于「Project Directory」与「高级配置」之间，作为基础配置项
2. **所有求解器**：SPEOS、FLUENT、Maxwell、Mechanical 均显示该选项
3. **参数传递**：所有提交流程（Direct、TOS、断点续传）均会传递 `use_gpu` 参数

## 二、API 接口变更

### 参数类型

`use_gpu` 现为**通用基础参数**，所有求解器均支持：

| 参数名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `use_gpu` | `boolean` | `false` | 是否使用 GPU 求解（SPEOS/FLUENT/Maxwell/Mechanical 均支持） |

### 涉及的接口

| 接口 | 方法 | 参数位置 |
|------|------|----------|
| 直接上传 `/v2/upload/direct` | POST (FormData) | `formData.append("use_gpu", "true" \| "false")` |
| 旧流程创建任务 | POST (FormData) | `formData.append("use_gpu", "true" \| "false")` |
| TOS 确认上传 `/tasks/upload/confirm` | POST (JSON) | `{ "use_gpu": true \| false }` |

### 请求示例

#### 1. Direct 上传 / 旧流程（FormData）

```
use_gpu=true  或  use_gpu=false
```

**始终传递**：无论 `solver_type` 为何，均会传递 `use_gpu`。

#### 2. TOS confirm 上传（JSON）

```json
{
  "task_id": "xxx",
  "master_object_key": "xxx",
  "job_name": "任务名称",
  "solver_type": "speos",
  "use_gpu": false,
  ...
}
```

## 三、后端适配建议

### 1. 参数解析

- **FormData**：`use_gpu` 为字符串 `"true"` 或 `"false"`，需解析为布尔值
- **JSON**：`use_gpu` 为布尔值 `true` 或 `false`

### 2. 各求解器处理逻辑

| 求解器 | 是否支持 GPU | 建议处理 |
|--------|--------------|----------|
| SPEOS | ✅ 是 | 已有 `-G` 参数，按 `use_gpu` 决定是否添加 |
| FLUENT | ✅ 需支持 | 若支持 GPU，按 `use_gpu` 决定启动参数 |
| Maxwell | ✅ 需支持 | 若支持 GPU，按 `use_gpu` 决定启动参数 |
| Mechanical | ✅ 需支持 | 若支持 GPU，按 `use_gpu` 决定启动参数 |

### 3. 兼容性处理

- **未传 `use_gpu`**：沿用旧逻辑，默认 `false`（CPU）
- **`use_gpu=true` 但当前求解器不支持 GPU**：建议忽略或记录日志，仍按 CPU 求解
- **`use_gpu=false`**：明确使用 CPU

### 4. Python 解析示例

```python
# FormData 解析
use_gpu = form_data.get("use_gpu", "false").lower() == "true"

# JSON 解析
use_gpu = data.get("use_gpu", False)
```

### 5. 数据库存储（若需）

若任务表需记录是否使用 GPU，可增加字段：

```sql
ALTER TABLE tasks ADD COLUMN use_gpu BOOLEAN DEFAULT FALSE;
```

## 四、验证清单

- [ ] Direct 上传接口能正确解析 `use_gpu`
- [ ] TOS confirm 接口能正确解析 `use_gpu`
- [ ] 旧流程 createTask 接口能正确解析 `use_gpu`
- [ ] SPEOS 任务：`use_gpu=true` 时正确添加 `-G` 参数
- [ ] FLUENT/Maxwell/Mechanical：若支持 GPU，按 `use_gpu` 正确配置
- [ ] 不支持 GPU 的求解器：`use_gpu=true` 时优雅降级或提示

## 五、前端修改文件清单

| 文件 | 修改内容 |
|------|----------|
| `components/UploadForm.tsx` | GPU 移至基础配置；所有提交流程传递 `use_gpu` |
| `lib/api.ts` | `DirectUploadParams`、`ConfirmUploadRequest` 中 `use_gpu` 归入通用参数 |
| `docs/用户使用手册.md` | 更新 GPU 参数说明 |
| `docs/features/GPU_BASE_PARAM_BACKEND_GUIDE.md` | 新增本后端适配指南 |

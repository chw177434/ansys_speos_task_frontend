# SPEOS 任务进度信息集成指南

## 📋 概述

后端已优化 `speoshpc` 调用接口，支持实时捕获和提取任务执行的进度信息。前端已完成相应适配，可以显示以下信息：

- ⏱️ **预期执行时间** (Estimated time)
- 📊 **进度百分比** (Progress)
- 🔢 **当前步骤** (Step)

---

## 🎯 后端实现原理

### 1. 实时输出捕获

后端使用 `subprocess.Popen` 实时读取 `speoshpc` 的输出，并通过正则表达式解析进度信息：

```python
progress_info = {
    "estimated_time": None,       # 预期时间：如 "2.5 hours"
    "progress_percent": None,      # 进度百分比：0-100
    "current_step": None,          # 当前步骤：如 "10/10"
}
```

### 2. 返回值增强

任务成功后，Celery 结果中会包含 `progress_info` 字段：

```json
{
  "status": "SUCCESS",
  "output_path": "/mnt/speos_tasks/outputs/task_12345",
  "duration": 3600.5,
  "moved_files_count": 42,
  "progress_info": {
    "estimated_time": "2.5 hours",
    "progress_percent": 100.0,
    "current_step": "10/10"
  }
}
```

---

## 💻 前端集成实现

### 1. 类型定义 (`lib/api.ts`)

```typescript
// SPEOS 任务执行进度信息（后端实时捕获）
export interface ProgressInfo {
  estimated_time?: string | null;      // 预期执行时间，如 "2.5 hours"
  progress_percent?: number | null;    // 进度百分比，0-100
  current_step?: string | null;        // 当前步骤，如 "10/10"
}

export interface TaskStatusResponse {
  task_id: string;
  status: string;
  message?: string | null;
  download_url?: string | null;
  download_name?: string | null;
  duration?: number | null;
  elapsed_seconds?: number | null;
  progress_info?: ProgressInfo | null; // ✅ 新增字段
}
```

### 2. 工具函数

#### 2.1 检查进度信息是否有效

```typescript
import { hasValidProgressInfo } from '@/lib/api';

const result = await getTaskStatus(taskId);

if (hasValidProgressInfo(result.progress_info)) {
  console.log('任务有进度信息');
}
```

#### 2.2 提取进度信息

```typescript
import { extractProgressInfo } from '@/lib/api';

const result = await getTaskStatus(taskId);
const progressInfo = extractProgressInfo(result);

if (progressInfo) {
  console.log(`预计时间: ${progressInfo.estimated_time}`);
  console.log(`进度: ${progressInfo.progress_percent}%`);
  console.log(`当前步骤: ${progressInfo.current_step}`);
}
```

#### 2.3 获取进度摘要

```typescript
import { getProgressSummary } from '@/lib/api';

const summary = getProgressSummary(progressInfo);
// 输出: "45%, 步骤 3/10, 预计 2.5 hours"
```

#### 2.4 格式化进度百分比

```typescript
import { formatProgressPercent } from '@/lib/api';

const formatted = formatProgressPercent(45.678);
// 输出: "46%"
```

### 3. UI 组件显示

进度信息会自动显示在任务列表的**状态列**下方，包含：

- 📊 **进度条**：可视化显示任务完成百分比
- 🔢 **当前步骤**：显示任务执行的当前阶段
- ⏱️ **预计时间**：显示预期的完成时间

示例显示效果：

```
┌─────────────────────────────────────┐
│ ▶️ 运行中                            │
│ 2024-11-12 14:30:25                │
│ ┌───────────────────────────────┐   │
│ │ 执行进度: ████████░░░░░░  45% │   │
│ │ 当前步骤: 3/10                │   │
│ │ 预计时间: 2.5 hours           │   │
│ └───────────────────────────────┘   │
└─────────────────────────────────────┘
```

---

## 🔍 使用示例

### 示例 1：轮询任务状态并显示进度

```typescript
import { getTaskStatus, hasValidProgressInfo, extractProgressInfo } from '@/lib/api';

async function pollTaskStatus(taskId: string) {
  const result = await getTaskStatus(taskId);
  
  console.log(`任务状态: ${result.status}`);
  
  // 检查是否有进度信息
  if (hasValidProgressInfo(result.progress_info)) {
    const progressInfo = extractProgressInfo(result);
    
    if (progressInfo) {
      // 显示在 UI 上
      if (progressInfo.estimated_time) {
        console.log(`⏱️ 预计时间: ${progressInfo.estimated_time}`);
      }
      
      if (progressInfo.progress_percent !== null) {
        console.log(`📊 进度: ${progressInfo.progress_percent}%`);
        updateProgressBar(progressInfo.progress_percent);
      }
      
      if (progressInfo.current_step) {
        console.log(`🔢 当前步骤: ${progressInfo.current_step}`);
      }
    }
  }
  
  return result;
}
```

### 示例 2：在 React 组件中使用

```typescript
import React, { useEffect, useState } from 'react';
import { getTaskStatus, type ProgressInfo } from '@/lib/api';

function TaskProgressComponent({ taskId }: { taskId: string }) {
  const [progressInfo, setProgressInfo] = useState<ProgressInfo | null>(null);

  useEffect(() => {
    const interval = setInterval(async () => {
      const result = await getTaskStatus(taskId);
      setProgressInfo(result.progress_info || null);
    }, 5000); // 每 5 秒轮询一次

    return () => clearInterval(interval);
  }, [taskId]);

  if (!progressInfo) {
    return <div>暂无进度信息</div>;
  }

  return (
    <div className="progress-container">
      {progressInfo.progress_percent !== null && (
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${progressInfo.progress_percent}%` }}
          />
          <span>{Math.round(progressInfo.progress_percent)}%</span>
        </div>
      )}
      
      {progressInfo.current_step && (
        <div className="step-info">
          步骤: {progressInfo.current_step}
        </div>
      )}
      
      {progressInfo.estimated_time && (
        <div className="time-info">
          预计完成时间: {progressInfo.estimated_time}
        </div>
      )}
    </div>
  );
}
```

---

## 📊 数据流程

```
┌──────────────────┐
│  SPEOS 执行      │
│  (speoshpc)      │
└────────┬─────────┘
         │ 输出捕获
         ▼
┌──────────────────┐
│  后端 Worker     │
│  - 正则解析      │
│  - 提取进度      │
└────────┬─────────┘
         │ Celery Result
         ▼
┌──────────────────┐
│  前端 API 调用   │
│  getTaskStatus() │
└────────┬─────────┘
         │ JSON Response
         ▼
┌──────────────────┐
│  UI 组件显示     │
│  - 进度条        │
│  - 步骤信息      │
│  - 预计时间      │
└──────────────────┘
```

---

## ✅ 已完成的改动

### 1. `lib/api.ts`
- ✅ 新增 `ProgressInfo` 接口
- ✅ 更新 `TaskStatusResponse` 接口，添加 `progress_info` 字段
- ✅ 新增工具函数：
  - `hasValidProgressInfo()` - 检查进度信息是否有效
  - `extractProgressInfo()` - 提取进度信息
  - `formatProgressPercent()` - 格式化百分比
  - `getProgressSummary()` - 获取进度摘要

### 2. `components/TasksTable.tsx`
- ✅ 导入 `ProgressInfo` 类型
- ✅ 更新 `RawTask` 接口，添加 `progress_info` 字段
- ✅ 新增 `renderProgressInfo()` 渲染函数
- ✅ 在任务表格的状态列中显示进度信息

---

## 🎨 UI 样式说明

进度信息使用蓝色主题，与任务状态区分开：

- **背景色**: `bg-blue-50`
- **文字色**: `text-blue-700` (标签), `text-blue-800` (值)
- **进度条**: 
  - 背景: `bg-blue-200`
  - 填充: `bg-blue-600`
  - 过渡动画: `transition-all duration-300`

---

## 📝 注意事项

1. **兼容性**: 进度信息是可选的，如果后端未提供，前端会优雅地不显示该部分。

2. **轮询频率**: 任务列表默认每 5 秒轮询一次，确保进度信息实时更新。

3. **仅运行状态显示**: 进度信息主要在任务 `RUNNING` 状态下显示，完成后会显示最终的进度信息（通常是 100%）。

4. **多语言支持**: 预期时间字段 (`estimated_time`) 由后端生成，可能是英文或中文，前端直接显示。

---

## 🚀 未来增强

可考虑的后续优化：

- [ ] 添加进度动画效果
- [ ] 支持实时 WebSocket 推送进度（减少轮询）
- [ ] 添加进度历史记录和可视化图表
- [ ] 支持任务执行日志的实时查看
- [ ] 添加进度告警（如执行时间过长）

---

## 📞 技术支持

如有问题，请查阅：
- [前端快速指南](./FRONTEND_QUICK_GUIDE.md)
- [前端适配指南](./FRONTEND_ADAPTATION_GUIDE.md)
- [Bug修复记录](./bug-fixes/)

---

**最后更新**: 2024-11-12
**版本**: 1.0.0


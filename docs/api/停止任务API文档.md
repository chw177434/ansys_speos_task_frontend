# 停止任务 API 文档

## 概述

本文档说明如何使用停止任务 API，允许用户停止正在执行的任务并释放锁，让排队的任务可以继续执行。

## API 端点

### 停止任务

**请求方式**: `POST`

**URL**: `/api/tasks/{task_id}/stop`

**路径参数**:
- `task_id` (string, 必需): 要停止的任务ID

**响应状态码**:
- `200`: 成功停止任务
- `400`: 任务未运行或无法停止
- `404`: 任务不存在

## 请求示例

```bash
POST /api/tasks/abc123def456/stop
```

## 响应格式

### 成功响应 (200)

```json
{
  "task_id": "abc123def456",
  "status": "CANCELLED",
  "message": "Task stopped successfully",
  "terminated_processes": [
    {
      "pid": 12345,
      "name": "SPEOSCore.exe",
      "method": "terminated"
    }
  ],
  "lock_released": true,
  "previous_status": {
    "celery": "RUNNING",
    "database": "RUNNING"
  }
}
```

### 错误响应 (400)

任务未运行：

```json
{
  "detail": "Task is not running (status: SUCCESS/SUCCESS). Only running tasks can be stopped."
}
```

任务在等待状态：

```json
{
  "detail": "Task is in PENDING state and cannot be stopped yet."
}
```

### 错误响应 (404)

任务不存在：

```json
{
  "detail": "Task not found"
}
```

## 响应字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `task_id` | string | 任务ID |
| `status` | string | 任务新状态（始终为 "CANCELLED"） |
| `message` | string | 操作结果消息 |
| `terminated_processes` | array | 已终止的进程信息列表 |
| `terminated_processes[].pid` | number | 进程ID |
| `terminated_processes[].name` | string | 进程名称 |
| `terminated_processes[].method` | string | 终止方式（"terminated" 或 "killed"） |
| `lock_released` | boolean | Redis锁是否已释放 |
| `previous_status` | object | 任务之前的状态 |
| `previous_status.celery` | string | Celery中的状态 |
| `previous_status.database` | string | 数据库中的状态 |

## 功能说明

### 1. 停止机制

停止任务会执行以下操作：

1. **撤销 Celery 任务**: 使用 `revoke(terminate=True)` 强制终止 Celery worker 中的任务执行
2. **终止求解器进程**: 自动查找并终止相关的求解器进程（SPEOS、FLUENT、Mechanical 等）
3. **释放 Redis 锁**: 释放分布式执行锁，让排队的任务可以立即开始执行
4. **更新任务状态**: 将任务状态更新为 `CANCELLED`，并记录到状态历史

### 2. 支持的求解器

停止功能支持所有求解器类型：
- **SPEOS**: `SPEOSCore.exe`, `speoshpc`
- **FLUENT**: `fluent`, `fluent.exe`
- **Mechanical**: `ansys`, `ansys.exe`
- **Maxwell**: `Maxwell`, `Maxwell.exe`
- **CFX**: `cfx5solve`, `cfx5solve.exe`

系统会根据任务的 `solver_type` 自动识别并终止相应的进程。

### 3. 锁释放机制

停止任务后，Redis 分布式锁会被立即释放。这确保：
- 排队的任务可以立即开始执行
- 不会因为锁未释放而导致后续任务一直等待
- 系统资源得到及时释放

### 4. 任务状态

停止后的任务状态为 `CANCELLED`，具有以下特性：
- 支持删除（可以调用 `DELETE /api/tasks/{task_id}` 删除任务及相关资源）
- 不会自动重试
- 状态历史中会记录停止操作

## 前端集成指南

### 1. UI 按钮位置

建议在任务列表中为**正在运行**的任务添加"停止"按钮：

```typescript
// 示例：React组件
{task.status === 'RUNNING' || task.status === 'PROGRESS' || task.status === 'STARTED' ? (
  <Button 
    onClick={() => handleStopTask(task.task_id)}
    variant="danger"
    size="small"
  >
    停止
  </Button>
) : null}
```

### 2. API 调用示例

#### JavaScript/TypeScript (使用 fetch)

```typescript
async function stopTask(taskId: string) {
  try {
    const response = await fetch(`/api/tasks/${taskId}/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to stop task');
    }

    const result = await response.json();
    console.log('Task stopped:', result);
    
    // 显示成功消息
    showNotification('Task stopped successfully', 'success');
    
    // 刷新任务列表
    refreshTaskList();
    
    return result;
  } catch (error) {
    console.error('Error stopping task:', error);
    showNotification(error.message, 'error');
    throw error;
  }
}
```

#### 使用 Axios

```typescript
import axios from 'axios';

async function stopTask(taskId: string) {
  try {
    const response = await axios.post(`/api/tasks/${taskId}/stop`);
    console.log('Task stopped:', response.data);
    
    // 显示成功消息
    showNotification('Task stopped successfully', 'success');
    
    // 刷新任务列表
    refreshTaskList();
    
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.detail || 'Failed to stop task';
      showNotification(message, 'error');
      throw new Error(message);
    }
    throw error;
  }
}
```

### 3. 用户确认

建议在停止任务前显示确认对话框：

```typescript
function handleStopTask(taskId: string) {
  const confirmed = window.confirm(
    '确定要停止这个任务吗？\n\n' +
    '停止后：\n' +
    '- 任务状态将变为 CANCELLED\n' +
    '- 正在执行的求解器进程将被终止\n' +
    '- 锁会被释放，排队的任务可以开始执行\n' +
    '- 停止后的任务支持删除'
  );

  if (confirmed) {
    stopTask(taskId);
  }
}
```

### 4. 状态更新

停止任务后，需要更新 UI 状态：

```typescript
// 停止任务后更新任务状态
function updateTaskStatus(taskId: string, newStatus: string) {
  // 更新任务列表中的状态
  setTasks(prevTasks => 
    prevTasks.map(task => 
      task.task_id === taskId 
        ? { ...task, status: newStatus }
        : task
    )
  );
  
  // 如果是当前查看的任务，更新详情页状态
  if (selectedTaskId === taskId) {
    setSelectedTask({ ...selectedTask, status: newStatus });
  }
}

// 在 stopTask 成功后调用
async function stopTask(taskId: string) {
  try {
    const result = await fetch(`/api/tasks/${taskId}/stop`, {
      method: 'POST',
    }).then(res => res.json());
    
    // 更新状态为 CANCELLED
    updateTaskStatus(taskId, 'CANCELLED');
    
    showNotification('Task stopped successfully', 'success');
  } catch (error) {
    showNotification(error.message, 'error');
  }
}
```

### 5. 实时更新（可选）

如果使用 WebSocket 或轮询机制，停止任务后任务状态会自动更新：

```typescript
// WebSocket 监听任务状态变化
useEffect(() => {
  const ws = new WebSocket('ws://your-api/ws/tasks');
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'task_status_changed') {
      if (data.task_id === selectedTaskId) {
        updateTaskStatus(data.task_id, data.status);
      }
    }
  };
  
  return () => ws.close();
}, [selectedTaskId]);
```

## 错误处理

### 常见错误及处理

1. **任务未运行**
   - 原因: 任务已完成或未开始
   - 处理: 提示用户任务不在运行状态

2. **任务不存在**
   - 原因: task_id 无效或任务已被删除
   - 处理: 刷新任务列表，移除不存在的任务

3. **网络错误**
   - 原因: API 请求失败
   - 处理: 显示网络错误提示，允许重试

### 错误处理示例

```typescript
async function stopTask(taskId: string) {
  try {
    const response = await fetch(`/api/tasks/${taskId}/stop`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json();
      
      // 根据状态码处理不同错误
      if (response.status === 400) {
        // 任务未运行
        showNotification(error.detail, 'warning');
      } else if (response.status === 404) {
        // 任务不存在
        showNotification('Task not found', 'error');
        // 从列表中移除任务
        removeTaskFromList(taskId);
      } else {
        // 其他错误
        showNotification(error.detail || 'Failed to stop task', 'error');
      }
      
      throw new Error(error.detail);
    }

    const result = await response.json();
    showNotification('Task stopped successfully', 'success');
    return result;
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      // 网络错误
      showNotification('Network error. Please check your connection.', 'error');
    }
    throw error;
  }
}
```

## 注意事项

1. **停止不可逆**: 停止操作不可撤销，任务状态会永久变为 `CANCELLED`
2. **进程终止**: 正在执行的求解器进程会被强制终止，可能不会保存中间结果
3. **锁释放**: 停止任务会立即释放锁，排队的任务可以开始执行
4. **权限**: 确保只有有权限的用户可以停止任务（可能需要添加权限检查）
5. **确认提示**: 建议在停止前显示确认对话框，防止误操作

## 测试建议

### 1. 功能测试

- [ ] 停止正在运行的任务
- [ ] 尝试停止已完成的任务（应该返回错误）
- [ ] 尝试停止不存在的任务（应该返回 404）
- [ ] 验证停止后锁被释放（排队任务可以开始）

### 2. UI 测试

- [ ] 停止按钮只在运行中的任务显示
- [ ] 停止后任务状态正确更新为 CANCELLED
- [ ] 停止后可以删除任务
- [ ] 停止操作有确认提示

### 3. 集成测试

- [ ] 停止任务后，下一个排队的任务可以立即开始
- [ ] 停止的任务不会自动重试
- [ ] 停止的任务在任务列表中正确显示状态

## 更新日志

- **2025-01-XX**: 初始版本，支持停止所有求解器类型的任务

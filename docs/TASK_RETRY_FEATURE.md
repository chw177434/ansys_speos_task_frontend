# 任务重试功能 - 完整指南

## 📋 功能概述

**问题场景**: 任务执行失败后，需要重新上传文件才能再次执行，非常麻烦。

**解决方案**: 实现"重新执行"功能，允许直接重试失败的任务，无需重新上传文件。

---

## 🎯 功能特点

✅ **一键重试**: 点击按钮即可重新执行失败的任务  
✅ **文件复用**: 自动复制或链接原任务的输入文件  
✅ **参数继承**: 使用相同的 SPEOS 参数重新执行  
✅ **关系追踪**: 记录任务之间的重试关系  
✅ **状态独立**: 新任务获得独立的 task_id 和状态  

---

## 🔧 后端实现

### 1. 数据库扩展

新增字段：
- `parent_task_id`: 重试来源任务 ID
- `retry_count`: 重试次数（0表示原始任务，1表示第一次重试）
- `retried_task_ids`: 由此任务生成的重试任务列表（JSON数组）

### 2. API 接口

#### POST `/api/tasks/{task_id}/retry`

**请求参数**:
```typescript
interface RetryTaskRequest {
  copy_files?: boolean;  // 是否复制文件（默认true）
                        // true: 复制文件（安全，占用空间）
                        // false: 创建软/硬链接（节省空间，但原文件不能删除）
  submitter?: string;   // 可选：覆盖提交人信息
}
```

**响应数据**:
```typescript
interface RetryTaskResponse {
  new_task_id: string;      // 新任务ID
  original_task_id: string; // 原任务ID
  status: string;           // 新任务状态（通常是PENDING）
  message: string;          // 说明信息
  files_copied?: number;    // 复制的文件数量（如果copy_files=true）
  files_linked?: number;    // 链接的文件数量（如果copy_files=false）
}
```

**示例请求**:
```bash
# 方式1：复制文件（推荐）
curl -X POST "http://localhost:8000/api/tasks/task_123/retry" \
  -H "Content-Type: application/json" \
  -d '{"copy_files": true}'

# 方式2：使用软链接（节省空间）
curl -X POST "http://localhost:8000/api/tasks/task_123/retry" \
  -H "Content-Type: application/json" \
  -d '{"copy_files": false}'
```

**示例响应**:
```json
{
  "new_task_id": "0f8a5d1e-2c3b-4a7e-9f1d-8b6e5c4d3a2b",
  "original_task_id": "task_123",
  "status": "PENDING",
  "message": "Task retried successfully. New task ID: 0f8a5d1e-2c3b-4a7e-9f1d-8b6e5c4d3a2b",
  "files_copied": 5
}
```

### 3. 任务详情扩展

`GET /api/tasks/{task_id}/detail` 返回的数据新增字段：

```typescript
interface TaskDetail {
  // ... 原有字段 ...
  parent_task_id?: string;      // 父任务ID（如果是重试任务）
  retry_count?: number;          // 重试次数
  retried_task_ids?: string[];   // 重试生成的任务ID列表
}
```

---

## 💻 前端集成指南

### 方式 1: React/TypeScript 示例

#### 1.1 类型定义

```typescript
// types/task.ts

export interface RetryTaskRequest {
  copy_files?: boolean;
  submitter?: string;
}

export interface RetryTaskResponse {
  new_task_id: string;
  original_task_id: string;
  status: string;
  message: string;
  files_copied?: number;
  files_linked?: number;
}

export interface TaskDetail {
  task_id: string;
  status: string;
  created_at?: number;
  // ... 其他字段 ...
  parent_task_id?: string;
  retry_count?: number;
  retried_task_ids?: string[];
}
```

#### 1.2 API 调用函数

```typescript
// api/tasks.ts

export async function retryTask(
  taskId: string,
  options: RetryTaskRequest = { copy_files: true }
): Promise<RetryTaskResponse> {
  const response = await fetch(`/api/tasks/${taskId}/retry`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(options),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to retry task');
  }
  
  return response.json();
}

export async function getTaskDetail(taskId: string): Promise<TaskDetail> {
  const response = await fetch(`/api/tasks/${taskId}/detail`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch task detail');
  }
  
  return response.json();
}
```

#### 1.3 React 组件示例

```typescript
// components/TaskDetailPage.tsx

import React, { useState } from 'react';
import { useRouter } from 'next/router';  // 或 react-router-dom
import { retryTask, getTaskDetail } from '../api/tasks';
import { TaskDetail } from '../types/task';

interface Props {
  task: TaskDetail;
  onTaskUpdated: () => void;
}

export function TaskDetailPage({ task, onTaskUpdated }: Props) {
  const router = useRouter();
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  
  // 判断是否可以重试
  const canRetry = ['FAILURE', 'FAILED', 'REVOKED', 'CANCELLED'].includes(task.status);
  
  const handleRetry = async () => {
    if (!canRetry) return;
    
    setIsRetrying(true);
    setRetryError(null);
    
    try {
      const result = await retryTask(task.task_id, {
        copy_files: true,  // 可以让用户选择
      });
      
      // 显示成功消息
      alert(`任务已重新提交！\n新任务ID: ${result.new_task_id}`);
      
      // 跳转到新任务详情页
      router.push(`/tasks/${result.new_task_id}`);
      
    } catch (error) {
      console.error('Failed to retry task:', error);
      setRetryError(error instanceof Error ? error.message : '重试失败');
    } finally {
      setIsRetrying(false);
    }
  };
  
  return (
    <div className="task-detail">
      <h1>任务详情: {task.task_id}</h1>
      
      {/* 基本信息 */}
      <div className="task-info">
        <p>状态: {task.status}</p>
        <p>创建时间: {new Date(task.created_at * 1000).toLocaleString()}</p>
        {task.parent_task_id && (
          <p>
            重试自: <a href={`/tasks/${task.parent_task_id}`}>{task.parent_task_id}</a>
          </p>
        )}
        {task.retry_count > 0 && (
          <p>重试次数: {task.retry_count}</p>
        )}
      </div>
      
      {/* 操作按钮 */}
      <div className="task-actions">
        {canRetry && (
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="btn btn-primary"
          >
            {isRetrying ? '重试中...' : '🔄 重新执行'}
          </button>
        )}
        
        {retryError && (
          <div className="alert alert-error">
            {retryError}
          </div>
        )}
      </div>
      
      {/* 重试历史 */}
      {task.retried_task_ids && task.retried_task_ids.length > 0 && (
        <div className="retry-history">
          <h3>重试历史</h3>
          <ul>
            {task.retried_task_ids.map(retryTaskId => (
              <li key={retryTaskId}>
                <a href={`/tasks/${retryTaskId}`}>{retryTaskId}</a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

#### 1.4 带选项的高级示例

```typescript
// components/RetryTaskDialog.tsx

import React, { useState } from 'react';
import { retryTask } from '../api/tasks';

interface Props {
  taskId: string;
  onSuccess: (newTaskId: string) => void;
  onCancel: () => void;
}

export function RetryTaskDialog({ taskId, onSuccess, onCancel }: Props) {
  const [copyFiles, setCopyFiles] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    
    try {
      const result = await retryTask(taskId, { copy_files: copyFiles });
      onSuccess(result.new_task_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : '重试失败');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="modal">
      <div className="modal-content">
        <h2>重新执行任务</h2>
        
        <p>确定要重新执行此任务吗？</p>
        
        <div className="form-group">
          <label>
            <input
              type="radio"
              checked={copyFiles}
              onChange={() => setCopyFiles(true)}
            />
            复制文件（推荐，更安全）
          </label>
          
          <label>
            <input
              type="radio"
              checked={!copyFiles}
              onChange={() => setCopyFiles(false)}
            />
            使用软链接（节省空间，但原文件不能删除）
          </label>
        </div>
        
        {error && (
          <div className="alert alert-error">{error}</div>
        )}
        
        <div className="modal-actions">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="btn btn-primary"
          >
            {isSubmitting ? '提交中...' : '确认重试'}
          </button>
          
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="btn btn-secondary"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 方式 2: Vue 示例

```vue
<!-- TaskDetail.vue -->
<template>
  <div class="task-detail">
    <h1>任务详情: {{ task.task_id }}</h1>
    
    <div class="task-info">
      <p>状态: {{ task.status }}</p>
      <p v-if="task.parent_task_id">
        重试自: <router-link :to="`/tasks/${task.parent_task_id}`">
          {{ task.parent_task_id }}
        </router-link>
      </p>
    </div>
    
    <div class="task-actions">
      <button
        v-if="canRetry"
        @click="handleRetry"
        :disabled="isRetrying"
        class="btn btn-primary"
      >
        {{ isRetrying ? '重试中...' : '🔄 重新执行' }}
      </button>
      
      <div v-if="retryError" class="alert alert-error">
        {{ retryError }}
      </div>
    </div>
    
    <div v-if="task.retried_task_ids?.length" class="retry-history">
      <h3>重试历史</h3>
      <ul>
        <li v-for="retryTaskId in task.retried_task_ids" :key="retryTaskId">
          <router-link :to="`/tasks/${retryTaskId}`">
            {{ retryTaskId }}
          </router-link>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { retryTask } from '@/api/tasks';
import type { TaskDetail } from '@/types/task';

interface Props {
  task: TaskDetail;
}

const props = defineProps<Props>();
const router = useRouter();

const isRetrying = ref(false);
const retryError = ref<string | null>(null);

const canRetry = computed(() => 
  ['FAILURE', 'FAILED', 'REVOKED', 'CANCELLED'].includes(props.task.status)
);

async function handleRetry() {
  if (!canRetry.value) return;
  
  isRetrying.value = true;
  retryError.value = null;
  
  try {
    const result = await retryTask(props.task.task_id, { copy_files: true });
    
    alert(`任务已重新提交！\n新任务ID: ${result.new_task_id}`);
    router.push(`/tasks/${result.new_task_id}`);
    
  } catch (error) {
    console.error('Failed to retry task:', error);
    retryError.value = error instanceof Error ? error.message : '重试失败';
  } finally {
    isRetrying.value = false;
  }
}
</script>
```

---

## 🎨 UI/UX 设计建议

### 1. 按钮位置和样式

```typescript
// 推荐的显示位置：
- ✅ 任务详情页的操作区域
- ✅ 任务列表中失败任务的快捷操作
- ✅ 任务历史记录中

// 推荐的视觉设计：
- 图标：🔄 或类似的"重试"图标
- 颜色：次要操作颜色（不要太突出）
- 状态：仅在失败状态显示
```

### 2. 交互流程

```
用户点击"重新执行"
    ↓
显示确认对话框（可选）
├─ 选择文件处理方式：复制 / 链接
├─ 显示预估空间占用
└─ 确认 / 取消
    ↓
提交重试请求
    ↓
显示Loading状态
    ↓
成功 → 跳转到新任务详情页
失败 → 显示错误信息
```

### 3. 用户提示

```typescript
// 推荐的提示文案：
const messages = {
  confirm: '确定要重新执行此任务吗？将使用相同的参数重新提交。',
  success: '任务已重新提交！',
  error: '重试失败，请稍后再试。',
  filesCopied: '已复制 {count} 个文件',
  noFiles: '原任务文件已被清理，无法重试',
};
```

---

## 📊 完整流程图

```
┌─────────────────────────────────────────────────────────┐
│           用户操作：任务执行失败                           │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
         [查看任务详情页]
                 │
                 ▼
     ┌───────────────────────┐
     │  状态显示：FAILURE     │
     │  ├─ 错误信息           │
     │  ├─ 日志链接           │
     │  └─ [重新执行] 按钮    │ ◄─── ✅ 新功能
     └───────────┬───────────┘
                 │ 用户点击
                 ▼
      ┌─────────────────────┐
      │  确认对话框（可选）   │
      │  ├─ 复制文件 ☑       │
      │  └─ 使用链接 ☐       │
      └─────────┬───────────┘
                │ 确认
                ▼
      POST /api/tasks/{id}/retry
                │
                ▼
      ┌─────────────────────┐
      │  后端处理：           │
      │  1. 复制文件         │
      │  2. 创建新任务       │
      │  3. 记录关系         │
      │  4. 提交到队列       │
      └─────────┬───────────┘
                │
                ▼
      ┌─────────────────────┐
      │  返回新任务ID         │
      └─────────┬───────────┘
                │
                ▼
     跳转到新任务详情页
                │
                ▼
      ┌─────────────────────┐
      │  新任务：PENDING     │
      │  ├─ 显示"重试自..."  │
      │  └─ 独立的状态跟踪   │
      └─────────────────────┘
```

---

## 🔍 测试指南

### 1. 后端测试

```bash
# 1. 创建测试任务（会失败）
curl -X POST "http://localhost:8000/api/tasks/submit" \
  -F "master_file=@test.speos" \
  -F "job_name=test_task"

# 获取任务ID，假设为: task_abc123

# 2. 等待任务失败

# 3. 测试重试功能
curl -X POST "http://localhost:8000/api/tasks/task_abc123/retry" \
  -H "Content-Type: application/json" \
  -d '{"copy_files": true}'

# 4. 检查响应
# 应返回新任务ID和成功消息

# 5. 查看原任务详情
curl "http://localhost:8000/api/tasks/task_abc123/detail"
# 应该看到 retried_task_ids 包含新任务ID

# 6. 查看新任务详情
curl "http://localhost:8000/api/tasks/{new_task_id}/detail"
# 应该看到 parent_task_id 为 task_abc123
```

### 2. 前端测试清单

- [ ] 失败任务显示"重新执行"按钮
- [ ] 成功/运行中任务不显示按钮
- [ ] 点击按钮能正确调用 API
- [ ] API 成功后跳转到新任务详情页
- [ ] 新任务显示"重试自"链接
- [ ] 原任务显示"重试历史"列表
- [ ] 错误处理和提示正确显示

---

## ⚠️ 注意事项

### 1. 文件清理策略

**问题**: 如果原任务文件被清理，重试将失败。

**解决方案**:
```typescript
// 建议在后端设置文件保留策略
- 失败任务的输入文件保留30天
- 成功任务的输入文件可立即清理
- 提供手动清理接口
```

### 2. 磁盘空间管理

```typescript
// 推荐使用链接而不是复制（Linux环境）
await retryTask(taskId, { copy_files: false });

// 但要注意：
- 使用链接时，原文件不能删除
- Windows 环境建议使用复制
```

### 3. 并发重试

```typescript
// 避免同时重试多次同一任务
const [retrying, setRetrying] = useState<Set<string>>(new Set());

const handleRetry = async (taskId: string) => {
  if (retrying.has(taskId)) {
    alert('任务正在重试中，请勿重复操作');
    return;
  }
  
  setRetrying(prev => new Set(prev).add(taskId));
  try {
    await retryTask(taskId);
  } finally {
    setRetrying(prev => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
  }
};
```

---

## 📝 数据库迁移

如果数据库已存在，需要运行迁移脚本：

```bash
# 备份数据库
cp database/tasks.sqlite3 database/tasks.sqlite3.backup

# 运行迁移
python tools/migrate_db_add_retry_support.py

# 验证
sqlite3 database/tasks.sqlite3 "PRAGMA table_info(tasks);"
```

---

## 🎉 总结

### 用户体验提升

**修改前**:
1. 任务失败
2. 重新选择文件
3. 重新填写参数
4. 重新上传（可能很大）
5. 提交任务

**修改后**:
1. 任务失败
2. 点击"重新执行"
3. 完成 ✅

**时间节省**: 从 5-10 分钟 → 5 秒  
**用户体验**: ⭐⭐ → ⭐⭐⭐⭐⭐

---

**文档维护**: Backend Team  
**最后更新**: 2025-11-12


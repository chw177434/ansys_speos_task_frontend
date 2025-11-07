# Phase 1 快速参考

## 📦 新增组件一览

### ExecutorBadge - 执行器徽章

显示执行器类型的彩色徽章。

```tsx
import ExecutorBadge from '@/components/ExecutorBadge';

// 标准模式（显示所有执行器）
<ExecutorBadge executorType="hpc" cluster="hpc-head-01.example.com" />

// 紧凑模式（不显示 Local）
<ExecutorBadge executorType="local" compact={true} />  {/* 不显示 */}
<ExecutorBadge executorType="hpc" compact={true} />    {/* 显示 */}
```

**Props:**
- `executorType?: ExecutorType` - 执行器类型
- `cluster?: string | null` - 集群名称
- `compact?: boolean` - 紧凑模式（默认: false）
- `fullClusterName?: boolean` - 显示完整集群名称（默认: false）
- `className?: string` - 自定义样式类

---

### ExecutorInfo - 执行环境信息卡片

显示详细的执行环境信息。

```tsx
import ExecutorInfo from '@/components/ExecutorInfo';

<ExecutorInfo task={taskDetail} />
```

**Props:**
- `task: TaskDetail` - 任务详情对象
- `className?: string` - 自定义样式类

**子组件:**
```tsx
import { ExecutorInfoCompact } from '@/components/ExecutorInfo';

// 紧凑版（用于列表页）
<ExecutorInfoCompact 
  executorType="hpc"
  cluster="hpc-head-01.example.com"
  externalJobId="12345"
/>
```

---

### useTaskPolling - 智能轮询 Hook

自动轮询任务状态，根据执行器类型优化间隔。

```tsx
import { useTaskPolling } from '@/hooks/useTaskPolling';

const { task, loading, error, refresh, isPolling } = useTaskPolling({
  taskId: 'task_xxx',
  executorType: 'hpc',
  enabled: true,
  onStatusChange: (oldStatus, newStatus) => {
    console.log(`状态变化: ${oldStatus} -> ${newStatus}`);
  }
});
```

**Options:**
- `taskId: string` - 任务 ID（必填）
- `executorType?: ExecutorType` - 执行器类型
- `enabled?: boolean` - 是否启用轮询（默认: true）
- `customInterval?: number` - 自定义轮询间隔（毫秒）
- `onError?: (error: Error) => void` - 错误回调
- `onStatusChange?: (oldStatus: string | null, newStatus: string) => void` - 状态变化回调

**Returns:**
- `task: TaskStatus | null` - 任务状态
- `loading: boolean` - 是否正在加载
- `error: Error | null` - 错误信息
- `refresh: () => Promise<void>` - 手动刷新
- `isPolling: boolean` - 是否处于轮询中

---

## 🎨 类型定义

### ExecutorType

```typescript
type ExecutorType = 'local' | 'hpc' | 'slurm';
```

### TaskStatus（扩展）

```typescript
interface TaskStatus {
  task_id: string;
  status: string;
  message?: string | null;
  download_url?: string | null;
  download_name?: string | null;
  duration?: number | null;
  elapsed_seconds?: number | null;
  created_at?: number | null;
  
  // ⚡ Phase 1 新增
  executor_type?: ExecutorType;
  external_job_id?: string | null;
  cluster?: string | null;
  raw_status?: string | null;
}
```

### TaskDetail（扩展）

```typescript
interface TaskDetail extends TaskStatus {
  job_name?: string | null;
  display_name?: string | null;
  submitter?: string | null;
  params?: Record<string, any>;
  status_history?: Array<{
    status: string;
    timestamp: number;
    message?: string | null;
    raw_status?: string | null;
  }>;
  
  // ⚡ Phase 1 新增
  queue_or_partition?: string | null;
  qos_or_priority_class?: string | null;
}
```

---

## 🛠️ 工具函数

### getExecutorDisplayName

获取执行器显示名称。

```typescript
import { getExecutorDisplayName } from '@/types/api';

getExecutorDisplayName('local');  // "本地执行"
getExecutorDisplayName('hpc');    // "Windows HPC"
getExecutorDisplayName('slurm');  // "Linux Slurm"
```

### getExecutorColorConfig

获取执行器颜色配置。

```typescript
import { getExecutorColorConfig } from '@/types/api';

const colors = getExecutorColorConfig('hpc');
// { text: 'text-blue-700', bg: 'bg-blue-100', border: 'border-blue-300' }
```

### getPollingInterval

获取推荐的轮询间隔（毫秒）。

```typescript
import { getPollingInterval } from '@/types/api';

getPollingInterval('local');  // 5000 (5秒)
getPollingInterval('hpc');    // 15000 (15秒)
getPollingInterval('slurm');  // 15000 (15秒)
```

### formatClusterName

格式化集群名称（简化显示）。

```typescript
import { formatClusterName } from '@/types/api';

formatClusterName('hpc-head-01.example.com');  // "hpc-head-01"
```

### isRemoteExecutor

判断是否为远程执行器。

```typescript
import { isRemoteExecutor } from '@/types/api';

isRemoteExecutor('local');  // false
isRemoteExecutor('hpc');    // true
isRemoteExecutor('slurm');  // true
```

---

## 📋 使用示例

### 1. 在任务列表中显示执行器标识

```tsx
import ExecutorBadge from '@/components/ExecutorBadge';
import { ExecutorInfoCompact } from '@/components/ExecutorInfo';

function TaskListItem({ task }) {
  return (
    <div className="task-item">
      <div className="flex items-center gap-2">
        <h3>{task.job_name}</h3>
        {/* 显示执行器徽章（不显示 Local） */}
        <ExecutorBadge 
          executorType={task.executor_type} 
          cluster={task.cluster}
          compact={true}
        />
      </div>
      
      {/* 显示详细信息（仅远程执行器） */}
      <ExecutorInfoCompact
        executorType={task.executor_type}
        cluster={task.cluster}
        externalJobId={task.external_job_id}
      />
    </div>
  );
}
```

### 2. 在任务详情页显示执行环境

```tsx
import ExecutorInfo from '@/components/ExecutorInfo';

function TaskDetailPage({ task }) {
  return (
    <div>
      <h1>{task.job_name}</h1>
      
      {/* 显示执行环境信息 */}
      <ExecutorInfo task={task} />
      
      {/* 其他内容 */}
    </div>
  );
}
```

### 3. 使用智能轮询

```tsx
import { useTaskPolling } from '@/hooks/useTaskPolling';

function TaskMonitor({ taskId }) {
  const { task, loading, error, refresh, isPolling } = useTaskPolling({
    taskId,
    onStatusChange: (oldStatus, newStatus) => {
      if (newStatus === 'SUCCESS') {
        console.log('任务完成！');
      }
    }
  });

  if (loading && !task) return <div>加载中...</div>;
  if (error) return <div>错误: {error.message}</div>;

  return (
    <div>
      <p>状态: {task.status}</p>
      <p>执行器: {task.executor_type}</p>
      <button onClick={refresh}>刷新</button>
      {isPolling && <span>🔄 实时更新中</span>}
    </div>
  );
}
```

---

## 🎨 颜色方案

| 执行器 | 文本颜色 | 背景颜色 | 边框颜色 | 图标 |
|--------|---------|---------|---------|-----|
| Local  | `text-gray-700` | `bg-gray-100` | `border-gray-300` | 🖥️ |
| HPC    | `text-blue-700` | `bg-blue-100` | `border-blue-300` | 🏢 |
| Slurm  | `text-green-700` | `bg-green-100` | `border-green-300` | 🐧 |

---

## 📊 轮询策略

| 执行器类型 | 轮询间隔 | 原因 |
|-----------|---------|------|
| Local     | 5秒     | 本地执行，实时响应 |
| HPC       | 15秒    | 后端有轮询器，降低前端负载 |
| Slurm     | 15秒    | 后端有轮询器，降低前端负载 |

**自动停止轮询**：任务到达终止状态（SUCCESS、FAILURE、CANCELLED 等）时自动停止。

---

## 🚦 终止状态列表

```typescript
const TERMINAL_STATUSES = [
  'SUCCESS',
  'FAILURE',
  'FAILED',
  'REVOKED',
  'CANCELLED',
  'CANCELED',
  'ABORTED',
];
```

---

## 📝 路由

### 任务详情页

**路径**: `/tasks/[taskId]`

**示例**: `/tasks/task_20241106_123456_abc123`

**功能**:
- 显示任务完整信息
- 显示执行环境信息
- 显示状态历史
- 显示输出文件
- 智能轮询

---

## 💡 最佳实践

### 1. 执行器标识显示

- **任务列表**：使用 `compact={true}` 不显示 Local 标识
- **任务详情**：使用标准模式显示所有执行器

### 2. 轮询优化

- 使用 `useTaskPolling` Hook 自动优化
- 不需要手动设置轮询间隔
- Hook 会自动停止终止状态的轮询

### 3. 类型安全

- 始终使用 TypeScript 类型定义
- 利用 IDE 自动补全
- 避免使用 `any` 类型

### 4. 响应式设计

- 所有组件都支持响应式布局
- 使用 Tailwind 的响应式工具类
- 测试不同屏幕尺寸

---

## 🔗 相关文档

- [Phase 1 升级完成报告](./PHASE1_UPGRADE_COMPLETE.md)
- [给前端的说明 - Phase 1](./给前端的说明_PHASE1.md)
- [前端改动清单 - Phase 1](./FRONTEND_CHECKLIST_PHASE1.md)

---

**文档版本**: 1.0  
**创建日期**: 2025-11-06


/**
 * API 类型定义 - Phase 1
 * 
 * 支持 Local、HPC 和 Slurm 执行器
 */

// ============= 执行器相关类型 =============

/**
 * 执行器类型
 * - local: 本地 Celery 队列执行
 * - hpc: Windows HPC 调度系统
 * - slurm: Linux Slurm 调度系统
 */
export type ExecutorType = 'local' | 'hpc' | 'slurm';

// ============= 任务状态相关类型 =============

/**
 * 任务状态响应 - 基础接口
 */
export interface TaskStatus {
  task_id: string;
  status: string;
  message?: string | null;
  output_path?: string | null;
  logs_path?: string | null;
  download_url?: string | null;
  download_name?: string | null;
  duration?: number | null;
  elapsed_seconds?: number | null;
  created_at?: number | null;
  
  // ⚡ Phase 1 新增：执行器信息（可选字段）
  executor_type?: ExecutorType;
  external_job_id?: string | null;
  cluster?: string | null;
  raw_status?: string | null;
}

/**
 * 任务详情 - 扩展接口
 */
export interface TaskDetail extends TaskStatus {
  job_name?: string | null;
  archive_id?: string | null;
  input_dir?: string | null;
  output_dir?: string | null;
  log_dir?: string | null;
  params?: Record<string, any>;
  display_name?: string | null;
  submitter?: string | null;
  
  // 状态历史
  status_history?: Array<{
    status: string;
    timestamp: number;
    message?: string | null;
    raw_status?: string | null;
  }>;
  
  // ⚡ Phase 1 新增：HPC/Slurm 特有字段（可选）
  queue_or_partition?: string | null;
  qos_or_priority_class?: string | null;
}

/**
 * 任务列表项
 */
export interface TaskListItem {
  task_id: string;
  status: string;
  created_at?: number | null;
  job_name?: string | null;
  display_name?: string | null;
  submitter?: string | null;
  download_url?: string | null;
  download_name?: string | null;
  duration?: number | null;
  elapsed_seconds?: number | null;
  
  // ⚡ Phase 1 新增：执行器信息（可选字段）
  executor_type?: ExecutorType;
  cluster?: string | null;
}

// ============= API 响应类型 =============

/**
 * 创建任务响应
 */
export interface CreateTaskResponse {
  task_id: string;
  status?: string;
  message?: string | null;
  executor_type?: ExecutorType;
}

/**
 * 任务输出响应
 */
export interface TaskOutputsResponse {
  task_id: string;
  base_dir?: string | null;
  files: Array<string | { name?: string; url?: string }>;
  file_entries?: Array<{ name?: string; url?: string }>;
  download_url?: string | null;
  download_name?: string | null;
}

/**
 * 任务列表响应（支持分页）
 */
export interface TasksListResponse {
  items?: TaskListItem[];
  total?: number;
  count?: number;
  page?: number;
  page_size?: number;
}

// ============= 工具函数：执行器相关 =============

/**
 * 获取执行器显示名称
 */
export function getExecutorDisplayName(type?: ExecutorType): string {
  if (!type) return '本地执行';
  
  switch (type) {
    case 'local':
      return '本地执行';
    case 'hpc':
      return 'Windows HPC';
    case 'slurm':
      return 'Linux Slurm';
    default:
      return type.toUpperCase();
  }
}

/**
 * 获取执行器颜色配置
 */
export function getExecutorColorConfig(type?: ExecutorType): {
  text: string;
  bg: string;
  border: string;
} {
  if (!type || type === 'local') {
    return {
      text: 'text-gray-700',
      bg: 'bg-gray-100',
      border: 'border-gray-300',
    };
  }
  
  switch (type) {
    case 'hpc':
      return {
        text: 'text-blue-700',
        bg: 'bg-blue-100',
        border: 'border-blue-300',
      };
    case 'slurm':
      return {
        text: 'text-green-700',
        bg: 'bg-green-100',
        border: 'border-green-300',
      };
    default:
      return {
        text: 'text-purple-700',
        bg: 'bg-purple-100',
        border: 'border-purple-300',
      };
  }
}

/**
 * 获取推荐的轮询间隔（毫秒）
 */
export function getPollingInterval(executorType?: ExecutorType): number {
  // Local: 5秒（实时）
  // HPC/Slurm: 15秒（后端有轮询器，前端可以降低频率）
  return (!executorType || executorType === 'local') ? 5000 : 15000;
}

/**
 * 格式化集群名称（简化显示）
 */
export function formatClusterName(cluster?: string | null): string {
  if (!cluster) return '';
  
  // 提取主机名前缀（例如：hpc-head-01.example.com -> hpc-head-01）
  const parts = cluster.split('.');
  return parts[0] || cluster;
}

/**
 * 判断是否为远程执行器
 */
export function isRemoteExecutor(executorType?: ExecutorType): boolean {
  return executorType === 'hpc' || executorType === 'slurm';
}


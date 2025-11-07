"use client";

import type { TaskDetail } from "../types/api";
import {
  getExecutorDisplayName,
  getExecutorColorConfig,
  isRemoteExecutor,
} from "../types/api";
import ExecutorBadge from "./ExecutorBadge";

/**
 * 执行环境信息卡片组件
 * 
 * 功能：
 * - Local 模式：显示简单提示
 * - HPC/Slurm 模式：显示详细执行环境信息
 * - 响应式布局
 */

interface ExecutorInfoProps {
  task: TaskDetail;
  className?: string;
}

export default function ExecutorInfo({ task, className = "" }: ExecutorInfoProps) {
  const { executor_type, external_job_id, cluster, raw_status, queue_or_partition, qos_or_priority_class } = task;

  // Local 模式：简单提示
  if (!executor_type || executor_type === "local") {
    return (
      <div className={`rounded-xl border border-gray-200 bg-white p-4 shadow-sm ${className}`}>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
          <span className="text-lg">🖥️</span>
          <span>执行环境</span>
        </h3>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
            <span>🏠</span>
            <span>本地 Celery 队列执行</span>
          </span>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          任务在本地服务器的 Celery Worker 中执行
        </p>
      </div>
    );
  }

  // HPC/Slurm 模式：详细信息
  const colors = getExecutorColorConfig(executor_type);
  const displayName = getExecutorDisplayName(executor_type);

  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-5 shadow-sm ${className}`}>
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
        <span className="text-lg">{executor_type === "hpc" ? "🏢" : "🐧"}</span>
        <span>执行环境</span>
      </h3>

      <div className="grid gap-3 sm:grid-cols-2">
        {/* 执行器类型 */}
        <InfoItem label="执行器">
          <ExecutorBadge executorType={executor_type} cluster={cluster} />
        </InfoItem>

        {/* 集群名称 */}
        {cluster && (
          <InfoItem label="集群地址">
            <code className="rounded bg-gray-100 px-2 py-0.5 text-xs font-mono text-gray-800">
              {cluster}
            </code>
          </InfoItem>
        )}

        {/* 外部任务 ID */}
        {external_job_id && (
          <InfoItem label="外部任务 ID">
            <code className="rounded bg-gray-100 px-2 py-0.5 text-xs font-mono text-gray-800">
              {external_job_id}
            </code>
          </InfoItem>
        )}

        {/* 原生状态 */}
        {raw_status && raw_status !== task.status && (
          <InfoItem label="原生状态">
            <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}>
              {raw_status}
            </span>
          </InfoItem>
        )}

        {/* 队列/分区 */}
        {queue_or_partition && (
          <InfoItem label={executor_type === "hpc" ? "队列" : "分区"}>
            <span className="text-xs text-gray-700">{queue_or_partition}</span>
          </InfoItem>
        )}

        {/* QoS/优先级 */}
        {qos_or_priority_class && (
          <InfoItem label={executor_type === "hpc" ? "优先级" : "QoS"}>
            <span className="text-xs text-gray-700">{qos_or_priority_class}</span>
          </InfoItem>
        )}
      </div>

      {/* 底部说明 */}
      <div className="mt-4 flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-700">
        <span className="mt-0.5 shrink-0">ℹ️</span>
        <p>
          {executor_type === "hpc" 
            ? "任务已提交到 Windows HPC 集群，由 HPC 调度器管理执行。"
            : "任务已提交到 Linux Slurm 集群，由 Slurm 调度器管理执行。"}
        </p>
      </div>
    </div>
  );
}

/**
 * 信息项子组件
 */
interface InfoItemProps {
  label: string;
  children: React.ReactNode;
}

function InfoItem({ label, children }: InfoItemProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      <div>{children}</div>
    </div>
  );
}

/**
 * 执行环境信息（紧凑版） - 用于列表页
 */
interface ExecutorInfoCompactProps {
  executorType?: string;
  cluster?: string | null;
  externalJobId?: string | null;
  className?: string;
}

export function ExecutorInfoCompact({
  executorType,
  cluster,
  externalJobId,
  className = "",
}: ExecutorInfoCompactProps) {
  // Local 模式不显示
  if (!executorType || executorType === "local") {
    return null;
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 text-xs text-gray-600 ${className}`}>
      {cluster && (
        <span className="flex items-center gap-1">
          <span className="opacity-70">📍</span>
          <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono">
            {cluster.split(".")[0]}
          </code>
        </span>
      )}
      {externalJobId && (
        <span className="flex items-center gap-1">
          <span className="opacity-70">🔢</span>
          <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono">
            {externalJobId}
          </code>
        </span>
      )}
    </div>
  );
}


"use client";

import type { ExecutorType } from "../types/api";
import {
  getExecutorDisplayName,
  getExecutorColorConfig,
  formatClusterName,
  isRemoteExecutor,
} from "../types/api";

/**
 * 执行器标识组件
 * 
 * 功能：
 * - 显示执行器类型（Local/HPC/Slurm）
 * - 可选显示集群名称
 * - 自适应颜色方案
 * - 支持紧凑模式和标准模式
 */

interface ExecutorBadgeProps {
  /** 执行器类型 */
  executorType?: ExecutorType;
  /** 集群名称（可选） */
  cluster?: string | null;
  /** 紧凑模式（不显示 Local） */
  compact?: boolean;
  /** 显示完整集群名称 */
  fullClusterName?: boolean;
  /** 自定义样式类 */
  className?: string;
}

export default function ExecutorBadge({
  executorType,
  cluster,
  compact = false,
  fullClusterName = false,
  className = "",
}: ExecutorBadgeProps) {
  // 紧凑模式：不显示 Local 执行器
  if (compact && (!executorType || executorType === "local")) {
    return null;
  }

  const displayName = getExecutorDisplayName(executorType);
  const colors = getExecutorColorConfig(executorType);
  const showCluster = isRemoteExecutor(executorType) && cluster;
  const clusterDisplay = fullClusterName ? cluster : formatClusterName(cluster);

  // 获取执行器图标
  const getIcon = (type?: ExecutorType): string => {
    if (!type || type === "local") return "🖥️";
    if (type === "hpc") return "🏢";
    if (type === "slurm") return "🐧";
    return "⚙️";
  };

  const icon = getIcon(executorType);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${colors.bg} ${colors.text} ${colors.border} ${className}`}
      title={
        showCluster
          ? `执行环境: ${displayName} @ ${cluster}`
          : `执行环境: ${displayName}`
      }
    >
      <span className="text-sm" aria-hidden="true">
        {icon}
      </span>
      <span className="font-semibold">{displayName}</span>
      {showCluster && (
        <>
          <span className="opacity-50">@</span>
          <span className="font-mono text-[10px] opacity-75">
            {clusterDisplay}
          </span>
        </>
      )}
    </span>
  );
}

/**
 * 执行器标识（简化版） - 仅图标
 */
interface ExecutorIconProps {
  executorType?: ExecutorType;
  className?: string;
}

export function ExecutorIcon({
  executorType,
  className = "",
}: ExecutorIconProps) {
  const getIcon = (type?: ExecutorType): string => {
    if (!type || type === "local") return "🖥️";
    if (type === "hpc") return "🏢";
    if (type === "slurm") return "🐧";
    return "⚙️";
  };

  const displayName = getExecutorDisplayName(executorType);

  return (
    <span
      className={`inline-block text-lg ${className}`}
      title={`执行环境: ${displayName}`}
      aria-label={displayName}
    >
      {getIcon(executorType)}
    </span>
  );
}


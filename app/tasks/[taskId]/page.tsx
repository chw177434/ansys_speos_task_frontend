"use client";

import { use, useCallback, useState } from "react";
import Link from "next/link";
import type { TaskDetail } from "../../../types/api";
import { API_BASE } from "../../../lib/api";
import { useTaskPolling } from "../../../hooks/useTaskPolling";
import ExecutorBadge from "../../../components/ExecutorBadge";
import ExecutorInfo from "../../../components/ExecutorInfo";
import { getExecutorColorConfig } from "../../../types/api";

/**
 * 任务详情页
 * 
 * 功能：
 * - 显示任务完整信息
 * - 显示执行环境信息（Local/HPC/Slurm）
 * - 显示状态历史
 * - 显示输出文件
 * - 智能轮询（根据执行器类型自动调整）
 */

type TaskPageParams = {
  taskId: string;
};

type TaskPageProps = {
  params: Promise<TaskPageParams>;
};

// 终止状态
const TERMINAL_STATUSES = new Set([
  "SUCCESS",
  "FAILURE",
  "FAILED",
  "REVOKED",
  "CANCELLED",
  "CANCELED",
  "ABORTED",
]);

// 状态信息映射
const STATUS_INFO: Record<
  string,
  { icon: string; label: string; color: string; bgColor: string }
> = {
  PENDING: { icon: "⏳", label: "等待中", color: "text-yellow-700", bgColor: "bg-yellow-100" },
  DOWNLOADING: { icon: "📥", label: "下载中", color: "text-blue-700", bgColor: "bg-blue-100" },
  STARTED: { icon: "🚀", label: "启动中", color: "text-blue-700", bgColor: "bg-blue-100" },
  RUNNING: { icon: "▶️", label: "运行中", color: "text-blue-700", bgColor: "bg-blue-100" },
  PROGRESS: { icon: "⚙️", label: "执行中", color: "text-blue-700", bgColor: "bg-blue-100" },
  RETRY: { icon: "🔄", label: "重试中", color: "text-orange-700", bgColor: "bg-orange-100" },
  SUCCESS: { icon: "✅", label: "成功", color: "text-green-700", bgColor: "bg-green-100" },
  FAILURE: { icon: "❌", label: "失败", color: "text-red-700", bgColor: "bg-red-100" },
  FAILED: { icon: "❌", label: "失败", color: "text-red-700", bgColor: "bg-red-100" },
  REVOKED: { icon: "🚫", label: "已撤销", color: "text-gray-700", bgColor: "bg-gray-100" },
  CANCELLED: { icon: "⛔", label: "已取消", color: "text-gray-700", bgColor: "bg-gray-100" },
  CANCELED: { icon: "⛔", label: "已取消", color: "text-gray-700", bgColor: "bg-gray-100" },
  ABORTED: { icon: "🛑", label: "已中止", color: "text-gray-700", bgColor: "bg-gray-100" },
};

function getStatusInfo(status: string) {
  return (
    STATUS_INFO[status] || {
      icon: "❔",
      label: status,
      color: "text-gray-600",
      bgColor: "bg-gray-50",
    }
  );
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) {
    return "-";
  }

  const totalSeconds = Math.floor(seconds);
  const s = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const m = totalMinutes % 60;
  const h = Math.floor(totalMinutes / 60);

  const parts: string[] = [];
  if (h > 0) parts.push(`${h}小时`);
  if (h > 0 || m > 0) parts.push(`${m}分`);
  parts.push(`${s}秒`);

  return parts.join("");
}

function formatTimestamp(timestamp: number | null | undefined): string {
  if (timestamp == null) return "-";
  
  // 如果 timestamp 小于 10 位，认为是秒级时间戳，需要转换为毫秒
  const ms = timestamp < 10000000000 ? timestamp * 1000 : timestamp;
  
  return new Date(ms).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export default function TaskPage({ params }: TaskPageProps) {
  const { taskId } = use(params);
  const [taskDetail, setTaskDetail] = useState<TaskDetail | null>(null);

  // 获取任务详情
  const fetchTaskDetail = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/tasks/${taskId}`);
      if (!response.ok) {
        throw new Error("获取任务详情失败");
      }
      const data = await response.json();
      setTaskDetail(data as TaskDetail);
    } catch (err) {
      console.error("获取任务详情失败:", err);
    }
  }, [taskId]);

  // 智能轮询
  const { task, loading, error, refresh, isPolling } = useTaskPolling({
    taskId,
    executorType: taskDetail?.executor_type,
    enabled: true,
    onStatusChange: (oldStatus, newStatus) => {
      console.log(`任务状态变化: ${oldStatus} -> ${newStatus}`);
      // 状态变化时重新获取详情
      void fetchTaskDetail();
    },
  });

  // 初始加载详情
  useState(() => {
    void fetchTaskDetail();
  });

  if (loading && !task) {
    return (
      <main className="min-h-screen bg-gray-50 p-6 sm:p-10">
        <div className="mx-auto max-w-5xl">
          <div className="text-center text-gray-500">加载中...</div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-50 p-6 sm:p-10">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-lg bg-red-50 p-4 text-center text-red-700">
            {error.message}
          </div>
        </div>
      </main>
    );
  }

  if (!task) {
    return (
      <main className="min-h-screen bg-gray-50 p-6 sm:p-10">
        <div className="mx-auto max-w-5xl">
          <div className="text-center text-gray-500">任务不存在</div>
        </div>
      </main>
    );
  }

  const statusInfo = getStatusInfo(task.status);
  const isTerminal = TERMINAL_STATUSES.has(task.status);
  const detail = taskDetail || task;

  return (
    <main className="min-h-screen bg-gray-50 p-6 sm:p-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        {/* 顶部导航 */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm transition hover:border-blue-400 hover:text-blue-600"
          >
            <span aria-hidden>←</span>
            返回任务列表
          </Link>
          <div className="flex items-center gap-2">
            {isPolling && !isTerminal && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500"></span>
                <span>实时更新中</span>
              </span>
            )}
            <button
              onClick={refresh}
              disabled={loading}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? "刷新中..." : "手动刷新"}
            </button>
          </div>
        </div>

        {/* 任务标题 */}
        <header className="space-y-3 rounded-2xl bg-white p-6 shadow">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex-1 space-y-2">
              <h1 className="text-2xl font-bold text-gray-900">
                {detail.job_name || detail.display_name || task.task_id}
              </h1>
              <p className="font-mono text-sm text-gray-500">任务 ID: {task.task_id}</p>
            </div>
            <ExecutorBadge
              executorType={task.executor_type}
              cluster={task.cluster}
            />
          </div>
          {detail.submitter && (
            <p className="text-sm text-gray-600">提交者: {detail.submitter}</p>
          )}
        </header>

        {/* 状态卡片 */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">任务状态</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <InfoItem label="当前状态">
              <span
                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${statusInfo.bgColor} ${statusInfo.color}`}
              >
                <span>{statusInfo.icon}</span>
                <span>{statusInfo.label}</span>
              </span>
            </InfoItem>
            <InfoItem label="创建时间">
              <span className="text-xs text-gray-700">
                {formatTimestamp(task.created_at)}
              </span>
            </InfoItem>
            <InfoItem label="执行时长">
              <span className="text-xs text-gray-700">
                {formatDuration(task.elapsed_seconds || task.duration)}
              </span>
            </InfoItem>
            <InfoItem label="状态">
              <span className="text-xs text-gray-700">
                {isTerminal ? "已完成" : "进行中"}
              </span>
            </InfoItem>
          </div>
          {task.message && (
            <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
              <span className="font-medium">消息: </span>
              {task.message}
            </div>
          )}
        </div>

        {/* 执行环境信息 */}
        <ExecutorInfo task={detail} />

        {/* 状态历史 */}
        {detail.status_history && detail.status_history.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-gray-900">状态历史</h3>
            <div className="space-y-2">
              {detail.status_history.map((history, index) => {
                const historyInfo = getStatusInfo(history.status);
                return (
                  <div
                    key={index}
                    className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3"
                  >
                    <span className="text-lg">{historyInfo.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">
                          {historyInfo.label}
                        </span>
                        {history.raw_status && history.raw_status !== history.status && (
                          <code className="rounded bg-white px-1.5 py-0.5 text-xs text-gray-600">
                            {history.raw_status}
                          </code>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {formatTimestamp(history.timestamp)}
                      </div>
                      {history.message && (
                        <div className="mt-1 text-xs text-gray-600">{history.message}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 输出文件 */}
        {task.status === "SUCCESS" && task.download_url && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-gray-900">输出文件</h3>
            <a
              href={task.download_url}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              <span>📥</span>
              <span>{task.download_name || "下载结果文件"}</span>
            </a>
          </div>
        )}

        {/* 任务参数 */}
        {detail.params && Object.keys(detail.params).length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-gray-900">任务参数</h3>
            <pre className="overflow-x-auto rounded-lg bg-gray-50 p-4 text-xs">
              {JSON.stringify(detail.params, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </main>
  );
}

function InfoItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      <div>{children}</div>
    </div>
  );
}


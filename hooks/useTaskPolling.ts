import { useCallback, useEffect, useRef, useState } from "react";
import type { ExecutorType, TaskStatus } from "../types/api";
import { getPollingInterval } from "../types/api";
import { getTaskStatus } from "../lib/api";

/**
 * 智能任务轮询 Hook
 * 
 * 功能：
 * - 根据执行器类型自动调整轮询间隔
 * - Local: 5秒（实时响应）
 * - HPC/Slurm: 15秒（后端有轮询器，降低前端频率）
 * - 自动检测终止状态并停止轮询
 * - 支持手动刷新
 * - 自动清理定时器
 */

// 终止状态集合
const TERMINAL_STATUSES = new Set([
  "SUCCESS",
  "FAILURE",
  "FAILED",
  "REVOKED",
  "CANCELLED",
  "CANCELED",
  "ABORTED",
]);

interface UseTaskPollingOptions {
  /** 任务 ID */
  taskId: string;
  /** 执行器类型（可选，用于优化轮询间隔） */
  executorType?: ExecutorType;
  /** 是否启用轮询（默认: true） */
  enabled?: boolean;
  /** 自定义轮询间隔（毫秒），会覆盖自动计算的间隔 */
  customInterval?: number;
  /** 错误回调 */
  onError?: (error: Error) => void;
  /** 状态变化回调 */
  onStatusChange?: (oldStatus: string | null, newStatus: string) => void;
}

interface UseTaskPollingResult {
  /** 任务状态 */
  task: TaskStatus | null;
  /** 是否正在加载 */
  loading: boolean;
  /** 错误信息 */
  error: Error | null;
  /** 手动刷新 */
  refresh: () => Promise<void>;
  /** 是否处于轮询中 */
  isPolling: boolean;
}

export function useTaskPolling({
  taskId,
  executorType,
  enabled = true,
  customInterval,
  onError,
  onStatusChange,
}: UseTaskPollingOptions): UseTaskPollingResult {
  const [task, setTask] = useState<TaskStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [isPolling, setIsPolling] = useState<boolean>(false);

  // 使用 ref 存储最新的状态，避免闭包问题
  const taskRef = useRef<TaskStatus | null>(null);
  const timerRef = useRef<number | null>(null);

  // 计算轮询间隔
  const pollingInterval = customInterval ?? getPollingInterval(executorType);

  // 获取任务状态
  const fetchTask = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await getTaskStatus(taskId);
      
      // 检测状态变化
      const oldStatus = taskRef.current?.status ?? null;
      const newStatus = data.status;
      
      if (oldStatus !== newStatus && onStatusChange) {
        onStatusChange(oldStatus, newStatus);
      }

      setTask(data);
      taskRef.current = data;

      return data;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error("获取任务状态失败");
      setError(errorObj);
      
      if (onError) {
        onError(errorObj);
      }

      return null;
    } finally {
      setLoading(false);
    }
  }, [taskId, onError, onStatusChange]);

  // 手动刷新
  const refresh = useCallback(async () => {
    await fetchTask();
  }, [fetchTask]);

  // 轮询逻辑
  useEffect(() => {
    if (!enabled) {
      setIsPolling(false);
      return;
    }

    // 初始加载
    void fetchTask();

    // 设置轮询定时器
    const startPolling = () => {
      // 清除旧定时器
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
      }

      // 创建新定时器
      timerRef.current = window.setInterval(async () => {
        const currentTask = taskRef.current;
        
        // 如果任务已处于终止状态，停止轮询
        if (currentTask && TERMINAL_STATUSES.has(currentTask.status)) {
          if (timerRef.current !== null) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
          }
          setIsPolling(false);
          return;
        }

        // 继续轮询
        await fetchTask();
      }, pollingInterval);

      setIsPolling(true);
    };

    startPolling();

    // 清理函数
    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setIsPolling(false);
    };
  }, [enabled, fetchTask, pollingInterval]);

  return {
    task,
    loading,
    error,
    refresh,
    isPolling,
  };
}

/**
 * 批量任务轮询 Hook（用于任务列表）
 * 
 * 注意：此 Hook 适用于任务列表页面，使用统一的轮询策略
 */
interface UseBatchTaskPollingOptions {
  /** 是否启用轮询（默认: true） */
  enabled?: boolean;
  /** 轮询间隔（毫秒，默认: 5000） */
  interval?: number;
  /** 获取任务列表的回调 */
  onPoll: () => Promise<void>;
  /** 判断是否需要轮询的回调 */
  shouldPoll?: () => boolean;
}

export function useBatchTaskPolling({
  enabled = true,
  interval = 5000,
  onPoll,
  shouldPoll,
}: UseBatchTaskPollingOptions): { isPolling: boolean } {
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setIsPolling(false);
      return;
    }

    // 设置轮询定时器
    const startPolling = () => {
      // 清除旧定时器
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
      }

      // 创建新定时器
      timerRef.current = window.setInterval(async () => {
        // 检查是否需要继续轮询
        if (shouldPoll && !shouldPoll()) {
          if (timerRef.current !== null) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
          }
          setIsPolling(false);
          return;
        }

        // 执行轮询
        await onPoll();
      }, interval);

      setIsPolling(true);
    };

    startPolling();

    // 清理函数
    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setIsPolling(false);
    };
  }, [enabled, interval, onPoll, shouldPoll]);

  return { isPolling };
}


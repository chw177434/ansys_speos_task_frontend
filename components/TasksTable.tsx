"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  API_BASE,
  deleteTask,
  listOutputs,
  type TaskOutputsResponse,
} from "../lib/api";
import type { ExecutorType } from "../types/api";
import ExecutorBadge from "./ExecutorBadge";
import { ExecutorInfoCompact } from "./ExecutorInfo";

const PAGE_SIZE_OPTIONS = [10, 20, 50];
const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_OUTPUT_NAME = "下载文件";

// 终止状态：任务已结束，不再需要轮询
const TERMINAL_STATUSES = new Set([
  "SUCCESS",      // 成功
  "FAILURE",      // 失败
  "FAILED",       // 失败（Celery标准）
  "REVOKED",      // 已撤销
  "CANCELLED",    // 已取消（英式）
  "CANCELED",     // 已取消（美式）
  "ABORTED",      // 已中止
]);

// 状态筛选选项：按用户关注度排序
const STATUS_FILTER_OPTIONS = [
  { value: "", label: "全部状态" },
  { value: "RUNNING", label: "🔵 运行中" },
  { value: "PENDING", label: "🟡 等待中" },
  { value: "SUCCESS", label: "🟢 成功" },
  { value: "FAILURE", label: "🔴 失败" },
  { value: "DOWNLOADING", label: "📥 下载中" },
  { value: "STARTED", label: "🔵 启动中" },
  { value: "PROGRESS", label: "🔵 执行中" },
  { value: "RETRY", label: "🟡 重试中" },
  { value: "CANCELLED", label: "⚫ 已取消" },
  { value: "REVOKED", label: "⚫ 已撤销" },
];

interface RawTask {
  task_id: string;
  status: string;
  created_at?: number;
  job_name?: string | null;
  download_url?: string | null;
  download_name?: string | null;
  duration?: number | null;
  elapsed_seconds?: number | null;
  // ⚡ Phase 1 新增：执行器信息
  executor_type?: ExecutorType;
  cluster?: string | null;
  external_job_id?: string | null;
}

interface TaskOutput {
  name: string;
  url: string;
}

interface TableTask extends RawTask {
  outputs: TaskOutput[];
  outputsFetched: boolean;
  outputsLoading: boolean;
  outputsError: string | null;
  deleting: boolean;
  actionError: string | null;
}

type StatusTimestampMap = Record<string, number>;

type TasksApiResponse =
  | {
      items?: RawTask[];
      total?: number;
      count?: number;
      page?: number;
      page_size?: number;
    }
  | RawTask[];

function ensureArray(payload: TasksApiResponse): RawTask[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && Array.isArray(payload.items)) {
    return payload.items;
  }
  return [];
}

function buildOutputUrl(raw: string | null | undefined, taskId: string): string {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;

  const base = API_BASE.replace(/\/+$/, "");
  if (value.startsWith("/")) {
    return `${base}${value}`;
  }

  const normalized = value.replace(/^[/\\.]+/, "").replace(/\\/g, "/");
  if (!normalized) return "";

  if (normalized.startsWith("tasks/")) {
    return `${base}/${normalized}`;
  }

  const encoded = normalized
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `${base}/tasks/${taskId}/outputs/${encoded}`;
}

function fileNameFromPath(path: string | null | undefined): string {
  if (!path) return DEFAULT_OUTPUT_NAME;
  const sanitized = path.split(/[?#]/)[0] ?? path;
  const segments = sanitized.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] || sanitized || DEFAULT_OUTPUT_NAME;
}

function outputsFromDownload(
  taskId: string,
  downloadUrl?: string | null,
  downloadName?: string | null
): TaskOutput[] {
  const url = buildOutputUrl(downloadUrl, taskId);
  if (!url) return [];
  const name = downloadName?.trim() || fileNameFromPath(downloadUrl) || DEFAULT_OUTPUT_NAME;
  return [{ name, url }];
}

function normalizeOutputsResponse(response: TaskOutputsResponse, taskId: string): TaskOutput[] {
  const outputs: TaskOutput[] = [];
  const seen = new Set<string>();

  const addOutput = (url: string | null | undefined, name?: string | null) => {
    const absolute = buildOutputUrl(url, taskId);
    if (!absolute || seen.has(absolute)) return;
    seen.add(absolute);
    outputs.push({
      url: absolute,
      name: name?.trim() || fileNameFromPath(url) || DEFAULT_OUTPUT_NAME,
    });
  };

  const { files, file_entries, download_url, download_name } = response;
  if (Array.isArray(files)) {
    files.forEach((entry) => {
      if (typeof entry === "string") {
        addOutput(entry);
      } else if (entry && typeof entry === "object") {
        const candidate =
          (typeof entry.url === "string" && entry.url) ||
          (typeof entry.name === "string" && entry.name) ||
          "";
        addOutput(candidate, typeof entry.name === "string" ? entry.name : undefined);
      }
    });
  }

  if (Array.isArray(file_entries)) {
    file_entries.forEach((entry) => {
      if (!entry || typeof entry !== "object") return;
      const candidate =
        (typeof entry.url === "string" && entry.url) ||
        (typeof entry.name === "string" && entry.name) ||
        "";
      addOutput(candidate, typeof entry.name === "string" ? entry.name : undefined);
    });
  }

  addOutput(download_url ?? undefined, download_name ?? undefined);

  return outputs;
}

function mergeOutputs(existing: TaskOutput[], extras: TaskOutput[]): TaskOutput[] {
  if (extras.length === 0) return existing;
  const map = new Map<string, TaskOutput>();
  [...existing, ...extras].forEach((item) => {
    if (item.url) {
      map.set(item.url, item);
    }
  });
  return Array.from(map.values());
}

function sliceRows(rows: TableTask[], page: number, size: number): TableTask[] {
  const start = (page - 1) * size;
  return rows.slice(start, start + size);
}

function createRows(items: RawTask[]): TableTask[] {
  // 使用 Map 来去重，保留最新的任务（基于 created_at 时间戳）
  const taskMap = new Map<string, RawTask>();
  let duplicateCount = 0;
  
  items.forEach((item) => {
    const existing = taskMap.get(item.task_id);
    if (!existing) {
      taskMap.set(item.task_id, item);
    } else {
      // 检测到重复任务
      duplicateCount++;
      console.warn(`检测到重复任务 ID: ${item.task_id}，将保留最新的版本`);
      
      // 如果已存在，保留时间戳更新的那个（或者如果没有时间戳就保留第一个）
      const existingTime = existing.created_at ?? 0;
      const newTime = item.created_at ?? 0;
      if (newTime > existingTime) {
        taskMap.set(item.task_id, item);
      }
    }
  });
  
  // 如果检测到重复，记录统计信息
  if (duplicateCount > 0) {
    console.warn(`总共检测到 ${duplicateCount} 个重复任务，已自动去重。原始任务数：${items.length}，去重后：${taskMap.size}`);
  }
  
  // 将去重后的任务转换为 TableTask
  return Array.from(taskMap.values()).map((item) => {
    const initialOutputs = outputsFromDownload(item.task_id, item.download_url, item.download_name);
    const shouldFetchOutputs = item.status === "SUCCESS";
    return {
      ...item,
      outputs: initialOutputs,
      outputsFetched: !shouldFetchOutputs,
      outputsLoading: false,
      outputsError: null,
      deleting: false,
      actionError: null,
    };
  });

}

function formatDuration(totalSecondsInput: number): string {
  if (!Number.isFinite(totalSecondsInput) || totalSecondsInput < 0) {
    return "-";
  }

  const totalSeconds = Math.floor(totalSecondsInput);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  const parts: string[] = [];
  if (hours > 0) {
    parts.push(`${hours}小时`);
  }
  if (hours > 0 || minutes > 0) {
    parts.push(`${minutes}分`);
  }
  parts.push(`${seconds}秒`);

  return parts.join("");
}

// 状态信息定义：包含图标、文案、颜色、分类
interface StatusInfo {
  icon: string;
  label: string;
  color: string;
  bgColor: string;
  category: "waiting" | "running" | "success" | "failed" | "cancelled";
  description?: string;
}

const STATUS_INFO_MAP: Record<string, StatusInfo> = {
  // 等待状态
  PENDING: {
    icon: "⏳",
    label: "等待中",
    color: "text-yellow-700",
    bgColor: "bg-yellow-100",
    category: "waiting",
    description: "任务已创建，等待执行",
  },
  
  // 下载状态（TOS模式）
  DOWNLOADING: {
    icon: "📥",
    label: "下载中",
    color: "text-blue-700",
    bgColor: "bg-blue-100",
    category: "running",
    description: "正在从对象存储下载文件",
  },
  
  // 运行状态
  STARTED: {
    icon: "🚀",
    label: "启动中",
    color: "text-blue-700",
    bgColor: "bg-blue-100",
    category: "running",
    description: "任务已启动",
  },
  RUNNING: {
    icon: "▶️",
    label: "运行中",
    color: "text-blue-700",
    bgColor: "bg-blue-100",
    category: "running",
    description: "任务正在执行",
  },
  PROGRESS: {
    icon: "⚙️",
    label: "执行中",
    color: "text-blue-700",
    bgColor: "bg-blue-100",
    category: "running",
    description: "任务执行中（带进度）",
  },
  RETRY: {
    icon: "🔄",
    label: "重试中",
    color: "text-orange-700",
    bgColor: "bg-orange-100",
    category: "running",
    description: "任务正在重试",
  },
  
  // 成功状态
  SUCCESS: {
    icon: "✅",
    label: "成功",
    color: "text-green-700",
    bgColor: "bg-green-100",
    category: "success",
    description: "任务执行成功",
  },
  
  // 失败状态
  FAILURE: {
    icon: "❌",
    label: "失败",
    color: "text-red-700",
    bgColor: "bg-red-100",
    category: "failed",
    description: "任务执行失败",
  },
  FAILED: {
    icon: "❌",
    label: "失败",
    color: "text-red-700",
    bgColor: "bg-red-100",
    category: "failed",
    description: "任务执行失败",
  },
  
  // 取消状态
  REVOKED: {
    icon: "🚫",
    label: "已撤销",
    color: "text-gray-700",
    bgColor: "bg-gray-100",
    category: "cancelled",
    description: "任务已被撤销",
  },
  CANCELLED: {
    icon: "⛔",
    label: "已取消",
    color: "text-gray-700",
    bgColor: "bg-gray-100",
    category: "cancelled",
    description: "任务已取消",
  },
  CANCELED: {
    icon: "⛔",
    label: "已取消",
    color: "text-gray-700",
    bgColor: "bg-gray-100",
    category: "cancelled",
    description: "任务已取消",
  },
  ABORTED: {
    icon: "🛑",
    label: "已中止",
    color: "text-gray-700",
    bgColor: "bg-gray-100",
    category: "cancelled",
    description: "任务已中止",
  },
  
  // 其他未知状态
  RECEIVED: {
    icon: "📨",
    label: "已接收",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    category: "waiting",
    description: "任务已被Worker接收",
  },
};

// 获取状态信息
function getStatusInfo(status: string): StatusInfo {
  const info = STATUS_INFO_MAP[status];
  if (info) return info;
  
  // 未知状态的默认显示
  return {
    icon: "❔",
    label: status,
    color: "text-gray-600",
    bgColor: "bg-gray-50",
    category: "waiting",
    description: "未知状态",
  };
}

// 获取状态徽章的CSS类（向后兼容）
function statusBadgeClass(status: string): string {
  const info = getStatusInfo(status);
  return `${info.bgColor} ${info.color}`;
}

export default function TasksTable() {
  const [rows, setRows] = useState<TableTask[]>([]);
  const [allRows, setAllRows] = useState<TableTask[] | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagingMode, setPagingMode] = useState<"unknown" | "server" | "client">("unknown");
  const [statusTimestamps, setStatusTimestamps] = useState<StatusTimestampMap>({});

  const [nameFilter, setNameFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const isClientPaging = pagingMode === "client" && Array.isArray(allRows);

  const baseRows = useMemo(() => {
    if (isClientPaging && allRows) {
      return allRows;
    }
    return rows;
  }, [isClientPaging, allRows, rows]);

  const filteredRows = useMemo(() => {
    const normalizedName = nameFilter.trim().toLowerCase();
    const normalizedStatus = statusFilter.trim();

    return baseRows.filter((task) => {
      const jobName = (task.job_name || "").toLowerCase();
      const matchesName =
        normalizedName === "" ||
        jobName.includes(normalizedName) ||
        task.task_id.toLowerCase().includes(normalizedName);

      const matchesStatus = normalizedStatus === "" || task.status === normalizedStatus;
      return matchesName && matchesStatus;
    });
  }, [baseRows, nameFilter, statusFilter]);

  const paginatedRows = useMemo(() => {
    if (isClientPaging) {
      return sliceRows(filteredRows, page, pageSize);
    }
    return filteredRows;
  }, [filteredRows, isClientPaging, page, pageSize]);

  const displayTotal = filteredRows.length;

  const displayTotalPages = useMemo(() => {
    return Math.max(1, Math.ceil(displayTotal / Math.max(pageSize, 1)));
  }, [displayTotal, pageSize]);

  useEffect(() => {
    if (isClientPaging) {
      const maxPage = Math.max(1, Math.ceil(filteredRows.length / Math.max(pageSize, 1)));
      if (page > maxPage) {
        setPage(maxPage);
      }
    }
  }, [filteredRows.length, isClientPaging, page, pageSize]);

  const totalPages = useMemo(() => {
    const count = Math.max(total, 0);
    return Math.max(1, Math.ceil(count / Math.max(pageSize, 1)));
  }, [total, pageSize]);

  const applyTaskUpdate = useCallback(
    (taskId: string, updater: (task: TableTask) => TableTask) => {
      setRows((current) => current.map((task) => (task.task_id === taskId ? updater(task) : task)));
      setAllRows((current) =>
        current ? current.map((task) => (task.task_id === taskId ? updater(task) : task)) : current
      );
    },
    []
  );

  const fetchOutputsForTask = useCallback(
    async (taskId: string) => {
      applyTaskUpdate(taskId, (task) => ({
        ...task,
        outputsLoading: true,
        outputsError: null,
      }));

      try {
        const response = await listOutputs(taskId);
        const normalized = normalizeOutputsResponse(response, taskId);
        applyTaskUpdate(taskId, (task) => ({
          ...task,
          outputs: mergeOutputs(task.outputs, normalized),
          outputsFetched: true,
          outputsLoading: false,
        }));
      } catch (err) {
        const message = err instanceof Error ? err.message : "获取输出失败";
        applyTaskUpdate(taskId, (task) => ({
          ...task,
          outputsFetched: true,
          outputsLoading: false,
          outputsError: message,
        }));
      }
    },
    [applyTaskUpdate]
  );

  const fetchTasks = useCallback(
    async (targetPage: number, targetSize: number) => {
      setLoading(true);
      setError(null);

      try {
        const query = new URLSearchParams();
        query.set("page", String(targetPage));
        query.set("page_size", String(targetSize));

        const response = await fetch(`${API_BASE}/tasks?${query.toString()}`);
        if (!response.ok) {
          let errorMessage = "任务列表加载失败";
          try {
            const text = await response.text();
            // 尝试解析 JSON 错误信息
            try {
              const errorData = JSON.parse(text);
              errorMessage = errorData?.detail || errorData?.message || text || response.statusText;
            } catch {
              errorMessage = text || response.statusText;
            }
          } catch {
            errorMessage = response.statusText || "网络请求失败";
          }
          throw new Error(errorMessage);
        }

        let data: TasksApiResponse;
        try {
          data = (await response.json()) as TasksApiResponse;
        } catch (parseError) {
          console.error("解析响应数据失败", parseError);
          throw new Error("服务器返回了无效的数据格式");
        }

        const items = ensureArray(data);

        const rowsFromServer = createRows(items);
        const fetchMoment = Date.now();
        
        setStatusTimestamps((current) => {
          const next: StatusTimestampMap = {};
          rowsFromServer.forEach((item) => {
            const previous = current[item.task_id];
            if (item.status === "SUCCESS" && typeof previous === "number") {
              next[item.task_id] = previous;
            } else if (item.status === "SUCCESS") {
              next[item.task_id] = fetchMoment;
            } else {
              next[item.task_id] = fetchMoment;
            }
          });
          return next;
        });
        
        const totalCount =
          (typeof (data as { total?: number }).total === "number" && (data as { total: number }).total) ||
          (typeof (data as { count?: number }).count === "number" && (data as { count: number }).count) ||
          rowsFromServer.length;
        const serverPage =
          typeof (data as { page?: number }).page === "number"
            ? (data as { page: number }).page
            : targetPage;
        const serverSize =
          typeof (data as { page_size?: number }).page_size === "number"
            ? (data as { page_size: number }).page_size
            : targetSize;
        const supportsServerPaging =
          typeof (data as { page?: number }).page === "number" ||
          typeof (data as { page_size?: number }).page_size === "number" ||
          typeof (data as { total?: number }).total === "number" ||
          typeof (data as { count?: number }).count === "number";

        if (supportsServerPaging) {
          setPagingMode("server");
          setAllRows(null);
          setRows(rowsFromServer);
          setPage(serverPage);
          setPageSize(serverSize);
          setTotal(totalCount);
        } else {
          setPagingMode("client");
          setAllRows(rowsFromServer);
          setTotal(rowsFromServer.length);
          setPage(targetPage);
          setPageSize(targetSize);
          setRows(sliceRows(rowsFromServer, targetPage, targetSize));
        }
      } catch (err) {
        // 改为更友好的错误处理，避免在开发环境中显示红色错误
        const errorMessage = err instanceof Error ? err.message : "任务列表加载失败";
        console.warn("加载任务列表时出现问题:", errorMessage);
        
        // 如果是网络错误或连接问题，给出更友好的提示
        if (errorMessage.includes("Failed to fetch") || errorMessage.includes("NetworkError")) {
          setError("无法连接到服务器，请检查网络连接或确认后端服务是否运行");
        } else {
          setError(errorMessage);
        }
        
        // 即使出错也要设置空数据，避免界面卡住
        setRows([]);
        setTotal(0);
        setPagingMode("unknown");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void fetchTasks(1, DEFAULT_PAGE_SIZE);
  }, [fetchTasks]);

  useEffect(() => {
    baseRows.forEach((task) => {
      if (task.status === "SUCCESS" && !task.outputsFetched && !task.outputsLoading) {
        void fetchOutputsForTask(task.task_id);
      }
    });
  }, [baseRows, fetchOutputsForTask]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handler = () => {
      void fetchTasks(1, pageSize);
    };

    window.addEventListener("speos-task-created", handler);
    return () => {
      window.removeEventListener("speos-task-created", handler);
    };
  }, [fetchTasks, pageSize]);

  useEffect(() => {
    const hasPending = baseRows.some((task) => !TERMINAL_STATUSES.has(task.status));
    if (!hasPending) return;

    const targetPage = isClientPaging ? 1 : page;
    const timer = window.setInterval(() => {
      void fetchTasks(targetPage, pageSize);
    }, 5000);

    return () => {
      window.clearInterval(timer);
    };
  }, [baseRows, fetchTasks, isClientPaging, page, pageSize]);

  const handleRefresh = useCallback(() => {
    const targetPage = isClientPaging ? 1 : page;
    void fetchTasks(targetPage, pageSize);
  }, [fetchTasks, isClientPaging, page, pageSize]);

  const handlePageChange = useCallback(
    (nextPage: number) => {
      if (nextPage < 1) return;
      if (!isClientPaging) {
        if (nextPage === page) return;
        void fetchTasks(nextPage, pageSize);
      } else {
        const maxPage = Math.max(1, Math.ceil(filteredRows.length / Math.max(pageSize, 1)));
        if (nextPage > maxPage) return;
        setPage(nextPage);
      }
    },
    [fetchTasks, filteredRows.length, isClientPaging, page, pageSize]
  );

  const handlePageSizeChange = useCallback(
    (size: number) => {
      if (size === pageSize) return;
      if (!isClientPaging) {
        setPageSize(size);
        void fetchTasks(1, size);
      } else {
        setPageSize(size);
        setPage(1);
      }
    },
    [fetchTasks, isClientPaging, pageSize]
  );

  const handleDelete = useCallback(
    async (taskId: string) => {
      applyTaskUpdate(taskId, (task) => ({
        ...task,
        deleting: true,
        actionError: null,
      }));

      try {
        await deleteTask(taskId);
        if (!isClientPaging) {
          const nextPage = Math.max(1, Math.min(page, totalPages));
          await fetchTasks(nextPage, pageSize);
        } else {
          setAllRows((current) => {
            if (!current) return current;
            const nextAll = current.filter((task) => task.task_id !== taskId);
            setTotal(nextAll.length);
            return nextAll;
          });
          setStatusTimestamps((current) => {
            if (!(taskId in current)) return current;
            const { [taskId]: _removed, ...rest } = current;
            return rest;
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "删除任务失败";
        applyTaskUpdate(taskId, (task) => ({
          ...task,
          deleting: false,
          actionError: message,
        }));
      }
    },
    [applyTaskUpdate, fetchTasks, isClientPaging, page, pageSize, totalPages]
  );

  const renderBody = () => {
    if (loading) {
      return (
        <tr>
          <td className="px-3 py-10 text-center text-sm text-gray-500" colSpan={6}>
            加载中...
          </td>
        </tr>
      );
    }

    if (error) {
      return (
        <tr>
          <td className="px-3 py-10 text-center text-sm text-red-500" colSpan={6}>
            {error}
          </td>
        </tr>
      );
    }

    if (paginatedRows.length === 0) {
      return (
        <tr>
          <td className="px-3 py-10 text-center text-sm text-gray-500" colSpan={6}>
            暂无任务
          </td>
        </tr>
      );
    }


    return paginatedRows.map((task) => {
      const createdAtMs = typeof task.created_at === "number" ? task.created_at * 1000 : null;
      const submittedAt = createdAtMs ? new Date(createdAtMs).toLocaleString() : "-";
      const statusTimestamp = statusTimestamps[task.task_id];
      const statusTime = typeof statusTimestamp === "number" ? new Date(statusTimestamp).toLocaleString() : "-";
      const normalizedElapsed =
        typeof task.elapsed_seconds === "number" && Number.isFinite(task.elapsed_seconds)
          ? task.elapsed_seconds
          : null;
      const normalizedDuration =
        typeof task.duration === "number" && Number.isFinite(task.duration)
          ? task.duration
          : null;
      const durationSeconds = normalizedElapsed ?? normalizedDuration;
      const durationText = durationSeconds != null ? formatDuration(durationSeconds) : "-";
      const statusInfo = getStatusInfo(task.status);
      const badgeClass = statusBadgeClass(task.status);

      return (
        <tr key={task.task_id} className="border-b last:border-b-0 align-top">
          <td className="px-3 py-2 font-medium text-gray-800">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 whitespace-normal break-words">
                <Link
                  href={`/tasks/${task.task_id}`}
                  className="text-blue-600 hover:text-blue-700 hover:underline"
                >
                  {task.job_name || "-"}
                </Link>
                {/* ⚡ 显示执行器标识（紧凑模式，不显示 Local） */}
                <ExecutorBadge
                  executorType={task.executor_type}
                  cluster={task.cluster}
                  compact={true}
                />
              </div>
              {/* ⚡ 显示执行环境详细信息（仅远程执行器） */}
              <ExecutorInfoCompact
                executorType={task.executor_type}
                cluster={task.cluster}
                externalJobId={task.external_job_id}
              />
            </div>
          </td>
          <td className="px-3 py-2 font-mono text-xs text-gray-600 align-top">
            <div className="break-all leading-5">{task.task_id}</div>
          </td>
          <td className="px-3 py-2 text-center align-top">
            <span 
              className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${badgeClass}`}
              title={statusInfo.description}
            >
              <span className="text-sm">{statusInfo.icon}</span>
              <span>{statusInfo.label}</span>
            </span>
            <div className="mt-2 text-xs text-gray-500" title={`状态更新时间: ${statusTime}`}>
              {statusTime}
            </div>
          </td>
          <td className="px-3 py-2 text-sm text-gray-700 align-top">{durationText}</td>
          <td className="px-3 py-2 text-sm text-gray-700 align-top">{submittedAt}</td>
          <td className="px-3 py-2 align-top">
            {task.outputsLoading ? (
              <span className="text-sm text-gray-500">结果加载中...</span>
            ) : task.outputs.length > 0 ? (
              <div className="flex flex-col gap-1 text-sm">
                {task.outputs.map((output) => (
                  <a
                    key={`${task.task_id}-${output.url}`}
                    href={output.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="break-all text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    {output.name}
                  </a>
                ))}
              </div>
            ) : (
              <span className="text-sm text-gray-400">暂无可下载文件</span>
            )}

            {task.outputsError && (
              <div className="mt-1 text-xs text-red-500">{task.outputsError}</div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <button
                onClick={() => handleDelete(task.task_id)}
                disabled={task.deleting}
                className="rounded border border-red-200 px-3 py-1 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {task.deleting ? "删除中..." : "删除任务"}
              </button>
            </div>

            {task.actionError && (
              <div className="mt-1 text-xs text-red-500">{task.actionError}</div>
            )}
          </td>
        </tr>
      );
    });
  };

  return (
    <div className="flex h-[580px] flex-col rounded-xl bg-white p-4 shadow">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">任务列表</h2>
          <p className="text-sm text-gray-500">查看任务状态、下载结果文件并可删除任务。</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600" htmlFor="task-name-filter">
              任务名称
            </label>
            <input
              id="task-name-filter"
              value={nameFilter}
              onChange={(event) => {
                setPage(1);
                setNameFilter(event.target.value);
              }}
              placeholder="输入关键词"
              className="rounded border px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600" htmlFor="task-status-filter">
              状态
            </label>
            <select
              id="task-status-filter"
              value={statusFilter}
              onChange={(event) => {
                setPage(1);
                setStatusFilter(event.target.value);
              }}
              className="rounded border px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {STATUS_FILTER_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleRefresh}
            className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
            disabled={loading}
          >
            刷新
          </button>
        </div>
      </div>

      <div className="mt-4 flex-1 overflow-hidden">
        <div className="h-full overflow-x-auto overflow-y-auto rounded-lg border">
          <table className="min-w-full table-fixed text-sm">
            <thead className="bg-gray-100 text-gray-600">
              <tr>
                <th className="w-56 px-3 py-2 text-left">任务名称</th>
                <th className="w-56 px-3 py-2 text-left">Task ID</th>
                <th className="w-36 px-3 py-2">状态</th>
                <th className="w-40 px-3 py-2">执行时长</th>
                <th className="w-44 px-3 py-2">提交时间</th>
                <th className="px-3 py-2 text-left">结果文件</th>
              </tr>
            </thead>
            <tbody className="align-top">{renderBody()}</tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
        <div>共 {displayTotal} 条记录</div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2">
            <span>每页</span>
            <select
              value={pageSize}
              onChange={(event) => handlePageSizeChange(Number(event.target.value))}
              className="rounded border px-2 py-1 text-sm"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-2">
            <button
              className="rounded border px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => handlePageChange(page - 1)}
              disabled={loading || page <= 1}
            >
              上一页
            </button>
            <span>
              第 {page} / {displayTotalPages} 页
            </span>
            <button
              className="rounded border px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => handlePageChange(page + 1)}
              disabled={loading || page >= displayTotalPages}
            >
              下一页
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}



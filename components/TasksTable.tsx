"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  API_BASE,
  deleteTask,
  listOutputs,
  retryTask,
  formatEstimatedTime,
  type TaskOutputsResponse,
  type ProgressInfo,
  type RetryTaskResponse,
  type SolverType,
} from "../lib/api";

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
  progress_info?: ProgressInfo | null; // ✅ 执行进度信息（多求解器）
  parent_task_id?: string | null; // ✅ 父任务ID（如果是重试任务）
  retry_count?: number | null; // ✅ 重试次数
  retried_task_ids?: string[] | null; // ✅ 重试生成的任务列表
  solver_type?: SolverType | null; // ⭐ 新增：求解器类型
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
  retrying: boolean; // ✅ 重试中状态
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
  // ⚡ 使用两个 Set 分别去重：URL 和文件名
  const seenUrls = new Set<string>();
  const seenNames = new Set<string>();

  const addOutput = (url: string | null | undefined, name?: string | null) => {
    const absolute = buildOutputUrl(url, taskId);
    if (!absolute) return;
    
    // 确定文件名
    const fileName = (name?.trim() || fileNameFromPath(url) || DEFAULT_OUTPUT_NAME).toLowerCase();
    
    // ⚡ 去重：检查 URL 和文件名
    // 如果 URL 已存在，跳过（同一文件）
    if (seenUrls.has(absolute)) {
      console.log(`[Outputs] 检测到重复 URL，跳过: ${absolute}`);
      return;
    }
    
    // ⚡ 如果文件名已存在，也跳过（避免同一文件的不同路径格式）
    if (seenNames.has(fileName)) {
      console.log(`[Outputs] 检测到重复文件名，跳过: ${fileName} (URL: ${absolute})`);
      return;
    }
    
    // 添加到集合中
    seenUrls.add(absolute);
    seenNames.add(fileName);
    
    outputs.push({
      url: absolute,
      name: name?.trim() || fileNameFromPath(url) || DEFAULT_OUTPUT_NAME,
    });
  };

  const { files, file_entries, download_url, download_name } = response;
  
  console.log(`[Outputs] 解析输出文件响应:`, {
    files_count: Array.isArray(files) ? files.length : 0,
    file_entries_count: Array.isArray(file_entries) ? file_entries.length : 0,
    has_download_url: !!download_url,
  });
  
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

  console.log(`[Outputs] 标准化后共 ${outputs.length} 个输出文件:`, outputs.map(o => o.name));
  
  return outputs;
}

/**
 * 增强的去重合并逻辑：基于 URL 和文件名去重
 * 如果 URL 不同但文件名相同，也视为重复（避免同一文件的不同路径格式）
 */
function mergeOutputsEnhanced(existing: TaskOutput[], extras: TaskOutput[]): TaskOutput[] {
  if (extras.length === 0) return existing;
  
  // ⚡ 使用 Map，key 为 URL，value 为 TaskOutput
  const urlMap = new Map<string, TaskOutput>();
  
  // ⚡ 使用 Map 存储文件名到 URL 的映射，用于检测文件名重复
  const nameToUrlMap = new Map<string, string>();
  
  // 首先处理现有的输出
  existing.forEach((item) => {
    if (item.url && item.name) {
      urlMap.set(item.url, item);
      // 记录文件名映射（如果文件名还没有对应的 URL，或者当前 URL 更短，优先使用更短的 URL）
      const existingUrl = nameToUrlMap.get(item.name);
      if (!existingUrl || item.url.length < existingUrl.length) {
        nameToUrlMap.set(item.name, item.url);
      }
    }
  });
  
  // 然后处理新获取的输出
  extras.forEach((item) => {
    if (!item.url || !item.name) return;
    
    // 检查是否已经存在相同的 URL
    if (urlMap.has(item.url)) {
      // 已存在相同 URL，跳过（保留现有的）
      return;
    }
    
    // 检查是否已经存在相同的文件名（避免同一文件的不同路径格式）
    const existingUrl = nameToUrlMap.get(item.name);
    if (existingUrl && existingUrl !== item.url) {
      // 已存在相同文件名但不同 URL，跳过（保留现有的）
      console.log(`[Outputs] 检测到重复文件名 "${item.name}"，保留现有 URL: ${existingUrl}，跳过: ${item.url}`);
      return;
    }
    
    // 添加新的输出
    urlMap.set(item.url, item);
    nameToUrlMap.set(item.name, item.url);
  });
  
  return Array.from(urlMap.values());
}

// 保留旧函数以保持兼容性
function mergeOutputs(existing: TaskOutput[], extras: TaskOutput[]): TaskOutput[] {
  return mergeOutputsEnhanced(existing, extras);
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
      retrying: false, // ✅ 初始化重试状态
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

// 格式化进度百分比
function formatProgressPercent(percent: number | null | undefined): string {
  if (percent == null || !Number.isFinite(percent)) {
    return "-";
  }
  return `${Math.round(percent)}%`;
}

// ============= 求解器相关工具函数 =============

// 获取求解器图标
function getSolverIcon(solverType?: SolverType | null): string {
  switch (solverType) {
    case "speos": return "💡";      // 光学
    case "fluent": return "🌊";     // 流体
    case "maxwell": return "⚡";    // 电磁
    case "mechanical": return "🔧"; // 结构
    default: return "📊";           // 未知
  }
}

// 获取求解器标签
function getSolverLabel(solverType?: SolverType | null): string {
  switch (solverType) {
    case "speos": return "SPEOS";
    case "fluent": return "FLUENT";
    case "maxwell": return "Maxwell";
    case "mechanical": return "Mechanical";
    default: return "未知";
  }
}

// 获取求解器颜色
function getSolverColor(solverType?: SolverType | null): string {
  switch (solverType) {
    case "speos": return "bg-yellow-100 text-yellow-700 border-yellow-200";   // 金黄色
    case "fluent": return "bg-blue-100 text-blue-700 border-blue-200";        // 蓝色
    case "maxwell": return "bg-purple-100 text-purple-700 border-purple-200"; // 紫色
    case "mechanical": return "bg-green-100 text-green-700 border-green-200"; // 绿色
    default: return "bg-gray-100 text-gray-700 border-gray-200";              // 灰色
  }
}


// 渲染进度信息组件（优雅显示，支持多求解器）
function renderProgressInfo(
  progressInfo: ProgressInfo | null | undefined, 
  solverType?: SolverType | null
): JSX.Element | null {
  if (!progressInfo) return null;

  const { 
    estimated_time, 
    progress_percent, 
    current_step,
    current_pass,
    total_passes,
    current_sensor,
    total_sensors,
    // FLUENT 字段
    current_iteration,
    continuity_residual,
    converged,
    // Maxwell 字段
    status,
    // Mechanical 字段
    load_step,
    substep,
    iteration,
  } = progressInfo;
  
  // 检查是否有任何有效的进度信息
  const hasEstimatedTime = estimated_time && estimated_time.trim() !== "";
  const hasProgressPercent = progress_percent != null && Number.isFinite(progress_percent);
  const hasCurrentStep = current_step && current_step.trim() !== "";
  const hasPassInfo = current_pass != null && total_passes != null;
  const hasSensorInfo = current_sensor != null && total_sensors != null;
  const hasFluentInfo = current_iteration != null || continuity_residual != null;
  const hasMechanicalInfo = load_step != null || substep != null || iteration != null;
  
  if (!hasEstimatedTime && !hasProgressPercent && !hasCurrentStep && !hasPassInfo && 
      !hasSensorInfo && !hasFluentInfo && !hasMechanicalInfo && !status && !converged) {
    return null;
  }
  
  // 根据求解器类型使用不同的颜色主题
  const normalizedSolverType = solverType || "speos"; // 向后兼容，默认 SPEOS
  let colorTheme = {
    bgGradient: "from-blue-50 to-indigo-50",
    border: "border-blue-200",
    progressBg: "bg-blue-200",
    progressBar: "from-blue-500 to-indigo-600",
    textPrimary: "text-blue-900",
    textSecondary: "text-blue-700",
    textTertiary: "text-blue-600",
  };
  
  switch (normalizedSolverType) {
    case "fluent":
      colorTheme = {
        bgGradient: "from-cyan-50 to-blue-50",
        border: "border-cyan-200",
        progressBg: "bg-cyan-200",
        progressBar: "from-cyan-500 to-blue-600",
        textPrimary: "text-cyan-900",
        textSecondary: "text-cyan-700",
        textTertiary: "text-cyan-600",
      };
      break;
    case "maxwell":
      colorTheme = {
        bgGradient: "from-purple-50 to-indigo-50",
        border: "border-purple-200",
        progressBg: "bg-purple-200",
        progressBar: "from-purple-500 to-indigo-600",
        textPrimary: "text-purple-900",
        textSecondary: "text-purple-700",
        textTertiary: "text-purple-600",
      };
      break;
    case "mechanical":
      colorTheme = {
        bgGradient: "from-green-50 to-emerald-50",
        border: "border-green-200",
        progressBg: "bg-green-200",
        progressBar: "from-green-500 to-emerald-600",
        textPrimary: "text-green-900",
        textSecondary: "text-green-700",
        textTertiary: "text-green-600",
      };
      break;
  }

  return (
    <div className={`mt-2 rounded-lg bg-gradient-to-br ${colorTheme.bgGradient} border ${colorTheme.border} px-3 py-2 shadow-sm`}>
      {/* 主进度条 - 大而醒目（SPEOS 和有百分比的求解器）*/}
      {hasProgressPercent && (
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <span className={`text-xs font-semibold ${colorTheme.textPrimary}`}>📊 执行进度</span>
            <span className={`text-sm font-bold ${colorTheme.textSecondary}`}>
              {formatProgressPercent(progress_percent)}
            </span>
          </div>
          <div className={`h-2 ${colorTheme.progressBg} rounded-full overflow-hidden shadow-inner`}>
            <div
              className={`h-full bg-gradient-to-r ${colorTheme.progressBar} rounded-full transition-all duration-500 ease-out`}
              style={{ width: `${Math.min(100, Math.max(0, progress_percent!))}%` }}
            />
          </div>
        </div>
      )}
      
      {/* 详细信息区域 */}
      <div className="space-y-1.5">
        {/* ========== SPEOS 进度 ========== */}
        {(normalizedSolverType === "speos" || !solverType) && (
          <>
            {/* 剩余时间 - 突出显示 */}
            {hasEstimatedTime && (
              <div className="flex items-center gap-2 bg-white/60 rounded-md px-2 py-1">
                <span className={`text-xs ${colorTheme.textSecondary}`}>⏱️</span>
                <span className={`text-xs ${colorTheme.textTertiary} font-medium`}>剩余时间:</span>
                <span className={`text-xs ${colorTheme.textPrimary} font-semibold ml-auto`}>{formatEstimatedTime(estimated_time)}</span>
              </div>
            )}
            
            {/* Pass 和 Sensor 信息 - 并排显示 */}
            {(hasPassInfo || hasSensorInfo) && (
              <div className="flex items-center gap-2">
                {/* Pass 信息 */}
                {hasPassInfo && (
                  <div className="flex items-center gap-1.5 bg-white/60 rounded-md px-2 py-1 flex-1">
                    <span className="text-xs">🔄</span>
                    <span className={`text-xs ${colorTheme.textTertiary} font-medium`}>Pass:</span>
                    <span className={`text-xs ${colorTheme.textPrimary} font-semibold ml-auto`}>
                      {current_pass}/{total_passes}
                    </span>
                  </div>
                )}
                
                {/* Sensor 信息 */}
                {hasSensorInfo && (
                  <div className="flex items-center gap-1.5 bg-white/60 rounded-md px-2 py-1 flex-1">
                    <span className="text-xs">📡</span>
                    <span className={`text-xs ${colorTheme.textTertiary} font-medium`}>Sensor:</span>
                    <span className={`text-xs ${colorTheme.textPrimary} font-semibold ml-auto`}>
                      {current_sensor}/{total_sensors}
                    </span>
                  </div>
                )}
              </div>
            )}
            
            {/* 旧版兼容：当前步骤 */}
            {hasCurrentStep && !hasPassInfo && !hasSensorInfo && (
              <div className="flex items-center gap-2 bg-white/60 rounded-md px-2 py-1">
                <span className={`text-xs ${colorTheme.textSecondary}`}>📍</span>
                <span className={`text-xs ${colorTheme.textTertiary} font-medium`}>当前步骤:</span>
                <span className={`text-xs ${colorTheme.textPrimary} font-semibold font-mono ml-auto`}>{current_step}</span>
              </div>
            )}
          </>
        )}
        
        {/* ========== FLUENT 进度 ========== */}
        {normalizedSolverType === "fluent" && (
          <>
            {/* 迭代步数 */}
            {current_iteration != null && (
              <div className="flex items-center gap-2 bg-white/60 rounded-md px-2 py-1">
                <span className="text-xs">🔄</span>
                <span className={`text-xs ${colorTheme.textTertiary} font-medium`}>迭代步数:</span>
                <span className={`text-xs ${colorTheme.textPrimary} font-semibold ml-auto`}>{current_iteration}</span>
              </div>
            )}
            
            {/* 连续性残差 */}
            {continuity_residual != null && (
              <div className="flex items-center gap-2 bg-white/60 rounded-md px-2 py-1">
                <span className="text-xs">📉</span>
                <span className={`text-xs ${colorTheme.textTertiary} font-medium`}>连续性残差:</span>
                <span className={`text-xs ${colorTheme.textPrimary} font-semibold font-mono ml-auto`}>
                  {continuity_residual.toExponential(2)}
                </span>
              </div>
            )}
            
            {/* 收敛状态 */}
            {converged && (
              <div className="flex items-center gap-1 bg-green-100 rounded-md px-2 py-1">
                <span className="text-xs">✅</span>
                <span className="text-xs text-green-700 font-medium">已收敛</span>
              </div>
            )}
          </>
        )}
        
        {/* ========== Maxwell 进度 ========== */}
        {normalizedSolverType === "maxwell" && (
          <>
            {/* 进度百分比 - Maxwell 支持进度百分比显示 */}
            {hasProgressPercent && (
              <div className="mb-2">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-semibold ${colorTheme.textPrimary}`}>📊 求解进度</span>
                  <span className={`text-sm font-bold ${colorTheme.textSecondary}`}>
                    {formatProgressPercent(progress_percent)}
                  </span>
                </div>
                <div className={`h-2 ${colorTheme.progressBg} rounded-full overflow-hidden shadow-inner`}>
                  <div
                    className={`h-full bg-gradient-to-r ${colorTheme.progressBar} rounded-full transition-all duration-500 ease-out`}
                    style={{ width: `${Math.min(100, Math.max(0, progress_percent!))}%` }}
                  />
                </div>
              </div>
            )}
            
            {/* 进度消息 */}
            {progressInfo.message && (
              <div className="flex items-center gap-2 bg-white/60 rounded-md px-2 py-1">
                <span className="text-xs">💬</span>
                <span className={`text-xs ${colorTheme.textPrimary} font-medium`}>{progressInfo.message}</span>
              </div>
            )}
            
            {/* 进度类型 */}
            {progressInfo.progress_type && (
              <div className="flex items-center gap-2 bg-white/60 rounded-md px-2 py-1">
                <span className="text-xs">📋</span>
                <span className={`text-xs ${colorTheme.textTertiary} font-medium`}>进度类型:</span>
                <span className={`text-xs ${colorTheme.textPrimary} font-semibold ml-auto`}>
                  {progressInfo.progress_type === "solving" && "正在求解"}
                  {progressInfo.progress_type === "adaptive_pass" && "自适应网格细化"}
                  {progressInfo.progress_type === "computing" && "正在计算"}
                  {progressInfo.progress_type === "converged" && "已收敛"}
                  {progressInfo.progress_type === "completed" && "已完成"}
                  {!["solving", "adaptive_pass", "computing", "converged", "completed"].includes(progressInfo.progress_type) && progressInfo.progress_type}
                </span>
              </div>
            )}
            
            {/* 自适应 Pass */}
            {hasPassInfo && (
              <div className="flex items-center gap-2 bg-white/60 rounded-md px-2 py-1">
                <span className="text-xs">🔄</span>
                <span className={`text-xs ${colorTheme.textTertiary} font-medium`}>自适应 Pass:</span>
                <span className={`text-xs ${colorTheme.textPrimary} font-semibold ml-auto`}>
                  {current_pass}{total_passes ? `/${total_passes}` : ""}
                </span>
              </div>
            )}
            
            {/* 状态（兼容旧字段） */}
            {status && !progressInfo.progress_type && (
              <div className="flex items-center gap-2 bg-white/60 rounded-md px-2 py-1">
                <span className="text-xs">📊</span>
                <span className={`text-xs ${colorTheme.textTertiary} font-medium`}>状态:</span>
                <span className={`text-xs ${colorTheme.textPrimary} font-semibold ml-auto`}>{status}</span>
              </div>
            )}
            
            {/* 收敛状态 */}
            {converged && (
              <div className="flex items-center gap-1 bg-green-100 rounded-md px-2 py-1">
                <span className="text-xs">✅</span>
                <span className="text-xs text-green-700 font-medium">已收敛</span>
              </div>
            )}
          </>
        )}
        
        {/* ========== Mechanical 进度 ========== */}
        {normalizedSolverType === "mechanical" && (
          <>
            {/* 载荷步 */}
            {load_step != null && (
              <div className="flex items-center gap-2 bg-white/60 rounded-md px-2 py-1">
                <span className="text-xs">📊</span>
                <span className={`text-xs ${colorTheme.textTertiary} font-medium`}>载荷步:</span>
                <span className={`text-xs ${colorTheme.textPrimary} font-semibold ml-auto`}>{load_step}</span>
              </div>
            )}
            
            {/* 子步 */}
            {substep != null && (
              <div className="flex items-center gap-2 bg-white/60 rounded-md px-2 py-1">
                <span className="text-xs">🔹</span>
                <span className={`text-xs ${colorTheme.textTertiary} font-medium`}>子步:</span>
                <span className={`text-xs ${colorTheme.textPrimary} font-semibold ml-auto`}>{substep}</span>
              </div>
            )}
            
            {/* 迭代 */}
            {iteration != null && (
              <div className="flex items-center gap-2 bg-white/60 rounded-md px-2 py-1">
                <span className="text-xs">🔄</span>
                <span className={`text-xs ${colorTheme.textTertiary} font-medium`}>迭代:</span>
                <span className={`text-xs ${colorTheme.textPrimary} font-semibold ml-auto`}>{iteration}</span>
              </div>
            )}
            
            {/* 收敛状态 */}
            {converged && (
              <div className="flex items-center gap-1 bg-green-100 rounded-md px-2 py-1">
                <span className="text-xs">✅</span>
                <span className="text-xs text-green-700 font-medium">已收敛</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
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
  
  // ✅ 使用 ref 保存当前任务状态，用于检测状态变化
  const currentTasksRef = useRef<Map<string, TableTask>>(new Map());
  
  // ⚡ 使用 ref 保存分页信息，避免闭包问题
  const pagingInfoRef = useRef<{ page: number; pageSize: number; isClientPaging: boolean }>({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    isClientPaging: false,
  });

  const [nameFilter, setNameFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [solverTypeFilter, setSolverTypeFilter] = useState("");

  const isClientPaging = pagingMode === "client" && Array.isArray(allRows);

  // ⚡ 更新 ref 中的分页信息，避免闭包问题
  useEffect(() => {
    pagingInfoRef.current = {
      page,
      pageSize,
      isClientPaging,
    };
  }, [page, pageSize, isClientPaging]);

  const baseRows = useMemo(() => {
    if (isClientPaging && allRows) {
      return allRows;
    }
    return rows;
  }, [isClientPaging, allRows, rows]);
  
  // 调试：检查 baseRows 中的 progress_info
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      const tasksWithProgress = baseRows.filter((task) => task.progress_info);
      if (tasksWithProgress.length > 0) {
        console.log("[Debug] baseRows 中有进度信息的任务:", tasksWithProgress.map(t => ({
          id: t.task_id,
          status: t.status,
          progress_info: t.progress_info,
        })));
      }
    }
  }, [baseRows]);

  const filteredRows = useMemo(() => {
    const normalizedName = nameFilter.trim().toLowerCase();
    const normalizedStatus = statusFilter.trim();
    const normalizedSolverType = solverTypeFilter.trim();

    return baseRows.filter((task) => {
      const jobName = (task.job_name || "").toLowerCase();
      const matchesName =
        normalizedName === "" ||
        jobName.includes(normalizedName) ||
        task.task_id.toLowerCase().includes(normalizedName);

      const matchesStatus = normalizedStatus === "" || task.status === normalizedStatus;
      const matchesSolverType = normalizedSolverType === "" || task.solver_type === normalizedSolverType;
      return matchesName && matchesStatus && matchesSolverType;
    });
  }, [baseRows, nameFilter, statusFilter, solverTypeFilter]);

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
      // ✅ 先从 ref 获取当前任务（可能不在当前页）
      const currentTask = currentTasksRef.current.get(taskId);
      if (!currentTask) {
        if (process.env.NODE_ENV === "development") {
          console.warn(`[applyTaskUpdate] 任务 ${taskId} 不在 ref 中，跳过更新`);
        }
        return;
      }
      
      // ✅ 更新任务
      const updatedTask = updater(currentTask);
      
      // ✅ 先更新 ref（确保 ref 始终是最新的）
      currentTasksRef.current.set(taskId, updatedTask);
      
      // ✅ 然后更新 state（如果任务在 state 中）
      setRows((current) => {
        const taskIndex = current.findIndex((t) => t.task_id === taskId);
        if (taskIndex >= 0) {
          return current.map((task) => (task.task_id === taskId ? updatedTask : task));
        }
        return current;
      });
      
      setAllRows((current) => {
        if (!current) return current;
        const taskIndex = current.findIndex((t) => t.task_id === taskId);
        if (taskIndex >= 0) {
          return current.map((task) => (task.task_id === taskId ? updatedTask : task));
        }
        return current;
      });
    },
    []
  );

  // ⚡ 使用 ref 存储正在获取输出的任务，避免重复调用
  const fetchingOutputsRef = useRef<Set<string>>(new Set());

  // ⚡ 必须先定义 fetchOutputsForTask，因为 fetchTasks 依赖它
  const fetchOutputsForTask = useCallback(
    async (taskId: string) => {
      // ⚡ 防止重复调用：如果正在获取中，直接返回
      if (fetchingOutputsRef.current.has(taskId)) {
        console.log(`[Outputs] 任务 ${taskId} 的输出文件正在获取中，跳过重复调用`);
        return;
      }

      // 标记为正在获取
      fetchingOutputsRef.current.add(taskId);

      applyTaskUpdate(taskId, (task) => ({
        ...task,
        outputsLoading: true,
        outputsError: null,
      }));

      try {
        const response = await listOutputs(taskId);
        console.log(`[Outputs] 任务 ${taskId} 的输出文件列表:`, response);
        
        const normalized = normalizeOutputsResponse(response, taskId);
        console.log(`[Outputs] 任务 ${taskId} 标准化后的输出文件:`, normalized);
        
        // ⚡ 重要：直接替换而不是合并，避免重复
        // 因为 listOutputs 接口已经返回了完整的文件列表
        applyTaskUpdate(taskId, (task) => {
          // 使用增强的去重逻辑合并现有和新获取的输出
          const merged = mergeOutputsEnhanced(task.outputs, normalized);
          console.log(`[Outputs] 任务 ${taskId} 合并后的输出文件 (${merged.length} 个):`, merged.map(o => o.name));
          
          return {
            ...task,
            outputs: merged,
            outputsFetched: true,
            outputsLoading: false,
          };
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "获取输出失败";
        console.error(`[Outputs] 任务 ${taskId} 获取输出失败:`, err);
        applyTaskUpdate(taskId, (task) => ({
          ...task,
          outputsFetched: true,
          outputsLoading: false,
          outputsError: message,
        }));
      } finally {
        // 清除标记
        fetchingOutputsRef.current.delete(taskId);
      }
    },
    [applyTaskUpdate]
  );

  // ⚡ 然后定义 fetchTasks（它依赖 fetchOutputsForTask）
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
        
        // ✅ 检测状态变化：找出从非成功变为成功的任务
        const currentTaskMap = currentTasksRef.current;
        const newlyCompletedTasks: string[] = [];
        
        // 比较新旧任务状态，找出刚完成的任务
        rowsFromServer.forEach((newTask) => {
          const oldTask = currentTaskMap.get(newTask.task_id);
          // 如果任务状态从非成功变为成功，标记为需要立即获取输出文件
          if (newTask.status === "SUCCESS" && oldTask && oldTask.status !== "SUCCESS") {
            newlyCompletedTasks.push(newTask.task_id);
          }
        });
        
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

        // ⚡ 重要：在设置 state 之前，合并现有的 progress_info
        // 如果列表接口返回的任务没有 progress_info，但 ref 中有，则保留 ref 中的
        // 使用 ref 而不是 state，因为 ref 总是最新的
        const mergedRows = rowsFromServer.map((newTask) => {
          const existingTask = currentTaskMap.get(newTask.task_id);
          // 如果新任务没有 progress_info，但现有任务有，则保留现有的
          if (!newTask.progress_info && existingTask?.progress_info) {
            return { ...newTask, progress_info: existingTask.progress_info };
          }
          return newTask;
        });
        
        if (supportsServerPaging) {
          setPagingMode("server");
          setAllRows(null);
          setRows(mergedRows);
          setPage(serverPage);
          setPageSize(serverSize);
          setTotal(totalCount);
        } else {
          setPagingMode("client");
          setAllRows(mergedRows);
          setTotal(mergedRows.length);
          setPage(targetPage);
          setPageSize(targetSize);
          setRows(sliceRows(mergedRows, targetPage, targetSize));
        }
        
        // ✅ 更新 ref 中的任务状态（在状态更新后）
        // 注意：使用 mergedRows 而不是 rowsFromServer，确保 ref 和 state 一致
        // ⚡ 重要：mergedRows 已经包含了合并后的 progress_info
        mergedRows.forEach((task) => {
          currentTaskMap.set(task.task_id, task);
        });
        
        // 清理不存在的任务（已删除的任务）
        const serverTaskIds = new Set(mergedRows.map(t => t.task_id));
        for (const [taskId] of currentTaskMap) {
          if (!serverTaskIds.has(taskId)) {
            currentTaskMap.delete(taskId);
          }
        }
        
        // ✅ 立即为刚完成的任务获取输出文件（不等待 useEffect）
        // 使用 setTimeout 确保状态已更新后再获取输出文件
        if (newlyCompletedTasks.length > 0) {
          console.log(`✅ 检测到 ${newlyCompletedTasks.length} 个任务刚完成，立即获取输出文件:`, newlyCompletedTasks);
          newlyCompletedTasks.forEach((taskId) => {
            // 延迟执行，确保 React 状态已更新
            setTimeout(() => {
              void fetchOutputsForTask(taskId);
            }, 200);
          });
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
    [fetchOutputsForTask, isClientPaging]
  );

  // ⚡ 最后定义 fetchProgressForTask（它依赖 fetchTasks 和 fetchOutputsForTask）
  const fetchProgressForTask = useCallback(
    async (taskId: string) => {
      try {
        // 调用 detail 接口获取完整的任务信息（包括 progress_info 和 status）
        const response = await fetch(`${API_BASE}/tasks/${taskId}/detail`);
        if (!response.ok) {
          console.warn(`Failed to fetch progress for task ${taskId}`);
          return;
        }

        const data = await response.json();
        
        // ⚡ 检查任务状态是否变化
        const oldTask = currentTasksRef.current.get(taskId);
        const newStatus = data.status;
        const wasSuccess = oldTask?.status === "SUCCESS";
        const isSuccess = newStatus === "SUCCESS";
        const statusChanged = oldTask && oldTask.status !== newStatus;
        
        // 更新任务的 progress_info 和状态
        if (process.env.NODE_ENV === "development") {
          console.log(`[Progress] 更新任务 ${taskId} 的进度信息:`, {
            status: newStatus,
            progress_info: data.progress_info,
            hasProgressInfo: !!data.progress_info,
          });
        }
        
        applyTaskUpdate(taskId, (task) => ({
          ...task,
          status: newStatus || task.status,
          progress_info: data.progress_info || null,
          duration: data.duration ?? task.duration,
          elapsed_seconds: data.elapsed_seconds ?? task.elapsed_seconds,
        }));
        
        // ⚡ 如果任务状态变为 SUCCESS，立即刷新任务列表并获取输出文件
        if (statusChanged && isSuccess && !wasSuccess) {
          console.log(`✅ [Polling] 检测到任务 ${taskId} (求解器: ${data.solver_type || 'unknown'}) 状态变为 SUCCESS，立即刷新任务列表`);
          
          // 立即刷新任务列表（获取最新状态）
          // ⚡ 使用 ref 获取最新的分页信息，避免闭包问题
          const { page: currentPage, pageSize: currentPageSize, isClientPaging: currentIsClientPaging } = pagingInfoRef.current;
          const targetPage = currentIsClientPaging ? 1 : currentPage;
          
          // ⚡ 重要：确保在刷新前先更新本地状态，避免状态不一致
          // 使用 setTimeout 0 确保状态更新在下一个事件循环中完成
          setTimeout(() => {
            void fetchTasks(targetPage, currentPageSize).then(() => {
              // 刷新后，稍等片刻确保状态已更新，然后获取输出文件
              setTimeout(() => {
                void fetchOutputsForTask(taskId);
              }, 300);
            }).catch((err) => {
              console.error(`刷新任务列表失败:`, err);
              // 即使刷新失败，也尝试获取输出文件（可能已经可以从本地状态获取）
              setTimeout(() => {
                void fetchOutputsForTask(taskId);
              }, 300);
            });
          }, 0);
        }
      } catch (err) {
        console.warn(`Error fetching progress for task ${taskId}:`, err);
      }
    },
    [applyTaskUpdate, fetchTasks, fetchOutputsForTask]
  );

  useEffect(() => {
    void fetchTasks(1, DEFAULT_PAGE_SIZE);
  }, [fetchTasks]);

  // ✅ 获取成功任务的输出文件（一次性，不需要轮询）
  useEffect(() => {
    baseRows.forEach((task) => {
      // 获取成功任务的输出文件
      if (task.status === "SUCCESS" && !task.outputsFetched && !task.outputsLoading) {
        void fetchOutputsForTask(task.task_id);
      }
    });
  }, [baseRows, fetchOutputsForTask]);

  // ⚡ 优化后的进度信息轮询：使用独立定时器，根据任务状态设置不同间隔
  // 使用任务 ID 列表作为依赖，避免因 baseRows 对象引用变化导致的无限循环
  const tasksToPollIds = useMemo(() => {
    const runningStatuses = ["RUNNING", "PROGRESS", "STARTED"];
    const pendingStatuses = ["PENDING", "RETRY"];
    return baseRows
      .filter((task) => runningStatuses.includes(task.status) || pendingStatuses.includes(task.status))
      .map((task) => task.task_id)
      .sort()
      .join(","); // 转换为字符串，确保依赖稳定
  }, [baseRows]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    // 从 ref 获取最新的任务列表，避免闭包问题
    const allTasks = Array.from(currentTasksRef.current.values());
    
    // 找出需要轮询的任务（运行中或等待中的任务）
    const runningStatuses = ["RUNNING", "PROGRESS", "STARTED"];
    const pendingStatuses = ["PENDING", "RETRY"];
    const tasksToPoll = allTasks.filter((task) => 
      runningStatuses.includes(task.status) || pendingStatuses.includes(task.status)
    );

    // 调试日志：帮助排查问题
    if (process.env.NODE_ENV === "development") {
      console.log("[Polling] 检查轮询任务:", {
        totalTasks: allTasks.length,
        tasksToPoll: tasksToPoll.length,
        taskIds: tasksToPoll.map(t => ({ id: t.task_id, status: t.status })),
        tasksToPollIds,
      });
    }

    // 如果没有需要轮询的任务，直接返回
    if (tasksToPoll.length === 0) {
      if (process.env.NODE_ENV === "development") {
        console.log("[Polling] 没有需要轮询的任务，停止轮询");
      }
      return undefined;
    }

    // 存储每个任务的轮询定时器（使用 Map 确保可以正确清理）
    const timers = new Map<string, number>();

    tasksToPoll.forEach((task) => {
      // 根据任务状态设置不同的轮询间隔
      const isRunning = runningStatuses.includes(task.status);
      
      // 运行中任务：30秒轮询一次（降低频率，减少后端压力）
      // 等待中任务：60秒轮询一次（频率更低）
      const pollInterval = isRunning ? 30000 : 60000;

      // 立即执行一次（不等待第一个间隔）
      if (process.env.NODE_ENV === "development") {
        console.log(`[Polling] 立即获取任务 ${task.task_id} 的进度信息`);
      }
      void fetchProgressForTask(task.task_id);

      // 设置定时轮询
      const taskId = task.task_id;
      const timer = window.setInterval(() => {
        // ⚡ 使用 ref 获取最新的任务状态（避免闭包问题）
        const currentTask = currentTasksRef.current.get(taskId);
        if (currentTask && !TERMINAL_STATUSES.has(currentTask.status)) {
          // 任务仍在运行或等待中，继续轮询
          // ⚡ fetchProgressForTask 会自动检测状态变化并在状态变为 SUCCESS 时触发刷新
          void fetchProgressForTask(taskId);
        } else {
          // 任务已完成，清除定时器
          // ⚡ fetchProgressForTask 中已经处理了状态变为 SUCCESS 时的刷新逻辑
          const existingTimer = timers.get(taskId);
          if (existingTimer) {
            window.clearInterval(existingTimer);
            timers.delete(taskId);
          }
        }
      }, pollInterval);

      timers.set(taskId, timer);
    });

    // 清理函数：清除所有定时器
    return () => {
      timers.forEach((timer) => {
        window.clearInterval(timer);
      });
      timers.clear();
    };
  }, [tasksToPollIds, fetchProgressForTask]); // 只依赖任务 ID 列表字符串，不依赖整个 baseRows

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

  // ⚡ 优化后的主列表轮询：根据任务状态设置不同间隔
  // 使用任务 ID 列表作为依赖，避免因 baseRows 对象引用变化导致的无限循环
  const hasRunningOrPendingTasks = useMemo(() => {
    // 如果 tasksToPollIds 不为空，说明有需要轮询的任务
    return tasksToPollIds.length > 0;
  }, [tasksToPollIds]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    // 如果没有需要轮询的任务，停止轮询
    if (!hasRunningOrPendingTasks) {
      return undefined;
    }

    // 从 ref 获取最新的任务列表，判断是否有运行中的任务
    const allTasks = Array.from(currentTasksRef.current.values());
    const runningTasks = allTasks.filter((task) => {
      const runningStatuses = ["RUNNING", "PROGRESS", "STARTED"];
      return runningStatuses.includes(task.status);
    });

    // 根据任务状态设置不同的轮询间隔
    // 运行中任务：30秒轮询一次（降低频率，减少后端压力）
    // 只有等待中任务：60秒轮询一次（频率更低）
    const pollInterval = runningTasks.length > 0 ? 30000 : 60000;

    const targetPage = isClientPaging ? 1 : page;
    const timer = window.setInterval(() => {
      void fetchTasks(targetPage, pageSize);
    }, pollInterval);

    return () => {
      window.clearInterval(timer);
    };
  }, [hasRunningOrPendingTasks, fetchTasks, isClientPaging, page, pageSize]);

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

  // ✅ 重试任务处理函数
  const handleRetry = useCallback(
    async (taskId: string) => {
      // 确认操作
      const confirmed = window.confirm(
        "确定要重新执行此任务吗？\n\n" +
        "将使用相同的参数重新提交任务。\n" +
        "文件将被复制到新任务中。"
      );
      
      if (!confirmed) return;

      applyTaskUpdate(taskId, (task) => ({
        ...task,
        retrying: true,
        actionError: null,
      }));

      try {
        const result: RetryTaskResponse = await retryTask(taskId, {
          copy_files: true, // 默认复制文件（更安全）
        });

        // 显示成功消息
        const message = 
          `✅ 任务已重新提交！\n\n` +
          `新任务ID: ${result.new_task_id}\n` +
          `状态: ${result.status}\n` +
          (result.files_copied ? `已复制 ${result.files_copied} 个文件\n` : '') +
          `\n页面将刷新以显示新任务...`;
        
        alert(message);

        // 刷新任务列表
        const targetPage = isClientPaging ? 1 : page;
        await fetchTasks(targetPage, pageSize);

        // 触发自定义事件，通知其他组件
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("speos-task-created", {
              detail: { taskId: result.new_task_id },
            })
          );
        }

      } catch (err) {
        const message = err instanceof Error ? err.message : "重试任务失败";
        applyTaskUpdate(taskId, (task) => ({
          ...task,
          retrying: false,
          actionError: message,
        }));
        
        // 显示错误提示
        alert(`❌ 重试失败\n\n${message}`);
      }
    },
    [applyTaskUpdate, fetchTasks, isClientPaging, page, pageSize]
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

      // 判断是否可以重试（失败状态）
      const canRetry = ["FAILURE", "FAILED", "REVOKED", "CANCELLED", "CANCELED", "ABORTED"].includes(task.status);

      return (
        <tr key={task.task_id} className="border-b last:border-b-0 align-top">
          <td className="px-3 py-2 font-medium text-gray-800">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="whitespace-normal break-words">{task.job_name || "-"}</div>
              {/* ⭐ 新增：求解器类型标签 */}
              {task.solver_type && (
                <span 
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${getSolverColor(task.solver_type)}`}
                  title={`求解器类型: ${getSolverLabel(task.solver_type)}`}
                >
                  <span>{getSolverIcon(task.solver_type)}</span>
                  <span>{getSolverLabel(task.solver_type)}</span>
                </span>
              )}
            </div>
            
            {/* ✅ 重试关系信息 */}
            {task.parent_task_id && (
              <div className="mt-1 text-xs text-orange-600 flex items-center gap-1">
                <span>🔄</span>
                <span>重试自: {task.parent_task_id}</span>
              </div>
            )}
            {task.retry_count != null && task.retry_count > 0 && (
              <div className="mt-1 text-xs text-orange-600">
                第 {task.retry_count} 次重试
              </div>
            )}
            {task.retried_task_ids && task.retried_task_ids.length > 0 && (
              <div className="mt-1 text-xs text-blue-600">
                已重试 {task.retried_task_ids.length} 次
              </div>
            )}
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
            {/* ✅ 显示执行进度信息（多求解器）*/}
            {renderProgressInfo(task.progress_info, task.solver_type)}
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
              {/* ✅ 重试按钮（仅失败状态显示） */}
              {canRetry && (
                <button
                  onClick={() => handleRetry(task.task_id)}
                  disabled={task.retrying}
                  className="rounded border border-blue-200 bg-blue-50 px-3 py-1 text-blue-600 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                  title="重新执行此任务"
                >
                  {task.retrying ? "重试中..." : "🔄 重新执行"}
                </button>
              )}
              
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
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600" htmlFor="task-solver-type-filter">
              求解器类型
            </label>
            <select
              id="task-solver-type-filter"
              value={solverTypeFilter}
              onChange={(event) => {
                setPage(1);
                setSolverTypeFilter(event.target.value);
              }}
              className="rounded border px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">全部类型</option>
              <option value="speos">💡 SPEOS - 光学</option>
              <option value="fluent">🌊 FLUENT - 流体</option>
              <option value="maxwell">⚡ Maxwell - 电磁</option>
              <option value="mechanical">🔧 Mechanical - 结构</option>
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
          <table className="min-w-max w-full text-sm">
            <thead className="bg-gray-100 text-gray-600 sticky top-0">
              <tr>
                <th className="min-w-[200px] px-3 py-2 text-left whitespace-nowrap">任务名称</th>
                <th className="min-w-[280px] px-3 py-2 text-left whitespace-nowrap">Task ID</th>
                <th className="min-w-[240px] px-3 py-2 whitespace-nowrap">状态</th>
                <th className="min-w-[120px] px-3 py-2 whitespace-nowrap">执行时长</th>
                <th className="min-w-[180px] px-3 py-2 whitespace-nowrap">提交时间</th>
                <th className="min-w-[400px] px-3 py-2 text-left whitespace-nowrap">结果文件 / 操作</th>
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



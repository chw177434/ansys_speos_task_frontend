// 默认后端地址，可通过环境变量 NEXT_PUBLIC_API_BASE 覆盖
// 使用 Next.js rewrites 代理：通过 /api 路径访问后端，避免跨域和防火墙问题
// 如果设置了 NEXT_PUBLIC_API_BASE，则直接使用该地址（不通过代理）
export const DEFAULT_API_BASE = "/api";
export const API_BASE = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_BASE) 
  ? process.env.NEXT_PUBLIC_API_BASE 
  : DEFAULT_API_BASE;

type FetchOptions = RequestInit & { parseJson?: boolean };

async function request<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { parseJson = true, headers, ...rest } = options;
  const isFormData =
    typeof FormData !== "undefined" && rest.body instanceof FormData;

  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      ...(rest.body && !isFormData ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    ...rest,
  });

  const text = await res.text();
  if (!res.ok) {
    try {
      const data = JSON.parse(text);
      const detail = data?.detail || data?.message;
      
      // 确保错误消息是字符串，而不是对象
      let errorMessage: string;
      if (typeof detail === "string") {
        errorMessage = detail;
      } else if (typeof detail === "object" && detail !== null) {
        // 如果 detail 是对象，尝试序列化
        try {
          errorMessage = JSON.stringify(detail);
        } catch {
          errorMessage = String(detail);
        }
      } else {
        errorMessage = text || res.statusText || `请求失败: ${res.status}`;
      }
      
      throw new Error(errorMessage);
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error(text || res.statusText || `请求失败: ${res.status}`);
    }
  }

  if (!parseJson) return undefined as T;
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export interface CreateTaskResponse {
  task_id: string;
  status?: string;
  message?: string | null;
}

// ============= 求解器类型定义 =============

/**
 * 求解器类型
 */
export type SolverType = "speos" | "fluent" | "maxwell" | "mechanical";

// ============= 进度信息（支持多求解器）=============

/**
 * 进度信息（根据 solver_type 不同而不同）
 */
export interface ProgressInfo {
  // ========== SPEOS 字段 ==========
  estimated_time?: string | null;      // ⏱️ 剩余时间，如 "5 days 14 hours" | "14 hours" | "19 minutes"
  progress_percent?: number | null;    // 📊 总体进度百分比，0-100
  current_step?: string | null;        // 当前步骤，如 "10/10"（旧版兼容）
  current_pass?: number | null;        // 🔄 当前 Pass（SPEOS/Maxwell 共用）
  total_passes?: number | null;        // 🔄 总 Pass 数（SPEOS/Maxwell 共用）
  current_sensor?: number | null;      // 📡 当前 Sensor
  total_sensors?: number | null;       // 📡 总 Sensor 数
  
  // ========== FLUENT 字段 ==========
  current_iteration?: number | null;   // 🔄 当前迭代步数
  continuity_residual?: number | null; // 📉 连续性残差（科学计数法）
  progress_type?: string | null;       // 进度类型
  converged?: boolean | null;          // ✅ 是否收敛（通用）
  
  // ========== Maxwell 字段 ==========
  status?: string | null;              // 📊 状态："solving", "converged"
  // current_pass: 与 SPEOS 共用
  
  // ========== Mechanical 字段 ==========
  load_step?: number | null;           // 📊 载荷步
  substep?: number | null;             // 🔹 子步
  iteration?: number | null;           // 🔄 迭代
  
  // ========== 通用字段 ==========
  message?: string | null;             // 附加信息
}

export interface TaskStatusResponse {
  task_id: string;
  status: string;
  message?: string | null;
  download_url?: string | null;
  download_name?: string | null;
  duration?: number | null;
  elapsed_seconds?: number | null;
  progress_info?: ProgressInfo | null; // ✅ 执行进度信息（多求解器）
  parent_task_id?: string | null; // ✅ 父任务ID（如果是重试任务）
  retry_count?: number | null; // ✅ 重试次数（0表示原始任务）
  retried_task_ids?: string[] | null; // ✅ 由此任务生成的重试任务列表
  solver_type?: SolverType | null; // ⭐ 新增：求解器类型
}

export interface TaskOutputsResponse {
  task_id: string;
  base_dir?: string | null;
  files: Array<string | { name?: string; url?: string }>;
  file_entries?: Array<{ name?: string; url?: string }>;
  download_url?: string | null;
  download_name?: string | null;
}

export async function createTask(formData: FormData) {
  return request<CreateTaskResponse>("/tasks", {
    method: "POST",
    body: formData,
  });
}

export async function getTaskStatus(taskId: string) {
  return request<TaskStatusResponse>(`/tasks/${taskId}`);
}

// ============= 任务重试接口 =============

/**
 * 任务重试请求参数
 */
export interface RetryTaskRequest {
  copy_files?: boolean; // 是否复制文件（默认true）
                       // true: 复制文件（安全，占用空间）
                       // false: 创建软/硬链接（节省空间，但原文件不能删除）
  submitter?: string;  // 可选：覆盖提交人信息
}

/**
 * 任务重试响应数据
 */
export interface RetryTaskResponse {
  new_task_id: string;      // 新任务ID
  original_task_id: string; // 原任务ID
  status: string;           // 新任务状态（通常是PENDING）
  message: string;          // 说明信息
  files_copied?: number;    // 复制的文件数量（如果copy_files=true）
  files_linked?: number;    // 链接的文件数量（如果copy_files=false）
}

/**
 * 重试任务
 * @param taskId 要重试的任务ID
 * @param options 重试选项
 * @returns 重试响应数据
 * 
 * @example
 * ```typescript
 * // 复制文件方式重试（推荐）
 * const result = await retryTask('task_123', { copy_files: true });
 * console.log(`新任务ID: ${result.new_task_id}`);
 * 
 * // 使用链接方式重试（节省空间）
 * const result = await retryTask('task_123', { copy_files: false });
 * ```
 */
export async function retryTask(
  taskId: string,
  options: RetryTaskRequest = { copy_files: true }
): Promise<RetryTaskResponse> {
  return request<RetryTaskResponse>(`/tasks/${taskId}/retry`, {
    method: "POST",
    body: JSON.stringify(options),
  });
}

export async function listOutputs(taskId: string) {
  return request<TaskOutputsResponse>(`/tasks/${taskId}/outputs`);
}
export async function deleteTask(taskId: string) {
  await request<void>(`/tasks/${taskId}`, {
    method: "DELETE",
    parseJson: false,
  });
}

// ============= 上传配置接口 =============

export interface UploadConfigResponse {
  upload_mode: "direct" | "tos";
  max_file_size_mb?: number;
  chunk_size_mb?: number;
}

export async function getUploadConfig() {
  return request<UploadConfigResponse>("/v2/upload/config", {
    method: "GET",
  });
}

// ============= Direct 上传模式接口 =============

export interface DirectUploadParams {
  // 方式1：直接上传文件（原有方式）
  master_file?: File;
  include_file?: File;
  
  // 方式2：基于已上传文件（新方式，断点续传完成后使用）
  task_id?: string;  // 提供 task_id 时，使用已上传的文件，不需要重新上传
  
  // 必需参数
  profile_name: string;
  version: string;
  job_name: string;
  
  // ⭐ 新增：求解器类型（默认 "speos"）
  solver_type?: SolverType;
  
  // 可选参数
  job_key?: string;
  display_name?: string;
  project_dir?: string;
  
  // ========== SPEOS 参数 ==========
  use_gpu?: boolean;
  simulation_index?: string;
  thread_count?: string;
  priority?: string;
  ray_count?: string;
  duration_minutes?: string;
  hpc_job_name?: string;
  node_count?: string;
  walltime_hours?: string;
  
  // ========== FLUENT 参数 ==========
  dimension?: "2d" | "3d";              // 维度（默认 "3d"）
  precision?: "sp" | "dp";              // 精度（默认 "dp"）
  iterations?: number;                  // 迭代步数（默认 300）
  initialization_method?: "hyb" | "standard";  // 初始化方法（默认 "standard"）
  
  // ========== Maxwell/Mechanical 参数 ==========
  num_cores?: string;
  design_name?: string;  // Maxwell 专用
}

export interface DirectUploadResponse {
  task_id: string;
  status: string;
  message?: string;
}

export async function submitDirectUpload(
  params: DirectUploadParams,
  onProgress?: (info: UploadProgressInfo) => void,
  abortSignal?: AbortSignal
): Promise<DirectUploadResponse> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    
    // 方式2：基于已上传文件（新方式，断点续传完成后使用）
    if (params.task_id) {
      // 提供 task_id 时，使用已上传的文件，不需要重新上传
      formData.append("task_id", params.task_id);
    } else {
      // 方式1：直接上传文件（原有方式）
      if (!params.master_file) {
        reject(new Error("必须提供 master_file 或 task_id"));
        return;
      }
      formData.append("master_file", params.master_file);
      if (params.include_file) {
        formData.append("include_file", params.include_file);
      }
    }
    
    // 添加必需参数
    formData.append("profile_name", params.profile_name);
    formData.append("version", params.version);
    formData.append("job_name", params.job_name);
    
    // ⭐ 关键修复：添加 solver_type 参数（默认 "speos"）
    formData.append("solver_type", params.solver_type || "speos");
    
    // 添加可选通用参数
    if (params.job_key) formData.append("job_key", params.job_key);
    if (params.display_name) formData.append("display_name", params.display_name);
    if (params.project_dir) formData.append("project_dir", params.project_dir);
    
    // ========== SPEOS 参数 ==========
    if (params.use_gpu !== undefined) formData.append("use_gpu", String(params.use_gpu));
    if (params.simulation_index) formData.append("simulation_index", params.simulation_index);
    if (params.thread_count) formData.append("thread_count", params.thread_count);
    if (params.priority) formData.append("priority", params.priority);
    if (params.ray_count) formData.append("ray_count", params.ray_count);
    if (params.duration_minutes) formData.append("duration_minutes", params.duration_minutes);
    if (params.hpc_job_name) formData.append("hpc_job_name", params.hpc_job_name);
    if (params.node_count) formData.append("node_count", params.node_count);
    if (params.walltime_hours) formData.append("walltime_hours", params.walltime_hours);
    
    // ========== FLUENT 参数 ==========
    if (params.dimension) formData.append("dimension", params.dimension);
    if (params.precision) formData.append("precision", params.precision);
    if (params.iterations !== undefined) formData.append("iterations", String(params.iterations));
    if (params.initialization_method) formData.append("initialization_method", params.initialization_method);
    
    // ========== Maxwell/Mechanical 参数 ==========
    if (params.num_cores) formData.append("num_cores", params.num_cores);
    if (params.design_name) formData.append("design_name", params.design_name);

    const xhr = new XMLHttpRequest();
    
    // Direct Upload 使用独立的后端地址（不通过 Next.js 代理）
    // 因为文件上传可能很大，不适合通过代理
    // 自动使用当前主机的后端地址（端口8000）
    const directBackendUrl = typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.hostname}:8000`
      : 'http://localhost:8000';
    
    let startTime = Date.now();
    let lastLoaded = 0;
    let lastTime = Date.now();

    // 监听取消信号
    if (abortSignal) {
      if (abortSignal.aborted) {
        reject(new Error("上传已取消"));
        return;
      }
      
      abortSignal.addEventListener("abort", () => {
        xhr.abort();
        reject(new Error("上传已取消"));
      });
    }

    // 上传进度监控（仅在方式1：直接上传文件时有效）
    if (onProgress && !params.task_id) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const now = Date.now();
          const timeDiff = (now - lastTime) / 1000;
          const loadedDiff = e.loaded - lastLoaded;
          
          const speed = timeDiff > 0 ? loadedDiff / timeDiff : 0;
          const remaining = e.total - e.loaded;
          const estimatedTime = speed > 0 ? remaining / speed : 0;
          const progress = Math.round((e.loaded / e.total) * 100);
          
          onProgress({
            progress,
            loaded: e.loaded,
            total: e.total,
            speed,
            estimatedTime,
          });
          
          lastLoaded = e.loaded;
          lastTime = now;
        }
      };
    } else if (onProgress && params.task_id) {
      // 方式2：基于已上传文件，不需要上传进度，但可以模拟进度
      // 这里不设置上传进度监控，因为文件已经上传完成
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText) as DirectUploadResponse;
          resolve(response);
        } catch (error) {
          reject(new Error("解析响应失败"));
        }
      } else {
        try {
          const errorData = JSON.parse(xhr.responseText);
          const errorMessage = errorData?.detail || errorData?.message || xhr.statusText;
          reject(new Error(errorMessage));
        } catch {
          reject(new Error(`上传失败: ${xhr.status} ${xhr.statusText}`));
        }
      }
    };

    xhr.onerror = () => reject(new Error("网络错误，上传失败"));
    xhr.ontimeout = () => reject(new Error("上传超时"));
    xhr.onabort = () => reject(new Error("上传已取消"));

    // Direct Upload 直接连接后端，不通过 Next.js 代理
    // 避免代理的请求大小和超时限制
    xhr.open("POST", `${directBackendUrl}/api/tasks/submit-direct`);
    
    // 设置超时时间
    if (params.task_id) {
      // 方式2：基于已上传文件，不需要上传，设置较短的超时时间
      xhr.timeout = 30 * 1000; // 30秒，足够处理任务创建和文件解压
    } else {
      // 方式1：直接上传文件，根据文件大小设置超时时间
      const totalSize = params.master_file!.size + (params.include_file?.size || 0);
      const timeoutMinutes = totalSize > 100 * 1024 * 1024 ? 30 : 10;
      xhr.timeout = timeoutMinutes * 60 * 1000;
    }

    xhr.send(formData);
  });
}

// ============= TOS 上传相关接口 =============

export interface InitUploadResponse {
  task_id: string;
  master_upload?: {
    object_key: string;
    upload_url: string;
    expires_in: number;
  };
  include_upload?: {
    object_key: string;
    upload_url: string;
    expires_in: number;
  };
}

export interface InitUploadRequest {
  filename: string;
  file_size: number;
  file_type: "master" | "include";
  content_type: string;
  job_name: string;
  submitter: string;
}

export interface ConfirmUploadRequest {
  task_id: string;
  master_object_key: string;
  include_object_key?: string;
  job_name: string;
  submitter?: string;
  profile_name: string;
  version: string;
  project_dir?: string;
  
  // ⭐ 新增：求解器类型（默认 "speos"）
  solver_type?: SolverType;
  
  // ========== SPEOS 参数（solver_type="speos" 或未指定）==========
  use_gpu?: boolean;
  simulation_index?: string;
  thread_count?: string;
  priority?: string;
  ray_count?: string;
  duration_minutes?: string;
  hpc_job_name?: string;
  node_count?: string;
  walltime_hours?: string;
  
  // ========== FLUENT 参数（solver_type="fluent"）==========
  dimension?: "2d" | "3d";              // 维度（默认 "3d"）
  precision?: "sp" | "dp";              // 精度（默认 "dp"，推荐双精度）
  iterations?: number;                  // 迭代步数（默认 300，简单流动 100-200，复杂流动 500-1000）
  initialization_method?: "hyb" | "standard";  // 初始化方法（默认 "standard"，推荐 "hyb"）
  
  // ========== Maxwell 参数（solver_type="maxwell"）==========
  num_cores?: string;           // 核心数（默认 "4"）
  design_name?: string;         // 设计名称（可选）
  
  // ========== Mechanical 参数（solver_type="mechanical"）==========
  // thread_count: 核心数（必需，与 SPEOS/FLUENT 共用）
  job_key?: string;             // 任务标识（用于文件命名，推荐）
}

export interface ConfirmUploadResponse {
  task_id: string;
  status: string;
  message?: string;
}

export async function initUpload(data: InitUploadRequest) {
  return request<InitUploadResponse>("/tasks/upload/init", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function confirmUpload(data: ConfirmUploadRequest) {
  return request<ConfirmUploadResponse>("/tasks/upload/confirm", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export interface UploadProgressInfo {
  progress: number;
  loaded: number;
  total: number;
  speed: number; // bytes per second
  estimatedTime: number; // seconds remaining
}

export async function uploadToTOS(
  uploadUrl: string,
  file: File | Blob,
  onProgress?: (info: UploadProgressInfo) => void,
  abortSignal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    let startTime = Date.now();
    let lastLoaded = 0;
    let lastTime = Date.now();

    // 监听取消信号
    if (abortSignal) {
      if (abortSignal.aborted) {
        reject(new Error("上传已取消"));
        return;
      }
      
      abortSignal.addEventListener("abort", () => {
        xhr.abort();
        reject(new Error("上传已取消"));
      });
    }

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const now = Date.now();
          const timeDiff = (now - lastTime) / 1000; // seconds
          const loadedDiff = e.loaded - lastLoaded;
          
          // 计算瞬时速度（字节/秒）
          const speed = timeDiff > 0 ? loadedDiff / timeDiff : 0;
          
          // 计算预计剩余时间（秒）
          const remaining = e.total - e.loaded;
          const estimatedTime = speed > 0 ? remaining / speed : 0;
          
          const progress = Math.round((e.loaded / e.total) * 100);
          
          onProgress({
            progress,
            loaded: e.loaded,
            total: e.total,
            speed,
            estimatedTime,
          });
          
          lastLoaded = e.loaded;
          lastTime = now;
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status === 200) {
        resolve();
      } else {
        reject(new Error(`上传失败: ${xhr.status} ${xhr.statusText}`));
      }
    };

    xhr.onerror = () => reject(new Error("网络错误，上传失败"));
    xhr.ontimeout = () => reject(new Error("上传超时"));
    xhr.onabort = () => reject(new Error("上传已取消"));

    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    
    // 大文件设置更长的超时时间
    const timeoutMinutes = file.size > 100 * 1024 * 1024 ? 30 : 10;
    xhr.timeout = timeoutMinutes * 60 * 1000;

    xhr.send(file);
  });
}

// 格式化文件大小
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

// 格式化速度
export function formatSpeed(bytesPerSecond: number): string {
  return formatFileSize(bytesPerSecond) + "/s";
}

// 格式化时间
export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "计算中...";
  if (seconds < 60) return `${Math.round(seconds)} 秒`;
  const minutes = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (minutes < 60) return `${minutes} 分 ${secs} 秒`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours} 小时 ${mins} 分`;
}

// ============= SPEOS 进度信息工具函数 =============

/**
 * 检查任务是否有有效的进度信息
 * @param progressInfo 进度信息对象
 * @returns 是否有有效的进度信息
 */
export function hasValidProgressInfo(progressInfo: ProgressInfo | null | undefined): boolean {
  if (!progressInfo) return false;
  
  const hasEstimatedTime = progressInfo.estimated_time && progressInfo.estimated_time.trim() !== "";
  const hasProgressPercent = progressInfo.progress_percent != null && isFinite(progressInfo.progress_percent);
  const hasCurrentStep = progressInfo.current_step && progressInfo.current_step.trim() !== "";
  
  return hasEstimatedTime || hasProgressPercent || hasCurrentStep;
}

/**
 * 格式化进度百分比
 * @param percent 百分比值 (0-100)
 * @returns 格式化后的字符串
 */
export function formatProgressPercent(percent: number | null | undefined): string {
  if (percent == null || !isFinite(percent)) {
    return "-";
  }
  return `${Math.round(percent)}%`;
}

/**
 * 格式化 estimated_time 字符串为中文显示
 * 支持后端返回的所有时间格式（支持单复数：day/days, hour/hours）：
 * - "1 day 1 hour 22 min" / "2 days 3 hours 30 min"（天+小时+分钟）
 * - "1 day 1 hour" / "2 days 3 hours"（天+小时）
 * - "1 day 22 min" / "2 days 30 min"（天+分钟）
 * - "1 day" / "2 days"（只有天）
 * - "1 hour 22 min" / "2 hours 30 min"（小时+分钟）
 * - "14 hours" / "2.5 hours"（只有小时）
 * - "19 minutes" / "45 minutes"（只有分钟）
 * 
 * @param estimatedTime 后端返回的时间字符串
 * @returns 格式化后的中文时间字符串
 */
export function formatEstimatedTime(estimatedTime: string | null | undefined): string {
  if (!estimatedTime || !estimatedTime.trim()) {
    return "计算中...";
  }

  const trimmed = estimatedTime.trim();

  // 匹配 "X day(s) Y hour(s) Z min" 格式（天+小时+分钟）
  // 例如: "1 day 1 hour 22 min", "2 days 3 hours 30 min"
  const daysHoursMinMatch = trimmed.match(/(\d+)\s+days?\s+(\d+)\s+hours?\s+(\d+)\s+min/i);
  if (daysHoursMinMatch) {
    const days = parseInt(daysHoursMinMatch[1], 10);
    const hours = parseInt(daysHoursMinMatch[2], 10);
    const minutes = parseInt(daysHoursMinMatch[3], 10);
    return `${days}天${hours}小时${minutes}分钟`;
  }

  // 匹配 "X day(s) Y hour(s)" 格式（天+小时，没有分钟）
  // 例如: "1 day 1 hour", "2 days 3 hours"
  const daysHoursMatch = trimmed.match(/(\d+)\s+days?\s+(\d+)\s+hours?/i);
  if (daysHoursMatch) {
    const days = parseInt(daysHoursMatch[1], 10);
    const hours = parseInt(daysHoursMatch[2], 10);
    return `${days}天${hours}小时`;
  }

  // 匹配 "X day(s) Y min" 格式（天+分钟，没有小时）
  // 例如: "1 day 22 min", "2 days 30 min"
  const daysMinMatch = trimmed.match(/(\d+)\s+days?\s+(\d+)\s+min/i);
  if (daysMinMatch) {
    const days = parseInt(daysMinMatch[1], 10);
    const minutes = parseInt(daysMinMatch[2], 10);
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      if (remainingMinutes > 0) {
        return `${days}天${hours}小时${remainingMinutes}分钟`;
      }
      return `${days}天${hours}小时`;
    }
    return `${days}天${minutes}分钟`;
  }

  // 匹配 "X day(s)" 格式（只有天）
  // 例如: "1 day", "2 days"
  const daysMatch = trimmed.match(/(\d+)\s+days?/i);
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10);
    return `${days}天`;
  }

  // 匹配 "X hour(s) Y min" 格式（小时+分钟，没有天）
  // 例如: "1 hour 22 min", "2 hours 30 min"
  const hoursMinMatch = trimmed.match(/(\d+)\s+hours?\s+(\d+)\s+min/i);
  if (hoursMinMatch) {
    const hours = parseInt(hoursMinMatch[1], 10);
    const minutes = parseInt(hoursMinMatch[2], 10);
    return `${hours}小时${minutes}分钟`;
  }

  // 匹配 "X hours" 格式（只有小时，支持浮点数）
  const hoursMatch = trimmed.match(/(\d+(?:\.\d+)?)\s+hours?/i);
  if (hoursMatch) {
    const hours = parseFloat(hoursMatch[1]);
    if (hours >= 1) {
      return `${Math.round(hours)}小时`;
    } else {
      const minutes = Math.round(hours * 60);
      return `${minutes}分钟`;
    }
  }

  // 匹配 "X minutes" 格式（只有分钟）
  const minutesMatch = trimmed.match(/(\d+)\s+minutes?/i);
  if (minutesMatch) {
    const minutes = parseInt(minutesMatch[1], 10);
    return `${minutes}分钟`;
  }

  // 如果都不匹配，直接返回原字符串（向后兼容）
  return trimmed;
}

/**
 * 从 Celery 任务结果中提取进度信息的辅助函数
 * @param result Celery 任务结果对象
 * @returns 进度信息对象或 null
 * 
 * @example
 * ```typescript
 * const result = await getTaskStatus(taskId);
 * const progressInfo = extractProgressInfo(result);
 * 
 * if (progressInfo) {
 *   console.log(`预计时间: ${progressInfo.estimated_time}`);
 *   console.log(`进度: ${progressInfo.progress_percent}%`);
 *   console.log(`当前步骤: ${progressInfo.current_step}`);
 * }
 * ```
 */
export function extractProgressInfo(result: TaskStatusResponse): ProgressInfo | null {
  return result.progress_info || null;
}

/**
 * 获取进度信息的摘要描述（用于 UI 显示）
 * @param progressInfo 进度信息对象
 * @returns 摘要字符串
 * 
 * @example
 * ```typescript
 * const summary = getProgressSummary(progressInfo);
 * // "执行中: 45% (步骤 3/10, 预计 2.5 hours)"
 * ```
 */
export function getProgressSummary(progressInfo: ProgressInfo | null | undefined): string {
  if (!progressInfo || !hasValidProgressInfo(progressInfo)) {
    return "-";
  }
  
  const parts: string[] = [];
  
  if (progressInfo.progress_percent != null && isFinite(progressInfo.progress_percent)) {
    parts.push(`${formatProgressPercent(progressInfo.progress_percent)}`);
  }
  
  if (progressInfo.current_step) {
    parts.push(`步骤 ${progressInfo.current_step}`);
  }
  
  if (progressInfo.estimated_time) {
    parts.push(`预计 ${formatEstimatedTime(progressInfo.estimated_time)}`);
  }
  
  return parts.length > 0 ? parts.join(", ") : "-";
}

// ============= 断点续传相关接口 =============

// 分片大小：5MB
export const CHUNK_SIZE = 5 * 1024 * 1024;

export interface MultipartPart {
  part_number: number;
  upload_url: string;
  start_byte: number;
  end_byte: number;
  size: number;
}

export interface InitMultipartUploadRequest {
  filename: string;
  file_size: number;
  file_type: "master" | "include";
  content_type: string;
  chunk_size?: number;
}

export interface InitMultipartUploadResponse {
  task_id: string;
  upload_id: string;
  object_key: string;
  total_chunks: number;
  parts: MultipartPart[];
}

export interface PartETag {
  part_number: number;
  etag: string;
}

export interface CompleteMultipartUploadRequest {
  task_id: string;
  upload_id: string;
  object_key: string;
  file_type: "master" | "include";
  parts: PartETag[];
}

export interface CompleteMultipartUploadResponse {
  object_key: string;
  message: string;
}

export interface ListUploadedPartsRequest {
  task_id: string;
  upload_id: string;
  object_key: string;
}

export interface ListUploadedPartsResponse {
  parts: PartETag[];
}

export interface AbortMultipartUploadRequest {
  task_id: string;
  upload_id: string;
  object_key: string;
}

// 1. 初始化分片上传
export async function initMultipartUpload(data: InitMultipartUploadRequest) {
  return request<InitMultipartUploadResponse>("/tasks/upload/multipart/init", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// 2. 上传单个分片到 TOS
export async function uploadPart(
  uploadUrl: string,
  chunk: Blob,
  onProgress?: (loaded: number, total: number) => void,
  abortSignal?: AbortSignal
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    if (abortSignal) {
      if (abortSignal.aborted) {
        reject(new Error("上传已取消"));
        return;
      }
      
      abortSignal.addEventListener("abort", () => {
        xhr.abort();
        reject(new Error("上传已取消"));
      });
    }

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(e.loaded, e.total);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status === 200) {
        // 获取 ETag 并移除引号
        const etag = xhr.getResponseHeader("ETag");
        if (!etag) {
          reject(new Error("未获取到 ETag"));
          return;
        }
        // 移除 ETag 中的引号
        const cleanETag = etag.replace(/^"(.*)"$/, "$1");
        resolve(cleanETag);
      } else {
        reject(new Error(`分片上传失败: ${xhr.status} ${xhr.statusText}`));
      }
    };

    xhr.onerror = () => reject(new Error("网络错误，分片上传失败"));
    xhr.ontimeout = () => reject(new Error("分片上传超时"));
    xhr.onabort = () => reject(new Error("分片上传已取消"));

    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.timeout = 5 * 60 * 1000; // 5分钟超时

    xhr.send(chunk);
  });
}

// 3. 完成分片上传
export async function completeMultipartUpload(data: CompleteMultipartUploadRequest) {
  return request<CompleteMultipartUploadResponse>("/tasks/upload/multipart/complete", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// 4. 查询已上传的分片（断点续传）
export async function listUploadedParts(data: ListUploadedPartsRequest) {
  return request<ListUploadedPartsResponse>("/tasks/upload/multipart/list", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// 5. 取消分片上传
export async function abortMultipartUpload(data: AbortMultipartUploadRequest) {
  return request<void>("/tasks/upload/multipart/abort", {
    method: "POST",
    body: JSON.stringify(data),
    parseJson: false,
  });
}

// ============= 断点续传进度管理 =============

export interface ResumableUploadProgress {
  task_id: string;
  upload_id: string;
  object_key: string;
  file_type: "master" | "include";
  filename: string;
  file_size: number;
  total_chunks: number;
  uploaded_parts: PartETag[];
  timestamp: number;
}

// 保存上传进度到 localStorage
export function saveUploadProgress(progress: ResumableUploadProgress): void {
  if (typeof window === "undefined") return;
  
  try {
    const key = `resumable_upload_${progress.task_id}_${progress.file_type}`;
    localStorage.setItem(key, JSON.stringify(progress));
    console.log(`✅ 保存上传进度: ${progress.filename}, 已上传 ${progress.uploaded_parts.length}/${progress.total_chunks} 片`);
  } catch (error) {
    console.warn("保存上传进度失败", error);
  }
}

// 从 localStorage 加载上传进度
export function loadUploadProgress(task_id: string, file_type: "master" | "include"): ResumableUploadProgress | null {
  if (typeof window === "undefined") return null;
  
  try {
    const key = `resumable_upload_${task_id}_${file_type}`;
    const data = localStorage.getItem(key);
    if (!data) return null;
    
    const progress = JSON.parse(data) as ResumableUploadProgress;
    console.log(`📥 加载上传进度: ${progress.filename}, 已上传 ${progress.uploaded_parts.length}/${progress.total_chunks} 片`);
    return progress;
  } catch (error) {
    console.warn("加载上传进度失败", error);
    return null;
  }
}

// 清除上传进度
export function clearUploadProgress(task_id: string, file_type: "master" | "include"): void {
  if (typeof window === "undefined") return;
  
  try {
    const key = `resumable_upload_${task_id}_${file_type}`;
    localStorage.removeItem(key);
    console.log(`🗑️ 清除上传进度: ${task_id} (${file_type})`);
  } catch (error) {
    console.warn("清除上传进度失败", error);
  }
}

// ============= Direct 模式断点续传接口 =============

/**
 * Direct 模式：初始化分片上传
 * 与 TOS 模式不同，Direct 模式直接上传到后端服务器
 */
export interface DirectMultipartInitRequest {
  filename: string;
  file_size: number;
  file_type: "master" | "include";
  content_type?: string;  // 可选：文件内容类型（如 "application/octet-stream"）
  chunk_size?: number;
  task_id?: string;  // 可选：如果提供，使用指定的 task_id（用于 include 文件与 master 文件使用相同的 task_id）
  job_name?: string;  // 可选：任务名称
  submitter?: string;  // 可选：提交者
}

export interface DirectMultipartInitResponse {
  task_id: string;
  upload_id: string;
  filename?: string;  // 响应中的文件名（与请求一致）
  chunk_size?: number;  // 响应中的分片大小（与请求一致）
  total_chunks: number;
  parts: Array<{
    part_number: number;
    start_byte: number;
    end_byte: number;
    size: number;
  }>;
  message?: string;  // 响应消息
}

export async function initDirectMultipartUpload(data: DirectMultipartInitRequest) {
  // 使用直接的后端地址，不通过 Next.js 代理
  const directBackendUrl = typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : 'http://localhost:8000';
    
  const res = await fetch(`${directBackendUrl}/api/upload/direct/multipart/init`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const text = await res.text();
  if (!res.ok) {
    try {
      const errorData = JSON.parse(text);
      const detail = errorData?.detail || errorData?.message;
      throw new Error(detail || text || res.statusText);
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error(text || res.statusText);
    }
  }

  return JSON.parse(text) as DirectMultipartInitResponse;
}

/**
 * Direct 模式：上传单个分片
 * 注意：Direct 模式使用 FormData，而不是直接 PUT Blob
 */
export async function uploadDirectPart(
  taskId: string,
  uploadId: string,
  partNumber: number,
  chunk: Blob,
  onProgress?: (loaded: number, total: number) => void,
  abortSignal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    if (abortSignal) {
      if (abortSignal.aborted) {
        reject(new Error("上传已取消"));
        return;
      }
      
      abortSignal.addEventListener("abort", () => {
        xhr.abort();
        reject(new Error("上传已取消"));
      });
    }

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(e.loaded, e.total);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 201) {
        resolve();
      } else {
        try {
          const errorData = JSON.parse(xhr.responseText);
          const errorMessage = errorData?.detail || errorData?.message || xhr.statusText;
          reject(new Error(`分片上传失败: ${errorMessage}`));
        } catch {
          reject(new Error(`分片上传失败: ${xhr.status} ${xhr.statusText}`));
        }
      }
    };

    xhr.onerror = () => reject(new Error("网络错误，分片上传失败"));
    xhr.ontimeout = () => reject(new Error("分片上传超时"));
    xhr.onabort = () => reject(new Error("分片上传已取消"));

    // Direct 模式使用 FormData
    const formData = new FormData();
    formData.append("task_id", taskId);
    formData.append("upload_id", uploadId);
    formData.append("part_number", partNumber.toString());
    formData.append("file", chunk);

    // 使用直接的后端地址
    const directBackendUrl = typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.hostname}:8000`
      : 'http://localhost:8000';

    xhr.open("POST", `${directBackendUrl}/api/upload/direct/multipart/part`);
    xhr.timeout = 5 * 60 * 1000; // 5分钟超时
    xhr.send(formData);
  });
}

/**
 * Direct 模式：查询已上传的分片（断点续传）
 */
export interface DirectListUploadedPartsRequest {
  task_id: string;
  upload_id: string;
}

export interface DirectListUploadedPartsResponse {
  task_id?: string;  // 任务ID（与请求一致）
  upload_id?: string;  // 上传ID（与请求一致）
  parts: number[]; // 已上传的分片编号列表（整数数组，从1开始）
  message?: string;  // 响应消息
}

export async function listDirectUploadedParts(data: DirectListUploadedPartsRequest) {
  const directBackendUrl = typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : 'http://localhost:8000';

  const res = await fetch(`${directBackendUrl}/api/upload/direct/multipart/list`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const text = await res.text();
  if (!res.ok) {
    try {
      const errorData = JSON.parse(text);
      const detail = errorData?.detail || errorData?.message;
      throw new Error(detail || text || res.statusText);
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error(text || res.statusText);
    }
  }

  return JSON.parse(text) as DirectListUploadedPartsResponse;
}

/**
 * Direct 模式：完成分片上传
 */
export interface DirectCompleteMultipartRequest {
  task_id: string;
  upload_id: string;
  filename: string;
  file_type: "master" | "include";
  parts: Array<{ part_number: number }>;
}

export interface DirectCompleteMultipartResponse {
  task_id?: string;  // 任务ID
  filename?: string;  // 文件名
  file_path: string;  // 文件路径
  file_size?: number;  // 文件大小
  status?: string;  // 状态（如 "completed"）
  message: string;  // 响应消息
}

export async function completeDirectMultipartUpload(data: DirectCompleteMultipartRequest) {
  const directBackendUrl = typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : 'http://localhost:8000';

  const res = await fetch(`${directBackendUrl}/api/upload/direct/multipart/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const text = await res.text();
  if (!res.ok) {
    try {
      const errorData = JSON.parse(text);
      const detail = errorData?.detail || errorData?.message;
      throw new Error(detail || text || res.statusText);
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error(text || res.statusText);
    }
  }

  return JSON.parse(text) as DirectCompleteMultipartResponse;
}

// ============= Direct 模式断点续传进度管理 =============

export interface DirectResumableUploadProgress {
  task_id: string;
  upload_id: string;
  file_type: "master" | "include";
  filename: string;
  file_size: number;
  total_chunks: number;
  uploaded_parts: number[]; // Direct 模式只需要保存分片编号
  timestamp: number;
}

// 保存 Direct 模式上传进度
export function saveDirectUploadProgress(progress: DirectResumableUploadProgress): void {
  if (typeof window === "undefined") return;
  
  try {
    const key = `direct_upload_${progress.task_id}_${progress.file_type}`;
    localStorage.setItem(key, JSON.stringify(progress));
    console.log(`✅ [Direct] 保存上传进度: ${progress.filename}, 已上传 ${progress.uploaded_parts.length}/${progress.total_chunks} 片`);
  } catch (error) {
    console.warn("[Direct] 保存上传进度失败", error);
  }
}

// 加载 Direct 模式上传进度
export function loadDirectUploadProgress(task_id: string, file_type: "master" | "include"): DirectResumableUploadProgress | null {
  if (typeof window === "undefined") return null;
  
  try {
    const key = `direct_upload_${task_id}_${file_type}`;
    const data = localStorage.getItem(key);
    if (!data) return null;
    
    const progress = JSON.parse(data) as DirectResumableUploadProgress;
    console.log(`📥 [Direct] 加载上传进度: ${progress.filename}, 已上传 ${progress.uploaded_parts.length}/${progress.total_chunks} 片`);
    return progress;
  } catch (error) {
    console.warn("[Direct] 加载上传进度失败", error);
    return null;
  }
}

// 清除 Direct 模式上传进度
export function clearDirectUploadProgress(task_id: string, file_type: "master" | "include"): void {
  if (typeof window === "undefined") return;
  
  try {
    const key = `direct_upload_${task_id}_${file_type}`;
    localStorage.removeItem(key);
    console.log(`🗑️ [Direct] 清除上传进度: ${task_id} (${file_type})`);
  } catch (error) {
    console.warn("[Direct] 清除上传进度失败", error);
  }
}
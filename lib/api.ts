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
      throw new Error(detail || text || res.statusText);
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error(text || res.statusText);
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

export interface TaskStatusResponse {
  task_id: string;
  status: string;
  message?: string | null;
  download_url?: string | null;
  download_name?: string | null;
  duration?: number | null;
  elapsed_seconds?: number | null;
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

export async function listOutputs(taskId: string) {
  return request<TaskOutputsResponse>(`/tasks/${taskId}/outputs`);
}
export async function deleteTask(taskId: string) {
  await request<void>(`/tasks/${taskId}`, {
    method: "DELETE",
    parseJson: false,
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
  use_gpu?: boolean;
  simulation_index?: string;
  thread_count?: string;
  priority?: string;
  ray_count?: string;
  duration_minutes?: string;
  hpc_job_name?: string;
  node_count?: string;
  walltime_hours?: string;
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


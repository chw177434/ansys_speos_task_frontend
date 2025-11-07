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

// ⚡ 导入 Phase 1 类型定义
import type { 
  ExecutorType, 
  TaskStatus, 
  TaskDetail,
  CreateTaskResponse as CreateTaskRes,
  TaskOutputsResponse as TaskOutputsRes
} from '../types/api';

// 兼容旧的类型名称
export interface CreateTaskResponse extends CreateTaskRes {}

// 扩展 TaskStatusResponse 以支持新字段
export interface TaskStatusResponse extends TaskStatus {}

// 使用统一的 TaskOutputsResponse
export interface TaskOutputsResponse extends TaskOutputsRes {}

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

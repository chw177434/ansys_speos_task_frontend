export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

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

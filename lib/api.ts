export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export async function submitTask(file: File, params: any) {
  const fd = new FormData();
  Object.keys(params).forEach((k) => {
    fd.append(k, params[k]);
  });
  const res = await fetch(`${API_BASE}/tasks`, { method: "POST", body: fd });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getTaskStatus(taskId: string) {
  const res = await fetch(`${API_BASE}/tasks/${taskId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listOutputs(taskId: string) {
  const res = await fetch(`${API_BASE}/tasks/${taskId}/outputs`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

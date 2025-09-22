"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  API_BASE,
  createTask,
  getTaskStatus,
  listOutputs,
  type CreateTaskResponse,
  type TaskOutputsResponse,
} from "../lib/api";

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-gray-200 text-gray-800",
  STARTED: "bg-yellow-200 text-yellow-800",
  RETRY: "bg-yellow-200 text-yellow-800",
  RECEIVED: "bg-blue-200 text-blue-800",
  SUCCESS: "bg-green-200 text-green-800",
  FAILURE: "bg-red-200 text-red-800",
  FAILED: "bg-red-200 text-red-800",
  REVOKED: "bg-red-200 text-red-800",
};

const TERMINAL_STATUSES = new Set(["SUCCESS", "FAILURE", "FAILED", "REVOKED"]);
const REFRESH_INTERVAL_MS = 5000;
const STORAGE_KEY = "speos_task_history";
const DEFAULT_STATUS = "PENDING";

interface TaskOutput {
  name: string;
  url: string;
}

type OutputApiEntry = string | { name?: string; url?: string };

interface TaskItem {
  taskId: string;
  status: string;
  message: string | null;
  outputs: TaskOutput[];
  outputsError: string | null;
  downloadUrl: string | null;
  downloadName: string | null;
  lastUpdated: string | null;
  updating: boolean;
  error: string | null;
}

interface StoredTask {
  taskId: string;
  status: string;
  message: string | null;
  outputs: Array<OutputApiEntry | TaskOutput>;
  lastUpdated: string | null;
  downloadUrl?: string | null;
  downloadName?: string | null;
}

function resolveDownloadUrl(raw: string | null | undefined) {
  const trimmed = raw?.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const base = API_BASE.replace(/\/+$/, "");
  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${base}${path}`;
}

function extractNameFromPath(path: string) {
  const sanitized = path.split(/[?#]/)[0] ?? path;
  const segments = sanitized.split("/").filter(Boolean);
  return segments[segments.length - 1] || sanitized || path || "下载文件";
}

function normalizeOutputs(
  entriesOrPayload?:
    | OutputApiEntry[]
    | Pick<TaskOutputsResponse, "files" | "file_entries">
): TaskOutput[] {
  if (!entriesOrPayload) return [];

  const rawEntries: OutputApiEntry[] = [];
  if (Array.isArray(entriesOrPayload)) {
    rawEntries.push(...entriesOrPayload);
  } else {
    if (Array.isArray(entriesOrPayload.files)) {
      rawEntries.push(...entriesOrPayload.files);
    }
    if (Array.isArray(entriesOrPayload.file_entries)) {
      rawEntries.push(...entriesOrPayload.file_entries);
    }
  }

  if (rawEntries.length === 0) return [];

  const seen = new Set<string>();
  const outputs: TaskOutput[] = [];

  rawEntries.forEach((entry) => {
    let item: TaskOutput | null = null;

    if (typeof entry === "string") {
      const url = resolveDownloadUrl(entry);
      const name = extractNameFromPath(entry);
      if (url) {
        item = { name, url };
      }
    } else if (entry && typeof entry === "object") {
      const obj = entry as { name?: unknown; url?: unknown };
      const rawUrl = typeof obj.url === "string" ? obj.url : "";
      const rawName = typeof obj.name === "string" ? obj.name : "";
      const url = resolveDownloadUrl(rawUrl || rawName);
      const name = rawName || extractNameFromPath(rawUrl || rawName);
      if (url) {
        item = { name, url };
      }
    }

    if (item) {
      const key = `${item.name}|${item.url}`;
      if (!seen.has(key)) {
        seen.add(key);
        outputs.push(item);
      }
    }
  });

  return outputs;
}

function mergeTaskData(task: TaskItem, updates: Partial<TaskItem>): TaskItem {
  const next = { ...task } as TaskItem;
  (Object.keys(updates) as (keyof TaskItem)[]).forEach((key) => {
    const value = updates[key];
    if (value !== undefined) {
      ((next as unknown) as Record<string, unknown>)[key as string] = value;
    }
  });
  return next;
}

function formatTimestamp(iso: string | null) {
  if (!iso) return "尚未更新";
  return new Date(iso).toLocaleString();
}

export default function UploadForm() {
  const [profileName, setProfileName] = useState("");
  const [version, setVersion] = useState("");
  const [jobName, setJobName] = useState("");
  const [masterFile, setMasterFile] = useState<File | null>(null);
  const [includeFiles, setIncludeFiles] = useState<FileList | null>(null);
  const [projectDir, setProjectDir] = useState("");

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [activeTaskId, setActiveTaskId] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lookupId, setLookupId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const includeInputRef = useCallback((node: HTMLInputElement | null) => {
    if (!node) return;
    node.setAttribute("webkitdirectory", "true");
    node.setAttribute("directory", "true");
  }, []);

  const masterFileLabel = masterFile?.name ?? "";
  const includeFolderLabel = useMemo(() => {
    if (!includeFiles || includeFiles.length === 0) return "";
    const first = includeFiles[0] as File & {
      webkitRelativePath?: string;
    };
    const relativePath = first?.webkitRelativePath ?? "";
    if (relativePath) {
      const topLevel = relativePath.split(/[\\/]/)[0];
      if (topLevel) return topLevel;
      return relativePath;
    }
    return `${includeFiles.length} 个文件`;
  }, [includeFiles]);
  const includeFilesCount = includeFiles?.length ?? 0;

  const isPolling = useMemo(() => {
    if (!autoRefresh) return false;
    return tasks.some((task) => !TERMINAL_STATUSES.has(task.status));
  }, [tasks, autoRefresh]);

  const upsertTask = useCallback((taskId: string, updates: Partial<TaskItem> = {}) => {
    const trimmed = taskId.trim();
    if (!trimmed) return;
    setTasks((prev) => {
      const index = prev.findIndex((task) => task.taskId === trimmed);
      if (index === -1) {
        const base: TaskItem = {
          taskId: trimmed,
          status: DEFAULT_STATUS,
          message: null,
          outputs: [],
          outputsError: null,
          downloadUrl: null,
          downloadName: null,
          lastUpdated: null,
          updating: false,
          error: null,
        };
        const merged = mergeTaskData(base, updates);
        return [merged, ...prev];
      }
      const next = [...prev];
      next[index] = mergeTaskData(next[index], updates);
      return next;
    });
  }, []);

  const refreshTaskStatus = useCallback(
    async (taskId: string) => {
      const trimmed = taskId.trim();
      if (!trimmed) return;

      upsertTask(trimmed, { updating: true, error: null, outputsError: null });

      try {
        const result = await getTaskStatus(trimmed);
        let outputs: TaskOutput[] = [];
        let outputsError: string | null = null;
        let downloadUrl: string | null = null;
        let downloadName: string | null = null;

        const statusDownloadUrl = resolveDownloadUrl(result.download_url);
        if (statusDownloadUrl) {
          downloadUrl = statusDownloadUrl;
          downloadName =
            result.download_name ?? extractNameFromPath(statusDownloadUrl);
        }

        if (result.status === "SUCCESS") {
          try {
            const output = await listOutputs(trimmed);
            outputs = normalizeOutputs(output);
            const outputDownloadUrl = resolveDownloadUrl(
              output.download_url ?? result.download_url
            );
            if (outputDownloadUrl) {
              downloadUrl = outputDownloadUrl;
              downloadName =
                output.download_name ??
                result.download_name ??
                extractNameFromPath(outputDownloadUrl);
            }
          } catch (err) {
            outputs = [];
            outputsError =
              err instanceof Error ? err.message : "输出文件获取失败";
          }
        }

        upsertTask(trimmed, {
          status: result.status || DEFAULT_STATUS,
          message: result.message ?? null,
          outputs,
          outputsError,
          downloadUrl,
          downloadName,
          lastUpdated: new Date().toISOString(),
          updating: false,
          error: null,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "获取任务状态失败";
        upsertTask(trimmed, {
          updating: false,
          error: message,
          lastUpdated: new Date().toISOString(),
        });
      }
    },
    [upsertTask]
  );

  const handleRemoveTask = useCallback(
    (taskId: string) => {
      setTasks((prev) => {
        const next = prev.filter((task) => task.taskId !== taskId);
        if (prev.length !== next.length && activeTaskId === taskId) {
          const nextActive = next[0]?.taskId ?? "";
          setActiveTaskId(nextActive);
          setLookupId(nextActive);
        }
        return next;
      });
    },
    [activeTaskId]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoredTask[];
      if (!Array.isArray(parsed)) return;

      const restored = parsed.map<TaskItem>((item) => {
        const outputs = Array.isArray(item.outputs)
          ? normalizeOutputs(item.outputs as OutputApiEntry[])
          : [];
        const legacy = item as Record<string, unknown>;
        const rawDownloadUrl =
          (typeof item.downloadUrl === "string" && item.downloadUrl)
            ? item.downloadUrl
            : (typeof legacy.download_url === "string"
                ? (legacy.download_url as string)
                : "");
        const resolvedDownloadUrl = resolveDownloadUrl(rawDownloadUrl);
        const downloadName =
          (typeof item.downloadName === "string" && item.downloadName)
            ? item.downloadName
            : (typeof legacy.download_name === "string"
                ? (legacy.download_name as string)
                : (resolvedDownloadUrl
                    ? extractNameFromPath(resolvedDownloadUrl)
                    : null));

        return {
          taskId: item.taskId,
          status: item.status || DEFAULT_STATUS,
          message: item.message ?? null,
          outputs,
          outputsError: null,
          downloadUrl: resolvedDownloadUrl || null,
          downloadName: downloadName ?? null,
          lastUpdated: item.lastUpdated ?? null,
          updating: false,
          error: null,
        };
      });

      setTasks(restored);
      if (restored[0]) {
        setActiveTaskId(restored[0].taskId);
        setLookupId(restored[0].taskId);
      }
    } catch (error) {
      console.error("加载任务历史失败", error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload: StoredTask[] = tasks.map((task) => ({
      taskId: task.taskId,
      status: task.status,
      message: task.message,
      outputs: task.outputs,
      lastUpdated: task.lastUpdated,
      downloadUrl: task.downloadUrl,
      downloadName: task.downloadName,
    }));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [tasks]);

  useEffect(() => {
    if (!autoRefresh) return;
    const pendingIds = tasks
      .filter((task) => !TERMINAL_STATUSES.has(task.status))
      .map((task) => task.taskId);
    if (pendingIds.length === 0) return;

    const timer = window.setInterval(() => {
      pendingIds.forEach((id) => {
        void refreshTaskStatus(id);
      });
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [tasks, autoRefresh, refreshTaskStatus]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    if (!masterFile) {
      setFormError("请上传 Master File 文件");
      return;
    }

    const formData = new FormData();
    formData.append("profile_name", profileName.trim());
    formData.append("version", version.trim());
    formData.append("job_name", jobName.trim());
    formData.append("master_file", masterFile, masterFile.name);

    if (includeFiles && includeFiles.length > 0) {
      Array.from(includeFiles).forEach((file) => {
        const withPath = file as File & { webkitRelativePath?: string };
        const relativePath = withPath.webkitRelativePath;
        formData.append(
          "include_files",
          file,
          relativePath && relativePath.length > 0 ? relativePath : file.name
        );
      });
    }

    const projectDirValue = projectDir.trim();
    if (projectDirValue) {
      formData.append("project_dir", projectDirValue);
    }

    setLoading(true);
    try {
      const result: CreateTaskResponse = await createTask(formData);
      const newTaskId = result.task_id;
      setActiveTaskId(newTaskId);
      setLookupId(newTaskId);

      upsertTask(newTaskId, {
        status: result.status || DEFAULT_STATUS,
        message: result.message ?? null,
        outputs: [],
        outputsError: null,
        downloadUrl: null,
        downloadName: null,
        lastUpdated: new Date().toISOString(),
      });

      await refreshTaskStatus(newTaskId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "提交任务失败";
      setFormError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleLookup = async () => {
    const id = lookupId.trim();
    if (!id) return;
    setActiveTaskId(id);
    upsertTask(id, {
      outputs: [],
      outputsError: null,
      error: null,
      downloadUrl: null,
      downloadName: null,
    });
    await refreshTaskStatus(id);
  };

  const getStatusClass = (status: string) =>
    STATUS_STYLE[status] || "bg-gray-200 text-gray-800";

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <form
        onSubmit={onSubmit}
        className="bg-white shadow-lg rounded-xl p-8 space-y-6"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800">提交 SPEOS 任务</h2>
          {loading && <span className="text-sm text-gray-500">任务提交中...</span>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Profile Name
          </label>
          <input
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
            className="border rounded-md px-3 py-2 w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Version
          </label>
          <input
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            className="border rounded-md px-3 py-2 w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Job Name
          </label>
          <input
            value={jobName}
            onChange={(e) => setJobName(e.target.value)}
            className="border rounded-md px-3 py-2 w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Master File 文件（必选）
          </label>
          <input
            type="file"
            onClick={(e) => {
              (e.target as HTMLInputElement).value = "";
            }}
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              setMasterFile(file);
            }}
            className="border rounded-md px-3 py-2 w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          {masterFileLabel && (
            <p className="mt-1 text-xs text-gray-500">已选择：{masterFileLabel}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Include Files 文件夹（可选）
          </label>
          <input
            type="file"
            multiple
            ref={includeInputRef}
            onClick={(e) => {
              (e.target as HTMLInputElement).value = "";
            }}
            onChange={(e) => {
              const files = e.target.files;
              setIncludeFiles(files && files.length > 0 ? files : null);
            }}
            className="border rounded-md px-3 py-2 w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          {includeFilesCount > 0 && (
            <p className="mt-1 text-xs text-gray-500">
              {includeFolderLabel
                ? `已选择文件夹：${includeFolderLabel}（共 ${includeFilesCount} 个文件）`
                : `已选择 ${includeFilesCount} 个文件`}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-400">
            如需上传 Include 文件夹，请选择文件夹，系统会上传其中的所有文件与子目录。
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Project Directory 输出目录（可选）
          </label>
          <input
            type="text"
            value={projectDir}
            onChange={(e) => setProjectDir(e.target.value)}
            placeholder="留空将使用服务端任务文件夹"
            className="border rounded-md px-3 py-2 w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        {formError && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </div>
        )}

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-md shadow disabled:opacity-50"
          >
            {loading ? "提交中..." : "提交任务"}
          </button>

          <p className="text-xs text-gray-500">
            支持重复提交多个任务，任务将记录在历史列表中并自动轮询状态。
          </p>
        </div>
      </form>

      <div className="bg-white shadow-lg rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">任务列表与历史记录</h3>
            <p className="text-sm text-gray-500">
              所有提交或查询过的任务都会保存在本地浏览器，可随时刷新状态或查看输出。
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              自动刷新
            </label>
            {isPolling && <span className="text-xs text-blue-600">轮询中...</span>}
          </div>
        </div>

        {tasks.length === 0 ? (
          <p className="text-sm text-gray-500">
            暂无任务记录，提交任务或通过下方输入任务 ID 来查看历史任务。
          </p>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => (
              <div
                key={task.taskId}
                className={`border rounded-lg p-4 transition-colors ${
                  task.taskId === activeTaskId
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 bg-white"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-semibold text-gray-800">
                        任务 ID：<span className="font-mono">{task.taskId}</span>
                      </h4>
                      <span
                        className={`px-2 py-1 rounded-md text-xs font-medium ${getStatusClass(
                          task.status
                        )}`}
                      >
                        {task.status || DEFAULT_STATUS}
                      </span>
                      {task.updating && (
                        <span className="text-xs text-gray-500">更新中...</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      最后更新时间：{formatTimestamp(task.lastUpdated)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <button
                      onClick={() => {
                        setActiveTaskId(task.taskId);
                        setLookupId(task.taskId);
                        void refreshTaskStatus(task.taskId);
                      }}
                      className="border px-3 py-1 rounded-md hover:bg-gray-100"
                    >
                      刷新状态
                    </button>
                    <button
                      onClick={() => {
                        setActiveTaskId(task.taskId);
                        setLookupId(task.taskId);
                      }}
                      className="border px-3 py-1 rounded-md hover:bg-gray-100"
                    >
                      设为当前
                    </button>
                    <button
                      onClick={() => handleRemoveTask(task.taskId)}
                      className="border px-3 py-1 rounded-md hover:bg-red-50 text-red-600"
                    >
                      移除
                    </button>
                  </div>
                </div>

                {task.message && (
                  <p className="mt-2 text-sm text-gray-700 break-words">
                    {task.message}
                  </p>
                )}

                {task.error && (
                  <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                    {task.error}
                  </div>
                )}

                {task.outputsError && !task.error && (
                  <div className="mt-3 rounded-md bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
                    {task.outputsError}
                  </div>
                )}

                {task.downloadUrl && !task.error && (
                  <div className="mt-3">
                    <a
                      href={task.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      下载结果压缩包
                      <span className="text-xs text-gray-500">
                        {task.downloadName || extractNameFromPath(task.downloadUrl)}
                      </span>
                    </a>
                  </div>
                )}

                {task.outputs.length > 0 && (
                  <div className="mt-3">
                    <h5 className="text-sm font-semibold text-gray-700 mb-1">
                      输出文件
                    </h5>
                    <ul className="list-disc pl-6 space-y-1 text-sm text-gray-800">
                      {task.outputs.map((file) => (
                        <li
                          key={`${task.taskId}-${file.url}`}
                          className="break-all"
                        >
                          <a
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            download
                            className="text-blue-600 hover:text-blue-700 hover:underline"
                          >
                            {file.name}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white shadow-lg rounded-xl p-6 space-y-3">
        <h3 className="text-lg font-semibold text-gray-800">查找已有任务</h3>
        <p className="text-sm text-gray-500">
          输入任务 ID 以重新加载任务状态，方便刷新页面后继续追踪任务。
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={lookupId}
            onChange={(e) => setLookupId(e.target.value)}
            placeholder="输入任务 ID"
            className="flex-1 border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          <button
            onClick={() => void handleLookup()}
            className="bg-gray-800 text-white px-4 py-2 rounded-md hover:bg-gray-900"
          >
            查看任务
          </button>
        </div>
      </div>
    </div>
  );
}

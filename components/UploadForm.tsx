"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createTask, type CreateTaskResponse } from "../lib/api";
import JSZip from "jszip";

const FORM_STATE_KEY = "speos_task_form_state";

interface StoredFormState {
  profileName: string;
  version: string;
  jobName: string;
  projectDir: string;
  useGpu?: boolean;
  simulationIndex?: string;
  threadCount?: string;
  priority?: string;
  rayCount?: string;
  durationMinutes?: string;
  hpcJobName?: string;
  nodeCount?: string;
  walltimeHours?: string;
}

const DEFAULT_FORM_STATE: StoredFormState = {
  profileName: "",
  version: "",
  jobName: "",
  projectDir: "",
  useGpu: false,
  simulationIndex: "0",
  threadCount: "",
  priority: "2",
  rayCount: "",
  durationMinutes: "",
  hpcJobName: "",
  nodeCount: "1",
  walltimeHours: "",
};

function loadFormState(): StoredFormState {
  if (typeof window === "undefined") {
    return { ...DEFAULT_FORM_STATE };
  }

  try {
    const raw = window.localStorage.getItem(FORM_STATE_KEY);
    if (!raw) {
      return { ...DEFAULT_FORM_STATE };
    }

    const parsed = JSON.parse(raw) as Partial<StoredFormState>;
    return {
      ...DEFAULT_FORM_STATE,
      ...parsed,
    };
  } catch (error) {
    console.warn("恢复表单状态失败", error);
    return { ...DEFAULT_FORM_STATE };
  }
}

function saveFormState(state: StoredFormState) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(FORM_STATE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("保存表单状态失败", error);
  }
}

const PRIORITY_OPTIONS = [
  { value: "0", label: "0 - 最低" },
  { value: "1", label: "1 - 较低" },
  { value: "2", label: "2 - 正常" },
  { value: "3", label: "3 - 较高" },
  { value: "4", label: "4 - 高" },
  { value: "5", label: "5 - 实时" },
];

export default function UploadForm() {
  const initialState = useMemo(() => loadFormState(), []);
  const [profileName, setProfileName] = useState(initialState.profileName);
  const [version, setVersion] = useState(initialState.version);
  const [jobName, setJobName] = useState(initialState.jobName);
  const [projectDir, setProjectDir] = useState(initialState.projectDir);

  const [useGpu, setUseGpu] = useState(Boolean(initialState.useGpu));
  const [simulationIndex, setSimulationIndex] = useState(initialState.simulationIndex ?? "0");
  const [threadCount, setThreadCount] = useState(initialState.threadCount ?? "");
  const [priority, setPriority] = useState(initialState.priority ?? "2");
  const [rayCount, setRayCount] = useState(initialState.rayCount ?? "");
  const [durationMinutes, setDurationMinutes] = useState(initialState.durationMinutes ?? "");
  const [hpcJobName, setHpcJobName] = useState(initialState.hpcJobName ?? "");
  const [nodeCount, setNodeCount] = useState(initialState.nodeCount ?? "1");
  const [walltimeHours, setWalltimeHours] = useState(initialState.walltimeHours ?? "");

  const [showAdvanced, setShowAdvanced] = useState(() => {
    return (
      Boolean(initialState.useGpu) ||
      Boolean(initialState.simulationIndex && initialState.simulationIndex !== "0") ||
      Boolean(initialState.threadCount) ||
      Boolean(initialState.priority && initialState.priority !== "2") ||
      Boolean(initialState.rayCount) ||
      Boolean(initialState.durationMinutes) ||
      Boolean(initialState.hpcJobName) ||
      Boolean(initialState.nodeCount && initialState.nodeCount !== "1") ||
      Boolean(initialState.walltimeHours)
    );
  });

  const [masterFile, setMasterFile] = useState<File | null>(null);
  const [includeFiles, setIncludeFiles] = useState<FileList | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitInfo, setSubmitInfo] = useState<{
    taskId: string;
    status?: string;
    message?: string | null;
  } | null>(null);

  const masterInputRef = useRef<HTMLInputElement | null>(null);
  const includeDirectoryInputRef = useRef<HTMLInputElement | null>(null);

  const includeDirectoryRef = useCallback((node: HTMLInputElement | null) => {
    includeDirectoryInputRef.current = node;
    if (!node) return;
    node.setAttribute("webkitdirectory", "true");
    node.setAttribute("directory", "true");
  }, []);

  const resetForm = useCallback(() => {
    setProfileName(DEFAULT_FORM_STATE.profileName);
    setVersion(DEFAULT_FORM_STATE.version);
    setJobName(DEFAULT_FORM_STATE.jobName);
    setProjectDir(DEFAULT_FORM_STATE.projectDir);
    setUseGpu(Boolean(DEFAULT_FORM_STATE.useGpu));
    setSimulationIndex(DEFAULT_FORM_STATE.simulationIndex ?? "0");
    setThreadCount(DEFAULT_FORM_STATE.threadCount ?? "");
    setPriority(DEFAULT_FORM_STATE.priority ?? "2");
    setRayCount(DEFAULT_FORM_STATE.rayCount ?? "");
    setDurationMinutes(DEFAULT_FORM_STATE.durationMinutes ?? "");
    setHpcJobName(DEFAULT_FORM_STATE.hpcJobName ?? "");
    setNodeCount(DEFAULT_FORM_STATE.nodeCount ?? "1");
    setWalltimeHours(DEFAULT_FORM_STATE.walltimeHours ?? "");
    setMasterFile(null);
    setIncludeFiles(null);
    setShowAdvanced(false);
    if (masterInputRef.current) {
      masterInputRef.current.value = "";
    }
    if (includeDirectoryInputRef.current) {
      includeDirectoryInputRef.current.value = "";
    }
    saveFormState({ ...DEFAULT_FORM_STATE });
  }, []);

  useEffect(() => {
    saveFormState({
      profileName,
      version,
      jobName,
      projectDir,
      useGpu,
      simulationIndex,
      threadCount,
      priority,
      rayCount,
      durationMinutes,
      hpcJobName,
      nodeCount,
      walltimeHours,
    });
  }, [
    profileName,
    version,
    jobName,
    projectDir,
    useGpu,
    simulationIndex,
    threadCount,
    priority,
    rayCount,
    durationMinutes,
    hpcJobName,
    nodeCount,
    walltimeHours,
  ]);

  const includeFilesArray = useMemo(() => {
    if (!includeFiles || includeFiles.length === 0) return [] as (File & { webkitRelativePath?: string })[];
    return Array.from(includeFiles) as (File & { webkitRelativePath?: string })[];
  }, [includeFiles]);

  const filteredIncludeFiles = useMemo(() => {
    if (!masterFile) return includeFilesArray;
    return includeFilesArray.filter((file) => {
      const sameName = file.name === masterFile.name;
      const sameSize = file.size === masterFile.size;
      const sameModified = file.lastModified === masterFile.lastModified;
      if (sameName && sameSize && sameModified) {
        return false;
      }
      const relativePath = file.webkitRelativePath ?? "";
      if (relativePath) {
        const tail = relativePath.split(/[\\/]/).pop();
        if (tail && tail === masterFile.name && sameSize) {
          return false;
        }
      }
      return true;
    });
  }, [includeFilesArray, masterFile]);

  const includeFolderLabel = useMemo(() => {
    if (filteredIncludeFiles.length === 0) return "";
    const first = filteredIncludeFiles[0];
    const relativePath = first?.webkitRelativePath ?? "";
    if (!relativePath) return "";
    const topLevel = relativePath.split(/[\\/]/)[0];
    return topLevel || relativePath;
  }, [filteredIncludeFiles]);

  const includeFilesCount = filteredIncludeFiles.length;
  const masterFileLabel = masterFile?.name ?? "";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setSubmitInfo(null);

    if (!masterFile) {
      setFormError("请上传 Master File 文件");
      return;
    }

    const formData = new FormData();
    formData.append("profile_name", profileName.trim());
    formData.append("version", version.trim());
    formData.append("job_name", jobName.trim());
    formData.append("master_file", masterFile, masterFile.name);

    if (filteredIncludeFiles.length > 0) {
      const zip = new JSZip();
      filteredIncludeFiles.forEach((file) => {
        const relPath = file.webkitRelativePath || file.name;
        zip.file(relPath, file);
      });
    
      const content = await zip.generateAsync({ type: "blob" });
      const zipName = `${includeFolderLabel || "include"}.zip`;
      formData.append("include_archive", content, zipName);
      formData.append("include_path", includeFolderLabel || "include");
    }

    const projectDirValue = projectDir.trim();
    if (projectDirValue) {
      formData.append("project_dir", projectDirValue);
    }

    if (useGpu) {
      formData.append("use_gpu", "true");
    }

    const trimmedSimulation = simulationIndex.trim();
    if (trimmedSimulation) {
      formData.append("simulation_index", trimmedSimulation);
    }

    const trimmedThreads = threadCount.trim();
    if (trimmedThreads) {
      formData.append("thread_count", trimmedThreads);
    }

    const trimmedPriority = priority.trim();
    if (trimmedPriority) {
      formData.append("priority", trimmedPriority);
    }

    const trimmedRays = rayCount.trim();
    if (trimmedRays) {
      formData.append("ray_count", trimmedRays);
    }

    const trimmedDuration = durationMinutes.trim();
    if (trimmedDuration) {
      formData.append("duration_minutes", trimmedDuration);
    }

    const trimmedJobName = hpcJobName.trim();
    if (trimmedJobName) {
      formData.append("hpc_job_name", trimmedJobName);
    }

    const trimmedNodes = nodeCount.trim();
    if (trimmedNodes) {
      formData.append("node_count", trimmedNodes);
    }

    const trimmedWalltime = walltimeHours.trim();
    if (trimmedWalltime) {
      formData.append("walltime_hours", trimmedWalltime);
    }

    setSubmitting(true);
    try {
      const result: CreateTaskResponse = await createTask(formData);
      setSubmitInfo({
        taskId: result.task_id,
        status: result.status,
        message: result.message ?? null,
      });
      resetForm();
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("speos-task-created", {
            detail: { taskId: result.task_id },
          })
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "提交任务失败";
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="flex h-full flex-col gap-6 rounded-2xl bg-white p-6 shadow-lg ring-1 ring-black/5">
      <header className="space-y-1">
        <h2 className="text-2xl font-semibold text-slate-900">提交 SPEOS 任务</h2>
        <p className="text-sm text-slate-500">
          填写任务信息并上传 Master File（必选）与 Include 文件夹（可选），提交后任务会自动出现在右侧列表中。
        </p>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5 overflow-auto pr-1">
        <div className="grid gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Profile Name</label>
            <input
              value={profileName}
              onChange={(event) => setProfileName(event.target.value)}
              className="w-full rounded-md border px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Version</label>
            <input
              value={version}
              onChange={(event) => setVersion(event.target.value)}
              className="w-full rounded-md border px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Job Name</label>
            <input
              value={jobName}
              onChange={(event) => setJobName(event.target.value)}
              className="w-full rounded-md border px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Master File 文件（必选）</label>
            <input
              ref={masterInputRef}
              type="file"
              onClick={(event) => {
                (event.target as HTMLInputElement).value = "";
              }}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setMasterFile(file);
              }}
              className="w-full rounded-md border px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
            {masterFileLabel && (
              <p className="mt-1 text-xs text-gray-500">已选择：{masterFileLabel}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Include Files 文件夹（可选）</label>
            <input
              ref={includeDirectoryRef}
              type="file"
              multiple
              onClick={(event) => {
                (event.target as HTMLInputElement).value = "";
              }}
              onChange={(event) => {
                const files = event.target.files;
                setIncludeFiles(files && files.length > 0 ? files : null);
              }}
              className="w-full rounded-md border px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
            {includeFilesCount > 0 && (
              <p className="mt-1 text-xs text-gray-500">
                {includeFolderLabel
                  ? `已选择文件夹：${includeFolderLabel}（共 ${includeFilesCount} 个文件）`
                  : `已选择 ${includeFilesCount} 个文件`}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-400">
              建议使用文件夹上传方式，系统会上传其中的全部文件与子目录。
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Project Directory 输出目录（可选）</label>
            <input
              value={projectDir}
              onChange={(event) => setProjectDir(event.target.value)}
              placeholder="留空将使用服务器端任务文件夹"
              className="w-full rounded-md border px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="space-y-3 rounded-xl bg-slate-50 p-4">
          <button
            type="button"
            onClick={() => setShowAdvanced((prev) => !prev)}
            className="flex w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            <span>高级配置</span>
            <span>{showAdvanced ? "收起" : "展开"}</span>
          </button>

          {showAdvanced && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-slate-700">使用 GPU 求解器 (-G)</p>
                  <p className="text-xs text-slate-500">启用后将以 GPU 模式运行。</p>
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={useGpu}
                    onChange={(event) => setUseGpu(event.target.checked)}
                  />
                  启用
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Simulation 序号 (-S)</label>
                  <input
                    type="number"
                    min={0}
                    value={simulationIndex}
                    onChange={(event) => setSimulationIndex(event.target.value)}
                    className="w-full rounded-md border px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">线程数 (-t)</label>
                  <input
                    type="number"
                    min={1}
                    value={threadCount}
                    onChange={(event) => setThreadCount(event.target.value)}
                    placeholder="自动"
                    className="w-full rounded-md border px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">进程优先级 (-p)</label>
                  <select
                    value={priority}
                    onChange={(event) => setPriority(event.target.value)}
                    className="w-full rounded-md border px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  >
                    {PRIORITY_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">光线/Pass 数 (-r)</label>
                  <input
                    type="number"
                    min={1}
                    value={rayCount}
                    onChange={(event) => setRayCount(event.target.value)}
                    placeholder="使用默认"
                    className="w-full rounded-md border px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">运行时长限制 (分钟, -D)</label>
                  <input
                    type="number"
                    min={1}
                    value={durationMinutes}
                    onChange={(event) => setDurationMinutes(event.target.value)}
                    placeholder="不限"
                    className="w-full rounded-md border px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">HPC Job 名称 (-J)</label>
                  <input
                    value={hpcJobName}
                    onChange={(event) => setHpcJobName(event.target.value)}
                    placeholder="可选"
                    className="w-full rounded-md border px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">HPC 节点数 (-N)</label>
                  <input
                    type="number"
                    min={1}
                    value={nodeCount}
                    onChange={(event) => setNodeCount(event.target.value)}
                    className="w-full rounded-md border px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">HPC walltime (小时, -W)</label>
                  <input
                    type="number"
                    min={1}
                    step={0.5}
                    value={walltimeHours}
                    onChange={(event) => setWalltimeHours(event.target.value)}
                    placeholder="可选"
                    className="w-full rounded-md border px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {formError && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>
        )}

        {submitInfo && !formError && (
          <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            <p>
              任务提交成功，任务 ID：
              <span className="font-mono">{submitInfo.taskId}</span>
              {submitInfo.status && <span className="ml-2">当前状态：{submitInfo.status}</span>}
            </p>
            {submitInfo.message && <p className="mt-1 text-xs text-green-600">{submitInfo.message}</p>}
            <p className="mt-1 text-xs text-green-600">可在右侧任务列表中查看进度并下载结果。</p>
          </div>
        )}

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-blue-600 px-6 py-2 font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "提交中..." : "提交任务"}
          </button>
        </div>
      </form>
    </section>
  );
}


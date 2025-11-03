"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createTask,
  initUpload,
  uploadToTOS,
  confirmUpload,
  formatSpeed,
  formatTime,
  formatFileSize,
  type CreateTaskResponse,
  type UploadProgressInfo,
} from "../lib/api";
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

  // TOS 上传相关状态
  const [uploadStep, setUploadStep] = useState<string>("");
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [masterProgress, setMasterProgress] = useState<number>(0);
  const [includeProgress, setIncludeProgress] = useState<number>(0);
  const [uploadSpeed, setUploadSpeed] = useState<number>(0);
  const [estimatedTime, setEstimatedTime] = useState<number>(0);
  
  // 取消上传控制器
  const abortControllerRef = useRef<AbortController | null>(null);

  // 上传历史记录
  interface UploadHistoryItem {
    id: string;
    jobName: string;
    fileName: string;
    fileSize: number;
    status: "uploading" | "success" | "failed" | "cancelled";
    progress: number;
    taskId?: string;
    timestamp: number;
    errorMessage?: string;
  }

  const [uploadHistory, setUploadHistory] = useState<UploadHistoryItem[]>([]);
  const currentUploadIdRef = useRef<string | null>(null);

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

  // 同步当前上传进度到历史记录
  useEffect(() => {
    if (currentUploadIdRef.current && uploadProgress > 0 && uploadProgress < 100) {
      setUploadHistory((prev) =>
        prev.map((item) =>
          item.id === currentUploadIdRef.current && item.status === "uploading"
            ? { ...item, progress: uploadProgress }
            : item
        )
      );
    }
  }, [uploadProgress]);

  const handleCancelUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    // 更新历史记录为已取消
    if (currentUploadIdRef.current) {
      setUploadHistory((prev) =>
        prev.map((item) =>
          item.id === currentUploadIdRef.current
            ? { ...item, status: "cancelled" as const, progress: uploadProgress }
            : item
        )
      );
    }
    
    setSubmitting(false);
    setUploadStep("");
    setUploadProgress(0);
    setMasterProgress(0);
    setIncludeProgress(0);
    setUploadSpeed(0);
    setEstimatedTime(0);
    currentUploadIdRef.current = null;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setSubmitInfo(null);
    setUploadStep("");
    setUploadProgress(0);
    setMasterProgress(0);
    setIncludeProgress(0);
    setUploadSpeed(0);
    setEstimatedTime(0);

    if (!masterFile) {
      setFormError("请上传 Master File 文件");
      return;
    }
    
    // 创建上传记录
    const uploadId = `upload_${Date.now()}`;
    currentUploadIdRef.current = uploadId;
    
    const newHistoryItem: UploadHistoryItem = {
      id: uploadId,
      jobName: jobName.trim(),
      fileName: masterFile.name,
      fileSize: masterFile.size,
      status: "uploading",
      progress: 0,
      timestamp: Date.now(),
    };
    
    setUploadHistory((prev) => [newHistoryItem, ...prev].slice(0, 5)); // 只保留最近5条
    
    // 创建新的 AbortController
    abortControllerRef.current = new AbortController();

    // 准备 include 文件（如果有）
    let includeZip: Blob | null = null;
    if (filteredIncludeFiles.length > 0) {
      const zip = new JSZip();
      filteredIncludeFiles.forEach((file) => {
        const relPath = file.webkitRelativePath || file.name;
        zip.file(relPath, file);
      });
      includeZip = await zip.generateAsync({ type: "blob" });
    }

    // 文件大小阈值：50MB
    const FILE_SIZE_THRESHOLD = 50 * 1024 * 1024;
    const masterFileSize = masterFile.size;
    const includeFileSize = includeZip?.size || 0;
    const totalSize = masterFileSize + includeFileSize;

    // 判断是否使用新流程
    const useNewFlow = totalSize >= FILE_SIZE_THRESHOLD;

    // 大文件警告（100MB 以上）
    if (totalSize > 100 * 1024 * 1024) {
      const sizeInMB = Math.round(totalSize / 1024 / 1024);
      const confirmed = window.confirm(
        `文件较大（${sizeInMB} MB），上传可能需要较长时间，是否继续？`
      );
      if (!confirmed) {
        return;
      }
    }

    setSubmitting(true);

    try {
      if (useNewFlow) {
        // ========== 新流程：TOS 三步上传 ==========
        await handleNewFlowUpload(masterFile, includeZip);
      } else {
        // ========== 旧流程：直接上传 ==========
        await handleOldFlowUpload(masterFile, includeZip);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "提交任务失败";
      
      // 更新历史记录状态
      if (currentUploadIdRef.current) {
        setUploadHistory((prev) =>
          prev.map((item) =>
            item.id === currentUploadIdRef.current
              ? {
                  ...item,
                  status: message === "上传已取消" ? ("cancelled" as const) : ("failed" as const),
                  progress: uploadProgress,
                  errorMessage: message !== "上传已取消" ? message : undefined,
                }
              : item
          )
        );
      }
      
      // 如果是取消操作，不显示为错误
      if (message !== "上传已取消") {
        setFormError(message);
      }
    } finally {
      setSubmitting(false);
      setUploadStep("");
      setUploadProgress(0);
      setMasterProgress(0);
      setIncludeProgress(0);
      setUploadSpeed(0);
      setEstimatedTime(0);
      abortControllerRef.current = null;
      currentUploadIdRef.current = null;
    }
  };

  // 旧流程：直接上传
  const handleOldFlowUpload = async (
    masterFile: File,
    includeZip: Blob | null
  ) => {
    setUploadStep("正在提交任务...");

    const formData = new FormData();
    formData.append("profile_name", profileName.trim());
    formData.append("version", version.trim());
    formData.append("job_name", jobName.trim());
    formData.append("master_file", masterFile, masterFile.name);

    if (includeZip) {
      const zipName = `${includeFolderLabel || "include"}.zip`;
      formData.append("include_archive", includeZip, zipName);
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

    const result: CreateTaskResponse = await createTask(formData);
    
    // 更新历史记录为成功
    if (currentUploadIdRef.current) {
      setUploadHistory((prev) =>
        prev.map((item) =>
          item.id === currentUploadIdRef.current
            ? { ...item, status: "success" as const, progress: 100, taskId: result.task_id }
            : item
        )
      );
    }
    
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
  };

  // 新流程：TOS 三步上传
  const handleNewFlowUpload = async (
    masterFile: File,
    includeZip: Blob | null
  ) => {
    // 步骤 1: 初始化上传（获取预签名 URL）
    setUploadStep("📝 初始化上传...");
    const initData = await initUpload({
      filename: masterFile.name,
      file_size: masterFile.size,
      file_type: "master",
      content_type: masterFile.type || "application/octet-stream",
      job_name: jobName.trim(),
      submitter: "用户", // 可以根据实际情况修改
    });

    const taskId = initData.task_id;
    const masterUploadInfo = initData.master_upload;

    if (!masterUploadInfo) {
      throw new Error("未获取到 master 文件上传 URL");
    }

    // 步骤 2a: 上传 Master 文件到 TOS
    setUploadStep("⬆️ 上传 Master 文件...");
    await uploadToTOS(
      masterUploadInfo.upload_url,
      masterFile,
      (info: UploadProgressInfo) => {
        setMasterProgress(info.progress);
        setUploadSpeed(info.speed);
        setEstimatedTime(info.estimatedTime);
        if (includeZip) {
          setUploadProgress(Math.round(info.progress * 0.6)); // master 占 60%
        } else {
          setUploadProgress(info.progress);
        }
      },
      abortControllerRef.current?.signal
    );

    // 步骤 2b: 如果有 include 文件，也上传
    let includeObjectKey: string | undefined;
    if (includeZip) {
      setUploadStep("⬆️ 上传 Include 文件...");

      // 初始化 include 上传
      const includeInitData = await initUpload({
        filename: `${includeFolderLabel || "include"}.zip`,
        file_size: includeZip.size,
        file_type: "include",
        content_type: "application/zip",
        job_name: jobName.trim(),
        submitter: "用户",
      });

      const includeUploadInfo = includeInitData.include_upload;
      if (includeUploadInfo) {
        await uploadToTOS(
          includeUploadInfo.upload_url,
          includeZip,
          (info: UploadProgressInfo) => {
            setIncludeProgress(info.progress);
            setUploadSpeed(info.speed);
            setEstimatedTime(info.estimatedTime);
            setUploadProgress(60 + Math.round(info.progress * 0.3)); // include 占 30%
          },
          abortControllerRef.current?.signal
        );
        includeObjectKey = includeUploadInfo.object_key;
      }
    }

    // 步骤 3: 确认上传完成
    setUploadStep("✅ 提交任务...");
    setUploadProgress(90);

    const confirmData = await confirmUpload({
      task_id: taskId,
      master_object_key: masterUploadInfo.object_key,
      include_object_key: includeObjectKey,
      job_name: jobName.trim(),
      submitter: "用户",
      profile_name: profileName.trim(),
      version: version.trim(),
      project_dir: projectDir.trim() || undefined,
      use_gpu: useGpu || undefined,
      simulation_index: simulationIndex.trim() || undefined,
      thread_count: threadCount.trim() || undefined,
      priority: priority.trim() || undefined,
      ray_count: rayCount.trim() || undefined,
      duration_minutes: durationMinutes.trim() || undefined,
      hpc_job_name: hpcJobName.trim() || undefined,
      node_count: nodeCount.trim() || undefined,
      walltime_hours: walltimeHours.trim() || undefined,
    });

    setUploadProgress(100);
    setUploadStep("🎉 完成！");

    // 更新历史记录为成功
    if (currentUploadIdRef.current) {
      setUploadHistory((prev) =>
        prev.map((item) =>
          item.id === currentUploadIdRef.current
            ? { ...item, status: "success" as const, progress: 100, taskId: confirmData.task_id }
            : item
        )
      );
    }

    setSubmitInfo({
      taskId: confirmData.task_id,
      status: confirmData.status,
      message: confirmData.message ?? null,
    });

    resetForm();

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("speos-task-created", {
          detail: { taskId: confirmData.task_id },
        })
      );
    }
  };

  const getStatusColor = (status: UploadHistoryItem["status"]) => {
    switch (status) {
      case "uploading": return "text-blue-700 bg-blue-50";
      case "success": return "text-green-700 bg-green-50";
      case "failed": return "text-red-700 bg-red-50";
      case "cancelled": return "text-gray-700 bg-gray-50";
    }
  };

  const getStatusIcon = (status: UploadHistoryItem["status"]) => {
    switch (status) {
      case "uploading": return "⏳";
      case "success": return "✅";
      case "failed": return "❌";
      case "cancelled": return "🚫";
    }
  };

  const getStatusText = (status: UploadHistoryItem["status"]) => {
    switch (status) {
      case "uploading": return "上传中";
      case "success": return "成功";
      case "failed": return "失败";
      case "cancelled": return "已取消";
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

      {/* 上传历史记录 */}
      {uploadHistory.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50">
          <div className="px-4 py-2 border-b border-slate-200">
            <h3 className="text-sm font-medium text-slate-700">上传历史</h3>
          </div>
          <div className="divide-y divide-slate-200 max-h-48 overflow-y-auto">
            {uploadHistory.map((item) => (
              <div key={item.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900 truncate">
                        {item.jobName || item.fileName}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                        {getStatusIcon(item.status)} {getStatusText(item.status)}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {item.fileName} ({formatFileSize(item.fileSize)})
                      {item.taskId && (
                        <span className="ml-2 font-mono">ID: {item.taskId}</span>
                      )}
                    </div>
                    {item.status === "uploading" && item.progress > 0 && (
                      <div className="mt-2">
                        <div className="h-1 w-full overflow-hidden rounded-full bg-blue-200">
                          <div
                            className="h-full bg-blue-600 transition-all duration-300"
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {item.errorMessage && (
                      <div className="mt-1 text-xs text-red-600">
                        {item.errorMessage}
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-xs text-slate-400">
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

        {/* 上传进度显示 */}
        {submitting && uploadStep && (
          <div className="space-y-3 rounded-md bg-blue-50 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-900">{uploadStep}</span>
              {uploadProgress > 0 && (
                <span className="text-sm font-semibold text-blue-700">{uploadProgress}%</span>
              )}
            </div>

            {uploadProgress > 0 && (
              <div className="h-2 w-full overflow-hidden rounded-full bg-blue-200">
                <div
                  className="h-full bg-blue-600 transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}

            {/* 速度和剩余时间显示 */}
            {uploadSpeed > 0 && uploadProgress < 100 && (
              <div className="flex items-center justify-between text-xs text-blue-700">
                <span>速度: {formatSpeed(uploadSpeed)}</span>
                <span>剩余时间: {formatTime(estimatedTime)}</span>
              </div>
            )}

            {/* 详细进度 */}
            <div className="space-y-1">
              {masterProgress > 0 && masterProgress < 100 && (
                <div className="text-xs text-blue-700">
                  Master 文件: {masterProgress}%
                </div>
              )}

              {includeProgress > 0 && includeProgress < 100 && (
                <div className="text-xs text-blue-700">
                  Include 文件: {includeProgress}%
                </div>
              )}
            </div>

            {/* 取消按钮 */}
            {uploadProgress < 100 && (
              <button
                type="button"
                onClick={handleCancelUpload}
                className="w-full rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                取消上传
              </button>
            )}
          </div>
        )}

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


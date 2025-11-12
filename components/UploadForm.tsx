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
  getUploadConfig,
  submitDirectUpload,
  type CreateTaskResponse,
  type UploadProgressInfo,
  type UploadConfigResponse,
  type DirectUploadParams,
} from "../lib/api";
import {
  uploadFileWithResumable,
  type UploadProgressInfo as ResumableProgressInfo,
} from "../lib/resumableUpload";

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
  const [includeFile, setIncludeFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitInfo, setSubmitInfo] = useState<{
    taskId: string;
    status?: string;
    message?: string | null;
  } | null>(null);

  // 上传模式配置
  const [uploadMode, setUploadMode] = useState<"direct" | "tos" | null>(null);
  const [uploadConfig, setUploadConfig] = useState<UploadConfigResponse | null>(null);
  const [configLoading, setConfigLoading] = useState<boolean>(true);

  // TOS 上传相关状态
  const [uploadStep, setUploadStep] = useState<string>("");
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [masterProgress, setMasterProgress] = useState<number>(0);
  const [includeProgress, setIncludeProgress] = useState<number>(0);
  const [uploadSpeed, setUploadSpeed] = useState<number>(0);
  const [estimatedTime, setEstimatedTime] = useState<number>(0);
  
  // 断点续传相关状态
  const [isResumableUpload, setIsResumableUpload] = useState<boolean>(false);
  const [totalChunks, setTotalChunks] = useState<number>(0);
  const [uploadedChunks, setUploadedChunks] = useState<number>(0);
  const [currentChunk, setCurrentChunk] = useState<number>(0);
  
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

  // 检测未完成的上传（断点续传提示）
  const [pendingUploads, setPendingUploads] = useState<Array<{
    taskId: string;
    filename: string;
    uploadedChunks: number;
    totalChunks: number;
    fileType: string;
  }>>([]);

  const masterInputRef = useRef<HTMLInputElement | null>(null);
  const includeInputRef = useRef<HTMLInputElement | null>(null);

  // 验证Include文件是否为压缩包格式
  const validateIncludeFile = useCallback((file: File): boolean => {
    const allowedExtensions = ['.zip', '.rar', '.7z', '.tar', '.gz', '.tar.gz'];
    const fileName = file.name.toLowerCase();
    
    const isValidArchive = allowedExtensions.some(ext => 
      fileName.endsWith(ext)
    );
    
    if (!isValidArchive) {
      alert(
        `Include文件必须是压缩包格式！\n\n` +
        `支持的格式：${allowedExtensions.join(', ')}\n\n` +
        `请先将include文件夹压缩为.zip文件后再上传。\n\n` +
        `压缩方法：\n` +
        `• Windows：右键文件夹 → "发送到" → "压缩(zipped)文件夹"\n` +
        `• Mac：右键文件夹 → "压缩"`
      );
      return false;
    }
    
    return true;
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
    setIncludeFile(null);
    setShowAdvanced(false);
    if (masterInputRef.current) {
      masterInputRef.current.value = "";
    }
    if (includeInputRef.current) {
      includeInputRef.current.value = "";
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

  const masterFileLabel = masterFile?.name ?? "";
  const includeFileLabel = includeFile?.name ?? "";

  // 获取上传模式配置
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setConfigLoading(true);
        const config = await getUploadConfig();
        setUploadConfig(config);
        setUploadMode(config.upload_mode);
        console.log(`📡 获取上传配置成功: ${config.upload_mode} 模式`);
      } catch (error) {
        console.warn("获取上传配置失败，使用 Direct 模式作为默认", error);
        // 临时方案：如果后端配置接口不可用，默认使用 Direct 模式
        // 因为服务器已配置为 Direct 模式，前端直接使用即可
        setUploadMode("direct");
        setUploadConfig({ 
          upload_mode: "direct",
          max_file_size_mb: 5120  // 默认 5GB
        });
        console.log("✅ 使用默认 Direct 模式（内网直连）");
      } finally {
        setConfigLoading(false);
      }
    };

    fetchConfig();
  }, []);

  // 检查 localStorage 中的未完成上传
  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkPendingUploads = () => {
      const pending: Array<{
        taskId: string;
        filename: string;
        uploadedChunks: number;
        totalChunks: number;
        fileType: string;
      }> = [];

      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("resumable_upload_")) {
          try {
            const data = JSON.parse(localStorage.getItem(key) || "{}");
            if (data.uploaded_parts && data.uploaded_parts.length < data.total_chunks) {
              pending.push({
                taskId: data.task_id,
                filename: data.filename,
                uploadedChunks: data.uploaded_parts.length,
                totalChunks: data.total_chunks,
                fileType: data.file_type,
              });
            }
          } catch (error) {
            console.warn("解析上传进度失败", error);
          }
        }
      });

      setPendingUploads(pending);
    };

    checkPendingUploads();
  }, []);

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

  // Direct 模式上传处理函数
  const handleDirectUpload = async (
    masterFile: File,
    includeArchive: File | null
  ) => {
    setUploadStep("🚀 Direct 模式：直接上传文件到服务器");
    
    try {
      const params: DirectUploadParams = {
        master_file: masterFile,
        include_file: includeArchive || undefined,
        profile_name: profileName.trim(),
        version: version.trim(),
        job_name: jobName.trim(),
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
      };

      const result = await submitDirectUpload(
        params,
        (info: UploadProgressInfo) => {
          setUploadProgress(info.progress);
          setUploadSpeed(info.speed);
          setEstimatedTime(info.estimatedTime);
        },
        abortControllerRef.current?.signal
      );

      setUploadProgress(100);
      setUploadStep("🎉 完成！");

      // 更新历史记录为成功
      const uploadId = currentUploadIdRef.current;
      if (uploadId) {
        setUploadHistory((prev) =>
          prev.map((item) =>
            item.id === uploadId
              ? { ...item, status: "success" as const, progress: 100, taskId: result.task_id }
              : item
          )
        );
        console.log(`✅ Direct 上传成功，任务ID: ${result.task_id}`);
      }

      setSubmitInfo({
        taskId: result.task_id,
        status: result.status,
        message: result.message ?? null,
      });

      // 3秒后自动隐藏成功提示
      setTimeout(() => {
        setSubmitInfo(null);
      }, 3000);

      resetForm();

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("speos-task-created", {
            detail: { taskId: result.task_id },
          })
        );
      }
    } catch (error) {
      console.error("Direct 上传失败", error);
      throw error;
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    // 防止重复提交：如果已经在提交中，直接返回
    if (submitting) {
      console.warn("任务正在提交中，请勿重复提交");
      return;
    }
    
    // 等待配置加载完成
    if (configLoading || uploadMode === null) {
      setFormError("正在加载上传配置，请稍候...");
      return;
    }
    
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

    // 准备 include 文件（如果有）- 现在直接使用用户上传的压缩包
    let includeArchive: File | null = null;
    if (includeFile) {
      // 验证文件格式
      if (!validateIncludeFile(includeFile)) {
        setSubmitting(false);
        currentUploadIdRef.current = null;
        return;
      }
      includeArchive = includeFile;
    }

    const masterFileSize = masterFile.size;
    const includeFileSize = includeArchive?.size || 0;
    const totalSize = masterFileSize + includeFileSize;

    setSubmitting(true);

    try {
      // ========== 根据上传模式选择不同的上传策略 ==========
      if (uploadMode === "direct") {
        // Direct 模式：直接上传到服务器（内网直连）
        console.log("📡 使用 Direct 模式上传（内网直连）");
        await handleDirectUpload(masterFile, includeArchive);
      } else {
        // TOS 模式：上传到对象存储
        console.log("📡 使用 TOS 模式上传（对象存储）");
        
        // 文件大小阈值
        const RESUMABLE_UPLOAD_THRESHOLD = 10 * 1024 * 1024; // 10MB - 断点续传
        
        // 判断使用哪种 TOS 上传方式
        let tosUploadMode: "simple" | "resumable" = "simple";
        
        if (totalSize >= RESUMABLE_UPLOAD_THRESHOLD) {
          tosUploadMode = "resumable"; // >=10MB：使用断点续传
        }

        // 大文件警告（100MB 以上）
        if (totalSize > 100 * 1024 * 1024) {
          const sizeInMB = Math.round(totalSize / 1024 / 1024);
          const confirmed = window.confirm(
            `文件较大（${sizeInMB} MB），将使用断点续传上传，支持暂停恢复。是否继续？`
          );
          if (!confirmed) {
            setSubmitting(false);
            return;
          }
        }

        if (tosUploadMode === "resumable") {
          // 断点续传流程
          await handleResumableUpload(masterFile, includeArchive);
        } else {
          // 简单上传流程
          await handleOldFlowUpload(masterFile, includeArchive);
        }
      }
    } catch (error) {
      let message = "提交任务失败";
      
      if (error instanceof Error) {
        message = error.message;
        
        // 特殊处理include文件格式错误（400错误）
        if (message.includes("Include file must be an archive file") || 
            message.includes("Allowed formats")) {
          message = 
            "❌ Include文件格式错误！\n\n" +
            "Include文件必须是压缩包格式。\n" +
            "支持的格式：.zip, .rar, .7z, .tar, .gz, .tar.gz\n\n" +
            "请先将include文件夹压缩为.zip文件后再上传。\n\n" +
            "压缩方法：\n" +
            "• Windows：右键文件夹 → \"发送到\" → \"压缩(zipped)文件夹\"\n" +
            "• Mac：右键文件夹 → \"压缩\"";
        }
      }
      
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
    includeArchive: File | null
  ) => {
    setUploadStep("正在提交任务...");

    const formData = new FormData();
    formData.append("profile_name", profileName.trim());
    formData.append("version", version.trim());
    formData.append("job_name", jobName.trim());
    formData.append("master_file", masterFile, masterFile.name);

    if (includeArchive) {
      formData.append("include_archive", includeArchive, includeArchive.name);
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
    const uploadId = currentUploadIdRef.current;
    if (uploadId) {
      setUploadHistory((prev) =>
        prev.map((item) =>
          item.id === uploadId
            ? { ...item, status: "success" as const, progress: 100, taskId: result.task_id }
            : item
        )
      );
      console.log(`✅ 上传历史已更新为成功，任务ID: ${result.task_id}, 上传ID: ${uploadId}`);
    }
    
    setSubmitInfo({
      taskId: result.task_id,
      status: result.status,
      message: result.message ?? null,
    });
    
    // 3秒后自动隐藏成功提示，让用户关注任务列表中的实时状态
    setTimeout(() => {
      setSubmitInfo(null);
    }, 3000);
    
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
    includeArchive: File | null
  ) => {
    // 步骤 1: 一次性初始化所有文件的上传（获取预签名 URL）
    // 这样可以防止创建多个任务
    setUploadStep("📝 初始化上传...");
    
    // 先初始化 master 文件
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

    // 如果有 include 文件，使用同一个 task_id 获取 include 的上传 URL
    let includeUploadInfo: { object_key: string; upload_url: string } | undefined;
    if (includeArchive) {
      // 注意：这里使用相同的 job_name 和 task_id 概念
      // 后端应该识别这是同一个任务的 include 文件
      const includeInitData = await initUpload({
        filename: includeArchive.name,
        file_size: includeArchive.size,
        file_type: "include",
        content_type: includeArchive.type || "application/zip",
        job_name: jobName.trim(),
        submitter: "用户",
      });

      // 检查返回的 task_id 是否一致
      if (includeInitData.task_id !== taskId) {
        console.warn(`警告：include 文件返回了不同的 task_id: ${includeInitData.task_id}，预期: ${taskId}`);
        // 这里可能需要清理重复创建的任务
      }

      includeUploadInfo = includeInitData.include_upload;
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
        if (includeArchive) {
          setUploadProgress(Math.round(info.progress * 0.6)); // master 占 60%
        } else {
          setUploadProgress(info.progress);
        }
      },
      abortControllerRef.current?.signal
    );

    // 步骤 2b: 如果有 include 文件，也上传
    let includeObjectKey: string | undefined;
    if (includeArchive && includeUploadInfo) {
      setUploadStep("⬆️ 上传 Include 文件...");
      await uploadToTOS(
        includeUploadInfo.upload_url,
        includeArchive,
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

    // 更新历史记录为成功（使用局部变量保存引用，避免竞态条件）
    const uploadId = currentUploadIdRef.current;
    if (uploadId) {
      setUploadHistory((prev) =>
        prev.map((item) =>
          item.id === uploadId
            ? { ...item, status: "success" as const, progress: 100, taskId: confirmData.task_id }
            : item
        )
      );
      console.log(`✅ 上传历史已更新为成功，任务ID: ${confirmData.task_id}, 上传ID: ${uploadId}`);
    }

    setSubmitInfo({
      taskId: confirmData.task_id,
      status: confirmData.status,
      message: confirmData.message ?? null,
    });

    // 3秒后自动隐藏成功提示，让用户关注任务列表中的实时状态
    setTimeout(() => {
      setSubmitInfo(null);
    }, 3000);

    resetForm();

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("speos-task-created", {
          detail: { taskId: confirmData.task_id },
        })
      );
    }
  };

  // 断点续传流程
  const handleResumableUpload = async (
    masterFile: File,
    includeArchive: File | null
  ) => {
    setIsResumableUpload(true);
    setUploadStep("📦 使用断点续传模式");

    let masterTaskId: string | null = null;
    let masterObjectKey: string | null = null;
    let includeObjectKey: string | null = null;

    try {
      // 步骤 0: 检查是否有未完成的上传（智能匹配）
      let existingMasterTaskId: string | undefined;
      let existingMasterUploadId: string | undefined;
      let existingMasterObjectKey: string | undefined;
      
      // 尝试通过文件名和大小匹配未完成的上传
      if (typeof window !== "undefined") {
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith("resumable_upload_") && key.endsWith("_master")) {
            try {
              const data = JSON.parse(localStorage.getItem(key) || "{}");
              // 匹配条件：文件名和大小相同
              if (data.filename === masterFile.name && data.file_size === masterFile.size) {
                existingMasterTaskId = data.task_id;
                existingMasterUploadId = data.upload_id;
                existingMasterObjectKey = data.object_key;
                console.log(`🔍 发现匹配的未完成上传: ${data.filename}, taskId=${existingMasterTaskId}`);
              }
            } catch (error) {
              console.warn("解析上传进度失败", error);
            }
          }
        });
      }

      // 步骤 1: 上传 Master 文件（分片）
      setUploadStep("⬆️ 上传 Master 文件（分片模式）");
      
      const masterResult = await uploadFileWithResumable(
        masterFile,
        masterFile.name,
        "master",
        {
          existingTaskId: existingMasterTaskId,
          existingUploadId: existingMasterUploadId,
          existingObjectKey: existingMasterObjectKey,
          onProgress: (info: ResumableProgressInfo) => {
            setTotalChunks(info.totalChunks);
            setUploadedChunks(info.uploadedChunks);
            setCurrentChunk(info.currentChunk);
            setUploadProgress(info.progress);
            setUploadSpeed(info.speed);
            setEstimatedTime(info.estimatedTime);
            setMasterProgress(info.progress);
          },
          onChunkComplete: (chunkIndex: number, totalChunks: number) => {
            console.log(`✅ Master 分片 ${chunkIndex}/${totalChunks} 上传完成`);
          },
          abortSignal: abortControllerRef.current?.signal,
        }
      );

      masterTaskId = masterResult.taskId;
      masterObjectKey = masterResult.objectKey;
      console.log(`✅ Master 文件上传完成: ${masterResult.objectKey}`);

      // 步骤 2: 如果有 include 文件，也使用分片上传
      if (includeArchive) {
        setUploadStep("⬆️ 上传 Include 文件（分片模式）");
        
        // 检查 include 文件的未完成上传
        let existingIncludeTaskId: string | undefined;
        let existingIncludeUploadId: string | undefined;
        let existingIncludeObjectKey: string | undefined;
        
        const includeFilename = includeArchive.name;
        if (typeof window !== "undefined") {
          Object.keys(localStorage).forEach((key) => {
            if (key.startsWith("resumable_upload_") && key.endsWith("_include")) {
              try {
                const data = JSON.parse(localStorage.getItem(key) || "{}");
                if (data.filename === includeFilename && data.file_size === includeArchive.size) {
                  existingIncludeTaskId = data.task_id;
                  existingIncludeUploadId = data.upload_id;
                  existingIncludeObjectKey = data.object_key;
                  console.log(`🔍 发现匹配的未完成上传: ${data.filename}, taskId=${existingIncludeTaskId}`);
                }
              } catch (error) {
                console.warn("解析上传进度失败", error);
              }
            }
          });
        }
        
        const includeResult = await uploadFileWithResumable(
          includeArchive,
          includeFilename,
          "include",
          {
            existingTaskId: existingIncludeTaskId,
            existingUploadId: existingIncludeUploadId,
            existingObjectKey: existingIncludeObjectKey,
            onProgress: (info: ResumableProgressInfo) => {
              setTotalChunks(info.totalChunks);
              setUploadedChunks(info.uploadedChunks);
              setCurrentChunk(info.currentChunk);
              // 综合进度：master 50% + include 50%
              const combinedProgress = 50 + (info.progress * 0.5);
              setUploadProgress(Math.round(combinedProgress));
              setUploadSpeed(info.speed);
              setEstimatedTime(info.estimatedTime);
              setIncludeProgress(info.progress);
            },
            onChunkComplete: (chunkIndex: number, totalChunks: number) => {
              console.log(`✅ Include 分片 ${chunkIndex}/${totalChunks} 上传完成`);
            },
            abortSignal: abortControllerRef.current?.signal,
          }
        );

        includeObjectKey = includeResult.objectKey;
        console.log(`✅ Include 文件上传完成: ${includeResult.objectKey}`);
      }

      // 步骤 3: 提交任务（使用 confirmUpload）
      setUploadStep("✅ 提交任务...");
      setUploadProgress(95);

      const confirmData = await confirmUpload({
        task_id: masterTaskId,
        master_object_key: masterObjectKey,
        include_object_key: includeObjectKey || undefined,
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
      const uploadId = currentUploadIdRef.current;
      if (uploadId) {
        setUploadHistory((prev) =>
          prev.map((item) =>
            item.id === uploadId
              ? { ...item, status: "success" as const, progress: 100, taskId: confirmData.task_id }
              : item
          )
        );
        console.log(`✅ 上传历史已更新为成功，任务ID: ${confirmData.task_id}, 上传ID: ${uploadId}`);
      }

      setSubmitInfo({
        taskId: confirmData.task_id,
        status: confirmData.status,
        message: confirmData.message ?? null,
      });

      // 3秒后自动隐藏成功提示
      setTimeout(() => {
        setSubmitInfo(null);
      }, 3000);

      resetForm();

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("speos-task-created", {
            detail: { taskId: confirmData.task_id },
          })
        );
      }
    } catch (error) {
      console.error("断点续传上传失败", error);
      throw error;
    } finally {
      setIsResumableUpload(false);
      setTotalChunks(0);
      setUploadedChunks(0);
      setCurrentChunk(0);
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
          填写任务信息并上传 Master File（必选）与 Include 压缩包（可选），提交后任务会自动出现在右侧列表中。
        </p>
      </header>

      {/* 上传模式显示 */}
      {!configLoading && uploadMode && (
        <div className={`rounded-lg border-2 p-3 ${
          uploadMode === "direct" 
            ? "border-green-200 bg-green-50" 
            : "border-blue-200 bg-blue-50"
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-xl">
              {uploadMode === "direct" ? "🚀" : "☁️"}
            </span>
            <div className="flex-1">
              <h3 className={`text-sm font-semibold ${
                uploadMode === "direct" ? "text-green-900" : "text-blue-900"
              }`}>
                {uploadMode === "direct" ? "内网直连模式" : "云端存储模式"}
              </h3>
              <p className={`text-xs ${
                uploadMode === "direct" ? "text-green-700" : "text-blue-700"
              }`}>
                {uploadMode === "direct" 
                  ? "文件将直接上传到服务器，速度更快（适用于内网环境）" 
                  : "文件将上传到对象存储，支持断点续传（适用于公网环境）"}
              </p>
            </div>
            {uploadConfig?.max_file_size_mb && (
              <div className="text-right">
                <p className={`text-xs font-medium ${
                  uploadMode === "direct" ? "text-green-800" : "text-blue-800"
                }`}>
                  文件限制
                </p>
                <p className={`text-xs ${
                  uploadMode === "direct" ? "text-green-600" : "text-blue-600"
                }`}>
                  {uploadConfig.max_file_size_mb} MB
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {configLoading && (
        <div className="rounded-lg border-2 border-gray-200 bg-gray-50 p-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">⏳</span>
            <p className="text-sm text-gray-700">正在加载上传配置...</p>
          </div>
        </div>
      )}

      {/* 未完成上传提示（断点续传） */}
      {pendingUploads.length > 0 && (
        <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💾</span>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-blue-900">
                检测到未完成的上传（断点续传可用）
              </h3>
              <p className="mt-1 text-xs text-blue-700">
                您有 {pendingUploads.length} 个文件没有上传完成。
                选择相同的文件并填写相同的 Job Name，系统会自动从断点继续上传。
              </p>
              <div className="mt-3 space-y-2">
                {pendingUploads.map((upload) => (
                  <div
                    key={upload.taskId}
                    className="flex items-center justify-between rounded bg-white px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-blue-900">
                        📄 {upload.filename}
                      </span>
                      <span className="text-blue-600">
                        ({upload.fileType})
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-blue-700">
                        已上传 {upload.uploadedChunks}/{upload.totalChunks} 片
                      </span>
                      <button
                        onClick={() => {
                          if (typeof window !== "undefined") {
                            const key = `resumable_upload_${upload.taskId}_${upload.fileType}`;
                            localStorage.removeItem(key);
                            setPendingUploads((prev) =>
                              prev.filter((u) => u.taskId !== upload.taskId)
                            );
                          }
                        }}
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        清除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

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
            <label className="mb-1 block text-sm font-medium text-gray-700">Include 文件（可选）</label>
            <input
              ref={includeInputRef}
              type="file"
              accept=".zip,.rar,.7z,.tar,.gz,.tar.gz"
              onClick={(event) => {
                (event.target as HTMLInputElement).value = "";
              }}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                if (file && !validateIncludeFile(file)) {
                  event.target.value = "";
                  return;
                }
                setIncludeFile(file);
              }}
              className="w-full rounded-md border px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
            {includeFileLabel && (
              <p className="mt-1 text-xs text-gray-500">
                已选择：{includeFileLabel}
              </p>
            )}
            <div className="mt-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
              <p className="text-xs text-amber-800 font-medium">
                ⚠️ Include文件必须是压缩包格式（推荐.zip）
              </p>
              <p className="mt-1 text-xs text-amber-700">
                支持格式：.zip, .rar, .7z, .tar, .gz, .tar.gz
              </p>
              <p className="mt-1 text-xs text-amber-600">
                📦 压缩方法：Windows右键文件夹 → "发送到" → "压缩(zipped)文件夹"；Mac右键文件夹 → "压缩"
              </p>
            </div>
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
              {/* 断点续传模式：显示分片信息 */}
              {isResumableUpload && totalChunks > 0 && (
                <div className="text-xs text-blue-700 space-y-1">
                  <div className="flex items-center justify-between">
                    <span>📦 分片上传模式</span>
                    <span className="font-mono">
                      {uploadedChunks}/{totalChunks} 片
                    </span>
                  </div>
                  {currentChunk > 0 && currentChunk <= totalChunks && (
                    <div className="text-xs text-blue-600">
                      当前分片: #{currentChunk}
                    </div>
                  )}
                </div>
              )}

              {/* 普通模式：显示文件进度 */}
              {!isResumableUpload && masterProgress > 0 && masterProgress < 100 && (
                <div className="text-xs text-blue-700">
                  Master 文件: {masterProgress}%
                </div>
              )}

              {!isResumableUpload && includeProgress > 0 && includeProgress < 100 && (
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
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3">
            <pre className="text-sm text-red-700 whitespace-pre-wrap font-sans">{formError}</pre>
          </div>
        )}

        {submitInfo && !formError && (
          <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            <p>
              ✅ 任务提交成功！任务 ID：
              <span className="font-mono font-semibold">{submitInfo.taskId}</span>
            </p>
            {submitInfo.message && <p className="mt-1 text-xs text-green-600">{submitInfo.message}</p>}
            <p className="mt-1 text-xs text-green-600">
              📋 请在下方任务列表中查看实时状态和下载结果
            </p>
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


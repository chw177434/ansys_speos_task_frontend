"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createTask, type CreateTaskResponse } from "../lib/api";

const FORM_STATE_KEY = "speos_task_form_state";

interface StoredFormState {
  profileName: string;
  version: string;
  jobName: string;
  projectDir: string;
}

const DEFAULT_FORM_STATE: StoredFormState = {
  profileName: "",
  version: "",
  jobName: "",
  projectDir: "",
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
      profileName:
        typeof parsed.profileName === "string" ? parsed.profileName : DEFAULT_FORM_STATE.profileName,
      version: typeof parsed.version === "string" ? parsed.version : DEFAULT_FORM_STATE.version,
      jobName: typeof parsed.jobName === "string" ? parsed.jobName : DEFAULT_FORM_STATE.jobName,
      projectDir:
        typeof parsed.projectDir === "string" ? parsed.projectDir : DEFAULT_FORM_STATE.projectDir,
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

export default function UploadForm() {
  const initialState = useMemo(() => loadFormState(), []);
  const [profileName, setProfileName] = useState(initialState.profileName);
  const [version, setVersion] = useState(initialState.version);
  const [jobName, setJobName] = useState(initialState.jobName);
  const [projectDir, setProjectDir] = useState(initialState.projectDir);
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

  useEffect(() => {
    saveFormState({ profileName, version, jobName, projectDir });
  }, [profileName, version, jobName, projectDir]);

  const includeFolderLabel = useMemo(() => {
    if (!includeFiles || includeFiles.length === 0) return "";
    const first = includeFiles[0] as File & { webkitRelativePath?: string };
    const relativePath = first?.webkitRelativePath ?? "";
    if (relativePath) {
      const topLevel = relativePath.split(/[\\/]/)[0];
      if (topLevel) return topLevel;
      return relativePath;
    }
    return `${includeFiles.length} 个文件`;
  }, [includeFiles]);

  const includeFilesCount = includeFiles?.length ?? 0;
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

    setSubmitting(true);
    try {
      const result: CreateTaskResponse = await createTask(formData);
      setSubmitInfo({
        taskId: result.task_id,
        status: result.status,
        message: result.message ?? null,
      });
      setMasterFile(null);
      setIncludeFiles(null);
      if (masterInputRef.current) {
        masterInputRef.current.value = "";
      }
      if (includeDirectoryInputRef.current) {
        includeDirectoryInputRef.current.value = "";
      }
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
    <section className="rounded-xl bg-white p-8 shadow">
      <header className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">提交 SPEOS 任务</h2>
        <p className="mt-1 text-sm text-gray-500">
          填写任务信息并上传 Master File（必选）与 Include 文件夹（可选）。
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5">
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
            placeholder="留空将使用服务端任务文件夹"
            className="w-full rounded-md border px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          />
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
            <p className="mt-1 text-xs text-green-600">可在下方任务列表中查看进度并下载结果。</p>
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

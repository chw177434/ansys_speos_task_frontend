"use client";
import { useState } from "react";
import { getTaskStatus, listOutputs } from "../lib/api";

export default function UploadForm() {
  const [profileName, setProfileName] = useState("");
  const [version, setVersion] = useState("");
  const [jobName, setJobName] = useState("");
  const [masterFile, setMasterFile] = useState("");
  const [includePath, setIncludePath] = useState("");
  const [projectDir, setProjectDir] = useState("");

  const [taskId, setTaskId] = useState("");
  const [status, setStatus] = useState("");
  const [outputs, setOutputs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // 提交任务
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!masterFile) return alert("请输入 Master File 路径");
    if (!projectDir) return alert("请输入 Project Directory 路径");

    const payload = {
      profile_name: profileName,
      version,
      job_name: jobName,
      master_file: masterFile,
      include_path: includePath,
      project_dir: projectDir,
    };

    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setTaskId(data.task_id);
      setStatus(data.status || "PENDING");
    } catch (err: any) {
      alert(err.message || "提交失败");
    } finally {
      setLoading(false);
    }
  }

  // 刷新状态
  async function refreshStatus() {
    if (!taskId) return;
    const s = await getTaskStatus(taskId);
    setStatus(s.status + (s.message ? ` (${s.message})` : ""));
    if (s.status === "SUCCESS" || s.message === "SUCCESS") {
      const o = await listOutputs(taskId);
      setOutputs(o.files);
    }
  }

  const statusColor: Record<string, string> = {
    PENDING: "bg-gray-200 text-gray-800",
    STARTED: "bg-yellow-200 text-yellow-800",
    SUCCESS: "bg-green-200 text-green-800",
    FAILED: "bg-red-200 text-red-800",
  };

  return (
    <div className="max-w-4xl mx-auto">
      <form
        onSubmit={onSubmit}
        className="bg-white shadow-lg rounded-xl p-8 space-y-6"
      >
        <h2 className="text-2xl font-bold text-gray-800 mb-6">提交 SPEOS 任务</h2>

        {/* Profile Name */}
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

        {/* Version */}
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

        {/* Job Name */}
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

        {/* Master File */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Master File 路径
          </label>
          <input
            type="text"
            value={masterFile}
            onChange={(e) => setMasterFile(e.target.value)}
            placeholder="请输入 Master File 的绝对路径"
            className="border rounded-md px-3 py-2 w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        {/* Include Files */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Include Files 路径
          </label>
          <input
            type="text"
            value={includePath}
            onChange={(e) => setIncludePath(e.target.value)}
            placeholder="请输入 Include 文件夹路径"
            className="border rounded-md px-3 py-2 w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        {/* Project Directory */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Project Directory 输出目录
          </label>
          <input
            type="text"
            value={projectDir}
            onChange={(e) => setProjectDir(e.target.value)}
            placeholder="请输入输出目录路径"
            className="border rounded-md px-3 py-2 w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        {/* 提交按钮 */}
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-md shadow disabled:opacity-50"
        >
          {loading ? "提交中..." : "提交任务"}
        </button>
      </form>

      {taskId && (
        <div className="bg-white shadow-lg rounded-xl p-8 mt-8">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800">
              任务 ID：<span className="font-mono">{taskId}</span>
            </h3>
            <button
              onClick={refreshStatus}
              className="border px-4 py-1 rounded-md hover:bg-gray-100"
            >
              刷新状态
            </button>
          </div>

          <div className="mt-4">
            <span
              className={`px-3 py-1 rounded-md text-sm font-medium ${
                statusColor[status] ||
                "bg-gray-200 text-gray-800"
              }`}
            >
              {status || "PENDING"}
            </span>
          </div>

          {outputs.length > 0 && (
            <div className="mt-6">
              <h4 className="font-medium mb-2 text-gray-700">输出文件</h4>
              <ul className="list-disc pl-6 space-y-1 text-sm text-gray-800">
                {outputs.map((f) => (
                  <li key={f} className="font-mono">
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

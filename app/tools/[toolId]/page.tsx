"use client";

import Link from "next/link";
import { notFound, use } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import TasksTable from "../../../components/TasksTable";
import ToolUsageTracker from "../../../components/ToolUsageTracker";
import UploadForm from "../../../components/UploadForm";
import { getToolDefinition } from "../../../lib/tools";

type ToolPageParams = {
  toolId: string;
};

type ToolPageProps = {
  params: Promise<ToolPageParams>;
};

export default function ToolPage({ params }: ToolPageProps) {
  const { toolId } = use(params);
  const tool = getToolDefinition(toolId);
  const tasksTableRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  if (!tool) {
    notFound();
    return null;
  }

  const isAvailable = tool.status === "available";

  // 监听滚动，显示/隐藏快速跳转按钮（仅移动端）
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleScroll = () => {
      // 仅在移动端显示按钮
      const isMobile = window.innerWidth < 1024; // lg breakpoint
      if (!isMobile) {
        setShowScrollButton(false);
        return;
      }

      // 检查是否已经滚动到任务列表附近
      if (tasksTableRef.current) {
        const rect = tasksTableRef.current.getBoundingClientRect();
        const isVisible = rect.top < window.innerHeight * 0.8;
        setShowScrollButton(!isVisible);
      }
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll(); // 初始检查

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // 监听任务创建事件，在移动端自动滚动到任务列表
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleTaskCreated = () => {
      // 仅在移动端自动滚动
      const isMobile = window.innerWidth < 1024;
      if (isMobile && tasksTableRef.current) {
        // 延迟一点时间，确保任务列表已更新
        setTimeout(() => {
          tasksTableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 500);
      }
    };

    window.addEventListener("speos-task-created", handleTaskCreated);
    return () => window.removeEventListener("speos-task-created", handleTaskCreated);
  }, []);

  const scrollToTasks = () => {
    tasksTableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  
  // 求解器图标和颜色映射
  const solverConfig: Record<string, { icon: string; color: string }> = {
    speos: { icon: "💡", color: "border-yellow-200 bg-yellow-50 text-yellow-700" },
    fluent: { icon: "🌊", color: "border-blue-200 bg-blue-50 text-blue-700" },
    maxwell: { icon: "⚡", color: "border-purple-200 bg-purple-50 text-purple-700" },
    mechanical: { icon: "🔧", color: "border-green-200 bg-green-50 text-green-700" },
  };
  
  const currentSolver = solverConfig[tool.id] || { icon: "📊", color: "border-gray-200 bg-gray-50 text-gray-700" };

  return (
    <main className="min-h-screen bg-gray-50 p-6 sm:p-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <ToolUsageTracker toolId={tool.id} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm transition hover:border-blue-400 hover:text-blue-600"
          >
            <span aria-hidden>←</span>
            返回工具选择
          </Link>
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            <span>{isAvailable ? "当前可用" : "规划中"}</span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-blue-500">{isAvailable ? "Active" : "Roadmap"}</span>
          </div>
        </div>

        <header className="space-y-3 rounded-2xl bg-white p-6 shadow">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-lg font-medium ${currentSolver.color}`}>
                <span>{currentSolver.icon}</span>
              </span>
              <h1 className="text-3xl font-bold text-gray-900">{tool.name}</h1>
            </div>
            {tool.detail && <p className="text-sm text-gray-600">{tool.detail}</p>}
          </div>
          <p className="text-sm text-gray-500">{tool.description}</p>
        </header>

        {isAvailable ? (
          <>
            <div className="flex flex-col lg:flex-row gap-6">
              {/* 左侧：提交表单 */}
              <div className="flex-1 lg:max-w-2xl">
                <div className="lg:sticky lg:top-6">
                  <UploadForm 
                    defaultSolverType={tool.id as "speos" | "fluent" | "maxwell" | "mechanical"} 
                    lockSolverType={true}
                  />
                </div>
              </div>
              
              {/* 右侧：任务列表 - 桌面端固定高度，移动端自适应 */}
              <div ref={tasksTableRef} className="flex-1 lg:flex-shrink-0 lg:w-[600px]">
                <div className="lg:sticky lg:top-6">
                  <TasksTable />
                </div>
              </div>
            </div>

            {/* 移动端快速跳转按钮 */}
            {showScrollButton && (
              <button
                onClick={scrollToTasks}
                className="fixed bottom-6 right-6 z-50 lg:hidden flex flex-col items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-xl hover:shadow-2xl transition-all duration-200 hover:scale-110 active:scale-95"
                aria-label="跳转到任务列表"
              >
                <svg
                  className="w-6 h-6 mb-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                  />
                </svg>
                <span className="text-[10px] font-semibold leading-tight">任务</span>
              </button>
            )}
          </>
        ) : (
          <section className="rounded-2xl bg-white p-10 text-center shadow">
            <p className="text-lg font-semibold text-slate-800">功能规划中</p>
            <p className="mt-2 text-sm text-slate-500">敬请期待，我们正在为 {tool.name} 准备远程异步求解能力。</p>
          </section>
        )}
      </div>
    </main>
  );
}

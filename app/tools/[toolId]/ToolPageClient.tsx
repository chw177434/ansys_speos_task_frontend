"use client";

import { useEffect, useRef, useState } from "react";
import TasksTable from "../../../components/TasksTable";
import UploadForm from "../../../components/UploadForm";
import type { SolverType } from "../../../lib/api";

interface ToolPageClientProps {
  toolId: string;
  solverType: SolverType;
}

export default function ToolPageClient({ toolId, solverType }: ToolPageClientProps) {
  const tasksTableRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

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

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-6">
        {/* 左侧：提交表单 */}
        <div className="flex-1 lg:max-w-2xl">
          <div className="lg:sticky lg:top-6">
            <UploadForm 
              defaultSolverType={solverType} 
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
  );
}


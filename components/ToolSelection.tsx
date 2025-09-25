"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TOOL_STORAGE_KEY, type ToolDefinition } from "../lib/tools";

interface ToolSelectionProps {
  tools: ToolDefinition[];
}

export default function ToolSelection({ tools }: ToolSelectionProps) {
  const [lastToolId, setLastToolId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(TOOL_STORAGE_KEY);
      if (stored) {
        setLastToolId(stored);
      }
    } catch (error) {
      console.warn("读取上次选择的工具失败", error);
    }
  }, []);

  const lastTool = useMemo(() => {
    if (!lastToolId) return null;
    return tools.find((item) => item.id === lastToolId && item.status === "available") ?? null;
  }, [lastToolId, tools]);

  const handleSelect = useCallback((toolId: string) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(TOOL_STORAGE_KEY, toolId);
      setLastToolId(toolId);
    } catch (error) {
      console.warn("存储工具选择失败", error);
    }
  }, []);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 py-12">
      <header className="space-y-3">
        <p className="inline-flex items-center rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
          远程异步求解工具台
        </p>
        <h1 className="text-3xl font-bold text-gray-900">请选择需要使用的 Ansys 工具</h1>
        <p className="max-w-2xl text-sm text-gray-600">
          根据业务场景选择不同的仿真工具，进入后即可配置任务参数、上传模型文件并提交远程求解。
        </p>
        {lastTool && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            <span>上次使用：</span>
            <Link
              href={`/tools/${lastTool.id}`}
              onClick={() => handleSelect(lastTool.id)}
              className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-500"
            >
              继续进入 {lastTool.name}
            </Link>
          </div>
        )}
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        {tools.map((tool) => {
          if (tool.status === "available") {
            return (
              <Link
                key={tool.id}
                href={`/tools/${tool.id}`}
                onClick={() => handleSelect(tool.id)}
                className="group flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition duration-150 hover:-translate-y-1 hover:border-blue-400 hover:shadow-lg"
              >
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                    <span>可用</span>
                    <span className="text-[10px] uppercase tracking-[0.2em] text-blue-500">Available</span>
                  </div>
                  <h2 className="text-2xl font-semibold text-gray-900">{tool.name}</h2>
                  <p className="text-sm text-gray-600">{tool.description}</p>
                </div>
                {tool.detail && <p className="mt-6 text-xs text-gray-400">{tool.detail}</p>}
                <span className="mt-8 inline-flex items-center gap-1 text-sm font-semibold text-blue-600">
                  进入配置
                  <span aria-hidden className="transition-transform duration-150 group-hover:translate-x-1">→</span>
                </span>
              </Link>
            );
          }

          return (
            <div
              key={tool.id}
              className="flex h-full flex-col justify-between rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-gray-500"
            >
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
                  <span>规划中</span>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Coming soon</span>
                </div>
                <h2 className="text-2xl font-semibold text-gray-700">{tool.name}</h2>
                <p className="text-sm text-gray-600">{tool.description}</p>
              </div>
              {tool.detail && <p className="mt-6 text-xs text-gray-500">{tool.detail}</p>}
              <span className="mt-8 inline-flex items-center gap-1 text-sm font-semibold text-gray-500">
                敬请期待
              </span>
            </div>
          );
        })}
      </section>
    </div>
  );
}

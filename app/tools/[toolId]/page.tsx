import Link from "next/link";
import { notFound } from "next/navigation";
import ToolPageClient from "./ToolPageClient";
import ToolUsageTracker from "../../../components/ToolUsageTracker";
import { getToolDefinition } from "../../../lib/tools";

type ToolPageParams = {
  toolId: string;
};

type ToolPageProps = {
  params: Promise<ToolPageParams>;
};

export default async function ToolPage({ params }: ToolPageProps) {
  const { toolId } = await params;
  const tool = getToolDefinition(toolId);

  if (!tool) {
    notFound();
    return null;
  }

  const isAvailable = tool.status === "available";

  // 求解器图标和颜色映射
  const solverConfig: Record<string, { icon: string; color: string }> = {
    speos: { icon: "💡", color: "border-yellow-200 bg-yellow-50 text-yellow-700" },
    fluent: { icon: "🌊", color: "border-blue-200 bg-blue-50 text-blue-700" },
    maxwell: { icon: "⚡", color: "border-purple-200 bg-purple-50 text-purple-700" },
    mechanical: { icon: "🔧", color: "border-green-200 bg-green-50 text-green-700" },
  };
  
  const currentSolver = solverConfig[tool.id] || { icon: "📊", color: "border-gray-200 bg-gray-50 text-gray-700" };

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto flex max-w-[98%] xl:max-w-[95%] 2xl:max-w-[90%] flex-col gap-6">
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
          <ToolPageClient 
            toolId={tool.id}
            solverType={tool.id as "speos" | "fluent" | "maxwell" | "mechanical"}
          />
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

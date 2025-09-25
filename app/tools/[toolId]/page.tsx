import Link from "next/link";
import { notFound } from "next/navigation";
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

export default async function ToolPage({ params }: ToolPageProps) {
  const { toolId } = await params;
  const tool = getToolDefinition(toolId);
  if (!tool) {
    notFound();
    return null;
  }

  const isAvailable = tool.status === "available";
  const isSpeos = tool.id === "speos";

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
            <h1 className="text-3xl font-bold text-gray-900">{tool.name}</h1>
            {tool.detail && <p className="text-sm text-gray-600">{tool.detail}</p>}
          </div>
          <p className="text-sm text-gray-500">{tool.description}</p>
        </header>

        {isAvailable ? (
          isSpeos ? (
            <>
              <UploadForm />
              <TasksTable />
            </>
          ) : (
            <section className="rounded-2xl bg-white p-10 text-center shadow">
              <p className="text-lg font-semibold text-slate-800">该工具的配置尚未启用</p>
              <p className="mt-2 text-sm text-slate-500">如需体验，请联系产品团队确认 {tool.name} 的前端接入计划。</p>
            </section>
          )
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

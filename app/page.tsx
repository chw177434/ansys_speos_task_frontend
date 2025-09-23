import UploadForm from "../components/UploadForm";
import TasksTable from "../components/TasksTable";

export default function Page() {
  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <h1 className="text-3xl font-bold text-gray-900">SPEOS 异步求解</h1>
          <p className="mt-2 text-gray-600">提交任务并查看异步求解进度。</p>
        </header>
        <UploadForm />
        <TasksTable />
      </div>
    </main>
  );
}

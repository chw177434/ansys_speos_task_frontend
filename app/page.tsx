import ToolSelection from "../components/ToolSelection";
import { TOOL_DEFINITIONS } from "../lib/tools";

export default function Page() {
  return (
    <main className="min-h-screen bg-gray-50">
      <ToolSelection tools={TOOL_DEFINITIONS} />
    </main>
  );
}

type ToolStatus = "available" | "coming-soon";

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  status: ToolStatus;
  detail?: string;
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    id: "speos",
    name: "SPEOS 光学仿真",
    description: "提交 SPEOS 任务，支持 Master File 上传、Include 目录压缩上传以及常用运行参数配置。",
    status: "available",
    detail: "光学仿真，用于处理 SPEOS 任务并追踪异步求解进度。",
  },
  {
    id: "em",
    name: "电磁仿真",
    description: "预留入口，将用于提交 Ansys 电磁方向的远程异步任务。",
    status: "coming-soon",
    detail: "功能规划中，未来支持 HFSS / Maxwell 等电磁求解器的参数配置与任务管理。",
  },
  {
    id: "structural",
    name: "结构仿真",
    description: "预留入口，将用于提交 Ansys 结构力学相关的任务。",
    status: "coming-soon",
    detail: "功能规划中，未来支持 Mechanical 等结构求解器的远程配置流程。",
  },
];

export const DEFAULT_TOOL_ID = "speos";

export function getToolDefinition(toolId: string): ToolDefinition | undefined {
  return TOOL_DEFINITIONS.find((tool) => tool.id === toolId);
}

export const TOOL_STORAGE_KEY = "ansys-tool-last-selected";

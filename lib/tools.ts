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
    description: "提交 SPEOS 光学仿真任务，支持 GPU 加速、多线程计算以及完整的运行参数配置。",
    status: "available",
    detail: "光学系统设计与仿真，用于照明分析、光线追踪、传感器模拟等场景。支持 Master File 上传和 Include 目录压缩上传。",
  },
  {
    id: "fluent",
    name: "FLUENT 流体力学仿真",
    description: "提交 FLUENT CFD 仿真任务，支持 2D/3D 模拟、双精度计算、自适应网格等功能。",
    status: "available",
    detail: "计算流体动力学分析，用于流体流动、传热、多相流等复杂流体问题求解。支持 .cas/.cas.h5 文件格式。",
  },
  {
    id: "maxwell",
    name: "Maxwell 电磁场仿真",
    description: "提交 Maxwell 电磁场仿真任务，支持静态场、瞬态场、涡流场等多种电磁分析。",
    status: "available",
    detail: "低频电磁场仿真，用于电机设计、变压器分析、天线优化等电磁工程问题。支持 .aedt 项目文件。",
  },
  {
    id: "mechanical",
    name: "Mechanical 结构力学仿真",
    description: "提交 Mechanical 结构仿真任务，支持静力分析、模态分析、瞬态动力学等结构计算。",
    status: "available",
    detail: "结构强度与振动分析，用于应力计算、疲劳寿命预测、热-结构耦合等工程问题。支持 .dat/.inp 文件格式。",
  },
];

export const DEFAULT_TOOL_ID = "speos";

export function getToolDefinition(toolId: string): ToolDefinition | undefined {
  return TOOL_DEFINITIONS.find((tool) => tool.id === toolId);
}

export const TOOL_STORAGE_KEY = "ansys-tool-last-selected";

# 📡 API 接口参考文档 - v2.1.0

## 📋 文档说明

本文档描述了**多求解器架构（v2.1.0）**的所有 API 接口变化。

---

## 🔄 接口变化总览

| 接口 | 变化 | 兼容性 | 说明 |
|------|------|--------|------|
| POST /api/tasks/upload/confirm | ⭐ 新增字段 | ✅ 向后兼容 | 添加 solver_type 和各求解器参数 |
| GET /api/tasks/{task_id}/detail | ⭐ 新增字段 | ✅ 向后兼容 | 返回 solver_type 和进度信息 |
| GET /api/tasks | ⭐ 新增字段 | ✅ 向后兼容 | 列表项包含 solver_type |
| 其他接口 | 无变化 | ✅ 完全兼容 | 保持不变 |

---

## 📤 1. 任务提交接口

### POST /api/tasks/upload/confirm

#### 功能

确认文件上传完成，提交任务到求解队列。

#### 请求参数

```typescript
{
    // ========== 必需字段 ==========
    task_id: string;              // 任务ID
    master_object_key: string;    // 主文件的对象存储 key
    job_name: string;             // 任务名称
    
    // ========== 通用字段（可选）==========
    solver_type?: string;         // ⭐ 新增：求解器类型（默认 "speos"）
    include_object_key?: string;  // Include 文件的对象存储 key
    profile_name?: string;        // 配置名称
    version?: string;             // 版本
    submitter?: string;           // 提交人
    project_dir?: string;         // 项目目录
    include_path?: string;        // Include 路径
    use_gpu?: boolean;            // ⭐ 是否使用 GPU（所有求解器通用基础参数）
    
    // ========== SPEOS 参数（solver_type="speos" 或未指定）==========
    simulation_index?: string;    // 仿真索引
    thread_count?: string;        // 线程数
    priority?: string;            // 优先级
    ray_count?: string;           // 光线数
    duration_minutes?: string;    // 持续时间（分钟）
    hpc_job_name?: string;        // HPC 作业名
    node_count?: string;          // 节点数
    walltime_hours?: string;      // 墙钟时间（小时）
    
    // ========== FLUENT 参数（solver_type="fluent"）==========
    dimension?: "2d" | "3d";              // 维度（默认 "3d"）
    precision?: "sp" | "dp";              // 精度（默认 "dp"）
    iterations?: number;                  // 迭代步数（默认 100）
    initialization_method?: "hyb" | "standard";  // 初始化方法（默认 "hyb"）
    thread_count?: string;                // 核心数（与 SPEOS 共用）
    
    // ========== Maxwell 参数（solver_type="maxwell"）==========
    num_cores?: string;           // 核心数（默认 "4"）
    design_name?: string;         // 设计名称（可选）
    
    // ========== Mechanical 参数（solver_type="mechanical"）==========
    num_cores?: string;           // 核心数（默认 "4"）
}
```

#### 响应（无变化）

```typescript
{
    task_id: string;      // 任务ID
    status: string;       // "PENDING"
    message: string;      // 提示信息
}
```

#### 请求示例

**SPEOS 任务：**
```bash
curl -X POST http://localhost:8000/api/tasks/upload/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "speos-001",
    "master_object_key": "tasks/speos-001/model.scdoc",
    "job_name": "照明仿真",
    "thread_count": "16",
    "use_gpu": true
  }'
```

**FLUENT 任务：**
```bash
curl -X POST http://localhost:8000/api/tasks/upload/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "fluent-001",
    "master_object_key": "tasks/fluent-001/airfoil.cas.h5",
    "solver_type": "fluent",
    "job_name": "CFD分析",
    "dimension": "3d",
    "precision": "dp",
    "iterations": 1000,
    "thread_count": "8"
  }'
```

---

## 📥 2. 任务详情接口

### GET /api/tasks/{task_id}/detail

#### 功能

获取任务的详细信息，包括状态、参数、进度等。

#### 响应参数

```typescript
{
    // ========== 原有字段（保持不变）==========
    task_id: string;
    status: string;               // "PENDING" | "RUNNING" | "SUCCESS" | "FAILURE"
    created_at?: number;
    archive_id?: string;
    input_dir?: string;
    output_dir?: string;
    log_dir?: string;
    params?: Record<string, any>;
    download_url?: string;
    download_name?: string;
    display_name?: string;
    submitter?: string;
    duration?: number;
    elapsed_seconds?: number;
    status_history?: Array<{
        status: string;
        timestamp: number;
        error?: string;
    }>;
    
    // ========== 新增字段 ==========
    solver_type?: string;         // ⭐ 求解器类型
    
    // ⭐ 进度信息（根据 solver_type 不同而不同）
    progress_info?: {
        // SPEOS 字段
        progress_percent?: number;       // 进度百分比
        estimated_time?: string;         // 剩余时间
        current_pass?: number;
        total_passes?: number;
        current_sensor?: number;
        total_sensors?: number;
        
        // FLUENT 字段
        current_iteration?: number;      // 迭代步数
        continuity_residual?: number;    // 残差值
        
        // Maxwell 字段
        // current_pass?: number;        // 与 SPEOS 共用
        status?: string;                 // "solving" | "converged"
        
        // Mechanical 字段
        load_step?: number;              // 载荷步
        substep?: number;                // 子步
        iteration?: number;              // 迭代
        
        // 通用字段
        converged?: boolean;             // 是否收敛
        progress_type?: string;          // 进度类型
        message?: string;                // 附加信息
    };
}
```

#### 响应示例

**SPEOS 任务：**
```json
{
    "task_id": "speos-001",
    "status": "PROGRESS",
    "solver_type": "speos",
    "display_name": "照明仿真",
    "progress_info": {
        "progress_percent": 45.2,
        "estimated_time": "2 hours 15 min",
        "current_pass": 2,
        "total_passes": 3,
        "current_sensor": 1,
        "total_sensors": 1
    }
}
```

**FLUENT 任务：**
```json
{
    "task_id": "fluent-001",
    "status": "PROGRESS",
    "solver_type": "fluent",
    "display_name": "CFD分析",
    "progress_info": {
        "current_iteration": 500,
        "continuity_residual": 1.234e-04,
        "progress_type": "iteration"
    }
}
```

---

## 📋 3. 任务列表接口

### GET /api/tasks

#### 响应参数

```typescript
{
    total: number;
    items: Array<{
        task_id: string;
        status: string;
        created_at?: number;
        job_name?: string;
        display_name?: string;
        submitter?: string;
        duration?: number;
        elapsed_seconds?: number;
        solver_type?: string;  // ⭐ 新增
    }>;
}
```

#### 响应示例

```json
{
    "total": 10,
    "items": [
        {
            "task_id": "speos-001",
            "status": "SUCCESS",
            "solver_type": "speos",
            "display_name": "照明仿真",
            "duration": 3600.5
        },
        {
            "task_id": "fluent-001",
            "status": "RUNNING",
            "solver_type": "fluent",
            "display_name": "CFD分析",
            "elapsed_seconds": 300.2
        },
        {
            "task_id": "maxwell-001",
            "status": "PENDING",
            "solver_type": "maxwell",
            "display_name": "电磁分析"
        }
    ]
}
```

---

## 🎨 前端实现示例（React + Ant Design）

### 完整的任务提交表单

```tsx
import React, { useState } from 'react';
import { Form, Input, Select, Button, Checkbox, InputNumber, Space } from 'antd';

const { Option } = Select;

const TaskSubmitForm: React.FC = () => {
    const [form] = Form.useForm();
    const [solverType, setSolverType] = useState<string>("speos");
    
    const onFinish = async (values: any) => {
        const requestData = {
            task_id: values.task_id,
            master_object_key: values.master_object_key,
            solver_type: solverType,
            job_name: values.job_name,
            submitter: values.submitter,
            ...values  // 包含所有其他参数
        };
        
        try {
            const response = await fetch("/api/tasks/upload/confirm", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestData)
            });
            
            const result = await response.json();
            console.log("任务提交成功:", result);
        } catch (error) {
            console.error("任务提交失败:", error);
        }
    };
    
    return (
        <Form form={form} onFinish={onFinish} layout="vertical">
            {/* 基本信息 */}
            <Form.Item label="任务ID" name="task_id" required>
                <Input placeholder="自动生成" disabled />
            </Form.Item>
            
            <Form.Item label="任务名称" name="job_name" required>
                <Input placeholder="请输入任务名称" />
            </Form.Item>
            
            <Form.Item label="提交人" name="submitter">
                <Input placeholder="请输入提交人" />
            </Form.Item>
            
            {/* 求解器选择 */}
            <Form.Item label="求解器类型" required>
                <Select value={solverType} onChange={setSolverType}>
                    <Option value="speos">
                        <Space>
                            <span>💡</span>
                            <span>SPEOS - 光学仿真</span>
                        </Space>
                    </Option>
                    <Option value="fluent">
                        <Space>
                            <span>🌊</span>
                            <span>FLUENT - 流体力学</span>
                        </Space>
                    </Option>
                    <Option value="maxwell">
                        <Space>
                            <span>⚡</span>
                            <span>Maxwell - 电磁场</span>
                        </Space>
                    </Option>
                    <Option value="mechanical">
                        <Space>
                            <span>🔧</span>
                            <span>Mechanical - 结构力学</span>
                        </Space>
                    </Option>
                </Select>
            </Form.Item>
            
            {/* SPEOS 参数 */}
            {solverType === "speos" && (
                <>
                    <Form.Item label="线程数" name="thread_count">
                        <Input placeholder="例如: 16" />
                    </Form.Item>
                    <Form.Item name="use_gpu" valuePropName="checked">
                        <Checkbox>使用 GPU 加速</Checkbox>
                    </Form.Item>
                    <Form.Item label="光线数" name="ray_count">
                        <Input placeholder="例如: 1000000" />
                    </Form.Item>
                </>
            )}
            
            {/* FLUENT 参数 */}
            {solverType === "fluent" && (
                <>
                    <Form.Item label="维度" name="dimension" initialValue="3d">
                        <Select>
                            <Option value="2d">2D</Option>
                            <Option value="3d">3D</Option>
                        </Select>
                    </Form.Item>
                    <Form.Item label="精度" name="precision" initialValue="dp">
                        <Select>
                            <Option value="sp">单精度（快速）</Option>
                            <Option value="dp">双精度（准确，推荐）</Option>
                        </Select>
                    </Form.Item>
                    <Form.Item label="迭代步数" name="iterations" initialValue={100}>
                        <InputNumber min={1} max={100000} style={{ width: "100%" }} />
                    </Form.Item>
                    <Form.Item label="核心数" name="thread_count">
                        <Input placeholder="例如: 8" />
                    </Form.Item>
                </>
            )}
            
            {/* Maxwell 参数 */}
            {solverType === "maxwell" && (
                <>
                    <Form.Item label="核心数" name="num_cores" initialValue="4">
                        <Input placeholder="例如: 8" />
                    </Form.Item>
                    <Form.Item label="设计名称" name="design_name">
                        <Input placeholder="可选，留空则求解所有设计" />
                    </Form.Item>
                </>
            )}
            
            {/* Mechanical 参数 */}
            {solverType === "mechanical" && (
                <>
                    <Form.Item label="核心数" name="num_cores" initialValue="4">
                        <Input placeholder="例如: 8" />
                    </Form.Item>
                </>
            )}
            
            <Form.Item>
                <Button type="primary" htmlType="submit">
                    提交任务
                </Button>
            </Form.Item>
        </Form>
    );
};

export default TaskSubmitForm;
```

### 完整的进度显示组件

```tsx
import React from 'react';
import { Progress, Typography, Space, Tag, Spin } from 'antd';
import { TaskDetail } from '../types/api';

const { Text } = Typography;

interface Props {
    task: TaskDetail;
}

const TaskProgressDisplay: React.FC<Props> = ({ task }) => {
    const { solver_type, progress_info, status } = task;
    
    // 只在运行状态显示进度
    if (!["STARTED", "RUNNING", "PROGRESS"].includes(status)) {
        return null;
    }
    
    if (!progress_info) {
        return <Spin tip="求解中，等待进度信息..." />;
    }
    
    // 根据 solver_type 显示不同的进度
    const renderProgress = () => {
        switch (solver_type) {
            case "speos":
            case undefined:  // 向后兼容
                return (
                    <Space direction="vertical" style={{ width: "100%" }}>
                        {progress_info.progress_percent !== undefined && (
                            <>
                                <Progress 
                                    percent={progress_info.progress_percent} 
                                    status="active"
                                    strokeColor={{
                                        '0%': '#FFB800',
                                        '100%': '#FFA940',
                                    }}
                                />
                                <Text>进度: {progress_info.progress_percent.toFixed(1)}%</Text>
                            </>
                        )}
                        
                        {progress_info.estimated_time && (
                            <Text>
                                ⏰ 预计剩余时间: 
                                <Text strong style={{ marginLeft: 8 }}>
                                    {progress_info.estimated_time}
                                </Text>
                            </Text>
                        )}
                        
                        {progress_info.current_pass !== undefined && 
                         progress_info.total_passes !== undefined && (
                            <Text>
                                📊 Pass: {progress_info.current_pass}/{progress_info.total_passes}
                            </Text>
                        )}
                        
                        {progress_info.current_sensor !== undefined && 
                         progress_info.total_sensors !== undefined && (
                            <Text>
                                📡 Sensor: {progress_info.current_sensor}/{progress_info.total_sensors}
                            </Text>
                        )}
                    </Space>
                );
            
            case "fluent":
                return (
                    <Space direction="vertical" style={{ width: "100%" }}>
                        {progress_info.current_iteration !== undefined && (
                            <Text>
                                🔄 迭代步数: 
                                <Text strong style={{ marginLeft: 8 }}>
                                    {progress_info.current_iteration}
                                </Text>
                            </Text>
                        )}
                        
                        {progress_info.continuity_residual !== undefined && (
                            <Text>
                                📉 连续性残差: 
                                <Text strong style={{ marginLeft: 8 }}>
                                    {progress_info.continuity_residual.toExponential(2)}
                                </Text>
                            </Text>
                        )}
                        
                        {progress_info.converged && (
                            <Tag color="success">✅ 已收敛</Tag>
                        )}
                    </Space>
                );
            
            case "maxwell":
                return (
                    <Space direction="vertical" style={{ width: "100%" }}>
                        {progress_info.current_pass !== undefined && (
                            <Text>
                                🔄 自适应 Pass: 
                                <Text strong style={{ marginLeft: 8 }}>
                                    {progress_info.current_pass}
                                </Text>
                            </Text>
                        )}
                        
                        {progress_info.status && (
                            <Text>
                                📊 状态: 
                                <Text strong style={{ marginLeft: 8 }}>
                                    {progress_info.status}
                                </Text>
                            </Text>
                        )}
                        
                        {progress_info.converged && (
                            <Tag color="success">✅ 已收敛</Tag>
                        )}
                    </Space>
                );
            
            case "mechanical":
                return (
                    <Space direction="vertical" style={{ width: "100%" }}>
                        {progress_info.load_step !== undefined && (
                            <Text>📊 载荷步: {progress_info.load_step}</Text>
                        )}
                        
                        {progress_info.substep !== undefined && (
                            <Text>🔹 子步: {progress_info.substep}</Text>
                        )}
                        
                        {progress_info.iteration !== undefined && (
                            <Text>🔄 迭代: {progress_info.iteration}</Text>
                        )}
                        
                        {progress_info.converged && (
                            <Tag color="success">✅ 已收敛</Tag>
                        )}
                    </Space>
                );
            
            default:
                return (
                    <Spin tip="求解中..." />
                );
        }
    };
    
    return (
        <div className="task-progress">
            <Text strong>求解进度</Text>
            {renderProgress()}
        </div>
    );
};

export default TaskProgressDisplay;
```

---

## 🎯 参数验证规则

### SPEOS 参数验证

```typescript
const validateSPEOSParams = (values: any) => {
    // thread_count 是可选的，但如果提供，必须是数字
    if (values.thread_count && isNaN(parseInt(values.thread_count))) {
        return "线程数必须是数字";
    }
    
    // ray_count 如果提供，必须是正整数
    if (values.ray_count && (isNaN(parseInt(values.ray_count)) || parseInt(values.ray_count) <= 0)) {
        return "光线数必须是正整数";
    }
    
    return null;
};
```

### FLUENT 参数验证

```typescript
const validateFLUENTParams = (values: any) => {
    // iterations 必须是正整数
    if (values.iterations && (isNaN(values.iterations) || values.iterations <= 0)) {
        return "迭代步数必须是正整数";
    }
    
    // dimension 必须是 2d 或 3d
    if (values.dimension && !["2d", "3d"].includes(values.dimension)) {
        return "维度必须是 2d 或 3d";
    }
    
    // precision 必须是 sp 或 dp
    if (values.precision && !["sp", "dp"].includes(values.precision)) {
        return "精度必须是 sp 或 dp";
    }
    
    return null;
};
```

---

## 🔄 迁移指南

### 阶段1：最小改动（1-2 小时）

只需在任务提交时添加 `solver_type` 字段：

```diff
  const submitData = {
      task_id: taskId,
      master_object_key: objectKey,
+     solver_type: "speos",  // 或从表单获取
      job_name: jobName,
      // ... 其他字段 ...
  };
```

### 阶段2：添加选择器（半天）

添加求解器选择器和动态参数表单。

### 阶段3：优化显示（1 天）

优化进度显示、任务列表显示等。

---

## 📞 技术支持

### 联系方式

- **后端负责人**：Tony
- **文档位置**：`docs/` 目录
- **测试环境**：http://your-test-server:8000

### 常见问题

1. **Q**: 旧任务的 `solver_type` 是什么？  
   **A**: `undefined` 或 `"speos"`，前端应兼容处理

2. **Q**: `progress_info` 的字段名冲突怎么办？  
   **A**: 根据 `solver_type` 区分语义

3. **Q**: 如何测试新功能？  
   **A**: 联系后端团队获取测试账号和数据

---

**文档版本**：v2.1.0  
**最后更新**：2025-12-03  
**状态**：✅ Ready for Frontend Team


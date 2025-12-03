# 🔄 前端对接指南 - 多求解器架构升级

## 📋 文档概述

**目标读者**：前端开发团队  
**后端版本**：v2.1.0（四求解器架构）  
**更新日期**：2025-12-03  
**优先级**：🔥 高（建议尽快对接）

---

## 🎯 后端更新概述

### 核心变化

后端已从**单一 SPEOS 系统**升级为**支持 4 种 ANSYS 求解器**的通用架构：

| 求解器 | 类型 | solver_type 值 | 应用领域 |
|--------|------|----------------|----------|
| **SPEOS** | 光学仿真 | `"speos"` | 照明、光学系统设计 |
| **FLUENT** | CFD 流体力学 | `"fluent"` | 流体、传热、多相流 |
| **Maxwell** | 电磁场仿真 | `"maxwell"` | 电机、变压器、天线设计 |
| **Mechanical** | 结构力学 | `"mechanical"` | 应力、模态、热分析 |

### 向后兼容性 ✅

**重要**：所有现有的前端代码**无需强制修改**即可继续工作！

- ✅ 所有现有 API 端点保持不变
- ✅ 所有现有请求参数保持不变
- ✅ 不指定 `solver_type` 时默认使用 `"speos"`
- ✅ 所有现有 SPEOS 任务正常运行

---

## 📡 API 接口变化

### 1. 任务提交接口（重要）

#### 端点：`POST /api/tasks/upload/confirm`

#### ⭐ 新增字段

```typescript
interface ConfirmUploadRequest {
    task_id: string;
    master_object_key: string;
    include_object_key?: string;
    
    // ⭐ 新增：求解器类型（可选，默认 "speos"）
    solver_type?: "speos" | "fluent" | "maxwell" | "mechanical";
    
    // 任务元信息
    profile_name?: string;
    version?: string;
    job_name: string;
    submitter?: string;
    
    // ========== SPEOS 参数（solver_type="speos" 或未指定时）==========
    use_gpu?: boolean;
    simulation_index?: string;
    thread_count?: string;
    priority?: string;
    ray_count?: string;
    duration_minutes?: string;
    hpc_job_name?: string;
    node_count?: string;
    walltime_hours?: string;
    
    // ========== FLUENT 参数（solver_type="fluent" 时）==========
    dimension?: "2d" | "3d";           // 维度（默认 "3d"）
    precision?: "sp" | "dp";           // 精度：sp=单精度，dp=双精度（默认 "dp"）
    iterations?: number;               // 迭代步数（默认 100）
    initialization_method?: "hyb" | "standard";  // 初始化方法（默认 "hyb"）
    
    // ========== Maxwell 参数（solver_type="maxwell" 时）==========
    num_cores?: string;                // 核心数（Maxwell/Mechanical 通用）
    design_name?: string;              // Maxwell 设计名称（可选）
    
    // ========== Mechanical 参数（solver_type="mechanical" 时）==========
    // num_cores: 与 Maxwell 共用
}
```

#### 示例1：SPEOS 任务（向后兼容，无需修改）

```typescript
// 方式1：不指定 solver_type（默认 speos）
const requestData = {
    task_id: "speos-001",
    master_object_key: "tasks/speos-001/model.scdoc",
    job_name: "照明仿真",
    thread_count: "16",
    use_gpu: true
};

// 方式2：明确指定 solver_type（推荐）
const requestData = {
    task_id: "speos-001",
    master_object_key: "tasks/speos-001/model.scdoc",
    solver_type: "speos",  // ⭐ 明确指定
    job_name: "照明仿真",
    thread_count: "16",
    use_gpu: true
};
```

#### 示例2：FLUENT 任务（新功能）

```typescript
const requestData = {
    task_id: "fluent-001",
    master_object_key: "tasks/fluent-001/airfoil.cas.h5",
    solver_type: "fluent",  // ⭐ 必须指定
    job_name: "机翼气动分析",
    
    // FLUENT 特定参数
    dimension: "3d",
    precision: "dp",
    iterations: 1000,
    thread_count: "8",
    initialization_method: "hyb"
};
```

#### 示例3：Maxwell 任务（新功能）

```typescript
const requestData = {
    task_id: "maxwell-001",
    master_object_key: "tasks/maxwell-001/motor.aedt",
    solver_type: "maxwell",  // ⭐ 必须指定
    job_name: "电机电磁分析",
    num_cores: "8"
};
```

#### 示例4：Mechanical 任务（新功能）

```typescript
const requestData = {
    task_id: "mechanical-001",
    master_object_key: "tasks/mechanical-001/structure.dat",
    solver_type: "mechanical",  // ⭐ 必须指定
    job_name: "结构强度分析",
    num_cores: "8"
};
```

---

### 2. 任务查询接口

#### 端点：`GET /api/tasks/{task_id}/detail`

#### ⭐ 新增字段

```typescript
interface TaskDetail {
    task_id: string;
    status: string;
    created_at?: number;
    
    // ⭐ 新增：求解器类型
    solver_type?: string;  // "speos" | "fluent" | "maxwell" | "mechanical"
    
    // 原有字段保持不变
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
    status_history?: Array<any>;
    
    // ⭐ 进度信息（根据 solver_type 不同而不同）
    progress_info?: {
        // SPEOS 进度字段
        progress_percent?: number;      // 进度百分比 (0-100)
        estimated_time?: string;        // 剩余时间 "2 hours 15 min"
        current_pass?: number;          // 当前 Pass
        total_passes?: number;          // 总 Pass 数
        current_sensor?: number;        // 当前 Sensor
        total_sensors?: number;         // 总 Sensor 数
        
        // FLUENT 进度字段
        current_iteration?: number;     // 当前迭代步数
        continuity_residual?: number;   // 连续性残差（科学计数法）
        
        // Maxwell 进度字段
        current_pass?: number;          // 自适应 Pass
        status?: string;                // "solving", "converged"
        
        // Mechanical 进度字段
        load_step?: number;             // 载荷步
        substep?: number;               // 子步
        iteration?: number;             // 迭代
    };
}
```

---

## 🎨 前端需要适配的内容

### ✅ 必须修改（核心功能）

#### 1. 任务提交表单

**位置**：任务创建/上传页面

**修改内容**：

```tsx
// 添加求解器类型选择
const [solverType, setSolverType] = useState<string>("speos");

<Select 
    value={solverType} 
    onChange={setSolverType}
    label="求解器类型"
>
    <Option value="speos">SPEOS - 光学仿真</Option>
    <Option value="fluent">FLUENT - 流体力学</Option>
    <Option value="maxwell">Maxwell - 电磁场</Option>
    <Option value="mechanical">Mechanical - 结构力学</Option>
</Select>

// 根据 solverType 显示不同的参数表单
{solverType === "speos" && (
    <>
        <Input label="线程数" name="thread_count" />
        <Checkbox label="使用 GPU" name="use_gpu" />
        <Input label="光线数" name="ray_count" />
    </>
)}

{solverType === "fluent" && (
    <>
        <Select label="维度" name="dimension" defaultValue="3d">
            <Option value="2d">2D</Option>
            <Option value="3d">3D</Option>
        </Select>
        <Select label="精度" name="precision" defaultValue="dp">
            <Option value="sp">单精度（快速）</Option>
            <Option value="dp">双精度（准确）</Option>
        </Select>
        <Input label="迭代步数" name="iterations" type="number" defaultValue={100} />
        <Input label="核心数" name="thread_count" />
    </>
)}

{solverType === "maxwell" && (
    <>
        <Input label="核心数" name="num_cores" defaultValue="4" />
        <Input label="设计名称" name="design_name" placeholder="可选" />
    </>
)}

{solverType === "mechanical" && (
    <>
        <Input label="核心数" name="num_cores" defaultValue="4" />
    </>
)}

// 提交时包含 solver_type
const submitTask = async () => {
    const data = {
        task_id: taskId,
        master_object_key: objectKey,
        solver_type: solverType,  // ⭐ 添加这个字段
        // ... 其他参数 ...
    };
    
    await fetch("/api/tasks/upload/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });
};
```

#### 2. 任务列表显示

**位置**：任务列表页面

**修改内容**：

```tsx
interface TaskListItem {
    task_id: string;
    status: string;
    created_at?: number;
    job_name?: string;
    display_name?: string;
    submitter?: string;
    duration?: number;
    solver_type?: string;  // ⭐ 新增字段
}

// 显示求解器图标或标签
const getSolverIcon = (solverType?: string) => {
    switch (solverType) {
        case "speos": return "💡";      // 光学
        case "fluent": return "🌊";     // 流体
        case "maxwell": return "⚡";    // 电磁
        case "mechanical": return "🔧"; // 结构
        default: return "📊";
    }
};

const getSolverLabel = (solverType?: string) => {
    switch (solverType) {
        case "speos": return "SPEOS";
        case "fluent": return "FLUENT";
        case "maxwell": return "Maxwell";
        case "mechanical": return "Mechanical";
        default: return "未知";
    }
};

// 在任务列表中显示
<Table>
    {tasks.map(task => (
        <TableRow key={task.task_id}>
            <TableCell>
                {getSolverIcon(task.solver_type)} {getSolverLabel(task.solver_type)}
            </TableCell>
            <TableCell>{task.display_name}</TableCell>
            <TableCell>{task.status}</TableCell>
            {/* ... */}
        </TableRow>
    ))}
</Table>
```

#### 3. 进度显示（最重要）

**位置**：任务详情页面

**修改内容**：

```tsx
// 根据 solver_type 显示不同的进度信息
const ProgressDisplay: React.FC<{ task: TaskDetail }> = ({ task }) => {
    const { solver_type, progress_info, status } = task;
    
    // 只在运行状态显示进度
    if (!["STARTED", "RUNNING", "PROGRESS"].includes(status)) {
        return null;
    }
    
    if (!progress_info) {
        return <Spin tip="求解中，等待进度信息..." />;
    }
    
    switch (solver_type) {
        case "speos":
        case undefined:  // 向后兼容（旧任务没有 solver_type）
            return <SPEOSProgress progress={progress_info} />;
        
        case "fluent":
            return <FLUENTProgress progress={progress_info} />;
        
        case "maxwell":
            return <MaxwellProgress progress={progress_info} />;
        
        case "mechanical":
            return <MechanicalProgress progress={progress_info} />;
        
        default:
            return <DefaultProgress progress={progress_info} />;
    }
};

// SPEOS 进度组件
const SPEOSProgress: React.FC<{ progress: any }> = ({ progress }) => (
    <Space direction="vertical" style={{ width: "100%" }}>
        {/* 进度条 */}
        {progress.progress_percent !== undefined && (
            <Progress 
                percent={progress.progress_percent} 
                status="active"
                format={(percent) => `${percent?.toFixed(1)}%`}
            />
        )}
        
        {/* 剩余时间 */}
        {progress.estimated_time && (
            <Text>⏰ 预计剩余时间: <Text strong>{progress.estimated_time}</Text></Text>
        )}
        
        {/* Pass 信息 */}
        {progress.current_pass !== undefined && progress.total_passes !== undefined && (
            <Text>📊 Pass: {progress.current_pass}/{progress.total_passes}</Text>
        )}
        
        {/* Sensor 信息 */}
        {progress.current_sensor !== undefined && progress.total_sensors !== undefined && (
            <Text>📡 Sensor: {progress.current_sensor}/{progress.total_sensors}</Text>
        )}
    </Space>
);

// FLUENT 进度组件
const FLUENTProgress: React.FC<{ progress: any }> = ({ progress }) => (
    <Space direction="vertical" style={{ width: "100%" }}>
        {/* 迭代步数 */}
        {progress.current_iteration !== undefined && (
            <Text>🔄 迭代步数: <Text strong>{progress.current_iteration}</Text></Text>
        )}
        
        {/* 残差值 */}
        {progress.continuity_residual !== undefined && (
            <Text>
                📉 连续性残差: 
                <Text strong>{progress.continuity_residual.toExponential(2)}</Text>
            </Text>
        )}
        
        {/* 收敛状态 */}
        {progress.converged && (
            <Tag color="success">✅ 已收敛</Tag>
        )}
    </Space>
);

// Maxwell 进度组件
const MaxwellProgress: React.FC<{ progress: any }> = ({ progress }) => (
    <Space direction="vertical" style={{ width: "100%" }}>
        {/* 自适应 Pass */}
        {progress.current_pass !== undefined && (
            <Text>🔄 自适应 Pass: <Text strong>{progress.current_pass}</Text></Text>
        )}
        
        {/* 状态 */}
        {progress.status && (
            <Text>📊 状态: <Text strong>{progress.status}</Text></Text>
        )}
        
        {/* 收敛状态 */}
        {progress.converged && (
            <Tag color="success">✅ 已收敛</Tag>
        )}
    </Space>
);

// Mechanical 进度组件
const MechanicalProgress: React.FC<{ progress: any }> = ({ progress }) => (
    <Space direction="vertical" style={{ width: "100%" }}>
        {/* 载荷步 */}
        {progress.load_step !== undefined && (
            <Text>📊 载荷步: <Text strong>{progress.load_step}</Text></Text>
        )}
        
        {/* 子步 */}
        {progress.substep !== undefined && (
            <Text>🔹 子步: <Text strong>{progress.substep}</Text></Text>
        )}
        
        {/* 迭代 */}
        {progress.iteration !== undefined && (
            <Text>🔄 迭代: <Text strong>{progress.iteration}</Text></Text>
        )}
        
        {/* 收敛状态 */}
        {progress.converged && (
            <Tag color="success">✅ 已收敛</Tag>
        )}
    </Space>
);
```

---

## 📝 前端修改清单

### 🔥 高优先级（建议立即实施）

#### 1. 添加求解器类型选择器（任务提交页面）

**文件**：`TaskSubmitForm.tsx` 或类似文件

**修改**：
```tsx
// 添加 solver_type 选择器
<FormItem label="求解器类型" name="solver_type">
    <Select defaultValue="speos">
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
</FormItem>
```

#### 2. 动态参数表单（根据 solver_type 显示不同参数）

**文件**：`TaskSubmitForm.tsx`

**修改**：
```tsx
const [solverType, setSolverType] = useState("speos");

// 监听 solver_type 变化
<Select 
    value={solverType} 
    onChange={(value) => setSolverType(value)}
>
    {/* ... */}
</Select>

// 根据 solver_type 显示不同的表单
{solverType === "speos" && <SPEOSParamsForm />}
{solverType === "fluent" && <FLUENTParamsForm />}
{solverType === "maxwell" && <MaxwellParamsForm />}
{solverType === "mechanical" && <MechanicalParamsForm />}
```

#### 3. 进度显示组件更新

**文件**：`TaskProgress.tsx` 或 `TaskDetail.tsx`

**修改**：使用上面提供的 `ProgressDisplay` 组件

---

### 🟡 中优先级（建议近期实施）

#### 4. 任务列表显示求解器类型

**文件**：`TaskList.tsx`

**修改**：
```tsx
// 在表头添加"求解器"列
<TableHeader>
    <TableColumn>任务ID</TableColumn>
    <TableColumn>求解器</TableColumn>  {/* ⭐ 新增 */}
    <TableColumn>任务名称</TableColumn>
    <TableColumn>状态</TableColumn>
    {/* ... */}
</TableHeader>

// 在数据行显示求解器信息
<TableRow>
    <TableCell>{task.task_id}</TableCell>
    <TableCell>
        <Tag color={getSolverColor(task.solver_type)}>
            {getSolverIcon(task.solver_type)} {getSolverLabel(task.solver_type)}
        </Tag>
    </TableCell>
    <TableCell>{task.display_name}</TableCell>
    {/* ... */}
</TableRow>
```

#### 5. 文件上传验证

**文件**：文件上传组件

**修改**：根据 solver_type 验证文件扩展名

```tsx
const getAcceptedExtensions = (solverType: string) => {
    switch (solverType) {
        case "speos":
            return ".scdoc,.xmp,.speos";
        case "fluent":
            return ".cas,.cas.h5,.cas.gz,.dat,.dat.h5,.jou";
        case "maxwell":
            return ".aedt,.maxwell3d,.maxwell2d,.aedtz";
        case "mechanical":
            return ".dat,.inp,.mac,.db,.wbpj";
        default:
            return "*";
    }
};

<Upload 
    accept={getAcceptedExtensions(solverType)}
    // ...
/>
```

---

### 🟢 低优先级（可选，建议未来实施）

#### 6. 求解器统计仪表板

显示各求解器的使用统计：

```tsx
<Statistics>
    <Statistic title="SPEOS 任务" value={speosCount} prefix="💡" />
    <Statistic title="FLUENT 任务" value={fluentCount} prefix="🌊" />
    <Statistic title="Maxwell 任务" value={maxwellCount} prefix="⚡" />
    <Statistic title="Mechanical 任务" value={mechanicalCount} prefix="🔧" />
</Statistics>
```

#### 7. 求解器帮助文档

添加每个求解器的使用说明和参数帮助。

---

## 🔧 参数对照表

### SPEOS 参数（保持不变）

| 前端字段 | 类型 | 说明 | 默认值 |
|----------|------|------|--------|
| thread_count | string | 线程数 | - |
| use_gpu | boolean | 是否使用 GPU | false |
| ray_count | string | 光线数 | - |
| priority | string | 优先级 | "2" |
| duration_minutes | string | 持续时间（分钟） | - |

### FLUENT 参数（新增）

| 前端字段 | 类型 | 说明 | 默认值 |
|----------|------|------|--------|
| dimension | "2d" \| "3d" | 维度 | "3d" |
| precision | "sp" \| "dp" | 精度（sp=单精度，dp=双精度） | "dp" |
| iterations | number | 迭代步数 | 100 |
| thread_count | string | 核心数 | - |
| initialization_method | "hyb" \| "standard" | 初始化方法 | "hyb" |

### Maxwell 参数（新增）

| 前端字段 | 类型 | 说明 | 默认值 |
|----------|------|------|--------|
| num_cores | string | 核心数 | "4" |
| design_name | string | 设计名称（可选） | - |

### Mechanical 参数（新增）

| 前端字段 | 类型 | 说明 | 默认值 |
|----------|------|------|--------|
| num_cores | string | 核心数 | "4" |

---

## 🎯 TypeScript 类型定义

```typescript
// types/api.ts

/**
 * 求解器类型
 */
export type SolverType = "speos" | "fluent" | "maxwell" | "mechanical";

/**
 * 任务提交请求
 */
export interface ConfirmUploadRequest {
    task_id: string;
    master_object_key: string;
    include_object_key?: string;
    
    // 求解器类型（默认 "speos"）
    solver_type?: SolverType;
    
    // 任务元信息
    profile_name?: string;
    version?: string;
    job_name: string;
    submitter?: string;
    project_dir?: string;
    include_path?: string;
    
    // SPEOS 参数
    use_gpu?: boolean;
    simulation_index?: string;
    thread_count?: string;
    priority?: string;
    ray_count?: string;
    duration_minutes?: string;
    hpc_job_name?: string;
    node_count?: string;
    walltime_hours?: string;
    
    // FLUENT 参数
    dimension?: "2d" | "3d";
    precision?: "sp" | "dp";
    iterations?: number;
    initialization_method?: "hyb" | "standard";
    
    // Maxwell 参数
    num_cores?: string;
    design_name?: string;
    
    // Mechanical 参数
    // num_cores: 与 Maxwell 共用
}

/**
 * 进度信息（根据 solver_type 不同）
 */
export interface ProgressInfo {
    // SPEOS 字段
    progress_percent?: number;
    estimated_time?: string;
    current_pass?: number;
    total_passes?: number;
    current_sensor?: number;
    total_sensors?: number;
    
    // FLUENT 字段
    current_iteration?: number;
    continuity_residual?: number;
    progress_type?: string;
    converged?: boolean;
    
    // Maxwell 字段
    // current_pass: 与 SPEOS 共用
    status?: string;
    
    // Mechanical 字段
    load_step?: number;
    substep?: number;
    iteration?: number;
}

/**
 * 任务详情
 */
export interface TaskDetail {
    task_id: string;
    status: string;
    created_at?: number;
    solver_type?: SolverType;  // ⭐ 新增
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
    status_history?: Array<any>;
    parent_task_id?: string;
    retry_count?: number;
    retried_task_ids?: string[];
    progress_info?: ProgressInfo;  // ⭐ 根据 solver_type 不同
}

/**
 * 任务列表项
 */
export interface TaskListItem {
    task_id: string;
    status: string;
    created_at?: number;
    job_name?: string;
    display_name?: string;
    submitter?: string;
    duration?: number;
    elapsed_seconds?: number;
    solver_type?: SolverType;  // ⭐ 新增
}
```

---

## 🧪 测试建议

### 功能测试

#### 1. SPEOS 任务（向后兼容性）

```typescript
// 测试1：不指定 solver_type
const response = await submitTask({
    task_id: "test-speos-1",
    master_object_key: "...",
    job_name: "测试任务",
    thread_count: "8"
    // 不指定 solver_type
});

// 预期：任务正常提交，自动使用 SPEOS
```

#### 2. FLUENT 任务

```typescript
// 测试2：指定 solver_type="fluent"
const response = await submitTask({
    task_id: "test-fluent-1",
    master_object_key: "...",
    solver_type: "fluent",
    job_name: "CFD分析",
    dimension: "3d",
    precision: "dp",
    iterations: 100
});

// 预期：
// 1. 任务正常提交
// 2. 后端自动生成 Journal 文件
// 3. 进度显示迭代步数和残差
```

#### 3. Maxwell 任务

```typescript
const response = await submitTask({
    task_id: "test-maxwell-1",
    master_object_key: "...",
    solver_type: "maxwell",
    job_name: "电磁分析",
    num_cores: "8"
});

// 预期：任务正常提交和执行
```

#### 4. Mechanical 任务

```typescript
const response = await submitTask({
    task_id: "test-mechanical-1",
    master_object_key: "...",
    solver_type: "mechanical",
    job_name: "结构分析",
    num_cores: "8"
});

// 预期：任务正常提交和执行
```

### 进度监控测试

```typescript
// 轮询任务进度
const pollProgress = async (taskId: string) => {
    const intervalId = setInterval(async () => {
        const response = await fetch(`/api/tasks/${taskId}/detail`);
        const task: TaskDetail = await response.json();
        
        console.log("Solver:", task.solver_type);
        console.log("Status:", task.status);
        console.log("Progress:", task.progress_info);
        
        if (["SUCCESS", "FAILURE"].includes(task.status)) {
            clearInterval(intervalId);
        }
    }, 5000);  // 每5秒查询一次
};
```

---

## 🎨 UI/UX 建议

### 1. 求解器图标和颜色

```tsx
const solverConfig = {
    speos: {
        icon: "💡",
        color: "#FFB800",  // 金黄色（光）
        label: "SPEOS",
        description: "光学仿真"
    },
    fluent: {
        icon: "🌊",
        color: "#1890FF",  // 蓝色（流体）
        label: "FLUENT",
        description: "流体力学"
    },
    maxwell: {
        icon: "⚡",
        color: "#9254DE",  // 紫色（电磁）
        label: "Maxwell",
        description: "电磁场"
    },
    mechanical: {
        icon: "🔧",
        color: "#52C41A",  // 绿色（结构）
        label: "Mechanical",
        description: "结构力学"
    }
};

// 使用
<Tag color={solverConfig[task.solver_type]?.color}>
    {solverConfig[task.solver_type]?.icon} 
    {solverConfig[task.solver_type]?.label}
</Tag>
```

### 2. 参数表单布局建议

```tsx
// 推荐使用 Tab 或 折叠面板 组织参数

<Tabs activeKey={solverType} onChange={setSolverType}>
    <TabPane tab="💡 SPEOS" key="speos">
        <SPEOSParamsForm />
    </TabPane>
    <TabPane tab="🌊 FLUENT" key="fluent">
        <FLUENTParamsForm />
    </TabPane>
    <TabPane tab="⚡ Maxwell" key="maxwell">
        <MaxwellParamsForm />
    </TabPane>
    <TabPane tab="🔧 Mechanical" key="mechanical">
        <MechanicalParamsForm />
    </TabPane>
</Tabs>
```

---

## 🔍 API 响应示例

### 任务提交响应（无变化）

```json
{
    "task_id": "fluent-001",
    "status": "PENDING",
    "message": "Task queued. Files will be downloaded in background and then executed."
}
```

### 任务详情响应（新增字段）

```json
{
    "task_id": "fluent-001",
    "status": "PROGRESS",
    "solver_type": "fluent",  // ⭐ 新增
    "created_at": 1701590400.0,
    "display_name": "airfoil-cfd-20251203",
    "submitter": "user1",
    "params": {
        "solver_type": "fluent",
        "dimension": "3d",
        "precision": "dp",
        "iterations": 1000
    },
    "progress_info": {  // ⭐ FLUENT 特定进度
        "current_iteration": 500,
        "continuity_residual": 1.234e-04,
        "progress_type": "iteration"
    }
}
```

### 任务列表响应（新增字段）

```json
{
    "total": 10,
    "items": [
        {
            "task_id": "speos-001",
            "status": "SUCCESS",
            "solver_type": "speos",  // ⭐ 新增
            "display_name": "照明仿真",
            "duration": 3600.5
        },
        {
            "task_id": "fluent-001",
            "status": "RUNNING",
            "solver_type": "fluent",  // ⭐ 新增
            "display_name": "CFD分析",
            "elapsed_seconds": 300.2
        }
    ]
}
```

---

## 🛡️ 向后兼容性保证

### 前端无需立即修改的原因

1. ✅ **solver_type 是可选字段**
   - 不传 `solver_type` 时，后端默认使用 `"speos"`
   - 现有的 SPEOS 任务提交代码无需修改

2. ✅ **所有现有字段保持不变**
   - `task_id`, `status`, `display_name` 等字段位置和类型不变
   - 现有的任务列表和详情页面可以正常显示

3. ✅ **新增字段都是可选的**
   - `solver_type` 字段可能为 `undefined`（旧任务）
   - `progress_info` 中的新字段也是可选的

### 渐进式升级路径

```
阶段1（立即可用）：
- ✅ 不修改前端，继续使用 SPEOS
- ✅ 所有现有功能正常工作

阶段2（推荐实施）：
- 📝 添加 solver_type 选择器
- 📝 适配 FLUENT/Maxwell/Mechanical 参数表单
- 📝 优化进度显示

阶段3（未来优化）：
- 📝 添加求解器统计
- 📝 添加帮助文档
- 📝 优化 UI/UX
```

---

## 📞 技术支持

### 常见问题

#### Q1: 前端必须立即修改吗？

**A**：不需要！所有现有代码可以继续工作。但建议尽快添加 solver_type 支持，以便使用新的求解器。

#### Q2: 如何处理旧任务的 solver_type 字段？

**A**：旧任务的 `solver_type` 可能为 `undefined`，前端应该兼容处理：

```tsx
const solverType = task.solver_type || "speos";  // 默认为 speos
```

#### Q3: 进度信息的字段名有冲突怎么办？

**A**：有些字段在不同求解器中有相同的名字（如 `current_pass`），但语义不同：
- SPEOS 的 `current_pass` 是光线追踪的 Pass
- Maxwell 的 `current_pass` 是自适应网格的 Pass

前端可以根据 `solver_type` 区分处理。

#### Q4: 如何测试新功能？

**A**：联系后端团队获取测试环境和测试数据，或使用 DEBUG_MODE 测试。

---

## 📚 相关文档

### 后端文档

- [四求解器使用指南](./FOUR_SOLVERS_GUIDE.md)
- [架构设计文档](./MULTI_SOLVER_ARCHITECTURE.md)
- [环境配置指南](./ENV_CONFIG_FOUR_SOLVERS.md)

### API 文档

- [任务提交 API](./API_REFERENCE.md#任务提交)
- [任务查询 API](./API_REFERENCE.md#任务查询)
- [进度监控 API](./API_REFERENCE.md#进度监控)

---

## ✅ 前端修改检查清单

### 必须修改（高优先级）

- [ ] 添加 `solver_type` 类型定义
- [ ] 任务提交表单添加 solver_type 选择器
- [ ] 根据 solver_type 显示不同的参数表单
- [ ] 进度显示组件支持 4 种求解器

### 建议修改（中优先级）

- [ ] 任务列表显示 solver_type
- [ ] 文件上传验证（根据 solver_type）
- [ ] 添加求解器图标和颜色

### 可选修改（低优先级）

- [ ] 求解器统计仪表板
- [ ] 求解器使用帮助
- [ ] UI/UX 优化

---

## 🎉 总结

### 后端提供的能力

- ✅ 支持 4 种 ANSYS 求解器
- ✅ 统一的 API 接口
- ✅ 智能错误处理（SPEOS 许可证自动重试）
- ✅ 实时进度监控
- ✅ 100% 向后兼容

### 前端需要做的

**最小改动**：
- 添加 solver_type 选择器
- 根据 solver_type 显示参数
- 适配进度显示

**预计工作量**：
- 核心功能：1-2 天
- UI 优化：1 天
- 测试：0.5 天
- **总计**：2.5-3.5 天

### 优先级建议

1. 🔥 **立即**：添加 solver_type 选择器和基本参数表单
2. 🟡 **本周**：优化进度显示，添加图标
3. 🟢 **下周**：完善 UI/UX，添加帮助文档

---

**文档版本**：v1.0  
**适用后端版本**：v2.1.0  
**建议对接时间**：1 周内  
**技术支持**：随时联系后端团队

---

## 📞 联系方式

如有疑问，请联系：
- **后端技术支持**：Tony
- **文档位置**：`docs/` 目录
- **测试环境**：http://your-test-server:8000

**祝对接顺利！** 🚀


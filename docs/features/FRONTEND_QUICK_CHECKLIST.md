# ⚡ 前端快速对接清单

## 🎯 5 分钟了解核心变化

### 变化概述

后端从**单一 SPEOS** 升级为**4 种求解器**：

```
旧版：只支持 SPEOS
新版：支持 SPEOS + FLUENT + Maxwell + Mechanical
```

### 是否必须立即修改前端？

**答案：否！** ✅ 完全向后兼容

- 现有代码可以继续使用
- 不传 `solver_type` 时默认使用 SPEOS
- 如需使用新求解器，才需要修改

---

## 📝 快速修改指南（3 步）

### Step 1: 添加 solver_type 字段（2 分钟）

```tsx
// 任务提交表单
const [solverType, setSolverType] = useState("speos");

const submitData = {
    task_id: taskId,
    master_object_key: objectKey,
    solver_type: solverType,  // ⭐ 添加这一行
    job_name: jobName,
    // ... 其他参数保持不变 ...
};
```

### Step 2: 添加求解器选择器（5 分钟）

```tsx
<Select 
    value={solverType} 
    onChange={setSolverType}
    defaultValue="speos"
>
    <Option value="speos">💡 SPEOS - 光学</Option>
    <Option value="fluent">🌊 FLUENT - 流体</Option>
    <Option value="maxwell">⚡ Maxwell - 电磁</Option>
    <Option value="mechanical">🔧 Mechanical - 结构</Option>
</Select>
```

### Step 3: 根据 solver_type 显示参数（10 分钟）

```tsx
{/* SPEOS 参数（保持不变）*/}
{solverType === "speos" && (
    <>
        <Input label="线程数" name="thread_count" />
        <Checkbox label="使用 GPU" name="use_gpu" />
    </>
)}

{/* FLUENT 参数（新增）*/}
{solverType === "fluent" && (
    <>
        <Select label="维度" name="dimension" defaultValue="3d">
            <Option value="2d">2D</Option>
            <Option value="3d">3D</Option>
        </Select>
        <Select label="精度" name="precision" defaultValue="dp">
            <Option value="sp">单精度</Option>
            <Option value="dp">双精度</Option>
        </Select>
        <Input label="迭代步数" name="iterations" type="number" defaultValue={100} />
    </>
)}

{/* Maxwell 参数（新增）*/}
{solverType === "maxwell" && (
    <Input label="核心数" name="num_cores" defaultValue="4" />
)}

{/* Mechanical 参数（新增）*/}
{solverType === "mechanical" && (
    <Input label="核心数" name="num_cores" defaultValue="4" />
)}
```

**完成！** 现在可以提交 4 种求解器的任务了。

---

## 📊 进度显示适配（可选，建议实施）

### 简单方案：通用显示

```tsx
// 适用于所有求解器的通用进度显示
const ProgressDisplay = ({ task }) => {
    const { progress_info, solver_type } = task;
    
    if (!progress_info) return <Spin />;
    
    return (
        <div>
            {/* SPEOS 进度 */}
            {progress_info.progress_percent !== undefined && (
                <Progress percent={progress_info.progress_percent} />
            )}
            {progress_info.estimated_time && (
                <Text>⏰ {progress_info.estimated_time}</Text>
            )}
            
            {/* FLUENT 进度 */}
            {progress_info.current_iteration !== undefined && (
                <Text>🔄 迭代: {progress_info.current_iteration}</Text>
            )}
            
            {/* 其他求解器进度 */}
            {progress_info.current_pass && (
                <Text>📊 Pass: {progress_info.current_pass}</Text>
            )}
        </div>
    );
};
```

### 完整方案：分求解器显示

参考 [前端对接指南](./FRONTEND_INTEGRATION_GUIDE_V2.md#3-进度显示最重要) 中的详细代码。

---

## 🔧 TypeScript 类型（必需）

```typescript
// 复制到 types/api.ts

export type SolverType = "speos" | "fluent" | "maxwell" | "mechanical";

export interface ConfirmUploadRequest {
    // ... 现有字段 ...
    solver_type?: SolverType;  // ⭐ 新增
    
    // FLUENT 参数
    dimension?: "2d" | "3d";
    precision?: "sp" | "dp";
    iterations?: number;
    
    // Maxwell/Mechanical 参数
    num_cores?: string;
    design_name?: string;  // Maxwell 专用
}

export interface TaskDetail {
    // ... 现有字段 ...
    solver_type?: SolverType;  // ⭐ 新增
}

export interface TaskListItem {
    // ... 现有字段 ...
    solver_type?: SolverType;  // ⭐ 新增
}
```

---

## ✅ 测试检查清单

### 向后兼容性测试

- [ ] 不指定 solver_type 时，SPEOS 任务正常提交
- [ ] 旧的任务列表正常显示
- [ ] 旧的任务详情正常显示

### 新功能测试

- [ ] 可以选择 4 种求解器
- [ ] FLUENT 任务可以提交
- [ ] Maxwell 任务可以提交
- [ ] Mechanical 任务可以提交
- [ ] 进度信息正确显示

---

## 📞 需要帮助？

### 联系方式

- **后端技术支持**：Tony
- **详细文档**：[FRONTEND_INTEGRATION_GUIDE_V2.md](./FRONTEND_INTEGRATION_GUIDE_V2.md)
- **测试环境**：http://your-test-server:8000

### 快速测试命令

```bash
# 测试 API 是否正常
curl http://localhost:8000/api/tasks

# 测试提交 FLUENT 任务
curl -X POST http://localhost:8000/api/tasks/upload/confirm \
  -H "Content-Type: application/json" \
  -d '{"task_id":"test","master_object_key":"...","solver_type":"fluent"}'
```

---

## 🎊 总结

### 核心要点

1. ✅ **向后兼容** - 现有代码无需修改
2. 🔥 **新增字段** - `solver_type`（可选，默认 "speos"）
3. 📊 **新功能** - 支持 FLUENT, Maxwell, Mechanical
4. ⏱️ **工作量** - 核心功能约 2 天

### 建议优先级

1. 🔥 **立即**：添加 solver_type 选择器
2. 🟡 **本周**：适配参数表单
3. 🟢 **下周**：优化进度显示

**预计总工作量**：2.5-3.5 天

---

**文档版本**：v1.0 - Quick Checklist  
**更新日期**：2025-12-03  
**状态**：✅ Ready for Frontend Team


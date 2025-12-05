# 前端 Structure (Mechanical) 模块参数调整指南

## 📋 概述

本文档说明前端在支持 ANSYS Mechanical (Structure) 结构分析模块时需要进行的参数调整。

**更新日期**: 2025-12-04  
**后端版本**: 已完成 Mechanical 求解器更新  
**影响范围**: 任务提交表单、参数验证

---

## 🎯 核心调整

### 1. 已有的通用参数（无需调整）

✅ 以下参数已经在现有前端中，**完全不需要修改**：

| 参数名 | 类型 | 说明 | 是否必需 |
|-------|------|------|---------|
| `solver_type` | string | 求解器类型 | ✅ 必需 |
| `master_object_key` | string | 输入文件的 TOS 对象键 | ✅ 必需 |
| `job_name` | string | 任务名称 | ✅ 必需 |
| `submitter` | string | 提交者 | ✅ 必需 |
| `thread_count` | string | 并行核心数 | ✅ 推荐 |

### 2. Mechanical 特定调整

#### 2.1 `solver_type` 字段

**当前值**: `"speos"` (默认)  
**新增值**: `"mechanical"` (Structure 结构分析)

```typescript
// 前端需要添加 solver_type 选择
const solverTypes = [
  { value: "speos", label: "SPEOS (光学)" },
  { value: "fluent", label: "FLUENT (流体)" },
  { value: "maxwell", label: "Maxwell (电磁)" },
  { value: "mechanical", label: "Mechanical (结构)" },  // ⬅️ 新增
];
```

#### 2.2 动态表单字段

根据 `solver_type` 的不同，显示不同的参数表单：

| 字段 | SPEOS | FLUENT | MAXWELL | MECHANICAL |
|------|-------|--------|---------|------------|
| `profile_name` | ✅ | ❌ | ❌ | ❌ |
| `version` | ✅ | ❌ | ❌ | ❌ |
| `use_gpu` | ✅ | ❌ | ❌ | ❌ |
| `simulation_index` | ✅ | ❌ | ❌ | ❌ |
| `thread_count` | ✅ | ✅ | ✅ | ✅ |
| `dimension` | ❌ | ✅ | ❌ | ❌ |
| `precision` | ❌ | ✅ | ❌ | ❌ |
| `iterations` | ❌ | ✅ | ❌ | ❌ |
| `num_cores` | ❌ | ❌ | ✅ | ✅ |

---

## 💻 前端代码调整

### 方案 1: 最简单的调整（推荐）

**如果你的前端已经有 `solver_type` 选择器**，只需要：

#### 步骤 1: 添加 `mechanical` 选项

```typescript
// 在 solver_type 下拉框中添加选项
<Select
  value={solverType}
  onChange={setSolverType}
>
  <Option value="speos">SPEOS (光学)</Option>
  <Option value="fluent">FLUENT (流体)</Option>
  <Option value="maxwell">Maxwell (电磁)</Option>
  <Option value="mechanical">Mechanical (结构)</Option>  {/* ⬅️ 新增 */}
</Select>
```

#### 步骤 2: 条件渲染参数表单

```typescript
// 根据 solver_type 显示不同的参数
{solverType === 'speos' && (
  <>
    {/* SPEOS 特有参数 */}
    <FormItem label="Profile">
      <Input value={profileName} onChange={setProfileName} />
    </FormItem>
    <FormItem label="版本">
      <Input value={version} onChange={setVersion} />
    </FormItem>
    <FormItem label="使用 GPU">
      <Checkbox checked={useGpu} onChange={setUseGpu} />
    </FormItem>
  </>
)}

{solverType === 'mechanical' && (
  <>
    {/* Mechanical 特有参数 */}
    <FormItem label="核心数" required>
      <Input 
        type="number"
        value={threadCount} 
        onChange={setThreadCount}
        placeholder="8"
      />
    </FormItem>
    <FormItem label="任务标识" help="用于文件命名">
      <Input 
        value={jobKey} 
        onChange={setJobKey}
        placeholder="wing_001"
      />
    </FormItem>
  </>
)}

{/* 通用参数（所有求解器都需要） */}
<FormItem label="任务名称" required>
  <Input value={jobName} onChange={setJobName} />
</FormItem>
<FormItem label="提交者" required>
  <Input value={submitter} onChange={setSubmitter} />
</FormItem>
```

#### 步骤 3: 提交时包含 `solver_type`

```typescript
// 确认上传时传递 solver_type
const confirmUpload = async () => {
  const response = await fetch('/api/tasks/upload/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task_id: taskId,
      master_object_key: masterObjectKey,
      solver_type: solverType,  // ⬅️ 重要：必须传递
      job_name: jobName,
      job_key: jobKey,  // ⬅️ Mechanical 推荐传递
      submitter: submitter,
      thread_count: threadCount,
      // 根据 solver_type 只传对应的参数
      ...(solverType === 'speos' && {
        profile_name: profileName,
        version: version,
        use_gpu: useGpu,
      }),
    }),
  });
};
```

---

### 方案 2: 完整的参数管理（推荐复杂场景）

如果你需要更好的参数管理，可以使用配置化的方式：

```typescript
// 定义每个求解器的参数配置
const SOLVER_CONFIGS = {
  speos: {
    label: 'SPEOS (光学)',
    fields: [
      { name: 'profile_name', label: 'Profile', type: 'text', default: 'Standard' },
      { name: 'version', label: '版本', type: 'text', default: 'v252' },
      { name: 'thread_count', label: '线程数', type: 'number', default: '8' },
      { name: 'use_gpu', label: '使用 GPU', type: 'checkbox', default: false },
      { name: 'simulation_index', label: 'Simulation Index', type: 'text' },
    ],
  },
  fluent: {
    label: 'FLUENT (流体)',
    fields: [
      { name: 'dimension', label: '维度', type: 'select', options: ['2d', '3d'], default: '3d' },
      { name: 'precision', label: '精度', type: 'select', options: ['sp', 'dp'], default: 'dp' },
      { name: 'thread_count', label: '核心数', type: 'number', default: '8' },
      { name: 'iterations', label: '迭代次数', type: 'number', default: 100 },
    ],
  },
  maxwell: {
    label: 'Maxwell (电磁)',
    fields: [
      { name: 'num_cores', label: '核心数', type: 'number', default: '8' },
      { name: 'design_name', label: '设计名称', type: 'text' },
    ],
  },
  mechanical: {
    label: 'Mechanical (结构)',
    fields: [
      { name: 'thread_count', label: '核心数', type: 'number', default: '8', required: true },
      { name: 'job_key', label: '任务标识', type: 'text', help: '用于文件命名，建议使用简短的英文标识' },
    ],
  },
};

// 动态渲染表单
const SolverParamsForm = ({ solverType, params, onChange }) => {
  const config = SOLVER_CONFIGS[solverType];
  
  return (
    <>
      <h3>{config.label} 参数</h3>
      {config.fields.map(field => (
        <FormItem 
          key={field.name}
          label={field.label}
          required={field.required}
          help={field.help}
        >
          {field.type === 'number' && (
            <Input
              type="number"
              value={params[field.name] || field.default}
              onChange={(e) => onChange(field.name, e.target.value)}
            />
          )}
          {field.type === 'text' && (
            <Input
              value={params[field.name] || field.default || ''}
              onChange={(e) => onChange(field.name, e.target.value)}
            />
          )}
          {field.type === 'checkbox' && (
            <Checkbox
              checked={params[field.name] || field.default}
              onChange={(e) => onChange(field.name, e.target.checked)}
            />
          )}
          {field.type === 'select' && (
            <Select
              value={params[field.name] || field.default}
              onChange={(value) => onChange(field.name, value)}
            >
              {field.options.map(opt => (
                <Option key={opt} value={opt}>{opt}</Option>
              ))}
            </Select>
          )}
        </FormItem>
      ))}
    </>
  );
};
```

---

## 📝 完整示例代码

### React + TypeScript 示例

```typescript
import React, { useState } from 'react';
import { Form, Input, Select, InputNumber, Button, message } from 'antd';

const { Option } = Select;

interface MechanicalTaskFormProps {
  taskId: string;
  masterObjectKey: string;
  onSuccess: (taskId: string) => void;
}

const MechanicalTaskForm: React.FC<MechanicalTaskFormProps> = ({
  taskId,
  masterObjectKey,
  onSuccess
}) => {
  const [form] = Form.useForm();
  const [solverType, setSolverType] = useState<string>('mechanical');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (values: any) => {
    setSubmitting(true);

    try {
      const response = await fetch('/api/tasks/upload/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: taskId,
          master_object_key: masterObjectKey,
          solver_type: values.solver_type,
          job_name: values.job_name,
          job_key: values.job_key,
          submitter: values.submitter,
          thread_count: values.thread_count.toString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`提交失败: ${response.statusText}`);
      }

      const data = await response.json();
      message.success('任务提交成功！');
      onSuccess(data.task_id);

    } catch (error: any) {
      message.error(`提交失败: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      initialValues={{
        solver_type: 'mechanical',
        thread_count: 8,
      }}
    >
      {/* 求解器类型 */}
      <Form.Item
        label="求解器类型"
        name="solver_type"
        rules={[{ required: true }]}
      >
        <Select onChange={setSolverType}>
          <Option value="speos">SPEOS (光学)</Option>
          <Option value="fluent">FLUENT (流体)</Option>
          <Option value="maxwell">Maxwell (电磁)</Option>
          <Option value="mechanical">Mechanical (结构)</Option>
        </Select>
      </Form.Item>

      {/* 通用参数 */}
      <Form.Item
        label="任务名称"
        name="job_name"
        rules={[{ required: true, message: '请输入任务名称' }]}
      >
        <Input placeholder="例如：机翼应力分析" />
      </Form.Item>

      <Form.Item
        label="提交者"
        name="submitter"
        rules={[{ required: true, message: '请输入提交者姓名' }]}
      >
        <Input placeholder="您的姓名" />
      </Form.Item>

      {/* Mechanical 特定参数 */}
      {solverType === 'mechanical' && (
        <>
          <Form.Item
            label="并行核心数"
            name="thread_count"
            rules={[{ required: true, message: '请输入核心数' }]}
            help="建议值：8, 16, 32"
          >
            <InputNumber
              min={1}
              max={128}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            label="任务标识"
            name="job_key"
            help="用于文件命名，建议使用简短的英文标识（如：wing_001）"
          >
            <Input placeholder="wing_001" />
          </Form.Item>
        </>
      )}

      {/* 提交按钮 */}
      <Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          loading={submitting}
          block
        >
          提交任务
        </Button>
      </Form.Item>
    </Form>
  );
};

export default MechanicalTaskForm;
```

---

## 🔍 参数验证规则

### 必填参数

| 参数 | 验证规则 | 错误提示 |
|------|---------|---------|
| `solver_type` | 必填，且必须是 "mechanical" | "请选择求解器类型" |
| `job_name` | 必填，长度 > 0 | "请输入任务名称" |
| `submitter` | 必填，长度 > 0 | "请输入提交者" |
| `thread_count` | 必填，数字，≥ 1 | "请输入有效的核心数" |

### 可选参数

| 参数 | 默认值 | 建议 |
|------|-------|------|
| `job_key` | 自动生成 | 建议手动输入，便于识别 |

### 前端验证示例

```typescript
const validateMechanicalParams = (values: any): string[] => {
  const errors: string[] = [];

  if (!values.solver_type || values.solver_type !== 'mechanical') {
    errors.push('求解器类型必须为 Mechanical');
  }

  if (!values.job_name || values.job_name.trim() === '') {
    errors.push('请输入任务名称');
  }

  if (!values.submitter || values.submitter.trim() === '') {
    errors.push('请输入提交者');
  }

  if (!values.thread_count || values.thread_count < 1) {
    errors.push('核心数必须大于0');
  }

  // job_key 的验证（如果提供）
  if (values.job_key && !/^[a-zA-Z0-9_-]+$/.test(values.job_key)) {
    errors.push('任务标识只能包含字母、数字、下划线和连字符');
  }

  return errors;
};
```

---

## 📊 API 请求示例

### 完整的提交请求

```typescript
// POST /api/tasks/upload/confirm
{
  "task_id": "task_20251204_abc123",
  "master_object_key": "speos_tasks/2025/12/04/task_20251204_abc123/master/job.dat",
  "solver_type": "mechanical",  // ⬅️ 关键：指定为 mechanical
  "job_name": "机翼应力分析",
  "job_key": "wing_001",  // ⬅️ 推荐：用于文件命名
  "submitter": "张三",
  "thread_count": "8"  // ⬅️ 必需：并行核心数
}
```

### 成功响应

```json
{
  "task_id": "celery_task_abc123",
  "status": "QUEUED",
  "message": "Files downloaded from TOS successfully, task submitted to queue"
}
```

---

## ❓ 常见问题

### Q1: 是否需要修改现有的 SPEOS 表单？

**A**: **不需要**。只需要添加条件判断，根据 `solver_type` 显示不同的参数表单。现有的 SPEOS 表单保持不变。

### Q2: `thread_count` 和 `num_cores` 有什么区别？

**A**: 后端都支持，推荐使用 `thread_count`：
- `thread_count`: SPEOS, FLUENT, Mechanical 通用
- `num_cores`: Maxwell, Mechanical 通用
- 后端会自动识别并转换

### Q3: `job_key` 是必填的吗？

**A**: **不是必填**。如果不提供，后端会自动使用 `job_name` 或文件名。但建议提供，因为：
- 更适合作为文件名（简短、无空格）
- 便于在服务器上识别和管理
- 避免文件名冲突

### Q4: 是否需要显示 Profile、Version、GPU 选项？

**A**: **不需要**。这些是 SPEOS 特有的参数，Mechanical 不需要。应该根据 `solver_type` 条件渲染。

### Q5: 前端需要做向后兼容处理吗？

**A**: **不需要**。后端已经做了向后兼容：
- `solver_type` 默认为 `"speos"`
- 所有旧的 SPEOS 参数都保留
- 新增的 Mechanical 参数不影响现有功能

---

## ✅ 验收清单

### 功能验收

- [ ] 可以在 solver_type 下拉框中选择 "Mechanical"
- [ ] 选择 Mechanical 后，显示正确的参数表单
- [ ] 不显示 SPEOS 特有的参数（Profile、GPU等）
- [ ] 可以输入 thread_count（核心数）
- [ ] 可以输入 job_key（任务标识）
- [ ] 提交时 solver_type 字段正确传递
- [ ] 提交成功后返回正确的 task_id

### UI 测试

- [ ] 表单布局合理，字段对齐
- [ ] 必填字段有明确标识（*）
- [ ] 输入提示清晰易懂
- [ ] 验证错误信息友好
- [ ] 移动端显示正常

### 兼容性测试

- [ ] 不影响现有的 SPEOS 任务提交
- [ ] 不影响现有的 FLUENT 任务提交
- [ ] 不影响现有的 Maxwell 任务提交
- [ ] 旧代码可以正常运行（solver_type 默认为 speos）

---

## 📚 相关文档

- [后端 Mechanical 更新总结](MECHANICAL_UPDATE_SUMMARY.md)
- [Mechanical 使用指南](MECHANICAL_SOLVER_GUIDE.md)
- [API 接口文档](API_COMPARISON.md)
- [前端集成指南](FRONTEND_INTEGRATION_GUIDE.md)

---

## 📞 技术支持

如有问题，请参考：
1. 后端 API 文档：`/docs` 或 `/redoc`
2. 问题反馈：创建 Issue
3. 技术讨论：项目群组

---

**更新完成！** 🎉

按照本指南调整前端代码后，即可支持 ANSYS Mechanical (Structure) 结构分析功能。


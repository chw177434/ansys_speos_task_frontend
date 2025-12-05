# FLUENT 求解器 - 前端适配指南

> **版本**: v1.0  
> **更新日期**: 2024-12-05  
> **适用于**: FLUENT 求解器后端更新

## 📋 概述

本文档详细说明了 FLUENT 求解器后端更新后，前端需要进行的适配修改。主要涉及：
- 新增的 FLUENT 参数字段
- API 请求格式变化
- 任务提交流程
- 进度监控
- 错误处理

---

## 🔄 主要变化

### 1. 新增参数（可选）

在 `ConfirmUploadRequest` 中，新增了以下 FLUENT 专用参数：

| 参数名 | 类型 | 默认值 | 必填 | 说明 |
|--------|------|--------|------|------|
| `dimension` | `string` | `"3d"` | ❌ | 维度（`"2d"` 或 `"3d"`） |
| `precision` | `string` | `"dp"` | ❌ | 精度（`"sp"` 单精度, `"dp"` 双精度, `""` 单精度） |
| `iterations` | `number` | `300` | ❌ | 迭代步数 |
| `initialization_method` | `string` | `"standard"` | ❌ | 初始化方法（`"standard"` 或 `"hyb"`） |
| `cpu_cores` | `number` | `32` | ❌ | 并行核心数（也可以用 `thread_count`） |

### 2. 保留的兼容参数

为了向后兼容，以下参数仍然有效：

| 旧参数名 | 新参数名 | 说明 |
|---------|---------|------|
| `thread_count` | `cpu_cores` | 并行核心数（推荐使用 `cpu_cores`） |

---

## 📝 前端表单设计

### 基础设计（最小化）

如果不想增加太多字段，可以只保留 `solver_type` 字段，其他参数使用默认值：

```tsx
interface FluentTaskFormBasic {
  solver_type: "fluent";  // 必填
  job_name: string;       // 必填
  submitter: string;      // 必填
}

// 示例
const formData = {
  solver_type: "fluent",
  job_name: "Pipe Flow Simulation",
  submitter: "user@example.com"
};
```

**后端会自动使用默认值**：
- `dimension`: `"3d"`
- `precision`: `"dp"`
- `cpu_cores`: `32`
- `iterations`: `300`
- `initialization_method`: `"standard"`

---

### 标准设计（推荐）

添加常用的 FLUENT 参数字段：

```tsx
interface FluentTaskForm {
  // 基础字段
  solver_type: "fluent";
  job_name: string;
  submitter: string;
  
  // FLUENT 参数（可选）
  dimension?: "2d" | "3d";
  precision?: "sp" | "dp" | "";
  iterations?: number;
  cpu_cores?: number;
}

// 示例组件
const FluentTaskForm: React.FC = () => {
  const [formData, setFormData] = useState({
    solver_type: "fluent",
    dimension: "3d",
    precision: "dp",
    iterations: 300,
    cpu_cores: 32,
  });

  return (
    <Form>
      {/* 维度选择 */}
      <FormItem label="维度">
        <Select
          value={formData.dimension}
          onChange={(value) => setFormData({ ...formData, dimension: value })}
        >
          <Option value="2d">2D</Option>
          <Option value="3d">3D</Option>
        </Select>
      </FormItem>

      {/* 精度选择 */}
      <FormItem label="精度">
        <Select
          value={formData.precision}
          onChange={(value) => setFormData({ ...formData, precision: value })}
        >
          <Option value="sp">单精度 (Single Precision)</Option>
          <Option value="dp">双精度 (Double Precision) - 推荐</Option>
        </Select>
      </FormItem>

      {/* 迭代步数 */}
      <FormItem label="迭代步数">
        <InputNumber
          value={formData.iterations}
          min={1}
          max={10000}
          onChange={(value) => setFormData({ ...formData, iterations: value })}
        />
      </FormItem>

      {/* CPU 核心数 */}
      <FormItem label="CPU 核心数">
        <InputNumber
          value={formData.cpu_cores}
          min={1}
          max={128}
          onChange={(value) => setFormData({ ...formData, cpu_cores: value })}
        />
        <span className="hint">根据 License 和硬件限制设置</span>
      </FormItem>
    </Form>
  );
};
```

---

### 高级设计（专业用户）

添加所有可配置参数：

```tsx
interface FluentTaskFormAdvanced extends FluentTaskForm {
  initialization_method?: "standard" | "hyb";
  result_name?: string;
  cache_flush?: boolean;
}

// 高级选项组件
const AdvancedOptions: React.FC = () => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  return (
    <>
      <Button onClick={() => setShowAdvanced(!showAdvanced)}>
        {showAdvanced ? "隐藏" : "显示"}高级选项
      </Button>
      
      {showAdvanced && (
        <div className="advanced-options">
          {/* 初始化方法 */}
          <FormItem label="初始化方法">
            <Select defaultValue="standard">
              <Option value="standard">标准初始化 (Standard) - 推荐</Option>
              <Option value="hyb">混合初始化 (Hybrid)</Option>
            </Select>
          </FormItem>

          {/* 结果文件名 */}
          <FormItem label="结果文件名（可选）">
            <Input placeholder="留空自动生成" />
            <span className="hint">后缀会自动添加 .dat.h5</span>
          </FormItem>

          {/* 缓存刷新（仅Linux） */}
          <FormItem label="缓存刷新">
            <Checkbox defaultChecked>
              启用缓存刷新（Linux 推荐）
            </Checkbox>
          </FormItem>
        </div>
      )}
    </>
  );
};
```

---

## 🔌 API 调用示例

### 1. 初始化上传

```typescript
// API: POST /api/upload/init
const initUpload = async (file: File) => {
  const response = await fetch('/api/upload/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: file.name,
      file_size: file.size,
      file_type: 'master',
      job_name: 'My FLUENT Job',
      submitter: 'user@example.com'
    })
  });
  
  const data = await response.json();
  return data; // { task_id, master_upload: { upload_url, ... } }
};
```

### 2. 上传文件到 TOS

```typescript
// 直接上传到预签名 URL
const uploadFile = async (file: File, uploadUrl: string) => {
  await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': 'application/octet-stream'
    }
  });
};
```

### 3. 确认上传并提交任务

```typescript
// API: POST /api/upload/confirm
const confirmUpload = async (taskId: string, objectKey: string, params: FluentParams) => {
  const response = await fetch('/api/upload/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task_id: taskId,
      master_object_key: objectKey,
      
      // 基础信息
      solver_type: 'fluent',
      job_name: params.job_name,
      submitter: params.submitter,
      
      // FLUENT 参数（可选）
      dimension: params.dimension || '3d',
      precision: params.precision || 'dp',
      iterations: params.iterations || 300,
      cpu_cores: params.cpu_cores || 32,
      initialization_method: params.initialization_method || 'standard',
    })
  });
  
  return await response.json();
};
```

### 4. 完整示例（TypeScript）

```typescript
// types.ts
export interface FluentTaskParams {
  job_name: string;
  submitter: string;
  dimension?: '2d' | '3d';
  precision?: 'sp' | 'dp' | '';
  iterations?: number;
  cpu_cores?: number;
  initialization_method?: 'standard' | 'hyb';
}

// api.ts
export const submitFluentTask = async (
  file: File,
  params: FluentTaskParams
) => {
  try {
    // 1. 初始化上传
    const initData = await initUpload(file);
    
    // 2. 上传文件
    await uploadFile(file, initData.master_upload.upload_url);
    
    // 3. 确认上传并提交任务
    const confirmData = await confirmUpload(
      initData.task_id,
      initData.master_upload.object_key,
      params
    );
    
    return confirmData;
  } catch (error) {
    console.error('Submit task failed:', error);
    throw error;
  }
};

// 使用示例
const handleSubmit = async () => {
  const result = await submitFluentTask(selectedFile, {
    job_name: 'Pipe Flow Simulation',
    submitter: 'user@example.com',
    dimension: '3d',
    precision: 'dp',
    iterations: 500,
    cpu_cores: 32,
  });
  
  console.log('Task submitted:', result.task_id);
};
```

---

## 📊 进度监控

### 1. 查询任务状态

```typescript
// API: GET /api/tasks/{task_id}
const getTaskStatus = async (taskId: string) => {
  const response = await fetch(`/api/tasks/${taskId}`);
  const data = await response.json();
  return data;
};

// 响应示例
interface TaskStatus {
  task_id: string;
  status: 'PENDING' | 'DOWNLOADING' | 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILURE';
  solver_type: 'fluent';
  progress_info?: {
    current_iteration?: number;      // 当前迭代步数
    continuity_residual?: number;    // 连续性残差
    progress_type?: string;          // "iteration" | "convergence" | "completion"
    converged?: boolean;             // 是否收敛
    message?: string;                // 状态消息
  };
  created_at: number;
  elapsed_seconds?: number;
  download_url?: string;
}
```

### 2. 实时进度显示

```tsx
const TaskProgress: React.FC<{ taskId: string }> = ({ taskId }) => {
  const [status, setStatus] = useState<TaskStatus | null>(null);
  
  useEffect(() => {
    const interval = setInterval(async () => {
      const data = await getTaskStatus(taskId);
      setStatus(data);
      
      // 任务完成或失败，停止轮询
      if (data.status === 'SUCCESS' || data.status === 'FAILURE') {
        clearInterval(interval);
      }
    }, 5000); // 每5秒查询一次
    
    return () => clearInterval(interval);
  }, [taskId]);
  
  if (!status) return <Spin />;
  
  return (
    <Card>
      <StatusBadge status={status.status} />
      
      {/* 迭代进度 */}
      {status.progress_info?.current_iteration && (
        <div>
          <p>当前迭代: {status.progress_info.current_iteration}</p>
          <p>残差值: {status.progress_info.continuity_residual?.toExponential(2)}</p>
        </div>
      )}
      
      {/* 收敛状态 */}
      {status.progress_info?.converged && (
        <Alert type="success" message="计算已收敛" />
      )}
      
      {/* 下载按钮 */}
      {status.status === 'SUCCESS' && status.download_url && (
        <Button href={status.download_url} download>
          下载结果
        </Button>
      )}
    </Card>
  );
};
```

---

## 🎨 UI/UX 建议

### 1. 参数预设（Preset）

提供常用场景的参数预设：

```tsx
const FLUENT_PRESETS = {
  quick_test: {
    name: '快速测试',
    dimension: '3d',
    precision: 'sp',
    iterations: 50,
    cpu_cores: 4,
  },
  standard: {
    name: '标准计算',
    dimension: '3d',
    precision: 'dp',
    iterations: 300,
    cpu_cores: 32,
  },
  high_accuracy: {
    name: '高精度计算',
    dimension: '3d',
    precision: 'dp',
    iterations: 1000,
    cpu_cores: 64,
  },
  transient: {
    name: '瞬态计算',
    dimension: '3d',
    precision: 'dp',
    iterations: 5000,
    cpu_cores: 128,
  },
};

const PresetSelector: React.FC = ({ onSelect }) => (
  <Select placeholder="选择预设配置" onChange={onSelect}>
    {Object.entries(FLUENT_PRESETS).map(([key, preset]) => (
      <Option key={key} value={key}>{preset.name}</Option>
    ))}
  </Select>
);
```

### 2. 参数验证和提示

```tsx
const validateParams = (params: FluentTaskParams): string[] => {
  const warnings: string[] = [];
  
  // 核心数过多警告
  if (params.cpu_cores && params.cpu_cores > 64) {
    warnings.push('CPU 核心数过多可能会降低并行效率');
  }
  
  // 迭代步数建议
  if (params.iterations && params.iterations < 100) {
    warnings.push('迭代步数较少，可能无法充分收敛');
  }
  
  // 精度建议
  if (params.precision === 'sp') {
    warnings.push('单精度可能导致精度损失，建议使用双精度 (dp)');
  }
  
  return warnings;
};

// 显示警告
{warnings.map((warning, index) => (
  <Alert key={index} type="warning" message={warning} />
))}
```

### 3. 帮助提示

```tsx
const ParameterHelp = {
  dimension: {
    title: '维度',
    description: '选择 2D 或 3D 模拟。3D 计算更精确但耗时更长。',
  },
  precision: {
    title: '精度',
    description: '双精度 (dp) 提供更高精度，推荐用于生产计算。单精度 (sp) 速度更快，适合快速验证。',
  },
  iterations: {
    title: '迭代步数',
    description: '计算的迭代次数。简单流动 100-200 步，复杂流动 500-1000 步。',
  },
  cpu_cores: {
    title: 'CPU 核心数',
    description: '并行计算使用的 CPU 核心数。需要根据 License 和硬件限制设置。',
  },
};

const HelpIcon: React.FC<{ param: keyof typeof ParameterHelp }> = ({ param }) => (
  <Tooltip title={ParameterHelp[param].description}>
    <QuestionCircleOutlined />
  </Tooltip>
);
```

---

## 🔍 错误处理

### 常见错误和处理

```typescript
const handleError = (error: any) => {
  // 参数验证错误
  if (error.status === 400) {
    message.error('参数错误：' + error.message);
    return;
  }
  
  // 文件未找到
  if (error.status === 404) {
    message.error('文件未找到，请重新上传');
    return;
  }
  
  // 服务器错误
  if (error.status === 500) {
    message.error('服务器错误，请稍后重试');
    return;
  }
  
  // 未知错误
  message.error('提交失败：' + error.message);
};
```

### 任务状态错误

```typescript
const getStatusMessage = (status: string, error?: string): string => {
  switch (status) {
    case 'FAILURE':
      return error || '计算失败，请检查输入文件和参数';
    case 'TIMEOUT':
      return '计算超时，建议减少迭代步数或增加 CPU 核心数';
    case 'CANCELLED':
      return '任务已取消';
    default:
      return '未知错误';
  }
};
```

---

## 📱 响应式设计建议

### 移动端适配

```tsx
const FluentFormMobile: React.FC = () => {
  return (
    <Form layout="vertical">
      {/* 使用垂直布局 */}
      <FormItem label="求解器">
        <Select disabled value="fluent">
          <Option value="fluent">ANSYS FLUENT</Option>
        </Select>
      </FormItem>
      
      {/* 简化参数输入 */}
      <FormItem label="计算规模">
        <Segmented
          options={[
            { label: '小规模', value: 'small' },
            { label: '中规模', value: 'medium' },
            { label: '大规模', value: 'large' },
          ]}
          onChange={(value) => {
            // 自动设置相应的参数
            if (value === 'small') {
              setParams({ cpu_cores: 4, iterations: 100 });
            } else if (value === 'medium') {
              setParams({ cpu_cores: 32, iterations: 300 });
            } else {
              setParams({ cpu_cores: 64, iterations: 500 });
            }
          }}
        />
      </FormItem>
    </Form>
  );
};
```

---

## 🧪 测试建议

### 单元测试

```typescript
// api.test.ts
describe('FLUENT API', () => {
  it('should submit task with default parameters', async () => {
    const result = await submitFluentTask(mockFile, {
      job_name: 'Test',
      submitter: 'test@example.com',
    });
    
    expect(result.task_id).toBeDefined();
    expect(result.status).toBe('PENDING');
  });
  
  it('should submit task with custom parameters', async () => {
    const result = await submitFluentTask(mockFile, {
      job_name: 'Test',
      submitter: 'test@example.com',
      dimension: '2d',
      precision: 'sp',
      iterations: 100,
      cpu_cores: 8,
    });
    
    expect(result.task_id).toBeDefined();
  });
});
```

### E2E 测试

```typescript
// fluent.e2e.test.ts
describe('FLUENT Task Submission', () => {
  it('should complete full workflow', async () => {
    // 1. 选择文件
    await page.click('input[type="file"]');
    await page.setInputFiles('input[type="file"]', 'test.cas.h5');
    
    // 2. 选择求解器
    await page.selectOption('select[name="solver_type"]', 'fluent');
    
    // 3. 设置参数
    await page.fill('input[name="job_name"]', 'E2E Test');
    await page.fill('input[name="iterations"]', '100');
    
    // 4. 提交
    await page.click('button[type="submit"]');
    
    // 5. 等待任务完成
    await page.waitForSelector('.status-success', { timeout: 300000 });
    
    // 6. 下载结果
    const download = await page.waitForEvent('download');
    expect(download.suggestedFilename()).toContain('fluent_results.zip');
  });
});
```

---

## 📋 完整示例代码

### React + TypeScript 完整示例

```typescript
// FluentTaskForm.tsx
import React, { useState } from 'react';
import { Form, Input, Select, InputNumber, Button, message, Alert } from 'antd';
import type { FluentTaskParams } from './types';
import { submitFluentTask, getTaskStatus } from './api';

const FluentTaskForm: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);

  const handleSubmit = async (values: FluentTaskParams) => {
    if (!file) {
      message.error('请先选择文件');
      return;
    }

    setLoading(true);
    try {
      const result = await submitFluentTask(file, values);
      setTaskId(result.task_id);
      message.success('任务提交成功');
    } catch (error) {
      message.error('任务提交失败：' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fluent-task-form">
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          dimension: '3d',
          precision: 'dp',
          iterations: 300,
          cpu_cores: 32,
          initialization_method: 'standard',
        }}
      >
        {/* 文件上传 */}
        <Form.Item label="Case 文件" required>
          <input
            type="file"
            accept=".cas,.cas.h5,.cas.gz"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </Form.Item>

        {/* 任务名称 */}
        <Form.Item
          name="job_name"
          label="任务名称"
          rules={[{ required: true, message: '请输入任务名称' }]}
        >
          <Input placeholder="例如：Pipe Flow Simulation" />
        </Form.Item>

        {/* 提交人 */}
        <Form.Item
          name="submitter"
          label="提交人"
          rules={[{ required: true, message: '请输入提交人邮箱' }]}
        >
          <Input placeholder="user@example.com" />
        </Form.Item>

        {/* 维度 */}
        <Form.Item name="dimension" label="维度">
          <Select>
            <Select.Option value="2d">2D</Select.Option>
            <Select.Option value="3d">3D</Select.Option>
          </Select>
        </Form.Item>

        {/* 精度 */}
        <Form.Item name="precision" label="精度">
          <Select>
            <Select.Option value="sp">单精度 (Single Precision)</Select.Option>
            <Select.Option value="dp">双精度 (Double Precision) - 推荐</Select.Option>
          </Select>
        </Form.Item>

        {/* 迭代步数 */}
        <Form.Item name="iterations" label="迭代步数">
          <InputNumber min={1} max={10000} style={{ width: '100%' }} />
          <span className="hint">简单流动 100-200，复杂流动 500-1000</span>
        </Form.Item>

        {/* CPU 核心数 */}
        <Form.Item name="cpu_cores" label="CPU 核心数">
          <InputNumber min={1} max={128} style={{ width: '100%' }} />
          <span className="hint">根据 License 和硬件限制设置</span>
        </Form.Item>

        {/* 初始化方法 */}
        <Form.Item name="initialization_method" label="初始化方法">
          <Select>
            <Select.Option value="standard">标准初始化 - 推荐</Select.Option>
            <Select.Option value="hyb">混合初始化</Select.Option>
          </Select>
        </Form.Item>

        {/* 提交按钮 */}
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            提交任务
          </Button>
        </Form.Item>
      </Form>

      {/* 任务状态 */}
      {taskId && <TaskStatus taskId={taskId} />}
    </div>
  );
};

export default FluentTaskForm;
```

---

## 📚 相关文档

- [FLUENT 求解器使用指南](./FLUENT_SOLVER_GUIDE.md)
- [FLUENT 配置示例](./FLUENT_CONFIG_EXAMPLE.md)
- [API 接口文档](./API_REFERENCE.md)

---

## ✅ 检查清单

前端开发人员在实现时，请确保完成以下检查：

- [ ] 在任务提交表单中添加 `solver_type: "fluent"` 字段
- [ ] 添加 FLUENT 参数输入（至少支持 dimension, precision, iterations, cpu_cores）
- [ ] 实现参数验证和提示
- [ ] 支持任务状态轮询（每 5 秒）
- [ ] 显示 FLUENT 特定的进度信息（迭代步数、残差值）
- [ ] 添加错误处理和用户提示
- [ ] 支持结果文件下载
- [ ] 编写单元测试
- [ ] 编写 E2E 测试
- [ ] 更新用户文档

---

## 🎯 最佳实践

1. **参数默认值**
   - 推荐在前端设置合理的默认值
   - 降低用户配置门槛

2. **参数验证**
   - 在前端进行基础验证
   - 提供实时反馈和建议

3. **用户体验**
   - 提供参数预设（快速测试、标准计算等）
   - 添加帮助提示和文档链接
   - 实时显示计算进度

4. **错误处理**
   - 友好的错误提示
   - 提供解决建议
   - 支持任务重试

5. **性能优化**
   - 使用防抖/节流优化轮询
   - 任务完成后停止轮询
   - 合理的轮询间隔（5 秒）

---

**更新人员**: AI Assistant  
**更新日期**: 2024-12-05  
**版本**: v1.0


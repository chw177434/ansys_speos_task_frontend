# Maxwell 电磁求解器前端适配文档

## 📋 概述

本文档说明前端如何对接 **ANSYS Maxwell 电磁场仿真求解器**。Maxwell 使用 `ansysedt` 命令进行无头模式（headless）的批处理求解。

---

## 🔧 必需的前端配置

### 1. 求解器类型标识

在所有相关 API 调用中，需要设置 `solver_type: "maxwell"`。

**支持的文件格式：**
- `.aedt` - ANSYS Electronics Desktop 项目文件（推荐）
- `.aedtz` - ANSYS Electronics Desktop 归档包（**强烈推荐**，包含 `.aedb` 资源文件夹）

**⚠️ 重要提示：**
- 优先使用 `.aedtz` 格式（归档包），可以避免"缺少 .aedb 文件夹"的错误
- 如果用户上传 `.aedt` 文件，需要同时上传对应的 `.aedb` 文件夹（压缩包形式）

---

## 📤 API 接口调用

### 方式一：TOS 对象存储上传（推荐，适合大文件）

#### 步骤 1: 初始化上传

**接口：** `POST /api/tasks/upload/init`

**请求示例：**
```typescript
const initRequest = {
  filename: "LC_Filter_Optimization.aedtz",  // 或 .aedt
  file_size: 52428800,  // 文件大小（字节）
  file_type: "master",
  content_type: "application/zip",  // .aedtz 是 zip 格式
  solver_type: "maxwell",  // ⭐ 关键：指定求解器类型
  
  // 可选：任务元信息
  job_name: "LC滤波器优化",
  submitter: "用户名"
};

const response = await fetch('/api/tasks/upload/init', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(initRequest)
});

const initData = await response.json();
// {
//   "task_id": "task_xxx",
//   "master_upload": { "upload_url": "...", "object_key": "..." },
//   "message": "..."
// }
```

#### 步骤 2: 上传文件到 TOS

```typescript
// 上传主文件
await fetch(initData.master_upload.upload_url, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/zip' },
  body: aedtzFile  // File 对象
});

// 如果有 include 文件（.aedb 文件夹压缩包），也需要上传
if (includeFile) {
  // 先调用 init 获取 include 的 upload_url
  // 然后上传...
}
```

#### 步骤 3: 确认上传并提交任务

**接口：** `POST /api/tasks/upload/confirm`

**请求示例：**
```typescript
const confirmRequest = {
  // 必须字段
  task_id: initData.task_id,
  master_object_key: initData.master_upload.object_key,
  
  // 任务基本信息
  solver_type: "maxwell",  // ⭐ 关键：指定求解器类型
  job_name: "LC滤波器优化",
  submitter: "用户名",
  profile_name: "Standard",  // 可选
  version: "v252",  // 可选
  
  // ⭐ Maxwell 专用参数
  num_cores: "32",  // 核心数（1-32，根据License权限，默认32）
  design_name: "Design1",  // 可选：设计名称（如果项目中有多个设计）
  
  // 如果有 include 文件
  include_object_key: includeObjectKey  // 可选
};

const confirmResponse = await fetch('/api/tasks/upload/confirm', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(confirmRequest)
});

const result = await confirmResponse.json();
// {
//   "task_id": "celery-task-xxx",
//   "status": "QUEUED",
//   "message": "Task submitted successfully"
// }
```

---

### 方式二：直接上传（适合小文件 < 50MB）

**接口：** `POST /api/tasks/submit-direct`

**请求示例：**
```typescript
const formData = new FormData();
formData.append('master_file', aedtzFile);  // File 对象
formData.append('solver_type', 'maxwell');  // ⭐ 关键
formData.append('job_name', 'LC滤波器优化');
formData.append('submitter', '用户名');
formData.append('num_cores', '32');  // ⭐ Maxwell 参数
formData.append('design_name', 'Design1');  // 可选

const response = await fetch('/api/tasks/submit-direct', {
  method: 'POST',
  body: formData  // 不要设置 Content-Type，让浏览器自动设置
});

const result = await response.json();
```

---

## 📝 Maxwell 专用参数说明

### 必需参数

| 参数名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| `solver_type` | string | 求解器类型，必须为 `"maxwell"` | `"maxwell"` |

### 可选参数

| 参数名 | 类型 | 说明 | 默认值 | 示例 |
|--------|------|------|--------|------|
| `num_cores` | string | 并行计算核心数（1-32，根据License权限） | `"32"` | `"16"` |
| `design_name` | string | 设计名称（如果项目中有多个设计，需要指定） | `null` | `"Design1"` |

**⚠️ 注意：**
- `num_cores` 的最大值取决于 License 权限（当前服务器支持 32 核）
- 如果用户未指定 `num_cores`，后端会使用默认值 32
- `design_name` 仅在项目包含多个设计时需要指定

---

## 📊 任务状态查询

### 查询任务详情

**接口：** `GET /api/tasks/{task_id}/detail`

**响应示例：**
```json
{
  "task_id": "task_xxx",
  "status": "RUNNING",
  "solver_type": "maxwell",
  "progress_info": {
    "progress": 45,  // 进度百分比（0-100）
    "progress_type": "solving",
    "message": "Solving... 45%"
  },
  "created_at": 1234567890,
  "submitter": "用户名",
  "job_name": "LC滤波器优化"
}
```

### 进度信息说明

Maxwell 求解器会通过 `-monitor` 参数输出实时进度，前端可以通过 `progress_info` 字段获取：

```typescript
interface ProgressInfo {
  progress?: number;           // 进度百分比（0-100）
  progress_type?: string;      // "solving" | "adaptive_pass" | "computing" | "converged" | "completed"
  message?: string;            // 进度消息，如 "Solving... 45%"
  current_pass?: number;       // 自适应 Pass 编号（如果有）
  converged?: boolean;        // 是否收敛（如果有）
}
```

**进度类型说明：**
- `solving`: 正在求解，通常包含百分比进度
- `adaptive_pass`: 自适应网格细化 Pass
- `computing`: 正在计算
- `converged`: 已收敛
- `completed`: 已完成

---

## 📦 结果文件说明

### 结果文件位置

求解完成后，结果文件位于：
- **主要结果目录：** `{项目文件名}.aedtresults/`
  - 例如：`LC_Filter_Optimization.aedtresults/`
- **结果文件类型：**
  - `.csv` - 曲线数据（通过 `-autoextract "reports"` 自动生成）
  - `.png`, `.jpg` - 图片文件
  - `.txt` - 文本报告
  - `.pdf` - PDF 报告
  - `.xlsx` - Excel 数据

### 下载结果

**接口：** `GET /api/tasks/{task_id}/download`

结果文件会被打包成 ZIP 文件，包含：
- `.aedtresults/` 目录及其所有内容
- 其他生成的结果文件

---

## 🎨 前端 UI 建议

### 1. 文件上传界面

```typescript
// 文件选择器
<input 
  type="file" 
  accept=".aedt,.aedtz" 
  onChange={(e) => setFile(e.target.files[0])}
/>

// 提示信息
<div className="hint">
  <strong>推荐格式：</strong>.aedtz（归档包，包含所有资源文件）<br/>
  <strong>支持格式：</strong>.aedt（需要同时上传 .aedb 文件夹压缩包）
</div>
```

### 2. 参数配置界面

```typescript
// 核心数选择器
<select 
  value={numCores} 
  onChange={(e) => setNumCores(e.target.value)}
>
  <option value="1">1 核</option>
  <option value="2">2 核</option>
  <option value="4">4 核</option>
  <option value="8">8 核</option>
  <option value="16">16 核</option>
  <option value="32" selected>32 核（默认，推荐）</option>
</select>

// 设计名称输入（可选）
<input 
  type="text" 
  placeholder="设计名称（可选，多设计项目需要）"
  value={designName}
  onChange={(e) => setDesignName(e.target.value)}
/>
```

### 3. 进度显示界面

```typescript
// 进度条
<div className="progress-bar">
  <div 
    className="progress-fill" 
    style={{ width: `${progressInfo?.progress || 0}%` }}
  />
  <span>{progressInfo?.message || "准备中..."}</span>
</div>

// 详细信息
{progressInfo?.current_pass && (
  <div>自适应 Pass: {progressInfo.current_pass}</div>
)}
```

---

## ⚠️ 注意事项

### 1. 文件格式

- **强烈推荐使用 `.aedtz` 格式**（归档包），可以避免资源文件缺失的问题
- 如果使用 `.aedt` 格式，需要确保 `.aedb` 文件夹也一起上传（压缩包形式）

### 2. 核心数限制

- 当前服务器 License 支持最大 **32 核**
- 默认值为 **32 核**（充分利用 License 权限）
- 用户可以选择更小的核心数（如 8、16），但建议使用默认值以获得最佳性能

### 3. 错误处理

如果任务失败，后端会优先从日志文件中提取详细错误信息。前端应该：
- 显示错误消息
- 提供日志下载链接（`/api/tasks/{task_id}/logs`）

### 4. 任务状态

Maxwell 任务的状态流转：
```
QUEUED → DOWNLOADING → RUNNING → SUCCESS / FAILED
```

---

## 📚 完整示例代码

### React + TypeScript 完整示例

```typescript
import React, { useState } from 'react';
import axios from 'axios';

interface MaxwellTaskParams {
  num_cores?: string;
  design_name?: string;
}

async function submitMaxwellTask(
  file: File,
  params: MaxwellTaskParams,
  jobName: string,
  submitter: string
) {
  // 步骤 1: 初始化上传
  const initResponse = await axios.post('/api/tasks/upload/init', {
    filename: file.name,
    file_size: file.size,
    file_type: 'master',
    content_type: 'application/zip',
    solver_type: 'maxwell',
    job_name: jobName,
    submitter: submitter
  });

  const { task_id, master_upload } = initResponse.data;

  // 步骤 2: 上传文件到 TOS
  await axios.put(master_upload.upload_url, file, {
    headers: { 'Content-Type': 'application/zip' }
  });

  // 步骤 3: 确认上传并提交任务
  const confirmResponse = await axios.post('/api/tasks/upload/confirm', {
    task_id,
    master_object_key: master_upload.object_key,
    solver_type: 'maxwell',
    job_name: jobName,
    submitter: submitter,
    profile_name: 'Standard',
    version: 'v252',
    num_cores: params.num_cores || '32',  // 默认 32 核
    design_name: params.design_name || undefined
  });

  return confirmResponse.data;
}

// 使用示例
const handleSubmit = async () => {
  try {
    const result = await submitMaxwellTask(
      selectedFile,
      { num_cores: '32', design_name: 'Design1' },
      'LC滤波器优化',
      '用户名'
    );
    console.log('任务已提交:', result.task_id);
  } catch (error) {
    console.error('提交失败:', error);
  }
};
```

---

## 🔗 相关文档

- [API 对比文档](./API_COMPARISON.md) - 新旧上传方式对比
- [前端对接清单](./FRONTEND_CHECKLIST.md) - TOS 对象存储上传清单
- [配置指南](./CONFIG_GUIDE.md) - 后端配置说明

---

## 📞 技术支持

如有问题，请联系后端开发团队。


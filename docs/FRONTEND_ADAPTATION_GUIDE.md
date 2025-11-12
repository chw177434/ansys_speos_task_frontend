# 前端适配指南 - Direct Upload 模式支持

本文档说明前端需要做哪些修改以支持新的 Direct Upload 模式。

---

## 📋 适配概述

### 需要修改的内容

1. **获取服务器上传模式配置**（新增）
2. **根据模式选择不同的上传流程**（核心修改）
3. **Direct 模式：直接上传文件**（新增）
4. **TOS 模式：保持现有逻辑**（无需修改）

---

## 🔧 适配步骤

### 步骤 1：获取上传模式配置

**新增接口调用：**

| 项目 | 内容 |
|------|------|
| **接口地址** | `GET /api/v2/upload/config` |
| **调用时机** | 页面加载时 / 上传前 |
| **返回字段** | `upload_mode`（值为 `"direct"` 或 `"tos"`） |
| **存储方式** | 存储到组件 state 或全局状态管理 |
| **使用目的** | 决定使用哪种上传流程 |

**需要判断的字段：**
- `upload_mode`: `"direct"` 或 `"tos"`
- `max_file_size_mb`: 最大文件大小限制

---

### 步骤 2：修改上传流程逻辑

**修改位置：** 文件上传处理函数

**修改方式：** 添加条件分支

**判断逻辑：**
```
如果 upload_mode === 'direct':
    使用 Direct 模式上传
否则:
    使用 TOS 模式上传（保持现有逻辑）
```

**不需要修改的部分：**
- 文件选择组件
- 参数输入表单
- 任务状态查询
- 结果下载

---

### 步骤 3：实现 Direct 模式上传

#### 3.1 接口信息

| 项目 | 内容 |
|------|------|
| **接口地址** | `POST /api/tasks/submit-direct` |
| **Content-Type** | `multipart/form-data` |
| **HTTP 方法** | POST |
| **数据格式** | FormData |

#### 3.2 必需参数

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `master_file` | File | 主文件（.speos 等） |

#### 3.3 可选参数

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `include_file` | File | Include 文件（.zip 等） |
| `profile_name` | string | 配置名称 |
| `version` | string | 版本号 |
| `job_name` | string | 任务名称 |
| `job_key` | string | 任务唯一标识 |
| `display_name` | string | 显示名称 |
| `use_gpu` | boolean | 是否使用 GPU（转为字符串 "true"/"false"） |
| `simulation_index` | string | 模拟索引 |
| `thread_count` | number | 线程数（转为字符串） |
| `priority` | string | 优先级 |
| `ray_count` | number | 光线数（转为字符串） |

#### 3.4 构建 FormData 的要点

1. **添加文件：** 使用 `formData.append('master_file', fileObject)`
2. **添加参数：** 所有参数都需要转为字符串类型
3. **布尔值处理：** 转为 `"true"` 或 `"false"` 字符串
4. **数字处理：** 转为字符串（如 `String(8)`）
5. **可选参数：** 如果值为空，可以不添加到 FormData

#### 3.5 发送请求

**请求头：**
- 不需要手动设置 `Content-Type`（浏览器自动设置为 `multipart/form-data`）

**请求方式：**
- 可以使用 `fetch`、`axios`、`XMLHttpRequest` 等
- 如果需要监控上传进度，推荐使用 `XMLHttpRequest` 或 `axios`

#### 3.6 返回数据

**成功响应（200）：**
```
{
  "task_id": "uuid-string",
  "status": "PENDING",
  "message": "Task queued (direct upload mode)"
}
```

**失败响应（4xx/5xx）：**
```
{
  "detail": "错误信息"
}
```

---

### 步骤 4：保持 TOS 模式逻辑不变

**无需修改的部分：**
- `init-upload-v2` 接口调用
- TOS 预签名 URL 上传
- `confirm-upload-v2` 接口调用
- 断点续传逻辑

**只需要：** 用条件判断包裹这部分逻辑

```
如果 upload_mode === 'tos':
    执行现有的 TOS 上传逻辑（不需要修改）
```

---

## 📐 修改点清单

### ✅ 必须修改

1. **[ ] 添加获取上传配置的调用**
   - 位置：页面初始化时
   - 接口：`GET /api/v2/upload/config`
   - 存储：将 `upload_mode` 保存到 state

2. **[ ] 添加上传模式判断逻辑**
   - 位置：上传按钮点击事件处理函数
   - 判断：根据 `upload_mode` 分支

3. **[ ] 实现 Direct 模式上传函数**
   - 位置：新建函数或修改现有上传函数
   - 功能：构建 FormData 并发送到 `/api/tasks/submit-direct`

4. **[ ] 处理 Direct 模式的响应**
   - 位置：上传成功回调
   - 功能：保存 `task_id`，跳转或轮询状态

---

### ⚠️ 可选修改

5. **[ ] 添加上传进度显示**（Direct 模式）
   - 如果使用 `axios` 或 `XMLHttpRequest`
   - 监听 `onUploadProgress` 事件
   - 更新进度条

6. **[ ] 添加模式显示**
   - 在界面上显示当前上传模式
   - 如："当前模式：内网直连"

7. **[ ] 错误处理优化**
   - Direct 模式的特定错误处理
   - 如：413 Payload Too Large

---

### ❌ 不需要修改

8. **任务列表查询**
   - `GET /api/tasks`
   - 无需修改

9. **任务详情查询**
   - `GET /api/tasks/{task_id}`
   - 无需修改

10. **任务状态轮询**
    - 逻辑保持不变
    - Direct 和 TOS 模式的任务状态查询方式相同

11. **结果下载**
    - TOS 模式：通过签名 URL 下载（保持不变）
    - Direct 模式：同样通过 `/api/tasks/{task_id}/download` 下载

---

## 🔌 API 对比

### TOS 模式（现有）

**流程：3 步**

1. `POST /api/tasks/init-upload-v2` - 初始化上传
2. `PUT <tos_signed_url>` - 上传到 TOS
3. `POST /api/tasks/confirm-upload-v2` - 确认上传

---

### Direct 模式（新）

**流程：1 步**

1. `POST /api/tasks/submit-direct` - 上传并提交任务

**简化了流程！**

---

## 📊 参数对照表

### TOS 模式（confirm-upload-v2）

**请求格式：** `application/json`

**请求体示例：**
```
{
  "task_id": "uuid",
  "master_object_key": "xxx",
  "master_filename": "file.speos",
  "include_object_key": "xxx",
  "include_filename": "include.zip",
  "params": {
    "profile_name": "xxx",
    "job_name": "xxx",
    ...
  }
}
```

---

### Direct 模式（submit-direct）

**请求格式：** `multipart/form-data`

**FormData 字段：**
```
master_file: File 对象
include_file: File 对象（可选）
profile_name: "xxx"
job_name: "xxx"
version: "xxx"
use_gpu: "true" 或 "false"
thread_count: "8"
... 其他参数
```

**关键区别：**
- TOS 模式：参数嵌套在 `params` 对象中（JSON）
- Direct 模式：参数平铺在 FormData 中（字符串）

---

## 🎯 最小化修改方案

### 如果想最快完成适配

**只需要修改 1 个函数：** 上传处理函数

**修改要点：**

1. **添加配置获取**
   - 在组件初始化时调用 `/api/v2/upload/config`
   - 保存 `upload_mode` 到 state

2. **添加条件分支**
   ```
   if (upload_mode === 'direct') {
     // 新增：Direct 模式上传逻辑
     // - 构建 FormData
     // - POST 到 /api/tasks/submit-direct
   } else {
     // 保持：现有 TOS 上传逻辑
     // - 完全不修改
   }
   ```

3. **处理返回值**
   - Direct 和 TOS 模式返回的 `task_id` 格式相同
   - 后续轮询逻辑无需修改

---

## 🐛 注意事项

### 1. FormData 类型转换

**所有 FormData 的值都必须是字符串或 Blob/File**

- ❌ 错误：`formData.append('use_gpu', true)`（布尔值）
- ✅ 正确：`formData.append('use_gpu', 'true')`（字符串）

- ❌ 错误：`formData.append('thread_count', 8)`（数字）
- ✅ 正确：`formData.append('thread_count', '8')`（字符串）

---

### 2. Content-Type 设置

**不要手动设置 Content-Type！**

- ❌ 错误：`headers: { 'Content-Type': 'multipart/form-data' }`
- ✅ 正确：不设置（浏览器自动添加，包含 boundary）

**原因：** 浏览器需要自动生成 multipart boundary

---

### 3. 文件大小验证

**在前端先验证，避免无效上传**

- 获取 `max_file_size_mb` 配置
- 检查文件大小：`file.size <= max_file_size_mb * 1024 * 1024`
- 如果超过，提示用户

---

### 4. 上传进度监控

**Direct 模式可以实时显示上传进度**

- 使用 `XMLHttpRequest.upload.onprogress` 事件
- 或使用 `axios` 的 `onUploadProgress` 回调
- 更新进度条组件

**TOS 模式：**
- 现有逻辑可能没有进度监控
- 可以继续保持

---

### 5. 错误处理

**Direct 模式可能的错误：**

| HTTP 状态码 | 原因 | 前端处理 |
|-----------|------|---------|
| 400 | 参数错误 | 提示用户检查参数 |
| 413 | 文件太大 | 提示文件超过限制 |
| 500 | 服务器错误 | 提示重试或联系管理员 |
| 504 | 网关超时 | 文件太大或网络慢，建议分块上传 |

---

## 📡 API 变化总结

### 新增接口（Direct 模式）

| 接口 | 方法 | 用途 | 调用时机 |
|------|------|------|---------|
| `/api/v2/upload/config` | GET | 获取上传配置 | 页面初始化 |
| `/api/tasks/submit-direct` | POST | 直接上传并提交任务 | 用户点击提交 |

---

### 保持不变的接口（TOS 模式）

| 接口 | 方法 | 用途 |
|------|------|------|
| `/api/tasks/init-upload-v2` | POST | 初始化 TOS 上传 |
| `/api/tasks/confirm-upload-v2` | POST | 确认 TOS 上传 |
| `/api/tasks` | GET | 查询任务列表 |
| `/api/tasks/{task_id}` | GET | 查询任务详情 |
| `/api/tasks/{task_id}` | DELETE | 删除任务 |

---

## 🎨 UI/UX 建议修改

### 1. 显示上传模式（可选）

**位置：** 上传页面顶部或设置区域

**内容：**
- Direct 模式："当前模式：内网直连（推荐）"
- TOS 模式："当前模式：云端存储"

**颜色：**
- Direct：绿色（表示快速）
- TOS：蓝色（表示云端）

---

### 2. 进度条显示（Direct 模式优势）

**Direct 模式：**
- 可以显示**实时上传进度**（0% - 100%）
- 显示上传速度（MB/s）
- 显示预计剩余时间

**TOS 模式：**
- 保持现有显示方式
- 或显示"上传中..."（无精确进度）

---

### 3. 文件大小提示

**显示位置：** 文件选择后

**显示内容：**
- 文件大小
- 是否超过限制
- Direct 模式预计上传时间
- TOS 模式预计上传时间

---

## 🔄 上传流程对比

### Direct 模式流程（新）

```
步骤 1：用户选择文件
   ↓
步骤 2：验证文件大小
   ↓
步骤 3：构建 FormData
   - 添加 master_file（File 对象）
   - 添加 include_file（File 对象，可选）
   - 添加其他参数（字符串）
   ↓
步骤 4：POST /api/tasks/submit-direct
   - 监控上传进度
   ↓
步骤 5：获取 task_id
   ↓
步骤 6：轮询任务状态（与 TOS 相同）
```

**特点：** 一步完成上传和提交

---

### TOS 模式流程（现有，保持不变）

```
步骤 1：用户选择文件
   ↓
步骤 2：POST /api/tasks/init-upload-v2
   - 获取 TOS 签名 URL
   ↓
步骤 3：PUT <tos_signed_url>
   - 上传到 TOS
   ↓
步骤 4：POST /api/tasks/confirm-upload-v2
   - 确认上传
   - 获取 task_id
   ↓
步骤 5：轮询任务状态
```

**特点：** 三步完成，支持断点续传

---

## 📋 完整修改清单

### 文件级别

| 文件/组件 | 修改类型 | 修改内容 |
|----------|---------|---------|
| **上传页面组件** | 修改 | 添加模式判断逻辑 |
| **上传服务/API 层** | 新增 | 添加 Direct 模式上传函数 |
| **配置获取服务** | 新增 | 添加获取上传配置函数 |
| **任务查询组件** | 无需修改 | - |
| **任务列表组件** | 无需修改 | - |
| **结果下载组件** | 无需修改 | - |

---

### 函数级别

| 函数 | 修改类型 | 说明 |
|------|---------|------|
| **getUploadConfig()** | 新增 | 获取服务器配置 |
| **uploadDirect()** | 新增 | Direct 模式上传 |
| **uploadTOS()** | 保持 | 现有 TOS 逻辑不变 |
| **handleUpload()** | 修改 | 添加模式判断分支 |
| **checkTaskStatus()** | 保持 | 无需修改 |
| **downloadResult()** | 保持 | 无需修改 |

---

## 🧪 测试要点

### 1. Direct 模式测试

**测试用例：**
- [ ] 只上传 master 文件
- [ ] 同时上传 master + include 文件
- [ ] 上传大文件（如 3GB）
- [ ] 上传进度显示正确
- [ ] 参数正确传递到后端
- [ ] 任务成功执行

---

### 2. TOS 模式测试

**测试用例：**
- [ ] 确保现有逻辑仍然正常工作
- [ ] 断点续传功能不受影响
- [ ] 多文件上传正常

---

### 3. 模式切换测试

**测试场景：**
- [ ] 服务器配置 `UPLOAD_MODE=direct` 时使用 Direct 流程
- [ ] 服务器配置 `UPLOAD_MODE=tos` 时使用 TOS 流程
- [ ] 切换模式后前端自动适配

---

## 🎯 核心要点总结

### 1. 获取配置
- **何时：** 页面加载时
- **接口：** `GET /api/v2/upload/config`
- **存储：** `upload_mode` 保存到 state

---

### 2. 条件分支
- **判断：** `upload_mode === 'direct'`
- **Direct：** 调用新的 Direct 上传函数
- **TOS：** 使用现有逻辑（不修改）

---

### 3. Direct 上传
- **格式：** FormData（不是 JSON）
- **接口：** `POST /api/tasks/submit-direct`
- **文件：** 直接附加 File 对象
- **参数：** 转为字符串后附加

---

### 4. 处理响应
- **相同点：** 返回 `task_id` 和 `status`
- **不同点：** Direct 模式只需一步
- **后续：** 轮询状态逻辑完全相同

---

## 📚 参考文档

### 详细文档
- **Direct 模式快速开始：** [DIRECT_UPLOAD_QUICK_START.md](DIRECT_UPLOAD_QUICK_START.md)
- **模式对比：** [UPLOAD_MODE_COMPARISON.md](UPLOAD_MODE_COMPARISON.md)
- **完整配置指南：** [UPLOAD_MODE_GUIDE.md](UPLOAD_MODE_GUIDE.md)

### 示例代码
- **前端示例（含代码）：** [../frontend/direct_upload_example.tsx](../frontend/direct_upload_example.tsx)

---

## 🎉 预期效果

### 修改前（仅 TOS）

```
上传 1GB 文件耗时：160秒
流程：浏览器 → TOS → Worker
```

### 修改后（支持 Direct）

```
内网环境：
  上传 1GB 文件耗时：9秒（18倍提升）
  流程：浏览器 → API 服务器 → Worker（本地）

公网环境：
  切换为 TOS 模式（保持现有逻辑）
```

---

## 🔧 实施建议

### 阶段 1：最小化修改（1-2小时）

1. 添加获取配置接口调用
2. 在上传函数中添加 if/else 分支
3. 实现基础的 Direct 上传（无进度条）
4. 测试验证

### 阶段 2：优化（可选）

1. 添加上传进度显示
2. 添加错误处理
3. 优化 UI 显示
4. 完善测试用例

---

**最后更新：** 2024-11-11  
**版本：** v2.1  
**适用前端框架：** React, Vue, Angular 等（通用）


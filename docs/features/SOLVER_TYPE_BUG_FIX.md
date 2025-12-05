# Solver Type 传递问题修复报告

> **修复日期**: 2024-12-05  
> **问题严重性**: 🔴 高（导致所有非 SPEOS 任务被错误处理）  
> **影响范围**: Mechanical, FLUENT, Maxwell 求解器

## 🐛 问题描述

### 症状
用户提交 Mechanical 任务时，后端仍然当作 SPEOS 进行处理。

### 根本原因
前端在部分上传流程中**没有传递 `solver_type` 参数**，导致后端使用默认值 `"speos"`。

### 影响范围
- ❌ TOS 模式简单上传（`handleOldFlowUpload`）
- ❌ Direct 模式上传（`submitDirectUpload` 函数）
- ✅ TOS 模式断点续传（已正确实现）
- ✅ Direct 模式断点续传（已正确实现）

---

## 🔍 问题分析

### 1. 遗漏位置 #1: `handleOldFlowUpload` 函数

**文件**: `components/UploadForm.tsx`  
**函数**: `handleOldFlowUpload` (第 1243 行)  
**流程**: TOS 模式 → 简单上传（非断点续传）

#### 问题代码
```typescript
// ❌ 问题：没有添加 solver_type
const formData = new FormData();
formData.append("profile_name", profileName.trim());
formData.append("version", version.trim());
formData.append("job_name", jobName.trim());
// ... 只添加了 SPEOS 参数
```

#### 修复后
```typescript
// ✅ 修复：添加 solver_type 和所有求解器的参数
const formData = new FormData();
formData.append("profile_name", profileName.trim());
formData.append("version", version.trim());
formData.append("job_name", jobName.trim());
formData.append("solver_type", solverType);  // ⭐ 新增

// 根据求解器类型添加相应参数
if (solverType === "speos") { /* SPEOS 参数 */ }
if (solverType === "fluent") { /* FLUENT 参数 */ }
if (solverType === "maxwell") { /* Maxwell 参数 */ }
if (solverType === "mechanical") { /* Mechanical 参数 */ }
```

---

### 2. 遗漏位置 #2: `submitDirectUpload` 函数

**文件**: `lib/api.ts`  
**函数**: `submitDirectUpload` (第 263 行)  
**流程**: Direct 模式 → 直接上传（非断点续传）

#### 问题代码
```typescript
// ❌ 问题：没有添加 solver_type，只添加了 SPEOS 参数
formData.append("profile_name", params.profile_name);
formData.append("version", params.version);
formData.append("job_name", params.job_name);
// 只添加了 SPEOS 参数
if (params.use_gpu !== undefined) formData.append("use_gpu", String(params.use_gpu));
// ...
```

#### 修复后
```typescript
// ✅ 修复：添加 solver_type 和所有求解器的参数
formData.append("profile_name", params.profile_name);
formData.append("version", params.version);
formData.append("job_name", params.job_name);
formData.append("solver_type", params.solver_type || "speos");  // ⭐ 新增

// ========== SPEOS 参数 ==========
if (params.use_gpu !== undefined) formData.append("use_gpu", String(params.use_gpu));
// ...

// ========== FLUENT 参数 ==========
if (params.dimension) formData.append("dimension", params.dimension);
if (params.precision) formData.append("precision", params.precision);
// ...

// ========== Maxwell/Mechanical 参数 ==========
if (params.num_cores) formData.append("num_cores", params.num_cores);
if (params.design_name) formData.append("design_name", params.design_name);
```

---

## ✅ 修复内容

### 修复 #1: `components/UploadForm.tsx`

**修改行数**: 第 1243-1309 行

**修改内容**:
1. ✅ 添加 `solver_type` 参数到 FormData
2. ✅ 将 SPEOS 参数包裹在 `if (solverType === "speos")` 条件中
3. ✅ 添加 FLUENT 参数支持
4. ✅ 添加 Maxwell 参数支持
5. ✅ 添加 Mechanical 参数支持

**代码片段**:
```typescript
// ⭐ 关键修复：添加 solver_type 参数
formData.append("solver_type", solverType);

// ========== SPEOS 参数 ==========
if (solverType === "speos") {
  if (useGpu) formData.append("use_gpu", "true");
  // ... 其他 SPEOS 参数
}

// ========== FLUENT 参数 ==========
if (solverType === "fluent") {
  formData.append("dimension", dimension);
  formData.append("precision", precision);
  formData.append("iterations", String(iterations));
  formData.append("initialization_method", initializationMethod);
  // ...
}

// ========== Maxwell 参数 ==========
if (solverType === "maxwell") {
  // ...
}

// ========== Mechanical 参数 ==========
if (solverType === "mechanical") {
  // ...
}
```

---

### 修复 #2: `lib/api.ts`

**修改行数**: 第 287-304 行

**修改内容**:
1. ✅ 添加 `solver_type` 参数到 FormData（默认 "speos"）
2. ✅ 重新组织参数添加逻辑，按求解器分类
3. ✅ 添加 FLUENT 参数支持
4. ✅ 添加 Maxwell/Mechanical 参数支持

**代码片段**:
```typescript
// ⭐ 关键修复：添加 solver_type 参数（默认 "speos"）
formData.append("solver_type", params.solver_type || "speos");

// 添加可选通用参数
if (params.job_key) formData.append("job_key", params.job_key);
if (params.display_name) formData.append("display_name", params.display_name);
if (params.project_dir) formData.append("project_dir", params.project_dir);

// ========== SPEOS 参数 ==========
if (params.use_gpu !== undefined) formData.append("use_gpu", String(params.use_gpu));
// ...

// ========== FLUENT 参数 ==========
if (params.dimension) formData.append("dimension", params.dimension);
if (params.precision) formData.append("precision", params.precision);
if (params.iterations !== undefined) formData.append("iterations", String(params.iterations));
if (params.initialization_method) formData.append("initialization_method", params.initialization_method);

// ========== Maxwell/Mechanical 参数 ==========
if (params.num_cores) formData.append("num_cores", params.num_cores);
if (params.design_name) formData.append("design_name", params.design_name);
```

---

## 📊 修复前后对比

### TOS 模式简单上传（小文件）

#### 修复前
```json
// 发送到后端的 FormData
{
  "profile_name": "",
  "version": "",
  "job_name": "Test Mechanical",
  "master_file": File,
  // ❌ 缺少 solver_type
  "thread_count": "8",  // Mechanical 参数被发送但无效
  "job_key": "test_001"  // Mechanical 参数被发送但无效
}
```
**后端行为**: 使用默认值 `solver_type="speos"`，将任务当作 SPEOS 处理 ❌

#### 修复后
```json
// 发送到后端的 FormData
{
  "profile_name": "",
  "version": "",
  "job_name": "Test Mechanical",
  "master_file": File,
  "solver_type": "mechanical",  // ✅ 正确传递
  "thread_count": "8",
  "job_key": "test_001"
}
```
**后端行为**: 正确识别为 `solver_type="mechanical"`，调用 Mechanical 求解器 ✅

---

### Direct 模式上传（小文件，不使用断点续传）

#### 修复前
```json
// 发送到后端的 FormData
{
  "profile_name": "",
  "version": "",
  "job_name": "Test FLUENT",
  "master_file": File,
  // ❌ 缺少 solver_type
  // ❌ 缺少 FLUENT 参数（dimension, precision, iterations）
}
```
**后端行为**: 使用默认值 `solver_type="speos"`，将任务当作 SPEOS 处理 ❌

#### 修复后
```json
// 发送到后端的 FormData
{
  "profile_name": "",
  "version": "",
  "job_name": "Test FLUENT",
  "master_file": File,
  "solver_type": "fluent",  // ✅ 正确传递
  "dimension": "3d",
  "precision": "dp",
  "iterations": "300",
  "initialization_method": "standard"
}
```
**后端行为**: 正确识别为 `solver_type="fluent"`，调用 FLUENT 求解器 ✅

---

## 🧪 验证方法

### 1. 查看后端日志

修复后，后端日志应该显示正确的求解器类型：

```log
# ✅ 正确的日志
Received task - Solver: mechanical
Task ID: abc123
Starting mechanical solver...

# ❌ 修复前的错误日志
Received task - Solver: speos  # 应该是 mechanical！
Task ID: abc123
Starting speos solver...
```

### 2. 提交测试任务

#### 测试 Mechanical
```typescript
// 1. 选择 Mechanical 求解器
// 2. 上传 .dat 文件
// 3. 设置线程数：8
// 4. 提交任务
// 5. 查看 worker 日志，应该显示：
//    "Received task - Solver: mechanical"
```

#### 测试 FLUENT
```typescript
// 1. 选择 FLUENT 求解器
// 2. 上传 .cas.h5 文件
// 3. 设置迭代步数：300
// 4. 提交任务
// 5. 查看 worker 日志，应该显示：
//    "Received task - Solver: fluent"
```

#### 测试 Maxwell
```typescript
// 1. 选择 Maxwell 求解器
// 2. 上传 .aedt 文件
// 3. 设置核心数：4
// 4. 提交任务
// 5. 查看 worker 日志，应该显示：
//    "Received task - Solver: maxwell"
```

---

## 📋 测试清单

### 所有上传流程验证

| 上传模式 | 文件大小 | 断点续传 | solver_type | 求解器参数 | 状态 |
|---------|---------|---------|------------|-----------|------|
| TOS | < 10MB | ❌ | ✅ 已修复 | ✅ 已修复 | ✅ |
| TOS | ≥ 10MB | ✅ | ✅ 已正确 | ✅ 已正确 | ✅ |
| Direct | < 10MB | ❌ | ✅ 已修复 | ✅ 已修复 | ✅ |
| Direct | ≥ 10MB | ✅ | ✅ 已正确 | ✅ 已正确 | ✅ |

### 所有求解器验证

- [x] SPEOS - ✅ 正常工作（默认求解器）
- [x] FLUENT - ✅ 已修复，现在正确传递参数
- [x] Maxwell - ✅ 已修复，现在正确传递参数
- [x] Mechanical - ✅ 已修复，现在正确传递参数

---

## 🔄 完整的参数传递流程

### 前端 → 后端数据流

```
用户选择求解器类型
    ↓
前端状态: solverType = "mechanical"
    ↓
表单提交
    ↓
根据文件大小和上传模式选择流程:
    ├─ TOS 模式 + 小文件 → handleOldFlowUpload
    ├─ TOS 模式 + 大文件 → handleResumableUpload
    ├─ Direct 模式 + 小文件 → handleDirectUpload (submitDirectUpload)
    └─ Direct 模式 + 大文件 → handleDirectResumableUpload
    ↓
所有流程都添加 solver_type 到 FormData/JSON
    ↓
发送到后端 API
    ↓
后端解析 solver_type 参数
    ↓
调用对应的求解器 Worker
    ↓
✅ 正确执行求解器任务
```

---

## 📚 相关文档

- [FLUENT_FRONTEND_GUIDE.md](./FLUENT_FRONTEND_GUIDE.md) - FLUENT 前端适配指南
- [FRONTEND_MECHANICAL_GUIDE.md](./FRONTEND_MECHANICAL_GUIDE.md) - Mechanical 前端适配指南
- [API_REFERENCE_V2.md](./API_REFERENCE_V2.md) - API 接口文档

---

## 🎯 总结

### 问题根源
前端在早期开发时，只实现了 SPEOS 求解器支持。后续添加其他求解器时，部分上传流程被遗漏，导致 `solver_type` 参数没有传递。

### 修复效果
- ✅ 修复了 2 个关键函数
- ✅ 所有上传流程现在都正确传递 `solver_type`
- ✅ 所有求解器的参数都正确传递
- ✅ 向后兼容（默认值仍为 "speos"）

### 预防措施
今后添加新的求解器或上传流程时，应该：
1. 检查所有上传流程（TOS/Direct × 简单/断点续传）
2. 确保每个流程都传递 `solver_type`
3. 确保每个流程都支持所有求解器的参数
4. 编写端到端测试验证

---

**修复人员**: AI Assistant  
**修复日期**: 2024-12-05  
**严重性**: 🔴 高（导致所有非 SPEOS 任务失败）  
**状态**: ✅ 已修复并验证


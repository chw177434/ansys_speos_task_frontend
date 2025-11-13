# 断点续传调试指南

## 问题：上传中断后重新打开页面，没有看到"未完成上传"提示

---

## 🔍 排查步骤

### 步骤 1：检查 localStorage 是否保存了数据

1. **打开浏览器开发者工具**（F12）
2. **切换到 Application（应用） 标签**
3. **左侧菜单：Storage → Local Storage → 选择你的网站地址**
4. **查找以下 key**：
   - `direct_upload_*` - Direct 模式的上传
   - `resumable_upload_*` - TOS 模式的上传

**预期结果**：
- 如果使用了断点续传，应该看到类似 `direct_upload_abc123_master` 的记录
- 点击该记录，右侧应该显示 JSON 数据

**如果没有找到任何记录**：
→ 说明进度没有保存，继续下面的步骤

---

### 步骤 2：检查浏览器控制台日志

1. **打开浏览器开发者工具**（F12）
2. **切换到 Console（控制台） 标签**
3. **上传文件时观察日志**

**关键日志**：

```javascript
// ✅ 应该看到这些日志：
"📡 使用 Direct 模式上传（内网直连）"
"📦 文件较大 (xxx MB)，使用 Direct 模式断点续传"
"[Direct] 🚀 初始化分片上传: xxx (xxx MB)"
"[Direct] ✅ 初始化成功: taskId=xxx, uploadId=xxx, 总分片=xxx"
"[Direct] ⬆️ 上传分片 1/20 (5 MB)"
"[Direct] ✅ 分片 1 上传成功"
"✅ [Direct] 保存上传进度: xxx, 已上传 1/20 片"

// ❌ 如果看到这个：
"🚀 文件较小 (xxx MB)，使用 Direct 模式普通上传"
→ 说明文件没有使用断点续传（< 10MB）

// ❌ 如果看到这个：
"📡 使用 TOS 模式上传（对象存储）"
→ 说明当前不是 Direct 模式
```

---

### 步骤 3：检查上传模式

在页面顶部应该看到上传模式指示器：

**Direct 模式**：
```
🚀 内网直连模式
文件将直接上传到服务器，速度更快，大文件支持断点续传（适用于内网环境）
```

**TOS 模式**：
```
☁️ 云端存储模式
文件将上传到对象存储，支持断点续传（适用于公网环境）
```

如果是 TOS 模式，那么应该检查 `resumable_upload_*` 而不是 `direct_upload_*`

---

### 步骤 4：手动检查 localStorage

在浏览器控制台（Console）中执行以下代码：

```javascript
// 查看所有 Direct 模式的上传记录
Object.keys(localStorage)
  .filter(key => key.startsWith('direct_upload_'))
  .forEach(key => {
    console.log('Key:', key);
    console.log('Data:', JSON.parse(localStorage.getItem(key)));
  });

// 查看所有 TOS 模式的上传记录
Object.keys(localStorage)
  .filter(key => key.startsWith('resumable_upload_'))
  .forEach(key => {
    console.log('Key:', key);
    console.log('Data:', JSON.parse(localStorage.getItem(key)));
  });
```

**预期输出**：
```javascript
Key: direct_upload_abc-123_master
Data: {
  task_id: "abc-123",
  upload_id: "upload-xyz",
  file_type: "master",
  filename: "large_file.zip",
  file_size: 1073741824,  // 1GB
  total_chunks: 205,       // 1GB ÷ 5MB
  uploaded_parts: [1, 2, 3, 4, 5, ...],
  timestamp: 1699876543210
}
```

---

## 🐛 常见问题

### 问题 1：localStorage 中没有任何记录

**可能原因**：
1. **使用了无痕浏览器（隐私模式）** ⚠️ **最常见**
2. 浏览器禁用了 localStorage
3. 分片还没上传完一片就关闭了页面
4. 使用的是普通上传（文件 < 10MB）
5. 代码执行出错

### ⚠️ 特别注意：无痕浏览器

**如果你使用的是无痕浏览器（隐私模式）**：

Chrome/Firefox/Edge 无痕模式：
- localStorage 可用
- 但**关闭标签页后数据被清除**
- 无法实现真正的断点续传

Safari 无痕模式：
- localStorage **完全禁用**
- 根本无法保存数据

**解决方法**：
→ **使用标准浏览器模式**

**解决方法**：
```javascript
// 1. 检查 localStorage 是否可用
console.log('localStorage 可用:', typeof localStorage !== 'undefined');

// 2. 尝试手动保存数据
localStorage.setItem('test_key', 'test_value');
console.log('手动保存成功:', localStorage.getItem('test_key'));

// 3. 检查文件大小
const file = /* 你的文件 */;
console.log('文件大小:', file.size, '字节');
console.log('文件大小:', (file.size / 1024 / 1024).toFixed(2), 'MB');
console.log('是否使用断点续传:', file.size >= 10 * 1024 * 1024);
```

### 问题 2：有记录但没有显示提示

**可能原因**：
1. React 组件没有正确检测
2. 数据格式不匹配
3. 检测逻辑有 bug

**解决方法**：

打开 `components/UploadForm.tsx`，找到这段代码：

```typescript
// 检查 localStorage 中的未完成上传（TOS 和 Direct 模式）
useEffect(() => {
  if (typeof window === "undefined") return;

  const checkPendingUploads = () => {
    console.log('🔍 开始检测未完成的上传...');
    
    // ... 检测逻辑
    
    console.log('📊 发现未完成的上传:', pending.length, '个');
    setPendingUploads(pending);
  };

  checkPendingUploads();
}, []);
```

在浏览器控制台应该看到这些日志。如果没有，说明 `useEffect` 没有执行。

### 问题 3：上传没有使用断点续传

**检查文件大小阈值**：

在 `components/UploadForm.tsx` 中：

```typescript
const DIRECT_RESUMABLE_THRESHOLD = 10 * 1024 * 1024;  // 10MB

// 你的文件大小：
1GB = 1073741824 字节 > 10MB ✅ 应该使用断点续传
```

**可能是后端问题**：

如果前端代码正确，但后端接口返回 404：
```
POST http://localhost:8000/api/upload/direct/multipart/init
→ 404 Not Found
```

说明后端没有实现相关接口。

---

## 🔧 临时测试方案

### 方案 1：手动触发检测

在浏览器控制台执行：

```javascript
// 手动创建一个测试记录
const testData = {
  task_id: "test-123",
  upload_id: "upload-test",
  file_type: "master",
  filename: "test_file.zip",
  file_size: 104857600,  // 100MB
  total_chunks: 20,
  uploaded_parts: [1, 2, 3, 4, 5],  // 已上传 5 片
  timestamp: Date.now()
};

localStorage.setItem('direct_upload_test-123_master', JSON.stringify(testData));

// 刷新页面，应该看到提示
```

### 方案 2：添加调试日志

修改 `components/UploadForm.tsx`：

```typescript
// 在 useEffect 中添加详细日志
const checkPendingUploads = () => {
  const pending = [];

  console.log('🔍 检查 localStorage...');
  console.log('🔍 所有 keys:', Object.keys(localStorage));

  Object.keys(localStorage).forEach((key) => {
    console.log('🔍 检查 key:', key);
    
    if (key.startsWith("direct_upload_")) {
      console.log('✅ 找到 Direct 模式上传:', key);
      try {
        const data = JSON.parse(localStorage.getItem(key) || "{}");
        console.log('📊 数据:', data);
        
        if (data.uploaded_parts && data.uploaded_parts.length < data.total_chunks) {
          console.log('✅ 添加到待恢复列表');
          pending.push({
            taskId: data.task_id,
            filename: data.filename,
            uploadedChunks: data.uploaded_parts.length,
            totalChunks: data.total_chunks,
            fileType: data.file_type,
            uploadMode: "direct",
          });
        } else {
          console.log('❌ 已完成或数据不完整');
        }
      } catch (error) {
        console.error('❌ 解析失败:', error);
      }
    }
  });

  console.log('📊 最终结果:', pending);
  setPendingUploads(pending);
};
```

---

## 🎯 快速测试方案

### 测试 1：小文件测试（验证基础功能）

1. 准备一个 20MB 的文件
2. 上传到 50%
3. **不要关闭页面**，而是打开控制台
4. 执行：`localStorage.getItem('direct_upload_...')`（tab 补全）
5. 看是否有数据

### 测试 2：完整流程测试

1. 准备一个 50MB 的文件
2. 开始上传
3. 观察控制台，确认看到 "[Direct] 保存上传进度"
4. 上传到 30% 时，直接关闭浏览器（不是标签页）
5. 重新打开浏览器，访问页面
6. 应该看到"未完成上传"提示

---

## 📞 报告问题

如果以上步骤都检查了，请提供以下信息：

1. **浏览器控制台日志**（上传时的所有日志）
2. **localStorage 内容**（执行上面的查询代码）
3. **文件大小**（多少 MB？）
4. **上传模式**（Direct 还是 TOS？）
5. **错误信息**（如果有）

---

## 🐞 已知问题

### 问题：Direct 模式断点续传任务提交失败

**现象**：
- 文件上传成功（所有分片都上传完成）
- 但最后提交任务时失败

**原因**：
当前实现中，`completeDirectMultipartUpload` 返回的是文件路径，但后续的 `createTask` 接口可能不支持基于文件路径创建任务。

**临时解决方案**：
后端需要提供一个接口，允许前端基于已上传的文件路径创建任务。

**后端接口建议**：
```
POST /api/upload/direct/multipart/confirm
{
  "task_id": "abc-123",
  "master_file_path": "/uploads/abc-123/master.zip",
  "include_file_path": "/uploads/abc-123/include.zip",
  "profile_name": "...",
  "version": "...",
  ...
}
```

---

## 🔄 下一步

1. **先完成上面的排查步骤**
2. **收集日志和数据**
3. **确定具体问题**
4. **针对性修复**

有任何发现，请告诉我！


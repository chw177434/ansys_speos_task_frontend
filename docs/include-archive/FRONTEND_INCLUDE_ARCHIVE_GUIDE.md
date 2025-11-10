# 前端适配指南：Include文件必须为压缩包格式

## 📋 修改说明

**变更时间**: 2025-11-07

**修改原因**: 
- 原来的系统允许上传include文件夹，但在实际使用中遇到了400错误
- 为了保证上传的可靠性和一致性，现在要求用户必须上传压缩包格式的include文件

**修改内容**:
- ✅ Include文件必须是压缩包格式（.zip, .rar, .7z, .tar, .gz, .tar.gz）
- ✅ 后端会自动解压并与主文件放在同一目录
- ✅ 最终存放方式与原来相同，只是上传方式改变
- ❌ 不再允许上传文件夹

---

## 🎯 支持的压缩包格式

后端支持以下压缩包格式：

| 格式 | 扩展名 | 推荐度 | 说明 |
|------|--------|--------|------|
| ZIP | `.zip` | ⭐⭐⭐⭐⭐ | **强烈推荐**，支持最好，兼容性最佳 |
| RAR | `.rar` | ⭐⭐⭐⭐ | 支持，但需要相应的解压工具 |
| 7-Zip | `.7z` | ⭐⭐⭐⭐ | 支持，压缩率高 |
| TAR | `.tar` | ⭐⭐⭐ | 支持，Linux常用格式 |
| GZIP | `.gz` | ⭐⭐⭐ | 支持 |
| TAR.GZ | `.tar.gz` | ⭐⭐⭐ | 支持，Linux常用格式 |

**推荐使用 `.zip` 格式**，因为：
- 跨平台兼容性最好
- 大多数操作系统原生支持
- 前端处理最方便

---

## 🔧 前端需要修改的地方

### 1. 文件选择组件

#### 原来的代码（错误）：
```typescript
// ❌ 错误：允许选择文件夹
<input 
  type="file" 
  webkitdirectory  // 允许选择文件夹
  directory 
  onChange={handleIncludeUpload}
/>
```

#### 修改后的代码（正确）：
```typescript
// ✅ 正确：只允许选择压缩包文件
<input 
  type="file" 
  accept=".zip,.rar,.7z,.tar,.gz,.tar.gz"  // 限制文件类型
  onChange={handleIncludeUpload}
/>
```

### 2. 文件验证

在前端添加文件格式验证：

```typescript
function validateIncludeFile(file: File): boolean {
  const allowedExtensions = ['.zip', '.rar', '.7z', '.tar', '.gz', '.tar.gz'];
  const fileName = file.name.toLowerCase();
  
  const isValidArchive = allowedExtensions.some(ext => 
    fileName.endsWith(ext)
  );
  
  if (!isValidArchive) {
    alert(
      `Include文件必须是压缩包格式！\n` +
      `支持的格式：${allowedExtensions.join(', ')}\n` +
      `请先将include文件夹压缩为.zip文件后再上传。`
    );
    return false;
  }
  
  return true;
}

// 在上传前调用验证
const handleIncludeUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;
  
  if (!validateIncludeFile(file)) {
    event.target.value = ''; // 清空选择
    return;
  }
  
  // 继续上传流程...
  uploadIncludeFile(file);
};
```

### 3. 用户提示

在界面上添加明确的提示信息：

```tsx
<div className="upload-section">
  <label>Include文件 (可选)</label>
  <input 
    type="file" 
    accept=".zip,.rar,.7z,.tar,.gz"
    onChange={handleIncludeUpload}
  />
  <p className="help-text">
    ⚠️ 请将include文件夹压缩为.zip文件后上传
    <br />
    支持格式：.zip, .rar, .7z, .tar, .gz
  </p>
</div>
```

### 4. 完整的上传流程示例

```typescript
import JSZip from 'jszip'; // 如果需要在前端压缩

const handleIncludeUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;
  
  // 1. 验证文件格式
  if (!validateIncludeFile(file)) {
    event.target.value = '';
    return;
  }
  
  try {
    // 2. 初始化上传
    const initResponse = await fetch('/tasks/upload/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.name,
        file_size: file.size,
        file_type: 'include',  // 指定为include类型
        content_type: file.type || 'application/zip',
      })
    });
    
    if (!initResponse.ok) {
      const error = await initResponse.json();
      alert(`上传失败：${error.detail}`);
      return;
    }
    
    const initData = await initResponse.json();
    const { task_id, include_upload } = initData;
    
    // 3. 上传文件到TOS
    const uploadResponse = await fetch(include_upload.upload_url, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type || 'application/zip',
      }
    });
    
    if (!uploadResponse.ok) {
      throw new Error('文件上传失败');
    }
    
    // 4. 确认上传（后端会自动解压）
    // ... 继续后续流程
    
  } catch (error) {
    console.error('上传失败:', error);
    alert('上传失败，请重试');
  }
};
```

---

## 📝 API接口变化

### 1. `/tasks/upload/init` 接口

**变化**: 现在会验证include文件格式

**请求示例**:
```json
{
  "filename": "include.zip",  // ✅ 必须是压缩包格式
  "file_size": 1048576,
  "file_type": "include",
  "content_type": "application/zip"
}
```

**成功响应** (200):
```json
{
  "task_id": "20251107-123456-abcd1234",
  "include_upload": {
    "object_key": "speosTest/20251107-123456-abcd1234/include_include.zip",
    "upload_url": "https://...",
    "expires_in": 3600,
    "file_type": "include"
  },
  "message": "Upload URL generated..."
}
```

**错误响应** (400):
```json
{
  "detail": "Include file must be an archive file. Allowed formats: .zip, .rar, .7z, .tar, .gz, .tar.gz. Please compress your include folder into a .zip file before uploading."
}
```

### 2. `/tasks/upload/multipart/init` 接口

**变化**: 同样会验证include文件格式

**请求示例**:
```json
{
  "filename": "large_include.zip",  // ✅ 必须是压缩包
  "file_size": 52428800,  // 50MB
  "file_type": "include",
  "content_type": "application/zip",
  "chunk_size": 5242880
}
```

### 3. `POST /tasks` 接口（旧的表单上传）

**变化**: 验证include_archive字段

**Form Data**:
```
master_file: (binary)
include_archive: (binary)  // ✅ 必须是压缩包文件
job_name: "test"
submitter: "user"
...
```

---

## 🚨 常见错误处理

### 错误1: 尝试上传文件夹

**错误信息**:
```
Include file must be an archive file. Allowed formats: .zip, .rar, .7z, .tar, .gz, .tar.gz. 
Please compress your include folder into a .zip file before uploading.
```

**解决方案**:
1. 选择include文件夹
2. 右键 → "压缩为ZIP文件"（Windows/Mac）或使用压缩工具
3. 上传生成的.zip文件

### 错误2: 上传了错误的文件格式

**错误信息**: 同上

**解决方案**:
确保文件扩展名是以下之一：
- `.zip` (推荐)
- `.rar`
- `.7z`
- `.tar`
- `.gz`
- `.tar.gz`

---

## 📦 如何压缩Include文件夹

### Windows系统

1. **使用系统自带功能**：
   - 右键点击include文件夹
   - 选择"发送到" → "压缩(zipped)文件夹"
   - 重命名为`include.zip`

2. **使用7-Zip**（推荐）：
   - 右键点击文件夹
   - 选择"7-Zip" → "添加到压缩包..."
   - 选择格式为"zip"
   - 点击确定

### Mac系统

1. **使用系统自带功能**：
   - 右键点击include文件夹
   - 选择"压缩"
   - 系统会生成`.zip`文件

2. **使用命令行**：
   ```bash
   zip -r include.zip include/
   ```

### Linux系统

```bash
# ZIP格式（推荐）
zip -r include.zip include/

# TAR.GZ格式
tar -czf include.tar.gz include/
```

---

## 💡 前端用户体验优化建议

### 1. 添加拖拽上传

```typescript
const handleDrop = (e: React.DragEvent) => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  
  if (!validateIncludeFile(file)) {
    return;
  }
  
  uploadIncludeFile(file);
};

<div 
  onDrop={handleDrop}
  onDragOver={(e) => e.preventDefault()}
  className="drop-zone"
>
  拖拽.zip文件到这里上传
</div>
```

### 2. 显示文件预览信息

```typescript
const [selectedFile, setSelectedFile] = useState<File | null>(null);

const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (file && validateIncludeFile(file)) {
    setSelectedFile(file);
  }
};

// 显示
{selectedFile && (
  <div className="file-info">
    <p>已选择: {selectedFile.name}</p>
    <p>大小: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
  </div>
)}
```

### 3. 添加帮助链接

```tsx
<div className="help-section">
  <p>不知道如何压缩文件？</p>
  <a href="/docs/how-to-compress" target="_blank">
    查看压缩教程 →
  </a>
</div>
```

---

## ✅ 自检清单

前端开发完成后，请检查以下项目：

- [ ] 已移除文件夹选择功能（`webkitdirectory`属性）
- [ ] 已添加文件格式限制（`accept`属性）
- [ ] 已添加前端验证（检查文件扩展名）
- [ ] 已添加清晰的用户提示
- [ ] 已处理400错误并显示友好提示
- [ ] 已测试各种压缩包格式（至少测试.zip）
- [ ] 已更新相关文档和帮助信息

---

## 🔄 后端处理流程（供参考）

用户上传的压缩包后端会自动处理：

1. **上传阶段**: 验证文件是否为压缩包格式
2. **存储阶段**: 将压缩包保存到TOS
3. **下载阶段**: Worker从TOS下载压缩包
4. **解压阶段**: Worker自动解压到项目目录
5. **执行阶段**: 与主文件在同一目录下执行

**最终目录结构**:
```
/inputs/{task_id}/
  ├── master.xmp          # 主文件
  ├── file1.txt           # include解压的文件1
  ├── file2.dat           # include解压的文件2
  └── ...                 # 其他include文件
```

---

## 📞 遇到问题？

如果遇到问题，请检查：

1. **文件格式**: 确保是.zip或其他支持的压缩包格式
2. **文件大小**: 确保不超过500MB限制
3. **网络连接**: 确保网络稳定
4. **错误信息**: 查看控制台错误详情

如仍有问题，请联系后端开发团队。

---

**最后更新**: 2025-11-07  
**文档版本**: 1.0


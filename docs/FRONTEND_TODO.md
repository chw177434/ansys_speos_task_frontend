# 前端开发任务清单

> 为内网直连模式添加断点续传功能

---

## 📋 开发步骤

### Step 1: 复制示例代码（5分钟）

1. 打开文件：`frontend/direct_resumable_upload_example.tsx`
2. 复制以下核心函数到你的项目：
   ```typescript
   - initUpload()           // 初始化上传
   - uploadPart()           // 上传单个分片
   - listUploadedParts()    // 查询已上传分片
   - completeUpload()       // 完成上传
   - startUpload()          // 主上传流程
   ```

---

### Step 2: 修改 API 地址（1分钟）

```typescript
// 在你的项目中设置 API 基础地址
const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';
```

---

### Step 3: 检测上传模式（3分钟）

在现有的上传组件中添加模式检测：

```typescript
// 获取上传模式
const getUploadMode = async () => {
  const response = await axios.get('/api/upload/mode');
  return response.data.upload_mode; // 'direct' 或 'tos'
};

// 根据模式选择上传方式
const uploadFile = async (file: File) => {
  const mode = await getUploadMode();
  
  if (mode === 'direct') {
    // 使用新的分片上传（内网直连）
    await uploadWithDirectMultipart(file);
  } else if (mode === 'tos') {
    // 使用现有的 TOS 上传
    await uploadWithTOSMultipart(file);
  }
};
```

---

### Step 4: 实现主上传函数（10分钟）

```typescript
const uploadWithDirectMultipart = async (file: File) => {
  try {
    // 1. 初始化
    const init = await axios.post('/api/upload/direct/multipart/init', {
      filename: file.name,
      file_size: file.size,
      file_type: 'master',
      chunk_size: 5 * 1024 * 1024, // 5MB
    });

    const { task_id, upload_id, parts, total_chunks } = init.data;

    // 2. 查询已上传的分片（断点续传）
    const { data } = await axios.post('/api/upload/direct/multipart/list', {
      task_id,
      upload_id,
    });
    const uploadedParts = new Set(data.parts);

    // 3. 上传所有分片（跳过已上传的）
    for (const part of parts) {
      if (uploadedParts.has(part.part_number)) {
        console.log(`跳过分片 ${part.part_number}`);
        continue;
      }

      // 上传分片
      const chunk = file.slice(part.start_byte, part.end_byte);
      const formData = new FormData();
      formData.append('task_id', task_id);
      formData.append('upload_id', upload_id);
      formData.append('part_number', part.part_number.toString());
      formData.append('file', chunk);

      await axios.post('/api/upload/direct/multipart/part', formData, {
        timeout: 60000, // 60秒超时
      });

      // 更新进度
      console.log(`已上传: ${part.part_number}/${total_chunks}`);
    }

    // 4. 完成上传
    const result = await axios.post('/api/upload/direct/multipart/complete', {
      task_id,
      upload_id,
      filename: file.name,
      file_type: 'master',
      parts: parts.map(p => ({ part_number: p.part_number })),
    });

    console.log('上传完成:', result.data);
    alert('文件上传成功！');

  } catch (error) {
    console.error('上传失败:', error);
    alert('上传失败，请重试');
  }
};
```

---

### Step 5: 添加进度显示（可选，5分钟）

```typescript
const [progress, setProgress] = useState({ uploaded: 0, total: 0 });

// 在上传分片的循环中
for (let i = 0; i < parts.length; i++) {
  const part = parts[i];
  
  if (uploadedParts.has(part.part_number)) continue;
  
  await uploadPart(...);
  
  // 更新进度
  setProgress({ uploaded: i + 1, total: parts.length });
}

// UI 显示
<div>
  <p>上传进度: {Math.round((progress.uploaded / progress.total) * 100)}%</p>
  <progress value={progress.uploaded} max={progress.total} />
</div>
```

---

### Step 6: 添加断点续传支持（可选，10分钟）

```typescript
// 保存上传状态到 LocalStorage
const saveUploadState = (taskId: string, uploadId: string, uploadedParts: number[]) => {
  localStorage.setItem(`upload_${taskId}`, JSON.stringify({
    taskId,
    uploadId,
    uploadedParts,
    timestamp: new Date().toISOString(),
  }));
};

// 恢复上传
const resumeUpload = async (savedState: any) => {
  const { taskId, uploadId } = savedState;
  
  // 查询服务器已上传的分片
  const { data } = await axios.post('/api/upload/direct/multipart/list', {
    task_id: taskId,
    upload_id: uploadId,
  });
  
  // 继续上传剩余分片...
};

// 页面加载时检查未完成的上传
useEffect(() => {
  const savedUploads = Object.keys(localStorage)
    .filter(key => key.startsWith('upload_'))
    .map(key => JSON.parse(localStorage.getItem(key) || '{}'));
  
  if (savedUploads.length > 0) {
    // 提示用户恢复上传
    console.log('发现未完成的上传:', savedUploads);
  }
}, []);
```

---

## ✅ 开发检查清单

### 基础功能（必须）
- [ ] 复制核心上传函数
- [ ] 设置 API 基础地址
- [ ] 添加上传模式检测
- [ ] 实现分片上传流程
- [ ] 测试上传功能

### 进阶功能（推荐）
- [ ] 添加进度显示
- [ ] 添加断点续传支持
- [ ] 添加暂停/恢复功能
- [ ] 添加错误重试机制
- [ ] 集成到现有 UI

### 优化（可选）
- [ ] LocalStorage 保存进度
- [ ] 并发上传多个分片
- [ ] 动态调整分片大小
- [ ] 网络速度检测

---

## 🧪 测试清单

### 功能测试
- [ ] 上传小文件（< 10MB）
- [ ] 上传大文件（100MB+）
- [ ] 上传中途断网，恢复后继续
- [ ] 刷新页面，提示恢复上传
- [ ] 并发上传多个文件

### 错误处理
- [ ] 网络超时
- [ ] 服务器错误
- [ ] 取消上传
- [ ] 文件格式错误（Include 文件）

---

## 📞 遇到问题？

### 查看文档
- **快速参考**: [DIRECT_RESUMABLE_QUICK_START.md](./DIRECT_RESUMABLE_QUICK_START.md)
- **详细说明**: [DIRECT_RESUMABLE_UPLOAD_GUIDE.md](./DIRECT_RESUMABLE_UPLOAD_GUIDE.md)
- **示例代码**: [../frontend/direct_resumable_upload_example.tsx](../frontend/direct_resumable_upload_example.tsx)

### API 文档
- **Swagger UI**: http://localhost:8000/docs
- 在线测试所有接口

### 常见问题

**Q: 分片编号从0还是1开始？**  
A: 从 **1** 开始（不是0）

**Q: 如何验证文件完整性？**  
A: 后端会自动验证文件大小，前端也可以计算 MD5

**Q: 分片大小如何设置？**  
A: 默认 5MB，VPN 不稳定可以设置为 2-3MB

**Q: Include 文件格式要求？**  
A: 必须是压缩包格式（.zip, .rar, .7z, .tar.gz 等）

---

## 🎯 预期工作量

| 任务 | 预期时间 |
|------|---------|
| 复制基础代码 | 15分钟 |
| 集成到现有组件 | 30分钟 |
| 添加进度显示 | 15分钟 |
| 添加断点续传 | 30分钟 |
| 测试验证 | 1小时 |
| **总计** | **2-3小时** |

---

祝开发顺利！🚀


# 前端对接清单 - TOS 对象存储上传

## 📋 快速概览

### 旧流程 vs 新流程

| 步骤 | 旧流程（保留） | 新流程（推荐大文件） |
|------|---------------|-------------------|
| 1 | 用户选择文件 | 用户选择文件 |
| 2 | 直接 POST /tasks（FormData）| POST /tasks/upload/init |
| 3 | - | PUT 到 TOS（预签名URL）|
| 4 | - | POST /tasks/upload/confirm |

**使用建议：**
- 文件 < 50MB：继续用旧流程
- 文件 ≥ 50MB：使用新流程

---

## 🔧 需要修改的内容

### 1. 新增两个 API 调用

#### API 1: `POST /tasks/upload/init`

**请求：**
```json
{
  "filename": "file.zip",
  "file_size": 52428800,
  "file_type": "master",
  "content_type": "application/zip",
  "job_name": "任务名",
  "submitter": "用户名"
}
```

**响应：**
```json
{
  "task_id": "task_xxx",
  "master_upload": {
    "object_key": "speos_tasks/...",
    "upload_url": "https://...",
    "expires_in": 3600
  }
}
```

#### API 2: `POST /tasks/upload/confirm`

**请求：**
```json
{
  "task_id": "task_xxx",
  "master_object_key": "speos_tasks/...",
  "job_name": "任务名",
  "submitter": "用户名",
  "profile_name": "Standard",
  "version": "v252",
  "thread_count": "8"
  // ... 其他 SPEOS 参数
}
```

**响应：**
```json
{
  "task_id": "celery_task_id",
  "status": "QUEUED",
  "message": "Files downloaded from TOS..."
}
```

---

## 💻 最简实现（30行代码）

```javascript
async function uploadTask(file, formData) {
  try {
    // 1. 初始化
    const init = await fetch('/tasks/upload/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.name,
        file_size: file.size,
        file_type: 'master',
        content_type: file.type || 'application/octet-stream',
        job_name: formData.jobName,
        submitter: formData.submitter
      })
    }).then(r => r.json());

    // 2. 上传到 TOS
    await fetch(init.master_upload.upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file
    });

    // 3. 确认
    const confirm = await fetch('/tasks/upload/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_id: init.task_id,
        master_object_key: init.master_upload.object_key,
        ...formData
      })
    }).then(r => r.json());

    alert('任务提交成功: ' + confirm.task_id);
    return confirm.task_id;

  } catch (error) {
    alert('上传失败: ' + error.message);
    throw error;
  }
}
```

---

## 🎨 UI 需要添加的元素

### 1. 进度显示
```html
<div class="upload-progress">
  <div class="step">正在上传... (45%)</div>
  <div class="progress-bar">
    <div class="progress-fill" style="width: 45%"></div>
  </div>
</div>
```

### 2. 状态文字
```javascript
const statusMessages = {
  init: '📝 初始化上传...',
  uploading: '⬆️ 上传中...',
  confirming: '✅ 提交任务...',
  success: '🎉 成功！',
  error: '❌ 失败'
};
```

### 3. 大文件警告
```javascript
if (file.size > 100 * 1024 * 1024) { // 100MB
  const ok = confirm('文件较大，上传可能需要 10 分钟，继续吗？');
  if (!ok) return;
}
```

---

## 📱 关键代码片段

### React Hook 版本
```typescript
const [uploading, setUploading] = useState(false);
const [progress, setProgress] = useState(0);
const [step, setStep] = useState('');

const handleUpload = async (file: File) => {
  setUploading(true);
  setStep('初始化...');
  
  try {
    // 步骤1: 初始化
    const initRes = await fetch('/tasks/upload/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.name,
        file_size: file.size,
        file_type: 'master',
        content_type: file.type
      })
    });
    const initData = await initRes.json();
    
    // 步骤2: 上传（带进度）
    setStep('上传中...');
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setProgress(Math.round(e.loaded / e.total * 100));
      }
    };
    await new Promise((resolve, reject) => {
      xhr.onload = () => xhr.status === 200 ? resolve() : reject();
      xhr.onerror = reject;
      xhr.open('PUT', initData.master_upload.upload_url);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    });
    
    // 步骤3: 确认
    setStep('提交中...');
    const confirmRes = await fetch('/tasks/upload/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_id: initData.task_id,
        master_object_key: initData.master_upload.object_key,
        job_name: 'My Job',
        submitter: 'User'
      })
    });
    const confirmData = await confirmRes.json();
    
    alert('成功: ' + confirmData.task_id);
  } catch (error) {
    alert('失败: ' + error);
  } finally {
    setUploading(false);
  }
};
```

### Vue 3 Composition API 版本
```typescript
import { ref } from 'vue';

const uploading = ref(false);
const progress = ref(0);
const step = ref('');

const handleUpload = async (file: File) => {
  uploading.value = true;
  step.value = '初始化...';
  
  try {
    // 步骤1
    const initRes = await fetch('/tasks/upload/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.name,
        file_size: file.size,
        file_type: 'master',
        content_type: file.type
      })
    });
    const initData = await initRes.json();
    
    // 步骤2
    step.value = '上传中...';
    await fetch(initData.master_upload.upload_url, {
      method: 'PUT',
      body: file
    });
    
    // 步骤3
    step.value = '提交中...';
    const confirmRes = await fetch('/tasks/upload/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_id: initData.task_id,
        master_object_key: initData.master_upload.object_key,
        job_name: 'My Job',
        submitter: 'User'
      })
    });
    
    alert('成功！');
  } catch (error) {
    alert('失败: ' + error);
  } finally {
    uploading.value = false;
  }
};
```

---

## 🐛 错误处理

### 必须处理的错误情况

```javascript
try {
  // ... 上传逻辑
} catch (error) {
  // 1. 初始化失败
  if (error.message.includes('init')) {
    alert('初始化失败，请重试');
  }
  
  // 2. 上传到 TOS 失败
  else if (error.message.includes('upload')) {
    alert('上传失败，请检查网络');
  }
  
  // 3. 确认失败
  else if (error.message.includes('confirm')) {
    alert('任务提交失败，请联系管理员');
  }
  
  // 4. 其他错误
  else {
    alert('操作失败: ' + error.message);
  }
}
```

### 网络超时处理

```javascript
// 大文件需要更长超时时间
const timeout = file.size > 100 * 1024 * 1024 ? 600000 : 300000;

const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), timeout);

try {
  await fetch(url, {
    signal: controller.signal,
    // ...
  });
} finally {
  clearTimeout(timeoutId);
}
```

---

## ✅ 自测清单

部署前请确认：

**基础功能：**
- [ ] 能成功初始化上传（获取 task_id）
- [ ] 能上传文件到 TOS（返回 200）
- [ ] 能确认上传完成（获取最终 task_id）
- [ ] 三个步骤都有错误处理

**用户体验：**
- [ ] 有上传进度显示（0-100%）
- [ ] 有清晰的状态文字提示
- [ ] 上传中禁用表单
- [ ] 大文件有时间预警
- [ ] 失败后有明确的错误提示

**测试场景：**
- [ ] 测试小文件（< 10MB）
- [ ] 测试大文件（> 100MB）
- [ ] 测试网络断开时的错误提示
- [ ] 测试表单验证（必填项）

---

## 📞 常见问题

### Q1: 需要修改现有的上传功能吗？
**A:** 不需要！旧的 `POST /tasks` 接口保持不变，可以继续使用。新流程是**可选的**，建议大文件使用。

### Q2: 必须显示进度吗？
**A:** 不是必须的，但**强烈建议**。大文件上传时间较长，没有进度用户会以为卡住了。

### Q3: 如何判断用新流程还是旧流程？
**A:** 建议：
```javascript
if (file.size > 50 * 1024 * 1024) {
  // 使用新流程（TOS）
} else {
  // 使用旧流程（直接上传）
}
```

### Q4: 上传到 TOS 这一步需要特殊处理吗？
**A:** 不需要！就是普通的 `PUT` 请求，把文件作为 body 发送即可。关键是使用返回的 `upload_url`。

### Q5: include 文件怎么处理？
**A:** 和 master 文件一样，分别调用初始化接口，然后在确认时同时传递两个 `object_key`。

---

## 🎯 工作量评估

| 任务 | 预计时间 | 说明 |
|------|---------|------|
| 理解新流程 | 30分钟 | 阅读文档，理解三步流程 |
| 实现基础功能 | 2小时 | 三个 API 调用 + 基础错误处理 |
| 添加进度显示 | 1小时 | 进度条 + 状态文字 |
| UI 优化 | 2小时 | 样式、交互、响应式 |
| 测试调试 | 1小时 | 各种场景测试 |
| **总计** | **6-7小时** | 约 1 个工作日 |

---

## 📚 完整文档

- **详细实现指南：** 查看 `FRONTEND_INTEGRATION_GUIDE.md`
- **React 完整示例：** 包含 TypeScript、样式、完整组件
- **Vue 示例：** Composition API 版本
- **原生 JS 示例：** 不依赖框架的实现

---

## 🎉 开始开发

1. 阅读本清单（5分钟）
2. 查看 `FRONTEND_INTEGRATION_GUIDE.md` 获取完整代码
3. 复制对应框架的示例代码
4. 根据实际情况调整 API 地址和参数
5. 测试！

有问题随时沟通！🚀


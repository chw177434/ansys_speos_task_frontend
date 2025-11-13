# 问题分析与解决方案

## 🔍 问题汇总

用户提出了4个关键问题，需要仔细分析：

1. ❓ 任务重试功能在界面中看不到
2. ❓ 文件传输失败后的断点续传功能消失
3. ❓ 任务执行中看不到 SPEOS 的预估时间
4. ❓ 下载成功任务的结果时报错

---

## 📋 问题 1: 任务重试功能看不到

### 🔍 分析

我刚刚实现了任务重试功能，但用户反馈看不到。让我检查可能的原因：

#### 代码确认

```typescript
// TasksTable.tsx 第 933 行
const canRetry = ["FAILURE", "FAILED", "REVOKED", "CANCELLED", "CANCELED", "ABORTED"].includes(task.status);

// TasksTable.tsx 第 1005-1014 行
{canRetry && (
  <button
    onClick={() => handleRetry(task.task_id)}
    disabled={task.retrying}
    className="..."
  >
    {task.retrying ? "重试中..." : "🔄 重新执行"}
  </button>
)}
```

### ✅ 根本原因

**需要满足以下条件才能看到重试按钮**:

1. ❗ **前端服务已重启** - 新代码生效需要重启
2. ❗ **任务状态是失败状态** - 只有失败的任务才显示重试按钮
3. ❗ **后端支持重试接口** - 后端 `/api/tasks/{id}/retry` 已实现

### 🔧 解决方案

#### 步骤 1: 重启前端服务

```bash
# 停止当前服务（Ctrl+C）
# 然后重新启动
npm run dev
```

#### 步骤 2: 验证任务状态

**重试按钮只在以下状态显示**:
- ❌ FAILURE
- ❌ FAILED  
- 🚫 REVOKED
- ⛔ CANCELLED
- ⛔ CANCELED
- 🛑 ABORTED

**如果任务状态是**:
- ✅ SUCCESS - 不显示（已成功）
- 🔵 RUNNING - 不显示（运行中）
- 🟡 PENDING - 不显示（等待中）

#### 步骤 3: 检查浏览器控制台

```javascript
// 打开浏览器开发者工具（F12）
// 查看 Console 是否有错误

// 检查网络请求
// 1. 打开 Network 选项卡
// 2. 刷新页面
// 3. 查看 /api/tasks 请求
// 4. 检查响应数据中是否有失败的任务
```

### 🎯 快速测试

```bash
# 1. 创建一个会失败的测试任务
curl -X POST "http://localhost:8000/api/tasks/submit-direct" \
  -F "master_file=@invalid.speos" \
  -F "job_name=test_fail" \
  -F "profile_name=test" \
  -F "version=2023"

# 2. 等待任务失败（约 1-2 分钟）

# 3. 刷新前端页面

# 4. 应该能看到 "🔄 重新执行" 按钮
```

---

## 📋 问题 2: 断点续传功能消失

### 🔍 分析

用户说之前有文件传输失败后的断点续传功能，但现在没有了。

#### 代码检查

```typescript
// UploadForm.tsx 第 187-194 行 - 状态定义存在 ✅
const [pendingUploads, setPendingUploads] = useState<Array<{
  taskId: string;
  filename: string;
  uploadedChunks: number;
  totalChunks: number;
  fileType: string;
}>>([]);

// UploadForm.tsx 第 1162 行 - UI 显示存在 ✅
{pendingUploads.length > 0 && (
  <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
    {/* 断点续传提示 */}
  </div>
)}
```

### ✅ 根本原因

**断点续传功能的代码还在！但只在特定条件下显示**:

1. ❗ **只在 TOS 上传模式下有效** - Direct 模式不支持断点续传
2. ❗ **需要有未完成的上传记录** - localStorage 中要有记录
3. ❗ **文件大小 >= 10MB** - 小文件不使用分片上传

### 🔧 问题所在

#### 当前上传模式配置

```typescript
// UploadForm.tsx 第 297 行
// 临时方案：如果后端配置接口不可用，默认使用 Direct 模式
setUploadMode("direct");
```

**Direct 模式不支持断点续传！** 因为：
- Direct 模式直接上传到服务器
- 使用 XMLHttpRequest 一次性上传
- 没有分片机制

**TOS 模式支持断点续传** 因为：
- 使用分片上传（5MB 每片）
- localStorage 记录已上传的分片
- 可以从断点继续

### 🎯 解决方案

#### 方案 1: 切换到 TOS 模式（推荐）

```typescript
// 如果需要断点续传功能，后端需要配置 TOS 上传模式
// 修改后端配置文件
upload_mode = "tos"  # 而不是 "direct"
```

#### 方案 2: 为 Direct 模式添加断点续传（需要开发）

这需要：
1. 修改 Direct 上传的实现
2. 添加分片上传逻辑
3. 使用 localStorage 记录进度

**工作量**: 约 2-3 天开发时间

### 📊 功能对比

| 功能 | Direct 模式 | TOS 模式 |
|------|------------|----------|
| **上传目标** | 直接到服务器 | 先到对象存储 |
| **断点续传** | ❌ 不支持 | ✅ 支持 |
| **分片上传** | ❌ 不支持 | ✅ 支持（5MB/片） |
| **大文件支持** | ⚠️ 受限于服务器 | ✅ 无限制 |
| **网络要求** | 稳定 | 可中断 |
| **适用场景** | 内网小文件 | 公网大文件 |

---

## 📋 问题 3: 看不到 SPEOS 预估时间

### 🔍 分析

我刚刚实现了进度信息显示功能，让我检查为什么看不到。

#### 代码确认

```typescript
// TasksTable.tsx 第 279-325 行 - renderProgressInfo 函数存在 ✅
function renderProgressInfo(progressInfo: ProgressInfo | null | undefined): JSX.Element | null {
  if (!progressInfo) return null;
  
  const { estimated_time, progress_percent, current_step } = progressInfo;
  
  // 显示预估时间
  {hasEstimatedTime && (
    <div className="flex items-center justify-between">
      <span className="text-blue-700 font-medium">预计时间:</span>
      <span className="text-blue-800">{estimated_time}</span>
    </div>
  )}
}

// TasksTable.tsx 第 973 行 - 已经调用 ✅
{renderProgressInfo(task.progress_info)}
```

### ✅ 根本原因

**前端代码是正确的！问题可能在于**:

#### 情况 1: 后端没有返回 progress_info

检查后端响应：

```bash
# 查看任务详情 API 的响应
curl "http://localhost:8000/api/tasks/{task_id}"

# 预期应该看到：
{
  "task_id": "abc123",
  "status": "RUNNING",
  "progress_info": {              # ← 检查这个字段
    "estimated_time": "2.5 hours",
    "progress_percent": 45.2,
    "current_step": "3/10"
  }
}

# 如果没有 progress_info 字段，说明后端没有返回！
```

#### 情况 2: 后端返回了但数据为空

```json
{
  "task_id": "abc123",
  "status": "RUNNING",
  "progress_info": null  # ← 或者所有字段都是 null
}
```

#### 情况 3: 任务还没有开始执行

SPEOS 进度信息只在任务实际执行时才有：
- ⏳ PENDING - 没有进度信息（还在队列中）
- 🚀 STARTED - 可能还没有进度信息（刚启动）
- ▶️ RUNNING - 应该有进度信息（正在执行）

### 🔧 排查步骤

#### 步骤 1: 检查后端日志

```bash
# 查看后端 worker 日志
# 应该能看到类似的输出：
[task_abc123] SPEOS: Progress: 45.2%
[task_abc123] SPEOS: Estimated time: 2.5 hours
[task_abc123] SPEOS: Step 3/10
```

#### 步骤 2: 检查后端代码

```python
# worker_windows/worker_app.py 第 682-810 行
# 确认是否有以下代码：

progress_info = {
    "estimated_time": None,
    "progress_percent": None,
    "current_step": None,
}

def parse_progress_line(line: str):
    """从输出行中提取进度信息"""
    # 实现正则解析逻辑
    ...

# 返回值中包含 progress_info
return {
    "status": "SUCCESS",
    "progress_info": progress_info,  # ← 关键！
}
```

#### 步骤 3: 前端调试

```javascript
// 在浏览器控制台中运行
const tasks = document.querySelectorAll('tr');
tasks.forEach((row, i) => {
  console.log(`Task ${i}:`, {
    taskId: row.querySelector('[class*="task_id"]')?.textContent,
    status: row.querySelector('[class*="status"]')?.textContent,
    hasProgressInfo: row.querySelector('[class*="bg-blue-50"]') !== null
  });
});
```

### 🎯 问题定位

#### 如果后端返回了 progress_info

✅ 前端会自动显示，无需额外操作

#### 如果后端没有返回 progress_info

需要确认：
1. 后端代码是否正确实现了进度捕获（第 682-810 行）
2. 正则表达式是否匹配 SPEOS 的输出格式
3. Celery 任务返回值是否包含 progress_info

---

## 📋 问题 4: 下载任务结果报错

### 🔍 分析

用户尝试下载成功任务的结果，但报错了。

#### 下载链接生成逻辑

```typescript
// TasksTable.tsx 第 96-118 行
function buildOutputUrl(raw: string | null | undefined, taskId: string): string {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return "";
  
  // 1. 如果已经是完整 URL，直接返回
  if (/^https?:\/\//i.test(value)) return value;

  // 2. 构建相对路径
  const base = API_BASE.replace(/\/+$/, "");
  
  // 3. 如果以 / 开头，直接拼接
  if (value.startsWith("/")) {
    return `${base}${value}`;
  }

  // 4. 其他情况
  const normalized = value.replace(/^[/\\.]+/, "").replace(/\\/g, "/");
  
  if (normalized.startsWith("tasks/")) {
    return `${base}/${normalized}`;
  }

  // 5. 默认路径
  const encoded = normalized
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `${base}/tasks/${taskId}/outputs/${encoded}`;
}
```

### ✅ 可能的原因

#### 原因 1: API_BASE 配置问题

```typescript
// lib/api.ts
export const API_BASE = "/api";

// 问题：如果 Next.js 代理没有正确配置，这个路径可能无法访问
```

检查 Next.js 配置：

```javascript
// next.config.js 应该有类似配置
module.exports = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
    ];
  },
};
```

#### 原因 2: 后端返回的下载 URL 格式不正确

**后端应该返回**:

```json
{
  "task_id": "abc123",
  "status": "SUCCESS",
  "download_url": "/api/tasks/abc123/download",  // ← 正确格式
  "download_name": "results.zip"
}
```

**常见错误格式**:

```json
{
  "download_url": "tasks/abc123/outputs/results.zip",  // ❌ 缺少 /api 前缀
  "download_url": "\\tasks\\abc123\\outputs\\results.zip",  // ❌ Windows 路径
  "download_url": "D:\\speos\\outputs\\results.zip",  // ❌ 绝对路径
}
```

#### 原因 3: CORS 问题（如果是跨域）

```bash
# 如果前端和后端在不同域名/端口，可能有 CORS 问题
# 浏览器控制台会显示：
Access to fetch at 'http://localhost:8000/api/tasks/...' from origin 'http://localhost:3000' 
has been blocked by CORS policy
```

#### 原因 4: 文件路径权限问题

后端可能无法访问输出文件：
- 文件被移动或删除
- 权限不足
- 路径不存在

### 🔧 排查步骤

#### 步骤 1: 检查下载链接

```javascript
// 在浏览器控制台中运行
const downloadLinks = document.querySelectorAll('a[download]');
downloadLinks.forEach((link, i) => {
  console.log(`Link ${i}:`, {
    href: link.href,
    text: link.textContent
  });
});
```

#### 步骤 2: 手动测试下载 API

```bash
# 直接访问下载 URL
curl -I "http://localhost:8000/api/tasks/abc123/download"

# 预期响应：
HTTP/1.1 200 OK
Content-Type: application/zip
Content-Disposition: attachment; filename="results.zip"
Content-Length: 12345

# 如果返回 404，说明：
# - 任务 ID 不存在
# - 输出文件不存在
# - 路径配置错误

# 如果返回 500，说明：
# - 后端代码错误
# - 文件访问权限问题
```

#### 步骤 3: 检查网络请求

```javascript
// 在浏览器开发者工具中
// 1. 打开 Network 选项卡
// 2. 点击下载按钮
// 3. 查看失败的请求

// 常见错误：
// - 404 Not Found: 文件或路径不存在
// - 403 Forbidden: 权限不足
// - 500 Internal Server Error: 服务器错误
// - CORS error: 跨域问题
```

#### 步骤 4: 检查后端日志

```bash
# 查看后端日志
# 应该能看到下载请求和错误信息
[ERROR] Failed to serve file: /path/to/file not found
```

### 🎯 解决方案

#### 解决方案 1: 修复 buildOutputUrl 逻辑（如果是前端问题）

```typescript
// 如果发现 URL 格式不对，可能需要调整
function buildOutputUrl(raw: string | null | undefined, taskId: string): string {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return "";
  
  // 完整 URL 直接返回
  if (/^https?:\/\//i.test(value)) return value;

  const base = API_BASE.replace(/\/+$/, "");
  
  // ✅ 确保所有路径都有 /api 前缀
  if (value.startsWith("/api/")) {
    return `${base}${value.substring(4)}`;  // 移除 /api 前缀，因为 base 已包含
  }
  
  if (value.startsWith("/")) {
    return `${base}${value}`;
  }
  
  // 其他情况...
}
```

#### 解决方案 2: 后端修复（如果是后端问题）

```python
# 确保返回正确的 URL 格式
def get_task_download_url(task_id: str) -> str:
    # ✅ 正确：返回相对路径，前端会自动拼接
    return f"/api/tasks/{task_id}/download"
    
    # ❌ 错误：返回不完整的路径
    # return f"tasks/{task_id}/download"
    
    # ❌ 错误：返回 Windows 路径
    # return f"D:\\outputs\\{task_id}\\results.zip"
```

---

## 🎯 总结与建议

### 问题 1: 任务重试功能

**状态**: ✅ 已实现，需要重启服务  
**操作**: 
1. 重启前端服务
2. 确认任务状态是失败状态
3. 应该能看到重试按钮

### 问题 2: 断点续传功能

**状态**: ⚠️ 仅 TOS 模式支持  
**建议**: 
- 如果需要断点续传，切换到 TOS 模式
- 或者为 Direct 模式添加分片上传功能（需开发）

### 问题 3: SPEOS 预估时间

**状态**: ✅ 前端已实现，需检查后端  
**排查**: 
1. 检查后端是否返回 `progress_info`
2. 检查后端日志是否捕获 SPEOS 输出
3. 验证正则表达式是否匹配

### 问题 4: 下载报错

**状态**: ❓ 需要详细排查  
**步骤**: 
1. 检查浏览器控制台的错误信息
2. 检查下载链接的格式
3. 手动测试后端下载 API
4. 检查后端日志

---

## 🔍 下一步行动

### 立即执行

```bash
# 1. 重启前端服务
npm run dev

# 2. 打开浏览器开发者工具（F12）

# 3. 提交一个测试任务

# 4. 观察：
#    - 重试按钮是否出现
#    - 进度信息是否显示
#    - 下载链接是否正确

# 5. 记录所有错误信息
```

### 需要提供的信息

为了更准确地定位问题，请提供：

1. **浏览器控制台的错误截图**
2. **网络请求的响应数据**（特别是任务详情 API）
3. **后端日志**（特别是任务执行和下载相关）
4. **当前的上传模式**（Direct 还是 TOS）

---

**文档创建时间**: 2024-11-12  
**需要协助**: 随时联系


# Direct 模式断点续传快速开始

> **5 分钟快速上手指南**

---

## ✨ 功能概述

内网直连模式（Direct Mode）现已支持断点续传！通过 VPN 连接内网时，即使网络中断，也能从断点继续上传。

**核心特性**：
- 🚀 **自动启用**：大文件（≥10MB）自动使用断点续传
- 💾 **智能恢复**：网络中断后自动检测并恢复
- 📊 **实时进度**：显示分片上传进度和速度
- 🔄 **无缝切换**：小文件自动使用普通上传（更快）

---

## 🎯 快速开始

### 1. 上传大文件（自动启用断点续传）

```typescript
// ✅ 已自动集成，无需修改代码！

// 当你上传 ≥10MB 的文件时，系统会自动：
// 1. 检测文件大小
// 2. 选择断点续传模式
// 3. 分片上传（5MB 每片）
// 4. 保存进度到 localStorage
```

**用户体验**：
```
📦 Direct 模式：使用断点续传
━━━━━━━━━━━━━━━━━━ 45%

速度: 25.5 MB/s
剩余时间: 15 秒

📦 分片上传模式
9/20 片

当前分片: #10
```

### 2. 中断后恢复上传

**场景**：上传到一半，网络断开了

**步骤**：
1. 重新连接网络（或等待网络恢复）
2. 刷新页面
3. 你会看到这个提示：

```
💾 检测到未完成的上传（断点续传可用）

您有 1 个文件没有上传完成。选择相同的文件并填写相同的 Job Name，
系统会自动从断点继续上传。

📄 model.zip (master) [Direct]    已上传 9/20 片    [清除]
```

4. 选择**相同的文件**，填写表单
5. 点击"提交任务"
6. **系统会自动跳过已上传的 9 片，从第 10 片继续！**

### 3. 手动清除未完成的上传

如果你不想继续某个上传，可以清除它：

1. 在"未完成上传"提示框中找到该文件
2. 点击右侧的 **[清除]** 按钮
3. 该上传记录会从 localStorage 中删除

---

## 📋 使用示例

### 示例 1：上传 100MB 文件

```typescript
// 用户操作：
1. 选择文件：model.zip (100MB)
2. 填写表单：Job Name = "测试任务"
3. 点击"提交任务"

// 系统自动判断：
✅ 文件大小 = 100MB ≥ 10MB
✅ 使用 Direct 模式断点续传
✅ 分片数量 = 20 片（100MB ÷ 5MB）

// 上传过程：
⬆️ [Direct] 上传 Master 文件（分片模式）
✅ [Direct] Master 分片 1/20 上传完成
✅ [Direct] Master 分片 2/20 上传完成
... (自动保存进度到 localStorage)
✅ [Direct] Master 分片 20/20 上传完成
🏁 完成上传，合并所有分片...
✅ 提交任务...
🎉 完成！
```

### 示例 2：网络中断恢复

```typescript
// 场景：上传到 50% 时网络断开

// Step 1: 上传中（0% → 50%）
⬆️ [Direct] 上传 Master 文件（分片模式）
✅ [Direct] Master 分片 1/20 上传完成
✅ [Direct] Master 分片 2/20 上传完成
...
✅ [Direct] Master 分片 10/20 上传完成
❌ 网络错误！

// Step 2: 用户刷新页面后看到提示
💾 检测到未完成的上传（断点续传可用）
📄 model.zip (master) [Direct]    已上传 10/20 片

// Step 3: 用户重新选择相同文件并提交
🔍 [Direct] 发现匹配的未完成上传: model.zip, taskId=abc-123
📥 [Direct] 恢复上传: model.zip, 已上传 10/20 片

// Step 4: 从断点继续
⏭️ [Direct] 跳过已上传的分片 1/20
⏭️ [Direct] 跳过已上传的分片 2/20
...
⏭️ [Direct] 跳过已上传的分片 10/20
⬆️ [Direct] 上传分片 11/20 (5 MB)
✅ [Direct] 分片 11 上传成功
... (继续上传剩余的 10 片)
🎉 完成！
```

### 示例 3：小文件（自动使用普通上传）

```typescript
// 用户操作：
1. 选择文件：small.zip (5MB)
2. 填写表单
3. 点击"提交任务"

// 系统自动判断：
✅ 文件大小 = 5MB < 10MB
✅ 使用 Direct 模式普通上传（不分片，更快）

// 上传过程：
🚀 Direct 模式：直接上传文件到服务器
━━━━━━━━━━━━━━━━━━ 100%
🎉 完成！
```

---

## 🔧 配置说明

### 1. 文件大小阈值

```typescript
// 在 UploadForm.tsx 中
const DIRECT_RESUMABLE_THRESHOLD = 10 * 1024 * 1024;  // 10MB

// 规则：
// >= 10MB → 使用断点续传
// <  10MB → 使用普通上传
```

**如何调整**：
- **更快但风险高**：提高到 50MB（小文件不分片，上传更快）
- **更稳定但较慢**：降低到 5MB（所有文件都分片，更可靠）

### 2. 分片大小

```typescript
// 在 lib/api.ts 中
export const CHUNK_SIZE = 5 * 1024 * 1024;  // 5MB

// 规则：
// - 内网环境：可以设为 10MB（更快）
// - VPN 环境：保持 5MB（平衡速度和稳定性）
// - 不稳定网络：降低到 2-3MB（更稳定）
```

---

## 🐛 常见问题

### Q1: 为什么我的文件没有使用断点续传？

**检查清单**：
- [ ] 文件大小 ≥ 10MB？
- [ ] 上传模式是 Direct 模式？
- [ ] 后端接口已实现？

**验证方法**：
打开浏览器控制台，查看日志：
```
✅ 应该看到：
   "使用 Direct 模式断点续传"
   "[Direct] 初始化分片上传"

❌ 如果看到：
   "使用 Direct 模式普通上传"
   → 文件太小，未启用断点续传
```

### Q2: 断点续传不生效，每次都重新上传？

**可能原因**：
1. **文件不同**：确保文件名和文件大小完全相同
2. **localStorage 被清除**：检查浏览器是否禁用了 localStorage
3. **Job Name 不同**：虽然不影响匹配，但建议填写相同的

**解决方法**：
```javascript
// 打开浏览器开发者工具 → Application → Local Storage

// 查找 key：
direct_upload_{task_id}_master
direct_upload_{task_id}_include

// 如果没有找到，说明进度未保存
```

### Q3: 如何清除所有未完成的上传？

**方法 1：UI 清除**
在"未完成上传"提示框中，逐个点击 [清除] 按钮

**方法 2：控制台清除**
```javascript
// 打开浏览器控制台（F12），执行：

// 清除所有 Direct 模式的上传
Object.keys(localStorage)
  .filter(key => key.startsWith('direct_upload_'))
  .forEach(key => localStorage.removeItem(key));

// 清除所有 TOS 模式的上传
Object.keys(localStorage)
  .filter(key => key.startsWith('resumable_upload_'))
  .forEach(key => localStorage.removeItem(key));
```

---

## 📊 上传模式对比

| 特性 | 普通上传 | 断点续传 |
|------|---------|---------|
| 文件大小 | < 10MB | ≥ 10MB |
| 分片 | 否 | 是（5MB/片） |
| 断点恢复 | ❌ | ✅ |
| 上传速度 | 更快 | 稍慢（但更可靠） |
| localStorage | 不使用 | 自动保存 |
| 适用场景 | 稳定网络 | VPN、不稳定网络 |

---

## 🎓 技术细节（可选阅读）

### 断点续传原理

```
1. 文件分片
   [文件] → [片1][片2][片3]...[片N]

2. 上传分片
   片1 → ✅ 成功 → 保存到 localStorage
   片2 → ✅ 成功 → 保存到 localStorage
   片3 → ❌ 失败 → 中断
   
3. 恢复上传
   检查 localStorage → 发现已上传 [片1, 片2]
   跳过 [片1, 片2]
   从 片3 继续上传

4. 完成上传
   所有分片上传完成 → 服务器合并 → 完成！
```

### 文件匹配逻辑

```typescript
// 系统如何判断两次上传是否是同一个文件？

// 匹配条件：
1. 文件名相同（data.filename === file.name）
2. 文件大小相同（data.file_size === file.size）

// 示例：
文件 A: "model.zip", 100MB  ✅ 匹配
文件 B: "model.zip", 100MB  ✅ 匹配
文件 C: "model.zip", 120MB  ❌ 不匹配（大小不同）
文件 D: "model2.zip", 100MB ❌ 不匹配（名称不同）
```

---

## 📚 进阶使用

### 查看上传进度（开发者工具）

```javascript
// 打开浏览器控制台（F12），执行：

// 查看所有 Direct 模式的上传进度
Object.keys(localStorage)
  .filter(key => key.startsWith('direct_upload_'))
  .forEach(key => {
    const data = JSON.parse(localStorage.getItem(key));
    console.log(`文件: ${data.filename}`);
    console.log(`进度: ${data.uploaded_parts.length}/${data.total_chunks}`);
    console.log(`已上传分片: ${data.uploaded_parts.join(', ')}`);
  });
```

### 手动触发断点续传

```typescript
// 如果需要手动控制上传流程

import { uploadFileWithDirectResumable } from "../lib/directResumableUpload";

const file = ...; // 你的文件

const result = await uploadFileWithDirectResumable(
  file,
  file.name,
  "master",
  {
    // 可选：指定已有的 task_id 和 upload_id
    existingTaskId: "abc-123",
    existingUploadId: "upload-xyz",
    
    // 进度回调
    onProgress: (info) => {
      console.log(`进度: ${info.progress}%`);
      console.log(`速度: ${info.speed / 1024 / 1024} MB/s`);
    },
    
    // 分片完成回调
    onChunkComplete: (chunk, total) => {
      console.log(`分片 ${chunk}/${total} 完成`);
    },
    
    // 取消信号
    abortSignal: controller.signal,
  }
);

console.log(`上传完成: ${result.filePath}`);
```

---

## 🔗 相关链接

- **详细文档**: [DIRECT_RESUMABLE_IMPLEMENTATION.md](./DIRECT_RESUMABLE_IMPLEMENTATION.md)
- **后端接口**: [【给前端】断点续传接口规范.md](./【给前端】断点续传接口规范.md)
- **原始需求**: [FRONTEND_TODO.md](./FRONTEND_TODO.md)

---

## ✅ 检查清单

使用前，请确认：

- [ ] 后端已实现 Direct 模式断点续传接口
- [ ] 前端已更新到最新版本
- [ ] 浏览器支持 localStorage
- [ ] **使用标准浏览器模式（不是无痕/隐私模式）** ⚠️
- [ ] 网络环境可以访问后端服务器

### ⚠️ 重要限制

**断点续传功能不支持无痕浏览器（隐私模式）**

原因：
- 无痕模式下，localStorage 数据在关闭标签页后会被清除
- 无法保存上传进度到下次访问
- 只能在同一标签页内刷新恢复

**解决方案**：
- ✅ 使用标准浏览器模式
- ❌ 不要使用无痕/隐私模式

---

**就这么简单！开始上传吧！🚀**

有问题？查看 [详细文档](./DIRECT_RESUMABLE_IMPLEMENTATION.md) 或联系开发团队。


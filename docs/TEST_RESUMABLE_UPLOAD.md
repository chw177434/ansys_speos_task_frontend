# 断点续传测试手册

## 🧪 完整测试流程

### 准备工作

1. **启动开发服务器**
   ```bash
   npm run dev
   ```

2. **打开浏览器**
   - 访问：http://localhost:3000
   - 打开开发者工具（F12）
   - 切换到 Console（控制台）标签

### 测试 1：验证上传模式

1. **查看页面顶部的模式指示器**
   - ✅ 应该看到：`🚀 内网直连模式` （绿色）
   - ❌ 如果看到：`☁️ 云端存储模式` （蓝色）→ 说明是 TOS 模式

2. **如果是 TOS 模式**，需要检查后端配置：
   - 后端环境变量：`UPLOAD_MODE=direct`
   - 重启后端服务

### 测试 2：小文件测试（验证基础功能）

**目的**：验证代码是否正常运行

1. **准备文件**：创建或找一个 20MB 的文件

2. **开始上传**：
   - 填写表单
   - 选择文件
   - 点击"提交任务"

3. **观察控制台**，应该看到：
   ```
   📡 使用 Direct 模式上传（内网直连）
   📦 文件较大 (20 MB)，使用 Direct 模式断点续传
   [Direct] 🚀 初始化分片上传: xxx.zip (20 MB)
   [Direct] ✅ 初始化成功: taskId=xxx, uploadId=xxx, 总分片=4
   [Direct] ⬆️ 上传分片 1/4 (5 MB)
   [Direct] ✅ 分片 1 上传成功
   ✅ [Direct] 保存上传进度: xxx.zip, 已上传 1/4 片
   ```

4. **检查 localStorage**：
   - 开发者工具 → Application → Local Storage
   - 应该看到：`direct_upload_xxx_master`

### 测试 3：断点续传测试

**目的**：验证断点续传功能

#### 步骤 A：上传并中断

1. **准备文件**：准备一个 50MB 的文件

2. **开始上传**

3. **等待上传到 30-40%**（至少上传 2-3 个分片）

4. **观察控制台**，确认看到多次：
   ```
   ✅ [Direct] 保存上传进度: xxx.zip, 已上传 X/10 片
   ```

5. **关闭浏览器标签页**（或整个浏览器）

#### 步骤 B：验证数据保存

1. **重新打开浏览器**

2. **访问：http://localhost:3000**

3. **打开开发者工具 → Console**

4. **应该立即看到这些日志**：
   ```
   🔍 [调试] 开始检测未完成的上传...
   🔍 [调试] localStorage 中的所有 keys: [...]
   🔍 [调试] 发现 Direct 模式上传记录: direct_upload_xxx_master
   🔍 [调试] Direct 数据: {task_id: "...", uploaded_parts: [1,2,3,...]}
   ✅ [调试] 添加 Direct 上传到待恢复列表
   📊 [调试] 检测完成，发现未完成的上传: 1 个
   ```

5. **页面上应该看到提示框**：
   ```
   💾 检测到未完成的上传（断点续传可用）
   
   📄 xxx.zip (master) [Direct]    已上传 X/10 片    [清除]
   ```

#### 步骤 C：恢复上传

1. **选择相同的文件**

2. **填写表单**

3. **点击"提交任务"**

4. **观察控制台**，应该看到：
   ```
   🔍 [Direct] 发现匹配的未完成上传: xxx.zip, taskId=xxx
   📥 [Direct] 恢复上传: xxx.zip, 已上传 X/10 片
   ⏭️ [Direct] 跳过已上传的分片 1/10
   ⏭️ [Direct] 跳过已上传的分片 2/10
   ...
   ⬆️ [Direct] 上传分片 Y/10 (5 MB)
   ```

## 🐛 问题排查

### 问题 1：控制台没有任何 `[调试]` 日志

**原因**：代码没有执行或浏览器缓存问题

**解决**：
1. 硬刷新页面（Ctrl + Shift + R 或 Cmd + Shift + R）
2. 清除浏览器缓存
3. 检查是否有 JavaScript 错误

### 问题 2：看到日志但 localStorage 是空的

**可能的原因**：

#### 原因 A：没有上传完整个分片

- 如果你在上传分片的**过程中**关闭页面，这个分片不会被保存
- **解决**：等待至少上传完 1-2 个分片（看到 `✅ [Direct] 保存上传进度`）

#### 原因 B：使用了普通上传而不是断点续传

控制台显示：
```
🚀 文件较小 (xxx MB)，使用 Direct 模式普通上传
```

**原因**：文件 < 10MB

**解决**：使用 >= 10MB 的文件

#### 原因 C：使用了 TOS 模式

控制台显示：
```
📡 使用 TOS 模式上传（对象存储）
```

**解决**：
- 检查后端配置：`UPLOAD_MODE=direct`
- 或者检查 TOS 模式的 localStorage key：`resumable_upload_*`

### 问题 3：localStorage 有数据但没有显示提示

**检查步骤**：

1. **手动查询 localStorage**

在控制台执行：
```javascript
Object.keys(localStorage)
  .filter(key => key.startsWith('direct_upload_'))
  .forEach(key => {
    const data = JSON.parse(localStorage.getItem(key));
    console.log('文件名:', data.filename);
    console.log('已上传:', data.uploaded_parts.length, '/', data.total_chunks);
    console.log('上传分片:', data.uploaded_parts);
  });
```

2. **检查数据格式**

确保数据包含这些字段：
```javascript
{
  task_id: "string",
  upload_id: "string", 
  file_type: "master" or "include",
  filename: "string",
  file_size: number,
  total_chunks: number,
  uploaded_parts: [1, 2, 3, ...],  // 数组
  timestamp: number
}
```

3. **检查检测逻辑**

看控制台是否有这些日志：
```
🔍 [调试] 发现 Direct 模式上传记录: ...
🔍 [调试] Direct 数据: ...
❌ [调试] Direct 上传已完成或数据不完整
```

如果看到 `❌ Direct 上传已完成或数据不完整`，说明：
- `uploaded_parts.length` >= `total_chunks`（已完成）
- 或者数据字段缺失

### 问题 4：后端接口 404

**错误示例**：
```
POST http://localhost:8000/api/upload/direct/multipart/init
→ 404 Not Found
```

**原因**：后端没有实现 Direct 模式的断点续传接口

**解决**：
1. 检查后端是否已实现这些接口：
   - `/api/upload/direct/multipart/init`
   - `/api/upload/direct/multipart/part`
   - `/api/upload/direct/multipart/list`
   - `/api/upload/direct/multipart/complete`

2. 查看后端文档：`docs/【给前端】断点续传接口规范.md`

3. 联系后端开发确认接口状态

## 🔧 手动测试 localStorage

### 创建测试数据

在控制台执行：

```javascript
// 创建一个测试记录
const testData = {
  task_id: "test-task-123",
  upload_id: "test-upload-456",
  file_type: "master",
  filename: "test_file.zip",
  file_size: 52428800,  // 50MB
  total_chunks: 10,
  uploaded_parts: [1, 2, 3, 4, 5],  // 已上传 5 片
  timestamp: Date.now()
};

localStorage.setItem('direct_upload_test-task-123_master', JSON.stringify(testData));

console.log('✅ 测试数据已创建');

// 刷新页面，应该看到提示
location.reload();
```

### 清除测试数据

```javascript
// 清除所有 Direct 模式的上传记录
Object.keys(localStorage)
  .filter(key => key.startsWith('direct_upload_'))
  .forEach(key => {
    console.log('删除:', key);
    localStorage.removeItem(key);
  });

console.log('✅ 所有 Direct 上传记录已清除');
```

## 📊 预期行为总结

### 正常流程

1. **上传开始**
   - 文件 >= 10MB → 使用断点续传
   - 每上传完一个分片 → 保存进度到 localStorage

2. **上传中断**
   - 关闭页面
   - localStorage 保留进度

3. **重新打开页面**
   - 检测 localStorage
   - 显示"未完成上传"提示

4. **恢复上传**
   - 选择相同文件
   - 自动跳过已上传分片
   - 继续上传剩余分片

### 关键时间点

| 操作 | localStorage | 提示 | 控制台日志 |
|------|-------------|------|-----------|
| 刚开始上传 | 无 | 无 | `[Direct] 初始化分片上传` |
| 上传完第 1 片 | ✅ 有 | 无 | `✅ [Direct] 保存上传进度: ..., 已上传 1/X 片` |
| 关闭页面 | ✅ 保留 | - | - |
| 重新打开页面 | ✅ 检测到 | ✅ 显示 | `🔍 [调试] 发现 Direct 模式上传记录` |
| 重新上传 | ✅ 使用 | 无（开始上传后消失） | `⏭️ [Direct] 跳过已上传的分片` |

## 🎯 成功标志

当你看到以下情况，说明断点续传正常工作：

1. ✅ 控制台有 `✅ [Direct] 保存上传进度` 日志
2. ✅ localStorage 中有 `direct_upload_*` 记录
3. ✅ 重新打开页面时看到"未完成上传"提示
4. ✅ 重新上传时看到 `⏭️ [Direct] 跳过已上传的分片` 日志
5. ✅ 上传速度明显加快（跳过了已上传的部分）

## 📞 报告问题

如果测试失败，请提供：

1. **控制台完整日志**（从打开页面到上传失败）
2. **localStorage 内容**（执行上面的查询代码）
3. **文件大小**
4. **上传模式**（页面顶部显示的是 Direct 还是 TOS）
5. **后端接口响应**（Network 标签中的请求/响应）

附上这些信息，我能更快地帮你解决问题！


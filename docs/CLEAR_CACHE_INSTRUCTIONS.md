# 清除浏览器缓存并重启前端服务

## 🎯 问题

前端代码已更新，但浏览器使用的是缓存的旧代码，导致 `solver_type` 没有被提交。

---

## ✅ 解决方案

### 方法 1：完全清除缓存并重启（推荐）

#### 步骤 1：停止前端服务

```bash
# 在前端项目目录中
# 按 Ctrl+C 停止 npm run dev

# 或者使用提供的脚本
./kill-all-frontend.sh   # Linux/Mac
stop-dev.sh              # Windows
```

#### 步骤 2：清除 Next.js 缓存

```bash
# 在前端项目目录中
rm -rf .next         # Linux/Mac
rmdir /s .next       # Windows PowerShell
```

#### 步骤 3：清除浏览器缓存

**Chrome/Edge**:
1. 按 `Ctrl+Shift+Delete`
2. 选择 "Cached images and files"
3. 选择 "All time"
4. 点击 "Clear data"

**或者使用无痕模式**:
- Chrome: `Ctrl+Shift+N`
- Firefox: `Ctrl+Shift+P`

#### 步骤 4：重启前端服务

```bash
npm run dev
```

#### 步骤 5：强制刷新页面

访问 `http://localhost:3000`，按 `Ctrl+Shift+R` 强制刷新

---

### 方法 2：使用硬刷新（快速但可能不彻底）

```bash
1. 在浏览器中打开 http://localhost:3000
2. 按 Ctrl+Shift+R（Windows）或 Cmd+Shift+R（Mac）
3. 等待页面完全加载
4. 重新提交任务
```

---

### 方法 3：使用无痕模式测试

```bash
1. 按 Ctrl+Shift+N 打开无痕窗口
2. 访问 http://localhost:3000
3. 提交任务
4. 检查是否正确显示 Mechanical
```

---

## 🧪 验证是否成功

提交新任务后，在开发者工具的 Network 标签中检查：

### ✅ 正确的请求应该包含：

```json
{
  "solver_type": "mechanical",  // ⬅️ 关键！
  "job_name": "test-01",
  "thread_count": "8",
  "job_key": "wing_001"
}
```

### ✅ 任务列表 API 应该返回：

```json
{
  "solver_type": "mechanical",  // ⬅️ 不再是 "speos"
  "job_name": "test-01",
  "status": "PENDING"
}
```

---

## 🔧 如果问题仍然存在

如果清除缓存后问题仍然存在，请检查：

### 1. 确认代码已保存

```bash
git status
# 应该显示 components/UploadForm.tsx 和 lib/api.ts 已修改
```

### 2. 确认前端服务已重启

```bash
# 检查控制台输出
# 应该看到类似：
# ✓ Compiled successfully
# ○ Compiling / ...
```

### 3. 检查文件时间戳

```bash
ls -l components/UploadForm.tsx
ls -l lib/api.ts
# 确认文件修改时间是最近的
```

---

## 📞 需要进一步帮助

如果以上方法都不行，请提供：

1. 浏览器 Network 标签中的请求截图
2. 前端控制台的错误信息（如果有）
3. `git diff` 的输出（确认代码修改）


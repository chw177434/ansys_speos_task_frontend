# 修复 Node.js Deprecation Warning (DEP0060)

## 🐛 警告信息

```
(node:12996) [DEP0060] DeprecationWarning: The `util._extend` API is deprecated. 
Please use Object.assign() instead.
```

## 📋 问题分析

这个警告来自某个**依赖包**（不是你的代码），该依赖包使用了已废弃的 `util._extend` API。

---

## ✅ 解决方案

### 方案 1：抑制警告（推荐，最快）

在启动脚本中添加 `--no-deprecation` 标志：

#### 修改 `package.json`

```json
{
  "scripts": {
    "dev": "NODE_OPTIONS='--no-deprecation' next dev -H 0.0.0.0",
    "build": "next build",
    "start": "NODE_OPTIONS='--no-deprecation' next start -H 0.0.0.0"
  }
}
```

**Windows 系统使用**：

```json
{
  "scripts": {
    "dev": "set NODE_OPTIONS=--no-deprecation && next dev -H 0.0.0.0",
    "build": "next build",
    "start": "set NODE_OPTIONS=--no-deprecation && next start -H 0.0.0.0"
  }
}
```

**跨平台兼容方案（推荐）**：

先安装 `cross-env`：

```bash
npm install --save-dev cross-env
```

然后修改 `package.json`：

```json
{
  "scripts": {
    "dev": "cross-env NODE_OPTIONS='--no-deprecation' next dev -H 0.0.0.0",
    "build": "next build",
    "start": "cross-env NODE_OPTIONS='--no-deprecation' next start -H 0.0.0.0"
  }
}
```

---

### 方案 2：更新依赖包

这个警告可能来自 `baseline-browser-mapping` 或其他旧包。

```bash
# 更新所有依赖到最新版本
npm update

# 或者检查过时的包
npm outdated

# 删除 node_modules 和 package-lock.json 重新安装
rm -rf node_modules package-lock.json
npm install
```

---

### 方案 3：移除不必要的依赖

我注意到 `baseline-browser-mapping` 这个包，它可能不是必需的：

```json
// 如果不需要，可以移除
"devDependencies": {
  // "baseline-browser-mapping": "^2.8.32",  // ⬅️ 移除这一行
}
```

然后重新安装：

```bash
npm uninstall baseline-browser-mapping
npm install
```

---

### 方案 4：找出具体是哪个包导致的

```bash
# 使用 --trace-deprecation 标志查看详细堆栈
node --trace-deprecation node_modules/.bin/next dev -H 0.0.0.0
```

这会显示警告的完整堆栈跟踪，帮助你找到具体是哪个包。

---

## 🎯 推荐方案（立即生效）

**最快的解决方案是方案 1，但跨平台兼容**：

### 步骤 1：安装 cross-env

```bash
npm install --save-dev cross-env
```

### 步骤 2：修改 package.json

将你的 `scripts` 部分改为：

```json
{
  "scripts": {
    "dev": "cross-env NODE_OPTIONS='--no-deprecation' next dev -H 0.0.0.0",
    "build": "next build",
    "start": "cross-env NODE_OPTIONS='--no-deprecation' next start -H 0.0.0.0"
  }
}
```

### 步骤 3：重启服务

```bash
# 停止当前服务（Ctrl+C）
# 重新启动
npm run dev
```

---

## 📝 说明

- ⚠️ 这个警告**不影响功能**，只是一个提醒
- 🔧 警告来自依赖包，不是你的代码
- ✅ 使用 `--no-deprecation` 只是隐藏警告，不影响程序运行
- 🔄 等待依赖包作者更新才能彻底解决

---

## 🧪 验证

修改后重启服务，警告应该消失：

```bash
npm run dev

# 应该看到干净的输出：
# ▲ Next.js 15.0.3
# - Local:        http://0.0.0.0:3000
# ✓ Ready in 2.3s
```

没有 deprecation warning 了！✅


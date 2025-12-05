# 后端服务器地址配置

## 📋 问题说明

前端通过 `/api/*` 路径访问后端接口，Next.js 会将这些请求代理到后端服务器。

**默认配置**：`http://localhost:8000`

这意味着前端和后端必须在**同一台机器**上。

---

## 🔧 如果前后端不在同一台机器

### 场景1：前端和后端在不同机器

**示例**：
- 前端服务器：`10.100.100.12`（端口3000）
- 后端服务器：`10.100.100.13`（端口8000）

### 场景2：端口不是8000

**示例**：
- 后端服务器在本机，但端口是 `5000`

---

## ✅ 解决方法

### 方法1：设置环境变量（推荐）⭐

在**启动前端服务之前**，设置环境变量：

```bash
# 设置后端地址
export BACKEND_URL=http://后端IP:端口

# 例如：
export BACKEND_URL=http://10.100.100.13:8000

# 然后启动前端
./start-dev-background.sh
```

### 方法2：在启动脚本中直接设置

修改 `start-dev-background.sh`：

```bash
# 在脚本开头添加
export BACKEND_URL=http://10.100.100.13:8000

# 然后启动
./start-dev-background.sh
```

### 方法3：创建 .env 文件

在项目根目录创建 `.env.local` 文件：

```bash
# .env.local
BACKEND_URL=http://10.100.100.13:8000
```

**注意**：使用这个方法需要重启 Next.js 服务。

---

## 🎯 完整配置步骤

### 假设配置场景

- **前端**：运行在 `10.100.100.12`（Ubuntu服务器）
- **后端**：运行在 `10.100.100.13:8000`

### 步骤1：设置环境变量

```bash
cd ~/code/ansys_speos_task_frontend

# 设置后端地址
export BACKEND_URL=http://10.100.100.13:8000

# 或者添加到 ~/.bashrc 使其永久生效
echo 'export BACKEND_URL=http://10.100.100.13:8000' >> ~/.bashrc
source ~/.bashrc
```

### 步骤2：重启前端服务

```bash
# 停止
./stop-dev.sh

# 启动（会自动使用 BACKEND_URL）
./start-dev-background.sh

# 查看日志，确认后端地址
tail -20 nextjs-dev.log
```

### 步骤3：验证

```bash
# 测试配置接口
curl http://localhost:3000/api/v2/upload/config

# 应该返回后端的配置（不是404）
# {"upload_mode":"direct","max_file_size_mb":5120}
```

---

## 🔍 如何确定后端地址

### 方法1：询问后端开发

询问后端服务器的：
- IP地址或域名
- 端口号（通常是8000）

### 方法2：检查后端日志

在后端服务器上查看启动日志：

```bash
# 查找后端进程
ps aux | grep python

# 查看监听端口
netstat -tlnp | grep python
```

通常会看到类似：
```
tcp  0  0  0.0.0.0:8000  0.0.0.0:*  LISTEN  12345/python
```

说明后端监听 `8000` 端口。

### 方法3：测试后端接口

```bash
# 直接访问后端
curl http://后端IP:8000/v2/upload/config

# 如果返回数据，说明地址正确
```

---

## 📊 配置对照表

| 场景 | BACKEND_URL 设置 | 说明 |
|-----|-----------------|------|
| 同一台机器，端口8000 | `http://localhost:8000` | 默认配置 |
| 同一台机器，端口5000 | `http://localhost:5000` | 自定义端口 |
| 不同机器 | `http://10.100.100.13:8000` | 指定后端IP |
| 使用域名 | `http://backend.example.com:8000` | 域名访问 |

---

## 🐛 故障排查

### 问题1：接口仍然404

**检查**：
```bash
# 1. 确认环境变量
echo $BACKEND_URL

# 2. 查看启动日志
tail -50 nextjs-dev.log | grep "后端服务器"

# 3. 测试后端直连
curl http://后端IP:8000/v2/upload/config
```

**解决**：
- 确保 `BACKEND_URL` 已设置
- 确保前端服务已重启
- 确保后端服务正在运行
- 检查网络连通性

### 问题2：CORS 错误

如果浏览器报 CORS 错误，说明：
- Next.js 代理没有生效
- 或前端直接访问了后端（绕过代理）

**解决**：
- 确保使用 `/api/*` 路径访问后端
- 不要直接访问 `http://后端IP:8000/*`

### 问题3：连接超时

**原因**：
- 后端不可达
- 网络问题
- 防火墙阻止

**解决**：
```bash
# 测试网络连通性
ping 后端IP

# 测试端口
telnet 后端IP 8000

# 或使用 nc
nc -zv 后端IP 8000
```

---

## 💡 最佳实践

### 1. 使用环境变量

将后端地址配置为环境变量，便于管理和切换：

```bash
# 开发环境
export BACKEND_URL=http://localhost:8000

# 测试环境
export BACKEND_URL=http://test-backend:8000

# 生产环境
export BACKEND_URL=http://prod-backend:8000
```

### 2. 添加到启动脚本

在 `~/.bashrc` 或 `~/.bash_profile` 中添加：

```bash
# 前端配置
export BACKEND_URL=http://10.100.100.13:8000
```

### 3. 文档化配置

在团队文档中记录：
- 各环境的后端地址
- 端口号
- 访问权限

---

## 🎯 快速配置命令

### 一键配置（适合大多数情况）

```bash
# 如果前后端在同一台机器
cd ~/code/ansys_speos_task_frontend
export BACKEND_URL=http://localhost:8000
./stop-dev.sh && ./start-dev-background.sh

# 如果前后端不在同一台机器
cd ~/code/ansys_speos_task_frontend
export BACKEND_URL=http://后端IP:8000  # 替换为实际后端IP
./stop-dev.sh && ./start-dev-background.sh

# 验证
curl http://localhost:3000/api/v2/upload/config
```

---

## 📞 获取帮助

如果配置后仍然404，请提供：

1. **前端服务器IP**：`hostname -I`
2. **后端服务器IP和端口**：询问后端开发
3. **BACKEND_URL 设置**：`echo $BACKEND_URL`
4. **错误信息**：浏览器控制台截图
5. **前端日志**：`tail -50 nextjs-dev.log`

---

**最后更新**：2025-11-12  
**适用版本**：v1.0+


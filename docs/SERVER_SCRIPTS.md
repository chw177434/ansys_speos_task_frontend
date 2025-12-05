# Ubuntu/Linux 服务器脚本使用指南

本文档介绍如何在Ubuntu/Linux服务器上管理Next.js开发服务器。

## 📦 可用脚本

### 1. `start-dev.sh` - 前台启动（交互式）
在前台启动开发服务器，适合调试和查看实时输出。

```bash
./start-dev.sh
```

**特点：**
- ✅ 实时查看服务器输出
- ✅ 按 `Ctrl+C` 停止服务器
- ❌ 关闭终端会停止服务器

---

### 2. `start-dev-background.sh` - 后台启动（推荐）⭐
在后台启动开发服务器，释放终端供其他使用。

```bash
./start-dev-background.sh
```

**特点：**
- ✅ 后台运行，不占用终端
- ✅ 关闭终端不影响服务器
- ✅ 自动记录日志到 `nextjs-dev.log`
- ✅ 保存进程ID到 `nextjs-dev.pid`

---

### 3. `view-logs.sh` - 查看日志
查看服务器运行日志。

```bash
# 查看所有日志
./view-logs.sh

# 实时跟踪日志（类似 tail -f）
./view-logs.sh -f

# 查看最后50行
./view-logs.sh -n 50
```

**特点：**
- ✅ 多种查看模式
- ✅ 显示服务器状态
- ✅ 彩色输出

---

### 4. `stop-dev.sh` - 停止服务器
停止后台运行的服务器。

```bash
./stop-dev.sh
```

**特点：**
- ✅ 优雅停止服务器
- ✅ 必要时强制停止
- ✅ 清理PID文件

---

### 5. `server-status.sh` - 检查状态
检查服务器运行状态。

```bash
./server-status.sh
```

**特点：**
- ✅ 显示进程状态
- ✅ 显示端口监听情况
- ✅ 显示最近日志
- ✅ 显示服务器URL

---

## 🚀 快速开始

### 首次使用

```bash
# 1. 添加执行权限（只需执行一次）
chmod +x *.sh

# 2. 后台启动服务器
./start-dev-background.sh

# 3. 检查状态
./server-status.sh

# 4. 访问应用
# http://服务器IP:3000
```

---

## 📖 常用操作

### 启动服务器（后台）

```bash
./start-dev-background.sh
```

### 查看实时日志

```bash
./view-logs.sh -f
# 按 Ctrl+C 退出日志查看（不会停止服务器）
```

### 检查服务器状态

```bash
./server-status.sh
```

### 停止服务器

```bash
./stop-dev.sh
```

### 重启服务器

```bash
./stop-dev.sh && ./start-dev-background.sh
```

---

## 📝 日志管理

### 日志文件位置

- **当前日志**: `nextjs-dev.log`
- **旧日志**: `nextjs-dev.log.old`（每次启动时自动备份）

### 查看日志的方法

```bash
# 方法1: 使用脚本（推荐）
./view-logs.sh -f

# 方法2: 直接使用 tail
tail -f nextjs-dev.log

# 方法3: 使用 less
less nextjs-dev.log

# 方法4: 查看最后100行
tail -n 100 nextjs-dev.log

# 方法5: 搜索错误
grep -i error nextjs-dev.log
grep -i warning nextjs-dev.log
```

### 清理日志

```bash
# 清空日志文件
> nextjs-dev.log

# 或删除日志文件
rm nextjs-dev.log nextjs-dev.log.old
```

---

## 🔧 高级用法

### 使用 screen（推荐用于长期运行）

```bash
# 安装 screen（如果没有）
sudo apt-get install screen

# 创建新的 screen 会话
screen -S nextjs

# 在 screen 中启动服务器（前台模式）
./start-dev.sh

# 离开 screen（服务器继续运行）
# 按 Ctrl+A，然后按 D

# 重新连接到 screen
screen -r nextjs

# 列出所有 screen 会话
screen -ls

# 关闭 screen 会话
screen -X -S nextjs quit
```

### 使用 tmux

```bash
# 安装 tmux（如果没有）
sudo apt-get install tmux

# 创建新的 tmux 会话
tmux new -s nextjs

# 在 tmux 中启动服务器
./start-dev.sh

# 离开 tmux（服务器继续运行）
# 按 Ctrl+B，然后按 D

# 重新连接到 tmux
tmux attach -t nextjs

# 列出所有 tmux 会话
tmux ls

# 关闭 tmux 会话
tmux kill-session -t nextjs
```

### 使用 systemd（生产环境推荐）

创建 systemd 服务文件：

```bash
sudo nano /etc/systemd/system/nextjs-dev.service
```

内容：

```ini
[Unit]
Description=Next.js Development Server
After=network.target

[Service]
Type=simple
User=hongwei
WorkingDirectory=/home/hongwei/code/ansys_speos_task_frontend
ExecStart=/usr/bin/npm run dev -- -H 0.0.0.0
Restart=always
RestartSec=10
Environment=NODE_ENV=development

[Install]
WantedBy=multi-user.target
```

管理服务：

```bash
# 重载 systemd 配置
sudo systemctl daemon-reload

# 启动服务
sudo systemctl start nextjs-dev

# 停止服务
sudo systemctl stop nextjs-dev

# 重启服务
sudo systemctl restart nextjs-dev

# 查看状态
sudo systemctl status nextjs-dev

# 查看日志
sudo journalctl -u nextjs-dev -f

# 开机自启
sudo systemctl enable nextjs-dev
```

---

## 🐛 故障排查

### 问题1: 脚本无法执行

```bash
# 确保脚本有执行权限
chmod +x *.sh

# 检查文件格式（应该是 Unix 格式，不是 DOS 格式）
dos2unix *.sh  # 如果需要
```

### 问题2: 端口已被占用

```bash
# 查找占用 3000 端口的进程
sudo lsof -i :3000
# 或
sudo netstat -tlnp | grep 3000

# 杀死进程
kill -9 <PID>
```

### 问题3: 服务器无法从外部访问

```bash
# 检查防火墙
sudo ufw status

# 开放 3000 端口
sudo ufw allow 3000/tcp

# 检查服务器是否监听所有接口
netstat -tlnp | grep 3000
# 应该看到 0.0.0.0:3000 而不是 127.0.0.1:3000
```

### 问题4: 日志文件过大

```bash
# 检查日志大小
du -h nextjs-dev.log

# 清理日志
> nextjs-dev.log

# 或使用 logrotate 自动管理日志
```

---

## 📊 监控和维护

### 实时监控资源使用

```bash
# 查看 Node.js 进程资源使用
top -p $(cat nextjs-dev.pid)

# 或使用 htop（更友好）
htop -p $(cat nextjs-dev.pid)

# 查看内存使用
ps -p $(cat nextjs-dev.pid) -o pid,ppid,cmd,%mem,%cpu
```

### 定期检查

```bash
# 创建定时检查脚本
cat > check-server.sh << 'EOF'
#!/bin/bash
if [ -f "nextjs-dev.pid" ]; then
    PID=$(cat nextjs-dev.pid)
    if ! ps -p $PID > /dev/null; then
        echo "Server crashed! Restarting..."
        ./start-dev-background.sh
    fi
fi
EOF

chmod +x check-server.sh

# 添加到 crontab（每5分钟检查一次）
crontab -e
# 添加：*/5 * * * * cd /home/hongwei/code/ansys_speos_task_frontend && ./check-server.sh
```

---

## 🔒 安全建议

1. **不要在生产环境使用开发服务器**
   - 开发服务器（`npm run dev`）仅用于开发
   - 生产环境使用 `npm run build && npm run start`

2. **配置防火墙**
   ```bash
   sudo ufw enable
   sudo ufw allow 22/tcp    # SSH
   sudo ufw allow 3000/tcp  # Next.js
   ```

3. **使用环境变量**
   - 敏感信息存储在 `.env.local`
   - 不要提交 `.env.local` 到 Git

4. **定期更新依赖**
   ```bash
   npm audit
   npm audit fix
   ```

---

## 📚 参考资料

- [Next.js 文档](https://nextjs.org/docs)
- [Node.js 文档](https://nodejs.org/docs)
- [systemd 文档](https://systemd.io/)
- [项目 README](./README.md)

---

## 💡 提示

- 后台运行时，使用 `./view-logs.sh -f` 实时查看日志
- 定期检查 `./server-status.sh` 确保服务正常
- 日志文件会自动备份，不用担心覆盖
- 使用 screen 或 tmux 可以更方便地管理多个会话

---

**最后更新**: 2025-11-11  
**维护**: 前端开发团队


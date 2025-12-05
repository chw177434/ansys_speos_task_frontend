# 脚本使用说明

> **位置**: `scripts/` 目录  
> **说明**: 所有脚本已整理到此目录，可以从任何位置执行

---

## 🚀 快速开始

### Windows

```bash
# 启动开发服务器
scripts\start-dev.bat

# 或使用 PowerShell
scripts\start-dev.ps1
```

### Linux/Mac

```bash
# 启动开发服务器
./scripts/start-dev.sh

# 后台启动
./scripts/start-dev-background.sh
```

---

## 📜 脚本列表

### 启动相关

| 脚本 | 说明 | 平台 |
|------|------|------|
| `start-dev.sh` | 启动开发服务器（前台） | Linux/Mac |
| `start-dev.bat` | 启动开发服务器（Windows 批处理） | Windows |
| `start-dev.ps1` | 启动开发服务器（PowerShell） | Windows |
| `start-dev-background.sh` | 后台启动开发服务器 | Linux/Mac |
| `start-dev-simple.bat` | 简化版启动脚本 | Windows |
| `start-dev-temp.bat` | 临时启动脚本（抑制警告） | Windows |

### 管理相关

| 脚本 | 说明 | 平台 |
|------|------|------|
| `stop-dev.sh` | 停止开发服务器 | Linux/Mac |
| `kill-all-frontend.sh` | 强制停止所有前端进程 | Linux/Mac |
| `server-status.sh` | 检查服务器状态 | Linux/Mac |
| `view-logs.sh` | 查看服务器日志 | Linux/Mac |
| `cleanup-and-restart.sh` | 清理并重启服务器 | Linux/Mac |

### 诊断相关

| 脚本 | 说明 | 平台 |
|------|------|------|
| `check-frontend.sh` | 前端服务诊断 | Linux/Mac |
| `diagnose-proxy.sh` | 诊断前后端连接 | Linux/Mac |
| `verify-frontend-update.sh` | 验证前端代码更新 | Linux/Mac |
| `test-node.ps1` | 测试 Node.js 环境 | Windows |

---

## 💡 使用技巧

### 从任何位置执行

所有脚本都支持从任何位置执行，脚本会自动切换到项目根目录：

```bash
# 从项目根目录
./scripts/start-dev.sh

# 从 scripts 目录
cd scripts
./start-dev.sh  # 自动切换到项目根目录

# 从其他目录
/path/to/project/scripts/start-dev.sh  # 自动切换到项目根目录
```

### 查看日志

```bash
# 查看所有日志
./scripts/view-logs.sh

# 实时跟踪日志
./scripts/view-logs.sh -f

# 查看最后 100 行
./scripts/view-logs.sh -n 100
```

### 检查状态

```bash
# 检查服务器状态
./scripts/server-status.sh

# 诊断问题
./scripts/check-frontend.sh
./scripts/diagnose-proxy.sh
```

---

## 🔧 脚本工作原理

所有脚本都包含自动路径切换逻辑：

### Bash 脚本

```bash
# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# 切换到项目根目录
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT" || exit 1
```

### PowerShell 脚本

```powershell
# 获取脚本所在目录
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
# 切换到项目根目录
$ProjectRoot = Split-Path -Parent $ScriptDir
Set-Location $ProjectRoot
```

### 批处理脚本

```batch
REM 获取脚本所在目录
set SCRIPT_DIR=%~dp0
REM 切换到项目根目录
cd /d "%SCRIPT_DIR%.."
```

---

## ⚠️ 注意事项

1. **执行权限**: Linux/Mac 脚本需要执行权限
   ```bash
   chmod +x scripts/*.sh
   ```

2. **路径引用**: 脚本中的相对路径（如 `node_modules`, `package.json`）现在相对于项目根目录

3. **脚本间调用**: 脚本中调用其他脚本时，使用 `$SCRIPT_DIR` 变量确保路径正确

---

## 📝 示例

### 启动开发服务器

```bash
# Linux/Mac
./scripts/start-dev.sh

# Windows
scripts\start-dev.bat
```

### 后台启动并查看日志

```bash
# 启动
./scripts/start-dev-background.sh

# 查看日志
./scripts/view-logs.sh -f
```

### 完全清理并重启

```bash
./scripts/cleanup-and-restart.sh
```

---

**最后更新**: 2024-12-05


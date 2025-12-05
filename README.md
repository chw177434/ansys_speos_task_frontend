# ANSYS SPEOS Task Frontend

前端应用，用于提交和管理 ANSYS 求解器任务（SPEOS、FLUENT、Maxwell、Mechanical）。

---

## 📁 目录结构

```
ansys_speos_task_frontend/
├── app/                    # Next.js App Router 页面
│   ├── page.tsx            # 主页
│   ├── layout.tsx          # 布局组件
│   └── tools/              # 工具页面
├── components/              # React 组件
│   ├── UploadForm.tsx      # 任务提交表单
│   ├── TasksTable.tsx      # 任务列表表格
│   ├── ToolSelection.tsx   # 工具选择组件
│   └── ToolUsageTracker.tsx # 工具使用追踪
├── lib/                     # 工具库和 API
│   ├── api.ts              # API 接口定义
│   ├── tools.ts            # 工具定义
│   ├── resumableUpload.ts  # TOS 断点续传
│   └── directResumableUpload.ts # Direct 断点续传
├── scripts/                 # 脚本文件（新增）
│   ├── start-dev.sh        # 启动开发服务器（Linux/Mac）
│   ├── start-dev.bat       # 启动开发服务器（Windows）
│   ├── start-dev.ps1       # 启动开发服务器（PowerShell）
│   ├── start-dev-background.sh # 后台启动
│   ├── stop-dev.sh         # 停止服务器
│   ├── view-logs.sh        # 查看日志
│   └── ...                 # 其他脚本
├── docs/                    # 文档目录
│   ├── features/           # 功能文档
│   ├── bug-fixes/          # Bug 修复记录
│   ├── resumable-upload/   # 断点续传文档
│   └── deployment/         # 部署文档
├── public/                  # 静态资源
├── package.json            # 项目配置
├── next.config.js          # Next.js 配置
└── tsconfig.json           # TypeScript 配置
```

---

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

#### Windows

```bash
# 方式 1: 使用批处理脚本（推荐）
scripts\start-dev.bat

# 方式 2: 使用 PowerShell 脚本
scripts\start-dev.ps1

# 方式 3: 直接使用 npm
npm run dev
```

#### Linux/Mac

```bash
# 方式 1: 使用 shell 脚本（推荐）
./scripts/start-dev.sh

# 方式 2: 后台启动
./scripts/start-dev-background.sh

# 方式 3: 直接使用 npm
npm run dev
```

### 访问应用

- **本地访问**: http://localhost:3000
- **网络访问**: http://<your-ip>:3000

---

## 📜 脚本说明

所有脚本文件已整理到 `scripts/` 目录中。脚本会自动切换到项目根目录执行，因此可以从任何位置运行。

### 常用脚本

| 脚本 | 说明 | 平台 |
|------|------|------|
| `start-dev.sh` / `start-dev.bat` | 启动开发服务器 | 所有平台 |
| `start-dev-background.sh` | 后台启动服务器 | Linux/Mac |
| `stop-dev.sh` | 停止服务器 | Linux/Mac |
| `view-logs.sh` | 查看服务器日志 | Linux/Mac |
| `server-status.sh` | 检查服务器状态 | Linux/Mac |
| `check-frontend.sh` | 前端服务诊断 | Linux/Mac |
| `kill-all-frontend.sh` | 强制停止所有前端进程 | Linux/Mac |
| `cleanup-and-restart.sh` | 清理并重启 | Linux/Mac |

### 使用示例

```bash
# 从项目根目录运行
./scripts/start-dev.sh

# 或从任何位置运行（脚本会自动切换到项目根目录）
/path/to/project/scripts/start-dev.sh
```

---

## 📚 文档

所有文档已整理到 `docs/` 目录：

- **功能文档**: `docs/features/` - 各求解器的适配指南
- **Bug 修复**: `docs/bug-fixes/` - Bug 修复记录
- **断点续传**: `docs/resumable-upload/` - 断点续传相关文档
- **部署文档**: `docs/deployment/` - 部署相关文档

### 主要文档

- [FLUENT 前端适配指南](docs/features/FLUENT_FRONTEND_GUIDE.md)
- [Mechanical 前端适配指南](docs/features/FRONTEND_MECHANICAL_GUIDE.md)
- [API 接口文档](docs/features/API_REFERENCE_V2.md)
- [前端集成指南](docs/features/FRONTEND_INTEGRATION_GUIDE_V2.md)

---

## 🔧 支持的求解器

| 求解器 | 类型 | 文件格式 | 状态 |
|--------|------|---------|------|
| **SPEOS** | 光学仿真 | `.speos`, `.sv5` | ✅ 完全支持 |
| **FLUENT** | 流体力学 | `.cas`, `.cas.h5` | ✅ 完全支持 |
| **Maxwell** | 电磁场 | `.aedt` | ✅ 完全支持 |
| **Mechanical** | 结构力学 | `.dat`, `.inp` | ✅ 完全支持 |

---

## 🛠️ 开发

### 技术栈

- **框架**: Next.js 15.0.3
- **UI 库**: React 18.2.0
- **样式**: Tailwind CSS
- **语言**: TypeScript

### 环境变量

创建 `.env.local` 文件（可选）：

```env
# 后端 API 地址（默认: http://localhost:8000）
NEXT_PUBLIC_API_BASE=http://localhost:8000
```

### 构建生产版本

```bash
npm run build
npm start
```

---

## 📝 更新日志

### 2024-12-05

- ✅ 完成 FLUENT 求解器前端适配
- ✅ 修复 solver_type 传递问题
- ✅ 整理目录结构（脚本移至 `scripts/`，文档移至 `docs/`）
- ✅ 修复 Node.js deprecation warning

---

## 🤝 贡献

请参考各功能文档了解详细的实现说明。

---

## 📄 许可证

[根据项目实际情况填写]


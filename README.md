# Ansys SPEOS Task Frontend

Ansys SPEOS任务管理系统的前端应用，基于Next.js 15和React 18构建。

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

然后在浏览器中访问 [http://localhost:3000](http://localhost:3000)

### 构建生产版本

```bash
npm run build
npm run start
```

---

## 📁 项目结构

```
ansys_speos_task_frontend/
├── app/                    # Next.js 15 App Router
│   ├── layout.tsx         # 根布局
│   ├── page.tsx           # 首页
│   └── tasks/             # 任务相关页面
├── components/            # React组件
│   ├── UploadForm.tsx    # 任务上传表单
│   ├── TasksTable.tsx    # 任务列表
│   └── ...
├── lib/                   # 工具库
│   ├── api.ts            # API接口
│   ├── resumableUpload.ts # 断点续传
│   └── tools.ts          # 工具函数
├── hooks/                 # React Hooks
├── types/                 # TypeScript类型定义
├── docs/                  # 📚 文档目录
└── public/                # 静态资源
```

---

## 🎯 主要功能

### ✅ 任务管理
- 创建SPEOS仿真任务
- 查看任务列表和状态
- 下载任务结果
- 删除任务

### 📤 文件上传
- **Master文件上传**（必需）
- **Include文件上传**（可选，**必须为压缩包格式**）
  - 支持格式：.zip, .rar, .7z, .tar, .gz, .tar.gz
  - 前端验证 + 后端双重验证

### ⏸️ 断点续传
- 大文件分片上传
- 支持暂停/恢复
- 自动断点续传
- 进度持久化

### 🎨 用户界面
- 现代化UI设计
- 实时任务状态更新
- 响应式布局
- 友好的错误提示

---

## 🛠️ 技术栈

- **框架**: [Next.js 15](https://nextjs.org/)
- **UI库**: [React 18](https://react.dev/)
- **样式**: [Tailwind CSS 3](https://tailwindcss.com/)
- **语言**: [TypeScript 5](https://www.typescriptlang.org/)
- **状态管理**: React Hooks
- **HTTP客户端**: Fetch API

---

## 📚 文档

详细文档请查看 [`docs/`](./docs/) 目录：

- **[文档索引](./docs/README.md)** - 所有文档的入口
- **[Include压缩包上传](./docs/include-archive/)** - Include文件上传指南
- **[断点续传功能](./docs/resumable-upload/)** - 断点续传使用说明
- **[Phase1升级](./docs/phase1/)** - 第一阶段升级文档
- **[Bug修复](./docs/bug-fixes/)** - 问题修复记录
- **[部署指南](./docs/deployment/)** - 部署和启动说明

---

## 🔧 配置

### 环境变量

创建 `.env.local` 文件配置后端API地址：

```bash
# 后端API地址（可选，默认使用 /api 代理）
NEXT_PUBLIC_API_BASE=http://localhost:8000
```

### Next.js配置

API代理配置在 `next.config.js` 中：

```javascript
{
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.BACKEND_URL || 'http://localhost:8000/:path*',
      },
    ];
  },
}
```

---

## 🧪 开发说明

### 代码风格

- 使用TypeScript严格模式
- 遵循ESLint规则
- 使用Prettier格式化代码

### 组件开发

- 优先使用函数组件和Hooks
- 使用TypeScript类型注解
- 组件应该是可复用的

### API调用

使用 `lib/api.ts` 中封装的API函数：

```typescript
import { createTask, getTaskStatus } from '@/lib/api';

// 创建任务
const result = await createTask(formData);

// 获取任务状态
const status = await getTaskStatus(taskId);
```

---

## 🐛 问题排查

### 常见问题

**问题1：无法启动开发服务器**
```bash
# 清理缓存并重新安装依赖
rm -rf node_modules package-lock.json
npm install
```

**问题2：上传文件失败**
- 检查文件格式（Include文件必须是压缩包）
- 检查网络连接
- 查看浏览器控制台错误信息

**问题3：断点续传不工作**
- 清除localStorage中的上传进度
- 确保后端支持断点续传API

更多问题请查看 [docs/bug-fixes/](./docs/bug-fixes/)

---

## 📦 依赖管理

### 主要依赖

```json
{
  "next": "15.0.3",
  "react": "18.2.0",
  "react-dom": "18.2.0"
}
```

### 开发依赖

```json
{
  "typescript": "^5.4.0",
  "tailwindcss": "^3.4.17",
  "@types/react": "19.1.13"
}
```

---

## 🚢 部署

### 开发环境

```bash
npm run dev
```

### 生产环境

```bash
# 构建
npm run build

# 启动
npm run start
```

### Docker部署

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start"]
```

---

## 🤝 贡献

欢迎提交Issue和Pull Request！

### 提交规范

- feat: 新功能
- fix: Bug修复
- docs: 文档更新
- style: 代码格式
- refactor: 重构
- test: 测试相关
- chore: 构建/工具相关

---

## 📄 许可证

[MIT License](LICENSE)

---

## 📞 联系方式

- **项目仓库**: [GitHub](https://github.com/your-repo)
- **问题反馈**: [Issues](https://github.com/your-repo/issues)
- **文档**: [docs/](./docs/)

---

**最后更新**: 2025-11-07  
**版本**: 1.0.0  
**维护团队**: 前端开发团队


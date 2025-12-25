# 多阶段构建 Dockerfile for Next.js

# 阶段1: 依赖安装和构建
FROM node:20-alpine AS builder

# 设置工作目录
WORKDIR /app

# 构建参数：后端地址（可在构建时传入）
ARG BACKEND_URL=http://host.docker.internal:8000

# 设置环境变量（用于构建时）
ENV BACKEND_URL=${BACKEND_URL}

# 复制 package 文件
COPY package.json package-lock.json ./

# 安装依赖
RUN npm ci

# 复制源代码
COPY . .

# 构建 Next.js 应用
RUN npm run build

# 阶段2: 生产运行环境
FROM node:20-alpine AS runner

WORKDIR /app

# 设置环境变量
ENV NODE_ENV=production
ENV NODE_OPTIONS='--no-deprecation'
ENV NEXT_TELEMETRY_DISABLED=1

# 创建非root用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 复制必要的文件
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# 设置正确的权限
RUN chown -R nextjs:nodejs /app

# 切换到非root用户
USER nextjs

# 暴露端口
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 启动应用
CMD ["node", "server.js"]


# Docker 部署指南

本文档说明如何使用 Docker 构建和运行 ANSYS SPEOS Task Frontend 应用。

## 📋 前置要求

- Docker 已安装（版本 20.10 或更高）
- Docker Compose 已安装（版本 2.0 或更高，可选）

## ⚡ 快速运行命令

### 前置步骤：创建网络（首次部署）

前后端需要共享 `ansys-speos-task` 网络，首次部署前需要创建：

```bash
# Windows
scripts\create-network.bat

# Linux/Mac
chmod +x scripts/create-network.sh
./scripts/create-network.sh

# 或手动创建
docker network create ansys-speos-task
```

**注意**：后端也需要配置为使用相同的网络。详见 [网络配置指南](DOCKER_NETWORK_SETUP.md)

### 方式一：使用 Docker Compose（推荐）

```bash
# 构建并启动
docker-compose up -d --build

# 查看日志
docker-compose logs -f

# 停止
docker-compose down
```

### 方式二：使用 Docker 命令

```bash
# 构建镜像
docker build -t ansys-speos-frontend:latest .

# 运行容器
docker run -d --name ansys-speos-frontend -p 3000:3000 -e BACKEND_URL=http://host.docker.internal:8000 ansys-speos-frontend:latest

# 查看日志
docker logs -f ansys-speos-frontend

# 停止容器
docker stop ansys-speos-frontend
docker rm ansys-speos-frontend
```

**访问地址**: http://localhost:3000

## 🚀 快速开始

### 方式一：使用 Docker Compose（推荐）

#### 1. 构建并启动容器

```bash
docker-compose up -d --build
```

#### 2. 查看日志

```bash
docker-compose logs -f
```

#### 3. 停止容器

```bash
docker-compose down
```

### 方式二：使用 Docker 命令

#### 1. 构建镜像

```bash
docker build -t ansys-speos-frontend:latest .
```

#### 2. 运行容器

```bash
docker run -d \
  --name ansys-speos-frontend \
  -p 3000:3000 \
  -e BACKEND_URL=http://host.docker.internal:8000 \
  ansys-speos-frontend:latest
```

#### 3. 查看日志

```bash
docker logs -f ansys-speos-frontend
```

#### 4. 停止容器

```bash
docker stop ansys-speos-frontend
docker rm ansys-speos-frontend
```

## ⚙️ 配置说明

### 环境变量

| 变量名 | 说明 | 默认值 | 示例 |
|--------|------|--------|------|
| `BACKEND_URL` | 后端 API 地址 | `http://localhost:8000` | `http://192.168.1.100:8000` |
| `NODE_ENV` | 运行环境 | `production` | `production` |
| `PORT` | 应用端口 | `3000` | `3000` |

### 后端地址配置

根据后端部署方式，需要调整 `BACKEND_URL`：

#### 后端在宿主机上运行

```bash
# Linux/Mac
-e BACKEND_URL=http://host.docker.internal:8000

# Windows
-e BACKEND_URL=http://host.docker.internal:8000
```

#### 后端在 Docker 网络中运行（推荐）

前后端在同一 Docker 网络中，使用后端服务名：

```yaml
# docker-compose.yml
build:
  args:
    BACKEND_URL: http://backend:8000  # 使用后端服务名
networks:
  - ansys-speos-task

networks:
  ansys-speos-task:
    name: ansys-speos-task
    external: true
```

**注意**：
- `backend` 是后端在 `docker-compose.yml` 中的服务名，需要与后端配置一致
- 如果后端服务名不同，请修改为实际的服务名
- 详见 [网络配置指南](DOCKER_NETWORK_SETUP.md)

#### 后端在其他服务器上

```bash
-e BACKEND_URL=http://192.168.1.100:8000
```

## 📝 常用命令

### 查看运行状态

```bash
# Docker Compose
docker-compose ps

# Docker
docker ps | grep ansys-speos-frontend
```

### 进入容器

```bash
# Docker Compose
docker-compose exec frontend sh

# Docker
docker exec -it ansys-speos-frontend sh
```

### 重启容器

```bash
# Docker Compose
docker-compose restart

# Docker
docker restart ansys-speos-frontend
```

### 查看资源使用

```bash
docker stats ansys-speos-frontend
```

### 清理

```bash
# 停止并删除容器
docker-compose down

# 删除镜像
docker rmi ansys-speos-frontend:latest

# 清理未使用的资源
docker system prune -a
```

## 🔧 高级配置

### 自定义端口

修改 `docker-compose.yml` 中的端口映射：

```yaml
ports:
  - "8080:3000"  # 将容器内的 3000 端口映射到宿主机的 8080 端口
```

### 使用自定义网络

```yaml
networks:
  custom-network:
    external: true
```

### 挂载配置文件

如果需要挂载自定义配置：

```yaml
volumes:
  - ./custom-config:/app/config
```

## 🐛 故障排查

### 容器无法启动

1. 查看日志：
   ```bash
   docker logs ansys-speos-frontend
   ```

2. 检查端口是否被占用：
   ```bash
   # Windows
   netstat -ano | findstr :3000
   
   # Linux/Mac
   lsof -i :3000
   ```

### 无法连接到后端

1. 检查 `BACKEND_URL` 环境变量是否正确
2. 确认后端服务是否运行
3. 如果后端在宿主机，确保使用 `host.docker.internal`（Windows/Mac）或 `172.17.0.1`（Linux）

### 构建失败

1. 清理 Docker 缓存：
   ```bash
   docker builder prune
   ```

2. 重新构建（不使用缓存）：
   ```bash
   docker build --no-cache -t ansys-speos-frontend:latest .
   ```

## 📦 镜像信息

- **基础镜像**: `node:20-alpine`
- **工作目录**: `/app`
- **运行用户**: `nextjs` (非 root)
- **暴露端口**: `3000`
- **构建方式**: 多阶段构建（优化镜像大小）

## 🔒 安全建议

1. 容器以非 root 用户运行
2. 定期更新基础镜像
3. 使用 `.dockerignore` 排除敏感文件
4. 生产环境建议使用 Docker Secrets 管理敏感信息

## 📚 相关文档

- [Next.js Docker 部署文档](https://nextjs.org/docs/deployment#docker-image)
- [Docker 官方文档](https://docs.docker.com/)


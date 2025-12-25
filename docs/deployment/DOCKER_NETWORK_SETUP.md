# Docker 网络统一配置指南

## 概述

为了将前后端部署到同一个 Docker 网络中，需要统一使用 `ansys-speos-task` 网络。

## 网络配置

### 前端配置（已配置）

前端 `docker-compose.yml` 已配置为使用 `ansys-speos-task` 网络：

```yaml
services:
  frontend:
    networks:
      - ansys-speos-task

networks:
  ansys-speos-task:
    name: ansys-speos-task
    external: true  # 使用外部网络
```

### 后端配置

后端也需要配置为使用相同的网络。在后端的 `docker-compose.yml` 中添加：

```yaml
services:
  backend:
    # ... 其他配置
    networks:
      - ansys-speos-task

networks:
  ansys-speos-task:
    name: ansys-speos-task
    external: true
```

## 创建网络

如果网络不存在，需要先创建：

```bash
docker network create ansys-speos-task
```

## 前端后端地址配置

### 前端配置

前端通过构建参数 `BACKEND_URL` 配置后端地址，使用后端服务名：

```yaml
build:
  args:
    BACKEND_URL: http://backend:8000  # 使用后端服务名
```

**注意**：`backend` 是后端在 `docker-compose.yml` 中的服务名，需要与后端配置一致。

### 后端服务名确认

查看后端 `docker-compose.yml` 中的服务名：

```yaml
services:
  backend:  # 这就是服务名
    # ...
```

如果后端服务名不是 `backend`，需要修改前端的 `BACKEND_URL`：

```yaml
# 例如后端服务名是 speos-backend
BACKEND_URL: http://speos-backend:8000
```

## 部署步骤

### 1. 创建网络（如果不存在）

```bash
docker network create ansys-speos-task
```

### 2. 配置后端

确保后端的 `docker-compose.yml` 使用 `ansys-speos-task` 网络：

```yaml
networks:
  ansys-speos-task:
    name: ansys-speos-task
    external: true
```

### 3. 配置前端

前端的 `docker-compose.yml` 已配置完成，只需确认 `BACKEND_URL` 中的服务名与后端一致。

### 4. 启动服务

**启动顺序**：
1. 先启动后端（创建网络）
2. 再启动前端

```bash
# 启动后端
cd /path/to/backend
docker-compose up -d

# 启动前端
cd /path/to/frontend
docker-compose build --no-cache frontend
docker-compose up -d
```

### 5. 验证网络连接

```bash
# 查看网络中的容器
docker network inspect ansys-speos-task

# 从前端容器测试后端连接
docker exec ansys-speos-task-frontend ping backend
```

## 常见问题

### Q: 网络不存在错误

**错误**：`network ansys-speos-task not found`

**解决**：
```bash
docker network create ansys-speos-task
```

### Q: 无法解析后端服务名

**错误**：前端无法连接到后端

**检查**：
1. 确认后端服务名是否正确
2. 确认前后端在同一网络中
3. 查看网络中的容器：
   ```bash
   docker network inspect ansys-speos-task
   ```

### Q: 如何查找后端服务名？

查看后端 `docker-compose.yml`：
```yaml
services:
  backend:  # 这就是服务名
```

或查看后端容器：
```bash
docker ps | grep backend
```

## 网络架构

```
┌─────────────────────────────────────┐
│     ansys-speos-task 网络            │
│                                     │
│  ┌─────────────┐  ┌─────────────┐  │
│  │   Frontend  │  │   Backend   │  │
│  │  :3000      │  │  :8000      │  │
│  └─────────────┘  └─────────────┘  │
│                                     │
└─────────────────────────────────────┘
```

## 验证清单

- [ ] 网络 `ansys-speos-task` 已创建
- [ ] 后端配置使用 `ansys-speos-task` 网络
- [ ] 前端配置使用 `ansys-speos-task` 网络
- [ ] 前端 `BACKEND_URL` 使用正确的后端服务名
- [ ] 前后端容器都在同一网络中
- [ ] 前端可以访问后端 API


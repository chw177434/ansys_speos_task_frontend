# Docker 部署故障排查

## 问题：前端无法连接后端（500 错误）

### 问题原因

Next.js 的 `rewrites()` 配置在**构建时**执行，而不是运行时。这意味着：
- 运行时设置的环境变量 `BACKEND_URL` **不会生效**
- 必须在**构建时**通过构建参数传入 `BACKEND_URL`

### 解决方案

#### 方案1：使用构建参数（推荐）

在 `docker-compose.yml` 中通过 `build.args` 传入后端地址：

```yaml
services:
  frontend:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        BACKEND_URL: http://host.docker.internal:8000
```

#### 方案2：根据操作系统选择正确的后端地址

**Windows/Mac:**
```yaml
BACKEND_URL: http://host.docker.internal:8000
```

**Linux:**
```yaml
BACKEND_URL: http://172.17.0.1:8000
# 或者
BACKEND_URL: http://host.docker.internal:8000  # Docker 20.10+ 支持
```

**后端在 Docker 中（同一网络）:**
```yaml
BACKEND_URL: http://backend:8000
```

#### 方案3：使用宿主机的实际 IP 地址

1. 查找宿主机 IP：
   ```bash
   # Windows
   ipconfig
   
   # Linux/Mac
   ifconfig
   # 或
   hostname -I
   ```

2. 使用实际 IP：
   ```yaml
   BACKEND_URL: http://10.100.101.15:8000  # 替换为实际 IP
   ```

### 验证步骤

1. **检查构建日志**，确认 `BACKEND_URL` 被正确传入：
   ```bash
   docker-compose build --no-cache frontend
   ```

2. **检查容器内的配置**：
   ```bash
   docker exec ansys-speos-task-frontend cat .next/routes-manifest.json
   ```

3. **测试后端连接**：
   ```bash
   # 从容器内测试
   docker exec ansys-speos-task-frontend wget -O- http://host.docker.internal:8000/api/tasks
   
   # 或使用 curl
   docker exec ansys-speos-task-frontend sh -c "apk add curl && curl http://host.docker.internal:8000/api/tasks"
   ```

4. **查看前端日志**：
   ```bash
   docker logs -f ansys-speos-task-frontend
   ```

### 常见错误

#### 错误1：`host.docker.internal` 无法解析

**Windows:**
- 确保使用 Docker Desktop（不是 Docker Toolbox）
- Docker Desktop 版本 >= 18.03

**Linux:**
- 使用 `172.17.0.1` 代替 `host.docker.internal`
- 或添加 `extra_hosts`：
  ```yaml
  extra_hosts:
    - "host.docker.internal:host-gateway"
  ```

#### 错误2：连接被拒绝

可能原因：
1. 后端未启动
2. 后端端口不是 8000
3. 防火墙阻止连接

解决方法：
```bash
# 检查后端是否运行
docker ps | grep backend

# 测试端口
telnet localhost 8000
# 或
curl http://localhost:8000/api/tasks
```

#### 错误3：构建后修改环境变量无效

**重要**：修改 `BACKEND_URL` 后必须**重新构建**镜像：
```bash
docker-compose build --no-cache frontend
docker-compose up -d
```

### 快速修复命令

```bash
# 1. 停止容器
docker-compose down

# 2. 重新构建（使用新的 BACKEND_URL）
docker-compose build --no-cache frontend

# 3. 启动
docker-compose up -d

# 4. 查看日志
docker-compose logs -f frontend
```

### 调试技巧

1. **进入容器检查**：
   ```bash
   docker exec -it ansys-speos-task-frontend sh
   # 在容器内
   env | grep BACKEND
   cat .next/routes-manifest.json
   ```

2. **查看网络连接**：
   ```bash
   docker network inspect ansys_speos_task_frontend_ansys-network
   ```

3. **测试后端可达性**：
   ```bash
   # 从宿主机
   curl http://localhost:8000/api/tasks
   
   # 从容器内（需要先安装工具）
   docker exec ansys-speos-task-frontend sh -c "apk add curl && curl http://host.docker.internal:8000/api/tasks"
   ```

### 最佳实践

1. **开发环境**：使用 `host.docker.internal`（Windows/Mac）或 `172.17.0.1`（Linux）
2. **生产环境**：使用实际的后端服务地址或服务名
3. **Docker Compose 多服务**：使用服务名和共享网络
4. **文档化**：在 `docker-compose.yml` 中添加注释说明后端地址配置


# Docker 连接后端快速修复指南

## 问题：前端 Docker 容器无法连接后端（500 错误）

### 快速诊断

1. **检查后端是否运行**：
   ```bash
   # 检查后端容器
   docker ps | findstr backend
   
   # 或测试后端 API
   curl http://localhost:8000/api/tasks
   ```

2. **检查前端容器日志**：
   ```bash
   docker logs ansys-speos-task-frontend
   ```

### 解决方案（根据你的情况选择）

#### 情况1：后端在宿主机运行（本地启动）

**Windows/Mac:**
```yaml
# docker-compose.yml
build:
  args:
    BACKEND_URL: http://host.docker.internal:8000
```

**如果 `host.docker.internal` 不工作，使用宿主机 IP：**
```bash
# 1. 查找宿主机 IP
ipconfig  # Windows
# 找到 IPv4 地址，例如：172.30.32.1

# 2. 修改 docker-compose.yml
BACKEND_URL: http://172.30.32.1:8000  # 替换为你的 IP
```

#### 情况2：后端也在 Docker 中运行

**步骤1：找到后端网络名**
```bash
docker inspect speos-backend --format='{{range $key, $value := .NetworkSettings.Networks}}{{$key}}{{end}}'
```

**步骤2：修改 docker-compose.yml**
```yaml
services:
  frontend:
    build:
      args:
        BACKEND_URL: http://speos-backend:8000  # 使用后端容器名
    networks:
      - ansys-network
      - ansys_speos_task_backend_default  # 后端网络名

networks:
  ansys-network:
    driver: bridge
  ansys_speos_task_backend_default:
    external: true  # 使用外部网络
```

### 修复步骤

1. **停止当前容器**：
   ```bash
   docker-compose down
   ```

2. **修改 docker-compose.yml**（根据上述情况选择配置）

3. **重新构建并启动**：
   ```bash
   docker-compose build --no-cache frontend
   docker-compose up -d
   ```

4. **验证**：
   ```bash
   # 查看日志
   docker logs -f ansys-speos-task-frontend
   
   # 访问前端
   # 浏览器打开 http://localhost:3000
   ```

### 常见问题

#### Q: 修改后仍然 500 错误？
A: 确保**重新构建**了镜像（`--no-cache`），因为 `BACKEND_URL` 是在构建时设置的。

#### Q: `host.docker.internal` 无法解析？
A: 
- Windows: 确保使用 Docker Desktop（不是 Docker Toolbox）
- Linux: 使用 `172.17.0.1` 或添加 `extra_hosts`

#### Q: 如何确认后端地址是否正确？
A: 在容器内测试：
```bash
# 进入容器
docker exec -it ansys-speos-task-frontend sh

# 安装工具并测试
apk add curl
curl http://host.docker.internal:8000/api/tasks
```

### 推荐配置（根据你的环境）

**如果后端在宿主机（推荐当前情况）：**
```yaml
build:
  args:
    BACKEND_URL: http://host.docker.internal:8000
extra_hosts:
  - "host.docker.internal:host-gateway"
```

**如果后端在 Docker 中：**
```yaml
build:
  args:
    BACKEND_URL: http://speos-backend:8000
networks:
  - ansys-network
  - ansys_speos_task_backend_default
```


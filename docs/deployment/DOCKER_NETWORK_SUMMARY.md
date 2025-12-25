# Docker 网络统一配置总结

## ✅ 已完成的配置

### 1. 网络统一

- **网络名称**: `ansys-speos-task`
- **网络类型**: `bridge`（外部网络，前后端共享）
- **状态**: 已创建

### 2. 前端配置

前端 `docker-compose.yml` 已配置为：
- 使用 `ansys-speos-task` 网络
- 后端地址使用服务名：`http://backend:8000`

### 3. 后端配置要求

后端需要配置为使用相同的网络。在后端的 `docker-compose.yml` 中添加：

```yaml
services:
  backend:  # 确保服务名是 backend（或修改前端配置匹配）
    # ... 其他配置
    networks:
      - ansys-speos-task

networks:
  ansys-speos-task:
    name: ansys-speos-task
    external: true
```

## 🔧 配置步骤

### 步骤1：确认后端服务名

查看后端 `docker-compose.yml` 中的服务名：

```yaml
services:
  backend:  # ← 这就是服务名
```

如果后端服务名不是 `backend`，需要修改前端的 `docker-compose.yml`：

```yaml
build:
  args:
    BACKEND_URL: http://实际服务名:8000
```

### 步骤2：配置后端网络

在后端的 `docker-compose.yml` 中添加网络配置（如果还没有）：

```yaml
services:
  backend:
    networks:
      - ansys-speos-task

networks:
  ansys-speos-task:
    name: ansys-speos-task
    external: true
```

### 步骤3：启动服务

**启动顺序**：
1. 先启动后端（确保网络存在）
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

## 📋 验证清单

- [ ] 网络 `ansys-speos-task` 已创建
- [ ] 后端配置使用 `ansys-speos-task` 网络
- [ ] 前端配置使用 `ansys-speos-task` 网络
- [ ] 前端 `BACKEND_URL` 使用正确的后端服务名
- [ ] 前后端容器都在同一网络中
- [ ] 前端可以访问后端 API

## 🔍 验证命令

```bash
# 检查网络
docker network inspect ansys-speos-task

# 查看网络中的容器
docker network inspect ansys-speos-task --format '{{range .Containers}}{{.Name}} {{end}}'

# 从前端容器测试后端连接
docker exec ansys-speos-task-frontend ping backend
```

## 📝 重要提示

1. **服务名必须匹配**：前端 `BACKEND_URL` 中的服务名必须与后端 `docker-compose.yml` 中的服务名一致
2. **网络必须存在**：在启动服务前，确保 `ansys-speos-task` 网络已创建
3. **外部网络**：网络配置为 `external: true`，需要手动创建或由后端先创建
4. **重新构建**：修改 `BACKEND_URL` 后必须重新构建前端镜像

## 🛠️ 工具脚本

- `scripts/create-network.sh` / `scripts/create-network.bat` - 创建网络
- `scripts/check-network.sh` / `scripts/check-network.bat` - 检查网络配置

## 📚 相关文档

- [网络配置详细指南](DOCKER_NETWORK_SETUP.md)
- [Docker 部署指南](DOCKER.md)
- [故障排查](DOCKER_TROUBLESHOOTING.md)


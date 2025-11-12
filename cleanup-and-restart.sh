#!/bin/bash

# 完全清理所有前端服务并在3000端口重启
# Author: AI Assistant
# Date: 2025-11-12

echo "========================================="
echo "  清理所有前端服务"
echo "========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. 停止所有 Next.js 进程
echo -e "${CYAN}1. 查找并停止所有 Next.js 进程...${NC}"
NEXT_PIDS=$(ps aux | grep 'next dev\|next-server' | grep -v grep | awk '{print $2}')

if [ -z "$NEXT_PIDS" ]; then
    echo -e "${GREEN}✓ 没有发现 Next.js 进程${NC}"
else
    echo -e "${YELLOW}发现以下 Next.js 进程：${NC}"
    ps aux | grep 'next dev\|next-server' | grep -v grep
    echo ""
    echo -e "${YELLOW}正在停止...${NC}"
    echo "$NEXT_PIDS" | xargs kill -9 2>/dev/null
    sleep 2
    echo -e "${GREEN}✓ 所有 Next.js 进程已停止${NC}"
fi
echo ""

# 2. 查找并停止占用3000-3010端口的进程
echo -e "${CYAN}2. 检查并清理端口 3000-3010...${NC}"
for port in {3000..3010}; do
    PID=$(lsof -ti:$port 2>/dev/null || fuser $port/tcp 2>/dev/null)
    if [ ! -z "$PID" ]; then
        echo -e "${YELLOW}端口 $port 被进程 $PID 占用，正在停止...${NC}"
        kill -9 $PID 2>/dev/null
        echo -e "${GREEN}✓ 端口 $port 已释放${NC}"
    fi
done
echo -e "${GREEN}✓ 端口检查完成${NC}"
echo ""

# 3. 清理 PID 文件
echo -e "${CYAN}3. 清理 PID 文件...${NC}"
rm -f nextjs-dev.pid nextjs-dev.log nextjs-dev.log.old
echo -e "${GREEN}✓ PID 文件已清理${NC}"
echo ""

# 4. 清理 Next.js 缓存
echo -e "${CYAN}4. 清理 Next.js 缓存...${NC}"
rm -rf .next
echo -e "${GREEN}✓ .next 缓存已清理${NC}"
echo ""

# 5. 清理 node_modules（可选）
read -p "是否重新安装 node_modules？(y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${CYAN}5. 清理并重新安装依赖...${NC}"
    rm -rf node_modules package-lock.json
    echo -e "${YELLOW}正在安装依赖，请稍候...${NC}"
    npm install
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ 依赖安装成功${NC}"
    else
        echo -e "${RED}✗ 依赖安装失败${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}跳过 node_modules 清理${NC}"
fi
echo ""

# 6. 验证端口3000是否可用
echo -e "${CYAN}6. 验证端口 3000...${NC}"
if lsof -i:3000 > /dev/null 2>&1 || fuser 3000/tcp > /dev/null 2>&1; then
    echo -e "${RED}✗ 端口 3000 仍被占用！${NC}"
    echo -e "${YELLOW}占用进程：${NC}"
    lsof -i:3000 2>/dev/null || fuser -v 3000/tcp 2>&1
    exit 1
else
    echo -e "${GREEN}✓ 端口 3000 可用${NC}"
fi
echo ""

# 7. 启动开发服务器
echo "========================================="
echo -e "${CYAN}7. 启动开发服务器（端口 3000）...${NC}"
echo "========================================="
echo ""

./start-dev-background.sh

echo ""
echo "========================================="
echo -e "${GREEN}  清理和重启完成！${NC}"
echo "========================================="
echo ""
echo -e "${CYAN}检查服务状态：${NC}"
sleep 3
./server-status.sh

echo ""
echo -e "${CYAN}实时查看日志：${NC}"
echo "  ./view-logs.sh -f"
echo ""
echo -e "${CYAN}访问地址：${NC}"
echo "  http://localhost:3000"
echo "  http://$(hostname -I | awk '{print $1}'):3000"


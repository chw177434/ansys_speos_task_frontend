#!/bin/bash

# 强制停止所有前端相关进程
# 快速清理脚本

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Change to project root directory (one level up from scripts/)
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT" || exit 1

echo "🛑 停止所有前端服务..."

# 停止所有 Next.js 进程
echo "1. 停止 Next.js 进程..."
pkill -9 -f "next dev" 2>/dev/null
pkill -9 -f "next-server" 2>/dev/null
pkill -9 -f "node.*next" 2>/dev/null

# 释放 3000-3010 端口
echo "2. 释放端口 3000-3010..."
for port in {3000..3010}; do
    fuser -k $port/tcp 2>/dev/null
done

# 清理文件
echo "3. 清理临时文件..."
rm -f nextjs-dev.pid nextjs-dev.log nextjs-dev.log.old

echo "✅ 清理完成！"
echo ""
echo "验证："
echo "  端口检查: netstat -tlnp | grep 300"
echo "  进程检查: ps aux | grep next"


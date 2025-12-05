#!/bin/bash

# 前端服务诊断脚本
# 用于排查 404 问题

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Change to project root directory (one level up from scripts/)
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT" || exit 1

echo "========================================="
echo "  前端服务诊断"
echo "========================================="
echo ""

# 1. 检查进程
echo "1. 检查 Node.js 进程："
ps aux | grep 'next dev' | grep -v grep
echo ""

# 2. 检查端口监听
echo "2. 检查端口 3000 监听状态："
netstat -tlnp 2>/dev/null | grep :3000 || ss -tlnp | grep :3000
echo ""

# 3. 检查服务器状态
echo "3. 服务器状态："
if [ -f "nextjs-dev.pid" ]; then
    PID=$(cat nextjs-dev.pid)
    echo "PID 文件存在: $PID"
    if ps -p $PID > /dev/null 2>&1; then
        echo "✓ 进程运行中"
    else
        echo "✗ 进程已停止"
    fi
else
    echo "⚠ PID 文件不存在"
fi
echo ""

# 4. 检查日志
echo "4. 查看日志（最后 30 行）："
echo "==========================================="
if [ -f "nextjs-dev.log" ]; then
    tail -30 nextjs-dev.log
else
    echo "❌ 日志文件不存在"
fi
echo ""

# 5. 检查编译错误
echo "==========================================="
echo "5. 查找编译错误："
if [ -f "nextjs-dev.log" ]; then
    echo ""
    grep -i -A 5 "error\|failed\|cannot find module" nextjs-dev.log | tail -30
else
    echo "无日志文件"
fi

echo ""
echo "==========================================="
echo "6. 测试连接："
curl -I http://localhost:3000 2>&1 | head -10

echo ""
echo "==========================================="
echo ""
echo "💡 建议："
echo "  - 如果有编译错误，查看上面的错误信息"
echo "  - 如果进程未运行，执行: $SCRIPT_DIR/start-dev-background.sh"
echo "  - 查看完整日志: cat nextjs-dev.log"
echo "  - 实时查看日志: $SCRIPT_DIR/view-logs.sh -f"


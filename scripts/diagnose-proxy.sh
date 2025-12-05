#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Change to project root directory (one level up from scripts/)
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT" || exit 1

echo "========================================="
echo "  诊断前后端连接"
echo "========================================="
echo ""

# 1. 测试后端直连
echo "1. 测试后端接口（直接访问）："
echo "   curl http://localhost:8000/api/v2/upload/config"
BACKEND_RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" http://localhost:8000/api/v2/upload/config)
echo "$BACKEND_RESULT"
BACKEND_CODE=$(echo "$BACKEND_RESULT" | grep "HTTP_CODE" | cut -d: -f2)

echo ""
if [ "$BACKEND_CODE" = "200" ]; then
    echo "✅ 后端接口正常"
else
    echo "❌ 后端接口失败（HTTP $BACKEND_CODE）"
    echo ""
    echo "尝试其他可能的路径："
    echo "   /v2/upload/config :"
    curl http://localhost:8000/v2/upload/config
    echo ""
    echo "   /upload/config :"
    curl http://localhost:8000/upload/config
    echo ""
fi

echo ""
echo "========================================="
echo "2. 测试前端代理："
echo "   curl http://localhost:3000/api/v2/upload/config"
FRONTEND_RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" http://localhost:3000/api/v2/upload/config)
echo "$FRONTEND_RESULT"
FRONTEND_CODE=$(echo "$FRONTEND_RESULT" | grep "HTTP_CODE" | cut -d: -f2)

echo ""
if [ "$FRONTEND_CODE" = "200" ]; then
    echo "✅ 前端代理正常"
else
    echo "❌ 前端代理失败（HTTP $FRONTEND_CODE）"
fi

echo ""
echo "========================================="
echo "3. 检查 next.config.js："
grep -A 3 "destination:" next.config.js

echo ""
echo "========================================="
echo "4. 检查前端日志："
tail -30 nextjs-dev.log | grep -i "backend\|error\|ready"

echo ""
echo "========================================="
echo "建议："
if [ "$BACKEND_CODE" != "200" ]; then
    echo "❌ 后端接口路径可能不对"
    echo "   请确认后端的准确接口路径"
elif [ "$FRONTEND_CODE" != "200" ]; then
    echo "❌ 前端代理配置有问题"
    echo "   需要完全重启 Next.js："
    echo "   pkill -9 -f next"
    echo "   rm -rf .next"
    echo "   $SCRIPT_DIR/start-dev-background.sh"
else
    echo "✅ 一切正常！"
fi

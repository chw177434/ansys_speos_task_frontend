#!/bin/bash

# 只清理并重启本工程前端（默认端口 3000）。
# 不会按 next / next-server 进程名全局结束，也不会动其他端口上的应用。

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Change to project root directory (one level up from scripts/)
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT" || exit 1

# shellcheck source=lib/this-frontend.sh
source "$SCRIPT_DIR/lib/this-frontend.sh"

echo "========================================="
echo "  只重启本工程前端"
echo "========================================="
echo ""
echo -e "工程目录: ${PROJECT_ROOT}"
echo -e "目标端口: ${THIS_FRONTEND_PORT}"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. 只停止本工程前端
echo -e "${CYAN}1. 停止本工程前端进程...${NC}"
this_frontend_stop
if this_frontend_collect_pids | grep -q .; then
    echo -e "${RED}✗ 本工程前端没有停干净，已中止重启。其他应用未改动。${NC}"
    exit 1
fi
echo ""

# 2. 只确认本工程端口。被其他应用占用时中止，不结束对方。
echo -e "${CYAN}2. 确认端口 ${THIS_FRONTEND_PORT} 没有被其他应用占用...${NC}"
if ! this_frontend_assert_port_available; then
    echo -e "${RED}✗ 未重启。其他应用保持原样。${NC}"
    exit 1
fi
echo -e "${GREEN}✓ 端口 ${THIS_FRONTEND_PORT} 可以给本工程使用${NC}"
echo ""

# 3. 清理 PID 文件
echo -e "${CYAN}3. 清理 PID 文件...${NC}"
rm -f nextjs-dev.pid nextjs-dev.log nextjs-dev.log.old
echo -e "${GREEN}✓ PID 文件已清理${NC}"
echo ""

# 4. 清理 Next.js 缓存
echo -e "${CYAN}4. 清理 Next.js 缓存...${NC}"
rm -rf .next
rm -rf node_modules/.cache  # 清理 node_modules 缓存
rm -rf .next/cache          # 清理 Next.js 构建缓存
rm -rf out                  # 清理输出目录（如果有）
echo -e "${GREEN}✓ .next 和相关缓存已清理${NC}"
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

# 6. 再次确认本工程端口仍未被其他应用占用
echo -e "${CYAN}6. 再次确认端口 ${THIS_FRONTEND_PORT}...${NC}"
if ! this_frontend_assert_port_available; then
    echo -e "${RED}✗ 端口 ${THIS_FRONTEND_PORT} 被其他应用占用，已停止启动。${NC}"
    exit 1
fi
# 若本工程进程还在听这个端口，不能再拉起一份
if [[ -n "$(this_frontend_port_pids "$THIS_FRONTEND_PORT" | head -n 1)" ]]; then
    echo -e "${RED}✗ 本工程前端仍占用端口 ${THIS_FRONTEND_PORT}，启动已取消。${NC}"
    exit 1
fi
echo -e "${GREEN}✓ 端口 ${THIS_FRONTEND_PORT} 可用${NC}"
echo ""

# 7. 启动开发服务器
echo "========================================="
echo -e "${CYAN}7. 启动开发服务器（端口 ${THIS_FRONTEND_PORT}）...${NC}"
echo "========================================="
echo ""

"$SCRIPT_DIR/start-dev-background.sh"

echo ""
echo "========================================="
echo -e "${GREEN}  清理和重启完成！${NC}"
echo "========================================="
echo ""
echo -e "${CYAN}检查服务状态：${NC}"
sleep 3
"$SCRIPT_DIR/server-status.sh"

echo ""
echo -e "${YELLOW}⚠️  重要提示：浏览器端操作${NC}"
echo "========================================="
echo -e "${CYAN}请在浏览器中执行以下步骤：${NC}"
echo ""
echo "  1. 按 F12 打开开发者工具"
echo "  2. 切换到 Network 选项卡"
echo "  3. ✅ 勾选 'Disable cache'"
echo "  4. 按 Ctrl+Shift+R 硬刷新页面"
echo ""
echo -e "${CYAN}或者右键点击刷新按钮：${NC}"
echo "  选择 '清空缓存并硬性重新加载'"
echo ""
echo "========================================="
echo ""
echo -e "${CYAN}实时查看日志：${NC}"
echo "  ./view-logs.sh -f"
echo ""
echo -e "${CYAN}访问地址：${NC}"
echo "  http://localhost:${THIS_FRONTEND_PORT}"
echo "  http://$(hostname -I | awk '{print $1}'):${THIS_FRONTEND_PORT}"
echo ""
echo -e "${YELLOW}验证代码是否生效：${NC}"
echo "  在浏览器 Console 中运行："
echo "  performance.getEntriesByType('resource').some(r => r.name.includes('/detail'))"
echo "  应该返回 true（对于运行中的任务）"
echo ""


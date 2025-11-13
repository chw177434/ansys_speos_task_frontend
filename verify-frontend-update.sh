#!/bin/bash

# 验证前端代码更新是否生效
# Author: AI Assistant
# Date: 2024-11-13

echo "========================================="
echo "  验证前端代码更新"
echo "========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. 检查前端服务是否在运行
echo -e "${CYAN}1. 检查前端服务状态...${NC}"
if lsof -i:3000 > /dev/null 2>&1 || fuser 3000/tcp > /dev/null 2>&1; then
    echo -e "${GREEN}✓ 前端服务正在运行（端口 3000）${NC}"
    
    # 显示进程信息
    PID=$(lsof -ti:3000 2>/dev/null || fuser 3000/tcp 2>/dev/null | awk '{print $1}')
    if [ ! -z "$PID" ]; then
        echo -e "${CYAN}  进程 PID: $PID${NC}"
        ps -p $PID -o pid,etime,cmd | tail -n 1
    fi
else
    echo -e "${RED}✗ 前端服务未运行！${NC}"
    echo -e "${YELLOW}请先运行: ./start-dev-background.sh${NC}"
    exit 1
fi
echo ""

# 2. 检查源代码文件更新时间
echo -e "${CYAN}2. 检查关键文件更新时间...${NC}"
if [ -f "components/TasksTable.tsx" ]; then
    MTIME=$(stat -c %Y "components/TasksTable.tsx" 2>/dev/null || stat -f %m "components/TasksTable.tsx" 2>/dev/null)
    MTIME_READABLE=$(stat -c "%y" "components/TasksTable.tsx" 2>/dev/null || stat -f "%Sm" "components/TasksTable.tsx" 2>/dev/null)
    echo -e "${GREEN}✓ TasksTable.tsx${NC}"
    echo -e "  最后修改: $MTIME_READABLE"
fi

if [ -f "lib/api.ts" ]; then
    MTIME=$(stat -c %Y "lib/api.ts" 2>/dev/null || stat -f %m "lib/api.ts" 2>/dev/null)
    MTIME_READABLE=$(stat -c "%y" "lib/api.ts" 2>/dev/null || stat -f "%Sm" "lib/api.ts" 2>/dev/null)
    echo -e "${GREEN}✓ api.ts${NC}"
    echo -e "  最后修改: $MTIME_READABLE"
fi
echo ""

# 3. 检查 .next 目录
echo -e "${CYAN}3. 检查编译缓存...${NC}"
if [ -d ".next" ]; then
    NEXT_MTIME=$(stat -c %Y ".next" 2>/dev/null || stat -f %m ".next" 2>/dev/null)
    NEXT_MTIME_READABLE=$(stat -c "%y" ".next" 2>/dev/null || stat -f "%Sm" ".next" 2>/dev/null)
    echo -e "${GREEN}✓ .next 目录存在${NC}"
    echo -e "  创建时间: $NEXT_MTIME_READABLE"
    
    # 检查 .next 是否比源代码新
    SOURCE_MTIME=$(stat -c %Y "components/TasksTable.tsx" 2>/dev/null || stat -f %m "components/TasksTable.tsx" 2>/dev/null)
    if [ $NEXT_MTIME -gt $SOURCE_MTIME ]; then
        echo -e "${GREEN}✓ 编译缓存比源代码新${NC}"
    else
        echo -e "${YELLOW}⚠️  编译缓存可能过期，建议重新编译${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  .next 目录不存在${NC}"
fi
echo ""

# 4. 搜索关键代码特征
echo -e "${CYAN}4. 检查关键代码是否存在...${NC}"

# 检查 fetchProgressForTask 函数
if grep -q "fetchProgressForTask" components/TasksTable.tsx; then
    echo -e "${GREEN}✓ 找到 fetchProgressForTask 函数${NC}"
else
    echo -e "${RED}✗ 未找到 fetchProgressForTask 函数${NC}"
    echo -e "${YELLOW}  可能代码文件没有更新！${NC}"
fi

# 检查 progress_info 新字段
if grep -q "current_pass" components/TasksTable.tsx; then
    echo -e "${GREEN}✓ 找到 current_pass 字段处理${NC}"
else
    echo -e "${RED}✗ 未找到 current_pass 字段处理${NC}"
fi

# 检查 ProgressInfo 接口
if grep -q "current_sensor" lib/api.ts; then
    echo -e "${GREEN}✓ 找到 current_sensor 字段定义${NC}"
else
    echo -e "${RED}✗ 未找到 current_sensor 字段定义${NC}"
fi
echo ""

# 5. 测试前端 API
echo -e "${CYAN}5. 测试前端 API 连通性...${NC}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/api/tasks" 2>/dev/null)
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ API 可访问（状态码: $HTTP_CODE）${NC}"
else
    echo -e "${YELLOW}⚠️  API 返回状态码: $HTTP_CODE${NC}"
fi
echo ""

# 6. 检查是否有运行中的任务
echo -e "${CYAN}6. 检查当前任务状态...${NC}"
RUNNING_TASKS=$(curl -s "http://localhost:8000/api/tasks" 2>/dev/null | grep -o '"status":"PROGRESS\|RUNNING\|STARTED"' | wc -l)
if [ $RUNNING_TASKS -gt 0 ]; then
    echo -e "${GREEN}✓ 发现 $RUNNING_TASKS 个运行中的任务${NC}"
    echo -e "${CYAN}  这些任务应该会触发 detail 接口调用${NC}"
else
    echo -e "${YELLOW}⚠️  当前没有运行中的任务${NC}"
    echo -e "${CYAN}  提交一个新任务来测试进度显示功能${NC}"
fi
echo ""

# 总结
echo "========================================="
echo -e "${GREEN}  验证完成${NC}"
echo "========================================="
echo ""
echo -e "${YELLOW}⚠️  关键步骤（必须在浏览器中操作）：${NC}"
echo ""
echo "  ${CYAN}1. 打开浏览器开发者工具（F12）${NC}"
echo "  ${CYAN}2. Network 选项卡 → 勾选 'Disable cache'${NC}"
echo "  ${CYAN}3. 按 Ctrl+Shift+R 硬刷新页面${NC}"
echo "  ${CYAN}4. 在 Console 运行验证命令：${NC}"
echo ""
echo "     performance.getEntriesByType('resource')"
echo "       .some(r => r.name.includes('/detail'))"
echo ""
echo "     ${GREEN}返回 true = 代码已生效 ✓${NC}"
echo "     ${RED}返回 false = 需要继续排查 ✗${NC}"
echo ""
echo "========================================="


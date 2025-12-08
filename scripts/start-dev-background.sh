#!/bin/bash

# Next.js Development Server - Background Startup Script
# Author: AI Assistant
# Date: 2025-11-11

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Change to project root directory (one level up from scripts/)
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT" || exit 1

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

LOG_FILE="nextjs-dev.log"
PID_FILE="nextjs-dev.pid"

# 后端服务器地址配置
# 可以通过环境变量 BACKEND_URL 指定后端地址
# 例如: export BACKEND_URL=http://10.100.100.12:8000
if [ -z "$BACKEND_URL" ]; then
    export BACKEND_URL="http://localhost:8000"
fi

echo "========================================="
echo "  Starting Next.js in Background"
echo "========================================="
echo ""
echo -e "${CYAN}后端服务器: $BACKEND_URL${NC}"
echo ""

# Check if already running
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if ps -p "$OLD_PID" > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠ Next.js is already running (PID: $OLD_PID)${NC}"
        echo -e "${CYAN}To stop it, run: ./stop-dev.sh${NC}"
        echo -e "${CYAN}To view logs, run: ./view-logs.sh${NC}"
        exit 1
    else
        echo -e "${YELLOW}Removing stale PID file${NC}"
        rm -f "$PID_FILE"
    fi
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}ERROR: Node.js is not installed!${NC}"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}ERROR: Failed to install dependencies!${NC}"
        exit 1
    fi
fi

echo -e "${CYAN}Node.js version: $(node --version)${NC}"
echo -e "${CYAN}npm version: $(npm --version)${NC}"
echo ""

# Start in background
echo -e "${GREEN}Starting Next.js server in background...${NC}"
echo -e "${CYAN}Log file: $LOG_FILE${NC}"
echo ""

# Clear or rotate old log
if [ -f "$LOG_FILE" ]; then
    mv "$LOG_FILE" "$LOG_FILE.old"
fi

# Start the server in background
nohup npm run dev -- -H 0.0.0.0 > "$LOG_FILE" 2>&1 &
SERVER_PID=$!

# Save PID
echo $SERVER_PID > "$PID_FILE"

# Wait a moment to check if it started successfully
sleep 2

if ps -p "$SERVER_PID" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Server started successfully!${NC}"
    echo ""
    echo -e "${CYAN}Process ID: $SERVER_PID${NC}"
    echo -e "${CYAN}Log file: $LOG_FILE${NC}"
    echo ""
    echo -e "${GREEN}Server will be available at:${NC}"
    echo -e "${GREEN}  → Local:   http://localhost:3000${NC}"
    echo -e "${GREEN}  → Network: http://$(hostname -I | awk '{print $1}'):3000${NC}"
    echo ""
    echo -e "${YELLOW}Useful commands:${NC}"
    echo -e "  ${CYAN}View logs:${NC}       ./view-logs.sh"
    echo -e "  ${CYAN}Follow logs:${NC}     ./view-logs.sh -f"
    echo -e "  ${CYAN}Stop server:${NC}     ./stop-dev.sh"
    echo -e "  ${CYAN}Check status:${NC}    ps -p $SERVER_PID"
else
    echo -e "${RED}✗ Failed to start server${NC}"
    echo -e "${YELLOW}Check the log file: $LOG_FILE${NC}"
    rm -f "$PID_FILE"
    exit 1
fi


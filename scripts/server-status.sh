#!/bin/bash

# Next.js Development Server - Status Check
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

PID_FILE="nextjs-dev.pid"
LOG_FILE="nextjs-dev.log"

echo "========================================="
echo "  Next.js Server Status"
echo "========================================="
echo ""

# Check if PID file exists
if [ -f "$PID_FILE" ]; then
    SERVER_PID=$(cat "$PID_FILE")
    echo -e "${CYAN}PID File: $PID_FILE${NC}"
    echo -e "${CYAN}Process ID: $SERVER_PID${NC}"
    echo ""
    
    # Check if process is running
    if ps -p "$SERVER_PID" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Server is RUNNING${NC}"
        echo ""
        echo -e "${CYAN}Process details:${NC}"
        ps -fp "$SERVER_PID"
        echo ""
        
        # Check port
        if netstat -tlnp 2>/dev/null | grep -q ":3000"; then
            echo -e "${GREEN}✓ Port 3000 is open${NC}"
            echo ""
            echo -e "${CYAN}Network connections:${NC}"
            netstat -tlnp 2>/dev/null | grep ":3000" || ss -tlnp | grep ":3000"
            echo ""
            echo -e "${GREEN}Server URL:${NC}"
            echo -e "  → Local:   http://localhost:3000"
            echo -e "  → Network: http://$(hostname -I | awk '{print $1}'):3000"
        else
            echo -e "${YELLOW}⚠ Port 3000 is not listening yet${NC}"
            echo -e "${CYAN}Server may still be starting up...${NC}"
        fi
    else
        echo -e "${RED}✗ Server is NOT RUNNING${NC}"
        echo -e "${YELLOW}(PID file exists but process is not running)${NC}"
    fi
else
    echo -e "${YELLOW}⚠ PID file not found${NC}"
    echo -e "${CYAN}Server may not be running, or was not started with start-dev-background.sh${NC}"
    echo ""
    
    # Search for Next.js processes
    echo -e "${YELLOW}Searching for Next.js processes...${NC}"
    PIDS=$(ps aux | grep 'next dev' | grep -v grep)
    if [ -z "$PIDS" ]; then
        echo -e "${RED}✗ No Next.js processes found${NC}"
    else
        echo -e "${GREEN}Found Next.js processes:${NC}"
        echo "$PIDS"
    fi
fi

echo ""

# Check log file
if [ -f "$LOG_FILE" ]; then
    LOG_SIZE=$(du -h "$LOG_FILE" | cut -f1)
    LOG_LINES=$(wc -l < "$LOG_FILE")
    echo -e "${CYAN}Log file: $LOG_FILE${NC}"
    echo -e "${CYAN}Size: $LOG_SIZE, Lines: $LOG_LINES${NC}"
    echo ""
    echo -e "${YELLOW}Last 5 lines of log:${NC}"
    echo -e "${CYAN}----------------------------------------${NC}"
    tail -n 5 "$LOG_FILE"
    echo -e "${CYAN}----------------------------------------${NC}"
else
    echo -e "${YELLOW}⚠ Log file not found${NC}"
fi

echo ""
echo -e "${YELLOW}Available commands:${NC}"
echo -e "  ${CYAN}Start server:${NC}    $SCRIPT_DIR/start-dev-background.sh"
echo -e "  ${CYAN}Stop server:${NC}     $SCRIPT_DIR/stop-dev.sh"
echo -e "  ${CYAN}View logs:${NC}       $SCRIPT_DIR/view-logs.sh"
echo -e "  ${CYAN}Follow logs:${NC}     $SCRIPT_DIR/view-logs.sh -f"
echo -e "  ${CYAN}Check status:${NC}    $SCRIPT_DIR/server-status.sh"


#!/bin/bash

# Next.js Development Server - Stop Script
# Author: AI Assistant
# Date: 2025-11-11

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PID_FILE="nextjs-dev.pid"

echo "========================================="
echo "  Stopping Next.js Server"
echo "========================================="
echo ""

# Check if PID file exists
if [ ! -f "$PID_FILE" ]; then
    echo -e "${YELLOW}⚠ No PID file found${NC}"
    echo -e "${CYAN}Server may not be running, or was not started with start-dev-background.sh${NC}"
    echo ""
    echo -e "${YELLOW}Searching for Next.js processes...${NC}"
    
    # Try to find and kill Next.js processes
    PIDS=$(ps aux | grep 'next dev' | grep -v grep | awk '{print $2}')
    if [ -z "$PIDS" ]; then
        echo -e "${GREEN}No Next.js processes found${NC}"
        exit 0
    else
        echo -e "${YELLOW}Found Next.js processes:${NC}"
        ps aux | grep 'next dev' | grep -v grep
        echo ""
        read -p "Kill these processes? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            kill $PIDS
            echo -e "${GREEN}✓ Processes killed${NC}"
        else
            echo -e "${YELLOW}Operation cancelled${NC}"
        fi
    fi
    exit 0
fi

# Read PID from file
SERVER_PID=$(cat "$PID_FILE")

# Check if process is running
if ps -p "$SERVER_PID" > /dev/null 2>&1; then
    echo -e "${CYAN}Stopping server (PID: $SERVER_PID)...${NC}"
    kill "$SERVER_PID"
    
    # Wait for process to terminate
    sleep 2
    
    if ps -p "$SERVER_PID" > /dev/null 2>&1; then
        echo -e "${YELLOW}Process still running, forcing shutdown...${NC}"
        kill -9 "$SERVER_PID"
        sleep 1
    fi
    
    if ps -p "$SERVER_PID" > /dev/null 2>&1; then
        echo -e "${RED}✗ Failed to stop server${NC}"
        exit 1
    else
        echo -e "${GREEN}✓ Server stopped successfully${NC}"
        rm -f "$PID_FILE"
    fi
else
    echo -e "${YELLOW}⚠ Process $SERVER_PID is not running${NC}"
    rm -f "$PID_FILE"
fi

echo ""
echo -e "${GREEN}Done!${NC}"


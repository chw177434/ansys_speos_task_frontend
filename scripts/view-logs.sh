#!/bin/bash

# Next.js Development Server - Log Viewer
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

# Check if log file exists
if [ ! -f "$LOG_FILE" ]; then
    echo -e "${RED}ERROR: Log file not found: $LOG_FILE${NC}"
    echo -e "${YELLOW}Make sure the server was started with start-dev-background.sh${NC}"
    exit 1
fi

# Check server status
echo -e "${CYAN}=========================================${NC}"
echo -e "${CYAN}  Next.js Server Logs${NC}"
echo -e "${CYAN}=========================================${NC}"
echo ""

if [ -f "$PID_FILE" ]; then
    SERVER_PID=$(cat "$PID_FILE")
    if ps -p "$SERVER_PID" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Server is running (PID: $SERVER_PID)${NC}"
    else
        echo -e "${RED}✗ Server is not running${NC}"
    fi
else
    echo -e "${YELLOW}⚠ No PID file found${NC}"
fi

echo -e "${CYAN}Log file: $LOG_FILE${NC}"
echo ""

# Check if user wants to follow logs
if [ "$1" == "-f" ] || [ "$1" == "--follow" ]; then
    echo -e "${YELLOW}Following logs (Ctrl+C to exit)...${NC}"
    echo -e "${CYAN}=========================================${NC}"
    echo ""
    tail -f "$LOG_FILE"
elif [ "$1" == "-n" ]; then
    # Show last N lines
    LINES=${2:-50}
    echo -e "${YELLOW}Showing last $LINES lines...${NC}"
    echo -e "${CYAN}=========================================${NC}"
    echo ""
    tail -n "$LINES" "$LOG_FILE"
else
    # Show all logs
    echo -e "${YELLOW}Showing all logs (use -f to follow, -n NUM to show last NUM lines)...${NC}"
    echo -e "${CYAN}=========================================${NC}"
    echo ""
    cat "$LOG_FILE"
fi


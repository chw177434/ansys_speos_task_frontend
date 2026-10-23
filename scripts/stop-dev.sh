#!/bin/bash

# Next.js Development Server - Stop Script
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

# shellcheck source=lib/this-frontend.sh
source "$SCRIPT_DIR/lib/this-frontend.sh"

echo "========================================="
echo "  Stopping this project's frontend"
echo "========================================="
echo ""
echo -e "${CYAN}Project: ${PROJECT_ROOT}${NC}"
echo -e "${CYAN}Port:    ${THIS_FRONTEND_PORT}${NC}"
echo ""

this_frontend_stop

if this_frontend_collect_pids | grep -q .; then
    echo -e "${RED}✗ 本工程前端进程仍在运行${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}Done. Other applications were not stopped.${NC}"


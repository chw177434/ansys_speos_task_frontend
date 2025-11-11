#!/bin/bash

# Next.js Development Server Startup Script for Ubuntu
# Author: AI Assistant
# Date: 2025-11-11

echo "========================================"
echo "  Starting Next.js Dev Server"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Node.js is installed
echo -e "${CYAN}Checking Node.js installation...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}ERROR: Node.js is not installed!${NC}"
    echo -e "${YELLOW}Please install Node.js first:${NC}"
    echo "  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
    echo "  sudo apt-get install -y nodejs"
    exit 1
fi

NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)
echo -e "${GREEN}✓ Node.js version: $NODE_VERSION${NC}"
echo -e "${GREEN}✓ npm version: $NPM_VERSION${NC}"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}node_modules not found. Installing dependencies...${NC}"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}ERROR: Failed to install dependencies!${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Dependencies installed successfully${NC}"
    echo ""
fi

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo -e "${RED}ERROR: package.json not found!${NC}"
    echo -e "${YELLOW}Please run this script from the project root directory.${NC}"
    exit 1
fi

echo "========================================"
echo "  Configuration"
echo "========================================"

# Check for environment variables
if [ -f ".env.local" ]; then
    echo -e "${GREEN}✓ Found .env.local${NC}"
    echo -e "${CYAN}Environment variables:${NC}"
    cat .env.local | grep -v '^#' | grep -v '^$'
else
    echo -e "${YELLOW}⚠ No .env.local found${NC}"
    echo -e "${CYAN}Using default configuration (API proxy to localhost:8000)${NC}"
fi
echo ""

echo "========================================"
echo "  Starting Development Server..."
echo "========================================"
echo ""
echo -e "${CYAN}Server will be available at:${NC}"
echo -e "${GREEN}  → Local:   http://localhost:3000${NC}"
echo -e "${GREEN}  → Network: http://$(hostname -I | awk '{print $1}'):3000${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop the server${NC}"
echo ""

# Start the development server
npm run dev


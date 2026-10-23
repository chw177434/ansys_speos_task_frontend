#!/bin/bash

# 只停止本工程前端。不会结束其他目录或其他端口上的应用。

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT" || exit 1

# shellcheck source=lib/this-frontend.sh
source "$SCRIPT_DIR/lib/this-frontend.sh"

echo "停止本工程前端: ${PROJECT_ROOT}"
echo "端口范围仅检查 ${THIS_FRONTEND_PORT}，且不会结束其他应用。"
echo ""

this_frontend_stop

echo ""
echo "完成。其他应用未改动。"
echo "查看本工程进程: $SCRIPT_DIR/server-status.sh"

#!/bin/bash
# 检查 ansys-speos-task 网络配置

NETWORK_NAME="ansys-speos-task"

echo "检查网络配置..."
echo ""

# 检查网络是否存在
if docker network ls | grep -q "$NETWORK_NAME"; then
    echo "✓ 网络 $NETWORK_NAME 存在"
    
    # 显示网络中的容器
    echo ""
    echo "网络中的容器："
    docker network inspect "$NETWORK_NAME" --format '{{range .Containers}}{{.Name}} {{end}}' 2>/dev/null || echo "  无容器"
    
    # 显示网络详情
    echo ""
    echo "网络详情："
    docker network inspect "$NETWORK_NAME" --format '名称: {{.Name}}
驱动: {{.Driver}}
作用域: {{.Scope}}'
else
    echo "✗ 网络 $NETWORK_NAME 不存在"
    echo "请运行: ./scripts/create-network.sh"
    exit 1
fi


#!/bin/bash
# 创建 ansys-speos-task Docker 网络

NETWORK_NAME="ansys-speos-task"

echo "检查网络 $NETWORK_NAME 是否存在..."

if docker network ls | grep -q "$NETWORK_NAME"; then
    echo "✓ 网络 $NETWORK_NAME 已存在"
else
    echo "创建网络 $NETWORK_NAME..."
    docker network create "$NETWORK_NAME"
    if [ $? -eq 0 ]; then
        echo "✓ 网络 $NETWORK_NAME 创建成功"
    else
        echo "✗ 网络创建失败"
        exit 1
    fi
fi

echo ""
echo "网络信息："
docker network inspect "$NETWORK_NAME" --format '{{.Name}}: {{.Driver}}'


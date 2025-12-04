#!/bin/bash

# 设置变量
echo "开始本地构建..."

echo "\n1. 构建Go二进制文件..."
# 检查是否安装了Go
go version > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "错误: 未安装Go环境!"
  exit 1
fi

# 构建Go二进制文件（交叉编译，生成适合x86_64服务器的二进制文件）
GOOS=linux GOARCH=amd64 go build -o otter main.go
if [ $? -eq 0 ]; then
  echo "✓ Go二进制文件构建成功!（linux/amd64架构）"
else
  echo "✗ Go二进制文件构建失败!"
  exit 1
fi

echo "\n2. 构建前端项目..."
# 检查是否安装了Node.js
node -v > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "错误: 未安装Node.js环境!"
  exit 1
fi

# 进入前端目录并构建
cd web || exit 1

# 检查是否需要安装依赖
if [ ! -d "node_modules" ]; then
  echo "正在安装前端依赖..."
  npm install
fi

# 构建前端项目
npm run build
if [ $? -eq 0 ]; then
  echo "✓ 前端项目构建成功!"
  cd ..
else
  echo "✗ 前端项目构建失败!"
  cd ..
  exit 1
fi

echo "\n✓ 本地构建完成!"
echo "构建产物:"
echo "  - 二进制文件: ./otter"
echo "  - 前端资源: ./web/dist"

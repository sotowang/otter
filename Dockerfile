# 第一阶段：构建前端项目
FROM node:20-alpine AS frontend-builder

# 设置工作目录
WORKDIR /app/web

# 复制前端项目的package.json和package-lock.json
COPY web/package*.json ./

# 使用国内npm镜像加速依赖安装
RUN npm config set registry https://registry.npmmirror.com && npm install

# 复制前端项目的所有源代码
COPY web/ .

# 构建前端项目
RUN npm run build

# 第二阶段：构建Go应用程序
FROM golang:1.23 AS backend-builder

# 设置工作目录
WORKDIR /app

# 复制go.mod和go.sum文件
COPY go.mod go.sum ./

# 使用国内Go代理加速依赖下载
RUN go env -w GOPROXY=https://goproxy.cn,direct && go mod download

# 复制所有源代码
COPY . .

# 复制前端构建后的文件到后端项目中
COPY --from=frontend-builder /app/web/dist ./web

# 构建应用程序（强制使用amd64架构，确保兼容性）
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o otter main.go

# 第三阶段：最终镜像
FROM alpine:latest

# 设置工作目录
WORKDIR /app

# 复制构建好的二进制文件
COPY --from=backend-builder /app/otter .

# 复制前端构建后的文件
COPY --from=backend-builder /app/web ./web

# 暴露端口
EXPOSE 8086

# 设置环境变量（可以通过docker-compose或docker run命令覆盖）
ENV PORT=8086
ENV JWT_SECRET=your-secret-key

# 启动应用程序，将环境变量转换为命令行参数
CMD ["sh", "-c", "./otter -dsn $DSN -port $PORT -jwt-secret $JWT_SECRET"]

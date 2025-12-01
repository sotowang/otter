# otter
A light, flexible, and friendly config-center for microservices

## 功能特性 | Features

- **轻量级设计**：简单易用，部署便捷 | **Lightweight Design**: Simple to use, easy to deploy
- **多环境支持**：支持命名空间和分组管理 | **Multi-environment Support**: Support for namespace and group management
- **实时配置更新**：支持长轮询机制，配置变更实时推送 | **Real-time Config Updates**: Support for long polling mechanism, real-time config change push
- **配置历史**：支持配置版本管理和回滚 | **Config History**: Support for config version management and rollback
- **用户权限管理**：支持多用户和角色管理 | **User Permission Management**: Support for multi-user and role management
- **多种配置类型**：支持文本、JSON、YAML、Properties等格式 | **Multiple Config Types**: Support for text, JSON, YAML, Properties, etc.
- **RESTful API**：提供完整的API接口 | **RESTful API**: Provide complete API interfaces
- **Web管理界面**：直观易用的Web控制台 | **Web Management Interface**: Intuitive and easy-to-use Web console

## 快速开始 | Quick Start

### 本地运行 | Local Run

1. **克隆项目** | **Clone the project**
```bash
git clone https://github.com/your-username/otter.git
cd otter
```

2. **安装依赖** | **Install dependencies**
```bash
go mod download
```

3. **启动服务** | **Start the service**
```bash
go run main.go -dsn "postgres://user:password@localhost:5432/otter?sslmode=disable" -port 8086 -jwt-secret "your-secret-key"
```

参数说明 | Parameter description:
- `-dsn`：PostgreSQL连接字符串（可选，默认使用内存存储） | PostgreSQL DSN (optional, default uses in-memory storage)
- `-port`：服务端口（默认8086） | Service port (default 8086)
- `-jwt-secret`：JWT密钥（默认default-secret-key） | JWT secret key (default default-secret-key)

4. **访问Web界面** | **Access the Web interface**
```
http://localhost:8086
```

默认用户名：admin | Default username: admin
默认密码：admin | Default password: admin

### Docker部署 | Docker Deployment

1. **确保已安装Docker和Docker Compose** | **Make sure Docker and Docker Compose are installed**

2. **创建docker-compose.yml文件**（如果不存在） | **Create docker-compose.yml file** (if not exists)
```yaml
version: '3.8'

services:
  otter:
    build: .
    ports:
      - "8086:8086"
    environment:
      - PORT=8086
      - JWT_SECRET=your-secret-key
      - DSN=postgres://user:password@localhost:5432/otter?sslmode=disable
    restart: unless-stopped
```

3. **构建并启动服务** | **Build and start the service**
```bash
docker-compose up -d
```

4. **访问Web界面** | **Access the Web interface**
```
http://localhost:8086
```

## 配置说明 | Configuration

### 数据库配置 | Database Configuration

支持两种存储方式 | Support two storage methods:
- **PostgreSQL**：通过`-dsn`参数指定连接字符串 | **PostgreSQL**: Specify connection string via `-dsn` parameter
- **内存存储**：不指定`-dsn`参数时默认使用 | **In-memory Storage**: Default when `-dsn` parameter is not specified

### JWT配置 | JWT Configuration

- `-jwt-secret`：用于生成和验证JWT令牌的密钥 | Used to generate and verify JWT tokens
- 建议在生产环境中使用强密钥 | It is recommended to use a strong key in production environment

## API文档 | API Documentation

### 认证接口 | Authentication Interfaces

- `POST /api/v1/login`：用户登录 | User login
- `POST /api/v1/refresh`：刷新令牌 | Refresh token

### 命名空间接口 | Namespace Interfaces

- `GET /api/v1/namespaces`：列出所有命名空间 | List all namespaces
- `POST /api/v1/namespaces`：创建命名空间 | Create namespace
- `DELETE /api/v1/namespaces/:namespace`：删除命名空间 | Delete namespace

### 配置接口 | Config Interfaces

- `GET /api/v1/namespaces/:namespace/groups/:group/configs`：列出配置 | List configs
- `GET /api/v1/namespaces/:namespace/groups/:group/configs/:key`：获取配置 | Get config
- `PUT /api/v1/namespaces/:namespace/groups/:group/configs/:key`：创建或更新配置 | Create or update config
- `DELETE /api/v1/namespaces/:namespace/groups/:group/configs/:key`：删除配置 | Delete config
- `GET /api/v1/namespaces/:namespace/groups/:group/configs/:key/watch`：监听配置变更 | Watch config changes

### 配置历史接口 | Config History Interfaces

- `GET /api/v1/namespaces/:namespace/groups/:group/configs/:key/history`：列出配置历史 | List config history
- `POST /api/v1/namespaces/:namespace/groups/:group/configs/:key/rollback`：回滚配置 | Rollback config

### 用户管理接口 | User Management Interfaces

- `GET /api/v1/users`：列出所有用户 | List all users
- `POST /api/v1/users`：创建用户 | Create user
- `PUT /api/v1/users/:username`：更新用户 | Update user
- `DELETE /api/v1/users/:username`：删除用户 | Delete user

## 开发指南 | Development Guide

### 前端开发 | Frontend Development

1. **进入web目录** | **Enter web directory**
```bash
cd web
```

2. **安装依赖** | **Install dependencies**
```bash
npm install
```

3. **启动开发服务器** | **Start development server**
```bash
npm run dev
```

4. **构建生产版本** | **Build production version**
```bash
npm run build
```

### 后端开发 | Backend Development

1. **运行测试** | **Run tests**
```bash
go test ./...
```

2. **构建二进制文件** | **Build binary file**
```bash
go build -o otter main.go
```

## 贡献指南 | Contribution Guide

1. Fork项目 | Fork the project
2. 创建特性分支 | Create a feature branch
3. 提交代码 | Commit your changes
4. 推送到分支 | Push to the branch
5. 创建Pull Request | Create a Pull Request

## 许可证 | License

MIT License


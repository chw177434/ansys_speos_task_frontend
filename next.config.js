/** @type {import('next').NextConfig} */
const nextConfig = {
  // 配置 API 代理：将 /api/* 请求代理到后端服务器
  async rewrites() {
    // 从环境变量读取后端地址，默认为 localhost:8000
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    
    return [
      // 后端已统一路径，所有接口都有 /api 前缀
      // 前端 /api/* -> 后端 /api/*
      // 示例：
      //   /api/v2/upload/config -> http://localhost:8000/api/v2/upload/config
      //   /api/tasks -> http://localhost:8000/api/tasks
      //   /api/tasks/{id} -> http://localhost:8000/api/tasks/{id}
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};
module.exports = nextConfig;

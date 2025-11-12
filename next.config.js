/** @type {import('next').NextConfig} */
const nextConfig = {
  // 配置 API 代理：将 /api/* 请求代理到后端服务器
  async rewrites() {
    // 从环境变量读取后端地址，默认为 localhost:8000
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    
    return [
      // 规则1：新的 v2 接口，保留 /api 前缀
      // /api/v2/upload/config -> http://localhost:8000/api/v2/upload/config
      {
        source: '/api/v2/:path*',
        destination: `${backendUrl}/api/v2/:path*`,
      },
      // 规则2：旧接口（tasks等），去掉 /api 前缀
      // /api/tasks -> http://localhost:8000/tasks
      {
        source: '/api/:path*',
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};
module.exports = nextConfig;

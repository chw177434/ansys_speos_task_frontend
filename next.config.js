/** @type {import('next').NextConfig} */
const nextConfig = {
  // 配置 API 代理：将 /api/* 请求代理到后端服务器
  async rewrites() {
    // 从环境变量读取后端地址，默认为 localhost:8000
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`, // 保留 /api 前缀
      },
    ];
  },
};
module.exports = nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 配置 API 代理：将 /api/* 请求代理到后端服务器
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/:path*', // 后端服务器地址
      },
    ];
  },
};
module.exports = nextConfig;

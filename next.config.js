/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 支持Electron环境
  // 注意：standalone模式需要特殊处理，如果遇到问题可以改为默认模式
  // output: 'standalone',
  // 禁用图片优化（Electron环境可能不需要）
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: 'https://finance-erp-platform.onrender.com',
  },
}

module.exports = nextConfig

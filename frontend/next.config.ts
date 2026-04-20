import type { NextConfig } from 'next'

const config: NextConfig = {
  output: 'standalone',
  allowedDevOrigins: ['192.168.0.0/16', '10.0.0.0/8', '172.16.0.0/12'],
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:8000'
    return [
      { source: '/chat', destination: `${backendUrl}/chat` },
    ]
  },
}

export default config

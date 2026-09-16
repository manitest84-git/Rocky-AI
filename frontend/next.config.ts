import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['three'],
  allowedDevOrigins: ['192.168.0.100', '100.125.118.104', 'localhost', '*.local', '192.168.*', '100.*'],
};

export default nextConfig;

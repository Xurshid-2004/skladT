import type { NextConfig } from "next";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

const nextConfig: NextConfig = {
  output: "export", 
  images: { unoptimized: true }, 
  trailingSlash: true, 
};

export default withBundleAnalyzer(nextConfig);

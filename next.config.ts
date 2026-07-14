import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.logo.dev',
      },
      {
        protocol: 'https',
        hostname: 'media.licdn.com',
        pathname: '/dms/image/**',
      },
      {
        protocol: 'https',
        hostname: 'crustdata-media.s3.us-east-2.amazonaws.com',
        pathname: '/person/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.nba.com',
      },
      {
        protocol: 'https',
        hostname: 'ucdavisaggies.com',
        pathname: '/images/**',
      },
      {
        protocol: 'https',
        hostname: 'dxbhsrqyrr690.cloudfront.net',
      },
    ],
  },
};

export default nextConfig;

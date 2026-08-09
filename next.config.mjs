import path from 'path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  basePath: process.env.NEXT_PUBLIC_BASE_PATH,
  webpack: (config) => {
    config.resolve.alias['@'] = path.resolve(process.cwd(), 'src');

    // Ensure SVG files imported as modules return a URL string
    config.module.rules.push({
      test: /\.svg$/i,
      type: 'asset/resource',
    });

    return config;
  },
};

export default nextConfig;

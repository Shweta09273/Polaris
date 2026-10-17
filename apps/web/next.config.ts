import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  transpilePackages: ["@polaris/design-system"],
  reactStrictMode: true,
  webpack: (config, { webpack }) => {
    config.plugins = config.plugins || [];
    config.plugins.push(
      new webpack.DefinePlugin({
        CESIUM_BASE_URL: JSON.stringify("/cesium"),
      }),
    );
    config.resolve.alias = {
      ...config.resolve.alias,
      // Avoid Node canvas optional dep issues
    };
    return config;
  },
  // Serve Cesium static assets from node_modules via rewrite in middleware alternative:
  // we copy on postinstall — see scripts/copy-cesium.mjs
  async rewrites() {
    return [];
  },
};

export default nextConfig;

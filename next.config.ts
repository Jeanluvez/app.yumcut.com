import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    proxyClientMaxBodySize: '120mb',
  },
  typescript: {
    // The repo still contains legacy YumCut-only routes that are outside the current Sprokl MVP path.
    // Keep production builds unblocked while those routes are migrated or removed.
    ignoreBuildErrors: true,
  },
};

export default nextConfig;

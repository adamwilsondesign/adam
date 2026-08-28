import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Sanity CDN imagery (hero images, galleries, OG images).
    remotePatterns: [{ protocol: "https", hostname: "cdn.sanity.io" }],
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "tiktok-live-connector",
    "fluent-ffmpeg",
    "ffmpeg-static",
  ],
};

export default nextConfig;

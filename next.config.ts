import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  serverExternalPackages: ["fluent-ffmpeg", "@ffmpeg-installer/ffmpeg", "@ffprobe-installer/ffprobe"],
};

export default nextConfig;

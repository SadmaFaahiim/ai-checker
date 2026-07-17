import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These packages resolve their native/platform binary paths with dynamic
  // require() calls that Turbopack/webpack can't statically analyze — keep
  // them external so Node resolves them normally at runtime instead.
  serverExternalPackages: ["fluent-ffmpeg", "@ffmpeg-installer/ffmpeg"],
};

export default nextConfig;

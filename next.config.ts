import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  serverExternalPackages: ["fluent-ffmpeg", "@ffmpeg-installer/ffmpeg", "@ffprobe-installer/ffprobe"],
  // Upload source maps to Sentry when enabled (TASKS.md O2).
  // The token comes from the CI environment (SENTRY_AUTH_TOKEN); the build
  // proceeds normally when it is absent — sourcemaps are just not uploaded.
  ...(process.env.SENTRY_AUTH_TOKEN
    ? {
        Sentry: {
          disableServerWebpackPlugin: false,
          disableClientWebpackPlugin: false,
        },
    }
    : {}),
};

export default nextConfig;

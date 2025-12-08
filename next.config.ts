import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Suppress baseline-browser-mapping warnings by setting logLevel
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
};

export default nextConfig;

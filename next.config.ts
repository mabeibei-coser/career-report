import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "mammoth", "puppeteer", "puppeteer-core", "better-sqlite3"],
};

export default nextConfig;

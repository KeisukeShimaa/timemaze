export default {
  reactStrictMode: true,
  // Static export for GitHub Pages
  output: "export",
  images: { unoptimized: true },
  // Set basePath at build time for project pages like https://<user>.github.io/timemaze
  basePath: process.env.NEXT_BASE_PATH || "",
  assetPrefix: process.env.NEXT_BASE_PATH || "",
};


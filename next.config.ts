import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/generate/pdf": ["./src/assets/fonts/**", "./public/logo.png"],
    "/api/generate/docx": ["./src/assets/fonts/**", "./public/logo.png"],
    "/api/logo": ["./public/logo.png"],
    "/api/logo/reset": ["./public/logo.png"],
    "/api/settings": ["./public/logo.png"],
    "/settings": ["./public/logo.png"]
  },
  serverExternalPackages: ["@react-pdf/renderer", "@react-pdf/font", "pdfkit", "fontkit", "sharp"]
};

export default nextConfig;

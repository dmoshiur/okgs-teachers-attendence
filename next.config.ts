import type { NextConfig } from "next";

/**
 * Files that must ship inside the serverless function bundle.
 *
 * `@react-pdf/renderer` is externalised (see serverExternalPackages), so it is
 * loaded from node_modules at runtime. Its `pdfkit` dependency requires its
 * standard-font modules with a computed path, which the file tracer cannot see,
 * so those files have to be listed explicitly or every PDF render throws
 * "Cannot find module .../pdfkit/js/standard-fonts/Helvetica.cjs".
 */
const FONT_FILES = "./src/assets/fonts/**";
const DEFAULT_LOGO = "./public/logo.png";
const PDFKIT_FILES = "./node_modules/pdfkit/**";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/generate/pdf": [FONT_FILES, DEFAULT_LOGO, PDFKIT_FILES],
    "/api/generate/docx": [FONT_FILES, DEFAULT_LOGO],
    "/api/logo": [DEFAULT_LOGO],
    "/api/logo/reset": [DEFAULT_LOGO],
    "/api/settings": [DEFAULT_LOGO],
    "/settings": [DEFAULT_LOGO]
  },
  serverExternalPackages: ["sharp", "@react-pdf/renderer"]
};

export default nextConfig;

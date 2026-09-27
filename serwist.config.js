// @ts-check
import { serwist } from "@serwist/next/config";

export default serwist({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  globDirectory: ".",
  globPatterns: [
    "public/**/*.{png,svg,ico,json,webmanifest}",
    ".next/static/**/*.{js,css,woff2,png,svg,ico,json}",
  ],
  globIgnores: [
    "**/node_modules/**",
    ".next/server/**",
    ".next/cache/**",
    ".next/**/*.map",
  ],
  modifyURLPrefix: {
    "public/": "/",
    ".next/": "/_next/",
  },
});
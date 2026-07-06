import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/ModPlayer/",
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 4096,
  },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      // we ship our own manifest.webmanifest from public/
      manifest: false,
      workbox: {
        // precache everything the app can ever need: app shell, worklets,
        // soundfont, demo tracks — so the installed app is fully offline
        globPatterns: ["**/*.{js,css,html,png,svg,webmanifest,sf3,mod,xm,s3m,it,mid,json}"],
        maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "google-fonts-css" },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-files",
              expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});

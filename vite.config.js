import { defineConfig } from 'vite';

// Preview-server settings shared by `vite dev` and `vite preview`.
// `preview` is what gets served to the browser in sandboxed/preview environments, so it must
// bind all interfaces, accept the proxied preview Host header, and compress the bundle
// (734 kB raw -> ~194 kB gzipped) since that path is what a remote browser downloads.
const serve = {
  host: '0.0.0.0',
  port: 5173,
  strictPort: true,
  allowedHosts: true,
  cors: true,
};

export default defineConfig({
  server: serve,
  preview: { ...serve, compress: true },
  build: { target: 'esnext', chunkSizeWarningLimit: 2000 },
});

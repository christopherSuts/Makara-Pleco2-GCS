/**
 * Electron main process for Pleco2 GCS.
 *
 * Serves the Next.js static export (`out/`) over a local HTTP server
 * on http://127.0.0.1:<port>, then loads that URL in a BrowserWindow.
 *
 * Using HTTP (not file://) ensures:
 *   - Absolute asset paths work correctly
 *   - Client-side routing works
 *   - ws:// connections are allowed (no mixed-content block)
 */

const { app, BrowserWindow, session } = require("electron");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

// Determine the path to the static export
const OUT_DIR = path.join(__dirname, "..", "out");

// MIME types for common static files
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".webp": "image/webp",
  ".webm": "video/webm",
  ".mp4": "video/mp4",
  ".txt": "text/plain; charset=utf-8",
};

function getMime(filePath) {
  return MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

/**
 * Minimal static file server for the `out/` directory.
 * Supports Next.js static-export conventions (trailing-slash → index.html).
 */
function createStaticServer() {
  return http.createServer((req, res) => {
    const parsed = new URL(req.url, "http://localhost");
    let pathname = decodeURIComponent(parsed.pathname);

    // Security: prevent path traversal
    const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
    let filePath = path.join(OUT_DIR, safePath);

    // If directory, try index.html
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    // If no extension and not found, try .html (Next.js page convention)
    if (!fs.existsSync(filePath) && !path.extname(filePath)) {
      const withHtml = filePath + ".html";
      if (fs.existsSync(withHtml)) filePath = withHtml;
    }

    // Fallback to index.html for client-side routing
    if (!fs.existsSync(filePath)) {
      filePath = path.join(OUT_DIR, "index.html");
    }

    try {
      const data = fs.readFileSync(filePath);
      res.writeHead(200, { "Content-Type": getMime(filePath) });
      res.end(data);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    }
  });
}

let mainWindow = null;
let server = null;

app.whenReady().then(() => {
  // Start local HTTP server on a random available port
  server = createStaticServer();
  server.listen(0, "127.0.0.1", () => {
    const port = server.address().port;
    const origin = `http://127.0.0.1:${port}`;
    console.log(`Static server running at ${origin}`);

    mainWindow = new BrowserWindow({
      width: 1440,
      height: 900,
      title: "Pleco2 GCS",
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    mainWindow.loadURL(origin);

    mainWindow.on("closed", () => {
      mainWindow = null;
    });
  });
});

app.on("window-all-closed", () => {
  if (server) server.close();
  app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0 && server) {
    const port = server.address().port;
    mainWindow = new BrowserWindow({
      width: 1440,
      height: 900,
      title: "Pleco2 GCS",
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    mainWindow.loadURL(`http://127.0.0.1:${port}`);
  }
});

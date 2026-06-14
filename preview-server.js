const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const host = "127.0.0.1";
const port = 4173;
const root = __dirname;

const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp"
};

http
  .createServer((request, response) => {
    const requestedPath = request.url === "/" ? "/index.html" : decodeURIComponent(request.url.split("?")[0]);
    const relativePath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
    const filePath = path.join(root, relativePath);

    if (!filePath.startsWith(root)) {
      response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (error, file) => {
      if (error) {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }

      response.writeHead(200, {
        "Content-Type": types[path.extname(filePath).toLowerCase()] || "application/octet-stream"
      });
      response.end(file);
    });
  })
  .listen(port, host, () => {
    console.log(`Preview server running on http://${host}:${port}`);
  });

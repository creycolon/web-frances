#!/usr/bin/env node
// Servidor estático minimalista con soporte de Range (para buscar en los audios).
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = parseInt(process.env.PORT || "8080", 10);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
};

function mimeFor(p) {
  return MIME[path.extname(p).toLowerCase()] || "application/octet-stream";
}

// HTML/JS/CSS/JSON cambian con frecuencia: nunca cachear.
// Imágenes y audio son estáticos: cachear para no recargar archivos grandes.
function cacheControlFor(p) {
  if (/\.(html?|js|css|json)$/i.test(p)) return "no-cache, no-store, must-revalidate";
  return "public, max-age=3600";
}

function send404(res) {
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("404 Not Found");
}

function sendFile(req, res, filePath) {
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) return send404(res);

    const type = mimeFor(filePath);
    const cacheControl = cacheControlFor(filePath);
    const size = stat.size;
    const range = req.headers.range;

    if (range) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (m) {
        let start = m[1] === "" ? 0 : parseInt(m[1], 10);
        let end = m[2] === "" ? size - 1 : parseInt(m[2], 10);
        if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= size) {
          res.writeHead(416, { "Content-Range": `bytes */${size}` });
          return res.end();
        }
        const chunkSize = end - start + 1;
        res.writeHead(206, {
          "Content-Type": type,
          "Content-Length": chunkSize,
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": cacheControl,
        });
        const stream = fs.createReadStream(filePath, { start, end });
        stream.on("error", () => send404(res));
        stream.pipe(res);
        return;
      }
    }

    res.writeHead(200, {
      "Content-Type": type,
      "Content-Length": size,
      "Accept-Ranges": "bytes",
      "Cache-Control": cacheControl,
    });
    const stream = fs.createReadStream(filePath);
    stream.on("error", () => send404(res));
    stream.pipe(res);
  });
}

http
  .createServer((req, res) => {
    // Normaliza la URL y evita path traversal
    let urlPath;
    try {
      urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    } catch {
      return send404(res);
    }
    if (urlPath === "/") urlPath = "/index.html";
    const filePath = path.normalize(path.join(ROOT, urlPath));
    if (!filePath.startsWith(ROOT)) return send404(res);
    sendFile(req, res, filePath);
  })
  .listen(PORT, () => {
    console.log(`Édito A1 disponible en http://localhost:${PORT}`);
  });

import app from "../server/app.js";

// Vercel may pass the original /api/... path, or strip the /api prefix when
// rewriting into this function. Express is mounted at /api, so restore it.
export default function handler(req, res) {
  if (typeof req.url === "string" && !req.url.startsWith("/api")) {
    req.url = `/api${req.url.startsWith("/") ? req.url : `/${req.url}`}`;
  }

  return app(req, res);
}

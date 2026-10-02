import { timingSafeEqual } from "node:crypto";
import { Router } from "express";

const router = Router();

function isFromCoinflow(authHeader) {
  const key = process.env.COINFLOW_WEBHOOK_KEY;
  if (!key || typeof authHeader !== "string") return false;

  const expected = Buffer.from(key);
  const received = Buffer.from(authHeader);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

// Coinflow sends the Validation Key from Developers → Webhooks as the
// Authorization header, retries any non-200 for ~18h, and times out after 5s.
router.post("/", (req, res) => {
  if (!process.env.COINFLOW_WEBHOOK_KEY) {
    console.error("Coinflow webhook received but COINFLOW_WEBHOOK_KEY is not set");
    return res.sendStatus(500);
  }
  if (!isFromCoinflow(req.get("Authorization"))) {
    console.warn("Rejected a webhook with a missing or wrong Authorization header");
    return res.sendStatus(401);
  }

  const { eventType, category, created, data } = req.body ?? {};
  console.log(
    `Coinflow webhook: ${category ?? "?"}/${eventType ?? "?"} at ${created ?? "?"}`,
    JSON.stringify(data)
  );

  res.sendStatus(200);
});

export default router;

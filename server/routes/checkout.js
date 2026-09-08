import { Router } from "express";

const router = Router();

const PROCESSING_DELAY_MS = 1200;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

router.post("/", async (req, res) => {
  const { name, email } = req.body ?? {};

  if (!name || !email) {
    return res.status(400).json({ success: false, error: "name and email are required" });
  }

  // Phase 2: this is where the Coinflow charge is verified before an order is
  // recorded. Nothing here touches card data, and nothing real is charged.
  await delay(PROCESSING_DELAY_MS);

  res.json({
    success: true,
    orderId: "demo_12345",
    name,
    email,
  });
});

export default router;

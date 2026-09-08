import { randomUUID } from "node:crypto";
import { Router } from "express";
import { PRODUCT } from "../catalog.js";

const router = Router();
const orders = new Map();

// Called after <CoinflowPurchase> reports success. The charge already happened;
// this only records a local order id.
router.post("/", (req, res) => {
  const { paymentId, name, email } = req.body ?? {};

  if (!paymentId) {
    return res.status(400).json({ success: false, error: "paymentId is required" });
  }

  const orderId = `order_${randomUUID().slice(0, 8)}`;
  const order = {
    orderId,
    paymentId,
    name,
    email,
    productId: PRODUCT.id,
    amount: { cents: PRODUCT.priceCents, currency: PRODUCT.currency },
    createdAt: new Date().toISOString(),
  };

  orders.set(orderId, order);
  console.log(`Recorded ${orderId} for Coinflow payment ${paymentId}`);
  res.json({ success: true, ...order });
});

export default router;

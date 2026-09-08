import { Router } from "express";
import { PRODUCT, cartForChargebackProtection, centsFromRequest } from "../catalog.js";
import {
  coinflowEnv,
  createCheckoutJwt,
  createSessionKey,
  customerIdFor,
} from "../coinflow.js";

const router = Router();

// Public merchant id + env for <CoinflowPurchaseProtection> on every page.
// The API key is not included.
router.get("/config", (req, res) => {
  const merchantId = process.env.COINFLOW_MERCHANT_ID;
  if (!merchantId) {
    return res.status(500).json({ error: "COINFLOW_MERCHANT_ID is not set in server/.env" });
  }
  res.json({ merchantId, env: coinflowEnv() });
});

// Doc step 2, kept as its own endpoint so each step of the guide maps to one
// route you can call and inspect on its own.
router.post("/session-key", async (req, res) => {
  const { email } = req.body ?? {};

  if (!email) {
    return res.status(400).json({ error: "email is required" });
  }

  try {
    const { sessionKey, merchantId } = await createSessionKey(customerIdFor(email));
    res.json({ sessionKey, merchantId, env: coinflowEnv() });
  } catch (error) {
    console.error("Failed to create a Coinflow session key:", error.message);
    res.status(502).json({ error: error.message });
  }
});

// Doc step 3. Kept as its own endpoint so you can call it without also minting
// a session key. The amount is read from catalog.js, not from the request body.
router.post("/jwt-token", async (req, res) => {
  const { email, cents: requestedCents } = req.body ?? {};

  if (!email) {
    return res.status(400).json({ error: "email is required" });
  }

  let cents;
  try {
    cents = centsFromRequest(requestedCents);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  const subtotal = { cents, currency: PRODUCT.currency };
  const chargebackProtectionData = cartForChargebackProtection(cents);
  const webhookInfo = { itemName: PRODUCT.name, price: String(cents / 100) };

  try {
    const jwtToken = await createCheckoutJwt({
      ...subtotal,
      email,
      webhookInfo,
      chargebackProtectionData,
    });

    res.json({ jwtToken, subtotal, webhookInfo, chargebackProtectionData });
  } catch (error) {
    console.error("Failed to create a Coinflow checkout JWT:", error.message);
    res.status(502).json({ error: error.message });
  }
});

export default router;

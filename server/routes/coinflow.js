import { Router } from "express";
import { PRODUCT, cartForChargebackProtection } from "../catalog.js";
import {
  coinflowEnv,
  createCheckoutJwt,
  createSessionKey,
  customerIdFor,
} from "../coinflow.js";

const router = Router();

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
  const { email } = req.body ?? {};

  if (!email) {
    return res.status(400).json({ error: "email is required" });
  }

  const subtotal = { cents: PRODUCT.priceCents, currency: PRODUCT.currency };
  const chargebackProtectionData = cartForChargebackProtection();
  const webhookInfo = { itemName: PRODUCT.name, price: String(PRODUCT.priceCents / 100) };

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

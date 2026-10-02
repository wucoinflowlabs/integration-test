import { randomUUID } from "node:crypto";
import { Router } from "express";
import { PRODUCT, cartForChargebackProtection, centsFromRequest } from "../catalog.js";
import {
  addWithdrawBankAccount,
  bankAccountFromRequest,
  coinflowEnv,
  createCheckoutJwt,
  createCheckoutLink,
  createSessionKey,
  customerIdFor,
  getWithdrawer,
  getWithdrawQuote,
  initiateDelegatedPayout,
  kycInfoFromRequest,
  payoutSpeedFromRequest,
  verifyWithdrawerKyc,
} from "../coinflow.js";

const router = Router();

function merchantIdFrom(body) {
  const value = body?.merchantId;
  if (value == null || value === "") return undefined;
  if (typeof value !== "string") {
    const error = new Error("merchantId must be a string");
    error.status = 400;
    throw error;
  }
  return value.trim();
}

function sendCoinflowError(res, error, logLabel) {
  console.error(logLabel, error.message);
  res.status(error.status === 400 ? 400 : 502).json({ error: error.message });
}

// Public merchant id + env for <CoinflowPurchaseProtection> on every page.
// The API key is not included.
router.get("/config", (req, res) => {
  const merchantId = process.env.COINFLOW_MERCHANT_ID;
  if (!merchantId) {
    return res.status(500).json({ error: "COINFLOW_MERCHANT_ID is not set" });
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

  let merchantId;
  try {
    merchantId = merchantIdFrom(req.body);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  try {
    const session = await createSessionKey(customerIdFor(email), merchantId);
    res.json({ sessionKey: session.sessionKey, merchantId: session.merchantId, env: coinflowEnv() });
  } catch (error) {
    sendCoinflowError(res, error, "Failed to create a Coinflow session key:");
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
  let merchantId;
  try {
    cents = centsFromRequest(requestedCents);
    merchantId = merchantIdFrom(req.body);
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
      merchantId,
      webhookInfo,
      chargebackProtectionData,
    });

    res.json({ jwtToken, subtotal, webhookInfo, chargebackProtectionData });
  } catch (error) {
    sendCoinflowError(res, error, "Failed to create a Coinflow checkout JWT:");
  }
});

// Checkout-link guide step 1. Same cart/amount rules as /jwt-token; the
// response is a hosted URL instead of a JWT.
router.post("/checkout-link", async (req, res) => {
  const { email, cents: requestedCents } = req.body ?? {};

  if (!email) {
    return res.status(400).json({ error: "email is required" });
  }

  let cents;
  let merchantId;
  try {
    cents = centsFromRequest(requestedCents);
    merchantId = merchantIdFrom(req.body);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  const subtotal = { cents, currency: PRODUCT.currency };
  const chargebackProtectionData = cartForChargebackProtection(cents);
  const webhookInfo = { itemName: PRODUCT.name, price: String(cents / 100) };

  try {
    const link = await createCheckoutLink({
      userId: customerIdFor(email),
      ...subtotal,
      email,
      merchantId,
      webhookInfo,
      chargebackProtectionData,
    });

    res.json({ link, subtotal, webhookInfo, chargebackProtectionData });
  } catch (error) {
    sendCoinflowError(res, error, "Failed to create a Coinflow checkout link:");
  }
});

// Payouts guide step 1. Always 200 from this server: Coinflow's 451 (more
// verification needed) is returned as needsVerification + verificationLink.
router.post("/withdraw/kyc", async (req, res) => {
  let info;
  try {
    info = kycInfoFromRequest(req.body);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  const userId = customerIdFor(info.email);
  const redirectLink =
    typeof req.body?.redirectLink === "string" && req.body.redirectLink.trim()
      ? req.body.redirectLink.trim()
      : undefined;

  try {
    const result = await verifyWithdrawerKyc({ userId, info, redirectLink });
    res.json({ userId, email: info.email, ...result });
  } catch (error) {
    console.error("Failed to verify the Coinflow withdrawer:", error.message);
    res.status(502).json({ error: error.message });
  }
});

router.get("/withdraw", async (req, res) => {
  const email = typeof req.query.email === "string" ? req.query.email.trim() : "";
  if (!email) {
    return res.status(400).json({ error: "email is required" });
  }

  try {
    const userId = customerIdFor(email);
    const result = await getWithdrawer(userId);
    res.json({ userId, email: email.toLowerCase(), ...result });
  } catch (error) {
    console.error("Failed to load the Coinflow withdrawer:", error.message);
    res.status(502).json({ error: error.message });
  }
});

// Payouts guide step 3. US bank account. Requires an approved withdrawer.
router.post("/withdraw/account", async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "email is required" });
  }

  let account;
  try {
    account = bankAccountFromRequest(req.body);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  const userId = customerIdFor(email);

  try {
    const current = await getWithdrawer(userId);
    if (current.withdrawer?.verification?.status !== "approved") {
      return res.status(409).json({
        error: "Withdrawer must be approved before adding a destination",
        userId,
        email,
        ...current,
      });
    }

    const result = await addWithdrawBankAccount({ userId, account });
    res.json({ userId, email, ...result });
  } catch (error) {
    console.error("Failed to add a Coinflow payout destination:", error.message);
    if (error.message.includes("does not have permission to create bank accounts")) {
      return res.status(403).json({
        error:
          "This merchant cannot create bank accounts through the API. Use Coinflow’s bank authentication UI, or ask Coinflow to enable that permission.",
      });
    }
    res.status(502).json({ error: error.message });
  }
});

const DEFAULT_PAYOUT_CENTS = 2500;

// Payouts guide step 4. Delegated quote: API key + userId + destination token + cents.
router.get("/withdraw/quote", async (req, res) => {
  const email = typeof req.query.email === "string" ? req.query.email.trim() : "";
  if (!email) {
    return res.status(400).json({ error: "email is required" });
  }

  let cents;
  try {
    cents = centsFromRequest(req.query.cents === undefined ? DEFAULT_PAYOUT_CENTS : Number(req.query.cents));
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  const userId = customerIdFor(email);
  let accountToken = typeof req.query.accountToken === "string" ? req.query.accountToken.trim() : "";

  try {
    if (!accountToken) {
      const current = await getWithdrawer(userId);
      accountToken = current.withdrawer?.bankAccounts?.[0]?.token ?? "";
    }
    if (!accountToken) {
      return res.status(400).json({ error: "Save a payout destination before requesting a quote" });
    }

    const quote = await getWithdrawQuote({ userId, cents, accountToken });
    res.json({ userId, email: email.toLowerCase(), cents, ...quote });
  } catch (error) {
    console.error("Failed to get a Coinflow payout quote:", error.message);
    res.status(502).json({ error: error.message });
  }
});

// Payouts guide step 5. Debits the Coinflow wallet. Idempotency key stays here.
router.post("/withdraw/payout", async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "email is required" });
  }

  if (req.body?.cents === undefined || req.body?.cents === null || req.body?.cents === "") {
    return res.status(400).json({ error: "cents is required" });
  }

  let cents;
  let speed;
  try {
    cents = centsFromRequest(req.body.cents);
    speed = payoutSpeedFromRequest(req.body?.speed);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  const userId = customerIdFor(email);
  let accountToken = typeof req.body?.accountToken === "string" ? req.body.accountToken.trim() : "";

  try {
    const current = await getWithdrawer(userId);
    if (current.withdrawer?.verification?.status !== "approved") {
      return res.status(409).json({ error: "Withdrawer must be approved before paying out" });
    }

    const saved = current.withdrawer?.bankAccounts ?? [];
    if (accountToken && !saved.some((account) => account.token === accountToken)) {
      return res.status(400).json({ error: "accountToken does not belong to this withdrawer" });
    }
    if (!accountToken) {
      accountToken = saved[0]?.token ?? "";
    }
    if (!accountToken) {
      return res.status(400).json({ error: "Save a payout destination before sending a payout" });
    }

    const result = await initiateDelegatedPayout({
      userId,
      cents,
      accountToken,
      speed,
      idempotencyKey: randomUUID(),
    });

    res.json({
      userId,
      email,
      cents,
      speed,
      effectiveSpeed: result.effectiveSpeed,
      signature: result.signature,
    });
  } catch (error) {
    console.error("Failed to initiate a Coinflow payout:", error.message);
    res.status(502).json({ error: error.message });
  }
});

export default router;

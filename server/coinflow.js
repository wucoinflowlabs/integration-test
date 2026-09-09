import { createHash } from "node:crypto";

const BASE_URLS = {
  sandbox: "https://api-sandbox.coinflow.cash",
  prod: "https://api.coinflow.cash",
};

export function coinflowEnv() {
  return process.env.COINFLOW_ENV === "prod" ? "prod" : "sandbox";
}

function apiKey() {
  const key = process.env.COINFLOW_API_KEY;
  if (!key) {
    throw new Error("COINFLOW_API_KEY is not set in server/.env");
  }
  return key;
}

// Server-to-server calls authenticate with the merchant API key in the
// Authorization header. This is the header the guide's curl example omits.
async function coinflowRequest(path, { headers, ...options } = {}) {
  const res = await fetch(`${BASE_URLS[coinflowEnv()]}${path}`, {
    ...options,
    headers: { Authorization: apiKey(), accept: "application/json", ...headers },
  });

  const raw = await res.text();
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    body = raw;
  }

  if (!res.ok) {
    const detail = typeof body === "string" ? body : JSON.stringify(body);
    throw new Error(`Coinflow ${path} responded ${res.status}: ${detail}`);
  }

  return body;
}

function decodeJwtPayload(jwt) {
  try {
    return JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString());
  } catch {
    return null;
  }
}

// x-coinflow-auth-user-id is our own identifier for the buyer, not the API key.
// Hashing the email keeps the address out of the identifier while staying
// stable, so a returning buyer maps to the same Coinflow customer.
export function customerIdFor(email) {
  const digest = createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
  return `demo_${digest.slice(0, 24)}`;
}

// Doc step 2. Returns a JWT authorizing one payer, valid for 24 hours.
export async function createSessionKey(userId) {
  const { key } = await coinflowRequest("/api/auth/session-key", {
    headers: { "x-coinflow-auth-user-id": userId },
  });

  // The session key encodes which merchant the API key belongs to, so we can
  // report it rather than depending on a hand-copied merchant ID.
  return { sessionKey: key, merchantId: decodeJwtPayload(key)?.merchantId ?? null };
}

// Doc step 3. Coinflow signs the cart so the browser cannot change the amount
// or the chargeback-protection items. The API key stays on this server.
export async function createCheckoutJwt({
  cents,
  currency,
  email,
  webhookInfo,
  chargebackProtectionData,
}) {
  const { checkoutJwtToken } = await coinflowRequest("/api/checkout/jwt-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subtotal: { cents, currency },
      email,
      webhookInfo,
      chargebackProtectionData,
    }),
  });

  return checkoutJwtToken;
}

// Checkout-link guide step 1. Coinflow returns a hosted checkout URL for this
// customer and cart. Same auth as session-key: API key + our customer id.
export async function createCheckoutLink({
  userId,
  cents,
  currency,
  email,
  webhookInfo,
  chargebackProtectionData,
}) {
  const { link } = await coinflowRequest("/api/checkout/link", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-coinflow-auth-user-id": userId,
    },
    body: JSON.stringify({
      subtotal: { cents, currency },
      email,
      webhookInfo,
      chargebackProtectionData,
    }),
  });

  return link;
}

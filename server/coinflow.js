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
    throw new Error("COINFLOW_API_KEY is not set");
  }
  return key;
}

// Server-to-server calls authenticate with the merchant API key in the
// Authorization header. This is the header the guide's curl example omits.
async function coinflowFetch(path, { headers, ...options } = {}) {
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

  return { status: res.status, body };
}

async function coinflowRequest(path, options = {}) {
  const { status, body } = await coinflowFetch(path, options);
  if (status < 200 || status >= 300) {
    const detail = typeof body === "string" ? body : JSON.stringify(body);
    throw new Error(`Coinflow ${path} responded ${status}: ${detail}`);
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

const KYC_STRING_FIELDS = [
  "email",
  "firstName",
  "surName",
  "physicalAddress",
  "city",
  "state",
  "zip",
  "country",
  "dob",
  "ssn",
];

function requireTrimmed(value, field) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    throw new Error(`${field} is required`);
  }
  return text;
}

function normalizeDob(value) {
  const raw = requireTrimmed(value, "dob");
  if (/^\d{8}$/.test(raw)) return raw;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}${iso[2]}${iso[3]}`;
  throw new Error("dob must be YYYYMMDD or YYYY-MM-DD");
}

function normalizeSsn(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 4) return digits;
  if (digits.length === 9) return digits.slice(-4);
  throw new Error("ssn must be the last 4 digits (or a 9-digit SSN)");
}

// Payouts guide step 1. US withdrawers send the full info object; Coinflow
// wants DOB as YYYYMMDD and only the last 4 of the SSN.
export function kycInfoFromRequest(body) {
  const source = body?.info && typeof body.info === "object" ? body.info : body ?? {};
  const info = {};

  for (const field of KYC_STRING_FIELDS) {
    if (field === "dob") {
      info.dob = normalizeDob(source.dob);
    } else if (field === "ssn") {
      info.ssn = normalizeSsn(source.ssn);
    } else if (field === "country") {
      info.country = requireTrimmed(source.country ?? "US", "country").toUpperCase();
    } else if (field === "state") {
      info.state = requireTrimmed(source.state, "state").toUpperCase();
    } else if (field === "email") {
      info.email = requireTrimmed(source.email, "email").toLowerCase();
    } else {
      info[field] = requireTrimmed(source[field], field);
    }
  }

  if (info.country !== "US") {
    throw new Error("This demo implements US KYC. Non-US withdrawers send email and country only.");
  }

  if (!info.email.includes("@")) {
    throw new Error("email must be a valid address");
  }

  return info;
}

function summarizeBankAccounts(accounts) {
  if (!Array.isArray(accounts)) return [];
  return accounts
    .filter((account) => !account?.isDeleted)
    .map((account) => ({
      alias: account.alias ?? null,
      last4: account.last4 ?? null,
      token: account.token ?? null,
      routingNumber: account.routingNumber ?? null,
      rtpEligible: Boolean(account.rtpEligible),
    }));
}

function summarizeKycResult(body, extraVerificationRequired) {
  const withdrawer = body?.withdrawer ?? null;
  const verification = withdrawer?.verification ?? body?.verification ?? null;
  const verificationLink = body?.verificationLink ?? null;

  return {
    needsVerification: Boolean(extraVerificationRequired || verificationLink),
    verificationLink,
    redirectLink: body?.redirectLink ?? null,
    rejectionReasons: body?.rejectionReasons ?? verification?.rejectionReasons ?? [],
    withdrawer: withdrawer
      ? {
          id: withdrawer._id ?? null,
          email: withdrawer.email ?? null,
          country: withdrawer.country ?? null,
          currency: withdrawer.currency ?? null,
          verification: verification
            ? {
                status: verification.status ?? null,
                vendor: verification.vendor ?? null,
                rejectionReasons: verification.rejectionReasons ?? [],
              }
            : null,
          availability: withdrawer.availability
            ? {
                status: withdrawer.availability.status ?? null,
                reason: withdrawer.availability.reason ?? null,
              }
            : null,
          bankAccounts: summarizeBankAccounts(withdrawer.bankAccounts),
        }
      : null,
  };
}

function throwIfCoinflowFailed(path, status, body) {
  if (status === 200 || status === 451) return;
  const detail = typeof body === "string" ? body : JSON.stringify(body);
  throw new Error(`Coinflow ${path} responded ${status}: ${detail}`);
}

// Payouts guide step 1. Coinflow creates (or reuses) a withdrawer and starts
// identity verification. 451 means the user still has to finish a hosted check.
export async function verifyWithdrawerKyc({ userId, info, redirectLink }) {
  const payload = { info };
  const merchantId = process.env.COINFLOW_MERCHANT_ID;
  if (merchantId) payload.merchantId = merchantId;
  if (redirectLink) payload.redirectLink = redirectLink;

  const { status, body } = await coinflowFetch("/api/withdraw/kyc", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-coinflow-auth-user-id": userId,
    },
    body: JSON.stringify(payload),
  });

  throwIfCoinflowFailed("/api/withdraw/kyc", status, body);
  return summarizeKycResult(body, status === 451);
}

// Used after a 451 so the UI can poll until verification.status is approved.
export async function getWithdrawer(userId) {
  const { status, body } = await coinflowFetch("/api/withdraw", {
    headers: { "x-coinflow-auth-user-id": userId },
  });

  throwIfCoinflowFailed("/api/withdraw", status, body);
  return summarizeKycResult(body, status === 451);
}

// Payouts guide step 3. US ACH/RTP destination. Coinflow returns a token used
// later for quote and payout; we never send the full account number back.
export function bankAccountFromRequest(body) {
  const alias = requireTrimmed(body?.alias, "alias");
  const routingNumber = requireTrimmed(body?.routingNumber, "routingNumber").replace(/\D/g, "");
  const accountNumber = requireTrimmed(body?.accountNumber, "accountNumber").replace(/\D/g, "");
  const type = requireTrimmed(body?.type ?? "checking", "type").toLowerCase();

  if (!/^\d{9}$/.test(routingNumber)) {
    throw new Error("routingNumber must be 9 digits");
  }
  if (!/^\d{4,17}$/.test(accountNumber)) {
    throw new Error("accountNumber must be 4–17 digits");
  }
  if (type !== "checking" && type !== "savings") {
    throw new Error("type must be checking or savings");
  }

  return { alias, routingNumber, accountNumber, type };
}

export async function addWithdrawBankAccount({ userId, account }) {
  const body = await coinflowRequest("/api/withdraw/account", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-coinflow-auth-user-id": userId,
    },
    body: JSON.stringify(account),
  });

  return summarizeKycResult(body, false);
}

const QUOTE_SPEEDS = [
  "asap",
  "same_day",
  "standard",
  "card",
  "iban",
  "pix",
  "eft",
  "venmo",
  "paypal",
  "wire",
  "interac",
  "swift",
];

function moneyFrom(value) {
  if (!value || typeof value !== "object" || value.cents == null) return null;
  return { cents: value.cents, currency: value.currency ?? "USD" };
}

function summarizeQuote(body) {
  return {
    quote: moneyFrom(body?.quote),
    totalMerchantDebit: moneyFrom(body?.totalMerchantDebit),
    userPayout: moneyFrom(body?.userPayout),
    merchantFees: moneyFrom(body?.merchantFees),
    options: QUOTE_SPEEDS.flatMap((speed) => {
      const option = body?.[speed];
      if (!option || typeof option !== "object") return [];
      return [
        {
          speed,
          fee: moneyFrom(option.fee),
          limit: moneyFrom(option.limit),
          finalSettlement: moneyFrom(option.finalSettlement),
          expectedDeliveryDate: option.expectedDeliveryDate ?? null,
          expectedDeliveryDateISO: option.expectedDeliveryDateISO ?? null,
          customFee: option.customFee
            ? { ...moneyFrom(option.customFee), label: option.customFee.label ?? null }
            : null,
          accountIneligible: Boolean(option.accountIneligible),
        },
      ];
    }),
  };
}

// Payouts guide step 4, via the merchant delegated quote (same family as Step 5).
// GET /withdraw/quote is the wallet/crypto variant and requires a web3 wallet header.
export async function getWithdrawQuote({ userId, cents, accountToken }) {
  if (!accountToken) {
    throw new Error("accountToken is required");
  }

  const body = await coinflowRequest("/api/merchant/withdraws/payout/delegated/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      speed: "standard",
      account: accountToken,
      userId,
      amount: { cents, currency: "USD" },
    }),
  });

  return summarizeQuote(body);
}

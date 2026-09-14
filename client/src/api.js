async function request(path, options) {
  const res = await fetch(path, options);
  const body = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(body?.error || `Request to ${path} failed (${res.status})`);
  }

  return body;
}

function postJson(path, payload) {
  return request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function fetchProduct() {
  return request("/api/product");
}

export function fetchCoinflowConfig() {
  return request("/api/coinflow/config");
}

// Doc step 2
export function fetchSessionKey(email) {
  return postJson("/api/coinflow/session-key", { email });
}

// Doc step 3
export function fetchJwtToken(email, cents) {
  return postJson("/api/coinflow/jwt-token", { email, cents });
}

export function fetchCheckoutLink(email, cents) {
  return postJson("/api/coinflow/checkout-link", { email, cents });
}

// Payouts guide step 1
export function submitWithdrawKyc(info) {
  return postJson("/api/coinflow/withdraw/kyc", info);
}

export function fetchWithdrawer(email) {
  return request(`/api/coinflow/withdraw?email=${encodeURIComponent(email)}`);
}

// Payouts guide step 3
export function submitWithdrawAccount(account) {
  return postJson("/api/coinflow/withdraw/account", account);
}

// Payouts guide step 4
export function fetchWithdrawQuote({ email, cents, accountToken }) {
  const params = new URLSearchParams({ email });
  if (cents != null) params.set("cents", String(cents));
  if (accountToken) params.set("accountToken", accountToken);
  return request(`/api/coinflow/withdraw/quote?${params}`);
}

// After Coinflow reports a successful charge
export function recordOrder({ paymentId, name, email, cents }) {
  return postJson("/api/checkout", { paymentId, name, email, cents });
}

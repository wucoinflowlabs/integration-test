async function request(path, options) {
  const res = await fetch(path, options);
  const body = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(body?.error || `Request to ${path} failed (${res.status})`);
  }

  return body;
}

export function fetchProduct() {
  return request("/api/product");
}

export function submitCheckout({ name, email }) {
  return request("/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email }),
  });
}

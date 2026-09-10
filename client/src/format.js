export function formatMoney(amount, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

export function formatCents(cents, currency = "USD") {
  return formatMoney(Number(cents) / 100, currency);
}

// The price lives here in cents. Step 3 signs this value into the checkout JWT
// so the amount charged never comes from the browser.
export const PRODUCT = {
  id: "sword_001",
  name: "Sword",
  description: "A finely balanced blade. Ships with a complimentary whetstone.",
  priceCents: 1099,
  currency: "USD",
};

export function productForClient() {
  const { priceCents, ...rest } = PRODUCT;
  return { ...rest, price: priceCents / 100 };
}

// Matches the cart shape in the guide's Step 4 example. Built here so the JWT
// and <CoinflowPurchase> later receive the same itemization.
export function cartForChargebackProtection(cents = PRODUCT.priceCents) {
  return [
    {
      productName: PRODUCT.name,
      productType: "inGameProduct",
      quantity: 1,
      rawProductData: {
        productID: PRODUCT.id,
        productDescription: PRODUCT.description,
        chargedCents: cents,
      },
    },
  ];
}

const MIN_CENTS = 50;
const MAX_CENTS = 1_000_000;

// The browser may suggest an amount. We still sign it here so Coinflow charges
// only a value this server accepted (positive integer cents, within bounds).
export function centsFromRequest(value) {
  if (value === undefined || value === null || value === "") {
    return PRODUCT.priceCents;
  }

  const cents = Number(value);
  if (!Number.isInteger(cents) || cents < MIN_CENTS || cents > MAX_CENTS) {
    throw new Error(`cents must be an integer between ${MIN_CENTS} and ${MAX_CENTS}`);
  }

  return cents;
}

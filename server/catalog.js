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
export function cartForChargebackProtection() {
  return [
    {
      productName: PRODUCT.name,
      productType: "inGameProduct",
      quantity: 1,
      rawProductData: {
        productID: PRODUCT.id,
        productDescription: PRODUCT.description,
      },
    },
  ];
}

function formatPrice(price, currency) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(price);
}

export default function Product({ product, onCheckout }) {
  return (
    <section>
      <h2>{product.name}</h2>
      <p className="price">{formatPrice(product.price, product.currency)}</p>
      <p className="muted">{product.description}</p>
      <button type="button" onClick={onCheckout}>
        Checkout
      </button>
    </section>
  );
}

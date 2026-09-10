import { formatMoney } from "../format.js";

function SwordMark() {
  return (
    <svg viewBox="0 0 64 120" aria-hidden="true">
      <path d="M32 8c1.2 8 2 18 2 28v46h-4V36c0-10 .8-20 2-28Z" fill="#f4ead6" />
      <path d="M30 36h4v46h-4Z" fill="#d9c7a4" />
      <rect x="18" y="80" width="28" height="6" rx="1.5" fill="#c4a15a" />
      <rect x="28" y="86" width="8" height="22" rx="2" fill="#6b4a24" />
      <circle cx="32" cy="112" r="5" fill="#c4a15a" />
    </svg>
  );
}

export default function Product({ product, onCheckout }) {
  return (
    <section className="hero">
      <div className="hero-art">
        <SwordMark />
      </div>
      <div>
        <p className="kicker">Limited atelier piece</p>
        <h2>{product.name}</h2>
        <p className="price">{formatMoney(product.price, product.currency)}</p>
        <p className="muted">{product.description}</p>
        <button type="button" onClick={onCheckout}>
          Continue to checkout
        </button>
      </div>
    </section>
  );
}

import { useState } from "react";
import { submitCheckout } from "../api.js";

// This component owns the entire checkout surface. App.jsx only knows about the
// onSuccess(order) and onCancel() callbacks, so phase 2 can replace everything
// below with <CoinflowPurchase> without touching the parent.
export default function Checkout({ product, onSuccess, onCancel }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const order = await submitCheckout({ name, email });
      onSuccess(order);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <section>
      <h2>Checkout</h2>
      <p className="muted">
        Paying for {product.name} ({product.currency} {product.price})
      </p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="name">Name</label>
        <input
          id="name"
          type="text"
          value={name}
          required
          autoComplete="name"
          onChange={(event) => setName(event.target.value)}
        />

        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          required
          autoComplete="email"
          onChange={(event) => setEmail(event.target.value)}
        />

        {error && <p className="error">{error}</p>}

        <div className="actions">
          <button type="submit" disabled={submitting}>
            {submitting ? "Processing..." : "Pay now"}
          </button>
          <button type="button" className="secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
        </div>
      </form>

      <p className="footnote">No card fields, no real payment. Any name and email works.</p>
    </section>
  );
}

import { useRef, useState } from "react";
import { CoinflowPurchase } from "@coinflowlabs/react";
import { fetchJwtToken, fetchSessionKey, recordOrder } from "../api.js";

// Coinflow's onSuccess may pass a string or { paymentId }.
function paymentIdFrom(result) {
  return typeof result === "string" ? result : result?.paymentId;
}

export default function Checkout({ product, onSuccess, onCancel }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState(String(product.price));
  const [tokens, setTokens] = useState(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState(null);
  const settled = useRef(false);

  // Call the two backend steps in parallel, then show <CoinflowPurchase>.
  async function handleDetails(event) {
    event.preventDefault();
    setPreparing(true);
    setError(null);

    const cents = Math.round(Number(amount) * 100);
    if (!Number.isInteger(cents) || cents < 50) {
      setError("Enter an amount of at least $0.50");
      setPreparing(false);
      return;
    }

    try {
      const [session, checkout] = await Promise.all([
        fetchSessionKey(email),
        fetchJwtToken(email, cents),
      ]);
      setTokens({ ...session, ...checkout });
    } catch (err) {
      setError(err.message);
    } finally {
      setPreparing(false);
    }
  }

  async function handlePaid(result) {
    if (settled.current) return;
    settled.current = true;

    const paymentId = paymentIdFrom(result);
    if (!paymentId) {
      settled.current = false;
      setError("Coinflow reported success but returned no payment ID.");
      return;
    }

    try {
      onSuccess(await recordOrder({ paymentId, name, email, cents: tokens.subtotal.cents }));
    } catch (err) {
      settled.current = false;
      setError(`Payment ${paymentId} went through, but recording the order failed: ${err.message}`);
    }
  }

  // Doc step 4: tokens from steps 2 and 3 become props on the hosted card form.
  if (tokens) {
    return (
      <section>
        <h2>Payment</h2>
        <p className="muted">
          Paying {product.currency} {(tokens.subtotal.cents / 100).toFixed(2)} for {product.name} as {email}.
        </p>

        {error && <p className="error">{error}</p>}

        {/* Do not pass handleHeightChange: the SDK then sets scrolling="no" and
            the pay button can be clipped if the height value has no CSS unit. */}
        <div className="coinflow-frame">
          <CoinflowPurchase
            merchantId={tokens.merchantId}
            env={tokens.env}
            sessionKey={tokens.sessionKey}
            jwtToken={tokens.jwtToken}
            subtotal={tokens.subtotal}
            email={email}
            webhookInfo={tokens.webhookInfo}
            chargebackProtectionData={tokens.chargebackProtectionData}
            onSuccess={handlePaid}
          />
        </div>

        <button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </button>

        {tokens.env === "sandbox" && (
          <p className="footnote">
            Sandbox - no real money. Test card <code>5204247750001471</code> with any
            future expiry and any CVV.
          </p>
        )}
      </section>
    );
  }

  return (
    <section>
      <h2>Checkout</h2>
      <p className="muted">
        Paying for {product.name}. Catalog price is {product.currency} {product.price}; you can
        change the amount for this payment.
      </p>

      <form onSubmit={handleDetails}>
        <label htmlFor="amount">Amount ({product.currency})</label>
        <input
          id="amount"
          type="number"
          min="0.50"
          step="0.01"
          value={amount}
          required
          onChange={(event) => setAmount(event.target.value)}
        />

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
          <button type="submit" disabled={preparing}>
            {preparing ? "Preparing..." : "Continue to payment"}
          </button>
          <button type="button" className="secondary" onClick={onCancel} disabled={preparing}>
            Cancel
          </button>
        </div>
      </form>

      <p className="footnote">Card details are entered on Coinflow's hosted form, never here.</p>
    </section>
  );
}

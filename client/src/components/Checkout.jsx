import { useEffect, useRef, useState } from "react";
import { CoinflowPurchase } from "@coinflowlabs/react";
import { fetchCheckoutLink, fetchJwtToken, fetchSessionKey, recordOrder } from "../api.js";
import { formatCents } from "../format.js";

const COINFLOW_FRAME_ORIGINS = new Set([
  "https://sandbox.coinflow.cash",
  "https://coinflow.cash",
]);

function paymentIdFrom(result) {
  if (typeof result === "string" && result) return result;
  if (!result || typeof result !== "object") return null;
  return result.paymentId ?? result.id ?? result.payment?.paymentId ?? null;
}

function parseFrameMessage(data) {
  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  return data && typeof data === "object" ? data : null;
}

function TestCardNote() {
  return (
    <p className="callout">
      Sandbox — no real money. Test card <code>5204247750001471</code> with any future expiry and
      any CVV.
    </p>
  );
}

export default function Checkout({ product, onSuccess, onCancel, onPaymentSurface }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState(String(product.price));
  const [tokens, setTokens] = useState(null);
  const [checkoutLink, setCheckoutLink] = useState(null);
  const [preparing, setPreparing] = useState(null);
  const [error, setError] = useState(null);
  const settled = useRef(false);

  useEffect(() => {
    onPaymentSurface?.(Boolean(tokens || checkoutLink));
  }, [tokens, checkoutLink, onPaymentSurface]);

  function centsFromForm() {
    const cents = Math.round(Number(amount) * 100);
    if (!name || !email) {
      throw new Error("Name and email are required");
    }
    if (!Number.isInteger(cents) || cents < 50) {
      throw new Error("Enter an amount of at least $0.50");
    }
    return cents;
  }

  async function handleSdk() {
    setPreparing("sdk");
    setError(null);

    try {
      const cents = centsFromForm();
      const [session, checkout] = await Promise.all([
        fetchSessionKey(email),
        fetchJwtToken(email, cents),
      ]);
      setTokens({ ...session, ...checkout });
    } catch (err) {
      setError(err.message);
    } finally {
      setPreparing(null);
    }
  }

  async function handleLink() {
    setPreparing("link");
    setError(null);

    try {
      const cents = centsFromForm();
      setCheckoutLink(await fetchCheckoutLink(email, cents));
    } catch (err) {
      setError(err.message);
    } finally {
      setPreparing(null);
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

    const cents = tokens?.subtotal.cents ?? checkoutLink?.subtotal.cents;
    const fallbackOrder = {
      orderId: `order_${paymentId.replaceAll("-", "").slice(0, 8)}`,
      paymentId,
      name,
      email,
      amount: { cents, currency: product.currency },
    };

    // Advance the step bar immediately; then replace with the recorded order.
    onSuccess(fallbackOrder);
    try {
      onSuccess(await recordOrder({ paymentId, name, email, cents }));
    } catch (err) {
      console.error("Payment went through, but recording the order failed:", err.message);
    }
  }

  const handlePaidRef = useRef(handlePaid);
  handlePaidRef.current = handlePaid;

  useEffect(() => {
    if (!checkoutLink) return undefined;

    function onMessage(event) {
      if (!COINFLOW_FRAME_ORIGINS.has(event.origin)) return;

      const payload = parseFrameMessage(event.data);
      if (payload?.data !== "success") return;

      handlePaidRef.current(payload.info?.paymentId ?? payload.info);
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [checkoutLink]);

  if (checkoutLink) {
    return (
      <section>
        <p className="kicker">Hosted checkout</p>
        <h2>Payment</h2>
        <div className="summary">
          <div className="summary-row">
            <span>Item</span>
            <strong>{product.name}</strong>
          </div>
          <div className="summary-row">
            <span>Payer</span>
            <strong>{email}</strong>
          </div>
          <div className="summary-row">
            <span>Total</span>
            <strong>{formatCents(checkoutLink.subtotal.cents, product.currency)}</strong>
          </div>
        </div>

        {error && <p className="error">{error}</p>}

        <div className="coinflow-frame">
          <iframe title="Coinflow checkout" allow="payment" src={checkoutLink.link} />
        </div>

        <button
          type="button"
          className="secondary"
          onClick={() => {
            setCheckoutLink(null);
            setError(null);
          }}
        >
          Back to options
        </button>

        <TestCardNote />
      </section>
    );
  }

  if (tokens) {
    return (
      <section>
        <p className="kicker">Card form</p>
        <h2>Payment</h2>
        <div className="summary">
          <div className="summary-row">
            <span>Item</span>
            <strong>{product.name}</strong>
          </div>
          <div className="summary-row">
            <span>Payer</span>
            <strong>{email}</strong>
          </div>
          <div className="summary-row">
            <span>Total</span>
            <strong>{formatCents(tokens.subtotal.cents, product.currency)}</strong>
          </div>
        </div>

        {error && <p className="error">{error}</p>}

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

        {tokens.env === "sandbox" && <TestCardNote />}
      </section>
    );
  }

  return (
    <section>
      <p className="kicker">Secure checkout</p>
      <h2>Your details</h2>
      <p className="muted">
        Paying for {product.name}. Catalog price is {formatCents(Math.round(product.price * 100), product.currency)};
        you can change the amount for this payment.
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <div className="field">
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
        </div>

        <div className="field">
          <label htmlFor="name">Name</label>
          <input
            id="name"
            type="text"
            value={name}
            required
            autoComplete="name"
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            required
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        {error && <p className="error">{error}</p>}

        <div className="pay-options">
          <button type="button" className="pay-option" disabled={preparing} onClick={handleSdk}>
            <strong>{preparing === "sdk" ? "Preparing form…" : "Pay with React component"}</strong>
            <span>Keep checkout on this page with Coinflow’s embedded card form.</span>
          </button>
          <button type="button" className="pay-option" disabled={preparing} onClick={handleLink}>
            <strong>{preparing === "link" ? "Preparing link…" : "Pay with checkout link"}</strong>
            <span>Embed Coinflow’s hosted checkout URL in a frame.</span>
          </button>
        </div>

        <button type="button" className="secondary" onClick={onCancel} disabled={preparing}>
          Back to product
        </button>
      </form>

      <p className="footnote">Card details are entered on Coinflow’s hosted form, never here.</p>
    </section>
  );
}

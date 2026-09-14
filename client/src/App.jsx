import { useEffect, useState } from "react";
import { CoinflowPurchaseProtection } from "@coinflowlabs/react";
import { fetchCoinflowConfig, fetchProduct } from "./api.js";
import Product from "./components/Product.jsx";
import Checkout from "./components/Checkout.jsx";
import Confirmation from "./components/Confirmation.jsx";
import PayoutKyc from "./components/PayoutKyc.jsx";
import PayoutDestination from "./components/PayoutDestination.jsx";
import PayoutQuote from "./components/PayoutQuote.jsx";

const CHECKOUT_STEPS = [
  { id: "product", label: "Product" },
  { id: "checkout", label: "Payment" },
  { id: "confirmation", label: "Done" },
];

const PAYOUT_STEPS = [
  { id: "kyc", label: "Identity" },
  { id: "destination", label: "Destination" },
  { id: "quote", label: "Quote" },
  { id: "paid", label: "Paid" },
];

function stepClass(index, currentIndex, lastIndex) {
  if (index < currentIndex) return "is-done";
  if (index === currentIndex) {
    return index === lastIndex ? "is-current is-done" : "is-current";
  }
  return undefined;
}

function PayoutPlaceholder({ title, body, onBack, backLabel = "Back to identity" }) {
  return (
    <section>
      <p className="kicker">Coming next</p>
      <h2>{title}</h2>
      <p className="muted">{body}</p>
      <button type="button" className="secondary" onClick={onBack}>
        {backLabel}
      </button>
    </section>
  );
}

export default function App() {
  const [product, setProduct] = useState(null);
  const [coinflow, setCoinflow] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [mode, setMode] = useState("checkout");
  const [step, setStep] = useState("product");
  const [order, setOrder] = useState(null);
  const [wide, setWide] = useState(false);
  const [payout, setPayout] = useState(null);

  useEffect(() => {
    fetchProduct().then(setProduct).catch((err) => setLoadError(err.message));
    fetchCoinflowConfig().then(setCoinflow).catch((err) => {
      console.error("Could not load Coinflow config for purchase protection:", err.message);
    });
  }, []);

  function handleSuccess(completedOrder) {
    setOrder(completedOrder);
    setWide(false);
    setStep("confirmation");
  }

  function handleReset() {
    setOrder(null);
    setWide(false);
    setStep("product");
  }

  function switchMode(next) {
    setMode(next);
    setOrder(null);
    setPayout(null);
    setWide(false);
    setStep(next === "payout" ? "kyc" : "product");
  }

  const steps = mode === "payout" ? PAYOUT_STEPS : CHECKOUT_STEPS;
  const currentIndex = steps.findIndex((item) => item.id === step);

  return (
    <main className={wide ? "page is-wide" : "page"}>
      {coinflow && (
        <CoinflowPurchaseProtection merchantId={coinflow.merchantId} coinflowEnv={coinflow.env} />
      )}
      <header className="page-header">
        <p className="badge">Sandbox</p>
        <nav className="flow-switch" aria-label="Demo flow">
          <button
            type="button"
            className={mode === "checkout" ? "is-active" : undefined}
            onClick={() => switchMode("checkout")}
          >
            Checkout
          </button>
          <button
            type="button"
            className={mode === "payout" ? "is-active" : undefined}
            onClick={() => switchMode("payout")}
          >
            Payout
          </button>
        </nav>
      </header>

      <nav className="steps" aria-label={mode === "payout" ? "Payout progress" : "Checkout progress"}>
        {steps.flatMap((item, index) => [
          index > 0 ? <span className="rule" key={`rule-${item.id}`} /> : null,
          <span key={item.id} className={stepClass(index, currentIndex, steps.length - 1)}>
            {item.label}
          </span>,
        ])}
      </nav>

      <div className="card">
        {mode === "checkout" && (
          <>
            {loadError && <p className="error">Could not load the product: {loadError}</p>}
            {!loadError && !product && (
              <div className="skeleton" aria-live="polite">
                <span />
                <span />
                <span />
              </div>
            )}

            {product && step === "product" && (
              <Product product={product} onCheckout={() => setStep("checkout")} />
            )}

            {product && step === "checkout" && (
              <Checkout
                product={product}
                onSuccess={handleSuccess}
                onCancel={() => {
                  setWide(false);
                  setStep("product");
                }}
                onPaymentSurface={setWide}
              />
            )}

            {step === "confirmation" && order && (
              <Confirmation order={order} onReset={handleReset} />
            )}
          </>
        )}

        {mode === "payout" && step === "kyc" && (
          <PayoutKyc
            onVerified={(result) => {
              setPayout(result);
              setWide(false);
              setStep("destination");
            }}
            onCancel={() => switchMode("checkout")}
            onSurface={setWide}
          />
        )}

        {mode === "payout" && step === "destination" && (
          <PayoutDestination
            email={payout?.email}
            onQuoted={(result) => {
              if (result) setPayout(result);
              setStep("quote");
            }}
            onBack={() => {
              setWide(false);
              setStep("kyc");
            }}
            onSurface={setWide}
          />
        )}

        {mode === "payout" && step === "quote" && (
          <PayoutQuote
            payout={payout}
            onPaid={(next) => {
              setPayout(next);
              setStep("paid");
            }}
            onBack={() => setStep("destination")}
          />
        )}

        {mode === "payout" && step === "paid" && (
          <PayoutPlaceholder
            title="Initiate the payout"
            body="Step 5 debits your Coinflow wallet and sends funds at the speed you picked. Quote is done; that endpoint is next."
            onBack={() => setStep("quote")}
            backLabel="Back to quote"
          />
        )}
      </div>

      <p className="page-footer">
        {mode === "payout"
          ? "Payout details go to Coinflow. This demo only collects what each API step needs."
          : "Card details stay on Coinflow. This store never sees them."}
      </p>
    </main>
  );
}

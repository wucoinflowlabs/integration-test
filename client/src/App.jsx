import { useEffect, useState } from "react";
import { CoinflowPurchaseProtection } from "@coinflowlabs/react";
import { fetchCoinflowConfig, fetchProduct } from "./api.js";
import Product from "./components/Product.jsx";
import Checkout from "./components/Checkout.jsx";
import Confirmation from "./components/Confirmation.jsx";

const STEPS = [
  { id: "product", label: "Product" },
  { id: "checkout", label: "Payment" },
  { id: "confirmation", label: "Done" },
];

function stepClass(index, currentIndex) {
  if (index < currentIndex) return "is-done";
  if (index === currentIndex) {
    return index === STEPS.length - 1 ? "is-current is-done" : "is-current";
  }
  return undefined;
}

export default function App() {
  const [product, setProduct] = useState(null);
  const [coinflow, setCoinflow] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [step, setStep] = useState("product");
  const [order, setOrder] = useState(null);
  const [checkoutWide, setCheckoutWide] = useState(false);

  useEffect(() => {
    fetchProduct().then(setProduct).catch((err) => setLoadError(err.message));
    fetchCoinflowConfig().then(setCoinflow).catch((err) => {
      console.error("Could not load Coinflow config for purchase protection:", err.message);
    });
  }, []);

  function handleSuccess(completedOrder) {
    setOrder(completedOrder);
    setCheckoutWide(false);
    setStep("confirmation");
  }

  function handleReset() {
    setOrder(null);
    setCheckoutWide(false);
    setStep("product");
  }

  const currentIndex = STEPS.findIndex((item) => item.id === step);

  return (
    <main className={checkoutWide ? "page is-wide" : "page"}>
      {coinflow && (
        <CoinflowPurchaseProtection merchantId={coinflow.merchantId} coinflowEnv={coinflow.env} />
      )}
      <header className="page-header">
        <p className="badge">Sandbox</p>
      </header>

      <nav className="steps" aria-label="Checkout progress">
        {STEPS.flatMap((item, index) => [
          index > 0 ? <span className="rule" key={`rule-${item.id}`} /> : null,
          <span key={item.id} className={stepClass(index, currentIndex)}>
            {item.label}
          </span>,
        ])}
      </nav>

      <div className="card">
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
              setCheckoutWide(false);
              setStep("product");
            }}
            onPaymentSurface={setCheckoutWide}
          />
        )}

        {step === "confirmation" && order && (
          <Confirmation order={order} onReset={handleReset} />
        )}
      </div>

      <p className="page-footer">Card details stay on Coinflow. This store never sees them.</p>
    </main>
  );
}

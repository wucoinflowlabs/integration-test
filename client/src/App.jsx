import { useEffect, useState } from "react";
import { CoinflowPurchaseProtection } from "@coinflowlabs/react";
import { fetchCoinflowConfig, fetchProduct } from "./api.js";
import Product from "./components/Product.jsx";
import Checkout from "./components/Checkout.jsx";
import Confirmation from "./components/Confirmation.jsx";

export default function App() {
  const [product, setProduct] = useState(null);
  const [coinflow, setCoinflow] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [step, setStep] = useState("product");
  const [order, setOrder] = useState(null);

  useEffect(() => {
    fetchProduct().then(setProduct).catch((err) => setLoadError(err.message));
    fetchCoinflowConfig().then(setCoinflow).catch((err) => {
      console.error("Could not load Coinflow config for purchase protection:", err.message);
    });
  }, []);

  function handleSuccess(completedOrder) {
    setOrder(completedOrder);
    setStep("confirmation");
  }

  function handleReset() {
    setOrder(null);
    setStep("product");
  }

  return (
    <main className="page">
      {coinflow && (
        <CoinflowPurchaseProtection merchantId={coinflow.merchantId} coinflowEnv={coinflow.env} />
      )}
      <header className="page-header">
        <h1>Demo Store</h1>
        <p className="badge">Sandbox checkout via Coinflow</p>
      </header>

      <div className="card">
        {loadError && <p className="error">Could not load the product: {loadError}</p>}
        {!loadError && !product && <p className="muted">Loading product...</p>}

        {product && step === "product" && (
          <Product product={product} onCheckout={() => setStep("checkout")} />
        )}

        {product && step === "checkout" && (
          <Checkout
            product={product}
            onSuccess={handleSuccess}
            onCancel={() => setStep("product")}
          />
        )}

        {step === "confirmation" && order && (
          <Confirmation order={order} onReset={handleReset} />
        )}
      </div>
    </main>
  );
}

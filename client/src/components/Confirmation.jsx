import { formatCents } from "../format.js";

export default function Confirmation({ order, onReset }) {
  const paid =
    order.amount?.cents != null
      ? formatCents(order.amount.cents, order.amount.currency || "USD")
      : null;

  return (
    <section>
      <div className="success-mark" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 12.5 9.5 17 19 7.5"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <p className="kicker">Payment complete</p>
      <h2>Order confirmed</h2>
      <p className="muted">
        Thanks, {order.name}. A receipt would go to {order.email}.
      </p>

      <div className="receipt">
        {paid && (
          <div className="receipt-row">
            <span>Amount</span>
            <strong>{paid}</strong>
          </div>
        )}
        <div className="receipt-row">
          <span>Order ID</span>
          <code>{order.orderId}</code>
        </div>
        <div className="receipt-row">
          <span>Coinflow payment</span>
          <code>{order.paymentId}</code>
        </div>
      </div>

      <button type="button" onClick={onReset}>
        Buy another
      </button>
    </section>
  );
}

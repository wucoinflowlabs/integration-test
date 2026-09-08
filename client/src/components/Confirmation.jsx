export default function Confirmation({ order, onReset }) {
  return (
    <section>
      <h2>Order confirmed</h2>
      <p className="muted">Thanks, {order.name}. A receipt would go to {order.email}.</p>
      <p>
        Order ID: <code>{order.orderId}</code>
      </p>
      <button type="button" onClick={onReset}>
        Buy another
      </button>
    </section>
  );
}

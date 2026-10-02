import { useState } from "react";
import { submitWithdrawPayout } from "../api.js";
import { formatCents } from "../format.js";

const SPEED_COPY = {
  asap: "RTP",
  same_day: "Same-day ACH",
  standard: "Standard ACH",
};

function moneyLabel(money) {
  if (!money || money.cents == null) return "—";
  return formatCents(money.cents, money.currency || "USD");
}

export default function PayoutSend({ payout, onBack }) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const email = payout?.email ?? "";
  const cents = payout?.cents;
  const speed = payout?.speed;
  const accountToken = payout?.accountToken;
  const account = (payout?.withdrawer?.bankAccounts ?? []).find((item) => item.token === accountToken);
  const option = (payout?.quote?.options ?? []).find((item) => item.speed === speed);

  async function handleSend() {
    setSending(true);
    setError(null);

    try {
      setResult(await submitWithdrawPayout({ email, cents, speed, accountToken }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  if (!email || !cents || !speed || !accountToken) {
    return (
      <section>
        <p className="kicker">Payout step 5</p>
        <h2>Initiate the payout</h2>
        <p className="muted">Get a quote and pick a speed first.</p>
        <button type="button" className="secondary" onClick={onBack}>
          Back to quote
        </button>
      </section>
    );
  }

  if (result) {
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
        <p className="kicker">Payout step 5</p>
        <h2>Payout submitted</h2>
        <p className="muted">
          Coinflow debited the merchant wallet and queued {formatCents(result.cents, "USD")} to {email}.
        </p>

        <div className="receipt">
          <div className="receipt-row">
            <span>Requested speed</span>
            <strong>{SPEED_COPY[result.speed] ?? result.speed}</strong>
          </div>
          <div className="receipt-row">
            <span>Effective speed</span>
            <strong>{SPEED_COPY[result.effectiveSpeed] ?? result.effectiveSpeed}</strong>
          </div>
          {result.signature && (
            <div className="receipt-row">
              <span>Signature</span>
              <code>{result.signature}</code>
            </div>
          )}
        </div>

        <button type="button" className="secondary" onClick={onBack}>
          Back to quote
        </button>
      </section>
    );
  }

  return (
    <section>
      <p className="kicker">Payout step 5</p>
      <h2>Initiate the payout</h2>
      <p className="muted">
        This debits your Coinflow wallet. Sandbox still needs a funded balance; quote can succeed when
        send cannot.
      </p>

      <div className="summary">
        <div className="summary-row">
          <span>Payee</span>
          <strong>{email}</strong>
        </div>
        {account && (
          <div className="summary-row">
            <span>Destination</span>
            <strong>
              {account.alias || "Bank"} ····{account.last4}
            </strong>
          </div>
        )}
        <div className="summary-row">
          <span>Amount</span>
          <strong>{formatCents(cents, "USD")}</strong>
        </div>
        <div className="summary-row">
          <span>Speed</span>
          <strong>{SPEED_COPY[speed] ?? speed}</strong>
        </div>
        {option && (
          <>
            <div className="summary-row">
              <span>Fee</span>
              <strong>{moneyLabel(option.fee)}</strong>
            </div>
            <div className="summary-row">
              <span>They receive</span>
              <strong>{moneyLabel(option.finalSettlement)}</strong>
            </div>
          </>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      <div className="actions">
        <button type="button" onClick={handleSend} disabled={sending}>
          {sending ? "Sending…" : "Send payout"}
        </button>
        <button type="button" className="secondary" onClick={onBack} disabled={sending}>
          Back to quote
        </button>
      </div>
    </section>
  );
}

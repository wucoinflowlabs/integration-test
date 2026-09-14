import { useEffect, useState } from "react";
import { fetchWithdrawer, fetchWithdrawQuote } from "../api.js";
import { formatCents } from "../format.js";

const SPEED_COPY = {
  asap: { title: "RTP", detail: "Instant, typically seconds." },
  same_day: { title: "Same-day ACH", detail: "Within the business day." },
  standard: { title: "Standard ACH", detail: "1–3 business days." },
  card: { title: "Push-to-card", detail: "Instant to a debit card." },
  iban: { title: "IBAN", detail: "SEPA or UK Faster Payments." },
  pix: { title: "PIX", detail: "Instant in Brazil." },
  eft: { title: "EFT", detail: "Canadian bank transfer." },
  venmo: { title: "Venmo", detail: "Payout to Venmo." },
  paypal: { title: "PayPal", detail: "Payout to PayPal." },
  wire: { title: "Wire", detail: "Bank wire." },
  interac: { title: "Interac", detail: "Canadian Interac." },
  swift: { title: "SWIFT", detail: "International SWIFT." },
};

function moneyLabel(money) {
  if (!money || money.cents == null) return "—";
  return formatCents(money.cents, money.currency || "USD");
}

export default function PayoutQuote({ payout, onPaid, onBack }) {
  const email = payout?.email ?? "";
  const inheritedAccounts = payout?.withdrawer?.bankAccounts ?? [];
  const [accounts, setAccounts] = useState(inheritedAccounts);
  const [accountToken, setAccountToken] = useState(inheritedAccounts[0]?.token ?? "");
  const [amount, setAmount] = useState("25.00");
  const [loading, setLoading] = useState(Boolean(email) && inheritedAccounts.length === 0);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState(null);
  const [quote, setQuote] = useState(null);
  const [speed, setSpeed] = useState(null);

  useEffect(() => {
    if (!email || inheritedAccounts.length > 0) return undefined;

    let cancelled = false;
    setLoading(true);
    fetchWithdrawer(email)
      .then((next) => {
        if (cancelled) return;
        const nextAccounts = next.withdrawer?.bankAccounts ?? [];
        setAccounts(nextAccounts);
        setAccountToken((current) => current || nextAccounts[0]?.token || "");
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [email, inheritedAccounts.length]);

  async function handleQuote(event) {
    event.preventDefault();
    if (!email) return;

    const cents = Math.round(Number(amount) * 100);
    setQuoting(true);
    setError(null);
    setSpeed(null);

    try {
      setQuote(await fetchWithdrawQuote({ email, cents, accountToken }));
    } catch (err) {
      setQuote(null);
      setError(err.message);
    } finally {
      setQuoting(false);
    }
  }

  const selectedAccount = accounts.find((account) => account.token === accountToken);
  const BANK_SPEEDS = new Set(["asap", "same_day", "standard"]);
  const eligible = (quote?.options ?? []).filter(
    (option) => !option.accountIneligible && BANK_SPEEDS.has(option.speed),
  );
  const ineligible = (quote?.options ?? []).filter(
    (option) => BANK_SPEEDS.has(option.speed) && option.accountIneligible,
  );
  const chosen = eligible.find((option) => option.speed === speed) ?? null;

  if (!email) {
    return (
      <section>
        <p className="kicker">Payout step 4</p>
        <h2>Get a quote</h2>
        <p className="muted">Verify identity and save a destination first.</p>
        <button type="button" className="secondary" onClick={onBack}>
          Back to destination
        </button>
      </section>
    );
  }

  return (
    <section>
      <p className="kicker">Payout step 4</p>
      <h2>Get a quote</h2>
      <p className="muted">
        Coinflow returns fees, limits, and delivery times for each speed this destination supports.
        Pick one before initiating the payout.
      </p>

      <div className="summary">
        <div className="summary-row">
          <span>Payee</span>
          <strong>{email}</strong>
        </div>
        {selectedAccount && (
          <div className="summary-row">
            <span>Destination</span>
            <strong>
              {selectedAccount.alias || "Bank"} ····{selectedAccount.last4}
            </strong>
          </div>
        )}
      </div>

      <form onSubmit={handleQuote}>
        {accounts.length > 1 && (
          <div className="field">
            <label htmlFor="quote-account">Destination</label>
            <select
              id="quote-account"
              value={accountToken}
              onChange={(event) => {
                setAccountToken(event.target.value);
                setQuote(null);
                setSpeed(null);
              }}
            >
              {accounts.map((account) => (
                <option key={account.token} value={account.token}>
                  {account.alias || "Bank"} ····{account.last4}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="field">
          <label htmlFor="quote-amount">Amount (USD)</label>
          <input
            id="quote-amount"
            type="number"
            min="0.50"
            step="0.01"
            value={amount}
            required
            onChange={(event) => setAmount(event.target.value)}
          />
        </div>

        {error && <p className="error">{error}</p>}

        <div className="actions">
          <button type="submit" disabled={quoting || loading || !accountToken}>
            {quoting ? "Getting quote…" : "Get quote"}
          </button>
          <button type="button" className="secondary" onClick={onBack} disabled={quoting}>
            Back to destination
          </button>
        </div>
      </form>

      {quote && (
        <div className="quote-speeds">
          <p className="kicker">Speeds</p>
          {eligible.length === 0 && (
            <p className="muted">No eligible speeds for this destination and amount.</p>
          )}
          <div className="pay-options">
            {eligible.map((option) => {
              const copy = SPEED_COPY[option.speed] ?? { title: option.speed, detail: "" };
              return (
                <button
                  key={option.speed}
                  type="button"
                  className={speed === option.speed ? "pay-option is-selected" : "pay-option"}
                  onClick={() => setSpeed(option.speed)}
                >
                  <strong>
                    {copy.title} · receive {moneyLabel(option.finalSettlement)}
                  </strong>
                  <span>
                    Fee {moneyLabel(option.fee)}
                    {option.expectedDeliveryDate ? ` · ${option.expectedDeliveryDate}` : ""}
                    {copy.detail ? ` · ${copy.detail}` : ""}
                  </span>
                </button>
              );
            })}
          </div>

          {ineligible.length > 0 && (
            <p className="footnote">
              Not available for this account:{" "}
              {ineligible.map((option) => SPEED_COPY[option.speed]?.title ?? option.speed).join(", ")}.
            </p>
          )}

          <div className="actions">
            <button
              type="button"
              disabled={!chosen}
              onClick={() =>
                onPaid({
                  ...payout,
                  quote,
                  cents: quote.quote?.cents ?? Math.round(Number(amount) * 100),
                  accountToken,
                  speed: chosen.speed,
                })
              }
            >
              Continue to payout
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

import { useEffect, useRef, useState } from "react";
import { fetchSessionKey, fetchWithdrawer, submitWithdrawAccount } from "../api.js";

const COINFLOW_FRAME_ORIGINS = new Set([
  "https://sandbox.coinflow.cash",
  "https://coinflow.cash",
]);

const EMPTY_FORM = {
  alias: "",
  routingNumber: "",
  accountNumber: "",
  type: "checking",
};

const SANDBOX_FORM = {
  alias: "Sandbox checking",
  routingNumber: "333333334",
  accountNumber: "1111222233330000",
  type: "checking",
};

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

function bankAuthUrl({ merchantId, env, sessionKey }) {
  const host = env === "prod" ? "https://coinflow.cash" : "https://sandbox.coinflow.cash";
  const params = new URLSearchParams({
    sessionKey,
    bankAccountLinkRedirect: window.location.origin,
    allowedWithdrawSpeeds: "standard",
    origins: JSON.stringify([window.location.origin]),
  });
  return `${host}/solana/withdraw/${merchantId}?${params}`;
}

export default function PayoutDestination({ email, onQuoted, onBack, onSurface }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [mode, setMode] = useState(null);
  const [link, setLink] = useState(null);
  const [loading, setLoading] = useState(Boolean(email));
  const [submitting, setSubmitting] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const emailRef = useRef(email);
  emailRef.current = email;

  useEffect(() => {
    onSurface?.(Boolean(link));
  }, [link, onSurface]);

  useEffect(() => {
    if (!email) return undefined;

    let cancelled = false;
    setLoading(true);
    fetchWithdrawer(email)
      .then((next) => {
        if (!cancelled) setResult(next);
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
  }, [email]);

  useEffect(() => {
    if (!link) return undefined;

    async function onMessage(event) {
      if (!COINFLOW_FRAME_ORIGINS.has(event.origin)) return;
      const payload = parseFrameMessage(event.data);
      if (payload?.method !== "accountLinked") return;

      try {
        setResult(await fetchWithdrawer(emailRef.current));
        setLink(null);
        setMode(null);
        setError(null);
      } catch (err) {
        setError(err.message);
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [link]);

  function update(field) {
    return (event) => {
      setForm((current) => ({ ...current, [field]: event.target.value }));
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!email) return;
    setSubmitting(true);
    setError(null);

    try {
      setResult(
        await submitWithdrawAccount({
          email,
          alias: form.alias.trim(),
          routingNumber: form.routingNumber,
          accountNumber: form.accountNumber,
          type: form.type,
        }),
      );
      setForm(EMPTY_FORM);
      setMode(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLink() {
    setPreparing(true);
    setError(null);

    try {
      const session = await fetchSessionKey(email);
      setLink(bankAuthUrl(session));
    } catch (err) {
      setError(err.message);
    } finally {
      setPreparing(false);
    }
  }

  if (!email) {
    return (
      <section>
        <p className="kicker">Payout step 3</p>
        <h2>Add a destination</h2>
        <p className="muted">Verify identity first so Coinflow knows who this bank account belongs to.</p>
        <button type="button" className="secondary" onClick={onBack}>
          Back to identity
        </button>
      </section>
    );
  }

  const accounts = result?.withdrawer?.bankAccounts ?? [];
  const approved = result?.withdrawer?.verification?.status === "approved";

  if (link) {
    return (
      <section>
        <p className="kicker">Payout step 3</p>
        <h2>Link a bank</h2>
        <p className="muted">
          Coinflow’s hosted bank authentication UI. This uses a session key for {email}, not the
          merchant API key in the browser.
        </p>

        {error && <p className="error">{error}</p>}

        <div className="coinflow-frame">
          <iframe title="Coinflow bank authentication" allow="payment" src={link} />
        </div>

        <button
          type="button"
          className="secondary"
          onClick={() => {
            setLink(null);
            setError(null);
          }}
        >
          Back to options
        </button>
      </section>
    );
  }

  if (mode === "api") {
    return (
      <section>
        <p className="kicker">Payout step 3</p>
        <h2>US bank account</h2>
        <p className="muted">
          Routing and account number go to this server, then to Coinflow. The response token is what
          quote and payout use later.
        </p>

        <p className="callout">
          Sandbox routing <code>333333334</code> and account <code>1111222233330000</code>. This
          merchant may need Coinflow to enable API bank-account creation.
        </p>

        {error && <p className="error">{error}</p>}

        <form onSubmit={handleSubmit} autoComplete="off">
          <div className="field">
            <label htmlFor="bank-alias">Account nickname</label>
            <input id="bank-alias" type="text" value={form.alias} required onChange={update("alias")} />
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="bank-routing">Routing number</label>
              <input
                id="bank-routing"
                type="text"
                value={form.routingNumber}
                required
                inputMode="numeric"
                maxLength={9}
                autoComplete="off"
                onChange={update("routingNumber")}
              />
            </div>
            <div className="field">
              <label htmlFor="bank-type">Type</label>
              <select id="bank-type" value={form.type} onChange={update("type")}>
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="bank-account">Account number</label>
            <input
              id="bank-account"
              type="text"
              value={form.accountNumber}
              required
              inputMode="numeric"
              autoComplete="off"
              onChange={update("accountNumber")}
            />
          </div>

          <div className="actions">
            <button type="submit" disabled={submitting || !approved}>
              {submitting ? "Saving…" : "Save bank account"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setForm(SANDBOX_FORM)}
              disabled={submitting}
            >
              Fill sandbox example
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setMode(null);
                setError(null);
              }}
              disabled={submitting}
            >
              Back to options
            </button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <section>
      <p className="kicker">Payout step 3</p>
      <h2>Add a destination</h2>
      <p className="muted">
        Save where {email} should be paid. US bank accounts support ACH and RTP. Coinflow returns a
        token; later steps never reuse the raw account number.
      </p>

      <div className="summary">
        <div className="summary-row">
          <span>Payee</span>
          <strong>{email}</strong>
        </div>
        <div className="summary-row">
          <span>Verification</span>
          <span className={approved ? "chip is-success" : "chip is-pending"}>
            {result?.withdrawer?.verification?.status || (loading ? "loading" : "unknown")}
          </span>
        </div>
      </div>

      {accounts.length > 0 && (
        <div className="summary">
          {accounts.map((account) => (
            <div className="summary-row" key={account.token || `${account.alias}-${account.last4}`}>
              <span>
                {account.alias || "Bank account"}
                {account.rtpEligible ? " · RTP" : ""}
              </span>
              <strong>••••{account.last4}</strong>
            </div>
          ))}
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <div className="pay-options">
        <button type="button" className="pay-option" disabled={preparing || !approved} onClick={handleLink}>
          <strong>{preparing ? "Preparing link…" : "Link with Coinflow UI"}</strong>
          <span>Hosted bank authentication. Uses a session key; works when API bank creation is off.</span>
        </button>
        <button
          type="button"
          className="pay-option"
          disabled={!approved}
          onClick={() => {
            setError(null);
            setMode("api");
          }}
        >
          <strong>Enter routing and account</strong>
          <span>POST /api/withdraw/account from this server. Needs merchant permission to create banks.</span>
        </button>
      </div>

      <div className="actions">
        {accounts.length > 0 && (
          <button type="button" onClick={() => onQuoted(result)}>
            Continue to quote
          </button>
        )}
        <button type="button" className="secondary" onClick={onBack}>
          Back to identity
        </button>
      </div>
    </section>
  );
}

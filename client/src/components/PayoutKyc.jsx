import { useState } from "react";
import { fetchWithdrawer, submitWithdrawKyc } from "../api.js";

const EMPTY_FORM = {
  email: "",
  firstName: "",
  surName: "",
  physicalAddress: "",
  city: "",
  state: "",
  zip: "",
  country: "US",
  dob: "",
  ssn: "",
};

const SANDBOX_FORM = {
  email: "seller@example.com",
  firstName: "Usher",
  surName: "Raymond",
  physicalAddress: "2800 N Damen Ave",
  city: "Chicago",
  state: "IL",
  zip: "60625",
  country: "US",
  dob: "1976-10-14",
  ssn: "1234",
};

function verificationStatus(result) {
  return result?.withdrawer?.verification?.status ?? null;
}

function statusClass(status) {
  if (status === "approved") return "chip is-success";
  if (status === "rejected" || status === "expired") return "chip is-danger";
  return "chip is-pending";
}

export default function PayoutKyc({ onVerified, onCancel, onSurface }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  function update(field) {
    return (event) => {
      const value = field === "state" || field === "country" ? event.target.value.toUpperCase() : event.target.value;
      setForm((current) => ({ ...current, [field]: value }));
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const next = await submitWithdrawKyc({
        ...form,
        email: form.email.trim(),
        country: form.country.trim().toUpperCase(),
        state: form.state.trim().toUpperCase(),
        dob: form.dob.replaceAll("-", ""),
        redirectLink: window.location.origin,
      });
      setResult(next);
      onSurface?.(Boolean(next.verificationLink));
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRefresh() {
    if (!result?.email) return;
    setChecking(true);
    setError(null);

    try {
      const next = await fetchWithdrawer(result.email);
      setResult(next);
      onSurface?.(Boolean(next.verificationLink) && verificationStatus(next) !== "approved");
    } catch (err) {
      setError(err.message);
    } finally {
      setChecking(false);
    }
  }

  function handleEdit() {
    setResult(null);
    setError(null);
    onSurface?.(false);
  }

  if (result) {
    const status = verificationStatus(result);
    const approved = status === "approved";
    const rejected = status === "rejected" || status === "expired";
    const reasons = result.rejectionReasons?.length
      ? result.rejectionReasons
      : result.withdrawer?.verification?.rejectionReasons ?? [];

    return (
      <section>
        <p className="kicker">Payout step 1</p>
        <h2>{approved ? "Identity verified" : rejected ? "Verification did not pass" : "Finish verification"}</h2>
        <p className="muted">
          {approved
            ? "This person can be paid out again without repeating KYC."
            : result.verificationLink
              ? "Coinflow needs a photo ID and selfie. Complete the hosted check, then refresh the status."
              : "Coinflow created a withdrawer record. Status updates here after they finish review."}
        </p>

        <div className="summary">
          <div className="summary-row">
            <span>Email</span>
            <strong>{result.email}</strong>
          </div>
          {result.withdrawer?.id && (
            <div className="summary-row">
              <span>Withdrawer</span>
              <code>{result.withdrawer.id}</code>
            </div>
          )}
          <div className="summary-row">
            <span>Verification</span>
            <span className={statusClass(status)}>{status || "unknown"}</span>
          </div>
          {result.withdrawer?.availability?.status && (
            <div className="summary-row">
              <span>Availability</span>
              <strong>{result.withdrawer.availability.status}</strong>
            </div>
          )}
        </div>

        {reasons.length > 0 && (
          <p className="error">{reasons.join(" ")}</p>
        )}

        {error && <p className="error">{error}</p>}

        {result.verificationLink && !approved && (
          <div className="coinflow-frame">
            <iframe title="Coinflow identity verification" src={result.verificationLink} />
          </div>
        )}

        <div className="actions">
          {approved ? (
            <button type="button" onClick={() => onVerified(result)}>
              Continue to destination
            </button>
          ) : (
            <button type="button" onClick={handleRefresh} disabled={checking}>
              {checking ? "Checking…" : "I’ve finished — check status"}
            </button>
          )}
          <button type="button" className="secondary" onClick={handleEdit}>
            Edit details
          </button>
          <button type="button" className="secondary" onClick={onCancel}>
            Back to checkout
          </button>
        </div>
      </section>
    );
  }

  return (
    <section>
      <p className="kicker">Payout step 1</p>
      <h2>Verify identity</h2>
      <p className="muted">
        Coinflow runs KYC before the first payout from your Coinflow wallet. US withdrawers need
        name, address, date of birth, and the last four of their SSN.
      </p>

      <p className="callout">
        Sandbox demo — available earnings $25.00. Test last-4 SSN is <code>1234</code>.
      </p>

      <form onSubmit={handleSubmit} autoComplete="off">
        <div className="field-row">
          <div className="field">
            <label htmlFor="kyc-first">First name</label>
            <input
              id="kyc-first"
              type="text"
              value={form.firstName}
              required
              autoComplete="given-name"
              onChange={update("firstName")}
            />
          </div>
          <div className="field">
            <label htmlFor="kyc-last">Last name</label>
            <input
              id="kyc-last"
              type="text"
              value={form.surName}
              required
              autoComplete="family-name"
              onChange={update("surName")}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="kyc-email">Email</label>
          <input
            id="kyc-email"
            type="email"
            value={form.email}
            required
            autoComplete="email"
            onChange={update("email")}
          />
        </div>

        <div className="field">
          <label htmlFor="kyc-address">Street address</label>
          <input
            id="kyc-address"
            type="text"
            value={form.physicalAddress}
            required
            autoComplete="street-address"
            onChange={update("physicalAddress")}
          />
        </div>

        <div className="field-row is-3">
          <div className="field">
            <label htmlFor="kyc-city">City</label>
            <input
              id="kyc-city"
              type="text"
              value={form.city}
              required
              autoComplete="address-level2"
              onChange={update("city")}
            />
          </div>
          <div className="field">
            <label htmlFor="kyc-state">State</label>
            <input
              id="kyc-state"
              type="text"
              value={form.state}
              required
              maxLength={2}
              placeholder="IL"
              autoComplete="address-level1"
              onChange={update("state")}
            />
          </div>
          <div className="field">
            <label htmlFor="kyc-zip">ZIP</label>
            <input
              id="kyc-zip"
              type="text"
              value={form.zip}
              required
              inputMode="numeric"
              autoComplete="postal-code"
              onChange={update("zip")}
            />
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="kyc-dob">Date of birth</label>
            <input
              id="kyc-dob"
              type="date"
              value={form.dob}
              required
              autoComplete="bday"
              onChange={update("dob")}
            />
          </div>
          <div className="field">
            <label htmlFor="kyc-ssn">SSN last 4</label>
            <input
              id="kyc-ssn"
              type="text"
              value={form.ssn}
              required
              inputMode="numeric"
              maxLength={9}
              autoComplete="off"
              onChange={update("ssn")}
            />
          </div>
        </div>

        <input type="hidden" name="country" value={form.country} readOnly />

        {error && <p className="error">{error}</p>}

        <div className="actions">
          <button type="submit" disabled={submitting}>
            {submitting ? "Verifying…" : "Submit to Coinflow"}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => setForm(SANDBOX_FORM)}
            disabled={submitting}
          >
            Fill sandbox example
          </button>
          <button type="button" className="secondary" onClick={onCancel} disabled={submitting}>
            Back to checkout
          </button>
        </div>
      </form>

      <p className="footnote">
        Details go to this demo’s server, then to Coinflow. Only the last four of the SSN are sent.
      </p>
    </section>
  );
}

"use client";
import { useMemo, useState } from "react";

type ShippingMethod = "standard" | "expedited";
const initialForm = { fullName: "", phone: "", addressLine1: "", addressLine2: "", city: "", postalCode: "", country: "Pakistan" };

export default function CheckoutForm({ onShippingMethodChange, cancelled = false }: { onShippingMethodChange?: (method: ShippingMethod) => void; cancelled?: boolean }) {
  const [form, setForm] = useState(initialForm);
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>("standard");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const standardLabel = useMemo(() => "Free over $50 · $5 otherwise", []);

  function update(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/checkout/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shippingAddress: form, shippingMethod }),
      });
      const result = await response.json();
      if (!response.ok || !result.url) throw new Error(result.error || "Could not start secure checkout.");
      window.location.assign(result.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start secure checkout.");
      setBusy(false);
    }
  }

  return <form className="checkout-form" onSubmit={submit}>
    {cancelled && <p className="form-error">Your checkout was cancelled. Your bag is still here, so you can try again.</p>}
    <div className="form-section-title"><span>01</span><div><h2>Shipping details</h2><p>Where should we send your order?</p></div></div>
    <div className="form-grid">
      <label className="field full-field">Full name *<input name="fullName" required minLength={2} value={form.fullName} onChange={update} autoComplete="name" /></label>
      <label className="field">Phone number *<input name="phone" required minLength={5} value={form.phone} onChange={update} autoComplete="tel" /></label>
      <label className="field">Country *<input name="country" required value={form.country} onChange={update} autoComplete="country-name" /></label>
      <label className="field full-field">Address line 1 *<input name="addressLine1" required minLength={3} value={form.addressLine1} onChange={update} autoComplete="address-line1" /></label>
      <label className="field full-field">Address line 2<input name="addressLine2" value={form.addressLine2} onChange={update} autoComplete="address-line2" /></label>
      <label className="field">City *<input name="city" required minLength={2} value={form.city} onChange={update} autoComplete="address-level2" /></label>
      <label className="field">Postal code *<input name="postalCode" required minLength={2} value={form.postalCode} onChange={update} autoComplete="postal-code" /></label>
    </div>
    <div className="form-section-title payment-title"><span>02</span><div><h2>Shipping method</h2><p>Choose the delivery speed that works for you.</p></div></div>
    <div className="shipping-options">
      <label className={`shipping-option ${shippingMethod === "standard" ? "shipping-option-selected" : ""}`}>
        <input type="radio" name="shippingMethod" value="standard" checked={shippingMethod === "standard"} onChange={() => { setShippingMethod("standard"); onShippingMethodChange?.("standard"); }} />
        <span className="shipping-option-copy"><strong>Standard delivery</strong><small>{standardLabel} · 3–5 business days</small></span>
        <strong className="shipping-price">Free*</strong>
      </label>
      <label className={`shipping-option ${shippingMethod === "expedited" ? "shipping-option-selected" : ""}`}>
        <input type="radio" name="shippingMethod" value="expedited" checked={shippingMethod === "expedited"} onChange={() => { setShippingMethod("expedited"); onShippingMethodChange?.("expedited"); }} />
        <span className="shipping-option-copy"><strong>Expedited delivery</strong><small>Priority handling · 1–2 business days</small></span>
        <strong className="shipping-price">$15.00</strong>
      </label>
    </div>
    <div className="form-section-title payment-title"><span>03</span><div><h2>Secure payment</h2><p>You’ll enter payment details on Stripe’s secure checkout page.</p></div></div>
    <div className="demo-payment stripe-payment"><span className="stripe-lock">✓</span><div><strong>Powered by Stripe Checkout</strong><p>Your card details go directly to Stripe. This site never receives or stores your full card number.</p></div><span className="demo-badge">TEST MODE</span></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="button button-primary button-wide submit-order" disabled={busy}>{busy ? "Connecting to Stripe…" : "Continue to secure payment →"}</button>
    <p className="secure-note">Standard delivery is free on orders of $50 or more. Shipping is calculated by the server before payment.</p>
  </form>;
}

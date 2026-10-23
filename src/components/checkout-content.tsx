"use client";
import { useState } from "react";
import Link from "next/link";
import { money } from "@/lib/utils";
import CheckoutForm from "@/components/checkout-form";
import type { CartLine } from "@/lib/types";

export default function CheckoutContent({ lines, subtotal, cancelled = false }: { lines: CartLine[]; subtotal: number; cancelled?: boolean }) {
  const [shippingMethod, setShippingMethod] = useState<"standard" | "expedited">("standard");
  const shipping = shippingMethod === "expedited" ? 15 : subtotal >= 50 ? 0 : 5;
  return <div className="checkout-layout">
    <CheckoutForm onShippingMethodChange={setShippingMethod} cancelled={cancelled} />
    <aside className="order-summary checkout-summary"><h2>Your order</h2>
      {lines.map(line => <div className="checkout-item" key={line.id}><span>{line.product.name} <small>× {line.quantity}</small></span><strong>{money(Number(line.product.price) * line.quantity)}</strong></div>)}
      <div><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
      <div><span>{shippingMethod === "expedited" ? "Expedited shipping" : "Standard shipping"}</span><strong>{shipping === 0 ? "Free" : money(shipping)}</strong></div>
      <div className="summary-total"><span>Estimated total</span><strong>{money(subtotal + shipping)}</strong></div>
      <p className="secure-note">Final amount is recalculated from the database before Stripe Checkout opens.</p><Link href="/cart" className="text-link">Edit bag</Link>
    </aside>
  </div>;
}

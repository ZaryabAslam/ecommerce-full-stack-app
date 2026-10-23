import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, Clock3 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { money } from "@/lib/utils";

export default async function OrderConfirmationPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id: sessionId } = await searchParams;
  if (!sessionId) redirect("/account/orders");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/order-confirmation?session_id=${sessionId}`)}`);

  let session;
  try { session = await getStripe().checkout.sessions.retrieve(sessionId); }
  catch { redirect("/account/orders"); }
  if (session.metadata?.user_id !== user.id || session.metadata?.order_id == null) redirect("/account/orders");

  const orderId = Number(session.metadata.order_id);
  if (!Number.isSafeInteger(orderId) || orderId <= 0 || session.mode !== "payment" || session.currency !== "usd") redirect("/account/orders");

  // No Stripe CLI is needed for local card-payment testing: the success page verifies
  // the session directly with Stripe on the server, then uses an idempotent DB RPC.
  // An optional signed webhook can provide recovery if a customer does not return here.
  const admin = createAdminClient();
  const [{ data: payment }, { data: order }] = await Promise.all([
    admin.from("payments").select("order_id,amount,status,stripe_checkout_session_id").eq("order_id", orderId).maybeSingle(),
    admin.from("orders").select("id,user_id,order_number,status,total,created_at,currency").eq("id", orderId).maybeSingle(),
  ]);
  if (!payment || !order || order.user_id !== user.id || payment.stripe_checkout_session_id !== session.id ||
      Math.round(Number(payment.amount) * 100) !== session.amount_total ||
      Math.round(Number(order.total) * 100) !== session.amount_total || order.currency !== "usd") redirect("/account/orders");

  if (session.payment_status === "paid" && order.status === "pending" && payment.status === "pending") {
    const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    const { error } = await admin.rpc("finalize_stripe_checkout", {
      p_order_id: orderId,
      p_session_id: session.id,
      p_payment_intent_id: paymentIntentId || "",
      p_event_id: `return_${session.id}`,
    });
    if (error) console.error("Stripe success-return fulfillment failed:", error.message);
  }

  const { data } = await supabase.from("orders")
    .select("id,order_number,status,total,created_at")
    .eq("id", orderId).eq("user_id", user.id).maybeSingle();
  if (!data) redirect("/account/orders");
  const paid = session.payment_status === "paid" && data.status === "confirmed";
  return <section className="confirmation-page">
    <div className="confirmation-check">{paid ? <Check size={34} /> : <Clock3 size={32} />}</div>
    <span className="eyebrow">{paid ? "PAYMENT CONFIRMED" : "PAYMENT PROCESSING"}</span>
    <h1>{paid ? "That’s a good choice." : "We’re confirming your payment."}</h1>
    <p>{paid ? "Your payment is confirmed and your order is in the system. Thanks for shopping BrightCart." : "Stripe has returned you to the store. Your order will update when the verified payment notification is processed. Please check your order history shortly."}</p>
    <div className="confirmation-card">
      <div><span>Order number</span><strong>{data.order_number}</strong></div>
      <div><span>Order status</span><strong className="status-pill">{data.status}</strong></div>
      <div><span>Payment status</span><strong className="status-pill">{session.payment_status}</strong></div>
      <div><span>Total</span><strong>{money(data.total)}</strong></div>
    </div>
    <p className="confirmation-footnote">Stripe test mode is enabled. Use test card details from Stripe’s official testing guide while developing.</p>
    <div className="confirmation-actions"><Link href="/account/orders" className="button button-primary">View my orders</Link><Link href="/products" className="button button-secondary">Keep shopping</Link></div>
  </section>;
}

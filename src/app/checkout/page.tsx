import { redirect } from "next/navigation";
import { getActiveCart } from "@/lib/cart";
import CheckoutContent from "@/components/checkout-content";
export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ cancelled?: string }> }) {
  const { cancelled } = await searchParams;
  const { user, lines } = await getActiveCart();
  if (!user) redirect("/login?next=%2Fcheckout");
  if (!lines.length) redirect("/cart");
  const subtotal = lines.reduce((sum, line) => sum + Number(line.product.price) * line.quantity, 0);
  return <section className="page-section narrow-page"><div className="page-intro left-intro"><span className="eyebrow">ALMOST YOURS</span><h1>Checkout</h1><p>Choose your delivery speed and pay securely with Stripe.</p></div><CheckoutContent lines={lines} subtotal={subtotal} cancelled={cancelled === "1"} /></section>;
}

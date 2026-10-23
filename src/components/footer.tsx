import Link from "next/link";
import { ArrowUpRight, Instagram, ShieldCheck, Truck } from "lucide-react";
export default function Footer() {
  return <footer className="footer footer-enhanced">
    <div className="footer-top"><div className="footer-brand-block"><Link href="/" className="brand"><span className="brand-mark">b.</span><span>brightcart<small className="brand-subtitle">GOOD FINDS, DAILY</small></span></Link><p>Thoughtful finds for everyday living. A little more joy in the things you use every day.</p><span className="footer-social"><Instagram size={16}/> Curated for everyday</span></div>
      <div className="footer-links"><strong>Explore</strong><Link href="/products">Shop all</Link><Link href="/products?category=Electronics">Tech & gadgets</Link><Link href="/products?category=Home">Home living</Link><Link href="/products?category=Accessories">Accessories</Link></div>
      <div className="footer-links"><strong>Your account</strong><Link href="/account">Account overview</Link><Link href="/account/orders">Order history</Link><Link href="/account/profile">Profile settings</Link><Link href="/cart">Shopping bag</Link></div>
      <div className="footer-promise"><div><Truck size={19}/><span><strong>Delivery, your way</strong><small>Free standard shipping over $50</small></span></div><div><ShieldCheck size={19}/><span><strong>Secure checkout</strong><small>Payments handled by Stripe</small></span></div><Link href="/products" className="text-link">Find your next favorite <ArrowUpRight size={14}/></Link></div>
    </div><div className="footer-bottom"><small>© {new Date().getFullYear()} BrightCart. All rights reserved.</small><small>Secure test checkout · No live charges while in Stripe test mode.</small></div>
  </footer>;
}

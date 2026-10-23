import Link from "next/link";
import { ArrowUpRight, Heart, PackageCheck, ShoppingBag, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function Header() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return <>
    <div className="announcement-bar"><span>Small details. Better everyday living.</span><Link href="/products">Discover the collection <ArrowUpRight size={13}/></Link></div>
    <header className="site-header"><div className="header-inner">
      <Link href="/" className="brand"><span className="brand-mark">b.</span><span>brightcart<small className="brand-subtitle">GOOD FINDS, DAILY</small></span></Link>
      <nav className="main-nav" aria-label="Main navigation"><Link href="/products">Shop all</Link><Link href="/products?category=Electronics">Tech & gadgets</Link><Link href="/products?category=Home">Home living</Link><Link href="/products?category=Accessories">Accessories</Link></nav>
      <div className="header-actions"><Link href="/account/orders" className="header-icon-link" aria-label="Order history"><PackageCheck size={18}/><span>Orders</span></Link><Link href={user ? "/account" : "/login"} className="header-icon-link" aria-label="Account"><UserRound size={18}/><span>{user ? "Account" : "Sign in"}</span></Link><Link href="/cart" className="cart-link"><ShoppingBag size={18}/><span>Bag</span></Link></div>
    </div></header>
  </>;
}

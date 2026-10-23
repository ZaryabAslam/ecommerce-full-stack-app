"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AddToCart({ productId, stock, productSlug }: { productId: number; stock: number; productSlug: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoAddStarted = useRef(false);

  async function add() {
    setBusy(true);
    setMessage("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const returnPath = `/products/${productSlug}?addToCart=${productId}`;
      router.push(`/login?next=${encodeURIComponent(returnPath)}`);
      setBusy(false);
      return;
    }

    let { data: cart } = await supabase.from("carts").select("id").eq("user_id", user.id).eq("status", "active").order("id", { ascending: false }).limit(1).maybeSingle();
    if (!cart) {
      const result = await supabase.from("carts").insert({ user_id: user.id, status: "active" }).select("id").single();
      cart = result.data;
      if (result.error) {
        setMessage("Could not open your cart. Please try again.");
        setBusy(false);
        return;
      }
    }
    if (!cart) {
      setMessage("Could not open your cart. Please try again.");
      setBusy(false);
      return;
    }

    const { data: existing, error: lookupError } = await supabase.from("cart_items").select("id,quantity").eq("cart_id", cart.id).eq("product_id", productId).maybeSingle();
    if (lookupError) {
      setMessage(lookupError.message);
      setBusy(false);
      return;
    }
    const result = existing
      ? await supabase.from("cart_items").update({ quantity: Math.min(Number(existing.quantity) + 1, stock) }).eq("id", existing.id)
      : await supabase.from("cart_items").insert({ cart_id: cart.id, product_id: productId, quantity: 1 });

    if (result.error) setMessage(result.error.message);
    else {
      setMessage("Added to your bag");
      router.push("/cart");
      router.refresh();
    }
    setBusy(false);
  }

  useEffect(() => {
    if (searchParams.get("addToCart") === String(productId) && !autoAddStarted.current) {
      autoAddStarted.current = true;
      router.replace(`/products/${productSlug}`, { scroll: false });
      void add();
    }
    // This effect is only the resume step after a successful sign-in redirect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, productSlug, searchParams, router]);

  return <div className="add-wrap"><button className="button button-primary button-wide" onClick={add} disabled={busy || stock < 1}>{busy ? "Adding…" : stock < 1 ? "Out of stock" : "Add to bag"}</button>{message && <p className="inline-message" role="status">{message}</p>}</div>;
}

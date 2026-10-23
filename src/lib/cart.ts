import { createClient } from "@/lib/supabase/server";
import type { CartLine } from "@/lib/types";
export async function getActiveCart() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, cartId: null as number | null, lines: [] as CartLine[] };
  let { data: cart } = await supabase.from("carts").select("id").eq("user_id", user.id).eq("status", "active").order("id", { ascending: false }).limit(1).maybeSingle();
  if (!cart) { const created = await supabase.from("carts").insert({ user_id: user.id, status: "active" }).select("id").single(); cart = created.data; }
  if (!cart) return { user, cartId: null, lines: [] as CartLine[] };
  const { data } = await supabase.from("cart_items").select("id,cart_id,product_id,quantity,unit_price,product:products(id,name,slug,description,sku,price,stock_quantity,category,image_url,active)").eq("cart_id", cart.id).order("id");
  const lines = ((data ?? []) as unknown as (Omit<CartLine,"product"> & {product: CartLine["product"] | null})[]).filter((line): line is CartLine => !!line.product);
  return { user, cartId: Number(cart.id), lines };
}

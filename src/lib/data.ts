import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/lib/types";
export async function getProducts(category?: string) {
  const supabase = await createClient();
  let query = supabase.from("products").select("id,name,slug,description,sku,price,stock_quantity,category,image_url,active").eq("active", true).order("id");
  if (category) query = query.ilike("category", category);
  const { data, error } = await query;
  if (error) console.error("Unable to load products", error.message);
  return (data ?? []) as Product[];
}
export async function getProduct(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("id,name,slug,description,sku,price,stock_quantity,category,image_url,active").eq("slug", slug).eq("active", true).maybeSingle();
  return data as Product | null;
}

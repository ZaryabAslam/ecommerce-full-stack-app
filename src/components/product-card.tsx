import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Product } from "@/lib/types";
import { money } from "@/lib/utils";
export default function ProductCard({ product }: { product: Product }) { return <Link href={`/products/${product.slug}`} className="product-card"><div className="product-image-wrap">{product.image_url ? <img src={product.image_url} alt={product.name} className="product-image" loading="lazy"/> : <div className="image-fallback">BC</div>}<span className="product-arrow"><ArrowUpRight size={18}/></span></div><div className="product-card-meta"><div><span className="eyebrow">{product.category ?? "Everyday"}</span><h3>{product.name}</h3></div><strong>{money(product.price)}</strong></div></Link>; }

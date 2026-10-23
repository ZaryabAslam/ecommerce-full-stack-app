export type Product = { id: number; name: string; slug: string; description: string | null; sku: string; price: number | string; stock_quantity: number; category: string | null; image_url: string | null; active: boolean };
export type CartLine = { id: number; cart_id: number; product_id: number; quantity: number; unit_price: number | string; product: Product };
export type ShippingAddress = { fullName: string; phone: string; addressLine1: string; addressLine2?: string; city: string; postalCode: string; country: string };

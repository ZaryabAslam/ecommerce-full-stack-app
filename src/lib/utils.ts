export function money(value: number | string) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0)); }
export function safeNextPath(value: string | null, fallback = "/account") { return value && value.startsWith("/") && !value.startsWith("//") ? value : fallback; }

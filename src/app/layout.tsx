import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/header";
import Footer from "@/components/footer";
export const metadata: Metadata = { title: { default: "BrightCart — Everyday, elevated", template: "%s | BrightCart" }, description: "Thoughtful finds for everyday living." };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body><Header/><main className="main-shell">{children}</main><Footer/></body></html>; }

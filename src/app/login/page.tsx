import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import PasswordAuthForm from "@/components/password-auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <section className="auth-page">
      <div className="auth-visual">
        <Link href="/" className="brand"><span className="brand-mark">b.</span> brightcart</Link>
        <div>
          <span className="eyebrow">WELCOME BACK</span>
          <h1>Good things<br /><em>start here.</em></h1>
          <p>Sign in to keep your bag, details, and orders all in one place.</p>
        </div>
        <span className="auth-deco" aria-hidden="true">✳</span>
      </div>
      <div className="auth-panel">
        <span className="eyebrow">YOUR EVERYDAY, ELEVATED</span>
        <h2>Welcome back.</h2>
        <p>Enter your email and password to continue.</p>
        <Suspense fallback={<div className="loading-line">Loading sign in…</div>}>
          <PasswordAuthForm mode="login" />
        </Suspense>
        <Link href="/products" className="text-link auth-browse-link">Browse without signing in</Link>
      </div>
    </section>
  );
}

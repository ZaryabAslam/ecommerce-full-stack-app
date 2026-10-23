import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import PasswordAuthForm from "@/components/password-auth-form";

export const metadata: Metadata = { title: "Create an account" };

export default function SignupPage() {
  return (
    <section className="auth-page auth-page-signup">
      <div className="auth-visual">
        <Link href="/" className="brand"><span className="brand-mark">b.</span> brightcart</Link>
        <div>
          <span className="eyebrow">A LITTLE MORE EVERYDAY</span>
          <h1>Your good<br /><em>life starts here.</em></h1>
          <p>Create an account for a saved cart, simple checkout, and all your orders together.</p>
        </div>
        <span className="auth-deco" aria-hidden="true">✳</span>
      </div>
      <div className="auth-panel">
        <span className="eyebrow">JOIN BRIGHTCART</span>
        <h2>Make yourself at home.</h2>
        <p>Create your account using an email address and password.</p>
        <Suspense fallback={<div className="loading-line">Loading sign up…</div>}>
          <PasswordAuthForm mode="signup" />
        </Suspense>
        <Link href="/products" className="text-link auth-browse-link">Browse without signing in</Link>
      </div>
    </section>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/utils";

type AuthMode = "login" | "signup";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.4 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 7-10 7-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.4 0 11.8-2.1 15.7-5.7l-7.5-5.8c-2.1 1.4-4.8 2.3-8.2 2.3-6.3 0-11.6-4.3-13.5-10l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

export default function PasswordAuthForm({ mode }: { mode: AuthMode }) {
  const isSignup = mode === "signup";
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"), "/account");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(searchParams.get("error") === "auth_callback" ? "We couldn’t verify that confirmation link. It may have expired; please try signing in again or create a new account." : "");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (isSignup && password !== confirmPassword) {
      setError("Your passwords don't match.");
      return;
    }
    if (isSignup && password.length < 8) {
      setError("Please choose a password with at least 8 characters.");
      return;
    }

    setBusy(true);
    const supabase = createClient();

    if (isSignup) {
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim() },
          emailRedirectTo: redirectTo,
        },
      });

      if (authError) {
        setError(authError.message);
        setBusy(false);
        return;
      }

      if (data.session) {
        router.replace(next);
        router.refresh();
        return;
      }

      setMessage("Your account has been created. Check your email for a confirmation link, then come back here to sign in.");
      setBusy(false);
      return;
    }

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      setError(authError.message);
      setBusy(false);
      return;
    }

    router.replace(next);
    router.refresh();
  }

  async function signInWithGoogle() {
    setError("");
    setMessage("");
    setBusy(true);
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (authError) {
      setError(authError.message);
      setBusy(false);
    }
  }

  const alternateHref = isSignup
    ? `/login${searchParams.get("next") ? `?next=${encodeURIComponent(next)}` : ""}`
    : `/signup${searchParams.get("next") ? `?next=${encodeURIComponent(next)}` : ""}`;

  return (
    <div className="password-auth-form-wrap">
      <button className="button button-secondary button-wide auth-google" type="button" onClick={signInWithGoogle} disabled={busy}>
        <GoogleIcon />
        Continue with Google
      </button>
      <div className="auth-divider"><span>OR</span></div>
      <form className="password-auth-form" onSubmit={submit}>
        {isSignup && (
          <label className="field">
            Full name
            <input
              name="fullName"
              type="text"
              autoComplete="name"
              placeholder="Your name"
              minLength={2}
              required
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </label>
        )}
        <label className="field">
          Email address
          <input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="field">
          Password
          <input
            name="password"
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            placeholder={isSignup ? "At least 8 characters" : "Enter your password"}
            minLength={isSignup ? 8 : undefined}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {isSignup && (
          <label className="field">
            Confirm password
            <input
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Enter the password again"
              minLength={8}
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        {message && <p className="success-message" role="status">{message}</p>}
        <button className="button button-primary button-wide auth-submit" type="submit" disabled={busy}>
          {busy ? (isSignup ? "Creating your account…" : "Signing you in…") : (isSignup ? "Create account" : "Sign in")}
        </button>
      </form>
      <div className="auth-divider"><span>{isSignup ? "ALREADY A MEMBER?" : "NEW TO BRIGHTCART?"}</span></div>
      <p className="auth-switch-copy">
        {isSignup ? "Already have an account? " : "Create an account to save your cart and track orders. "}
        <Link className="text-link" href={alternateHref}>{isSignup ? "Sign in" : "Sign up"}</Link>
      </p>
      <p className="auth-legal">This demo uses Supabase email and password authentication. Checkout is a demo only; no card details are collected.</p>
    </div>
  );
}

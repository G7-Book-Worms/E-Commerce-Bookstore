"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";

type Mode = "signin" | "signup";

const inputClass =
  "w-full border rounded-md px-4 py-2 text-sm bg-transparent outline-none focus:ring-2 focus:ring-primary";

export default function SignInPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const isSignUp = mode === "signup";

  const switchMode = (next: Mode) => {
    setMode(next);
    setError("");
    setShowPassword(false);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    if (isSignUp) {
      const confirm = String(form.get("confirmPassword") ?? "");
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      if (password !== confirm) {
        setError("Passwords do not match.");
        return;
      }
    }

    // TODO: connect to your backend / auth provider here.
    // isSignUp -> create the account, otherwise -> sign the user in.
    console.log(isSignUp ? "Create account" : "Sign in", { email });
  };

  return (
    <main className="flex items-center justify-center px-4 py-12 sm:py-16">
      <div className="w-full max-w-md border rounded-xl bg-card p-6 sm:p-8 shadow-sm">
        <div className="space-y-1 mb-6">
          <h1 className="text-center text-2xl font-bold tracking-tight">
            {isSignUp ? "Create your account" : "Welcome back"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isSignUp
            }
          </p>
        </div>

        {/* Mode toggle */}
        <div
          role="tablist"
          aria-label="Sign in or create account"
          className="grid grid-cols-2 gap-1 p-1 mb-6 rounded-md bg-muted text-sm font-medium"
        >
          <button
            type="button"
            role="tab"
            aria-selected={!isSignUp}
            onClick={() => switchMode("signin")}
            className={`rounded px-3 py-1.5 transition-colors ${
              !isSignUp ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isSignUp}
            onClick={() => switchMode("signup")}
            className={`rounded px-3 py-1.5 transition-colors ${
              isSignUp ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate={false}>
          {isSignUp && (
            <div className="space-y-1.5">
              <label htmlFor="name" className="text-sm font-medium">
                Full name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                placeholder="Jane Doe"
                className={inputClass}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              className={inputClass}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              {!isSignUp && (
                <a
                  href="#"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Forgot password?
                </a>
              )}
            </div>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete={isSignUp ? "new-password" : "current-password"}
                required
                minLength={isSignUp ? 8 : undefined}
                placeholder={isSignUp ? "At least 8 characters" : "Your password"}
                className={`${inputClass} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 px-3 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {isSignUp && (
            <div className="space-y-1.5">
              <label htmlFor="confirmPassword" className="text-sm font-medium">
                Confirm password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                placeholder="Re-enter your password"
                className={inputClass}
              />
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            {isSignUp ? "Create account" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {isSignUp ? "Already have an account?" : "New here?"}{" "}
          <button
            type="button"
            onClick={() => switchMode(isSignUp ? "signin" : "signup")}
            className="font-medium text-foreground hover:underline"
          >
            {isSignUp ? "Sign in" : "Create an account"}
          </button>
        </p>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Link href="/" className="hover:text-foreground transition-colors">
            ← Back to store
          </Link>
        </p>
      </div>
    </main>
  );
}
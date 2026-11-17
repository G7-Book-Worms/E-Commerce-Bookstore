'use client';
import { safeInternalPath } from '@/lib/safe-redirect';

import React, { useState, Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { z } from 'zod';
import { useTurnstile } from '@/components/turnstile';
import { PasskeySignIn } from '@/components/auth/passkey-sign-in';
import { loginUser, AuthApiError, MfaRequiredError, sessionFromVerify } from '@/lib/api/auth';
import { TwoStepPrompt } from '@/components/auth/two-step-prompt';
import { useAuth } from '../../context/auth-context';
import { PasswordInput } from '@/components/ui/password-input';


// SCRUM-159: Zod Validation Schema matching backend rules
const clientLoginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email address is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required'),
  rememberMe: z.boolean().default(false),
});

type LoginFormData = z.infer<typeof clientLoginSchema>;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading, setUserSession } = useAuth();

  // Already signed in (or just signed in): go back to where the user came from, else home.
  // Same target as the submit handler, so this can't race it to a different page.
  useEffect(() => {
    if (!isLoading && user) {
      const next = searchParams.get('callbackUrl');
      router.replace(user.mustChangePassword ? '/account?tab=security' : safeInternalPath(next));
    }
  }, [user, isLoading, router, searchParams]);

  // Form State
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
    rememberMe: false,
  });

  // Validation & Error States
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof LoginFormData, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  // Set when the password was right but the account asks for a sign-in code next
  const [twoStep, setTwoStep] = useState<{ method: 'email' | 'totp' | 'sms'; sentTo: string | null } | null>(null);

  // SCRUM-165: Extract callbackUrl query parameter
  const callbackUrl = searchParams.get('callbackUrl');
  // Carried over to "Register Here", so a shopper who signs up instead still lands back where they were
  const safeCallback = callbackUrl && safeInternalPath(callbackUrl, '') ? callbackUrl : null;
  const human = useTurnstile('login');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));

    if (fieldErrors[name as keyof LoginFormData]) {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    }
    if (serverError) setServerError(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setServerError(null);

    // Validate client inputs
    const validationResult = clientLoginSchema.safeParse(formData);
    if (!validationResult.success) {
      const flattenedErrors = validationResult.error.flatten().fieldErrors;
      setFieldErrors({
        email: flattenedErrors.email?.[0],
        password: flattenedErrors.password?.[0],
      });
      // Enter with a field still empty: put the cursor in the first one that needs fixing
      document.getElementById(flattenedErrors.email ? 'email' : 'password')?.focus();
      return;
    }

    setFieldErrors({});
    if (!(await human.waitUntilReady())) {
      setServerError("The security check didn't finish. Refresh the page and try again.");
      return;
    }
    setIsSubmitting(true);

    try {
        const sessionData = await loginUser(validationResult.data, human.headers());
        setUserSession(sessionData.user);

        // Force a full browser navigation to ensure cookie is read in (main)
        // Only same-site paths: '//evil.com' would leave the site
        window.location.href = sessionData.user.mustChangePassword
          ? '/account?tab=security'
          : safeInternalPath(callbackUrl);
      } catch (err: unknown) {
        if (err instanceof MfaRequiredError) {
          setTwoStep({ method: err.method, sentTo: err.sentTo });
        } else if (err instanceof AuthApiError) {
          setServerError(err.message);
        } else {
          setServerError('Incorrect email address or password. Please try again.');
        }
      } finally {
        setIsSubmitting(false);
        human.reset(); // a token works once
      }
  };

  const destination = (mustChange: boolean) =>
    mustChange ? '/account?tab=security' : safeCallback ?? '/';

  if (twoStep) {
    return (
      <TwoStepPrompt
        method={twoStep.method}
        sentTo={twoStep.sentTo}
        onCancel={() => { setTwoStep(null); setFormData((f) => ({ ...f, password: '' })); }}
        onSuccess={(data) => {
          const session = sessionFromVerify(data.user);
          if (session) setUserSession(session);
          window.location.href = destination(!!session?.mustChangePassword);
        }}
      />
    );
  }

  return (
    <>
      {/* Title & shadcn "Register Here" Subtitle */}
      <div className="space-y-1 mb-6 text-left">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 font-serif">
          Sign In
        </h1>
        <p className="text-sm text-neutral-500">
          Don&apos;t have an account?{' '}
          <Link
            href={safeCallback ? `/user-register?callbackUrl=${encodeURIComponent(safeCallback)}` : '/user-register'}
            className="font-medium text-neutral-900 underline underline-offset-4 hover:text-neutral-600 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900 rounded-xs"
          >
            Register Here
          </Link>
        </p>
      </div>

      {/* Sent here by a password change, which signs out every device including this one */}
      {searchParams.get('passwordChanged') === '1' && !serverError && (
        <div role="status" className="mb-5 rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-900">
          Your password was changed, so every device was signed out - this one included. Sign in with your new password.
        </div>
      )}

      {/* Server Error Alert Banner */}
      {serverError && (
        <div
          role="alert"
          className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start space-x-2"
        >
          <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <span>{serverError}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Email Field */}
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-neutral-700">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            disabled={isSubmitting}
            value={formData.email}
            onChange={handleInputChange}
            aria-invalid={!!fieldErrors.email}
            aria-describedby={fieldErrors.email ? 'email-error' : undefined}
            className={`h-10 w-full rounded-md border bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 ${
              fieldErrors.email
                ? 'border-red-300 focus-visible:ring-red-500'
                : 'border-neutral-300 focus-visible:ring-neutral-900'
            }`}
            placeholder="reader@bookworms.com"
          />
          {fieldErrors.email && <p id="email-error" className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>}
        </div>

        {/* Password Field */}
        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-neutral-700">
            Password
          </label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            disabled={isSubmitting}
            value={formData.password}
            onChange={handleInputChange}
            aria-invalid={!!fieldErrors.password}
            aria-describedby={fieldErrors.password ? 'password-error' : undefined}
            className={`h-10 w-full rounded-md border bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 ${
              fieldErrors.password
                ? 'border-red-300 focus-visible:ring-red-500'
                : 'border-neutral-300 focus-visible:ring-neutral-900'
            }`}
          />
          {fieldErrors.password && <p id="password-error" className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>}
        </div>

        {/* Remember Me & Forgot Password */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center">
            <input
              id="rememberMe"
              name="rememberMe"
              type="checkbox"
              disabled={isSubmitting}
              checked={formData.rememberMe}
              onChange={handleInputChange}
              className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 disabled:opacity-50"
            />
            <label htmlFor="rememberMe" className="ml-2 block text-xs font-medium text-neutral-600 select-none">
              Remember me
            </label>
          </div>

          <Link
            href="/forgot-password"
            className="text-xs text-neutral-500 underline underline-offset-4 hover:text-neutral-900 transition-colors"
          >
            Forgot Password?
          </Link>
        </div>

        {human.widget}

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
            className="w-full h-10 flex justify-center items-center rounded-md bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 disabled:opacity-60 transition-colors shadow-xs"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-neutral-400 border-t-white rounded-full animate-spin" />
                <span>Signing In...</span>
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </div>
      </form>

      <div className="my-4 flex items-center gap-3 text-xs uppercase tracking-wider text-neutral-400" aria-hidden>
        <span className="h-px flex-1 bg-neutral-200" />or<span className="h-px flex-1 bg-neutral-200" />
      </div>
      <PasskeySignIn
        kind="customer"
        onSuccess={(data) => {
          const session = sessionFromVerify(data.user);
          if (session) setUserSession(session);
          window.location.href = destination(!!session?.mustChangePassword);
        }}
      />
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse bg-neutral-100 rounded-md" />}>
      <LoginForm />
    </Suspense>
  );
}
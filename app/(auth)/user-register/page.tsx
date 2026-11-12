'use client';

import React, { useState, Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { z } from 'zod';
import { registerUser, AuthApiError } from '@/lib/api/auth';
import { useAuth } from '../../context/auth-context';

// Mirrors registerInputSchema in server/src/modules/auth/auth-schema.ts
const clientRegisterSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(1, 'First name is required')
      .max(50, 'First name cannot exceed 50 characters'),
    lastName: z
      .string()
      .trim()
      .min(1, 'Last name is required')
      .max(50, 'Last name cannot exceed 50 characters'),
    email: z
      .string()
      .trim()
      .min(1, 'Email address is required')
      .email('Please enter a valid email address')
      .max(100, 'Email cannot exceed 100 characters'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters long')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type RegisterFormData = z.infer<typeof clientRegisterSchema>;
type FieldName = keyof RegisterFormData;

const inputClass = (hasError: boolean) =>
  `h-10 w-full rounded-md border bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 ${
    hasError
      ? 'border-red-300 focus-visible:ring-red-500'
      : 'border-neutral-300 focus-visible:ring-neutral-900'
  }`;

const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-neutral-700';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading, setUserSession } = useAuth();

  // Only allow same-site relative redirects
  const callbackUrl = searchParams.get('callbackUrl');
  const redirectTo = callbackUrl && callbackUrl.startsWith('/') && !callbackUrl.startsWith('//') ? callbackUrl : '/';

  // Already signed in: nothing to do here
  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/');
    }
  }, [user, isLoading, router]);

  const [formData, setFormData] = useState<RegisterFormData>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (fieldErrors[name as FieldName]) {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    }
    if (serverError) setServerError(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setServerError(null);

    const validationResult = clientRegisterSchema.safeParse(formData);
    if (!validationResult.success) {
      const flattened = validationResult.error.flatten().fieldErrors;
      setFieldErrors({
        firstName: flattened.firstName?.[0],
        lastName: flattened.lastName?.[0],
        email: flattened.email?.[0],
        password: flattened.password?.[0],
        confirmPassword: flattened.confirmPassword?.[0],
      });
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const { firstName, lastName, email, password } = validationResult.data;
      const sessionData = await registerUser({ firstName, lastName, email, password });
      setUserSession(sessionData.user);

      // Full navigation so the new auth cookie is picked up by the proxy and (main) layout
      window.location.href = redirectTo;
    } catch (err: unknown) {
      if (err instanceof AuthApiError) {
        setServerError(err.message);
      } else {
        setServerError('Registration failed. Please try again.');
      }
      setIsSubmitting(false);
    }
  };

  const renderField = (
    name: FieldName,
    label: string,
    type: string,
    autoComplete: string,
    placeholder?: string
  ) => (
    <div className="space-y-1.5">
      <label htmlFor={name} className={labelClass}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        disabled={isSubmitting}
        value={formData[name]}
        onChange={handleInputChange}
        aria-invalid={!!fieldErrors[name]}
        aria-describedby={fieldErrors[name] ? `${name}-error` : undefined}
        className={inputClass(!!fieldErrors[name])}
        placeholder={placeholder}
      />
      {fieldErrors[name] && (
        <p id={`${name}-error`} className="mt-1 text-xs text-red-600">
          {fieldErrors[name]}
        </p>
      )}
    </div>
  );

  const loginHref = callbackUrl ? `/user-login?callbackUrl=${encodeURIComponent(redirectTo)}` : '/user-login';

  return (
    <>
      <div className="space-y-1 mb-6 text-left">
        <h2 className="text-2xl font-bold tracking-tight text-neutral-900 font-serif">Create an Account</h2>
        <p className="text-sm text-neutral-500">
          Already have an account?{' '}
          <Link
            href={loginHref}
            className="font-medium text-neutral-900 underline underline-offset-4 hover:text-neutral-600 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900 rounded-xs"
          >
            Sign in here
          </Link>
        </p>
      </div>

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

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {renderField('firstName', 'First name', 'text', 'given-name')}
          {renderField('lastName', 'Last name', 'text', 'family-name')}
        </div>
        {renderField('email', 'Email address', 'email', 'email', 'reader@bookworms.com')}
        {renderField('password', 'Password', 'password', 'new-password')}
        <p className="-mt-2 text-xs text-neutral-500">
          At least 8 characters, with an uppercase letter, a lowercase letter, a number and a symbol.
        </p>
        {renderField('confirmPassword', 'Confirm password', 'password', 'new-password')}

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
                <span>Creating account...</span>
              </span>
            ) : (
              'Create Account'
            )}
          </button>
        </div>
      </form>
    </>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse bg-neutral-100 rounded-md" />}>
      <RegisterForm />
    </Suspense>
  );
}

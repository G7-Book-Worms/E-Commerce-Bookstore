// components/footer/Footer.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export const Footer: React.FC = () => {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatus(null);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('Message received! Our team will get back to you.');
        setFormData({ name: '', email: '', message: '' });
      } else {
        setStatus(data.message || 'Error sending message.');
      }
    } catch {
      setStatus('Failed to dispatch message.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <footer className="border-t border-stone-200 bg-stone-50 text-stone-700 pt-12 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 gap-10 pb-10 border-b border-stone-200">
        {/* Support & Brand Details */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">📚</span>
            <span className="font-serif font-bold text-lg text-stone-900 tracking-tight">Book Worms</span>
          </div>
          <p className="text-xs text-stone-500 max-w-sm leading-relaxed">
            Independent bookstore dedicated to literary preservation, curated genre feeds, and readers worldwide.
          </p>
          <div className="text-xs text-stone-500 space-y-1 pt-2 font-mono">
            <p>support@bookworms.com</p>
            <p>(555) 019-2834</p>
            <p>Mon - Sat: 9:00 AM - 8:00 PM CST</p>
          </div>
        </div>

        {/* Contact Form Card */}
        <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-2xs">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-900 mb-1">
            Contact Support
          </h3>
          <p className="text-xs text-stone-500 mb-3">Questions about orders or book recommendations?</p>

          {status && <p className="text-xs text-stone-900 font-medium mb-3">{status}</p>}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                aria-label="Your name"
                autoComplete="name"
                placeholder="Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-8 w-full rounded-md border border-stone-200 bg-white px-2.5 text-xs placeholder:text-stone-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-900"
              />
              <input
                type="email"
                required
                aria-label="Your email"
                autoComplete="email"
                placeholder="Email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="h-8 w-full rounded-md border border-stone-200 bg-white px-2.5 text-xs placeholder:text-stone-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-900"
              />
            </div>
            <textarea
              required
              rows={2}
              aria-label="Your message"
              placeholder="How can we help?"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              className="w-full rounded-md border border-stone-200 bg-white p-2.5 text-xs placeholder:text-stone-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-900"
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-8 px-3 rounded-md bg-stone-900 text-stone-50 text-xs font-medium hover:bg-stone-800 transition disabled:opacity-50"
            >
              {isSubmitting ? 'Sending...' : 'Send Message'}
            </button>
          </form>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 flex flex-wrap items-center justify-between gap-4 text-xs text-stone-400">
        <p>© 2026 Book Worms Bookstore. All rights reserved.</p>
        <div className="flex flex-wrap gap-x-2">
          <Link href="/about" className="inline-flex min-h-8 items-center px-1 hover:text-stone-900 transition">About</Link>
          <Link href="/about#shipping" className="inline-flex min-h-8 items-center px-1 hover:text-stone-900 transition">Shipping</Link>
          <Link href="/about#privacy" className="inline-flex min-h-8 items-center px-1 hover:text-stone-900 transition">Privacy</Link>
          <Link href="/about#terms" className="inline-flex min-h-8 items-center px-1 hover:text-stone-900 transition">Terms</Link>
        </div>
      </div>
    </footer>
  );
};
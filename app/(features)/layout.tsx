// app/(features)/layout.tsx
import React from 'react';
import { AuthProvider } from '../context/auth-context';
import { DemoDialog, DemoStrip } from '../../components/demo-notice';
import { Toaster } from '../../components/toast';
import '../globals.css';
import { CartProvider } from '../context/CartContext';
import { Header } from '../../components/header/Header';
import { Footer } from '../../components/footer/Footer';

export const metadata = {
  robots: { index: false, follow: false },
  title: 'Book Worms',
  description: 'Curated Bookstore Features',
};

export default function FeaturesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased">
        <AuthProvider>
          <CartProvider>
            <div className="flex min-h-screen flex-col">
              <DemoStrip />
            <Header />
              <main className="flex-1 min-w-0">{children}</main>
              <Footer />
            <Toaster />
            <DemoDialog />
            </div>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
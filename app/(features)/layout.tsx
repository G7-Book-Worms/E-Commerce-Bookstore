// app/(features)/layout.tsx
import React from 'react';
import { AuthProvider } from '../context/auth-context'; // adjust relative path if needed
import '../globals.css';
import { CartProvider } from '../context/CartContext';
import { Header } from '../../components/header/Header';
import { Footer } from '../../components/footer/Footer';

export const metadata = {
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
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
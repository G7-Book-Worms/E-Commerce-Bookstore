// app/(main)/layout.tsx
import '../globals.css';
import { CartProvider } from '../context/CartContext';
import { Header } from '../../components/header/Header';
import { Footer } from '../../components/footer/Footer';
import { AuthProvider } from '../context/auth-context';

export const metadata = {
  title: 'Book Worms | Curated Online Bookstore',
  description: 'Explore genre fiction, literary classics, and trending titles.',
};

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-stone-50 text-stone-900 antialiased">
        <AuthProvider>
          <CartProvider>
            <Header />
            <main className="flex-1 min-w-0">{children}</main>
            <Footer />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
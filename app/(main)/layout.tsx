// app/(main)/layout.tsx
import '../globals.css';
import { CartProvider } from '../context/CartContext';
import { Header } from '../../components/header/Header';
import { Footer } from '../../components/footer/Footer';
import { AuthProvider } from '../context/auth-context';
import { DemoDialog, DemoStrip } from '../../components/demo-notice';
import { Toaster } from '../../components/toast';

export const metadata = {
  robots: { index: false, follow: false },
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
            <DemoStrip />
            <Header />
            <main className="flex-1 min-w-0">{children}</main>
            <Footer />
            <Toaster />
            <DemoDialog />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
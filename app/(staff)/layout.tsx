// Staff portal root layout (SCRUM-187): no store header/footer, never indexed.
import '../globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { default: 'Staff Portal | Book Worms', template: '%s | Book Worms Staff' },
  robots: { index: false, follow: false },
};

export default function StaffRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-stone-100 text-stone-900 antialiased">{children}</body>
    </html>
  );
}

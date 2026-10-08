import "../globals.css";
import Link from "next/link";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-background text-foreground font-sans">
        
        {/* Single Centered Header */}
        <header className="py-6 text-center border-b flex-shrink-0">
          <Link href="/" className="text-2xl font-bold tracking-widest uppercase hover:opacity-80 transition-opacity">
            Book Worms
          </Link>
        </header>

        {/* Page Content Injected Here */}
        <div className="flex-1">
          {children}
        </div>

        {/* Minimal Global Footer */}
        <footer className="bg-muted/50 py-6 mt-auto border-t flex-shrink-0">
          <div className="text-center text-sm text-muted-foreground">
            &copy; 2026 Book Worms. All rights reserved.
          </div>
        </footer>

      </body>
    </html>
  );
}
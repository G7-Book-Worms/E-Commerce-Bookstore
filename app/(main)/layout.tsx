import "../globals.css";
import Link from "next/link";
import { ShoppingCart, User } from "lucide-react";

{/* */}
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-background text-foreground font-sans">
        
        {/* Global Header */}
        <header className="border-b py-4">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              
              <div className="text-xl font-bold flex-shrink-0">
                <a href="/">Book Worms</a>
              </div>
              {/*UI Search bar*/}
              <div className="w-full max-w-md relative flex items-center">
                <input 
                  type="text" 
                  placeholder="Search bt Title, Author, Keyword, ISBN" 
                  className="w-full border rounded-md px-4 py-2 text-sm bg-transparent outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              {/*UI Cart*/}
              <div className="flex items-center gap-3 text-sm font-medium">
                <Link
                  href="/cart"
                  className="inline-flex items-center gap-2 border rounded-md px-4 py-2 hover:bg-muted transition-colors"
                >
                  <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                  Cart
                </Link>
              {/*UI Sign In*/}
                <Link
                  href="/user-sign-in"
                  className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-md px-4 py-2 hover:bg-primary/90 transition-colors"
                >
                  <User className="h-4 w-4" aria-hidden="true" />
                  Sign In
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* page.tsx content placed here to fill page*/}
        <div className="flex-1">
          {children}
        </div>

        {/* Global Footer */}
        <footer className="bg-muted/50 py-12 mt-auto border-t">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
              
              <div className="space-y-3">
                <h3 className="font-bold text-lg">Book Worms</h3>
                <p className="text-sm text-muted-foreground">A quick way to connect you with the books you love </p>
              </div>
              
              <div className="space-y-3">
                <h5 className="font-semibold">Explore</h5>
                <nav className="flex flex-col gap-2 text-sm text-muted-foreground">
                  <a href="#" className="hover:text-foreground transition-colors">Link 1</a>
                  <a href="#" className="hover:text-foreground transition-colors">Link 2</a>
                </nav>
              </div>
              
              <div className="space-y-3">
                <h5 className="font-semibold">Support</h5>
                <nav className="flex flex-col gap-2 text-sm text-muted-foreground">
                  <a href="#" className="hover:text-foreground transition-colors">Link 1</a>
                  <a href="#" className="hover:text-foreground transition-colors">Link 2</a>
                </nav>
              </div>
              
              <div className="space-y-3 text-sm text-muted-foreground">
                <h5 className="font-semibold text-foreground">Contact Us</h5>
                <div>Email: onestop@utsa.edu</div>
                <div>Phone Number: (210) 458-4011</div>
                <div>Email Address: 501 W César E Chávez Blvd, San Antonio, TX 78207</div>
              </div>
            </div>
            
            <div className="mt-12 pt-8 border-t text-center text-sm text-muted-foreground">
              &copy; 2026 BookWorms. All rights reserved.
            </div>
          </div>
        </footer>

      </body>
    </html>
  );
}
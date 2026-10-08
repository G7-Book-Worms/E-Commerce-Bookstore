import { Lock } from "lucide-react";

// 1. This completely hides the page from Google and other search engines
export const metadata = {
  title: "Admin Portal",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminSignInPage() {
  return (
    <main className="max-w-md mx-auto mt-20 mb-24 px-4 sm:px-0">
      
      <div className="border border-primary/20 rounded-xl shadow-md bg-card p-6 sm:p-8 relative overflow-hidden">
        
        {/* Just a tiny design flair to make it look "restricted" */}
        <div className="absolute top-0 left-0 w-full h-1 bg-primary"></div>
        {/* The new flair for the bottom */}
        <div className="absolute bottom-0 left-0 w-full h-1 bg-primary"></div>
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="h-12 w-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Access</h1>
          <p className="text-muted-foreground text-sm mt-2">
            Authorized personnel only
          </p>
        </div>

        {/* Form */}
        <form className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="admin-email" className="text-sm font-medium">
              Admin Email
            </label>
            <input
              id="admin-email"
              type="email"
              placeholder="admin@bookworms.com"
              className="w-full border rounded-md px-4 py-2 text-sm bg-transparent outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="admin-password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              placeholder="••••••••"
              className="w-full border rounded-md px-4 py-2 text-sm bg-transparent outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-foreground text-background py-2.5 rounded-md font-medium hover:bg-foreground/90 transition-colors mt-2"
          >
            Access Dashboard
          </button>
        </form>
        
      </div>
    </main>
  );
}
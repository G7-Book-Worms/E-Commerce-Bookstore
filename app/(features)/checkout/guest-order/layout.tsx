// Page title for this client page (client components can't export metadata themselves).
// referrer: 'no-referrer' matters here: the URL carries the signed order token, and without it
// the browser would hand that token to any site this page links out to.
export const metadata = {
  title: 'Your order | Book Worms',
  referrer: 'no-referrer' as const,
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

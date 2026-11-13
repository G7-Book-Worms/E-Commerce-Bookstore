// Page title for this client page (client components can't export metadata themselves)
export const metadata = { title: 'My Account | Book Worms' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

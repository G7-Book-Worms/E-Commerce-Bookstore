// Shared layout for every /account/* page (info, addresses, orders, etc.).
// This is a NESTED layout: it renders inside the (main) root layout, which
// already provides <html>, <body>, the site header, and the footer.
// Do NOT add <html> or <body> tags here.
export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <section className="w-full">{children}</section>;
}

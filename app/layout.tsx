import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Playfair_Display} from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const playfair = Playfair_Display({
    subsets: ["latin"],
    variable: "--font-playfair",
});

export const metadata: Metadata = {
  title: "RowdyBooks",
  description: "UTSA\'s fakest bookstore!",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", "font-sans", playfair.variable)}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

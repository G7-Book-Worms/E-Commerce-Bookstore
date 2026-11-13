import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-4 text-center">
      <h2 className="text-2xl font-semibold">Page not found</h2>
      <Link href="/" className="underline">
        Back to the bookstore
      </Link>
    </div>
  );
}

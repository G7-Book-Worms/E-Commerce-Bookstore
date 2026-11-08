"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "sans-serif", textAlign: "center", paddingTop: "20vh" }}>
        <h2>Something went seriously wrong</h2>
        <button onClick={reset}>Reload</button>
      </body>
    </html>
  );
}

"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-4 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/empty-states/dark-kitten-blue-eyes.webp" alt="" width={240} height={180} className="h-36 w-auto" />
      <h2 className="font-serif text-2xl font-semibold">Something went wrong</h2>
      <p className="text-muted-foreground">This kitten is as surprised as you are. Please try again.</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}

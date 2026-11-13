import { Star } from "lucide-react";

// 5 stars filled to the book's average rating, plus the number of ratings
export function StarRating({ value, count, size = 14 }: { value: number; count?: number; size?: number }) {
  if (!count) {
    return <span className="text-xs text-muted-foreground">No ratings yet</span>;
  }
  return (
    <span className="inline-flex items-center gap-1" title={`${value.toFixed(1)} out of 5`}>
      <span className="relative inline-flex" aria-hidden>
        {/* Grey stars underneath, gold stars on top clipped to the rating */}
        <span className="flex text-stone-300">
          {Array.from({ length: 5 }, (_, i) => <Star key={i} size={size} fill="currentColor" strokeWidth={0} />)}
        </span>
        <span className="absolute inset-0 flex overflow-hidden text-amber-500" style={{ width: `${(value / 5) * 100}%` }}>
          {Array.from({ length: 5 }, (_, i) => <Star key={i} size={size} fill="currentColor" strokeWidth={0} className="shrink-0" />)}
        </span>
      </span>
      <span className="sr-only">{value.toFixed(1)} out of 5 stars</span>
      <span className="text-xs text-muted-foreground">({count.toLocaleString()})</span>
    </span>
  );
}

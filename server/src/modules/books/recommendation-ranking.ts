// server/src/modules/books/recommendation-ranking.ts
// The scoring behind "You may like" (see recommendations.ts). Pure, so it is unit-tested
// without a database.
import type { CatalogBook } from '../../../../lib/catalog';

export interface Recommendation {
  book: CatalogBook;
  score: number;
  /** Why it's suggested, shown under the tile ("Also by Agatha Christie") */
  reason: string;
}

export type Target = Pick<CatalogBook, 'bookId' | 'author' | 'tags'> & { category?: { name: string; slug: string } | null };
export type Candidate = CatalogBook & { categorySlug?: string | null };

const norm = (s: string) => s.trim().toLowerCase();

/** Pure scoring, so the ranking can be unit-tested without a database. */
export function rankRecommendations(target: Target, candidates: Candidate[], boughtTogether: Map<number, number>, limit = 12): Recommendation[] {
  const targetTags = new Set(target.tags.map(norm));
  const out: Recommendation[] = [];
  for (const c of candidates) {
    if (c.bookId === target.bookId) continue;
    const sameAuthor = norm(c.author) === norm(target.author);
    const sameGenre = !!target.category && !!c.categorySlug && c.categorySlug === target.category.slug;
    const shared = c.tags.filter((t) => targetTags.has(norm(t)));
    const together = boughtTogether.get(c.bookId) ?? 0;

    let score = 0;
    if (sameAuthor) score += 6;
    score += Math.min(9, together * 3);
    if (sameGenre) score += 3;
    score += Math.min(6, shared.length * 2);
    if (score === 0) continue; // nothing in common: not a recommendation
    if (c.totalStock > 0) score += 1;
    if (c.onSale) score += 0.5;
    score += c.ratingAvg / 10; // 0-0.5, breaks ties towards better-rated books

    const reason = sameAuthor
      ? `Also by ${c.author}`
      : together > 0
        ? 'Often bought together'
        : shared.length > 0
          ? `Also ${shared.slice(0, 2).join(' & ')}`
          : sameGenre && target.category
            ? `More ${target.category.name}`
            : 'You may like';
    out.push({ book: c, score, reason });
  }
  return out.sort((a, b) => b.score - a.score || a.book.title.localeCompare(b.book.title)).slice(0, limit);
}

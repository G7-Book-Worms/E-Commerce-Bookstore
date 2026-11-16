import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withPricing, type CatalogBook } from '../../../../lib/catalog';
import { rankRecommendations } from './recommendation-ranking';

let nextId = 100;
function book(over: Partial<CatalogBook> & { categorySlug?: string | null } = {}) {
  const { categorySlug = null, ...rest } = over;
  const b = withPricing({
    bookId: nextId++,
    isbn: String(nextId),
    title: `Book ${nextId}`,
    author: 'Someone Else',
    coverImageUrl: null,
    ratingAvg: 4,
    ratingCount: 10,
    tags: [],
    formats: [{ format: 'paperback', priceCents: 999, salePriceCents: null, stock: 5 }],
    ...rest,
  });
  return { ...b, categorySlug };
}

const target = { bookId: 1, author: 'Agatha Christie', tags: ['cozy', 'detective'], category: { name: 'Mystery', slug: 'mystery' } };

test('same author ranks first and says so', () => {
  const byAuthor = book({ author: 'Agatha Christie', title: 'Other Christie' });
  const sameGenre = book({ categorySlug: 'mystery' });
  const [first] = rankRecommendations(target, [sameGenre, byAuthor], new Map());
  assert.equal(first.book.bookId, byAuthor.bookId);
  assert.equal(first.reason, 'Also by Agatha Christie');
});

test('books with nothing in common are left out, and the book itself never appears', () => {
  const unrelated = book({ categorySlug: 'romance', tags: ['beach'] });
  const self = book({ bookId: 1, author: 'Agatha Christie' });
  assert.deepEqual(rankRecommendations(target, [unrelated, self], new Map()), []);
});

test('shared tags and genre add up, and the reason names the shared tags', () => {
  const tagsAndGenre = book({ categorySlug: 'mystery', tags: ['Cozy', 'detective'] });
  const genreOnly = book({ categorySlug: 'mystery' });
  const ranked = rankRecommendations(target, [genreOnly, tagsAndGenre], new Map());
  assert.equal(ranked[0].book.bookId, tagsAndGenre.bookId);
  assert.equal(ranked[0].reason, 'Also Cozy & detective');
  assert.equal(ranked[1].reason, 'More Mystery');
});

test('bought-together counts but is capped, so it adds to similarity instead of replacing it', () => {
  const boughtALot = book({ categorySlug: 'romance' });
  const byAuthor = book({ author: 'agatha christie' });
  const ranked = rankRecommendations(target, [boughtALot, byAuthor], new Map([[boughtALot.bookId, 50]]));
  assert.equal(ranked[0].reason, 'Often bought together'); // 9 > 6 + extras
  assert.ok(ranked[0].score < 11);
  assert.equal(ranked[1].book.bookId, byAuthor.bookId);
});

test('in-stock beats sold out when everything else is equal', () => {
  const soldOut = book({ categorySlug: 'mystery', title: 'A', formats: [{ format: 'paperback', priceCents: 999, salePriceCents: null, stock: 0 }] });
  const inStock = book({ categorySlug: 'mystery', title: 'B' });
  assert.equal(rankRecommendations(target, [soldOut, inStock], new Map())[0].book.bookId, inStock.bookId);
});

test('shelf tags and the genre itself don\'t count as shared tags', () => {
  const sameShelf = book({ categorySlug: 'romance', tags: ['bestseller', 'fiction', 'mystery'] });
  assert.deepEqual(rankRecommendations({ ...target, tags: ['bestseller', 'fiction', 'mystery'] }, [sameShelf], new Map()), []);
  const timeTravel = book({ categorySlug: 'mystery', tags: ['time-travel', 'fiction'] });
  const [r] = rankRecommendations({ ...target, tags: ['time-travel', 'fiction'] }, [timeTravel], new Map());
  assert.equal(r.reason, 'Also time travel');
});

test('respects the limit', () => {
  const many = Array.from({ length: 30 }, () => book({ categorySlug: 'mystery' }));
  assert.equal(rankRecommendations(target, many, new Map(), 12).length, 12);
});

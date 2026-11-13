// test-homepage-pipeline.ts
import 'dotenv/config';
import { BooksService } from './server/src/modules/books/books-service';

async function testHomepage() {
  console.log('--- [Step 1: Testing Homepage Backend Feeds] ---');
  const service = new BooksService();
  
  try {
    const feed = await service.getHomepageFeed();

    console.log('\n--- [Step 2: Active Promotion Feed] ---');
    console.log(feed.promotion);

    console.log('\n--- [Step 3: Carousels & Categories] ---');
    console.log(`Carousels loaded: ${feed.carousels.length}`);

    feed.carousels.forEach((carousel) => {
      console.log(`- Genre: ${carousel.categoryName} (${carousel.categorySlug}) -> ${carousel.books.length} books`);
      if (carousel.books.length > 0) {
        console.log(`   Sample book: "${carousel.books[0].title}" by ${carousel.books[0].author} ($${carousel.books[0].price})`);
      }
    });

    if (feed.carousels.length === 0) {
      console.warn('\n⚠️ Warning: No genre categories found. Make sure book_categories has rows.');
    } else {
      console.log('\n✅ PASS: Homepage data feed assembled successfully!');
    }
  } catch (err: any) {
    console.error('\n❌ FAIL: Homepage pipeline crashed:', err.message);
    if (err.cause) console.error('Underlying cause:', err.cause);
  }
}

testHomepage()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Unexpected crash:', err);
    process.exit(1);
  });
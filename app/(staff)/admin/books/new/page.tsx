import { Suspense } from 'react';
import { requireStaffPage } from '@/server/src/modules/staff/staff-page';
import { listCategories } from '@/server/src/modules/books/books-admin';
import { PageHeader, Panel } from '@/components/staff/ui';
import { BookForm } from '@/components/staff/book-form';

export const metadata = { title: 'Add a book' };

async function Content() {
  await requireStaffPage('inventory.update');
  const categories = await listCategories();
  return (
    <>
      <PageHeader title="Add a book" description="It appears in the store right away, on the shelves you pick." />
      <Panel className="max-w-4xl"><BookForm mode="create" categories={categories.map((c) => ({ categoryId: c.categoryId, name: c.name }))} /></Panel>
    </>
  );
}

export default function NewBookPage() {
  return <Suspense fallback={<p className="text-sm text-stone-500">Loading…</p>}><Content /></Suspense>;
}

import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { requireStaffPage } from '@/server/src/modules/staff/staff-page';
import { getBookForEdit, listCategories } from '@/server/src/modules/books/books-admin';
import { PageHeader, Panel } from '@/components/staff/ui';
import { BookForm } from '@/components/staff/book-form';

export const metadata = { title: 'Edit book' };

async function Content({ params }: { params: Promise<{ id: string }> }) {
  await requireStaffPage('inventory.manage');
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const [data, categories] = await Promise.all([getBookForEdit(id).catch(() => null), listCategories()]);
  if (!data) notFound();
  const { book, tags, formats } = data;
  return (
    <>
      <PageHeader title={`Edit “${book.title}”`} />
      <Panel className="max-w-4xl">
        <BookForm
          mode="edit"
          bookId={book.bookId}
          isbn={book.isbn}
          categories={categories.map((c) => ({ categoryId: c.categoryId, name: c.name }))}
          initial={{ title: book.title, author: book.author, description: book.description, categoryId: book.categoryId, coverImageUrl: book.coverImageUrl, tags }}
          existingFormats={formats.map((f) => f.format)}
        />
      </Panel>
    </>
  );
}

export default function EditBookPage(props: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<p className="text-sm text-stone-500">Loading…</p>}><Content {...props} /></Suspense>;
}

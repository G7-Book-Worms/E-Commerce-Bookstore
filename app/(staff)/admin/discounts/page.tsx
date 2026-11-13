import { Suspense } from 'react';
import { requireStaffPage } from '@/server/src/modules/staff/staff-page';
import { listDiscounts } from '@/server/src/modules/discounts/discounts-admin';
import { PageHeader, Panel } from '@/components/staff/ui';
import { DiscountManager } from './discount-manager';

export const metadata = { title: 'Discounts' };

async function Content() {
  await requireStaffPage('discounts.manage');
  const rows = await listDiscounts();
  const plain = rows.map((r) => ({
    id: r.discountCodeId,
    code: r.code,
    percentOff: r.percentOff,
    amountOffCents: r.amountOffCents,
    startsAt: r.startsAt ? r.startsAt.toISOString() : null,
    endsAt: r.endsAt ? r.endsAt.toISOString() : null,
    maxUses: r.maxUses,
    timesUsed: r.timesUsed,
    isActive: r.isActive,
  }));
  return (
    <>
      <PageHeader title="Discounts" description="Codes shoppers type in the cart. Put individual books on sale from the Inventory page." />
      <Panel><DiscountManager rows={plain} /></Panel>
    </>
  );
}

export default function DiscountsPage() {
  return <Suspense fallback={<p className="text-sm text-stone-500">Loading…</p>}><Content /></Suspense>;
}

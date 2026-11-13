import { z } from 'zod';
import { staffApi, idParam } from '@/server/src/modules/staff/staff-api';
import { HttpResponse } from '@/server/src/shared/http/api-response';
import { staffStockChange, updateFormatPricing } from '@/server/src/modules/inventory/inventory-service';

const stockSchema = z.object({
  kind: z.enum(['restock', 'adjustment']),
  quantityChange: z.number().int().refine((n) => n !== 0, 'Enter a number other than zero').refine((n) => Math.abs(n) <= 10000, 'That is too many'),
  note: z.string().trim().max(255).optional().nullable(),
}).refine((d) => d.kind !== 'restock' || d.quantityChange > 0, { message: 'A restock adds copies', path: ['quantityChange'] })
  .refine((d) => d.kind !== 'adjustment' || !!d.note, { message: 'Say why the count changed (e.g. damaged copy)', path: ['note'] });

const pricingSchema = z.object({
  priceCents: z.number().int().min(1).max(100000).optional(),
  salePriceCents: z.number().int().min(1).max(100000).nullable().optional(),
  lowStockThreshold: z.number().int().min(0).max(1000).optional(),
});

// POST /api/staff/inventory/:bookFormatId { kind, quantityChange, note } -> restock or correct the count
export const POST = staffApi('inventory.update', async (req, { params, log, staff }) => {
  const id = idParam(params.id);
  const input = stockSchema.parse(await req.json());
  const change = await staffStockChange(staff.id, id, input.kind, input.quantityChange, input.note ?? null);
  await log(`inventory.${input.kind}`, { bookFormatId: id, quantityChange: input.quantityChange, stockAfter: change.stockAfter, note: input.note ?? null });
  return HttpResponse.success(change, input.kind === 'restock' ? 'Restocked' : 'Stock corrected');
});

// PATCH /api/staff/inventory/:bookFormatId { priceCents?, salePriceCents?, lowStockThreshold? }
export const PATCH = staffApi('inventory.update', async (req, { params, log }) => {
  const id = idParam(params.id);
  const input = pricingSchema.parse(await req.json());
  const result = await updateFormatPricing(id, input);
  await log('inventory.pricing_changed', { bookFormatId: id, ...result });
  return HttpResponse.success(result.after, 'Saved');
});

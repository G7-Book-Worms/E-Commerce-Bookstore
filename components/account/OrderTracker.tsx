// components/account/OrderTracker.tsx
'use client';

// The progress tracker on a customer's order (session 4): dots along a line that fill as the
// order advances, plus the tracking number and a link to the carrier's own tracking page.
//
// The stages come from `orderProgress`, which maps the four real `orders.status` values onto
// three dots and reports `cancelled` separately — a cancelled order is a terminal state, not
// a point on the line, so it replaces the tracker instead of appearing on it.
//
// Nothing here invents events. The only facts shown are the status the staff set, the number
// they typed in, and a link to the carrier's page; no carrier API is called.

import React from 'react';
import { ExternalLink, XCircle } from 'lucide-react';
import { orderProgress } from '@/server/src/modules/orders/order-progress';
import { shipmentView } from '@/server/src/modules/orders/carriers';

export function OrderTracker({
  status,
  carrier,
  trackingNumber,
  orderId,
}: {
  status: string;
  /** orders.carrier and orders.tracking_number, as the API returns them */
  carrier: string | null;
  trackingNumber: string | null;
  orderId: number;
}) {
  const progress = orderProgress(status);
  const shipment = shipmentView(carrier, trackingNumber);

  if (progress.cancelled) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden />
        <div className="text-sm">
          <p className="font-semibold text-red-800">This order was cancelled</p>
          <p className="text-red-700">
            Nothing will be shipped. Any test payment was refunded automatically.
          </p>
        </div>
      </div>
    );
  }

  const currentStep = progress.steps.find((s) => s.current);

  return (
    <div className="space-y-4">
      {/* The line itself. aria-hidden because the same information is in the list below,
          where a screen reader gets it as words rather than as decoration. */}
      <div className="relative px-1 pt-1" aria-hidden>
        <div className="absolute left-[calc(0.25rem+9px)] right-[calc(0.25rem+9px)] top-[13px] h-0.5 rounded bg-stone-200" />
        <div
          className="absolute left-[calc(0.25rem+9px)] top-[13px] h-0.5 rounded bg-emerald-600 transition-[width] duration-500"
          style={{ width: `calc((100% - 0.5rem - 18px) * ${progress.percent / 100})` }}
        />
        <ol className="relative flex justify-between">
          {progress.steps.map((step) => (
            <li key={step.stage} className="flex flex-col items-center gap-1.5" style={{ width: `${100 / progress.steps.length}%` }}>
              <span
                className={`flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 transition-colors ${
                  step.done ? 'border-emerald-600 bg-emerald-600' : 'border-stone-300 bg-white'
                } ${step.current ? 'ring-4 ring-emerald-100' : ''}`}
              >
                {step.done && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
              </span>
              <span className={`text-center text-xs ${step.done ? 'font-semibold text-stone-900' : 'text-stone-400'}`}>
                {step.label}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {/* The same progress as text, which is what assistive tech reads */}
      <ol className="sr-only">
        {progress.steps.map((step) => (
          <li key={step.stage}>
            {step.label}: {step.current ? 'current stage' : step.done ? 'done' : 'not yet'}
          </li>
        ))}
      </ol>
      {currentStep && (
        <p className="text-sm text-stone-600">
          <span className="font-semibold text-stone-900">{currentStep.label}.</span> {currentStep.hint}
        </p>
      )}

      {shipment && (
        <div className="rounded-lg border border-stone-200 bg-white p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-stone-900">
            {shipment.carrierLabel ? `${shipment.carrierLabel} tracking` : 'Tracking'}
          </p>
          <p className="mt-1 font-mono text-sm break-all text-stone-700">{shipment.trackingNumber}</p>
          {shipment.trackingUrl ? (
            <a
              href={shipment.trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 text-sm font-semibold text-stone-900 hover:underline"
            >
              Track on {shipment.carrierLabel}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              <span className="sr-only">(opens {shipment.carrierLabel} in a new tab)</span>
            </a>
          ) : (
            <p className="mt-1 text-xs text-stone-500">
              We don&apos;t know which carrier this number belongs to, so there is no link to follow.
            </p>
          )}
        </div>
      )}
      {!shipment && progress.steps[1].done && (
        <p className="text-sm text-stone-500">No tracking number was recorded for order #{orderId}.</p>
      )}
    </div>
  );
}

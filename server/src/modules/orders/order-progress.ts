// The customer-facing shape of an order's progress (session 4).
//
// Pure: no database, no `server-only`, so the account Orders tab imports it directly.
//
// `orders.status` really only has four values — pending, transit, arrived, cancelled — and
// three of them are stages on one line. Delivery is not a fourth stage with its own dot: an
// order that has arrived has finished the line. `cancelled` is not on the line at all; it is
// a terminal state that replaces the tracker, which is why `cancelled` is reported
// separately instead of being squeezed in as a stage.

export const ORDER_STAGES = ['pending', 'transit', 'arrived'] as const;
export type OrderStage = (typeof ORDER_STAGES)[number];

export const STAGE_LABELS: Record<OrderStage, string> = {
  pending: 'Order placed',
  transit: 'Shipped',
  arrived: 'Delivered',
};

export const STAGE_HINTS: Record<OrderStage, string> = {
  pending: 'We have your order and are preparing it.',
  transit: 'On its way to your address.',
  arrived: 'Marked as delivered.',
};

export interface ProgressStep {
  stage: OrderStage;
  label: string;
  hint: string;
  /** This stage has been reached. */
  done: boolean;
  /** This is the stage the order is sitting at right now. */
  current: boolean;
}

export interface OrderProgress {
  /** True when the order was cancelled: show the terminal state, not the line. */
  cancelled: boolean;
  steps: ProgressStep[];
  /** How far along the line to paint the fill, 0-100. */
  percent: number;
}

/**
 * Maps a real order status onto the three-dot line.
 *
 * A cancelled order reports `cancelled: true` with no stage marked current, so callers show
 * it as its own terminal state instead of as a point on the line. An unrecognised status is
 * treated as `pending` rather than throwing, so one bad row can't blank out the page.
 */
export function orderProgress(status: string | null | undefined): OrderProgress {
  if (status === 'cancelled') {
    return {
      cancelled: true,
      steps: ORDER_STAGES.map((stage) => ({
        stage,
        label: STAGE_LABELS[stage],
        hint: STAGE_HINTS[stage],
        done: false,
        current: false,
      })),
      percent: 0,
    };
  }

  const index = Math.max(0, (ORDER_STAGES as readonly string[]).indexOf(status ?? 'pending'));
  return {
    cancelled: false,
    steps: ORDER_STAGES.map((stage, i) => ({
      stage,
      label: STAGE_LABELS[stage],
      hint: STAGE_HINTS[stage],
      done: i <= index,
      current: i === index,
    })),
    percent: Math.round((index / (ORDER_STAGES.length - 1)) * 100),
  };
}

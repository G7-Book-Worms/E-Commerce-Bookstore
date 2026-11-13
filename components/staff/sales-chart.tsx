// Bar chart of daily revenue (inline SVG, no chart library). Each bar has a text label for screen readers.
import { money } from './ui';

export function SalesChart({ data }: { data: { day: string; orders: number; revenueCents: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.revenueCents));
  const total = data.reduce((s, d) => s + d.revenueCents, 0);
  const orders = data.reduce((s, d) => s + d.orders, 0);
  const W = 560, H = 160, gap = 6;
  const bw = (W - gap * (data.length - 1)) / data.length;
  return (
    <figure>
      <figcaption className="mb-3 text-sm text-stone-600">
        <span className="font-semibold text-stone-900">{money(total)}</span> from {orders} order{orders === 1 ? '' : 's'}
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H + 22}`} className="h-auto w-full" role="img" aria-label="Daily revenue for the last 14 days">
        <line x1="0" x2={W} y1={H} y2={H} stroke="#e7e5e4" />
        {data.map((d, i) => {
          const h = d.revenueCents ? Math.max(3, (d.revenueCents / max) * (H - 10)) : 0;
          const x = i * (bw + gap);
          const label = new Date(`${d.day}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          return (
            <g key={d.day}>
              <title>{`${label}: ${money(d.revenueCents)}, ${d.orders} order${d.orders === 1 ? '' : 's'}`}</title>
              <rect x={x} y={H - h} width={bw} height={h} rx="3" fill="#14532d" />
              {(i % 2 === 0 || data.length <= 7) && (
                <text x={x + bw / 2} y={H + 15} textAnchor="middle" fontSize="10" fill="#78716c">{label}</text>
              )}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

// The site's own address, for links in emails (password reset, order lookup, sign-in alerts).
//
// - A Vercel preview links to its own branch address, so links in its emails open the preview
//   that sent them (VERCEL_BRANCH_URL is set by Vercel on every preview deployment).
// - Otherwise SITE_URL (https://bookwrms.store in production), then Vercel's production domain,
//   then localhost for local development.
export function siteUrl(env: Record<string, string | undefined> = process.env): string {
  const strip = (u: string) => u.replace(/\/+$/, '');
  if (env.VERCEL_ENV === 'preview' && env.VERCEL_BRANCH_URL) return `https://${strip(env.VERCEL_BRANCH_URL)}`;
  if (env.SITE_URL) return strip(env.SITE_URL);
  if (env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${strip(env.VERCEL_PROJECT_PRODUCTION_URL)}`;
  return 'http://localhost:3000';
}

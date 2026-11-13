<div align="center">

# Book Worms

**A full-stack demo bookstore**
<br>
<sub>CS 3773 · Software Engineering · The University of Texas at San Antonio</sub>

<br>

[![Next.js](https://img.shields.io/badge/Next.js-16.4-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19.3-149ECA?style=for-the-badge&logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

[![shadcn/ui](https://img.shields.io/badge/shadcn%2Fui-base--vega-111111?style=flat-square&logo=shadcnui&logoColor=white)](https://ui.shadcn.com)
[![Lucide](https://img.shields.io/badge/icons-Lucide-F56565?style=flat-square&logo=lucide&logoColor=white)](https://lucide.dev)
[![pnpm](https://img.shields.io/badge/pnpm-12-F69220?style=flat-square&logo=pnpm&logoColor=white)](https://pnpm.io)
[![ESLint](https://img.shields.io/badge/ESLint-9-4B32C3?style=flat-square&logo=eslint&logoColor=white)](https://eslint.org)
[![Status](https://img.shields.io/badge/status-in_development-F2A900?style=flat-square)](#features)
[![Course](https://img.shields.io/badge/CS_3773-F15A22?style=flat-square&labelColor=0C2340&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNTQ4IiBoZWlnaHQ9IjYwMCIgdmVyc2lvbj0iMS4wIiB2aWV3Qm94PSIwIDAgMTE2MSA0NTAiPjxwYXRoIGZpbGw9IiNmZmYiIGZpbGwtcnVsZT0iZXZlbm9kZCIgZD0iTTY2My4xIDI3LjZjLTI5LjggNC4zLTU4LjcgMTcuNy03NC41IDM0LjMtNC40IDQuNi00LjYgNC4yLTQuNi0xMC45VjM3bC0xNTcuNy0uMWMtODYuOCAwLTE2MC4zLS4xLTE2My4zLS4ybC01LjUtLjItLjUgMTE3Yy0uNiAxMjcuOS0uNSAxMjUuMy02LjYgMTQzLjQtOC42IDI1LjYtMjUuNSAzOC40LTUzLjcgNDAuNy0zMy45IDIuNy01OC41LTEzLTY3LjEtNDIuOC01LjUtMTktNS42LTIxLjItNS42LTE0MS45IDAtNjEuMi0uMy0xMTIuMy0uNi0xMTMuNmwtLjYtMi4zLTQ2LjctLjJjLTI1LjYtLjItNDcuNiAwLTQ4LjkuNGwtMi4zLjguNCAxMjIuN2MuNCAxMzEuNS41IDEzNCA1LjYgMTU3IDExLjcgNTEuOCA0NS4yIDg0LjYgMTAwLjkgOTguNyAzOSA5LjkgODIuNCA5LjYgMTIxLjItMSA1Mi4zLTE0LjIgODYuMi00OC4yIDk2LjYtOTYuOSA0LjYtMjEuNyA0LjctMjMgNS4zLTExM2wuNi04Nmg0OWwuMyAxNDYuNGMuMSA5OS44LjUgMTQ2LjcgMS4yIDE0Ny4xIDEuNS45IDgxLjIgMS4zIDg5LjkuNGw3LjEtLjcuMi0xNDYuNi4zLTE0Ni42IDI1LjgtLjNjMjkuMi0uMyAyNy43LS43IDI1LjcgOC0xLjggOC4yLTIuNCAzMy0xLjEgNDQuNSA0LjEgMzUuMiAxOS43IDU1LjkgNTMuNSA3MS41IDggMy42IDMxLjUgMTEuNSA1OS4xIDE5LjcgMzYuNyAxMSA1MS40IDI1LjEgNDcuNiA0NS43LTYuNSAzNC43LTU1LjEgNDIuNi0xMDEuOSAxNi42LTQuNi0yLjYtMTMuNC04LjQtMTkuNC0xMy02LjEtNC41LTExLjgtOC4yLTEyLjctOC4yLTEuMSAwLTUgNi40LTEyLjQgMjAuMi01LjkgMTEuMi0xMS44IDIyLjMtMTMuMiAyNC44LTE4LjIgMzMuOS0xNy44IDMxLjUtNy40IDM3LjkgNzAuOCA0My45IDE1OC40IDQ4LjcgMjE1LjYgMTEuOSAxMC4zLTYuNiA5LjYtNi40IDguOC0zLjctLjMgMS4zLTEgMy4zLTEuNSA0LjQtMy42IDcuNy00LjkgMTIuNS0zLjcgMTMuMiAxLjUgMSA4OS45IDEuOCA5NyAuOWw1LjQtLjcgMTIuOS0zMi41IDEyLjktMzIuNCA2Ny45LjMgNjcuOS4yIDEyLjEgMzIuMmMxMC42IDI4LjQgMTIuMyAzMi4zIDE0LjUgMzIuOCAyLjcuNyA5OC45LjUgMTAwLjctLjIuOS0uMy40LTIuNi0xLjYtOC4xLTIuNS02LjctMjYuOS03MS40LTU4LjItMTU0LjItMTYuOC00NC41LTI4LjgtNzYuMy00OC42LTEyOS0xMC41LTI3LjgtMjItNTguMi0yNS41LTY3LjVsLTYuNC0xN0g5MDkuN2wtNC44IDEyYy0yLjYgNi42LTguMiAyMS0xMi40IDMycy05LjYgMjQuOS0xMS45IDMxYy0yLjQgNi02LjggMTcuNS05LjkgMjUuNS0zIDgtOS44IDI1LjUtMTUgMzktNS4zIDEzLjUtMTQuMSAzNi40LTE5LjcgNTEtMTkuNSA1MS4xLTIwIDUyLjMtMjAgNDYuMyAwLTExLjEtNi41LTI5LjgtMTQuNS00MS45LTE1LjYtMjMuNC0zOS0zNy4zLTg2LjctNTEuNC01Mi40LTE1LjUtNjQuOC0yNi4yLTU4LjctNTAuOSAxLTMuOCAxMC44LTEyLjkgMTcuNC0xNi4yIDIyLjYtMTEuMSA1OC45LTQuMiA4NC42IDE2LjEgNC42IDMuNyAyLjcgNi4zIDE5LjQtMjYuNSA3LjYtMTQuOSAxNS44LTMwLjkgMTguMy0zNS43IDIuNS01IDQuMi05LjQgMy44LTEwLjMtLjYtMS42LTE0LjEtOC40LTI1LjYtMTIuOC0zOC42LTE0LjgtODEuMi0yMS40LTExMC45LTE3LjFtMzIwLjIgMTg0LjZjMTAuOCAzMi42IDE5LjcgNTkuNiAxOS43IDYwIDAgLjUtMTguMi44LTQwLjUuOHMtNDAuNS0uNC00MC41LS44YzAtLjUgMi41LTggNS41LTE2LjggOC42LTI1LjIgMzQuNS0xMDEuOCAzNC41LTEwMi4xIDAtMy43IDUgMTAgMjEuMyA1OC45Ii8+PC9zdmc+)](https://www.utsa.edu)

<br>

[Overview](#overview) &nbsp;·&nbsp;
[Features](#features) &nbsp;·&nbsp;
[Tech Stack](#tech-stack) &nbsp;·&nbsp;
[Getting Started](#getting-started) &nbsp;·&nbsp;
[Structure](#project-structure) &nbsp;·&nbsp;
[Contributing](#contributing) &nbsp;·&nbsp;
[Team](#team)

</div>

---

## Overview

**Book Worms** is a storefront where customers can browse, search, and purchase books. It is being built incrementally for CS 3773, with the system scoped into four sides — **customer**, **inventory**, **employee**, and **administrative** — and delivered in phases.

The app is a single Next.js project: pages live in `app/`, and the backend is a set of **API route handlers** (`app/api/**`) backed by a layered server module (`server/src/`) and a **MySQL** database hosted on **Aiven**, accessed through **Drizzle ORM**.

> [!NOTE]
> This is an academic project, live at **https://bookwrms.store** with a "class project, don't buy anything" notice.
> Payments run in Stripe **test mode** and are refunded automatically; nothing ships.

---

## Features

| | Feature | Route | Status |
|:-:|:--|:--|:-:|
| ◆ | Homepage: sale banner, promo cards, genre tiles, live book rows | `/` | ● Done |
| ◆ | Catalog sections, See All with filters/sort/search, product page with formats | `/product-catalog`, `/product/[isbn]` | ● Done |
| ◆ | Sign up, sign in (Remember me), sign out; password strength meter | `/user-register`, `/user-login` | ● Done |
| ◆ | Forgot password: emailed one-time reset link (30 minutes) | `/forgot-password`, `/reset-password` | ● Done |
| ◆ | Account: profile, order history, addresses, password | `/account` | ● Done |
| ◆ | Cart with formats, sale prices, discount codes, 8.25% tax | `/cart` | ● Done |
| ◆ | Stripe Checkout (test mode, auto-refund), confirmation page and email | `/checkout` | ● Done |
| ◆ | Emails from no-reply@bookwrms.store: welcome, order, status, password | — | ● Done |
| ◆ | Contact Support form saved to the staff inbox; replies emailed from support@ | footer | ● Done |
| ◆ | Staff portal sign-in (email + password + employee ID) with roles | `/staff-login` | ● Done |
| ◆ | Dashboard: revenue, sales chart, low-stock alerts, best sellers | `/admin` | ● Done |
| ◆ | Orders: sort by date/customer/total/status, ship, deliver, cancel (restocks) | `/admin/orders` | ● Done |
| ◆ | Inventory: restock, correct counts, prices, sale prices, low-stock alerts, movement history | `/admin/inventory` | ● Done |
| ◆ | Discount codes, customers (deactivate, temporary password, sign out everywhere), staff accounts | `/admin/...` | ● Done |
| ◆ | Activity log of every customer, staff and system action | `/admin/activity` | ● Done |

<sub>● Done &nbsp; ◐ In progress &nbsp; ○ Planned</sub>

---

## Tech Stack

<table>
<tr>
<td valign="top" width="50%">

**Framework & Language**
- [Next.js 16](https://nextjs.org) — App Router, Turbopack, Cache Components, `proxy.ts`
- [React 19](https://react.dev)
- [TypeScript 5](https://www.typescriptlang.org)

</td>
<td valign="top" width="50%">

**Styling & UI**
- [Tailwind CSS 4](https://tailwindcss.com) with `tw-animate-css`
- [shadcn/ui](https://ui.shadcn.com) on [Base UI](https://base-ui.com)
- [Embla Carousel](https://www.embla-carousel.com) · [Lucide](https://lucide.dev) icons

</td>
</tr>
<tr>
<td valign="top">

**Data & Backend**
- MySQL on [Aiven](https://aiven.io)
- [Drizzle ORM](https://orm.drizzle.team) + drizzle-kit migrations
- [Zod](https://zod.dev) request and environment validation

</td>
<td valign="top">

**Auth & Tooling**
- bcrypt password hashing, JWT in an httpOnly cookie (`jsonwebtoken`, `jose`)
- [pnpm](https://pnpm.io) · [ESLint 9](https://eslint.org) · [tsx](https://tsx.is) for scripts
- Planned: [Stripe](https://stripe.com) for card payments

</td>
</tr>
</table>

---

## Getting Started

### Prerequisites

- **Node.js** 20.9 or newer
- **pnpm** — enable it through Corepack:

```bash
corepack enable
```

- A **MySQL** database: either the team's Aiven database (ask for access) or a local MySQL for development (`brew install mysql && brew services start mysql`)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/G7-Book-Worms/E-Commerce-Bookstore.git
cd E-Commerce-Bookstore

# 2. Install dependencies
pnpm install

# 3. Create your environment file (never commit it)
cp .env.example .env
```

### Environment variables

Fill in `.env` in the project root (next to `package.json`):

| Variable | Description |
|:--|:--|
| `DATABASE_URL` | MySQL connection string. For Aiven, copy the **Service URI** from the service's overview page and remove `?ssl-mode=REQUIRED` from the end. |
| `DB_SSL` | `true` for Aiven. `false` only for a local MySQL without TLS. |
| `DB_CA_CERT` | Optional. Aiven's CA certificate (PEM, `\n` for line breaks); when set the database certificate is verified. |
| `JWT_SECRET` | Random string, at least 32 characters. Generate one with `openssl rand -hex 32`. |
| `STRIPE_SECRET_KEY` | Stripe **test** secret key (`sk_test_…`). The server refuses live keys. |
| `STRIPE_AUTO_REFUND` | Test charges are refunded right after checkout unless this is `false`. |
| `SITE_URL` | Public URL used in emails and Stripe return links (`https://bookwrms.store` on Vercel). |
| `SMTP_HOST`, `SMTP_PORT` | `mail.privateemail.com`, `465`. Leave out locally: emails are printed to the server console instead. |
| `NOREPLY_EMAIL`, `NOREPLY_EMAIL_PASSWORD` | Mailbox that sends account and order emails. |
| `SUPPORT_EMAIL`, `SUPPORT_EMAIL_PASSWORD` | Reply-to address; staff replies and low-stock alerts use it. |

Security measures are listed in [`docs/security.md`](docs/security.md).

> [!CAUTION]
> `.env` holds the database password. It is ignored by git (`.env*` in `.gitignore`); never paste it into chat, issues, or commits.

### Database

The shared Aiven database is already migrated. For a **new or local** database:

```bash
pnpm db:migrate   # create/update all tables from server/db/migrations
pnpm db:seed      # load test data; the catalog part (stock, prices, codes) is re-applied every run
```

Every seeded account uses the password **`BookWorms123!`** — for example `ada.lovelace@example.com`.

Staff portal (`/staff-login`), one demo account per role, all with `BookWorms123!`:

| Role | Email | Employee ID | Can use |
|:--|:--|:--|:--|
| Administrator | `grace@example.com` | `BW-1001` | everything, including staff accounts |
| Manager | `edsger@example.com` | `BW-1002` | + discounts, customers, activity log |
| Employee | `barbara@example.com` | `BW-1003` | dashboard, orders, inventory, messages |

### Before the presentation

> [!IMPORTANT]
> Run this against Aiven **before the presentation** (and after every rehearsal):
>
> ```bash
> pnpm demo:reset
> ```
>
> It runs the catalog seed (stock, prices, sale prices and discount codes go back to the test data, undoing
> rehearsal purchases), resets the demo accounts `ada.lovelace@example.com` and `alan.turing@example.com` to
> the password `BookWorms123!`, and **empties the demo account's cart** so the demo starts from an empty cart.
> It also resets the three demo staff accounts and clears every sign-in lockout.
> Then sign in once and check the cart is empty.

To pay during the demo, use Stripe's test card `4242 4242 4242 4242`, any future date and any CVC.

### Run

```bash
pnpm dev
```

Then open **[http://localhost:3000](http://localhost:3000)** in your browser.

### Scripts

| Command | Description |
|:--|:--|
| `pnpm dev` | Start the development server with hot reload |
| `pnpm build` | Create an optimized production build (run before every PR) |
| `pnpm start` | Serve the production build |
| `pnpm lint` | Run ESLint across the project (there are existing warnings; don't add new ones) |
| `pnpm db:generate` | Create a new migration after changing `server/db/schema.ts` |
| `pnpm db:migrate` | Apply pending migrations to the database in `DATABASE_URL` |
| `pnpm db:seed` | Load test data from `server/db/test-data/`; the catalog part (stock, prices, codes) is re-applied every run |
| `pnpm demo:reset` | Before the presentation: re-seed the catalog, reset demo customer and staff passwords, empty the demo carts, clear lockouts |
| `pnpm test` | Run the unit tests (`server/**/*.test.ts`) |
| `pnpm db:studio` | Browse the database in Drizzle Studio |

---

## Project Structure

```text
E-Commerce-Bookstore/
├── app/
│   ├── (main)/                      ─ storefront layout + landing page
│   ├── (features)/
│   │   ├── account/                 ─ account dashboard (/account)
│   │   ├── cart/                    ─ shopping cart (/cart)
│   │   ├── product/[isbn]/          ─ product detail page
│   │   └── product-catalog/         ─ catalog sections + /all browser
│   ├── (auth)/
│   │   ├── user-login/              ─ customer sign-in
│   │   ├── user-register/           ─ customer registration
│   │   └── admin-portal-login-obscure/  ─ admin login
│   ├── api/                         ─ route handlers (auth, books, cart, orders, users, health)
│   ├── context/                     ─ React context: auth and cart state
│   ├── error.tsx, global-error.tsx, not-found.tsx  ─ error pages
│   └── globals.css
├── components/                      ─ UI: header, footer, home, account tabs, shadcn/ui
├── lib/
│   ├── api/                         ─ browser-side API clients (auth.ts, user.ts)
│   └── sample-books.ts              ─ legacy sample catalog (being replaced by the database)
├── server/
│   ├── db/
│   │   ├── schema.ts                ─ ★ single source of truth for every table
│   │   ├── index.ts                 ─ shared database connection
│   │   ├── migrations/              ─ generated migrations, migrate.ts, seeds/
│   │   ├── test-data/               ─ JSON seed data
│   │   └── checks/                  ─ SQL and seed-data checks
│   └── src/
│       ├── config/                  ─ environment validation (zod)
│       ├── modules/<feature>/       ─ schema → repository → service → controller
│       ├── shared/                  ─ errors, HTTP responses, auth middleware, utils
│       └── server.ts                ─ createApiHandler(): consistent JSON errors
├── proxy.ts                         ─ request IDs, security headers, page guards
├── .env.example                     ─ template for .env
└── next.config.ts
```

> [!TIP]
> Folders wrapped in parentheses, like `(features)`, are Next.js **route groups**. They organize code and share layouts without adding a segment to the URL — `app/(features)/cart` is served at `/cart`.

### How a request flows

```text
browser → proxy.ts (security headers, login guard)
        → app/api/<route>/route.ts
        → createApiHandler() + authenticateRequest()
        → controller → service → repository → Drizzle → MySQL (Aiven)
```

- Errors thrown as `AppError` subclasses (`NotFoundError`, `ConflictError`, …) become JSON `{ success: false, error }` with the right status code; anything unexpected is logged and returned as a generic 500.
- Successful responses use `{ success: true, message, data }`.
- Prices are stored in **cents** and always read from the database, never trusted from the browser.

---

## Contributing

1. Branch off `main` using a descriptive name — `feature/cart-checkout`, `fix/catalog-filter`
2. Keep commits focused and messages clear
3. Run `pnpm build` before pushing — **`main` must always build** — and check `pnpm lint` doesn't report new problems in the files you touched
4. Open a pull request and request a review from at least one teammate
5. Stage files by name (`git add <file>`), and check `git status` for `.env` before committing

**Database changes**

- Edit `server/db/schema.ts` only — module `*-schema.ts` files re-export from it.
- Run `pnpm db:generate` in the **same commit** as the schema change, and review the generated SQL.
- **Never edit an existing migration folder.** Every change gets a new migration.
- Test migrations on a local database before running `pnpm db:migrate` against Aiven.

> [!IMPORTANT]
> This project uses **Next.js 16**, which introduces breaking changes from earlier versions (for example, `middleware.ts` is now `proxy.ts`). Check the docs in `node_modules/next/dist/docs/` before relying on older patterns or tutorials.

---

## Team

<div align="center">

**Group 7**

| Member | GitHub |
|:--|:--|
| Aaban | [@zepphen](https://github.com/zepphen) |
| Marcelo Flores | [@Marcelo-Flores-ZC](https://github.com/Marcelo-Flores-ZC) |
| Diego | [@Mac-diego](https://github.com/Mac-diego) |
| Paul Cho | [@AsianPope](https://github.com/AsianPope) |
| Adam | [@AdamSan43](https://github.com/AdamSan43) |
| Daniel Whiteley | [@GraphicSubset29](https://github.com/GraphicSubset29) |

</div>

---

<div align="center">
<sub>
Built for CS 3773 at UTSA &nbsp;·&nbsp; Sample book data and cover images belong to their respective publishers and are used for educational purposes only.
</sub>
</div>

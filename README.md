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
[Team](#team)

</div>

---

## Overview

**Book Worms** is a storefront where customers can browse, search, and purchase books. It is being built incrementally for CS 3773, with the system scoped into four sides — **customer**, **inventory**, **employee**, and **administrative** — and delivered in phases.

> [!NOTE]
> This is an academic project. Book data currently comes from a sample set in `lib/sample-books.ts`, and no real transactions are processed.

---

## Features

| | Feature | Route | Status |
|:-:|:--|:--|:-:|
| ◆ | Landing page with genre categories and featured carousels | `/` | ◐ In progress |
| ◆ | Product catalog organized into sections (bestsellers, trending, new releases…) | `/product-catalog` | ◐ In progress |
| ◆ | Full catalog browser with filtering by tag | `/product-catalog/all` | ◐ In progress |
| ◆ | Product detail page — formats, pricing, sale badges, ratings | `/product/[isbn]` | ◐ In progress |
| ◆ | Shopping cart with live quantity and subtotal updates | `/cart` | ◐ In progress |
| ◆ | Customer sign-in / sign-up | `/user-sign-in` | ◐ UI only |
| ◆ | User account page | `/User` | ◐ In progress |
| ◇ | Administrative portal | — | ○ Planned |
| ◇ | Checkout and payments | — | ○ Planned |

<sub>● Done &nbsp; ◐ In progress &nbsp; ○ Planned</sub>

---

## Tech Stack

<table>
<tr>
<td valign="top" width="50%">

**Framework & Language**
- [Next.js 16](https://nextjs.org) — App Router, Turbopack, Cache Components
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

**Tooling**
- [pnpm](https://pnpm.io) package manager
- [ESLint 9](https://eslint.org) with `eslint-config-next`

</td>
<td valign="top">

**Planned**
- SQL database via [Drizzle ORM](https://orm.drizzle.team)
- [Stripe](https://stripe.com) for card payments

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

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/G7-Book-Worms/E-Commerce-Bookstore.git
cd E-Commerce-Bookstore

# 2. Install dependencies
pnpm install

# 3. Start the development server
pnpm dev
```

Then open **[http://localhost:3000](http://localhost:3000)** in your browser.

### Scripts

| Command | Description |
|:--|:--|
| `pnpm dev` | Start the development server with hot reload |
| `pnpm build` | Create an optimized production build |
| `pnpm start` | Serve the production build |
| `pnpm lint` | Run ESLint across the project |

---

## Project Structure

```text
E-Commerce-Bookstore/
├── app/
│   ├── (main)/
│   │   ├── layout.tsx               ─ storefront header with search, cart, and account
│   │   └── page.tsx                 ─ landing page
│   ├── (features)/
│   │   ├── layout.tsx               ─ shared layout and fonts for feature pages
│   │   ├── cart/                    ─ shopping cart
│   │   ├── product/[isbn]/          ─ product detail page
│   │   └── product-catalog/
│   │       ├── page.tsx             ─ catalog sections
│   │       └── all/                 ─ full catalog with tag filtering (book-browser.tsx)
│   ├── (auth)/
│   │   ├── layout.tsx               ─ minimal centered header
│   │   ├── user-sign-in/            ─ customer sign-in and sign-up
│   │   └── admin-portal-login-obscure/  ─ admin login
│   ├── User/                        ─ account page (page.tsx, user-launch.tsx)
│   ├── globals.css                  ─ Tailwind theme and CSS variables
│   └── favicon.ico
├── components/
│   ├── ui/                          ─ shadcn/ui primitives (accordion, badge, button, card,
│   │                                  carousel, input, popover)
│   ├── book-card.tsx                ─ Book type and card component
│   ├── book-section.tsx             ─ catalog section grid with see more/less
│   └── book-display-carousel.tsx    ─ featured book carousel
├── lib/
│   ├── sample-books.ts              ─ placeholder catalog data
│   └── utils.ts                     ─ cn() class merging helper
├── public/                          ─ static assets
├── components.json                  ─ shadcn/ui configuration
├── next.config.ts
├── eslint.config.mjs
├── postcss.config.mjs
└── tsconfig.json
```

> [!TIP]
> Folders wrapped in parentheses, like `(features)`, are Next.js **route groups**. They organize code and share layouts without adding a segment to the URL — `app/(features)/cart` is served at `/cart`.

---

## Contributing

1. Branch off `main` using a descriptive name — `feature/cart-checkout`, `fix/catalog-filter`
2. Keep commits focused and messages clear
3. Run `pnpm lint` and `pnpm build` before pushing
4. Open a pull request and request a review from at least one teammate

> [!IMPORTANT]
> This project uses **Next.js 16**, which introduces breaking changes from earlier versions. Check the docs in `node_modules/next/dist/docs/` before relying on older patterns or tutorials.

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

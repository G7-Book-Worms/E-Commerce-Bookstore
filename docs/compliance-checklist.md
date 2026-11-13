# Compliance checklist (SCRUM-204)

Sources: *Project Desc & grading F26 v2* (spec + rubric) and *DemoCheckList v4* (the sheet the grader ticks during the demo).
Rows follow the demo checklist order, so the demo can follow this file top to bottom.

Status: **Met** = works on `main` · **This PR** = done in `final/1-data-catalog` · **Planned** = ticket scheduled · **Missing** = no ticket yet.

## Grading weights

| Part | Weight | How we cover it |
|---|---|---|
| Functionality (checklist below, about equal weight per item) | 30% | Sprints 136–138 |
| UI/UX: responsive, color scheme, easy to use (mobile = bonus) | 20% | Every ticket checks phone widths; SCRUM-202 |
| Demonstration (all members attend, preferably present their part; demo only, no plain presentation) | 15% | SCRUM-195; 15-minute demo (per the spec) |
| Write-up (~10 pages, diagrams, workflow; one copy) | 10% | SCRUM-197 |
| Peer review | 25% | Individual, confidential |
| Bonus: hosted on cloud | extra | Aiven MySQL (done); Vercel deploy SCRUM-203 |
| Bonus: extra functionality | extra | Star ratings, formats, activity log, Stripe test checkout |

## Before the demo

Run `pnpm demo:reset` against Aiven before the presentation and after every rehearsal. It re-runs the catalog seed
(stock, prices, codes) and empties the demo account's cart (`ada.lovelace@example.com`).
Sign in once afterwards to confirm the cart is empty.

## Demo checklist

| # | Checklist item (DemoCheckList v4) | Spec wording | Ticket(s) | Status | Demo step |
|---|---|---|---|---|---|
| 1 | Database / web server app / cloud | "database driven"; "extra grade for hosting on cloud" | SCRUM-174, 175, 203 | Done: Aiven MySQL + Vercel (bookwrms.store, live after the Session 3 merge) | Show Aiven console or schema diagram, then the live site |
| 2 | Show images (opening) | "intuitive UI/UX" | SCRUM-177 | Done | Homepage and catalog covers |
| 3 | Log-in / modify user (by user) | "change account information (name etc.)" | Account page (merged), SCRUM-201 | Done | Sign in, edit name on /account |
| 4 | User registration | "register for accounts" | SCRUM-172 | Done | Create Account in header |
| 5 | Main products screen: show images | "must include images" | SCRUM-175, 177 | Done | /product-catalog |
| 6 | Show price | "must include price" | SCRUM-177 | Done | Tile price; sale price in red with regular price struck through |
| 7 | Show quantity on the main products page | "available quantity ON THE MAIN SALE PAGE – not after clicking" | SCRUM-177, 178 | Done | "12 in stock" / "Only 3 left" / "Out of stock" on every tile |
| 8 | Search by item / description | "search … Item/Description" | SCRUM-176, 179 | Done | Header search: "coffee" finds a book by its description |
| 9 | Sort by price / availability | "Sort by Price", "Sort by Availability" | SCRUM-176, 178 | Done | See All page sort menu |
| 10 | Create / modify items (add new items) | "ability to add new items" | SCRUM-189 | Done | Staff portal → Inventory → Add a book (appears in the catalog right away) |
| 11 | Shopping cart: show items in cart | "must show items in cart" | SCRUM-182, 198 | Done | /cart |
| 12 | Taxes (8.25%) | "assume 8.25% tax rate" | SCRUM-198 | Done | Cart summary tax line |
| 13 | Discount codes | "display discount codes and the amount discounted" | SCRUM-174 (table), 199, 198 | Done | Apply BOOKWORMS10 in cart |
| 14 | Sale price indicated in cart | "indicate if the price is a sales price" | SCRUM-198 | Done | Sale badge on cart line |
| 15 | Summary of order, place order | "summary of order and allow order to be placed" | SCRUM-184, 185, 186 | Done | Checkout → Stripe test card → confirmation |
| 16 | Admin: modify all items | "allow to modify all items" | SCRUM-189 | Done | Inventory → Stock / Price on a row; click a title to edit details |
| 17 | Admin: create discount codes (reflected in cart) | "creation of discount codes" | SCRUM-199 | Done | Discounts → create SPRING20, then apply it in the cart |
| 18 | Admin: create sale items (reflected in cart) | "creation of sales items" | SCRUM-189 | Done | Inventory → Price → set a sale price; red sale price in catalog and cart |
| 19 | Admin: modify users | "allow to modify users" | SCRUM-200 | Done | Customers → open Alan → edit phone, deactivate, temporary password |
| 20 | Admin: currently placed orders | "show currently placed orders" | SCRUM-188 | Done | Orders → filter Processing; open one and mark it shipped |
| 21 | Admin: history of orders, sort by date | "sort by order date" | SCRUM-188 | Done | Orders → click the Date header |
| 22 | … sort by customer | "sort by customer" | SCRUM-188 | Done | Orders → click the Customer header |
| 23 | … sort by dollar amount | "sort by order size in dollar amount" | SCRUM-188 | Done | Orders → click the Total header |
| 24 | Admin UI (preferred) | "specific User interface … for the Administrative back end" | SCRUM-187–190 | Done | /staff-login as grace@example.com / BW-1001 |

## Extras built (count toward "additional functionality")

- Staff roles (employee / manager / administrator), activity log, inventory movement history, low-stock alerts by email
- Emails: welcome, order confirmation, status updates, password reset links, staff replies to contact messages
- Security: lockout, rate limits, sign out everywhere, CSRF and security headers (docs/security.md)
- Contact Support inbox, class-project notice, Stripe auto-refund

## Not required (cut first if time runs short)

- Star ratings and rating filter, hardcover/paperback formats, activity log, product-page summary dropdown (Notion stories; nice extras that count toward "additional functionality")
- Real B&N catalog import (stretch, SCRUM-175)
- CI pipeline (optional, SCRUM-194)

## Report (due 11/30)

The spec asks the report to cover the artefacts of the process model (feature list, how each feature was acquired: LLM, components, low-code) and any deviations. Using coding agents for most of the final sprints is an accepted deviation as long as the report documents it.

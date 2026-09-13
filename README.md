# Techloom.ai Software Engineer Intern — Practical Assessment

**Repository:** `<add your GitHub repo URL here>`

**Live Deployments:**
- Task 01 (POS Order & Inventory) — API: `<add Railway/Render URL>` · Frontend: `<add Vercel/Netlify URL>`
- Task 02 (E-Commerce Checkout & Payment) — API: `<add Railway/Render URL>` · Frontend: `<add Vercel/Netlify URL>`

**Demo walkthrough:** `<optional screen-recording link>`

## Tech Stack

| Layer      | Choice                                   |
|------------|-------------------------------------------|
| Backend    | Node.js + Express                         |
| Frontend   | React (Vite)                              |
| Database   | MySQL (raw SQL via `mysql2`, no ORM)      |
| Deployment | Railway/Render (API) + Vercel/Netlify (frontend) |

Both tasks share the same stack but are fully independent services with their own database, `package.json`, and deployment.

## Repository Structure

```
/task-01
  /backend    Express + MySQL API (POS & Inventory)
  /frontend   React admin/cashier UI
/task-02
  /backend    Express + MySQL API (Storefront & Checkout)
  /frontend   React storefront UI
```

## Why these design choices

- **Concurrency safety:** every stock-affecting operation (checkout/reservation, payment, cancel/refund, and the expiry sweep) runs inside a MySQL transaction that locks the affected `products` rows with `SELECT ... FOR UPDATE`. Concurrent requests for the same product serialize at the row lock instead of racing, so two customers can never reserve more than what's available. Rows are always locked in ascending `product_id` order to avoid deadlocks when a cart has multiple items.
- **Reservation model:** `products.stock` is the physical count; `products.reserved_stock` is stock currently held by in-flight orders. Available-for-sale is always `stock - reserved_stock`, computed live, never stored. This means an order never needs to "guess" what's available.
- **5-minute expiry:** a `node-cron` job runs every 30 seconds, finds `Reserved` orders past their `expires_at`, releases their `reserved_stock`, and flips them to `Expired`. The same lapsed-reservation check also runs inline when a late payment attempt comes in, so a stale reservation can't be paid after the fact.
- **Mock payment gateway:** `POST /api/payments` takes an `outcome` of `success`, `failure`, or `timeout` so every branch can be exercised on demand instead of depending on a real gateway's behavior.
- **Duplicate protection:** both `orders.idempotency_key` and `payments.idempotency_key` are `UNIQUE` columns. Submitting the same checkout or payment attempt twice (e.g. a double-click or network retry) returns the original result instead of creating a second order/charge.
- **Order lifecycle:** `Pending → Reserved → Paid/Failed/Expired/Cancelled`, with `Paid → Refunded` in Task 02. Invalid transitions (e.g. paying an already-`Paid` order) are rejected with `409`.

## Setup — Task 01 (POS)

### Backend
```bash
cd task-01/backend
cp .env.example .env      # fill in your MySQL credentials
npm install
npm run migrate           # creates the database + tables + seed products
npm start                 # runs on http://localhost:4001
```

### Frontend
```bash
cd task-01/frontend
npm install
echo "VITE_API_URL=http://localhost:4001" > .env
npm run dev                # runs on http://localhost:5173
```

## Setup — Task 02 (Storefront)

### Backend
```bash
cd task-02/backend
cp .env.example .env      # fill in your MySQL credentials (use a separate DB name)
npm install
npm run migrate
npm start                  # runs on http://localhost:4002
```

### Frontend
```bash
cd task-02/frontend
npm install
echo "VITE_API_URL=http://localhost:4002" > .env
npm run dev                 # runs on http://localhost:5174
```

## Environment Variables

Both backends read from `.env` (see `.env.example` in each `backend/` folder):

| Variable              | Description                              |
|-----------------------|-------------------------------------------|
| `PORT`                | Port the API listens on                   |
| `DB_HOST`             | MySQL host                                |
| `DB_PORT`             | MySQL port (usually 3306)                 |
| `DB_USER`             | MySQL user                                |
| `DB_PASSWORD`         | MySQL password                            |
| `DB_NAME`             | Database name (created by `npm run migrate` if missing) |
| `RESERVATION_MINUTES` | Reservation hold duration (default 5)     |

Frontends read `VITE_API_URL` to know where the backend lives (set this to your deployed API URL when building for production).

## How to Test Each Feature

### Task 01 — POS
1. **Inventory CRUD:** Products tab — add/delete products, watch `stock`/`reserved`/`available` columns update live.
2. **Concurrency / no overselling:** set a product's stock to 1, add it to two carts in two browser tabs, and check out both at nearly the same time (or `curl` the checkout endpoint twice in parallel) — only one succeeds, the second gets a `409 Insufficient stock`.
3. **Reservation + expiry:** check out an item, note the `expires_at` time in the Orders tab, and wait 5 minutes (or lower `RESERVATION_MINUTES` in `.env` for a faster test) — the order flips to `Expired` and `reserved_stock` drops back down automatically.
4. **Payment outcomes:** from the Orders tab, use the "Pay: Success / Fail / Timeout" buttons on a `Reserved` order to see each branch (`Paid`, `Failed`, `Expired`) and the resulting stock changes.
5. **Duplicate submissions:** re-send the same checkout or payment request with the same `idempotencyKey` (e.g. replay via `curl`/Postman) — you get back the original order/payment instead of a duplicate.
6. **Cancellation:** cancel a `Reserved` order (releases the hold) or a `Paid` order (restores stock, simulating a refund).

### Task 02 — Storefront
1. **Discovery:** Shop tab — search by name/description, filter by category and price range.
2. **Cart & checkout:** add items across categories, check out, and watch the order appear in Order History as `Reserved` with a countdown-style `expires_at`.
3. **Payment & duplicates:** same as Task 01 — trigger success/failure/timeout, and replay an idempotency key to confirm no double-charge.
4. **Refunds:** pay an order successfully, then cancel it — status becomes `Refunded`, stock is restored, and a row is written to the `refunds` table (visible via `GET /api/orders/:id`).
5. **Order history:** switch the "Customer" field to see history scoped per customer name.

## Deployment Notes

- Any MySQL-compatible host works (PlanetScale, Railway MySQL, Aiven, a managed RDS instance, etc.) — just point `.env` at it and run `npm run migrate` once.
- Deploy each `backend/` as its own Node web service (Railway/Render/Fly.io) with the env vars above set in the platform's dashboard.
- Deploy each `frontend/` as a static site (Vercel/Netlify), setting `VITE_API_URL` to the deployed backend's URL as a build-time environment variable.
- CORS is open (`cors()` with defaults) so the frontend can call the backend from a different domain.

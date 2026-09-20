# INE Product Price Tracker

A full-stack product price tracking application built for the **INE Software Engineer Intern Assignment**.

The application lets users search the INE hosted mock storefront, select products to track, scrape their current price and stock, persist historical data in Supabase, and inspect per-product scrape activity from a React dashboard.

The primary engineering focus is scraper reliability against the mock storefront's intentionally awkward behavior: asynchronous price loading, required browser interaction, cookie popups, slow responses, and intermittent failures.

## Live Demo

**Frontend:** https://product-price-tracker-steel.vercel.app/

**Mock storefront:** https://demo.inelabteamdev.com/

## Repository

https://github.com/Aayush-Creates/product-price-tracker

---

## Features

### Core assignment features

- Search the INE mock store by partial or full product name
- Select and persist tracked products
- Scrape current price and stock with Playwright
- Default product scrape frequency of **2 hours / 120 minutes**
- External scheduling through cron-job.org
- Store price and stock history in Supabase
- Store per-product scrape logs
- Record `success`, `retried`, and `failed` outcomes
- Retry transient scraper failures with backoff
- Handle slow/asynchronous price loading
- Handle cookie popups during scraping
- Validate scraped price and stock before writing history
- Preserve the last known good price/stock when a scrape fails
- Provide a headed scraper mode for demonstration
- Deploy frontend on Vercel and backend on Render

### Additional functionality

- Track multiple products from one dashboard
- Configure scrape frequency per product
- Pause/resume tracking
- Manually trigger a scrape
- Show response time and attempt count in the scrape log
- Open the original INE product page from the dashboard

---

# Architecture

```text
                         ┌───────────────────────────┐
                         │       React + Vite         │
                         │     Vercel Frontend        │
                         └─────────────┬─────────────┘
                                       │
                                       │ REST API
                                       ▼
                         ┌───────────────────────────┐
                         │      Node.js / Express     │
                         │       Render Backend       │
                         └──────┬─────────────┬───────┘
                                │             │
                   ┌────────────┘             └───────────────┐
                   │                                          │
                   ▼                                          ▼
         ┌─────────────────────┐                 ┌────────────────────────┐
         │   Supabase/Postgres │                 │       Playwright       │
         │                     │                 │     Browser Scraper    │
         │ tracked_products    │                 └────────────┬───────────┘
         │ price_history       │                              │
         │ scrape_logs         │                              ▼
         └─────────────────────┘                 ┌────────────────────────┐
                                                 │     INE Mock Store      │
                                                 │ demo.inelabteamdev.com  │
                                                 └────────────────────────┘

                         ┌───────────────────────────┐
                         │       cron-job.org        │
                         │     every 10 minutes      │
                         └─────────────┬─────────────┘
                                       │
                                       │ POST /api/scraper/run
                                       ▼
                              Check due products
                                       │
                                       ▼
                              Scrape only products
                              whose next_scrape_at
                                   is due
```

### Scheduling model

The external cron runs every **10 minutes**, but this does **not** mean every product is scraped every 10 minutes.

Each tracked product has its own `scrape_frequency_minutes` and `next_scrape_at`.

For example:

```text
Cron check:       every 10 minutes
Default product:  120 minutes
```

The scheduler checks which products are due and only scrapes those products.

This allows the project to satisfy the assignment's 2-hour default while also supporting configurable frequencies.

---

# Technology Stack

## Frontend

- React 19
- Vite
- JavaScript
- CSS
- Axios
- Vercel

## Backend

- Node.js
- Express
- Playwright
- Axios
- Cheerio
- dotenv
- CORS
- Render

## Database

- Supabase PostgreSQL

## Scheduler

- cron-job.org

## Target storefront

- INE hosted mock store
- https://demo.inelabteamdev.com/

---

# Repository Structure

The repository is organized as a monorepo with separate frontend and backend applications.

```text
product-price-tracker/
│
├── backend/
│   ├── package.json
│   ├── package-lock.json
│   │
│   ├── scripts/
│   │   ├── debugHover.js
│   │   ├── demoHeadedScrape.js
│   │   ├── runDueScrapes.js
│   │   └── testScraper.js
│   │
│   └── src/
│       ├── app.js
│       ├── server.js
│       │
│       ├── config/
│       │   └── supabase.js
│       │
│       ├── controllers/
│       │   ├── productController.js
│       │   ├── scrapeController.js
│       │   └── trackedProductController.js
│       │
│       ├── routes/
│       │   ├── productRoutes.js
│       │   ├── scrapeRoutes.js
│       │   └── trackedProductRoutes.js
│       │
│       ├── scraper/
│       │   ├── ScraperEngine.js
│       │   ├── browserScraper.js
│       │   └── retry.js
│       │
│       ├── services/
│       │   ├── historyService.js
│       │   ├── productCatalogService.js
│       │   ├── scrapeService.js
│       │   └── trackedProductService.js
│       │
│       └── utils/
│           ├── asyncHandler.js
│           └── httpError.js
│
├── frontend/
│   ├── package.json
│   ├── package-lock.json
│   ├── index.html
│   ├── vite.config.js
│   │
│   ├── public/
│   │   ├── favicon.svg
│   │   └── icons.svg
│   │
│   └── src/
│       ├── App.jsx
│       ├── main.jsx
│       ├── styles.css
│       ├── assets/
│       ├── components/
│       │   ├── ProductCard.jsx
│       │   ├── SearchProducts.jsx
│       │   └── StatsCards.jsx
│       └── services/
│           └── api.js
│
├── .gitignore
└── README.md
```

---

# Product Search

Product search is intentionally implemented without launching Playwright.

The backend uses the mock storefront's catalog API:

```text
GET https://demo.inelabteamdev.com/api/catalog
```

The catalog is fetched with Axios, product names are filtered for partial/full matches, and matching product URLs are constructed from the product ID.

This keeps browser automation focused on the part of the application that genuinely requires it: current price and stock extraction.

### Search flow

```text
User enters product name
        ↓
GET /api/products/search?q=...
        ↓
Fetch mock-store catalog API
        ↓
Filter product names
        ↓
Return matching products
        ↓
User clicks "Track"
        ↓
POST /api/tracked-products
```

The search endpoint caps the returned results to 20 matches.

---

# Tracking a Product

When a user clicks **Track**, the frontend sends the product name and URL to:

```text
POST /api/tracked-products
```

The backend persists the tracking record in Supabase.

Important fields include:

- `product_id`
- `product_name`
- `product_url`
- `scrape_frequency_minutes`
- `is_active`
- `next_scrape_at`
- `last_price`
- `last_stock`
- `last_scraped_at`
- `last_status`

The default frequency is:

```text
120 minutes
```

---

# Scraper Design

The INE mock storefront deliberately requires interaction before the live price can be revealed.

A successful scrape follows approximately this sequence:

```text
Open product page
       ↓
Locate .price-block
       ↓
Move mouse outside price area
       ↓
Hover over the price block
       ↓
Wait for interactive state
       ↓
Wait for Reveal Price button
       ↓
Handle cookie popup when present
       ↓
Click Reveal Price
       ↓
Wait for async price response
       ↓
Wait for successful price block state
       ↓
Extract price + stock
       ↓
Validate values
       ↓
Return result
```

Playwright is used here because the current price depends on browser-side behavior rather than simply existing in the initial HTML.

---

# Price Parsing and Stock Extraction

The scraper normalizes price formats returned by the mock store.

Examples handled include:

```text
₹5.963,00  → 5963
₹28.143,00 → 28143
₹18,714    → 18714
```

Stock formats handled include examples such as:

```text
IN STOCK
137 IN STOCK
IN STOCK - 15 LEFT
SELLING FAST — 153 LEFT
HURRY, JUST 149 LEFT
OUT OF STOCK
```

The final application stores normalized numeric price values along with the stock text.

---

# Scraper Reliability

Reliability is the main engineering concern in this project.

## 1. Browser state and interaction

The scraper does not assume that the initial page contains a usable current price.

It explicitly reproduces the interaction required by the storefront before extracting the value.

## 2. Cookie popup handling

The storefront can show a cookie popup.

The browser scraper detects and dismisses it when necessary, then re-establishes the price-block interaction before continuing.

## 3. Asynchronous loading

The scraper waits for the price area to enter the expected success state instead of immediately reading the page.

This is important because the assignment intentionally introduces delayed content.

## 4. Retry and backoff

The scraper engine uses retry handling with backoff delays:

```text
Attempt 1
   ↓ failure
wait 2s
   ↓
Attempt 2
   ↓ failure
wait 5s
   ↓
Attempt 3
   ↓ failure
wait 10s
   ↓
Attempt 4
```

The engine reports the final outcome and attempt count.

## 5. Timeout

A browser timeout is applied so a stalled page does not block indefinitely.

The default application timeout is:

```text
30000 ms
```

## 6. Valid data before history

A price-history row is only written after both price and stock pass validation.

The implementation rejects results where:

- price is not numeric
- price is zero/negative
- stock is missing

This prevents a failed or incomplete browser response from becoming fake historical data.

## 7. Honest failures

Failures are written to `scrape_logs`.

The application records:

- status
- attempt count
- response time
- error message

A failure does not silently become a successful observation.

## 8. Last known good state

When a scrape fails, the previous valid `last_price` and `last_stock` are preserved.

The failed attempt is visible in the log, while the dashboard does not replace valid historical information with empty/incorrect values.

---

# Scrape Statuses

The system uses three relevant outcome states:

### `success`

Scrape completed successfully on the first attempt.

### `retried`

Scrape eventually succeeded after one or more retry attempts.

### `failed`

All attempts failed and no new valid history entry was created.

---

# Price History

Successful observations are persisted to the `price_history` table.

Each entry includes:

- tracked product ID
- price
- stock
- scrape timestamp
- associated scrape-log ID

The dashboard displays the history as a table with:

```text
Time | Price | Stock
```

A failed scrape does not create a fake price-history record.

---

# Scrape Logs

Each scraping operation creates a corresponding record in `scrape_logs`.

The dashboard displays:

```text
Time
Outcome
Attempts
Response time
Error message
```

This makes slow and failed behavior observable rather than hiding it.

Examples of failure conditions encountered during testing included:

```text
Price area did not enter interactive state.
Current status: ""
```

and:

```text
Price area did not enter interactive state.
Current status: "upstream 429"
```

These failures remain visible in the application as failed scrape-log entries.

---

# Dashboard Controls

Each tracked product card provides:

- Current price
- Current/last known stock
- Last scraped timestamp
- Scrape frequency selector
- Scrape Now
- Pause / Resume
- Remove
- Price & stock history
- Scrape logs
- Link to the INE product page

Supported frequency options:

```text
30 minutes
1 hour
2 hours
4 hours
6 hours
12 hours
24 hours
```

The assignment-required default is still:

```text
2 hours
```

---

# API Endpoints

## Health

```http
GET /api/health
```

Returns basic backend health information.

## Product search

```http
GET /api/products/search?q=<query>
```

Searches the INE mock-store catalog.

## Tracked products

```http
GET /api/tracked-products
POST /api/tracked-products
GET /api/tracked-products/:id
DELETE /api/tracked-products/:id
```

## Dashboard statistics

```http
GET /api/tracked-products/stats
```

## Price history

```http
GET /api/tracked-products/:id/history
```

## Scrape logs

```http
GET /api/tracked-products/:id/logs
```

## Frequency

```http
PATCH /api/tracked-products/:id/frequency
```

## Pause / resume

```http
PATCH /api/tracked-products/:id/active
```

## Manual scrape

```http
POST /api/tracked-products/:id/scrape
```

## Scheduled scrape runner

```http
POST /api/scraper/run
```

The scheduler endpoint is protected by a shared cron secret.

---

# Supabase Data Model

The application uses three main database areas.

### `tracked_products`

Stores the current tracking state and scheduling information.

### `price_history`

Stores only valid price/stock observations.

### `scrape_logs`

Stores each scrape attempt/outcome, including failures.

Conceptually:

```text
tracked_products
      │
      ├───────────────┐
      │               │
      ▼               ▼
price_history     scrape_logs
```

A `price_history` record is linked to the scrape log that produced it.

---

# Scheduling with cron-job.org

The configured external cron job calls:

```text
POST https://product-price-tracker-rnxr.onrender.com/api/scraper/run
```

with:

```text
x-cron-secret: <CRON_SECRET>
```

The scheduler runs every:

```text
10 minutes
```

Again, this is only the **scheduler polling interval**.

The actual product interval is stored per product in `scrape_frequency_minutes`.

### Example

If a product has:

```text
scrape_frequency_minutes = 120
```

then:

```text
10:00  scheduler checks → not due
10:10  scheduler checks → not due
10:20  scheduler checks → not due
10:30  scheduler checks → not due
10:40  scheduler checks → not due
10:50  scheduler checks → not due
11:00  scheduler checks → due → scrape
```

The scheduler then calculates the next run from the scrape completion time.

---

# Render Health Check

The backend exposes:

```text
GET /api/health
```

This is used as the Render health-check endpoint.

The health route is intentionally lightweight and does not run scraping work.

Render uses configured health checks to determine whether a web service is healthy and able to receive traffic. urlRender Health Checks documentationhttps://render.com/docs/health-checks

---

# Local Development

## Prerequisites

- Node.js
- npm
- Git
- Supabase project
- Playwright Chromium

---

## Backend

```bash
cd backend
npm install
npx playwright install chromium
```

Create:

```text
backend/.env
```

Example:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
CRON_SECRET=your_cron_secret
SCRAPER_TIMEOUT=30000
SCRAPE_BATCH_SIZE=10
```

Optional:

```env
MOCK_STORE_URL=https://demo.inelabteamdev.com
```

Start the backend:

```bash
npm start
```

Development mode:

```bash
npm run dev
```

The local backend normally runs on:

```text
http://localhost:5000
```

---

# Frontend

```bash
cd frontend
npm install
```

Create:

```text
frontend/.env
```

```env
VITE_API_URL=http://localhost:5000/api
```

Start the development server:

```bash
npm run dev
```

For a production build:

```bash
npm run build
```

---

# Scraper Testing

Test a product in headless mode:

```bash
cd backend
npm run test:scraper -- "https://demo.inelabteamdev.com/product/803"
```

Or directly:

```bash
node scripts/testScraper.js "https://demo.inelabteamdev.com/product/803"
```

---

# Headed Demonstration

The assignment requires an observable headed run.

The repository provides:

```bash
cd backend
npm run headed
```

To run against a specific product:

```bash
npm run headed -- "https://demo.inelabteamdev.com/product/901"
```

The browser opens visibly and demonstrates the actual scraping flow.

The headed run reports:

- browser mode
- attempt count
- status
- response time
- price
- stock
- errors after exhausted retries

This script is intended for the required 2–4 minute screen recording.

---

# Deployment

## Frontend — Vercel

The frontend is deployed at:

```text
https://product-price-tracker-steel.vercel.app/
```

## Backend — Render

The backend is deployed at:

```text
https://product-price-tracker-rnxr.onrender.com
```

Required Render environment variables:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
SCRAPER_TIMEOUT=
SCRAPE_BATCH_SIZE=
```

Optional:

```env
MOCK_STORE_URL=
```

The Render build installs the project dependencies and Chromium:

```text
npm install && npx playwright install chromium
```

The start command is:

```text
npm start
```

The configured health endpoint is:

```text
/api/health
```

---

# Security

Environment files are excluded from Git via `.gitignore`.

The repository should never contain actual values for:

```text
SUPABASE_SERVICE_ROLE_KEY
CRON_SECRET
```

The Supabase service-role key is used only by the backend.

The frontend only receives the backend API URL through:

```text
VITE_API_URL
```

The scheduled scraping endpoint requires the configured `x-cron-secret`.

---

# Design Decisions and Trade-offs

## Why Playwright for price/stock?

The mock product page genuinely needs browser interaction to reveal the current price.

A lightweight HTTP client is enough for catalog discovery, but not enough for the dynamic product-price flow.

Therefore the implementation intentionally uses:

```text
Catalog discovery → Axios / catalog API
Current price/stock → Playwright
```

This avoids using a browser for work that does not need one.

## Why an external scheduler?

The assignment explicitly notes that free-tier backend instances may sleep.

Running an internal infinite scheduler loop inside the Render web service would not be dependable.

Instead:

```text
cron-job.org → /api/scraper/run → due-product check → scrape
```

This makes the scheduling trigger independent of backend idling.

## Why sequential due-product scraping?

Due products are processed sequentially by the scheduler.

This avoids launching many browser instances at once and reduces memory/CPU pressure on a free-tier backend.

The trade-off is that a large number of simultaneously due products can increase the total scheduler request duration.

cron-job.org documents a 30-second request timeout, so the deployed system currently keeps the batch size conservative and the individual scraper bounded by its browser timeout. urlcron-job.org FAQhttps://cron-job.org/en/faq/

## Why preserve the last valid value after failure?

A failed scrape does not prove that the product price became empty or zero.

Therefore:

```text
Successful scrape
    ↓
store new history + latest state

Failed scrape
    ↓
store failed log
    ↓
keep last known good price/stock
    ↓
schedule next run
```

This prevents misleading dashboard data.

---

# AI-Assisted Development and Corrections

AI tools were used during development as implementation assistance, but generated suggestions were tested against the actual INE mock storefront and corrected when they did not match the observed behavior.

### Initial scraper assumption

An early approach treated the product price as if it could be read directly from the initial page content.

That was incorrect.

The mock store requires interaction with the `.price-block`, including hover behavior and a reveal action, followed by asynchronous loading.

The scraper was therefore changed to reproduce the real browser interaction sequence and wait for the successful state before extracting price and stock.

### Initial product search approach

An early product-search implementation relied too heavily on browser navigation over catalog pages.

That made search unnecessarily slow.

After inspecting the mock store behavior, product discovery was moved to its catalog API. Playwright remained reserved for the actual product scraper where browser execution is needed.

### Pause/resume scheduling correction

An early pause implementation attempted to clear `next_scrape_at`.

The database column was non-nullable, so that approach caused a database constraint failure.

The final implementation instead uses:

```text
Pause:
is_active = false
```

without clearing `next_scrape_at`.

When resumed, the next scheduled time is recalculated from the product's configured frequency.

### Validation correction

The scraper was also made stricter about what constitutes a valid result.

Price history is not written unless a positive numeric price and non-empty stock are available.

These corrections were based on actual runtime behavior, scraper output, and database/API responses rather than assuming the first generated implementation was correct.

---

# Known Trade-off

The current application is designed as an assignment/demo system rather than a multi-account production SaaS.

Tracked products are stored in a shared Supabase dataset and there is no user authentication or per-user ownership model.

The assignment does not require authentication, so this keeps the implementation focused on the core scraping and scheduling problem.

---

# Author

**Aayush Gupta**

BTech Computer Science & Engineering  
Jaypee Institute of Information Technology, Noida

# License

This project was developed as part of the INE Software Engineer Intern assignment and is intended for evaluation purposes.

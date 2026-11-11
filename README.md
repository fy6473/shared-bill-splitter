# SDE Intern Assignment: Shared Bill Splitter

Welcome. In this assignment you build a small bill splitter for a shared home. It has two parts:

1. **Homes and members:** create a home and add members to it.
2. **Bill splitting:** split a bill between the members. Each member pays their own share.

The assignment is small on purpose. We want correct, safe, and clear code. We do not want many features.

## What we look at

- **Your code passes the tests.** The tests decide, not opinion. You get the visible tests. We also run extra tests that you do not see.
- **Your code is safe when things go wrong.** Wrong input, repeated requests, and two requests at the same time must not break your data.
- **Your code is typed.** Use TypeScript. Do not use `any`.
- **You understand your code.** You record a short video and explain it.

Take your time. A careful, correct solution is better than a fast one. We expect 2 to 3 days of real work.

## Stack (required)

- **API:** Hono on Cloudflare Workers
- **Database:** Cloudflare D1 (SQLite). The binding is `DB` in `api/wrangler.jsonc`.
- **Web:** React, Vite, TanStack Router
- **Language:** TypeScript on both sides
- **Tests:** Vitest, running inside the Workers runtime
- **Quality:** Biome. `pnpm check` and `pnpm typecheck` must pass.

You choose the rest (styling, form library, validation library). Pick tools you can explain.

## The task

The assignment has two parts. Do Part 1 first. Part 2 builds on it.

**Database.** Write the schema as SQL migration files in `api/migrations/`. For example `0001_init.sql`. The tests apply every file in this folder. Your schema must have **at least 3 named constraints** that protect the data. For example a foreign key, a `CHECK`, or a `UNIQUE` key. Be ready to explain what each constraint stops.

**Errors.** Every error response is JSON: `{ "error": "message" }`.

## Part 1: Homes and members

Create a home and add members to it. The order in which members are added matters in Part 2.

#### `POST /api/homes`

- Request: `{ "name": string }`
- Success: `201` `{ id, name }`

#### `POST /api/homes/:homeId/members`

- Request: `{ "name": string }`
- Success: `201` `{ id, homeId, name }`
- Errors: `404` home not found

Visible tests: `api/test/homes.test.ts`.

## Part 2: Bill splitting

Add a bill to a home, split it between the members, and let each member pay their share.

All amounts are whole **cents** (integers). `100` cents is 1 dollar. Never use decimals for money.

#### `POST /api/homes/:homeId/bills`

- Request: `{ "title": string, "totalCents": number }`
- Success: `201` `{ id, homeId, title, totalCents, shares: [{ id, memberId, amountCents, paidAt: null }] }`
- Errors: `404` home not found. `422` total is not a positive whole number, or the home has no members.

#### `POST /api/bills/:billId/shares/:shareId/pay`

- Request: header `Idempotency-Key`
- Success: `200` `{ id, memberId, amountCents, paidAt }`
- Errors: `400` key missing. `404` bill or share not found. `409` share already paid with a different key.

#### `GET /api/homes/:homeId/balances`

- Success: `200` `{ balances: [{ memberId, name, outstandingCents }] }`
- Errors: `404` home not found

**Rules**

- **Split.** A bill is split between all members of the home. The shares always add up to `totalCents`. If the amount does not divide evenly, the extra cents go to the members one by one, in the order the members were added to the home. Example: 1000 cents between 3 members gives `334`, `333`, `333`.
- **Pay.** Paying marks one share as paid and sets `paidAt`. If the same `Idempotency-Key` is sent again for the same share, answer `200` with the same result. Do not pay twice. If two requests pay the same share at the same time, only one may succeed.
- **Balances.** `outstandingCents` is the sum of the member's unpaid shares, across all bills of the home. List the members in the order they were added.

Visible tests: `api/test/bills.test.ts` and `api/test/payments.test.ts`.

#### Web page

Build one page that:

- shows the bills of a home and the shares of each bill,
- lets a member pay a share,
- shows clear **loading**, **empty**, and **error** states,
- keeps the share unpaid and shows an error if the payment fails.

The page must not crash when the API answers with an error or is slow.

## Cases you must handle

You must handle these cases and talk about them in your video:

1. A home with no members.
2. An amount that is zero, negative, or not a whole number.
3. An amount that does not divide evenly.
4. The same payment request sent twice.
5. Two members paying the same share at the same time.
6. A bill or share that does not exist.
7. The API answers with a 500 error or is slow. The web page must not crash.

## Run it

This is a pnpm workspace. Install once at the root.

```bash
pnpm install
pnpm dev          # api on :8787 and web on :5173
```

Open http://localhost:5173. The starter page shows a title. `/api/health` returns `{ "status": "ok" }`.

```bash
pnpm test         # run the visible tests in api/test
pnpm check        # Biome: format and lint. Must pass.
pnpm check:fix    # fix what Biome can fix
pnpm typecheck    # tsc on both packages. Must pass.
pnpm build        # production build of the web app
```

`pnpm dev` applies your migrations to a local database before it starts the API.

If pnpm says some build scripts were ignored, run `pnpm approve-builds` and allow `esbuild` and `workerd`.

When you change `api/wrangler.jsonc`, refresh the `Env` types:

```bash
pnpm --filter bill-splitter-api cf-typegen
```

## Rules for the tests

- The visible tests are in `api/test`. They start with a failing result. Your job is to make them pass.
- Do **not** change the visible tests or `api/test/helpers.ts`. We compare them with the original.
- We run extra tests after you submit. They test the cases in "Cases you must handle" more closely.

## AI policy

You can use AI tools. Tell us which ones and where in your answers on the form.
You must understand every line you submit. We check this with your video and in a live call. "The AI wrote it" is not an answer.

## How to submit

1. Click **Use this template**, then **Create a new repository**. Make the repository **public**.
2. Build your solution in your new repository. Small, clear commits are welcome.
3. Update this README with a short section called **Decisions**. Write 3 decisions you made and why.
4. Record a video of **3 minutes or less** (Loom or unlisted YouTube). Show the architecture, the data flow, and one trade-off you made. Make sure anyone with the link can view it.
5. Paste the repository link and the video link in the application form.

We will run `pnpm install && pnpm check && pnpm typecheck && pnpm test` on your repository.





**************Solution Response:-*************


# Shared Bill Splitter

A full-stack web application for managing shared household expenses. Users can create homes, add members, split bills equally, track individual payments, and view outstanding balances.

## Features

- Create homes and add members.
- Create shared bills for a home.
- Automatically split bills equally among all members.
- Distribute remaining cents to members in the order they were added.
- Track individual share payment status.
- Mark individual shares as paid.
- Prevent duplicate payments using idempotency keys.
- Handle simultaneous payment requests safely.
- Calculate outstanding balances for each member.
- Validate user input and handle API errors.
- Provide loading, empty, and error states in the frontend.

## Technology Stack

**Frontend**
- React
- TypeScript
- Vite
- TanStack Router
- CSS

**Backend**
- Hono
- TypeScript
- Cloudflare Workers

**Database**
- Cloudflare D1
- SQLite

**Testing and Development Tools**
- Vitest
- Biome
- Wrangler
- pnpm

## Project Structure

```text
shared-bill-splitter/
├── api/
│   ├── migrations/
│   ├── src/
│   ├── test/
│   └── wrangler.jsonc
├── web/
│   ├── src/
│   │   ├── components/
│   │   ├── lib/
│   │   ├── routes/
│   │   └── styles/
│   └── vite.config.ts
├── package.json
└── README.md
```

## Getting Started

### Prerequisites

- Node.js
- pnpm

### Installation

Clone the repository:

```bash
git clone https://github.com/fy6473/shared-bill-splitter.git
cd shared-bill-splitter
```

Install dependencies:

```bash
pnpm install
```

### Run the application

```bash
pnpm dev
```

The development command automatically applies database migrations to the local Cloudflare D1 database before starting the API and frontend servers.

The application will be available at:

- **Frontend:** http://localhost:5173
- **API:** http://localhost:8787
- **Health check:** http://localhost:8787/api/health

## API Endpoints

All error responses use JSON in the following format:

```json
{
  "error": "Error message"
}
```

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Check API health |
| GET | `/api/homes` | Get all homes |
| POST | `/api/homes` | Create a home |
| GET | `/api/homes/:homeId/members` | Get home members |
| POST | `/api/homes/:homeId/members` | Add a member |
| GET | `/api/homes/:homeId/bills` | Get home bills |
| POST | `/api/homes/:homeId/bills` | Create and split a bill |
| POST | `/api/bills/:billId/shares/:shareId/pay` | Mark a share as paid |
| GET | `/api/homes/:homeId/balances` | Get outstanding balances |

### Create a Home

`POST /api/homes`

Request:

```json
{
  "name": "My Home"
}
```

Success response: `201 Created`

### Add a Member

`POST /api/homes/:homeId/members`

Request:

```json
{
  "name": "Priyanshu"
}
```

Success response: `201 Created`

Returns `404` if the home does not exist.

### Create and Split a Bill

`POST /api/homes/:homeId/bills`

Request:

```json
{
  "title": "Electricity Bill",
  "totalCents": 1000
}
```

Success response: `201 Created`

Returns `404` if the home does not exist and `422` if the amount is invalid or the home has no members.

All API monetary amounts are represented as integer cents. No floating-point values are used for backend money calculations.

### Pay a Share

`POST /api/bills/:billId/shares/:shareId/pay`

Required header:

```text
Idempotency-Key: unique-request-key
```

Success response: `200 OK`

- Returns `400` if the idempotency key is missing.
- Returns `404` if the bill or share does not exist.
- Returns `409` if the share has already been paid using a different key.
- Repeating a request with the same key returns the existing payment result.

### Get Home Balances

`GET /api/homes/:homeId/balances`

Returns each member's outstanding unpaid amount, ordered by the order in which members were added.

Returns `404` if the home does not exist.

## Bill Splitting Logic

Bills are divided equally among all members of a home.

The backend uses integer cents to avoid floating-point precision issues.

When the total amount cannot be divided equally, the remaining cents are distributed one by one to the earliest-added members.

**Example:**

A bill of 1000 cents shared among three members:

| Member | Share |
|---|---:|
| Member 1 | 334 cents |
| Member 2 | 333 cents |
| Member 3 | 333 cents |
| **Total** | **1000 cents** |

The shares always add up to the original bill amount.

## Payment Idempotency and Concurrency

The payment endpoint requires an `Idempotency-Key` header.

- Repeating a payment request with the same key for the same share returns the existing payment result.
- Using a different key for an already-paid share returns a conflict response.
- Conditional database updates ensure that only one request can successfully mark an unpaid share as paid.
- This protects payment records against duplicate and simultaneous requests.

## Database Constraints

The SQLite schema uses named constraints to protect data integrity, including:

- Foreign key constraints to maintain relationships between homes, members, bills, and shares.
- Unique constraints to prevent duplicate member/share relationships and idempotency keys.
- Check constraints to prevent invalid names, bill amounts, and payment states.

These constraints provide database-level protection in addition to API validation.

## Decisions

### 1. Store money as integer cents

All monetary amounts are stored and calculated as integers instead of floating-point numbers. This avoids precision errors during bill splitting and payment calculations.

### 2. Use idempotency keys for payments

Payment requests require an idempotency key to prevent duplicate payment processing. Conditional database updates ensure that simultaneous requests cannot successfully pay the same share twice.

### 3. Use Cloudflare D1 with relational constraints

Cloudflare D1 provides SQLite-based persistent storage. Foreign keys, unique constraints, and check constraints help maintain data integrity and prevent invalid relationships between homes, members, bills, and shares.

## Testing and Quality Checks

Run the following commands from the project root:

```bash
# Run all automated tests
pnpm test

# Run Biome formatting and lint checks
pnpm check

# Automatically fix supported Biome issues
pnpm check:fix

# TypeScript checks for both API and frontend
pnpm typecheck

# Build the frontend for production
pnpm build
```

### Test Coverage

The automated API test suite covers:

- Home creation and member management.
- Bill creation and equal splitting.
- Payment processing and idempotency.
- Invalid payment requests and missing resources.

The implementation also handles the assignment's required edge cases, including empty homes, invalid amounts, uneven splits, repeated payments, concurrent payment requests, missing bills or shares, and frontend API failures.

## AI Usage Disclosure

ChatGPT was used as an AI assistance tool during development for understanding assignment requirements, discussing implementation approaches, generating and reviewing code, debugging TypeScript issues, preparing test commands, and improving project documentation.

The generated code and suggestions were reviewed, tested, and integrated into the project by me. I understand the implementation and can explain the technical decisions made.
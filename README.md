# EazySeva — Backend

REST API for the EazySeva government-services ordering platform.

---

## Tech Stack

| Tool | Version | Purpose |
|------|---------|---------|
| NestJS | 11 | Backend framework |
| TypeScript | 5 | Type safety |
| Supabase JS | 2 | Database client + Auth |
| Supabase Auth | — | User identity (JWT-based) |
| Supabase PostgreSQL | 16 | Relational database |
| Cloudinary | 2 | File storage (documents) |
| Multer | 2 | Multipart file parsing |
| passport-jwt | 4 | Supabase JWT strategy |
| @nestjs/jwt | 11 | Local JWT verification |
| @nestjs/throttler | 6 | Rate limiting |
| class-validator | 0.15 | DTO validation |
| class-transformer | 0.5 | DTO transformation |
| helmet | 8 | Security headers |
| @nestjs/swagger | 11 | OpenAPI docs (dev only) |

> **Not in this codebase:** TypeORM, Razorpay, Resend, Groq, Socket.io.
> The README previously listed these — they were planning artefacts, not implementations.

---

## API Prefix

All routes are under `/api/v1`.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | yes | `development` or `production` |
| `PORT` | no | Default `3000` |
| `CLIENT_URLS` | yes | Comma-separated allowed CORS origins |
| `SUPABASE_URL` | yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | yes | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Supabase service-role key (bypasses RLS) |
| `SUPABASE_JWT_SECRET` | yes | JWT secret from Supabase → API Settings |
| `CLOUDINARY_CLOUD_NAME` | yes | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | yes | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | yes | Cloudinary API secret |
| `MAX_FILE_SIZE_MB` | no | Upload size ceiling (default `5`) |
| `CLOUDINARY_TIMEOUT_MS` | no | Cloudinary SDK timeout (default `120000`) |

---

## Development

```bash
npm install
npm run start:dev        # http://localhost:3000
# Swagger UI (dev only): http://localhost:3000/api/docs
```

---

## Production Build

```bash
npm run build
npm run start:prod       # runs dist/main.js
```

---

## Tests

```bash
npm run test             # unit tests
npm run test:cov         # with coverage report
```

---

## Database Migrations

SQL migrations live in `supabase/migrations/`. Run them in order in the Supabase SQL Editor:

| File | Description |
|------|-------------|
| `20260525000000_phase1_foundation.sql` | Profiles table, services catalog, RLS policies |
| `20260528000000_phase2_orders.sql` | Orders table, `next_order_number()` sequence RPC |
| `20260601000000_phase3_virtual_payments.sql` | Demo payment columns + `PAYMENT_PENDING` enum value |
| `20260606000000_phase5_indexes.sql` | Performance indexes (run after existing data is loaded) |

---

## Key Design Decisions

### Auth flow

1. User calls Supabase Auth directly from the frontend to register/log in.
2. Frontend receives a Supabase `access_token` (JWT signed with `SUPABASE_JWT_SECRET`).
3. Frontend sends `Authorization: Bearer <access_token>` on every API request.
4. Backend `JwtAuthGuard` validates the JWT **locally** (no network call), then fetches the user's profile from the `profiles` table once per 60-second cache window.

### Why local JWT validation instead of `supabase.auth.getUser()`?

`supabase.auth.getUser()` makes an outbound HTTP call to Supabase Auth on every cache miss. Local verification with the shared `SUPABASE_JWT_SECRET` saves one network RTT. Tradeoff: we cannot detect token revocation between cache refreshes (max 60 s window). Acceptable for a prototype.

### Admin vs user access

- `profiles.role` = `USER` | `ADMIN` — enforced by backend only
- `JwtAuthGuard` is global (via `APP_GUARD`); use `@Public()` to opt out
- `RolesGuard` + `@Roles('ADMIN')` applied per-controller on admin routes
- All admin DB calls use the service-role Supabase client (bypasses RLS)

### Payment

The payment module is a **virtual/demo prototype**. No real money is collected. No real gateway is connected. Payment state machine:

```
NOT_PAID → PAYMENT_PENDING → PAID
                           → FAILED
                           → NOT_PAID (reset)
```

### File uploads

Files are held in RAM (`memoryStorage`) then streamed to Cloudinary. Max size controlled by `MAX_FILE_SIZE_MB`. Future improvement: direct signed Cloudinary uploads from the browser to remove RAM pressure from this server.

---

## Production Deployment Checklist

### Render / Railway / Fly.io / VPS

- [ ] Set all required env vars (see table above)
- [ ] Set `NODE_ENV=production`
- [ ] Set `CLIENT_URLS` to your production frontend domain(s)
- [ ] Build command: `npm run build`
- [ ] Start command: `npm run start:prod`
- [ ] Run all SQL migrations in Supabase SQL Editor
- [ ] Add Cloudinary credentials
- [ ] Verify `SUPABASE_SERVICE_ROLE_KEY` is the **service-role** key, not anon key
- [ ] Verify `SUPABASE_JWT_SECRET` matches the Supabase project JWT secret
- [ ] Set up uptime monitor to `GET /api/v1/health` every 10 minutes (prevents free-tier spin-down on Render)
- [ ] Enable Supabase Row Level Security (RLS) policies from migration SQL
- [ ] Rotate any secrets that were committed to version control

### Render-specific

```
Build Command: npm install && npm run build
Start Command: npm run start:prod
Health Check Path: /api/v1/health
```

---

## API Reference

Swagger UI is available in development at `http://localhost:3000/api/docs` (disabled in production).

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/auth/register` | Public | Create account |
| POST | `/api/v1/auth/login` | Public | Sign in, get access token |
| GET | `/api/v1/auth/me` | JWT | Current user profile |

### Services

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/services` | Public | List active services |
| GET | `/api/v1/services/:slug` | Public | Single service detail |

### Orders (user)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/orders` | JWT | Create order |
| GET | `/api/v1/orders/my-orders` | JWT | List own orders |
| GET | `/api/v1/orders/:id` | JWT | Single order (ownership enforced) |

### Orders (admin)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/admin/orders` | JWT + ADMIN | Paginated list (lightweight columns) |
| GET | `/api/v1/admin/orders/:id` | JWT + ADMIN | Full order detail |
| PATCH | `/api/v1/admin/orders/:id/status` | JWT + ADMIN | Update order status |

### Payments (demo only)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/payments/demo/start` | JWT | Start demo payment session |
| POST | `/api/v1/payments/demo/confirm` | JWT | Confirm or fail the session |
| PATCH | `/api/v1/payments/demo/reset/:orderId` | JWT | Reset stuck PENDING session |
| PATCH | `/api/v1/payments/demo/pay-later/:orderId` | JWT | Mark as Pay Later |
| GET | `/api/v1/payments/demo/order/:orderId` | JWT | Poll payment status |

### Uploads

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/uploads/document` | JWT | Upload file to Cloudinary |
| DELETE | `/api/v1/uploads/document` | JWT | Delete file (ownership enforced) |

### Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/health` | Public | Liveness probe |
| GET | `/api/v1/health/db` | Public | Readiness probe (DB connectivity) |

---

## Error Response Shape

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Human-readable description",
  "path": "/api/v1/orders",
  "timestamp": "2026-06-06T12:00:00.000Z",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

Every response includes `x-request-id` header that matches the `requestId` field above. Supply `x-request-id` in your request to use your own trace ID.

---

## Error Codes Reference

| Code | HTTP | When |
|------|------|------|
| `UNAUTHORIZED` | 401 | Missing or invalid bearer token |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password at login |
| `FORBIDDEN` | 403 | Authenticated but wrong role |
| `ORDER_NOT_FOUND` | 404 | Order ID not found or belongs to another user |
| `INVALID_SERVICE` | 400 | Service slug unknown or inactive |
| `EMAIL_TAKEN` | 409 | Registration with existing email |
| `ALREADY_PAID` | 400 | Order already paid |
| `PAYMENT_IN_PROGRESS` | 400 | Active payment session exists |
| `INVALID_PAYMENT_STATE` | 400 | Invalid payment state transition |
| `TRANSACTION_ID_MISMATCH` | 400 | Wrong transaction ID in confirm |
| `UNSUPPORTED_FILE_TYPE` | 400 | File MIME type not allowed |
| `FILE_TOO_LARGE` | 400 | File exceeds MAX_FILE_SIZE_MB |
| `CLOUDINARY_UPLOAD_FAILED` | 500 | Upload failed after retries |
| `TOO_MANY_REQUESTS` | 429 | Rate limit exceeded |
| `VALIDATION_ERROR` | 400 | DTO validation failed |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

# Chote Miyan Bade Miya Backend

Backend foundation for a multi-category e-commerce platform, built as a JavaScript ES module application with Node.js, Express, MongoDB, and Mongoose.

## Getting started

1. Use Node.js 20 or newer.
2. Copy `.env.example` to `.env`, set a valid `MONGODB_URI`, and generate `AUTH_SECRET` as described below. For local development without SMS credentials, explicitly set `OTP_DEV_MODE=true`. In production, set `CORS_ORIGINS` to exact frontend origins, set MSG91 credentials, and keep `OTP_DEV_MODE=false`.
3. Install dependencies with `npm install`.
4. Start the server with `npm start` or use `npm run dev` during development. The HTTP server starts only after MongoDB connects.

## API conventions

The API is rooted at `/api/v1`. Successful JSON responses use `{ "success": true, "message": "...", "data": ... }`; `message` is omitted when it adds no useful context. Errors use `{ "success": false, "message": "...", "requestId": "...", "errors": [...] }`, with `errors` included for field validation failures. Validation errors return HTTP 400, duplicate signup emails return HTTP 409, unknown routes return HTTP 404, and unexpected failures return HTTP 500 without internal error details. Responses include an `X-Request-Id` header for support and log correlation.

Logs are newline-delimited JSON with timestamp, level, event, and structured fields. HTTP logs include the request ID, method, matched route pattern, status, and duration; request bodies, query strings, and credentials are not logged.

## Health checks

- `GET /health/live` reports that the process is running and does not depend on MongoDB.
- `GET /health/ready` reports readiness only when the MongoDB connection is established; otherwise it returns HTTP 503.

## Customer signup

`POST /api/v1/auth/signup` accepts `name`, `email`, and `password`, and can also accept an `address` object using the same fields as customer address creation (`name`, E.164 `mobile`, six-digit `pinCode`, `city`, `state`, and `addressLine`). When provided, the validated address is saved with the new customer. Passwords are hashed before persistence; public signup always creates a customer account. Validation errors return HTTP 400 and duplicate emails return HTTP 409.

`POST /api/v1/auth/login` accepts customer or administrator `email` and `password`, and issues a role-appropriate session; admins can use the same `/login` page and are redirected to the admin panel. `POST /api/v1/auth/admin/login` remains available for compatibility. Both return an access/refresh token pair and return the same HTTP 401 response for unknown emails and incorrect passwords. Admin login is limited by email and IP to 5 attempts per 15 minutes. Password hashes are never included in responses. Access tokens are accepted as `Authorization: Bearer <access-token>`; use the existing refresh and logout routes to rotate refresh tokens and revoke sessions.

## Customer identity

The mobile identity flow uses normalized E.164 mobile numbers and one-time codes. Codes are generated with the Node.js cryptographic random-number generator, stored as keyed hashes, expire after 5 minutes, allow at most 5 verification attempts, and have a 60-second resend cooldown. OTP requests are limited to 3 per mobile and 20 per IP in 15 minutes; verification requests are limited to 10 per mobile and 40 per IP in 15 minutes. Shared counters and challenges are stored in MongoDB with TTL indexes.

- `POST /api/v1/auth/otp/request` accepts `{ "mobile": "...", "purpose": "signup" | "login" }`. Eligible accounts receive a code; ineligible numbers receive the same accepted response without a message being sent.
- `POST /api/v1/auth/otp/verify` accepts `{ "mobile": "...", "purpose": "...", "otp": "000000" }`. Login verification returns access and refresh tokens. Signup verification returns a short-lived, single-use signup proof.
- `POST /api/v1/auth/signup/mobile` accepts `{ "name": "...", "email": "...", "password": "...", "mobile": "...", "verificationToken": "..." }`. It creates a customer or links the verified mobile to an existing customer only after password confirmation, preserving the existing customer record/index contract.
- `POST /api/v1/auth/token/refresh` accepts `{ "refreshToken": "..." }`; each refresh rotates the stored refresh-token hash.
- `POST /api/v1/auth/logout` revokes the authenticated session. Revocation is checked for each authenticated request.
- `GET /api/v1/customer/me` and `PATCH /api/v1/customer/me` view and update the customer's name.
- `GET`, `POST`, `PATCH`, and `DELETE /api/v1/customer/me/addresses[/:addressId]` manage addresses owned by the authenticated customer.

Customer-only routes require `Authorization: Bearer <accessToken>`. Access tokens expire after 10 minutes; refresh tokens expire after 30 days, are stored only as keyed hashes, and are rotated on use. A mobile number is immutable in profile updates; linking or changing it uses the verified signup flow and requires the account password.

### SMS and identity configuration

Set `AUTH_SECRET` to a cryptographically random secret of at least 32 characters. For example, generate one locally with `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`; do not commit it.

`TRUST_PROXY_HOPS` defaults to `0`. If the service is behind a trusted reverse proxy, configure the exact number of proxy hops so `req.ip` can be used for OTP IP throttling. Do not trust arbitrary forwarded headers.

Production OTP delivery uses MSG91 Flow. Configure `SMS_PROVIDER=msg91`, `MSG91_AUTH_KEY`, `MSG91_FLOW_TEMPLATE_ID`, and `MSG91_OTP_VARIABLE` using environment variables. `MSG91_OTP_VARIABLE` must exactly match the placeholder in the approved MSG91 Flow template (for example, `VAR1`). The provider's successful API response means the request was accepted, not that a handset received the SMS.

For local development only, `OTP_DEV_MODE=true` explicitly bypasses SMS and returns a development-only OTP in the request response. This flag is rejected in production. Keep it `false` when using MSG91; no OTP is returned in production responses or logs. Provider failures produce an error response and are not represented as successful delivery.

## Catalog and inventory

Public catalog routes only return active categories and active products. Product search is literal, case-insensitive text matching; category filtering accepts a category slug. Optional `featured=true|false` and `bestseller=true|false` filters use the admin-managed flags. Variant products expose `priceFrom`, derived from the lowest variant selling price, and price filters/sorts use that value. Prices support up to two decimal places. Pagination uses `page` and `limit` (maximum 100). Sort options are `newest`, `price_asc`, and `price_desc`. Popularity sorting is intentionally not exposed until reliable sales data exists.

- `GET /api/v1/categories?page=1&limit=20` and `GET /api/v1/categories/:slug` list active categories and fetch one active category.
- `GET /api/v1/products?q=steel&category=kitchen&minPrice=100&maxPrice=2000&sort=newest&page=1&limit=20` lists active products. `GET /api/v1/products/:slug` fetches an active product with active category links.
- `GET`, `POST`, `PATCH`, and `DELETE /api/v1/admin/categories[/:categoryId]` manage category records. Deletion returns HTTP 409 while a product or child category depends on the category.
- `GET`, `POST`, `PATCH`, and `DELETE /api/v1/admin/products[/:productId]` manage products. New products default to active so they appear in the storefront; choose draft or inactive to keep them hidden. Product deletion is a soft deactivation so inventory history remains referentially sound.
- `POST /api/v1/admin/products/:productId/variants`, `PATCH /api/v1/admin/products/:productId/variants/:variantId`, and `DELETE /api/v1/admin/products/:productId/variants/:variantId` manage optional variants. Variant SKU, prices, and attributes are editable; stock must be changed through inventory adjustments. A variant with positive stock cannot be deleted.
- `POST /api/v1/admin/inventory/adjustments` accepts `{ "productId": "...", "variantId": "...", "delta": 5, "reason": "Restocked" }`. A negative delta cannot reduce stock below zero. `GET /api/v1/admin/inventory/adjustments?productId=...&page=1&limit=20` returns the adjustment history.

All `/api/v1/admin/*` routes require a live admin access token. Admin identities are provisioned only through a trusted, out-of-band operational process; public email and mobile signup always create customer accounts. Admin password sign-in is rate limited; customers can use the existing password or mobile OTP login flows. Do not grant the admin role through customer-facing APIs. Product creation and variant creation record initial stock in the same MongoDB transaction as the catalog write; inventory adjustments also update stock and append history transactionally. The MongoDB deployment must support transactions (for example, Atlas or a replica set).

Category images and admin product images are selected from the device and uploaded through the admin-only `POST /api/v1/admin/uploads/images` endpoint, which accepts valid PNG, JPEG, or WebP files up to 5 MB. API-level category and product image values can also be hosted HTTP(S) URLs. For Cloudinary uploads, set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in the backend environment; configure all three together. The server validates raster image content and size, signs the upload using the server-only API secret, and returns the confirmed HTTPS asset URL. All uploads are stored under the Cloudinary folder `chote-miyan-bade-miya`; category and product records save the returned HTTPS URL. Credentials must never be placed in frontend environment variables. For local development only, `LOCAL_IMAGE_UPLOADS=true` explicitly selects the local disk adapter, even when Cloudinary credentials are present; images are served from the backend's `/uploads` route. Leave this setting `false` or unset to use Cloudinary. Local uploads are forbidden in production. SKU uniqueness is enforced across each product's base SKU and variant SKUs and across product documents. Prices and stock are validated by the API and database model; checkout remains responsible for authoritative order-time price and stock checks.

The admin UI is available at `/admin` and uses the provisioned account's email and password. To establish the first admin, have a trusted operator provision an account and grant `role: "admin"` through the organization's secured, out-of-band database/operations procedure. There is intentionally no public admin signup; do not grant roles through customer-facing APIs.

## Testing

Tests use Node's built-in test runner and are organized under `tests/unit/` and `tests/integration/`. Shared HTTP test-server helpers live under `tests/helpers/`. Run unit and integration tests with `npm test`. MongoDB integration tests only run outside production when `MONGODB_TEST_URI` is distinct from `MONGODB_URI` and points to a database whose name contains `test`; tests skip if the dedicated database is unavailable.

## Architecture

This project uses a modular monolith structure. Shared application infrastructure lives under `src/`; business-domain boundaries are reserved under `src/modules/`. As features are added, each module should own its relevant controllers, services, models, routes, validators, and tests. Cross-cutting infrastructure belongs in the shared configuration, integrations, and middleware areas.

- `src/app.js` configures the Express application and shared middleware.
- `src/server.js` validates configuration, connects to MongoDB before starting the HTTP server, and handles graceful shutdown.
- `src/config/` validates environment configuration and owns the shared MongoDB connection lifecycle.
- `src/modules/auth/` contains signup routes, validation, controller, and service.
- `src/modules/auth/models/` contains OTP challenge, rate-limit, and session records.
- `src/modules/health/` contains liveness and readiness endpoints.
- `src/modules/categories/`, `src/modules/products/`, and `src/modules/inventory/` own catalog, variant, and stock-adjustment APIs and models.
- `src/modules/users/` owns the customer profile, saved addresses, and user model.
- `src/integrations/sms/` contains the SMS abstraction and MSG91 adapter.
- `src/middlewares/` contains request IDs, structured HTTP logging, security headers, CORS, request validation, and centralized error handling.
- `src/utils/logger.js` provides structured application logging.
- `tests/` is reserved for unit and integration tests and shared test fixtures/helpers.
- `docs/`, `scripts/`, and `logs/` hold project documentation, operational scripts, and local logs.

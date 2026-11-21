# Chote Miyan Bade Miya Frontend

React, Vite, JavaScript, Tailwind CSS, React Router, Lucide React, and Framer Motion.

## Local setup

1. Copy `.env.example` to `.env` and set `VITE_API_BASE_URL` to the backend `/api/v1` base URL.
2. From this directory run `npm install`.
3. Start the frontend with `npm run dev`.
4. Ensure the backend allows the Vite origin in its CORS configuration.

The Vite server defaults to `http://localhost:5173`. `VITE_API_BASE_URL` is read from the frontend environment at build time; when unset, the Render backend URL is used. Set it to `http://localhost:3000/api/v1` in your local `.env` when you want to use a local backend. Set the same variable in the frontend deployment environment and rebuild/redeploy after changing it. Frontend environment variables prefixed with `VITE_` are public and must never contain credentials or server secrets.

The original supplied brand artwork is stored as `public/brand-logo.png` and rendered without cropping, filtering, or alteration. The visual palette is sampled from the artwork: deep black, aqua/turquoise, copper orange, and warm off-white. The footer Instagram link uses the handle printed in the logo.

## Routes

- `/` — dynamic home sections for active categories, featured, and latest products. Bestsellers are omitted until reliable sales data is available.
- `/categories` and `/categories/:slug` — active category listing and its product collection.
- `/products` — catalog filters, sorting, and pagination.
- `/products/:slug` — active product detail, images, variants, stock display, and quantity selector.
- `/search?q=...` — catalog search.
- `/signup` and `/login` — customer account creation (including a delivery address) and email/password authentication.

Catalog and authentication requests use Fetch against the existing API. The UI consumes the `{ success, data }` response format, shows loading/error/empty states, and does not populate missing product or category data with fabricated records. Product/category images use the hosted URLs provided by the API; absent images use a neutral placeholder. Authentication tokens remain in memory only and are not written to browser storage; a page reload requires signing in again.

The account control links to sign-in when signed out and supports sign-out when authenticated. Bag and add-to-bag controls remain disabled until cart integration is available.

## Admin catalog management

- `/admin/login` requests and verifies an admin email OTP. Only a backend-authorized admin session can open `/admin`; customer sessions are redirected away. Customer mobile OTP remains unchanged. Access and refresh tokens remain in memory, and admin API requests use the backend's role-protected endpoints.
- `/admin` shows product/category totals and stock/status summaries from the catalog APIs. `/admin/products` supports search, status filtering, pagination, stock adjustments, and safe product deactivation. Product creation/editing includes categories, pricing, images, status, featured/bestseller flags, variants, and inventory. `/admin/categories` supports category CRUD; the backend rejects deletion when products or child categories depend on the category.
- Admin identities are not created by this UI. A trusted operator must provision the first admin out of band. The backend must have SMTP configured to send admin email OTPs. See the backend README for the required policy and configuration.
- Product and category image URLs can point to hosted HTTP(S) images. File uploads are sent to the backend's admin-only upload endpoint. Configure Cloudinary credentials only in the backend `.env` to enable cloud uploads; no storage credentials belong in the frontend. The backend validates PNG/JPEG/WebP images up to 5 MB before confirming an upload. See the backend README for Cloudinary and local-development setup.

# SupplyScore

SupplyScore is a small MERN vendor-review dashboard. Teams can record pseudonymous vendor codes, score operational performance, flag risk, and keep review dates visible without storing contact details or contract secrets.

## Features

- Create, browse, update, and delete vendor reviews
- Search aliases/codes and filter by category, risk, or workflow status
- Delivery, quality, and communication scores validated from 1–5
- Server-calculated average score and portfolio metrics
- Unique normalized vendor codes and bounded request bodies
- Centralized validation, duplicate, not-found, and server errors
- Responsive React dashboard with loading, empty, and error states

## Stack and requirements

- Node.js 20+
- React 18 and Vite
- Express, MongoDB, and Mongoose
- Local MongoDB or a MongoDB Atlas connection string

## First-time setup

1. Clone the repository and enter this project folder.
2. Configure the API:

   ```bash
   cd server
   cp .env.example .env
   npm install
   ```

3. Edit `server/.env` if needed.
4. Install the frontend:

   ```bash
   cd ../client
   npm install
   ```

5. Start the API in one terminal:

   ```bash
   cd server
   npm run dev
   ```

6. Start React in another terminal:

   ```bash
   cd client
   npm run dev
   ```

7. Open `http://localhost:5174`. The API health endpoint is `http://localhost:4200/api/health`.

The client proxies `/api` to the local API. `.env.example` contains no secret.

## Validation

```bash
cd server && npm run check
cd ../client && npm run check
npm run build
```

Local dependencies, `.env` files, logs, and generated builds are ignored.

## API routes

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/reviews` | Search and filter reviews |
| `GET` | `/api/reviews/metrics` | Get score and risk metrics |
| `POST` | `/api/reviews` | Create a review |
| `PATCH` | `/api/reviews/:id` | Update supported fields |
| `DELETE` | `/api/reviews/:id` | Delete a review |


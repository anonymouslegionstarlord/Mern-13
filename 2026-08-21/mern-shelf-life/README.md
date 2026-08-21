# ShelfLife

ShelfLife is a compact MERN pantry tracker that helps households use food before it expires. It combines a responsive React dashboard with an Express API and MongoDB persistence.

## Features

- Add, view, update, consume, and delete pantry items
- Track category, quantity, unit, storage location, purchase date, and expiry date
- Filter by status or category and search by item name
- Dashboard totals for available, expiring soon, expired, and consumed items
- Mongoose schema rules plus explicit request validation
- Centralized API errors and friendly frontend loading/error states

## Setup

1. Install Node.js 20+ and start MongoDB locally (or use MongoDB Atlas).
2. Copy `server/.env.example` to `server/.env` and update the URI if needed.
3. In `server`, run `npm install` and `npm run dev`.
4. In a second terminal, open `client`, run `npm install` and `npm run dev`.
5. Open `http://localhost:5173`. Vite proxies `/api` to port 5000.

## API

- `GET /api/items?status=expiring&category=Produce&search=milk`
- `GET /api/items/stats`
- `POST /api/items`
- `PATCH /api/items/:id`
- `DELETE /api/items/:id`


# AssetPulse

AssetPulse is a small MERN inventory dashboard for tracking workplace IT assets, assignments, warranties, and maintenance dates.

## Features

- Create, search, filter, update, and delete asset records
- Track serial number, asset type, condition, assignee, location, warranty, and service date
- Mark assets Available, Assigned, Repair, or Retired
- Dashboard counts for total, assigned, repair, warranty-expired, and service-due assets
- MongoDB persistence with Mongoose constraints and indexes
- Express request validation, duplicate-serial handling, and centralized errors
- Responsive React/Vite interface with loading and error states

## Setup

1. Install Node.js 20+ and start MongoDB locally or create a MongoDB Atlas database.
2. Copy `server/.env.example` to `server/.env` and adjust its values.
3. In `server`, run `npm install` and `npm run dev`.
4. In `client`, run `npm install` and `npm run dev`.
5. Open `http://localhost:5173`; Vite proxies `/api` to port 5000.

## API

- `GET /api/assets?status=Repair&type=Laptop&search=DEL`
- `GET /api/assets/stats`
- `POST /api/assets`
- `PATCH /api/assets/:id`
- `DELETE /api/assets/:id`


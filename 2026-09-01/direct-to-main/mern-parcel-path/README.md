# ParcelPath

ParcelPath is a privacy-minded MERN parcel milestone dashboard. It records memorable aliases instead of real tracking numbers or exact addresses, while still making incoming and outgoing deliveries easy to coordinate.

## Features

- Create, search, filter, update, and delete parcel records
- Track label-created, in-transit, ready, delivered, and exception milestones
- Dashboard totals for active, overdue, delivered, and exception parcels
- Duplicate-alias protection and server-side request validation
- React loading, empty, confirmation, and error states
- Escaped search input, bounded JSON requests, and centralized API errors

## Stack

- React 18 and Vite 6
- Node.js and Express 4
- MongoDB and Mongoose 8

## First-time setup

Requirements: Node.js 20 or newer and a local or hosted MongoDB instance.

1. Open a terminal in `server`.
2. Copy `.env.example` to `.env`.
3. Edit `MONGODB_URI` only if MongoDB is not running at the example local address.
4. Run `npm install`.
5. Run `npm run dev`.
6. Open another terminal in `client`.
7. Run `npm install`.
8. Run `npm run dev`.
9. Open `http://localhost:5173`.

The API listens on `http://localhost:5000` by default. To use another API origin, start the client with a `VITE_API_URL` environment variable containing the complete API base URL, such as `http://localhost:5000/api`.

## Validation without MongoDB

From `server`, run `npm run check`. From `client`, run `npm install` once and then `npm run build`. A live end-to-end check additionally requires MongoDB.

## API routes

- `GET /api/health`
- `GET /api/parcels`
- `GET /api/parcels/stats`
- `POST /api/parcels`
- `PATCH /api/parcels/:id/status`
- `DELETE /api/parcels/:id`

## Privacy note

Use broad areas and self-chosen aliases. This demo is intentionally not a carrier tracking service and should not store real tracking codes, precise addresses, or personal recipient details.

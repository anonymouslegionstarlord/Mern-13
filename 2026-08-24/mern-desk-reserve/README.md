# DeskReserve

DeskReserve is a compact MERN workspace-booking application. Employees can reserve desks for time slots while the API prevents overlapping active bookings.

## Features

- Create, search, filter, cancel, and delete reservations
- Track employee, email, desk, zone, date, time window, and purpose
- Reject overlapping bookings for the same desk and date
- Dashboard counts for total, today, upcoming, and cancelled reservations
- React/Vite frontend, Express backend, and MongoDB/Mongoose persistence
- Request validation, duplicate protection, centralized errors, and responsive UI states

## Setup

1. Install Node.js 20+ and start MongoDB locally or create a MongoDB Atlas database.
2. Copy `server/.env.example` to `server/.env` and update values when necessary.
3. In `server`, run `npm install` and `npm run dev`.
4. In `client`, run `npm install` and `npm run dev`.
5. Open `http://localhost:5173`. Vite proxies `/api` to port 5000.

## API

- `GET /api/reservations?date=2026-08-24&zone=Quiet&search=Mayank`
- `GET /api/reservations/stats`
- `POST /api/reservations`
- `PATCH /api/reservations/:id`
- `DELETE /api/reservations/:id`


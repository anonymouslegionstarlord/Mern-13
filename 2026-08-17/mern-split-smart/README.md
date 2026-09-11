# SplitSmart

A compact MERN application for recording shared expenses and calculating what each participant paid, owes, and should receive.

## Features

- Create, list, filter, update, and delete shared expenses
- Split each expense equally between selected participants
- Live settlement summary across all visible expenses
- MongoDB persistence with Mongoose validation
- Express validation and centralized error responses
- Responsive React dashboard with loading and error states

## Local setup

1. Copy `server/.env.example` to `server/.env`.
2. Start MongoDB locally or replace `MONGODB_URI` with a MongoDB Atlas connection string.
3. Run `npm install` and `npm run dev` inside `server`.
4. Run `npm install` and `npm run dev` inside `client`.
5. Open the Vite address, normally `http://localhost:5173`.

The Vite development server proxies `/api` to `http://localhost:5000`.

## API routes

- `GET /api/expenses?category=Food`
- `POST /api/expenses`
- `PATCH /api/expenses/:id`
- `DELETE /api/expenses/:id`
- `GET /api/expenses/summary/balances`


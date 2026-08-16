# HabitHeat

A compact MERN habit tracker for creating habits, recording daily completions, filtering by category, and viewing streak statistics.

## Features

- Create, edit, delete, and complete habits
- MongoDB persistence with Mongoose validation
- Category filtering and completion statistics
- Duplicate-completion protection for the same calendar day
- Express error middleware and friendly React error states
- Responsive, dependency-light React interface

## Run locally

1. Copy `server/.env.example` to `server/.env` and update `MONGODB_URI` if needed.
2. In `server`, run `npm install` and `npm run dev`.
3. In `client`, run `npm install` and `npm run dev`.
4. Open the Vite URL, normally `http://localhost:5173`.

The Vite development server proxies `/api` requests to `http://localhost:5000`.

## API

- `GET /api/habits?category=Health`
- `POST /api/habits`
- `PATCH /api/habits/:id`
- `POST /api/habits/:id/complete`
- `DELETE /api/habits/:id`


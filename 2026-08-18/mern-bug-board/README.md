# BugBoard

A portfolio-ready MERN defect tracker for QA teams. Record reproducible defects, filter the backlog, update workflow status, and monitor severity metrics from a focused React dashboard.

## Features

- Create, list, filter, update, and delete defects
- Capture module, severity, status, reproduction steps, expected result, and actual result
- Dashboard counts for open, critical, resolved, and total defects
- MongoDB persistence with Mongoose validation
- Express request validation and centralized error handling
- Responsive React/Vite interface with loading and error states

## Setup

1. Copy `server/.env.example` to `server/.env`.
2. Start local MongoDB or set `MONGODB_URI` to your MongoDB Atlas URI.
3. In `server`, run `npm install` and `npm run dev`.
4. In `client`, run `npm install` and `npm run dev`.
5. Open the Vite address, normally `http://localhost:5173`.

The Vite development server proxies `/api` to `http://localhost:5000`.

## API

- `GET /api/defects?status=Open&severity=Critical`
- `GET /api/defects/stats`
- `POST /api/defects`
- `PATCH /api/defects/:id`
- `DELETE /api/defects/:id`


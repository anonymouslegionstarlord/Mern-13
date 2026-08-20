# ApplyFlow

A focused MERN job-application tracker for managing opportunities, interview stages, follow-up dates, and pipeline statistics.

## Features

- Create, filter, update, and delete job applications
- Track company, role, location, source, status, application date, next action, and notes
- Dashboard totals for active applications, interviews, offers, and overdue follow-ups
- MongoDB persistence with Mongoose validation
- Express request validation and centralized error handling
- Responsive React/Vite interface with inline workflow updates

## Setup

1. Copy `server/.env.example` to `server/.env`.
2. Start MongoDB locally or replace `MONGODB_URI` with a MongoDB Atlas URI.
3. Run `npm install` and `npm run dev` inside `server`.
4. Run `npm install` and `npm run dev` inside `client`.
5. Open the Vite address, normally `http://localhost:5173`.

The frontend proxies `/api` requests to `http://localhost:5000` during development.

## API

- `GET /api/applications?status=Interview&search=qa`
- `GET /api/applications/stats`
- `POST /api/applications`
- `PATCH /api/applications/:id`
- `DELETE /api/applications/:id`


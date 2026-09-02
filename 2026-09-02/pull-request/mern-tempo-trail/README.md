# TempoTrail

TempoTrail is a MERN practice dashboard for musicians. It organizes repertoire, compares current and target tempo, schedules focused sessions, and records consistent practice without turning the experience into a generic to-do list.

## Features

- Create, search, filter, update, and delete repertoire items
- Track learning, polishing, performance-ready, and archived states
- Compare current BPM with target BPM through visual progress bars
- Log practice sessions atomically and record the last session time
- View due work, ready pieces, total sessions, and average tempo progress
- Unique practice codes, request validation, escaped search, and centralized errors
- Responsive React loading, empty, confirmation, and failure states

## Stack

- React 18 and Vite 6
- Node.js and Express 4
- MongoDB and Mongoose 8

## First-time setup

Requirements: Node.js 20 or newer and a local or hosted MongoDB instance.

1. Open a terminal in `server`.
2. Copy `.env.example` to `.env`.
3. Edit `MONGODB_URI` only if MongoDB is not running at the example address.
4. Run `npm install`.
5. Run `npm run dev`.
6. Open another terminal in `client`.
7. Run `npm install`.
8. Run `npm run dev`.
9. Open `http://localhost:5173`.

The API listens on `http://localhost:5000` by default. To use another API, set the client’s `VITE_API_URL` to the complete API base URL, such as `http://localhost:5000/api`.

## Validation without MongoDB

From `server`, run `npm run check`. From `client`, run `npm install` once and then `npm run build`. MongoDB is required for a live end-to-end check.

## API routes

- `GET /api/health`
- `GET /api/pieces`
- `GET /api/pieces/stats`
- `POST /api/pieces`
- `PATCH /api/pieces/:id/status`
- `POST /api/pieces/:id/practice`
- `DELETE /api/pieces/:id`

## Scope

TempoTrail stores practice planning data only. It does not record audio, judge performance quality, or provide medical guidance about playing technique.

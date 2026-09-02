# ShotStack

ShotStack is a small MERN production board for visual shot lists. It keeps shot codes, framing notes, schedules, priorities, and approval progress in one responsive dashboard.

## Features

- Create, search, filter, update, and delete shot records
- Track planned, ready, captured, and approved workflow states
- Filter by frame type, priority, and status
- Monitor planned runtime, high-priority work, and production totals
- Unique shot codes and explicit server-side validation
- Escaped search expressions, bounded request bodies, and centralized API errors
- React loading, empty, confirmation, and failure states

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

The API listens on `http://localhost:5000` by default. To use another API, set `VITE_API_URL` for the client to the complete API base URL, such as `http://localhost:5000/api`.

## Validation without MongoDB

From `server`, run `npm run check`. From `client`, run `npm install` once and then `npm run build`. MongoDB is required for a live end-to-end check.

## API routes

- `GET /api/health`
- `GET /api/shots`
- `GET /api/shots/stats`
- `POST /api/shots`
- `PATCH /api/shots/:id/status`
- `DELETE /api/shots/:id`

## Scope

This demo manages production metadata only. It does not upload media, store cast details, or replace a full production asset manager.

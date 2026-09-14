# PortionPilot

PortionPilot is a MERN recipe production planner. Store a reliable base recipe, scale ingredients to a target serving count, and see the estimated cost before prep begins.

## Features

- Create, search, filter, update, and delete recipes
- Add 1-20 validated ingredients with practical kitchen units
- Scale ingredient quantities and estimated cost in the browser
- Track draft, tested, and favorite recipe states
- Dashboard totals and average cost-per-serving metric
- Duplicate-name handling, escaped search, bounded requests, and centralized errors
- Responsive React interface with loading, empty, and confirmation states

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

The API listens on `http://localhost:5000` by default. To use another API origin, start the client with `VITE_API_URL` set to a complete API base URL such as `http://localhost:5000/api`.

## Validation without MongoDB

From `server`, run `npm run check`. From `client`, run `npm install` once and then `npm run build`. MongoDB is required for a live end-to-end check.

## API routes

- `GET /api/health`
- `GET /api/recipes`
- `GET /api/recipes/stats`
- `POST /api/recipes`
- `PATCH /api/recipes/:id/status`
- `DELETE /api/recipes/:id`

## Cost scope

Costs are simple user-entered estimates. PortionPilot does not fetch live prices, convert currencies, or make nutritional claims.

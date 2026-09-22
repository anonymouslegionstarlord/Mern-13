# PollPulse

PollPulse is a small MERN polling application for quick team decisions. Create time-boxed polls, collect votes, compare option shares, and close decisions from a responsive dashboard.

## Features

- Create polls with 2-6 unique options and a closing time
- Vote with an atomic MongoDB update to avoid lost increments
- Search and filter open or closed polls
- Close polls manually and delete obsolete polls
- Live vote totals, percentages, and dashboard metrics
- Request validation, safe text search, and centralized API errors

## Stack

React 18, Vite 6, Express 4, Node.js, MongoDB, and Mongoose 8.

## First-time setup

Requirements: Node.js 20+ and MongoDB.

1. Start the API:

   ```bash
   cd server
   cp .env.example .env
   npm install
   npm run dev
   ```

   Windows PowerShell alternative: `Copy-Item .env.example .env`.

2. Start the client in another terminal:

   ```bash
   cd client
   npm install
   npm run dev
   ```

3. Open `http://localhost:5173`. Check the API at `http://localhost:5000/api/health`.

For deployment, create `client/.env` with `VITE_API_URL=https://your-api.example.com/api`. Never commit secrets or `.env` files.


# RenewalRadar

RenewalRadar is a small MERN dashboard for tracking recurring software, media, and business subscriptions before their next charge.

## Features

- Create, search, filter, pause, resume, cancel, and delete subscriptions
- Weekly, monthly, quarterly, and yearly billing cycles
- Normalized monthly-cost reporting across billing cycles
- Upcoming 30-day renewal and auto-renew metrics
- Server-side validation, bounded text search, and centralized errors
- Responsive React interface with loading and failure states

## Stack

React 18, Vite 6, Express 4, Node.js, MongoDB, and Mongoose 8.

## First-time setup

Requirements: Node.js 20+ and a local or hosted MongoDB database.

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

3. Open `http://localhost:5173`. The health endpoint is `http://localhost:5000/api/health`.

For a deployed backend, create `client/.env` containing `VITE_API_URL=https://your-api.example.com/api`. Never commit `.env` files or credentials.


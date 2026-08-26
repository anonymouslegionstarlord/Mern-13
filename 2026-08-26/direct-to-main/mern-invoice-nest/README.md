# InvoiceNest

InvoiceNest is a small MERN application for freelancers and small teams to track invoices, due dates, payment state, and outstanding revenue.

## Features

- Create, edit, search, filter, and delete invoices
- Mark invoices as draft, sent, paid, or overdue
- Dashboard totals for billed, collected, outstanding, and overdue invoices
- Server-side validation, safe search expressions, and centralized API errors
- Responsive React interface with clear loading and failure states

## Stack

React 19, Vite, Express 5, Node.js, MongoDB, and Mongoose.

## First-time setup

Requirements: Node.js 20+ and a local or hosted MongoDB database.

1. Configure and start the API:

   ```bash
   cd server
   cp .env.example .env
   npm install
   npm run dev
   ```

   PowerShell alternative: `Copy-Item .env.example .env`.

2. In another terminal, start the client:

   ```bash
   cd client
   npm install
   npm run dev
   ```

3. Open `http://localhost:5173`. The API health endpoint is `http://localhost:5000/api/health`.

To use another API URL, create `client/.env` with `VITE_API_URL=http://localhost:5000/api`.

## Production checks

Run `npm run build` in `client` and `npm start` in `server`. Never commit either `.env` file or credentials.


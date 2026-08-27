# LibraryLoop

LibraryLoop is a small MERN circulation dashboard for community and classroom libraries. It tracks active loans, returns, due dates, and overdue books without requiring a full library-management suite.

## Features

- Create, search, filter, return, and delete book loans
- Borrower name and email validation
- Automatic overdue and due-soon calculations
- Dashboard totals for active, overdue, returned, and due-soon loans
- Responsive React interface with explicit loading and failure states
- Centralized Express errors and safe server-side text search

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

For a deployed API, create `client/.env` containing `VITE_API_URL=https://your-api.example.com/api`. Never commit `.env` files or credentials.


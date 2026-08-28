# ConsentLedger

ConsentLedger is a small MERN dashboard for recording and reviewing privacy-consent decisions with pseudonymous subject references.

## Features

- Create, search, filter, revoke, and delete consent records
- Purpose, channel, policy-version, grant-date, and expiry tracking
- Active, expiring, expired, and revoked metrics
- Effective status derived from expiry dates instead of a scheduled job
- Server-side validation, bounded searches, and centralized error responses
- Responsive React interface with loading and failure states

Use opaque subject references such as customer_2048. Do not enter names, email addresses, tokens, or other sensitive personal data.

## Stack

React 18, Vite 6, Express 4, Node.js, MongoDB, and Mongoose 8.

## First-time setup

Requirements: Node.js 20+ and a local or hosted MongoDB database.

1. Start the API:

       cd server
       cp .env.example .env
       npm install
       npm run dev

   Windows PowerShell alternative: Copy-Item .env.example .env

2. Start the client in another terminal:

       cd client
       npm install
       npm run dev

3. Open http://localhost:5173. The health endpoint is http://localhost:5000/api/health.

For a deployed backend, create client/.env containing VITE_API_URL=https://your-api.example.com/api. Never commit .env files or credentials.


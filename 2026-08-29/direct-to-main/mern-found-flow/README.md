# FoundFlow

FoundFlow is a small MERN lost-and-found coordination dashboard for campuses, workplaces, and community spaces.

## Features

- Report, search, filter, update, and delete lost or found items
- Categories, locations, incident dates, safe contact aliases, and status tracking
- Match suggestions scored by category, location, date proximity, and shared title words
- Open, lost, found, and returned dashboard metrics
- Server-side validation, bounded searches, and centralized error responses
- Responsive React interface with loading, confirmation, and failure states

Use a non-sensitive contact alias such as front-desk-2. Do not enter phone numbers, email addresses, access codes, or other private information.

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


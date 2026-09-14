# RecycleRoute

RecycleRoute is a small MERN dashboard for coordinating e-waste pickup requests from intake through verified recycling.

## Features

- Create, search, filter, advance, and delete e-waste pickup requests
- Item type, quantity, estimated weight, pickup area, requested date, and safe contact alias
- Enforced requested, scheduled, collected, and recycled workflow
- Pending-request, collected-item, recycled-item, and diverted-weight metrics
- Server-side validation, bounded searches, and centralized error responses
- Responsive React interface with loading, confirmation, and failure states

Use a broad pickup area and a non-sensitive contact alias. Do not enter a home address, phone number, email address, device serial number, or account credential.

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


# CommuteCarbon

CommuteCarbon is a small MERN dashboard for recording everyday trips and comparing estimated transport emissions.

## Features

- Record, search, filter, review, and delete commute entries
- Eight transport modes, distance, passenger, date, purpose, and notes tracking
- Estimated CO2e, car-baseline savings, distance, and reviewed-trip metrics
- Server-calculated values, validation, bounded searches, and centralized errors
- Responsive React interface with loading, confirmation, and failure states

Emission factors are approximate portfolio-demo values, not certified carbon accounting. Review current local methodology before using the results for reporting or policy decisions.

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


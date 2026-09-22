# SeedShare

SeedShare is a small MERN community board for offering seed packets and tracking them from available to shared.

## Features

- Create, search, filter, reserve, share, reopen, and delete seed listings
- Plant, variety, seed type, packet count, harvest year, pickup area, and growing notes
- Available, reserved, and shared workflow
- Available-packet and listing metrics
- Server-side validation, bounded searches, and centralized errors
- Responsive React interface with loading, confirmation, and failure states

Use a broad pickup area and a community alias. Accurately label seeds and check local rules before sharing restricted, patented, treated, or invasive varieties.

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


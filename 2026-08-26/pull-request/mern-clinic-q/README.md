# ClinicQ

ClinicQ is a small MERN appointment queue for outpatient clinics. It gives reception teams a focused view of bookings, arrivals, active consultations, and completed visits.

## Features

- Create appointments with department, priority, time, and visit reason
- Search and filter the live queue by department or workflow status
- Enforced transitions from booked through check-in, consultation, and completion
- Automatic check-in and consultation timestamps
- Queue metrics for booked, waiting, in-consultation, and completed appointments
- Request validation, safe text search, and centralized API error responses

## Stack

React 18, Vite, Express, Node.js, MongoDB, and Mongoose.

## First-time setup

Requirements: Node.js 20+ and MongoDB.

1. Start the API:

   ```bash
   cd server
   cp .env.example .env
   npm install
   npm run dev
   ```

   On Windows PowerShell use `Copy-Item .env.example .env`.

2. Start the client in another terminal:

   ```bash
   cd client
   npm install
   npm run dev
   ```

3. Open `http://localhost:5173`. Check the API at `http://localhost:5000/api/health`.

To use a deployed API, create `client/.env` containing `VITE_API_URL=https://your-api.example.com/api`.

## Workflow

`booked -> checked-in -> in-consultation -> completed`. Booked or waiting appointments can also be cancelled or marked as no-show.


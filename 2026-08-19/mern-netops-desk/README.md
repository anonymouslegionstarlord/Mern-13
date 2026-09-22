# NetOps Desk

A compact MERN incident desk for tracking LAN, WAN, wireless, DNS, VPN, and infrastructure problems from report to resolution.

## Features

- Create, view, filter, update, and delete network incidents
- Record site, device, category, priority, owner, symptoms, and resolution notes
- Dashboard counts for active, critical, resolved, and total incidents
- MongoDB persistence with Mongoose validation
- Express request validation and centralized error responses
- Responsive React/Vite interface with workflow status updates

## Setup

1. Copy `server/.env.example` to `server/.env`.
2. Start MongoDB locally or replace `MONGODB_URI` with a MongoDB Atlas URI.
3. Run `npm install` and `npm run dev` inside `server`.
4. Run `npm install` and `npm run dev` inside `client`.
5. Open the Vite address, normally `http://localhost:5173`.

The frontend proxies `/api` requests to `http://localhost:5000` during development.

## API

- `GET /api/incidents?status=Investigating&priority=P1`
- `GET /api/incidents/stats`
- `POST /api/incidents`
- `PATCH /api/incidents/:id`
- `DELETE /api/incidents/:id`


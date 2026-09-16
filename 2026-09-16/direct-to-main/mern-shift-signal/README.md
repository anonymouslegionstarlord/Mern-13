# ShiftSignal

ShiftSignal is a small MERN operations handoff board for support, facilities, and technical teams. It turns informal shift notes into owned actions without requiring personal contact information.

## Features

- Handoff CRUD with search plus status and priority filters
- Morning, evening, night, and weekend shift labels
- Priority, category, ownership alias, and due-time tracking
- Open, acknowledged, and resolved workflow
- Event/due-time ordering validation and overdue detection
- Dashboard totals for critical, open, acknowledged, and overdue work
- Bounded requests, escaped searches, duplicate handling, and centralized errors
- Responsive React interface with loading, empty, and error states

## Stack and requirements

- Node.js 20+
- React 18 with Vite
- Express, MongoDB, and Mongoose
- Local MongoDB or a MongoDB Atlas connection string

## First-time setup

1. Clone the repository and enter this project folder.
2. Configure and install the API:

   ~~~bash
   cd server
   cp .env.example .env
   npm install
   ~~~

3. Edit server/.env if the database or ports differ.
4. Install the client:

   ~~~bash
   cd ../client
   npm install
   ~~~

5. Start the API in one terminal:

   ~~~bash
   cd server
   npm run dev
   ~~~

6. Start React in another terminal:

   ~~~bash
   cd client
   npm run dev
   ~~~

7. Open http://localhost:5178. The health endpoint is http://localhost:4600/api/health.

The Vite server proxies /api to Express. The environment example contains no secret.

## Validation

~~~bash
cd server && npm run check
cd ../client && npm run check
npm run build
~~~

Dependency folders, local environment files, logs, and generated builds are ignored.

## API

| Method | Route | Purpose |
| --- | --- | --- |
| GET | /api/handoffs | Search and filter handoffs |
| GET | /api/handoffs/metrics | Return operational metrics |
| POST | /api/handoffs | Create a handoff |
| PATCH | /api/handoffs/:id | Update supported fields |
| DELETE | /api/handoffs/:id | Delete a handoff |

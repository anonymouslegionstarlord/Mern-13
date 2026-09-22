# ReleaseGate

ReleaseGate is a small MERN quality-readiness dashboard for tracking evidence and decisions before a software release. It is designed as a portfolio project for QA, release, and engineering workflows.

## Features

- Release-check CRUD with search plus status and severity filters
- Regression, security, performance, accessibility, documentation, and deployment checks
- Blocker-to-low severity and not-started-to-passed workflow
- Evidence links, pseudonymous ownership, deadlines, and overdue detection
- Mandatory reason when a check is waived
- Server-calculated readiness, blocker, failed, passed, and overdue metrics
- Bounded requests, escaped searches, duplicate handling, and centralized errors
- Responsive React interface with loading, empty, and failure states

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

7. Open http://localhost:5179. The health endpoint is http://localhost:4700/api/health.

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
| GET | /api/checks | Search and filter checks |
| GET | /api/checks/metrics | Return readiness metrics |
| POST | /api/checks | Create a release check |
| PATCH | /api/checks/:id | Update supported fields |
| DELETE | /api/checks/:id | Delete a release check |

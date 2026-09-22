# EpisodeFlow

EpisodeFlow is a small MERN production board for independent podcast teams. It tracks an episode from pitch through publishing while using aliases instead of requiring personal contact details.

## Features

- Episode CRUD with search plus stage and format filters
- Pitch, scripting, recording, editing, scheduled, and published workflow
- Unique normalized episode codes and integer episode numbers
- Recording/release date-order validation
- Planned-duration and production-stage dashboard metrics
- Optional guest aliases without contact information
- Bounded requests, escaped searches, duplicate handling, and centralized errors
- Responsive React interface with loading, empty, and failure states

## Stack and requirements

- Node.js 20+
- React 18 with Vite
- Express, MongoDB, and Mongoose
- A local MongoDB service or MongoDB Atlas connection string

## First-time setup

1. Clone the repository and enter this project folder.
2. Configure and install the API:

   ~~~bash
   cd server
   cp .env.example .env
   npm install
   ~~~

3. Edit server/.env if your database or ports differ.
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

7. Open http://localhost:5177. The health endpoint is http://localhost:4500/api/health.

The Vite server proxies /api to the API. The environment example contains no secret.

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
| GET | /api/episodes | Search and filter episodes |
| GET | /api/episodes/metrics | Return production metrics |
| POST | /api/episodes | Create an episode |
| PATCH | /api/episodes/:id | Update supported fields |
| DELETE | /api/episodes/:id | Delete an episode |

# WaterWatch

WaterWatch is a small MERN dashboard for recording water-quality field samples and turning raw readings into review signals. It uses aliases instead of personal or precise location data, making it suitable for a privacy-aware portfolio demo.

## Features

- Full create, read, update, and delete workflow for water samples
- pH, turbidity, chlorine, temperature, source, time, and notes
- Server-calculated safe, attention, and unsafe classifications
- Search plus source and classification filters
- Safe, attention, unsafe, total, and average-turbidity metrics
- Unique sample codes and bounded field validation
- Escaped searches, limited request bodies, and centralized errors
- Responsive React interface with loading, empty, and error states

The classification thresholds are demonstration rules, not a substitute for laboratory analysis or local public-health guidance.

## Stack and requirements

- Node.js 20+
- React 18 and Vite
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

3. Edit server/.env when your database or ports differ.
4. Install the frontend:

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

7. Open http://localhost:5180. The API health check is http://localhost:4800/api/health.

The Vite server proxies /api requests to Express. The environment example contains no secret.

## Validation

~~~bash
cd server && npm run check
cd ../client && npm run check
npm run build
~~~

Dependency folders, local environment files, logs, and generated builds are ignored.

## API routes

| Method | Route | Purpose |
| --- | --- | --- |
| GET | /api/samples | Search and filter samples |
| GET | /api/samples/metrics | Return quality metrics |
| POST | /api/samples | Create a sample |
| PATCH | /api/samples/:id | Update supported fields |
| DELETE | /api/samples/:id | Delete a sample |


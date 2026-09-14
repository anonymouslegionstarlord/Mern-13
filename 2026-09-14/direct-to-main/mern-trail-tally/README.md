# TrailTally

TrailTally is a small MERN trail-condition dashboard for park teams and walking groups. It tracks inspection dates, surface conditions, difficulty, closures, and review deadlines without collecting visitor location histories.

## Features

- Trail report CRUD with search and status, difficulty, or surface filters
- Unique normalized trail codes
- Open, caution, maintenance, and closed workflow
- Inspection/review date-order validation
- Dashboard totals for distance, cautions, closures, and overdue reviews
- Bounded requests, escaped searches, duplicate handling, and centralized errors
- Responsive React interface with loading, empty, and error states

## Stack and requirements

- Node.js 20+
- React 18 with Vite
- Express, MongoDB, and Mongoose
- A local MongoDB service or MongoDB Atlas connection string

## First-time setup

1. Clone the repository and enter this project folder.
2. Configure and install the API:

   ```bash
   cd server
   cp .env.example .env
   npm install
   ```

3. Edit `server/.env` if your database or ports differ.
4. Install the client:

   ```bash
   cd ../client
   npm install
   ```

5. Start the API in one terminal:

   ```bash
   cd server
   npm run dev
   ```

6. Start React in another terminal:

   ```bash
   cd client
   npm run dev
   ```

7. Open `http://localhost:5176`. The health endpoint is `http://localhost:4400/api/health`.

The Vite server proxies `/api` to the API. `.env.example` contains no secret.

## Validation

```bash
cd server && npm run check
cd ../client && npm run check
npm run build
```

Dependency folders, local `.env` files, logs, and generated builds are ignored.

## API

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/trails` | Search and filter reports |
| `GET` | `/api/trails/metrics` | Return portfolio metrics |
| `POST` | `/api/trails` | Create a report |
| `PATCH` | `/api/trails/:id` | Update supported fields |
| `DELETE` | `/api/trails/:id` | Delete a report |

# ExhibitCanvas

ExhibitCanvas is a small MERN dashboard for planning gallery and museum exhibitions. It tracks installation windows, public dates, accessibility notes, gallery zones, and workflow progress without storing visitor information.

## Features

- Exhibition CRUD with search plus medium and status filters
- Unique, normalized exhibit codes
- Validated installation, opening, and closing date order
- Status updates from the React dashboard
- Metrics for open, installing, upcoming, and planned item totals
- Bounded requests, safe text search, duplicate handling, and centralized API errors
- Responsive loading, empty, and error states

## Stack and requirements

- Node.js 20+
- React 18 with Vite
- Express and MongoDB/Mongoose
- A local MongoDB server or MongoDB Atlas connection string

## First-time setup

1. Clone the repository and enter this project folder.
2. Configure and install the API:

   ```bash
   cd server
   cp .env.example .env
   npm install
   ```

3. Edit `server/.env` if your MongoDB URI differs.
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

6. Start the client in a second terminal:

   ```bash
   cd client
   npm run dev
   ```

7. Open `http://localhost:5173`. Check the API at `http://localhost:4100/api/health`.

The Vite server proxies `/api` to port 4100. No secret is included in `.env.example`.

## Validation

```bash
cd server && npm run check
cd ../client && npm run check
npm run build
```

`node_modules`, generated builds, and local `.env` files are ignored.

## API routes

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/exhibits` | Search and filter plans |
| `GET` | `/api/exhibits/metrics` | Get dashboard totals |
| `POST` | `/api/exhibits` | Create a plan |
| `PATCH` | `/api/exhibits/:id` | Update supported fields |
| `DELETE` | `/api/exhibits/:id` | Remove a plan |


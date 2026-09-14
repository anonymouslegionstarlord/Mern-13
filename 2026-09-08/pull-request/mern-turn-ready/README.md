# TurnReady

TurnReady is a small MERN room-turnaround board for hotel operations. It coordinates checkout, cleaning, inspection, and ready status using room codes and staff aliases rather than guest data.

## Features

- Room-turn CRUD with search plus zone, priority, and status filters
- Clear dirty → cleaning → inspection → ready/blocked workflow
- Automatic ready timestamps and server-calculated turnaround metrics
- Overdue detection against each target-ready time
- Unique normalized room codes and chronological date validation
- Bounded requests, safe search, and centralized API error handling
- Responsive React dashboard with useful loading and empty states

## Stack and requirements

- Node.js 20+
- React 18 with Vite
- Express, MongoDB, and Mongoose
- Local MongoDB or a MongoDB Atlas connection string

## First-time setup

1. Clone the repository and enter this project folder.
2. Configure and install the API:

   ```bash
   cd server
   cp .env.example .env
   npm install
   ```

3. Edit `server/.env` if needed.
4. Install the frontend:

   ```bash
   cd ../client
   npm install
   ```

5. Run the API in one terminal:

   ```bash
   cd server
   npm run dev
   ```

6. Run the client in another terminal:

   ```bash
   cd client
   npm run dev
   ```

7. Open `http://localhost:5175`. The health endpoint is `http://localhost:4300/api/health`.

The client proxies `/api` to the server. The example environment file contains no secret.

## Validation

```bash
cd server && npm run check
cd ../client && npm run check
npm run build
```

Dependency directories, local environment files, logs, and generated builds are ignored.

## API routes

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/turns` | Search and filter room turns |
| `GET` | `/api/turns/metrics` | Get readiness and timing metrics |
| `POST` | `/api/turns` | Create a room turn |
| `PATCH` | `/api/turns/:id` | Update supported fields/status |
| `DELETE` | `/api/turns/:id` | Delete a room turn |


# SupportScribe

SupportScribe is a MERN troubleshooting knowledge base for technical-support teams. Capture repeatable fixes, search symptoms, and promote verified solutions.

## Features

- Create, search, filter, verify, rate, and delete troubleshooting articles
- Store problem statements, symptoms, resolution steps, platform, and category
- Categories for Network, Windows, Linux, Application, Account, Hardware, and Other
- Dashboard totals for articles, verified fixes, helpful votes, and category coverage
- React/Vite frontend, Express API, and MongoDB/Mongoose persistence
- Array and text validation, safe search expressions, and centralized errors

## Setup

1. Install Node.js 20+ and start MongoDB locally or create an Atlas database.
2. Copy `server/.env.example` to `server/.env` and update it if needed.
3. In `server`, run `npm install` and `npm run dev`.
4. In `client`, run `npm install` and `npm run dev`.
5. Open `http://localhost:5173`; Vite proxies `/api` to port 5000.

## API

- `GET /api/articles?category=Network&verified=true&search=dns`
- `GET /api/articles/stats`
- `POST /api/articles`
- `PATCH /api/articles/:id`
- `POST /api/articles/:id/helpful`
- `DELETE /api/articles/:id`


# InterviewDeck

InterviewDeck is a MERN revision dashboard for building confidence before technical interviews. Save questions, reveal answers, rate confidence, and schedule the next review.

## Features

- Create, search, filter, update, and delete interview cards
- Topics for JavaScript, React, Node, MongoDB, Python, SQL, Networking, QA, and HR
- Confidence levels, bookmarked cards, and due-review tracking
- Dashboard totals for cards, due reviews, weak areas, and mastered topics
- React/Vite frontend, Express API, and MongoDB/Mongoose storage
- Explicit request validation and centralized error responses

## Setup

1. Install Node.js 20+ and start MongoDB locally, or create an Atlas database.
2. Copy `server/.env.example` to `server/.env` and update values if required.
3. In `server`, run `npm install` and `npm run dev`.
4. In `client`, run `npm install` and `npm run dev`.
5. Open `http://localhost:5173`; Vite proxies `/api` to port 5000.

## API

- `GET /api/cards?topic=React&confidence=Learning&due=true&search=hooks`
- `GET /api/cards/stats`
- `POST /api/cards`
- `PATCH /api/cards/:id`
- `DELETE /api/cards/:id`


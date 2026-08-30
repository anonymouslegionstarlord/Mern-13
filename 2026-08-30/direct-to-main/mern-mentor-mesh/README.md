# MentorMesh

MentorMesh is a small MERN peer-learning board for matching people who can teach a skill with people who want to learn it.

## Features

- Publish, search, filter, update, and delete skill offers or learning requests
- Topic, experience level, meeting format, availability, and safe contact aliases
- Open, matched, and completed workflow with dashboard metrics
- Server-side validation, bounded searches, and centralized error responses
- Responsive React interface with loading, confirmation, and failure states

Use a platform or team alias such as frontend-club-2. Do not enter phone numbers, personal email addresses, meeting credentials, or other private information.

## Stack

React 18, Vite 6, Express 4, Node.js, MongoDB, and Mongoose 8.

## First-time setup

Requirements: Node.js 20+ and a local or hosted MongoDB database.

1. Start the API:

       cd server
       cp .env.example .env
       npm install
       npm run dev

   Windows PowerShell alternative: Copy-Item .env.example .env

2. Start the client in another terminal:

       cd client
       npm install
       npm run dev

3. Open http://localhost:5173. The health endpoint is http://localhost:5000/api/health.

For a deployed backend, create client/.env containing VITE_API_URL=https://your-api.example.com/api. Never commit .env files or credentials.


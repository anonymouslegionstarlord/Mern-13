# VolunteerVista

VolunteerVista is a small MERN dashboard for planning community activities and recording their completed impact.

## Features

- Create, search, filter, update, and delete volunteer activities
- Cause, activity date, hours, participant count, organizer alias, and notes
- Planned, completed, and cancelled workflow
- Completed hours, participant reach, and activity metrics
- Server-side validation, bounded searches, and centralized errors
- Responsive React interface with loading, confirmation, and failure states

Use an organization or team alias. Do not enter volunteer names, phone numbers, personal email addresses, or information about beneficiaries.

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


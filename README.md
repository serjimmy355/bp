# Blood Pressure & Heart Rate Tracker

## Overview
A full-stack app using React (frontend) and Cloudflare Workers (backend) with D1 database. Users can log in, record blood pressure and heart rate, and view averages.

## Structure
- `frontend/`: React app (Vite)
- `backend/`: Cloudflare Worker API and D1 schema

## Setup
1. **Frontend**
   - Located in `frontend/`
   - Run locally: `cd frontend && npm run dev`
   - Build for Cloudflare Pages: `npm run build`
2. **Backend**
   - Located in `backend/`
   - Worker code in `worker.js`
   - D1 schema in `schema.sql`

## Deployment
- **Frontend:** Deploy to Cloudflare Pages (connect GitHub repo, set build output to `dist`)
- **Backend:** Deploy Worker to Cloudflare Workers, bind D1 database

## Next Steps
- Implement authentication and API endpoints in `worker.js`
- Connect frontend to backend API
- Add UI for login, data entry, and average display

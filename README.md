# Appointment Booking System

Web application for creating and managing appointments with separate **frontend** and **backend** folders.

## Overview
Appointment Booking System helps users book appointments by selecting date/time and lets admins (or staff) review and manage bookings.

## Features
- Create a new appointment (date/time + details)
- List appointments
- View appointment details
- Cancel an appointment
- Input validation + user-friendly error messages
- Clear separation between UI and API (frontend ↔ backend)

> Update this list to match your exact implementation (add/remove items).

## Tech Stack
**Frontend:** JavaScript, HTML5, CSS3  
**Backend:** (fill in) Node.js / Express / other  
**Database:** (fill in) MongoDB / MySQL / PostgreSQL / SQLite / in-memory  
**API:** REST

## Project Structure
```text
appointment-booking-system/
├─ frontend/          # UI (client)
├─ backend/           # API (server)
└─ docs/              # screenshots, notes, diagrams
Getting Started (Local Run)
1) Prerequisites

Git

Node.js + npm (if your backend/frontend are Node-based)
git clone https://github.com/antoniq3298/appointment-booking-system.git
cd appointment-booking-system
cd backend
npm install
npm start

Frontend setup

Open the frontend (choose the one that matches your project):

Option A: Static frontend

Open frontend/index.html in a browser
cd ../frontend
npx serve .
Option B: Frontend with npm scripts
cd ../frontend
npm install
npm start

Environment Variables

If your backend uses .env, create backend/.env:
PORT=3000
# DB_URL=...
# JWT_SECRET=...
# CORS_ORIGIN=http://localhost:5173


or run a local server (recommended):

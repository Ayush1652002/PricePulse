# PricePulse

PricePulse is a full-stack price tracking application that monitors product prices and alerts users when a tracked product reaches their target price.

## Core Features

- Email/password authentication with JWT cookies
- Google OAuth authentication
- User-specific product tracking
- Amazon product price tracking
- Target-price alerts
- Email notifications via Resend
- Web Push notification infrastructure
- Price history tracking
- PostgreSQL + Prisma ORM
- Multi-marketplace data model
- Vercel frontend + Render backend deployment

## Tech Stack

**Frontend:** React, TypeScript, Vite, Tailwind CSS

**Backend:** Node.js, Express, TypeScript, Prisma

**Database:** PostgreSQL

**Auth:** JWT, HTTP-only cookies, Google OAuth

**Notifications:** Resend, Web Push

## Architecture

React frontend → Express API → Prisma → PostgreSQL

Background price checks update listing prices and trigger alerts when the current price crosses the user's target price.

## Production

Frontend: https://price-pulse-silk.vercel.app

Backend: https://pricepulse-4h64.onrender.com

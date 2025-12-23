# PayDay AI - Smart Debt Collection Platform

A full-stack intelligent debt collection platform powered by AI.

## Project Structure

```
PayDay/
├── client/     # React frontend (Vite + MUI)
├── server/     # Backend API (coming soon)
└── README.md
```

## Client

The frontend is a React application with:
- **React 19** with TypeScript
- **Vite** for fast development
- **Material-UI (MUI) v7** for styling
- **React Router v7** for navigation

### Run the Client

```bash
cd client
npm install
npm run dev
```

## Server

Backend API lives in `server/` (Express + Prisma + PostgreSQL).

### Run the Server

```bash
cd server
npm install

# Create server/.env (see server/env.example)
# Then run migrations + start dev server
npm run db:migrate
npm run dev
```

## Features

- **AI Command Center**: Central hub for controlling collection operations
- **Smart Navigation**: 9 main sections for comprehensive debt management
- **AI Chat Interface**: Natural language commands for debt collection tasks
- **Responsive Design**: Works on desktop and mobile

## License

Private - All rights reserved



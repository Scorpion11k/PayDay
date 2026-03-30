# PayDay AI — Release Setup Guide

## Prerequisites

Install the following on the target machine before proceeding:

1. **Node.js** (v18 or later) — https://nodejs.org
2. **PostgreSQL** (v14 or later) — https://www.postgresql.org/download/

Make sure PostgreSQL is running and you have a database created (e.g. `payday`).

---

## Step 1: Configure the Server

1. Open `server/.env` in a text editor.
2. Update the following values:

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/payday?schema=public` |
| `NODE_ENV` | Must be set to `production` | `production` |
| `PORT` | Server port (default 3001) | `3001` |
| `PAYMENT_BASE_URL` | Public URL of this server | `http://localhost:3001` |
| `PAYMENT_LINK_SECRET` | Secret for payment links — change from default | `some-secure-random-string` |

Optional integrations (the app works without these):

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API key for AI chat features |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | Gmail credentials for sending emails |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | Twilio credentials for SMS, WhatsApp, Voice |

> If `server/.env` doesn't exist, create it based on the variables above.

---

## Step 2: Install Server Dependencies

Open a terminal in the `server/` folder and run:

```bash
npm install
```

This installs all dependencies and auto-generates the Prisma client.

---

## Step 3: Set Up the Database

Still in the `server/` folder, run:

```bash
npx prisma migrate deploy
```

This creates all required database tables.

Then seed the template data (recommended):

```bash
npm run seed:templates
```

---

## Step 4: Start the Server

```bash
npm start
```

The server will start on the configured port (default **3001**).

---

## Step 5: Open the App

Open a browser and navigate to:

```
http://localhost:3001
```

The server automatically serves the client UI in production mode. No separate client server is needed.

---

## Accessing from Other Devices on the Network

To access the app from other computers on the same network, use the server machine's IP address instead of `localhost`:

```
http://<server-ip>:3001
```

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `prisma migrate deploy` fails | Verify `DATABASE_URL` in `.env` and that PostgreSQL is running |
| Client UI not loading | Ensure `NODE_ENV=production` is set in `.env` |
| AI chat not working | Set a valid `GEMINI_API_KEY` in `.env` |
| Port already in use | Change `PORT` in `.env` or stop the conflicting process |
| `npm install` fails on Prisma | Make sure Node.js v18+ is installed |

# Production Packaging Guide (No DB Migration)

This guide shows how to build and package PayDay for production on another computer **without migrating the database**.

---

## 1) Prepare Configuration (Crucial Step)

Before building, you must decide where the server will run. Since the static client (via `serve`) does not proxy API requests like the dev server, you must **hardcode** the server's URL.

1.  Find the IP address of the computer that will run the server (e.g., `192.168.1.100` or a domain name).
2.  Create/Edit `client/.env.production`:

    ```env
    # client/.env.production
    # REPLACE <server-ip> with the actual IP/Host, e.g., http://192.168.1.100:3001/api
    VITE_API_BASE_URL=http://<server-ip>:3001/api
    ```

---

## 2) Build on the current machine

### Option A: Automated Build (Recommended)

An automated build script is available that handles the entire build process and creates a ready-to-deploy `Release` folder.

**From Git Bash:**
```bash
powershell -ExecutionPolicy Bypass -File build_release.ps1
```

**From PowerShell:**
```powershell
.\build_release.ps1
```

This script will:
1. Build the server (`npm install` + `npm run build`)
2. Build the client with your configured `VITE_API_BASE_URL`
3. Automatically copy all necessary files to the `Release` folder:
   - `Release/server/` (contains `dist/`, `package.json`, `.env`, etc.)
   - `Release/client/` (contains `dist/`)

After the script completes, you can skip to **Section 4** to run the application.

---

### Option B: Manual Build

If you prefer to build manually:

**Server:**
```bash
cd server
npm install
npm run build
```

**Client:**
```bash
cd client
npm install
npm run build
```

This creates:
- `server/dist/` (compiled backend)
- `client/dist/` (static frontend)

---

## 3) Copy files to the other computer

### If you used the automated build script (Option A):
Simply copy the entire `Release` folder to your production machine. It already contains everything you need.

### If you built manually (Option B):
Copy the following files:

**Server Folder Structure**
- `server/dist/`
- `server/package.json`
- `server/package-lock.json`
- `server/.env` (Required: See "Environment notes" below)

**Client Folder Structure**
- `client/dist/`

> Do **not** copy `node_modules/`.

---

## 4) Run on the other computer

### Server Configuration (CORS)
The server needs to know it's safe to accept requests from your client. Update the `.env` file:
- If using Release folder: `Release/server/.env`
- If manual build: `server/.env`

```env
# Allow requests from the client's URL (e.g., port 3000 if using serve default)
CORS_ORIGIN=http://<client-ip>:3000
```

### Start Server
If using Release folder:
```bash
cd Release/server
npm install --production
npm run start
```

If manual build:
```bash
cd server
npm install --production
npm run start
```

### Start Client (static hosting)
First, install `serve` globally (only needed once per machine):
```bash
npm install -g serve
```

Then start the client:

If using Release folder:
```bash
cd Release/client
serve -s dist
```

If manual build:
```bash
cd client
serve -s dist
```

By default, the client runs on **port 3000**.

---

## 5) Seed Templates (Required for First Run)

If this is the first time running the application or the database is empty, you need to populate the message templates:

```bash
cd Release/server
npm run seed:templates
```

Or if manual build:
```bash
cd server
npm run seed:templates
```

This creates 36 message templates covering:
- **4 channels**: Email, SMS, WhatsApp, Call Task
- **3 languages**: English, Hebrew, Arabic
- **3 tones**: Calm, Medium, Heavy

**Note**: You only need to run this once per database. If you already have templates, skip this step.

---

## 6) Troubleshooting Connection Issues

If you see connection errors:
1.  **Check Browser Console**: Open F12 > Network. Look at the failed request.
    -   Does it go to `http://localhost:3000/api/...`? -> You didn't set `VITE_API_BASE_URL` correctly before building. Rebuild.
    -   Does it go to `http://<server-ip>:3001/api/...` but fail? -> Check if the Server is running and reachable.
2.  **CORS Errors**: If you see "Cross-Origin Request Blocked":
    -   Make sure `CORS_ORIGIN` in `server/.env` matches exactly the URL in your browser address bar (no trailing slash).
3.  **Firewall**: Ensure port `3001` (server) and `3000` (client) are open on the host machine.

---

## 7) Environment notes

The database will **not** be migrated. Make sure your `server/.env` points to the existing DB and services:
- `DATABASE_URL`
- email/SMS keys if used
- `BASE_URL` if required for links

If you are using Neon (hosted Postgres), set `DATABASE_URL` to the Neon connection string, for example:
```env
DATABASE_URL="postgresql://<user>:<password>@<host>/<db>?sslmode=require&channel_binding=require"
```

---

## 8) Optional ZIP packaging (Windows PowerShell)

### If you used the automated build script:
The easiest way is to zip the entire Release folder:
```powershell
Compress-Archive -Path Release -DestinationPath PayDay-prod.zip
```

### If you built manually:
Run from the repo root:
```powershell
Compress-Archive -Path client/dist,server/dist,server/package.json,server/package-lock.json,server/.env -DestinationPath PayDay-prod.zip
```

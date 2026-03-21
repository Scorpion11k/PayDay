# Production Packaging Guide

This project now ships as a single Windows-friendly `Release/` folder where the Express server serves the built Vite client.

## Build the release package

From the repo root:

```powershell
.\build_release.ps1
```

Or:

```bat
build-release.bat
```

The script will:

1. Install and build the server.
2. Compile the Prisma seed scripts into `dist/prisma`.
3. Install and build the client.
4. Create a fresh `Release/` folder.
5. Copy the compiled server, Prisma schema/migrations, and built client into `Release/server/`.
6. Generate a release-specific `package.json`, `package-lock.json`, `.env.example`, `setup.bat`, `start-payday.bat`, and `README.txt`.
7. Create `Release.zip`.

## What gets produced

After the build finishes you will have:

- `Release/`
- `Release/server/`
- `Release/setup.bat`
- `Release/start-payday.bat`
- `Release/README.txt`
- `Release.zip`

The client is copied to `Release/server/client/` and is served by the production Express app, so no separate client process is needed.

## Run on another Windows computer

1. Install Node.js 18 or newer.
2. Install PostgreSQL and make sure it is running.
3. Copy the whole `Release/` folder or `Release.zip` to the target machine.
4. Run `setup.bat` once.
5. Review `Release/server/.env` and update values if needed.
6. Run `start-payday.bat`.
7. Open `http://localhost:3001`.

If you want to access the app from another device on the network, open `http://<computer-ip>:3001` instead.

## Notes

- `setup.bat` installs runtime dependencies, runs Prisma generate, applies migrations, and seeds templates and the default flow.
- `PAYMENT_BASE_URL` should match the hostname or IP that users will open in the browser if payment links are shared externally.
- External integrations such as Gemini, Gmail, Twilio, and Kol Kasher stay optional unless you need those features.

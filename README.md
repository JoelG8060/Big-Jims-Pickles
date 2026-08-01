# Big Jims Pickels

Big Jims Pickels is a branded request site for pickle and ranch orders with a persistent cloud-backed database and an admin dashboard for reviewing submissions.

## What Changed

- Customer requests are stored in a persistent SQLite database instead of browser storage.
- Admin login uses a server-issued signed session cookie.
- The app keeps the current look and workflow, but now works across devices and restarts.
- The interface is responsive for desktop, tablet, and mobile layouts.

## File Structure

```text
big-jims-pickels/
  index.html
  styles.css
  app.js
  server.js
  package.json
  .env.example
  README.md
  migrations/
    001_create_requests.sql
  assets/
    brand/
      big-jims-logo.png
      big-jims-hero-duo.png
      big-jims-ranch-logo.png
    quality-slides/
      slide-1.png
      slide-2.png
      slide-3.png
      slide-4.png
      slide-5.png
      slide-6.png
```

## Local Setup

1. Make sure you are on Node.js 24 or newer.
2. Copy `.env.example` to `.env` if you want to override the built-in defaults.
3. Start the app with:

```bash
npm start
```

Open the app in your browser at the configured `PORT` value.

If no environment variables are provided, the server falls back to local defaults so it can still boot for development or a quick deployment test.

## Environment Variables

- `PORT` - Port for the HTTP server.
- `DATABASE_PATH` - Path to the SQLite database file.
- `SESSION_SECRET` - Random secret used to sign admin sessions.
- `ADMIN_USERNAME` - Admin login username.
- `ADMIN_PASSWORD` - Admin login password.

## Railway Deployment

For Railway, attach a persistent volume and set `DATABASE_PATH` to a location on that volume such as `/data/big-jims-pickels.sqlite` so request data survives restarts and new deploys. Keep the other values in Railway environment variables if you want to override the built-in defaults.

## Data Behavior

- All submitted requests are saved in the database.
- Admin views always read from the same source of truth.
- Refreshing the site or opening it on a different device shows the same stored requests once you log in with the admin account.

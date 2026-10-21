# RoadWatch

React dashboard, Express API, and MongoDB/Mongoose data layer.

## Run locally

1. Install Node.js and configure `.env` with `MONGO_URI`, a long random `JWT_SECRET`, and the initial admin's `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` (see `.env.example`).
2. Install packages: `npm install`.
3. Optionally add the seven demo reports with `npm run db:seed` (this writes sample documents to the configured database).
4. Start the website and API: `npm run dev`.

For local MongoDB, Docker Desktop users can start the included service with `docker compose up -d mongodb`. The `.env.example` file contains the local connection string. If you already have Atlas, keep its URI in your ignored `.env` file instead.

## Deploy

Deploy this as a Node/Express web service so the website and `/api` routes use the same origin; a static-only frontend host cannot run the API. On Render, create a Blueprint from this repository and use `render.yaml`, or create a **Web Service** with build command `npm ci && npm run build` and start command `npm start`. Set `NODE_ENV=production`, `MONGO_URI` to the MongoDB Atlas connection string, `JWT_SECRET` to a long random secret, and `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` for the first administrator. Render supplies `PORT`; the server binds to `0.0.0.0` in production. In the Render service's **Connect → Outbound** panel, copy its outbound IP ranges and add those CIDR ranges under Atlas **Security → Network Access**. The local computer's IP is not the right entry for a deployed Render service. After deployment, open `https://<your-render-service>.onrender.com/api/health`; it should return JSON with `status: "ok"` and `database: "connected"`.

The dashboard runs at `http://127.0.0.1:5173`; the API runs at `http://127.0.0.1:5001` by default. Set `PORT` in `.env` to change the API port; Vite uses the same value for its API proxy.
MongoDB stores the database as `roadwatch`, with reports and user accounts in separate collections. GeoJSON coordinates are stored as `[longitude, latitude]` with a `2dsphere` index. The initial admin is created from the environment settings when the server first connects. Citizens can register from the sign-in screen. Passwords are hashed; sessions use signed, HTTP-only cookies.

## API

- `GET /api/health` — server and database status
- `POST /api/auth/register` — create a citizen account (`name`, `email`, `password`)
- `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout` — manage a signed-in session
- `GET /api/reports?q=&status=` — admins see all reports; citizens see only their own
- `GET /api/reports/:id` — fetch a report when the signed-in user has access
- `GET /api/reports/nearby?lat=&lng=&radius=20` — find nearby open reports (radius in meters, scoped to role)
- `POST /api/reports` — citizens can create a report with multipart fields `neighborhood`, `wardNumber`, `road`, `zone`, `lat`, `lng`, `severity`, `description`, and an image file named `photo` (JPG, PNG or WebP, up to 5 MB)
- `PATCH /api/reports/:id/status` — administrators only; update status and optional status note
- `GET /api/team`, `POST /api/team` — administrators only; list/add municipal staff records

Creation checks for open pothole reports within 20 meters and returns HTTP 409 with matching reports when it finds a duplicate.

New report photos are stored in the configured MongoDB database with GridFS (including MongoDB Atlas) and served through the authenticated `/api/photos/:id` route. Existing photos under `uploads/` continue to work for older reports. The admin dashboard reviews all incoming work; citizen accounts have a separate dashboard for creating reports and tracking the statuses of their own submissions. Staff directory entries are informational and do not create login accounts or send invitation emails.

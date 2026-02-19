# Trainer Assessment Backend

Node.js + Express API for authentication, role-based authorization, and assessment workflows.

## What this backend does

- Authenticates users with JWT
- Enforces role-based access (`admin`, `assessor`, `trainer`)
- Creates assessments and updates attempts
- Fetches assessments with server-side filtering and pagination
- Protects routes with middleware

## Run locally

1. Install dependencies
```bash
npm install
```

2. Create env file
```bash
cp .env.example .env
```

3. Start server
```bash
npm run dev
```

Default local URL: `http://localhost:5000`

## Environment variables

### Core
- `NODE_ENV` (`development` or `production`)
- `PORT` (default `5000`)
- `JWT_SECRET` (required in production)

### CORS
- `CORS_ORIGIN`
  Comma-separated allowed frontend origins.
  Example: `http://localhost:5173,https://app.example.com`

### Database
- `DB_HOST`
- `DB_PORT` (default `3306`)
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `DB_CONNECTION_LIMIT` (default `10`)
- `DB_SSL` (`true` or `false`)
- `DB_SSL_REJECT_UNAUTHORIZED` (`true` or `false`)

## API overview

### Health
- `GET /api/health`

### Auth
- `POST /api/auth/login`

### Assessments
- `POST /api/assessments`
  - Protected
  - Role: `assessor`
- `GET /api/assessments`
  - Protected
  - Roles: `admin`, `assessor`, `trainer`
  - Query params supported:
    - `search`
    - `branch`
    - `team`
    - `page`
    - `limit`
- `GET /api/assessments/:id`
  - Protected
  - Roles: `admin`, `assessor`, `trainer`
- `GET /api/assessments/by-email/:email`
  - Protected
- `PUT /api/assessments/:id/attempt`
  - Protected
  - Role: `assessor`

## Code map (backend)

### Entry and wiring
- `server.js`
  Creates express app, loads middleware, mounts route modules, exposes health endpoint.

### Configuration
- `config/mysql.js`
  MySQL pool setup from environment variables, connection settings, optional SSL config.

### Middleware
- `middleware/authMiddleware.js`
  JWT validation (`protect`) and role authorization (`allowRoles`).

### Routes
- `routes/authRoutes.js`
  Auth route definitions.
- `routes/assessmentRoutes.js`
  Assessment route definitions, middleware guards, controller binding.

### Controllers
- `controllers/authController.js`
  Login flow: user lookup, password verification, token generation.
- `controllers/assessmentController.js`
  Create/read/update assessment flows and trainer lookup.
  Includes server-side filter + pagination logic for list endpoint.

### Utilities
- `utils/hashPassword.js`
  Helper script to hash passwords for seed/setup usage.
- `utils/mysqlTest.js`
  Helper script to verify database connectivity.

## Production notes

1. Set `NODE_ENV=production`.
2. Set `CORS_ORIGIN` to your frontend domain(s).
3. Set database values to AWS RDS endpoint and credentials.
4. Keep `.env` out of git.
5. Ensure `JWT_SECRET` is long and random.

## Scripts

- `npm run dev`: run server with nodemon
- `npm start`: run server with node

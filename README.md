# mingleX

Dating app with a Flutter phone client, a React web client, a React admin console, and a Node.js API on MongoDB Atlas.

Adults 18 and older only.

## Apps

| Folder | Stack | Dev URL |
| --- | --- | --- |
| `backend` | Node.js, Express, TypeScript, Mongoose, Socket.IO | http://localhost:4000 |
| `mobile` | Flutter | device / emulator |
| `web` | React, TypeScript, Vite | http://localhost:5173 |
| `admin` | React, TypeScript, Vite | http://localhost:5174 |

Build sequence for the rest of the product lives in `prompts/BUILD_PROMPTS.md`.

## Run the API

1. In MongoDB Atlas, create a database user and allow your IP.
2. Copy the environment file and fill in the Atlas URI and a long JWT secret.

```bash
cp backend/.env.example backend/.env
```

3. Install and start.

```bash
npm --prefix backend install
npm run dev:api
```

4. Create the first admin user (uses `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `backend/.env`).

```bash
npm --prefix backend run create-admin
```

## Run the clients

```bash
npm --prefix web install
npm --prefix admin install
npm run dev:web
npm run dev:admin
```

Mobile, from `mobile`:

```bash
flutter pub get
flutter run
```

## API

- `GET /api/auth/providers`
- `POST /api/auth/register` email, password, name, birthDate (`YYYY-MM-DD`), gender
- `POST /api/auth/login`
- `POST /api/auth/google` `{ "idToken" }` or `{ "accessToken" }`
- `POST /api/auth/apple` `{ "identityToken", "name" }`
- `POST /api/auth/phone/send` `{ "phone" }` and `POST /api/auth/phone/verify` `{ "phone", "code" }`
- `POST /api/auth/dev/google` and `POST /api/auth/dev/apple` local preview only, disabled in production
- `GET /api/me` and `PATCH /api/me`
- `GET /api/discover`
- `POST /api/swipes` `{ "toUserId", "direction": "like" | "pass" }`
- `GET /api/matches`
- `GET /api/matches/:matchId/messages`
- `POST /api/matches/:matchId/messages` `{ "text" }`
- `POST /api/reports`
- `GET /api/admin/stats` admin token
- `GET /api/admin/users` admin token
- `PATCH /api/admin/users/:id/ban` admin token
- `GET /api/admin/reports` and `PATCH /api/admin/reports/:id` admin token

Chat socket events, after a JWT in `handshake.auth.token`: `match:join`, `message:send`, `message:new`.

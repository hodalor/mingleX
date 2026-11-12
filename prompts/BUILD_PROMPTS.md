# mingleX build prompts

Paste one prompt at a time into a fresh agent chat. Finish its acceptance checks before the next prompt.

Stack already chosen:

- Product name: mingleX. Adults 18+ only. Never add flows for minors.
- `backend`: Node.js, Express, TypeScript, Mongoose, MongoDB Atlas, JWT, Socket.IO
- `mobile`: Flutter
- `web`: React + TypeScript + Vite, user dating client, port 5173
- `admin`: React + TypeScript + Vite, moderation console, port 5174
- Secrets stay in `backend/.env`. Never commit the Atlas URI or JWT secret.

The repo already has the four app shells and a working API for auth, profiles, discovery, swipes, matches, chat, reports, and admin bans.

---

## Prompt 1 — Photo uploads

Role: senior full-stack engineer on mingleX.

Goal: let a user add up to 6 profile photos from the phone and the web app, stored outside the database, with the URL saved on the user document.

Context:

- Profiles already accept photo URLs on `PATCH /api/me`.
- Discovery only returns users who have at least one photo.
- Use one cloud bucket (Cloudinary or S3-compatible). Read keys from the environment. Add the new variables to `backend/.env.example` only.

Tasks:

- Add `POST /api/me/photos` as authenticated multipart upload. Reject files that are not JPEG, PNG, or WEBP, and reject files over 5 MB.
- Persist `{ url, isPrimary }` on the user. The first photo is primary. Add a route to delete a photo and a route to change the primary photo.
- On the Flutter profile screen and the web profile screen, pick an image, upload it, and show the returned gallery.
- Do not log file contents or cloud credentials.

Acceptance:

- A new account with no photo does not appear in `/api/discover`.
- After one valid upload, that account can appear to a compatible viewer.
- A 12 MB file and a `.gif` are rejected with 400.
- `backend/.env` is still gitignored.

---

## Prompt 2 — Flutter dating client

Role: senior Flutter engineer on mingleX.

Goal: turn `mobile` into the daily driver: sign up, finish a profile, swipe, match, and chat.

Context:

- API base URL belongs in a single config constant, default `http://localhost:4000`. Android emulator uses `http://10.0.2.2:4000`.
- Auth header is `Authorization: Bearer <token>`. Store the token in `flutter_secure_storage`.
- Socket.IO connects with `auth: { token }`.
- Gender values are `woman`, `man`, and `nonbinary`.
- Birth date must show an 18+ explanation before submit. The API rejects younger dates.

Tasks:

- Screens: welcome, register, login, profile editor, discovery deck, match celebration, match list, chat thread.
- Discovery: one card at a time, photo, name, age, city, distance, bio, interests. Pass and Like buttons call `POST /api/swipes`. A non-null `match` opens the celebration screen.
- Chat: load history from REST, send on REST or socket, and append `message:new` events for the open thread.
- Empty and error states: incomplete profile, location off, empty deck, banned account.
- Keep visual language consistent: rose `#E11D48`, ink `#111827`, warm background `#FFF7F8`. App display name is mingleX.

Acceptance:

- Two adult test users can register, upload a photo URL or file, like each other, and exchange a message.
- A birth date under 18 never creates a session.
- Killing the app and reopening it keeps the session.

---

## Prompt 3 — React web client

Role: senior React engineer on mingleX.

Goal: ship the same dating loop in `web` for a desktop browser.

Context:

- Vite app on port 5173. API default `http://localhost:4000`.
- Reuse the backend contracts from Prompt 2. Do not invent a second API shape.
- Store the JWT in memory plus `sessionStorage`. Send it on every API call.

Tasks:

- Routes: `/`, `/login`, `/register`, `/app/discover`, `/app/matches`, `/app/matches/:matchId`, `/app/profile`.
- Protect `/app/*`. Incomplete profiles land on the profile editor before the deck.
- Deck: keyboard left for pass, right for like, button controls as well.
- Matches list and chat panel side by side from 1024px up. Stack them on a narrow window.
- Show API error messages without dumping stack traces.

Acceptance:

- A user can register, edit profile, swipe, open a match, and send a message in the browser.
- Refresh keeps the session. Logout clears it.
- Layout is usable at 1280px and 390px.

---

## Prompt 4 — Admin console

Role: senior React engineer on mingleX.

Goal: make `admin` the place staff review users and reports.

Context:

- Vite app on port 5174.
- Only tokens whose user `role` is `admin` may call `/api/admin/*`.
- Create that user with `npm --prefix backend run create-admin`.

Tasks:

- Routes: `/login`, `/`, `/users`, `/users/:id`, `/reports`.
- Dashboard cards from `GET /api/admin/stats`: members, matches, banned accounts, open reports.
- User table: search by name or email, open a user, ban and unban with a reason.
- Report queue: filter by status, set status to `reviewing`, `resolved`, or `dismissed`.
- A normal member token receives 403 and the UI shows “Admin access required”.

Acceptance:

- Admin can find a user, ban them, and that user can no longer log in or call `/api/me`.
- Unban restores login.
- Open report count drops after a report is resolved.

---

## Prompt 5 — Location and a fair deck

Role: senior backend and client engineer on mingleX.

Goal: order the deck by distance and keep preferences honest.

Context:

- User location is GeoJSON `[lng, lat]` with a `2dsphere` index.
- `GET /api/discover` already takes `limit` and `radiusKm` and filters gender plus `interestedIn`.

Tasks:

- On Flutter, request location permission, explain why, and save coordinates with `PATCH /api/me`. On web, use the browser geolocation API with the same copy.
- Return `distanceKm` only when both people have a location.
- Exclude banned users, already swiped users, and the viewer.
- Add a preferences section: interested-in genders and radius. Persist radius on the user if it is not already stored.
- Cap radius at 500 km.

Acceptance:

- Two users 10 km apart both appear inside a 25 km radius and not inside a 1 km radius.
- A user interested only in `woman` does not receive `man` profiles.
- Denying location permission still opens the app and shows a clear prompt, with an empty distance-based deck.

---

## Prompt 6 — Trust and safety

Role: senior backend and client engineer on mingleX.

Goal: give members a way to report and block, and give admin enough detail to act.

Context:

- `POST /api/reports` accepts `harassment`, `fake`, `spam`, `underage`, and `other`.
- Banned users already fail auth.

Tasks:

- Add a block collection: blocker, blocked user, unique pair. Blocked users leave both decks and cannot message.
- From chat and profile, a member can report or block in two taps. Confirm before block.
- Admin user detail shows open reports, photo gallery, age, city, and account created date.
- `underage` reports sort to the top of the queue.
- Rate-limit register, login, swipe, and message routes.

Acceptance:

- After a block, neither person sees the other in discover, matches stay closed for new messages, and the API returns 403 on send.
- Ten rapid login attempts from one IP are throttled.
- An underage report is the first row in the default admin queue.

---

## Prompt 7 — Read state, presence, and push-ready notifications

Role: senior full-stack engineer on mingleX.

Goal: make chat feel alive without adding a second messaging backend.

Tasks:

- Mark messages read when the thread is open. Store `readAt`.
- Socket event `typing` scoped to a match room, no persistence.
- Update `lastActiveAt` on a throttled heartbeat.
- Add a `Notification` model for new matches and new messages while the recipient is offline. Expose `GET /api/notifications`.
- Leave a single integration point for mobile push later. Do not add Firebase until a later prompt asks for it.

Acceptance:

- Opening a thread marks the other person’s messages read.
- A like that creates a match produces one notification for each person.
- Typing appears in the open thread and disappears on stop.

---

## Prompt 8 — Release candidate

Role: senior engineer preparing mingleX for a first external test.

Tasks:

- Add backend request logs without tokens, passwords, or message bodies.
- Add a production build path: `npm --prefix backend run build`, `npm --prefix web run build`, `npm --prefix admin run build`, and a Flutter release build command in the README.
- Document Atlas index creation, required env vars, and the admin bootstrap command.
- Check empty, error, and banned states on web and mobile.
- Remove sample secrets, default passwords, and unused starter assets.

Acceptance:

- A clean machine can follow the README, point at Atlas, create an admin, and run web, admin, and the API.
- Typecheck passes for backend, web, and admin.
- Flutter analyzes without errors.

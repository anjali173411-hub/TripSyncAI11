# TripSync AI — Backend (Express + Node)

The REST API behind TripSync AI. It handles accounts, trips, preferences, the AI itinerary,
voting, budgets, destinations, admin functions and PDF downloads.

- **Runs on:** http://localhost:5000 (all routes start with `/api`)
- **Main database:** MySQL (via `mysql2`)
- **Document store:** MongoDB (via Mongoose) for downloaded itinerary PDFs
- **AI:** calls the Python AI service (`AI_SERVICE_URL`), never Gemini directly from the browser

---

## Folder structure

```
backend/
├── src/
│   ├── server.js              Starts Express, CORS, JSON parsing, routes, error handler
│   ├── db/
│   │   ├── pool.js            MySQL connection pool + readJSON helper
│   │   └── mongo.js           MongoDB connection + Download model (PDFs)
│   ├── middleware/
│   │   ├── auth.js            requireAuth (JWT check), requireAdmin
│   │   ├── tripAccess.js      loadTrip (members only), organiserOnly, stillPlanning
│   │   ├── rateLimit.js       Limits login / sign-up attempts per IP
│   │   └── errorHandler.js    Turns unexpected errors into JSON responses
│   ├── routes/
│   │   ├── auth.js            Register, login, profile, logout
│   │   ├── trips.js           Trips, invitations, members, complete
│   │   ├── preferences.js     Member preferences
│   │   ├── plan.js            AI itinerary: generate, redo day, edit activities, finalise
│   │   ├── votes.js           Clash voting and organiser decisions
│   │   ├── budget.js          Budget summary, expenses CRUD, AI saving tips
│   │   ├── destinations.js    Destinations and reviews
│   │   ├── admin.js           Admin statistics, users, trips, destinations, reviews
│   │   └── download.js        Itinerary PDF (saved to MongoDB)
│   └── services/
│       └── aiPlanner.js       Calls the AI service, checks every answer, retries
└── scripts/
    ├── createAdmin.js         npm run create-admin
    └── migrate.js             npm run migrate
```

## Setup

```bash
npm install
cp .env.example .env      # then fill in the values below
npm run create-admin      # create the separate admin account
npm run dev               # start with auto-restart on file changes
```

| Script | What it does |
|---|---|
| `npm run dev` | Start the API and restart it when files change |
| `npm start` | Start the API |
| `npm run create-admin` | Create (or reset) the admin account from `ADMIN_EMAIL` / `ADMIN_PASSWORD` |
| `npm run migrate` | Add any missing database columns to an existing MySQL database (safe to repeat) |

### Environment variables (`backend/.env`)

| Variable | Purpose |
|---|---|
| `PORT` | API port (default 5000) |
| `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE` | MySQL connection |
| `MONGO_URI` | MongoDB connection string, ending in `/planora` |
| `JWT_SECRET` | Secret used to sign login tokens (at least 16 characters; the server will not start without it) |
| `CORS_ORIGIN` | The frontend address allowed to call the API, e.g. `http://localhost:5173` |
| `AI_SERVICE_URL` | Address of the AI service, e.g. `http://localhost:8000` |
| `AI_TIMEOUT_MS` | How long to wait for the AI (default 90000 ms) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Used only by `npm run create-admin` |

## How requests are protected

| Check | Where | Effect |
|---|---|---|
| `requireAuth` | Every route except register/login/health | Needs `Authorization: Bearer <token>`; rejects missing, expired or logged-out tokens (401) |
| `loadTrip` | Every `/trips/:id/...` route | Loads the trip; rejects anyone who is not a member (403) |
| `organiserOnly` | Trip changes | Only the trip organiser (403 otherwise) |
| `stillPlanning` | Trip changes | Blocks changes after the trip is finalised or completed (400) |
| `requireAdmin` | Every `/admin/...` route | Only the administrator role (403 otherwise) |
| `rateLimit` | Login, register | 10 logins / 5 sign-ups per IP per 15 minutes (429) |

## Error responses

Every error is JSON: `{ "message": "..." }`.

| Status | Meaning | Example |
|---|---|---|
| 400 | Invalid input or not allowed right now | "Amount must be greater than 0." |
| 401 | Not logged in / session expired | "Please log in first." |
| 403 | Logged in but not allowed | "You are not a member of this trip." |
| 404 | Not found | "Trip not found" |
| 409 | Data changed since the page loaded | "That activity has changed since the suggestion was made." |
| 429 | Too many attempts | "Too many login attempts. Try again in 15 minute(s)." |
| 502 | The AI could not produce a valid answer | "Itinerary generation failed. Please try again." |
| 503 | MongoDB unavailable when saving a PDF | "Couldn't save the PDF to MongoDB…" |

## API endpoints

Legend: **Public** = no login · **User** = any logged-in user · **Member** = member of that trip ·
**Organiser** = the trip's organiser · **Admin** = administrator.

### Health
| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/api/health` | Public | Check the API is running |

### Authentication — `/api/auth`
| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/register` | Public | Create an account `{ name, email, password }` |
| POST | `/login` | Public | Log in `{ email, password }` → `{ token, user }` |
| GET | `/me` | User | The logged-in user's profile |
| PUT | `/me` | User | Update name, default interests and pace |
| POST | `/logout` | User | Log out (invalidates all existing tokens for this user) |

### Trips — `/api/trips`
| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/` | User | Trips the user is a member of |
| POST | `/` | User | Create a trip `{ title, destination, startLocation, startDate, endDate, budget, travellers, preferenceText, tripType }` |
| GET | `/invitations` | User | The user's pending invitations |
| GET | `/:id` | Member | One trip with members, organiser and invitations |
| PUT | `/:id` | Organiser | Edit the trip (changing details clears the itinerary; renaming only keeps it) |
| DELETE | `/:id` | Organiser | Delete the trip |
| POST | `/:id/invite` | Organiser | Invite a registered user by email (group trips, before a plan exists) |
| PUT | `/:id/invitation` | Invitee | Answer an invitation `{ action: "accept" \| "decline" }` |
| DELETE | `/:id/members/:userId` | Organiser | Remove a member |
| PUT | `/:id/complete` | Organiser | Mark a finalised trip as completed |

### Preferences — `/api/trips/:id/preferences`
| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/` | Member | Everyone's preferences and who has filled them in |
| PUT | `/me` | Member | Save my preferences `{ interests, pace, budget_contribution, must_do, deal_breakers, notes }` (until a plan is generated) |

### Itinerary (AI) — `/api/trips/:id`
| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/generate` | Organiser | Generate the plan (needs all preferences and no pending invitations) |
| POST | `/retry` | Organiser | Try again after a failed generation |
| POST | `/redo-day` | Organiser | Redesign one day `{ day, instructions }` |
| PUT | `/activities/:day/:index` | Organiser | Edit an activity `{ time, title, description, estimated_cost }` |
| DELETE | `/activities/:day/:index` | Organiser | Remove an activity |
| POST | `/activities/:day/:index/move` | Organiser | Move an activity to another day `{ toDay }` |
| POST | `/finalise` | Organiser | Finalise the plan (all clashes must be decided) |

### Votes — `/api/trips/:id/votes`
| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/` | Member | All clashes with options, votes and whether I can vote |
| POST | `/:voteId` | Member involved in the clash | Vote `{ option }`; a majority locks the option in |
| PUT | `/:voteId/resolve` | Organiser | Decide a clash `{ option }` or `{ custom }` |

### Budget — `/api/trips/:id`
| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/budget` | Member | Expenses and summary (planned, actual, remaining, overruns, categories, members) |
| POST | `/expenses` | Member | Add an expense `{ category, amount, kind, paid_by, description }` |
| PUT | `/expenses/:expenseId` | Who added it, or Organiser | Edit an expense |
| DELETE | `/expenses/:expenseId` | Who added it, or Organiser | Delete an expense |
| POST | `/budget/tips` | Member | AI saving suggestions (when planned or actual spending reaches 80%) |
| POST | `/budget/apply` | Organiser | Apply one suggestion to the itinerary |

### Download — `/api/trips/:id`
| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/download` | Member | Itinerary as a PDF; also saved to MongoDB `downloads` |

### Destinations — `/api/destinations`
| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/?search=&tier=` | User | List destinations (search by name, filter by cost tier) |
| GET | `/:id` | User | One destination with pictures and visible reviews |
| POST | `/:id/reviews` | User who completed a trip there | Add a review `{ rating, comment }` |
| DELETE | `/reviews/:reviewId` | Author or Admin | Delete a review |

### Admin — `/api/admin`
| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/stats` | Admin | Users, trips, solo/group, average group size, popular destinations, reviews |
| GET | `/users` | Admin | All users with role, join date, trip counts and status |
| PUT | `/users/:userId/active` | Admin | Deactivate or reactivate a user `{ isActive }` |
| GET | `/trips` | Admin | All trips with organiser, dates, members, budget and status |
| POST | `/destinations` | Admin | Add a destination `{ name, region, description, average_cost, cost_tier, images }` |
| PUT | `/destinations/:destId` | Admin | Edit a destination |
| DELETE | `/destinations/:destId` | Admin | Delete a destination and its reviews |
| GET | `/reviews` | Admin | All reviews |
| PUT | `/reviews/:reviewId/visible` | Admin | Hide or show a review `{ visible }` |

## AI answers and failures

`services/aiPlanner.js` sends requests to the AI service and **checks every answer** before using it:

- the AI must return JSON in a fixed shape (enforced by the AI service);
- the backend then checks it: summary and costs present, every activity has a title and a valid
  cost, only real member keys are used, and so on;
- invalid answers or errors are **retried up to 3 times**, with a time limit per try;
- if every try fails, the user gets a clear error and can retry; **existing trip data is never
  overwritten by a failed attempt**.

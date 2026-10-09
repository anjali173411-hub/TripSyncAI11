# Planora – How to run

## Where the data is stored
- **MySQL**: users, trips, members, invitations, preferences, clashes, votes, expenses, destinations and reviews
- **MongoDB**: only the AI-generated itinerary (collection `itineraries`)

## 1. MySQL
```
mysql -u root -p < database/schema.sql
```
(This starts the `planora` database fresh, with 4 sample destinations.)

## 2. Settings files
- `backend/.env.example`: copy it to `backend/.env`, then fill in your MySQL password, `MONGO_URI` and `JWT_SECRET`
- `ai-service/.env.example`: copy it to `ai-service/.env`, then fill in `GEMINI_API_KEY`

## 3. Run (3 terminals)
```
cd ai-service
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
```
cd backend
npm install
npm run create-admin
npm run dev
```
```
cd frontend
npm install
npm run dev
```
Open http://localhost:5173. Log in as admin with the `ADMIN_EMAIL` / `ADMIN_PASSWORD` you set in `backend/.env`.

## SRS modules
| Module | Backend | Frontend page |
|---|---|---|
| 3.1 Auth and profile | routes/auth.js | Login, Register, Profile |
| 3.2 Trips | routes/trips.js | Trips, TripNew, TripOverview, TripEdit |
| 3.3 Preferences | routes/preferences.js | Preferences |
| 3.4 AI itinerary | routes/plan.js, services/aiPlanner.js | Itinerary |
| 3.5 Group consensus | routes/votes.js | Votes |
| 3.7 Budget | routes/budget.js | Budget |
| 3.9 Reviews | routes/destinations.js | Destinations, DestinationDetail |
| 3.10 Admin | routes/admin.js | Admin |

## Reviewer corrections
1. There is one shared AI service for the itinerary and group consensus (`aiPlanner.js` and `ai-service/app/planner.py`).
2. The AI chat assistant is not built (Future Scope).
3. The flight and hotel features are not built (Future Scope).
4. The Consensus Engine gets 2 weeks in the project timeline.
5. Bad AI output is checked, retried up to 2 times, and each try is limited to 15 seconds. Invalid output is never saved (`aiPlanner.js`).

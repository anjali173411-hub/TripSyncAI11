# Planora incremental API upgrade

## Audit
Preserved React routes and CSS, Express/MySQL trip routes, Gemini structured output schema, and existing trips table. New tool data is stored in the existing itinerary JSON (`external_data`), avoiding a mandatory migration.

## Configure
1. Copy `ai-service/.env.example` to `ai-service/.env`. Set `GEMINI_API_KEY` and a model available to your Google account. Add `GOOGLE_MAPS_API_KEY` for live Places and driving routes.
2. Enable **Places API (New)** and **Routes API** for the Google Cloud project and enable billing as required by Google. Restrict the server-side key appropriately.
3. Hotel availability: adapter intentionally reports unavailable until a contracted hotel provider is implemented. Never treat the placeholder as a live integration.
4. Open-Meteo forecast/geocoding do not require a key. Check licensing for commercial usage.
5. Keep existing `backend/.env` MySQL credentials and `AI_SERVICE_URL=http://localhost:8000`.

## Install and run (Windows, separate terminals)
```powershell
cd ai-service
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
```powershell
cd backend
npm install
npm run dev
```
```powershell
cd frontend
npm install
npm run dev
```

## Postman / browser endpoints
- `GET http://localhost:8000/health`
- `GET http://localhost:8000/geocode?destination=Munnar`
- `GET http://localhost:8000/weather?latitude=10.08&longitude=77.06&start_date=2026-10-10&end_date=2026-10-12`
- `GET http://localhost:8000/places?destination=Munnar&latitude=10.08&longitude=77.06`
- `GET http://localhost:8000/restaurants?destination=Munnar&latitude=10.08&longitude=77.06&preferences=vegetarian`
- `GET http://localhost:8000/hotels?destination=Munnar&checkin=2026-10-20&checkout=2026-10-23`
- `GET http://localhost:8000/transport?origin=Kochi&destination=Munnar`
- `POST http://localhost:8000/generate-itinerary` JSON: `{"destination":"Munnar","start_location":"Kochi","start_date":"2026-10-20","end_date":"2026-10-22","budget":20000,"travellers":2,"preference_text":"I like waterfalls and nature"}`
- `GET http://localhost:5000/api/health`
- `GET http://localhost:5000/api/trips/:id/weather` (same pattern for places, restaurants, hotels, transport)
- `PUT http://localhost:5000/api/trips/:id/preferences` JSON: `{"preferenceText":"I prefer nature and quiet places"}`
- `POST http://localhost:5000/api/trips/:id/generate`

## Source provenance
Open-Meteo: weather and geocoding. Google Places: attraction/restaurant identities, provider ratings and supplied reviews. Google Routes: driving distance and estimated duration, **not fare**. Gemini: itinerary selection, descriptions, planning estimates. Hotels: not configured; no live pricing or availability. No reservations are made.

## Limitations
- Real-world provider API calls were not executed in this sandbox. Verify with your own credentials.
- The current Gemini response schema retains the existing day/activity structure; additional hotel and transport UI sections are provider-status summaries, not bookings.
- Google Places can incur charges. External API caching is in-memory and per FastAPI process. Production deployments should use shared cache and stronger rate limits.
- Trip dates outside forecast range correctly show weather unavailable.
- If no verified attraction list is available, itinerary generation fails clearly instead of fabricating attractions.
- The existing SQL schema needs no migration for this upgrade.

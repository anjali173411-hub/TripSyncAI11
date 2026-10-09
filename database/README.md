# Database setup

TripSync AI uses two databases:

- **MySQL** stores all the main application data: users, trips (including the AI-generated
  itinerary), members, invitations, preferences, clashes, votes, expenses, destinations and reviews.
- **MongoDB** stores only the downloaded itinerary PDFs, in the **`downloads`** collection.

## Steps

1. Create the MySQL tables:  `mysql -u root -p < database/schema.sql`
2. Fill in `backend/.env` (copy it from `backend/.env.example`):
   `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE=planora`, `MONGO_URI`
3. If you already have an older database, bring it up to date with `npm run migrate` (in the
   `backend` folder). It only adds missing columns and is safe to run more than once.
4. MongoDB needs no setup. The `downloads` collection is created the first time someone clicks
   **Download PDF** on the Itinerary page. Each download saves one document per user per trip with
   the user's details, the trip details, a copy of the itinerary and the PDF file.

## Common errors
- `ECONNREFUSED`: MySQL isn't running.
- `ER_ACCESS_DENIED_ERROR`: wrong MySQL user or password.
- `ER_BAD_DB_ERROR` or `ER_NO_SUCH_TABLE`: run schema.sql.
- `Couldn't save the PDF to MongoDB`: check `MONGO_URI` in `backend/.env`, and that your IP is
  allowed under Network Access in MongoDB Atlas.

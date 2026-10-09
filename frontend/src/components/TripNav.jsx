import { NavLink } from "react-router-dom";

export default function TripNav({ trip }) {
  const base = `/trip/${trip.id}`;
  const tripStatus = trip.trip_status || trip.status || "planning";

  return (
    <>
      <section className="page-heading">
        <p className="eyebrow">
          {trip.type === "group" ? "Group trip" : "Solo trip"} ·{" "}
          {tripStatus}
        </p>

        <h1>
          {trip.title || trip.destination || "Trip from " + trip.start_location}
        </h1>

        <p>
          {trip.start_date} → {trip.end_date} · Budget ₹
          {Number(trip.budget).toLocaleString()}
        </p>
      </section>

      <nav className="trip-tabs">
        <NavLink end to={base}>
          Overview
        </NavLink>

        <NavLink to={`${base}/preferences`}>
          Preferences
        </NavLink>

        <NavLink to={`${base}/members`}>
          Members
        </NavLink>

        <NavLink to={`${base}/itinerary`}>
          Itinerary
        </NavLink>

        {trip.type === "group" && (
          <NavLink to={`${base}/votes`}>
            Votes
          </NavLink>
        )}

        <NavLink to={`${base}/budget`}>
          Budget
        </NavLink>
      </nav>
    </>
  );
}

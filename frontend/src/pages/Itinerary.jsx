import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CalendarDays, ChevronDown, Download, RefreshCw, Sparkles } from "lucide-react";

import Layout from "../components/Layout";
import TripNav from "../components/TripNav";
import api, { getErrorMessage } from "../services/api";

export default function Itinerary() {
  const { id } = useParams();

  const [trip, setTrip] = useState(null);
  const [openClashes, setOpenClashes] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [redoDay, setRedoDay] = useState(1);
  const [redoWish, setRedoWish] = useState("");

  const [activeDay, setActiveDay] = useState(0);
  const [openCards, setOpenCards] = useState([]);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});

  async function loadData() {
    try {
      const response = await api.get(`/trips/${id}`);
      setTrip(response.data);

      if (response.data.type === "group") {
        const votes = await api.get(`/trips/${id}/votes`);
        setOpenClashes(votes.data.conflicts.filter((c) => !c.resolved).length);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  useEffect(() => {
    loadData();
  }, [id]);

  async function run(action, busyText) {
    setError("");
    setMessage(busyText || "");
    if (busyText) setBusy(true);
    try {
      const response = await action();
      if (response.data.status === "generation_failed") {
        setError(response.data.error);
        setMessage("");
      } else {
        setMessage(response.data.message || "Done.");
      }
      setEditing(null);
      setOpenCards([]);
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err));
      setMessage("");
    } finally {
      setBusy(false);
    }
  }

  function generate() {
    if (trip.itinerary && !window.confirm("This replaces the current plan and any votes. Continue?")) return;
    run(() => api.post(`/trips/${id}/generate`), "The AI is planning your trip... this can take a few seconds.");
  }

  async function downloadPDF() {
  try {
    setError("");
    setMessage("Preparing your PDF...");

    const response = await api.get(`/trips/${id}/download`, {
      responseType: "blob",
    });

    const blob = new Blob([response.data], {
      type: "application/pdf",
    });

    const url = window.URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `tripsync-itinerary-${id}.pdf`;

    document.body.appendChild(link);
    link.click();

    link.remove();
    window.URL.revokeObjectURL(url);

    setMessage("Itinerary downloaded successfully.");
  } catch (err) {
    let text = getErrorMessage(err);
    if (err.response?.data instanceof Blob) {
      try {
        text = JSON.parse(await err.response.data.text()).message || text;
      } catch {
      }
    }
    setError(text);
    setMessage("");
  }
}

  function startEdit(dayIndex, index, activity) {
    setEditing({ day: dayIndex, index: index });
    setEditForm({
      time: activity.time,
      title: activity.title,
      description: activity.description,
      estimated_cost: activity.estimated_cost,
    });
  }

  function memberNames(ids) {
    return (ids || [])
      .map((memberId) => trip.members.find((m) => m.id === memberId)?.name)
      .filter(Boolean)
      .join(", ");
  }

  if (!trip) {
    return (
      <Layout>
        <div className={error ? "error-card" : "state-card"}>{error || "Loading itinerary..."}</div>
      </Layout>
    );
  }

  const plan = trip.itinerary;
  const tripStatus = trip.trip_status || trip.status;

  const dayIndex = plan ? Math.min(activeDay, Math.max(plan.days.length - 1, 0)) : 0;
  const currentDay = plan ? plan.days[dayIndex] : null;

  function toggleCard(day, index) {
    const key = `${day}-${index}`;
    setOpenCards(openCards.includes(key) ? openCards.filter((k) => k !== key) : [...openCards, key]);
  }

  function allOpen(day, dayData) {
    return dayData.activities.length > 0 && dayData.activities.every((_, i) => openCards.includes(`${day}-${i}`));
  }

  function toggleAll(day, dayData) {
    const keys = dayData.activities.map((_, i) => `${day}-${i}`);
    setOpenCards(allOpen(day, dayData)
      ? openCards.filter((k) => !keys.includes(k))
      : [...new Set([...openCards, ...keys])]);
  }

const canChange =
  trip.is_organiser &&
  ["planning", "generating", "generation_failed"].includes(tripStatus);

  return (
    <Layout>
      <TripNav trip={trip} />

      {error && <div className="error-card">{error}</div>}
      {message && <div className="success-card">{message}</div>}

      {!plan && (
        <section className="empty-state">
          <h1>No itinerary yet</h1>
          <p>
            Once everyone has added their <Link to={`/trip/${id}/preferences`}>preferences</Link>,
            the organiser generates one plan for the whole group.
          </p>
          {trip.generation_error && !error && <div className="error-card">{trip.generation_error}</div>}
          {canChange && (
            <button className="primary-btn" onClick={generate} disabled={busy}>
              <Sparkles size={18} />
              {busy ? "Generating..." : "Generate itinerary"}
            </button>
          )}
        </section>
      )}

      {plan && (
        <section className="itinerary-layout">
          <div className="itinerary-content">
            <div className="card">
              <p className="muted">{plan.summary}</p>
              {openClashes > 0 && (
                <p>
                  <span className="badge orange">{openClashes} clash(es) need a vote</span>{" "}
                  <Link to={`/trip/${id}/votes`}>Go to votes</Link>
                </p>
              )}
            </div>

            <div className="day-tabs" role="tablist" aria-label="Itinerary days">
              {plan.days.map((day, index) => (
                <button
                  key={index}
                  type="button"
                  role="tab"
                  aria-selected={index === dayIndex}
                  className={index === dayIndex ? "day-tab active" : "day-tab"}
                  onClick={() => setActiveDay(index)}
                >
                  <strong>Day {day.day}</strong>
                  <span>{day.date}</span>
                </button>
              ))}
            </div>

            {currentDay && (
              <article className="day-card" key={dayIndex} role="tabpanel">
                <div className="day-header">
                  <div>
                    <p className="eyebrow">Day {currentDay.day}</p>
                    <h2>{currentDay.title}</h2>
                  </div>
                  <span className="date-pill">
                    <CalendarDays size={15} />
                    {currentDay.date}
                  </span>
                </div>

                <div className="day-tools">
                  <span className="muted">
                    {currentDay.activities.length} {currentDay.activities.length === 1 ? "activity" : "activities"} · ₹
                    {currentDay.activities
                      .reduce((sum, a) => sum + (Number(a.estimated_cost) || 0), 0)
                      .toLocaleString()}
                  </span>
                  <button type="button" className="link-btn" onClick={() => toggleAll(dayIndex, currentDay)}>
                    {allOpen(dayIndex, currentDay) ? "Collapse all" : "Expand all"}
                  </button>
                </div>

                {currentDay.activities.length === 0 && <p className="muted">Nothing planned for this day.</p>}

                <div className="activity-list">
                  {currentDay.activities.map((activity, index) => {
                    const isEditing = editing && editing.day === dayIndex && editing.index === index;
                    const isOpen = isEditing || openCards.includes(`${dayIndex}-${index}`);
                    return (
                    <div className={isOpen ? "activity open" : "activity"} key={index}>
                      <div className="activity-number">{activity.time || index + 1}</div>

                      {!isEditing && (
                        <div className="activity-content">
                          <button
                            type="button"
                            className="activity-toggle"
                            aria-expanded={isOpen}
                            onClick={() => toggleCard(dayIndex, index)}
                          >
                            <h3>{activity.title}</h3>
                            <span className="cost">₹{Number(activity.estimated_cost).toLocaleString()}</span>
                            <ChevronDown size={18} className="activity-chevron" />
                          </button>

                          {isOpen && (
                          <div className="activity-details">
                          <p>{activity.description}</p>
                          {activity.location && <p className="muted">📍 {activity.location}</p>}

                          {trip.type === "group" && memberNames(activity.matched_members) && (
                            <div>
                              <span className="match">Matches: {memberNames(activity.matched_members)}</span>
                            </div>
                          )}

                          {canChange && (
                            <div className="row" style={{ marginTop: 10 }}>
                              <button className="small-btn" onClick={() => startEdit(dayIndex, index, activity)}>
                                Edit
                              </button>
                              <select
                                style={{ width: "auto", height: 32 }}
                                value=""
                                onChange={(e) =>
                                  run(() => api.post(`/trips/${id}/activities/${dayIndex}/${index}/move`, { toDay: e.target.value }))
                                }
                              >
                                <option value="">Move to…</option>
                                {plan.days.map((d) => (
                                  <option key={d.day} value={d.day}>Day {d.day}</option>
                                ))}
                              </select>
                              <button
                                className="small-btn danger"
                                onClick={() => {
                                  if (window.confirm("Remove this activity?")) {
                                    run(() => api.delete(`/trips/${id}/activities/${dayIndex}/${index}`));
                                  }
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          )}
                          </div>
                          )}
                        </div>
                      )}

                      {isEditing && (
                        <div className="activity-content" style={{ flex: 1 }}>
                          <div className="form-grid">
                            <input value={editForm.time} placeholder="09:00" onChange={(e) => setEditForm({ ...editForm, time: e.target.value })} />
                            <input type="number" min="0" value={editForm.estimated_cost} onChange={(e) => setEditForm({ ...editForm, estimated_cost: e.target.value })} />
                          </div>
                          <input style={{ marginTop: 10 }} value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
                          <textarea style={{ marginTop: 10 }} rows="2" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                          <div className="row" style={{ marginTop: 10 }}>
                            <button
                              className="small-btn"
                              onClick={() => run(() => api.put(`/trips/${id}/activities/${dayIndex}/${index}`, editForm))}
                            >
                              Save
                            </button>
                            <button className="small-btn" onClick={() => setEditing(null)}>Cancel</button>
                          </div>
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              </article>
            )}
          </div>

          <aside className="summary-card itinerary-sidebar">
            <h3>Estimated cost</h3>
            <div className="cost-total">₹{Number(plan.total_estimated_cost).toLocaleString()}</div>
            <div className="cost-breakdown">
              {Object.entries(plan.cost_breakdown).map(([key, value]) => (
                <div className="summary-row" key={key}>
                  <span>{key}</span>
                  <strong>₹{Number(value).toLocaleString()}</strong>
                </div>
              ))}
            </div>

            <button className="secondary-btn full-btn" style={{ marginTop: 14 }} onClick={downloadPDF}>
              <Download size={16} /> Download PDF
            </button>

            {canChange && (
              <>
                <hr />
                <h3>Redo one day</h3>
                <select value={redoDay} onChange={(e) => setRedoDay(e.target.value)}>
                  {plan.days.map((d) => (
                    <option key={d.day} value={d.day}>Day {d.day}</option>
                  ))}
                </select>
                <textarea
                  style={{ marginTop: 10 }}
                  rows="2"
                  placeholder="e.g. make it less tiring"
                  value={redoWish}
                  onChange={(e) => setRedoWish(e.target.value)}
                />
                <button
                  className="secondary-btn full-btn"
                  style={{ marginTop: 10 }}
                  disabled={busy}
                  onClick={() =>
                    run(() => api.post(`/trips/${id}/redo-day`, { day: Number(redoDay), instructions: redoWish }), "Redoing the day...")
                  }
                >
                  <RefreshCw size={16} /> Redo day
                </button>

                <hr />
                <button className="secondary-btn full-btn" onClick={generate} disabled={busy}>
                  Generate a new plan
                </button>
                <button
                  className="primary-btn full-btn"
                  style={{ marginTop: 10 }}
                  onClick={() => run(() => api.post(`/trips/${id}/finalise`))}
                >
                  Finalise the plan
                </button>
              </>
            )}

            {tripStatus !== "planning" && (<p className="muted">This plan is {tripStatus}.</p>
)}
          </aside>
        </section>
      )}
    </Layout>
  );
}

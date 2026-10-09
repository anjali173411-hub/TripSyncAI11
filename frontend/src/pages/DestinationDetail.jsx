import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import Layout from "../components/Layout";
import api, { getErrorMessage } from "../services/api";

export default function DestinationDetail() {
  const { id } = useParams();

  const [data, setData] = useState(null);
  const [rating, setRating] = useState("5");
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadData() {
    try {
      const response = await api.get(`/destinations/${id}`);
      setData(response.data);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  useEffect(() => {
    loadData();
  }, [id]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    try {
      const response = await api.post(`/destinations/${id}/reviews`, { rating: Number(rating), comment });
      setMessage(response.data.message);
      setComment("");
      loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function deleteReview(reviewId) {
    if (!window.confirm("Delete your review?")) return;
    try {
      await api.delete(`/destinations/reviews/${reviewId}`);
      loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  if (!data) {
    return (
      <Layout>
        <div className={error ? "error-card" : "state-card"}>{error || "Loading..."}</div>
      </Layout>
    );
  }

  const d = data.destination;

  return (
    <Layout>
      <section className="page-heading">
        <p className="eyebrow">{d.region}</p>
        <h1>
          {d.name} <span className={`badge tier-${d.cost_tier}`}>{d.cost_tier}</span>
        </h1>
        <p>
          {d.description} · About ₹{Number(d.average_cost).toLocaleString()} per person ·{" "}
          {d.average_rating ? `${d.average_rating} / 5` : "No ratings yet"}
        </p>
      </section>

      {d.images.length > 0 && (
        <div className="dest-gallery">
          {d.images.map((link) => (
            <img key={link} src={link} alt={d.name} loading="lazy" />
          ))}
        </div>
      )}

      {error && <div className="error-card">{error}</div>}
      {message && <div className="success-card">{message}</div>}

      <div className="two-col">
        <section className="card">
          <h2>Reviews ({data.reviews.length})</h2>
          {data.reviews.length === 0 && <p className="muted">No reviews yet.</p>}
          {data.reviews.map((review) => (
            <div className="list-row" key={review._id}>
              <span>
                <strong>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</strong> {review.user.name}
                <br />
                <span className="muted">{review.comment}</span>
              </span>
              {review.user.id === data.my_user_id && (
                <button className="small-btn danger" onClick={() => deleteReview(review._id)}>Delete</button>
              )}
            </div>
          ))}
        </section>

        <aside className="card">
          <h2>Write a review</h2>
          {!data.can_review && (
            <p className="muted">
              You can review a place once you have completed a trip there (and only once).
            </p>
          )}
          {data.can_review && (
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label htmlFor="rating">Rating</label>
                <select id="rating" value={rating} onChange={(e) => setRating(e.target.value)}>
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>{n} star{n > 1 ? "s" : ""}</option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ marginTop: 12 }}>
                <label htmlFor="comment">Comment</label>
                <textarea id="comment" rows="4" value={comment} onChange={(e) => setComment(e.target.value)} />
              </div>
              <button type="submit" className="primary-btn full-btn" style={{ marginTop: 14 }}>
                Post review
              </button>
            </form>
          )}
        </aside>
      </div>
    </Layout>
  );
}

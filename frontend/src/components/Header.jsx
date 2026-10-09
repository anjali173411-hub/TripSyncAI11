import { MapPinned } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  const isAdmin = user && user.role === "admin";

  return (
    <header className="header">
      <div className="header-inner">
        <Link to={isAdmin ? "/admin" : "/trips"} className="logo">
          <MapPinned size={28} />
          <span>TripSync AI</span>
          {isAdmin && <span className="admin-pill">Admin</span>}
        </Link>

        <nav className="header-nav">
          {isAdmin ? (
            <Link to="/admin">Admin panel</Link>
          ) : (
            <>
              <Link to="/trips">My Trips</Link>
              <Link to="/destinations">Destinations</Link>
              <Link to="/profile">Profile</Link>
              <Link to="/trip/new" className="header-create">
                Plan a Trip
              </Link>
            </>
          )}

          {user && (
            <button type="button" className="small-btn" onClick={handleLogout}>
              Log out ({user.name})
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}

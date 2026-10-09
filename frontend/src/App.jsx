import { Navigate, Route, Routes } from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Trips from "./pages/Trips";
import TripNew from "./pages/TripNew";
import TripEdit from "./pages/TripEdit";
import TripOverview from "./pages/TripOverview";
import Preferences from "./pages/Preferences";
import Itinerary from "./pages/Itinerary";
import Votes from "./pages/Votes";
import Budget from "./pages/Budget";
import Destinations from "./pages/Destinations";
import DestinationDetail from "./pages/DestinationDetail";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";
import Members from "./pages/Members";
import Invitations from "./pages/Invitation";

function Private({ children }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/trips" replace />} />

      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/trips" element={<Private><Trips /></Private>} />
      <Route path="/trip/new" element={<Private><TripNew /></Private>} />
      <Route path="/trip/:id" element={<Private><TripOverview /></Private>} />
      <Route path="/trip/:id/edit" element={<Private><TripEdit /></Private>} />
      <Route path="/trip/:id/preferences" element={<Private><Preferences /></Private>} />
      <Route path="/trip/:id/itinerary" element={<Private><Itinerary /></Private>} />
      <Route path="/trip/:id/votes" element={<Private><Votes /></Private>} />
      <Route path="/trip/:id/budget" element={<Private><Budget /></Private>} />

      <Route path="/destinations" element={<Private><Destinations /></Private>} />
      <Route path="/destinations/:id" element={<Private><DestinationDetail /></Private>} />
      <Route path="/profile" element={<Private><Profile /></Private>} />
      <Route path="/admin" element={<ProtectedRoute adminOnly><Admin /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/trips" replace />} />

      <Route
  path="/trip/:id/members"
  element={
    <Private>
      <Members />
    </Private>
  }
/>

<Route
  path="/invitations"
  element={
    <Private>
      <Invitations />
    </Private>
  }
/>
    </Routes>

  );
}

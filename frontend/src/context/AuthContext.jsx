import { createContext, useContext, useEffect, useState } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkSavedLogin() {
      if (localStorage.getItem("token")) {
        try {
          const response = await api.get("/auth/me");
          setUser(response.data);
        } catch {
          localStorage.removeItem("token");
        }
      }
      setLoading(false);
    }

    checkSavedLogin();
  }, []);

  async function login(email, password) {
    const response = await api.post("/auth/login", { email, password });
    localStorage.setItem("token", response.data.token);
    setUser(response.data.user);
    return response.data.user;
  }

  async function register(name, email, password) {
    await api.post("/auth/register", { name, email, password });
    await login(email, password);
  }

  async function logout() {
    try {
      await api.post("/auth/logout");
    } catch {
    }
    localStorage.removeItem("token");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

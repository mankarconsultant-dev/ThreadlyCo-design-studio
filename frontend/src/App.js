import { useState, useEffect, createContext, useContext, useCallback } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { Toaster } from "@/components/ui/sonner";

import LoginPage from "@/pages/LoginPage";
import Layout from "@/components/Layout";
import TrendExplorer from "@/pages/TrendExplorer";
import DesignGenerator from "@/pages/DesignGenerator";
import SettingsPage from "@/pages/SettingsPage";

/* ─── API Setup ──────────────────────────────────────────────── */
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// Configure axios to send cookies with every request
axios.defaults.withCredentials = true;

/* ─── Auth Context ───────────────────────────────────────────── */
export const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

function AuthProvider({ children }) {
  // null = checking, false = not authenticated, object = user
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const { data } = await axios.get(`${API}/auth/me`, { headers });
      setUser(data);
    } catch {
      setUser(false);
      localStorage.removeItem("token");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email, password) => {
    const { data } = await axios.post(`${API}/auth/login`, { email, password });
    if (data.token) {
      localStorage.setItem("token", data.token);
    }
    setUser(data);
    return data;
  };

  const logout = async () => {
    try {
      await axios.post(`${API}/auth/logout`);
    } catch { /* ignore */ }
    localStorage.removeItem("token");
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

/* ─── Protected Route ────────────────────────────────────────── */
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050814]">
        <div className="w-8 h-8 border-2 border-[#3D7A5F] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || user === false) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

/* ─── App Component ──────────────────────────────────────────── */
function AppRoutes() {
  const { user } = useAuth();
  const location = useLocation();

  return (
    <Routes>
      <Route
        path="/login"
        element={user && user !== false ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<TrendExplorer />} />
        <Route path="design/:nicheName" element={<DesignGenerator />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#0B1120",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#fff",
              fontFamily: "Jost, sans-serif",
            },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

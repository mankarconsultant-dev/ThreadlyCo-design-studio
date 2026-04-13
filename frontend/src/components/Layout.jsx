/**
 * Layout - Main dashboard shell with sidebar navigation and stats bar
 * Wraps all authenticated pages
 */
import { useState, useEffect, useCallback } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth, API } from "@/App";
import axios from "axios";
import {
  Compass,
  Palette,
  Settings,
  LogOut,
  Menu,
  X,
  TrendingUp,
  CheckCircle,
  Send,
  ShoppingBag,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

/* Stats Bar - top row of dashboard stats */
function StatsBar({ stats }) {
  const statItems = [
    { label: "Designs Generated", value: stats.total_generated, icon: Palette, color: "#3D7A5F" },
    { label: "Approved", value: stats.total_approved, icon: CheckCircle, color: "#F59E0B" },
    { label: "Pushed to Printify", value: stats.total_pushed, icon: Send, color: "#3B82F6" },
    { label: "Products Live", value: stats.total_live, icon: ShoppingBag, color: "#EF4444" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8" data-testid="stats-dashboard">
      {statItems.map((item) => (
        <div
          key={item.label}
          className="bg-[#0B1120] border border-white/5 rounded-2xl p-5 hover:-translate-y-0.5 transition-all duration-300"
          data-testid={`stat-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${item.color}15`, border: `1px solid ${item.color}30` }}
            >
              <item.icon className="w-4 h-4" style={{ color: item.color }} strokeWidth={1.5} />
            </div>
            <span
              className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500"
              style={{ fontFamily: "Jost, sans-serif" }}
            >
              {item.label}
            </span>
          </div>
          <p
            className="text-3xl font-black text-white tracking-tight"
            style={{ fontFamily: "Raleway, sans-serif" }}
          >
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

/* Sidebar product log */
function ProductLog({ products }) {
  if (!products.length) return null;

  return (
    <div className="mt-6" data-testid="product-log">
      <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 mb-3 px-2">
        Recent Products
      </h3>
      <ScrollArea className="h-64">
        <div className="space-y-2">
          {products.slice(0, 15).map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-[#050814]/60 border border-white/5 hover:border-white/10 transition-all text-sm group"
            >
              <div
                className={`w-2 h-2 rounded-full shrink-0 ${
                  p.status === "pushed"
                    ? "bg-green-500"
                    : p.status === "approved"
                    ? "bg-yellow-500"
                    : "bg-red-500"
                }`}
              />
              <div className="flex-1 min-w-0">
                <p className="text-white truncate text-xs font-medium">{p.product_title}</p>
                <p className="text-slate-500 text-[10px]">{p.product_type}</p>
              </div>
              {p.status === "pushed" && (
                <ChevronRight className="w-3 h-3 text-slate-600 group-hover:text-[#3D7A5F] transition-colors" />
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

const navItems = [
  { to: "/", icon: Compass, label: "Trend Explorer", end: true },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ total_generated: 0, total_approved: 0, total_pushed: 0, total_live: 0 });
  const [products, setProducts] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const token = localStorage.getItem("token");
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/stats`, { headers: authHeaders });
      setStats(data);
    } catch { /* ignore */ }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/products`, { headers: authHeaders });
      setProducts(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchProducts();
    // Refresh stats periodically
    const interval = setInterval(() => {
      fetchStats();
      fetchProducts();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchStats, fetchProducts]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-[#050814] flex" data-testid="main-layout">
      {/* Mobile menu toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-4 left-4 z-50 lg:hidden p-2 rounded-xl bg-[#0B1120] border border-white/10"
        data-testid="mobile-menu-toggle"
      >
        {sidebarOpen ? <X className="w-5 h-5 text-white" /> : <Menu className="w-5 h-5 text-white" />}
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#0B1120]/95 backdrop-blur-xl border-r border-white/5 transform transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        data-testid="sidebar"
      >
        <div className="flex flex-col h-full p-5">
          {/* Brand */}
          <div className="mb-8 mt-2">
            <h2
              className="text-xl font-black tracking-tight text-white"
              style={{ fontFamily: "Raleway, sans-serif" }}
            >
              ThreadlyCo
            </h2>
            <p className="text-[11px] text-slate-500 tracking-[0.15em] uppercase font-medium mt-0.5">
              Design Studio
            </p>
          </div>

          {/* Navigation */}
          <nav className="space-y-1.5 flex-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-[#3D7A5F]/15 text-[#3D7A5F] border border-[#3D7A5F]/20"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`
                }
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <item.icon className="w-4 h-4" strokeWidth={1.5} />
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Product Log */}
          <ProductLog products={products} />

          {/* User / Logout */}
          <div className="border-t border-white/5 pt-4 mt-4">
            <div className="flex items-center gap-3 px-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-[#3D7A5F]/15 border border-[#3D7A5F]/30 flex items-center justify-center">
                <span className="text-xs font-bold text-[#3D7A5F]">
                  {user?.name?.[0] || user?.email?.[0]?.toUpperCase() || "A"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">{user?.name || "Admin"}</p>
                <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={handleLogout}
              data-testid="logout-button"
              className="w-full justify-start gap-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl h-10 text-sm"
            >
              <LogOut className="w-4 h-4" strokeWidth={1.5} />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 min-h-screen overflow-y-auto">
        <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
          {/* Stats Dashboard */}
          <StatsBar stats={stats} />
          {/* Page Content */}
          <Outlet context={{ fetchStats, fetchProducts, authHeaders }} />
        </div>
      </main>
    </div>
  );
}

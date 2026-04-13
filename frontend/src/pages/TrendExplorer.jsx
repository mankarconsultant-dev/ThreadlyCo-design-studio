/**
 * TrendExplorer - Page 1
 * Shows trending niches for Gen Z and Gen Alpha audiences.
 * Includes search bar, heat level filters, and niche cards.
 * Clicking a niche navigates to the Design Generator.
 */
import { useState, useEffect } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import axios from "axios";
import { API } from "@/App";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Flame, TrendingUp, Minus, Sparkles } from "lucide-react";
import { HEAT_LEVELS } from "@/config";

/* Heat level badge component */
function HeatBadge({ level }) {
  const config = HEAT_LEVELS[level] || HEAT_LEVELS.Steady;
  const icons = { Hot: Flame, Rising: TrendingUp, Steady: Minus };
  const Icon = icons[level] || Minus;

  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide"
      style={{
        backgroundColor: `${config.color}15`,
        color: config.color,
        border: `1px solid ${config.color}25`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full animate-pulse"
        style={{ backgroundColor: config.color }}
      />
      <Icon className="w-3 h-3" strokeWidth={2} />
      {config.label}
    </span>
  );
}

/* Niche Card */
function NicheCard({ niche, onClick, index }) {
  return (
    <button
      onClick={onClick}
      className="text-left w-full bg-[#0B1120] border border-white/5 rounded-2xl p-6 hover:-translate-y-1 hover:border-[#3D7A5F]/30 hover:shadow-[0_8px_32px_rgba(61,122,95,0.1)] transition-all duration-300 group animate-fade-in-up"
      style={{ animationDelay: `${index * 60}ms` }}
      data-testid={`niche-card-${niche.name.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="flex items-start justify-between mb-4">
        <h3
          className="text-lg font-bold text-white group-hover:text-[#3D7A5F] transition-colors tracking-tight"
          style={{ fontFamily: "Raleway, sans-serif" }}
        >
          {niche.name}
        </h3>
        <HeatBadge level={niche.heat_level} />
      </div>
      <p className="text-sm text-slate-400 leading-relaxed mb-3 line-clamp-2" style={{ fontFamily: "Jost, sans-serif" }}>
        {niche.description}
      </p>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-slate-500 uppercase tracking-[0.15em] font-medium">
          {niche.audience}
        </span>
        <span className="text-[11px] text-[#3D7A5F] opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 font-semibold">
          Generate Designs <Sparkles className="w-3 h-3" />
        </span>
      </div>
    </button>
  );
}

export default function TrendExplorer() {
  const [niches, setNiches] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { authHeaders } = useOutletContext();

  useEffect(() => {
    const fetchNiches = async () => {
      try {
        const { data } = await axios.get(`${API}/niches`, { headers: authHeaders });
        setNiches(data);
      } catch (err) {
        console.error("Failed to fetch niches:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchNiches();
  }, []);

  const filters = ["All", "Hot", "Rising", "Steady"];

  const filtered = niches.filter((n) => {
    const matchesSearch =
      !search || n.name.toLowerCase().includes(search.toLowerCase()) || n.description?.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "All" || n.heat_level === filter;
    return matchesSearch && matchesFilter;
  });

  const handleNicheClick = (niche) => {
    navigate(`/design/${encodeURIComponent(niche.name)}`);
  };

  return (
    <div data-testid="trend-explorer-page">
      {/* Page Header */}
      <div className="mb-8">
        <h1
          className="text-3xl sm:text-4xl font-black tracking-tighter text-white mb-2"
          style={{ fontFamily: "Raleway, sans-serif" }}
        >
          Trend Explorer
        </h1>
        <p className="text-slate-400 text-base" style={{ fontFamily: "Jost, sans-serif" }}>
          Discover trending niches for Gen Z & Gen Alpha. Click any niche to generate designs.
        </p>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-8">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            data-testid="niche-search-input"
            type="text"
            placeholder="Search niches..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-11 bg-[#0B1120] border-white/10 text-white placeholder:text-slate-600 h-11 rounded-xl focus:ring-2 focus:ring-[#3D7A5F] focus:border-transparent"
          />
        </div>
        <div className="flex gap-2">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              data-testid={`filter-${f.toLowerCase()}`}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                filter === f
                  ? "bg-[#3D7A5F] text-white shadow-[0_0_12px_rgba(61,122,95,0.3)]"
                  : "bg-[#0B1120] text-slate-400 border border-white/5 hover:text-white hover:border-white/15"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-[#0B1120] border border-white/5 rounded-2xl p-6 animate-pulse">
              <div className="h-5 bg-white/5 rounded w-2/3 mb-4" />
              <div className="h-3 bg-white/5 rounded w-full mb-2" />
              <div className="h-3 bg-white/5 rounded w-4/5" />
            </div>
          ))}
        </div>
      )}

      {/* Niche Grid */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5" data-testid="niche-grid">
          {filtered.map((niche, i) => (
            <NicheCard key={niche.id} niche={niche} index={i} onClick={() => handleNicheClick(niche)} />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-16">
              <p className="text-slate-500 text-lg">No niches found matching your search</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * LoginPage - Simple password gate for internal tool access
 * Only admin can log in with pre-set credentials
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/App";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, ArrowRight, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (typeof detail === "string") setError(detail);
      else if (Array.isArray(detail)) setError(detail.map((d) => d.msg || JSON.stringify(d)).join(" "));
      else setError("Login failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "linear-gradient(180deg, #050814 0%, #0B1120 100%)" }}
    >
      <div
        className="w-full max-w-md animate-fade-in-up"
        data-testid="login-page"
      >
        {/* Brand */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#3D7A5F]/15 border border-[#3D7A5F]/30 mb-6">
            <Lock className="w-7 h-7 text-[#3D7A5F]" strokeWidth={1.5} />
          </div>
          <h1
            className="text-4xl sm:text-5xl font-black tracking-tighter text-white"
            style={{ fontFamily: "Raleway, sans-serif" }}
          >
            ThreadlyCo
          </h1>
          <p className="text-slate-400 mt-2 text-base" style={{ fontFamily: "Jost, sans-serif" }}>
            Design Studio — Internal Access
          </p>
        </div>

        {/* Login Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-[#0B1120] border border-white/5 rounded-2xl p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
          data-testid="login-form"
        >
          <div className="space-y-5">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Email
              </Label>
              <Input
                data-testid="login-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@threadlyco.com"
                required
                className="bg-[#050814] border-white/10 text-white placeholder:text-slate-600 h-12 rounded-xl focus:ring-2 focus:ring-[#3D7A5F] focus:border-transparent"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Password
              </Label>
              <Input
                data-testid="login-password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="bg-[#050814] border-white/10 text-white placeholder:text-slate-600 h-12 rounded-xl focus:ring-2 focus:ring-[#3D7A5F] focus:border-transparent"
              />
            </div>
          </div>

          {error && (
            <div
              className="flex items-center gap-2 mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
              data-testid="login-error"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            data-testid="login-submit-button"
            className="w-full mt-6 h-12 bg-[#3D7A5F] hover:bg-[#4F9B7A] text-white font-bold tracking-wide rounded-xl transition-colors shadow-[0_0_15px_rgba(61,122,95,0.3)]"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Signing in...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Sign In <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </Button>
        </form>

        <p className="text-center text-slate-600 text-xs mt-6">
          Internal tool — authorized personnel only
        </p>
      </div>
    </div>
  );
}

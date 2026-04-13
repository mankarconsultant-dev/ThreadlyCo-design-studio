/**
 * SettingsPage - Configure Printify API, pricing, and discount codes
 * All changes are saved to the database so they persist.
 * This page lets the owner change prices, promo codes, and API keys
 * without touching any code.
 */
import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import axios from "axios";
import { API } from "@/App";
import { toast } from "sonner";
import { PRODUCT_TYPES, DEFAULT_PRICES } from "@/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Key,
  Store,
  Percent,
  DollarSign,
  Save,
  Loader2,
  Eye,
  EyeOff,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Tag,
} from "lucide-react";

/* Settings Section Card */
function SettingsCard({ title, icon: Icon, children, testId }) {
  return (
    <div
      className="bg-[#0B1120] border border-white/5 rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.2)]"
      data-testid={testId}
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-[#3D7A5F]/15 border border-[#3D7A5F]/30 flex items-center justify-center">
          <Icon className="w-4 h-4 text-[#3D7A5F]" strokeWidth={1.5} />
        </div>
        <h3 className="text-lg font-bold text-white tracking-tight" style={{ fontFamily: "Raleway" }}>
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const { authHeaders } = useOutletContext();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [fetchingShops, setFetchingShops] = useState(false);
  const [shops, setShops] = useState([]);

  // Settings state
  const [apiKey, setApiKey] = useState("");
  const [apiKeyMasked, setApiKeyMasked] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [shopId, setShopId] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promoPercentage, setPromoPercentage] = useState(0);
  const [compareAtMarkup, setCompareAtMarkup] = useState(20);
  const [prices, setPrices] = useState({ ...DEFAULT_PRICES });

  // Load settings from backend
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data } = await axios.get(`${API}/settings`, { headers: authHeaders });
        setApiKeyMasked(data.printify_api_key_masked || "");
        setHasKey(data.has_printify_key || false);
        setShopId(data.printify_shop_id || "");
        setPromoCode(data.promo_code || "");
        setPromoPercentage(data.promo_percentage || 0);
        setCompareAtMarkup(data.compare_at_markup ?? 20);
        if (data.prices) setPrices(data.prices);
      } catch (err) {
        toast.error("Failed to load settings");
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  // Save all settings
  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        printify_shop_id: shopId,
        promo_code: promoCode,
        promo_percentage: parseFloat(promoPercentage) || 0,
        compare_at_markup: parseFloat(compareAtMarkup) || 20,
        prices,
      };
      // Only include API key if user typed a new one
      if (apiKey) {
        payload.printify_api_key = apiKey;
      }

      const { data } = await axios.put(`${API}/settings`, payload, { headers: authHeaders });
      setApiKeyMasked(data.printify_api_key_masked || "");
      setHasKey(data.has_printify_key || false);
      setApiKey(""); // Clear raw key after save
      toast.success("Settings saved successfully!");
    } catch (err) {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  // Fetch shops from Printify
  const handleFetchShops = async () => {
    setFetchingShops(true);
    try {
      const { data } = await axios.get(`${API}/printify/shops`, { headers: authHeaders });
      setShops(data);
      if (data.length > 0 && !shopId) {
        setShopId(String(data[0].id));
      }
      toast.success(`Found ${data.length} shop(s)`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to fetch shops");
    } finally {
      setFetchingShops(false);
    }
  };

  const updatePrice = (productType, value) => {
    setPrices((prev) => ({ ...prev, [productType]: parseFloat(value) || 0 }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-[#3D7A5F] animate-spin" />
      </div>
    );
  }

  return (
    <div data-testid="settings-page">
      {/* Header */}
      <div className="mb-8">
        <h1
          className="text-3xl sm:text-4xl font-black tracking-tighter text-white mb-2"
          style={{ fontFamily: "Raleway, sans-serif" }}
        >
          Settings
        </h1>
        <p className="text-slate-400 text-base" style={{ fontFamily: "Jost, sans-serif" }}>
          Configure Printify API, pricing, and discount codes. Changes are saved to the database.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Printify API Configuration */}
        <SettingsCard title="Printify API" icon={Key} testId="settings-printify-api">
          <div className="space-y-4">
            {/* API Key */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                API Key
              </Label>
              <div className="relative">
                <Input
                  data-testid="printify-api-key-input"
                  type={showApiKey ? "text" : "password"}
                  value={apiKey || (hasKey ? apiKeyMasked : "")}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your Printify API key"
                  className="bg-[#050814] border-white/10 text-white h-11 rounded-xl pr-10 focus:ring-2 focus:ring-[#3D7A5F]"
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {hasKey && (
                <div className="flex items-center gap-1.5 text-xs text-green-400">
                  <CheckCircle className="w-3 h-3" /> API key is configured
                </div>
              )}
            </div>

            {/* Shop ID */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Shop ID
              </Label>
              <div className="flex gap-2">
                <Input
                  data-testid="printify-shop-id-input"
                  value={shopId}
                  onChange={(e) => setShopId(e.target.value)}
                  placeholder="Your Printify Shop ID"
                  className="bg-[#050814] border-white/10 text-white h-11 rounded-xl focus:ring-2 focus:ring-[#3D7A5F]"
                />
                <Button
                  onClick={handleFetchShops}
                  disabled={fetchingShops || !hasKey}
                  variant="outline"
                  data-testid="fetch-shops-button"
                  className="h-11 px-4 border-white/10 text-slate-300 hover:text-white hover:bg-white/5 rounded-xl shrink-0"
                >
                  {fetchingShops ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </Button>
              </div>
              {!hasKey && (
                <p className="text-xs text-slate-500">Save an API key first to auto-detect shops</p>
              )}
            </div>

            {/* Shops list */}
            {shops.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Available Shops
                </Label>
                <div className="space-y-1">
                  {shops.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setShopId(String(s.id))}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                        String(s.id) === shopId
                          ? "bg-[#3D7A5F]/15 text-[#3D7A5F] border border-[#3D7A5F]/30"
                          : "bg-[#050814] text-slate-300 border border-white/5 hover:border-white/15"
                      }`}
                    >
                      <Store className="w-3 h-3 inline mr-2" />
                      {s.title} (ID: {s.id})
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </SettingsCard>

        {/* Discount & Promo Configuration */}
        <SettingsCard title="Discounts & Pricing" icon={Percent} testId="settings-discounts">
          <div className="space-y-4">
            {/* Compare-at markup */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Compare-At Price Markup (%)
              </Label>
              <Input
                data-testid="compare-at-markup-input"
                type="number"
                step="1"
                min="0"
                max="100"
                value={compareAtMarkup}
                onChange={(e) => setCompareAtMarkup(e.target.value)}
                className="bg-[#050814] border-white/10 text-white h-11 rounded-xl focus:ring-2 focus:ring-[#3D7A5F]"
              />
              <p className="text-xs text-slate-500">
                Original (crossed out) price will be {compareAtMarkup}% above the selling price
              </p>
            </div>

            {/* Promo Code */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 flex items-center gap-1.5">
                <Tag className="w-3 h-3" /> Global Promo Code
              </Label>
              <Input
                data-testid="promo-code-input"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                placeholder="e.g. LAUNCH20"
                className="bg-[#050814] border-white/10 text-white h-11 rounded-xl uppercase focus:ring-2 focus:ring-[#3D7A5F]"
              />
            </div>

            {/* Promo Percentage */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Promo Discount (%)
              </Label>
              <Input
                data-testid="promo-percentage-input"
                type="number"
                step="1"
                min="0"
                max="100"
                value={promoPercentage}
                onChange={(e) => setPromoPercentage(e.target.value)}
                className="bg-[#050814] border-white/10 text-white h-11 rounded-xl focus:ring-2 focus:ring-[#3D7A5F]"
              />
              {promoCode && promoPercentage > 0 && (
                <p className="text-xs text-[#3D7A5F]">
                  Active: {promoCode} = {promoPercentage}% off all products
                </p>
              )}
            </div>
          </div>
        </SettingsCard>
      </div>

      {/* Product Pricing */}
      <SettingsCard title="Product Pricing" icon={DollarSign} testId="settings-pricing">
        <p className="text-sm text-slate-400 mb-4">
          Set the selling price for each product type. The compare-at (original) price is
          automatically calculated based on the markup percentage above.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PRODUCT_TYPES.map((pt) => {
            const salePrice = prices[pt] || DEFAULT_PRICES[pt];
            const originalPrice = (salePrice * (1 + (parseFloat(compareAtMarkup) || 20) / 100)).toFixed(2);
            return (
              <div key={pt} className="space-y-2">
                <Label className="text-xs font-semibold text-slate-500">{pt}</Label>
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 text-sm">$</span>
                  <Input
                    data-testid={`price-${pt.toLowerCase().replace(/\s+/g, "-")}`}
                    type="number"
                    step="0.01"
                    min="0"
                    value={prices[pt] || ""}
                    onChange={(e) => updatePrice(pt, e.target.value)}
                    className="bg-[#050814] border-white/10 text-white h-10 rounded-xl focus:ring-2 focus:ring-[#3D7A5F]"
                  />
                </div>
                <p className="text-[11px] text-slate-600">
                  Compare-at: <span className="line-through">${originalPrice}</span>
                </p>
              </div>
            );
          })}
        </div>
      </SettingsCard>

      {/* Save Button */}
      <div className="mt-8 flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          data-testid="save-settings-button"
          className="h-12 px-10 bg-[#3D7A5F] hover:bg-[#4F9B7A] text-white font-bold rounded-xl shadow-[0_0_15px_rgba(61,122,95,0.3)] transition-all"
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Saving...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Save className="w-4 h-4" /> Save Settings
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}

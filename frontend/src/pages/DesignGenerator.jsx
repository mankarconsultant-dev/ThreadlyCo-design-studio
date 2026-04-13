/**
 * DesignGenerator - Page 2 & 3 Combined
 * Shows selected niche, lets user pick product type, generate AI designs.
 * Selecting a design opens the approval panel with editable fields.
 * Approve pushes to Printify, Reject discards the design.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import axios from "axios";
import html2canvas from "html2canvas";
import { API } from "@/App";
import { toast } from "sonner";
import {
  PRODUCT_TYPES,
  COLOR_VARIANTS,
  DEFAULT_PRICES,
  getCompareAtPrice,
  getPriceForProduct,
} from "@/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Sparkles,
  Check,
  X,
  Send,
  Loader2,
  Tag,
  DollarSign,
  Palette,
  Type,
  ExternalLink,
  Image,
} from "lucide-react";

/**
 * Captures a DOM element as a base64 PNG string using html2canvas.
 * Returns the base64 data (without the data:image/png;base64, prefix).
 */
async function captureElementAsPng(element) {
  const canvas = await html2canvas(element, {
    backgroundColor: null, // transparent background
    scale: 2,              // higher resolution for print quality
    useCORS: true,
    logging: false,
  });
  // Convert to base64 PNG (strip the data URL prefix)
  const dataUrl = canvas.toDataURL("image/png");
  return dataUrl.split(",")[1]; // return just the base64 part
}

/* ─── Design Mockup Component ───────────────────────────────── */
/* captureRef: optional ref attached for html2canvas capture */
function DesignMockup({ design, productType, size = "normal", captureRef }) {
  const colors = design?.colors || ["#1a1a2e", "#3D7A5F", "#ffffff"];
  const isSmall = size === "small";

  return (
    <div
      ref={captureRef}
      className={`relative overflow-hidden rounded-xl border border-white/10 ${
        isSmall ? "w-full aspect-square" : "w-full aspect-[3/4]"
      }`}
      style={{ backgroundColor: colors[0] || "#1a1a2e" }}
      data-testid={`design-mockup-${design?.id || "preview"}`}
    >
      {/* Product shape silhouette */}
      <div className="absolute inset-0 flex items-center justify-center opacity-10">
        <div className="text-[120px] font-black text-white/20" style={{ fontFamily: "Raleway" }}>
          {productType?.[0] || "T"}
        </div>
      </div>

      {/* Design content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
        {/* Accent shape */}
        <div
          className="absolute top-4 right-4 w-12 h-12 rounded-full opacity-30"
          style={{ backgroundColor: colors[2] || "#3D7A5F" }}
        />
        <div
          className="absolute bottom-6 left-6 w-8 h-8 rotate-45 opacity-20"
          style={{ backgroundColor: colors[1] || "#ffffff" }}
        />

        {/* Main design text */}
        <p
          className={`font-black leading-tight tracking-tight ${isSmall ? "text-lg" : "text-2xl sm:text-3xl"}`}
          style={{
            color: colors[1] || "#ffffff",
            fontFamily:
              design?.font_style?.includes("Script") || design?.font_style?.includes("Hand")
                ? "cursive"
                : design?.font_style?.includes("Mono")
                ? "monospace"
                : "Raleway, sans-serif",
            textShadow: `0 2px 8px ${colors[0]}80`,
          }}
        >
          {design?.design_text || "Design Preview"}
        </p>

        {/* Subtle accent line */}
        <div
          className={`${isSmall ? "w-8 h-0.5" : "w-16 h-1"} rounded-full mt-3`}
          style={{ backgroundColor: colors[2] || "#3D7A5F" }}
        />
      </div>

      {/* Style badge */}
      <div className="absolute bottom-3 left-3">
        <span
          className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-md"
          style={{
            backgroundColor: `${colors[1]}20`,
            color: colors[1] || "#fff",
          }}
        >
          {design?.style || "Bold"}
        </span>
      </div>
    </div>
  );
}

/* ─── Design Card ──────────────────────────────────────────── */
function DesignCard({ design, productType, isSelected, onSelect, index }) {
  return (
    <button
      onClick={() => onSelect(design)}
      className={`text-left w-full rounded-2xl overflow-hidden transition-all duration-300 animate-fade-in-up ${
        isSelected
          ? "ring-2 ring-[#3D7A5F] shadow-[0_0_20px_rgba(61,122,95,0.3)] scale-[1.02]"
          : "hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
      }`}
      style={{ animationDelay: `${index * 80}ms` }}
      data-testid={`design-card-${index}`}
    >
      <DesignMockup design={design} productType={productType} size="small" />
      <div className="bg-[#0B1120] border border-white/5 border-t-0 rounded-b-2xl p-4">
        <h4 className="text-sm font-bold text-white truncate mb-1" style={{ fontFamily: "Raleway" }}>
          {design.title}
        </h4>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {(design.colors || []).map((c, i) => (
              <div
                key={i}
                className="w-3 h-3 rounded-full border border-white/20"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <span className="text-[11px] text-slate-500">{design.style}</span>
        </div>
      </div>
    </button>
  );
}

/* ─── Approval Panel (Right Side) ────────────────────────────── */
function ApprovalPanel({ design, productType, onApprove, onReject, approving, pushing, prices, compareAtMarkup, capturing }) {
  const basePrice = getPriceForProduct(productType, prices);
  const compareAt = getCompareAtPrice(basePrice, compareAtMarkup);

  const [title, setTitle] = useState(design?.title || "");
  const [description, setDescription] = useState(design?.description || "");
  const [tags, setTags] = useState((design?.tags || []).join(", "));
  const [selectedType, setSelectedType] = useState(productType);
  const [sellingPrice, setSellingPrice] = useState(basePrice);
  const [compareAtPrice, setCompareAtPrice] = useState(compareAt);
  const [selectedVariants, setSelectedVariants] = useState(["Black", "White"]);

  // Update prices when product type changes
  useEffect(() => {
    const newPrice = getPriceForProduct(selectedType, prices);
    setSellingPrice(newPrice);
    setCompareAtPrice(getCompareAtPrice(newPrice, compareAtMarkup));
  }, [selectedType, prices, compareAtMarkup]);

  const toggleVariant = (v) => {
    setSelectedVariants((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]
    );
  };

  const handleApprove = () => {
    onApprove({
      design,
      product_title: title,
      product_description: description,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      product_type: selectedType,
      selling_price: sellingPrice,
      compare_at_price: compareAtPrice,
      variants: selectedVariants,
    });
  };

  return (
    <div className="bg-[#0B1120] border border-white/5 rounded-2xl p-6 animate-fade-in-up" data-testid="approval-panel">
      <h3
        className="text-xl font-bold text-white mb-6 tracking-tight"
        style={{ fontFamily: "Raleway" }}
      >
        Approve & Push
      </h3>

      <ScrollArea className="h-[calc(100vh-420px)] pr-2">
        <div className="space-y-5">
          {/* Product Title */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 flex items-center gap-1.5">
              <Type className="w-3 h-3" /> Product Title
            </Label>
            <Input
              data-testid="product-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-[#050814] border-white/10 text-white h-11 rounded-xl focus:ring-2 focus:ring-[#3D7A5F]"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              SEO Description
            </Label>
            <Textarea
              data-testid="product-description-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="bg-[#050814] border-white/10 text-white rounded-xl focus:ring-2 focus:ring-[#3D7A5F] resize-none"
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 flex items-center gap-1.5">
              <Tag className="w-3 h-3" /> Tags (comma separated)
            </Label>
            <Input
              data-testid="product-tags-input"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="bg-[#050814] border-white/10 text-white h-11 rounded-xl focus:ring-2 focus:ring-[#3D7A5F]"
            />
          </div>

          {/* Product Type */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Product Type
            </Label>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger
                className="bg-[#050814] border-white/10 text-white h-11 rounded-xl"
                data-testid="product-type-select"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0B1120] border-white/10">
                {PRODUCT_TYPES.map((pt) => (
                  <SelectItem key={pt} value={pt} className="text-white hover:bg-white/5">
                    {pt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 flex items-center gap-1.5">
                <DollarSign className="w-3 h-3" /> Sale Price
              </Label>
              <Input
                data-testid="selling-price-input"
                type="number"
                step="0.01"
                value={sellingPrice}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setSellingPrice(val);
                  setCompareAtPrice(getCompareAtPrice(val, compareAtMarkup));
                }}
                className="bg-[#050814] border-white/10 text-white h-11 rounded-xl focus:ring-2 focus:ring-[#3D7A5F]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Compare-at Price
              </Label>
              <div className="relative">
                <Input
                  data-testid="compare-at-price-input"
                  type="number"
                  step="0.01"
                  value={compareAtPrice}
                  onChange={(e) => setCompareAtPrice(parseFloat(e.target.value))}
                  className="bg-[#050814] border-white/10 text-slate-400 line-through h-11 rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* Color Variants */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 flex items-center gap-1.5">
              <Palette className="w-3 h-3" /> Color Variants
            </Label>
            <div className="flex flex-wrap gap-2">
              {COLOR_VARIANTS.map((v) => (
                <button
                  key={v}
                  onClick={() => toggleVariant(v)}
                  data-testid={`variant-${v.toLowerCase().replace(/\s+/g, "-")}`}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    selectedVariants.includes(v)
                      ? "bg-[#3D7A5F]/20 text-[#3D7A5F] border border-[#3D7A5F]/30"
                      : "bg-[#050814] text-slate-400 border border-white/5 hover:border-white/15"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Action Buttons */}
      <div className="flex gap-3 mt-6 pt-5 border-t border-white/5">
        <Button
          onClick={handleApprove}
          disabled={approving || pushing || capturing}
          data-testid="approve-push-button"
          className="flex-1 h-11 bg-[#3D7A5F] hover:bg-[#4F9B7A] text-white font-bold rounded-xl shadow-[0_0_15px_rgba(61,122,95,0.3)] transition-all"
        >
          {capturing ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Capturing design...
            </span>
          ) : approving ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Approving...
            </span>
          ) : pushing ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Pushing to Printify...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4" /> Approve & Push
            </span>
          )}
        </Button>
        <Button
          onClick={onReject}
          variant="ghost"
          data-testid="reject-button"
          className="h-11 px-5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl border border-red-500/20"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

/* ─── Main DesignGenerator Page ──────────────────────────────── */
export default function DesignGenerator() {
  const { nicheName } = useParams();
  const navigate = useNavigate();
  const { fetchStats, fetchProducts, authHeaders } = useOutletContext();

  const niche = decodeURIComponent(nicheName || "");

  const [productType, setProductType] = useState("T-Shirt");
  const [designs, setDesigns] = useState([]);
  const [selectedDesign, setSelectedDesign] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [prices, setPrices] = useState(DEFAULT_PRICES);
  const [compareAtMarkup, setCompareAtMarkup] = useState(20);
  const [pushResult, setPushResult] = useState(null);

  // Ref for the selected design mockup (used by html2canvas)
  const mockupCaptureRef = useRef(null);

  // Load settings for prices
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data } = await axios.get(`${API}/settings`, { headers: authHeaders });
        if (data.prices) setPrices(data.prices);
        if (data.compare_at_markup != null) setCompareAtMarkup(data.compare_at_markup);
      } catch { /* use defaults */ }
    };
    loadSettings();
  }, []);

  /* Generate 5 designs using Claude AI */
  const handleGenerate = async () => {
    setGenerating(true);
    setDesigns([]);
    setSelectedDesign(null);
    setPushResult(null);

    try {
      const { data } = await axios.post(
        `${API}/designs/generate`,
        { niche, product_type: productType },
        { headers: authHeaders }
      );
      setDesigns(data.designs || []);
      toast.success(`Generated ${data.designs?.length || 0} design concepts!`);
      fetchStats();
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to generate designs";
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  /* Approve design: capture mockup as PNG, then approve and push to Printify */
  const handleApprove = async (productData) => {
    // Step 1: Capture the design mockup as a base64 PNG
    let designImageBase64 = null;
    if (mockupCaptureRef.current) {
      try {
        setCapturing(true);
        toast.info("Capturing design as PNG...");
        designImageBase64 = await captureElementAsPng(mockupCaptureRef.current);
        toast.success("Design captured successfully!");
      } catch (err) {
        console.error("Failed to capture design:", err);
        toast.error("Failed to capture design image. Proceeding without image.");
      } finally {
        setCapturing(false);
      }
    }

    // Step 2: Approve the product (include the captured image)
    setApproving(true);
    try {
      const payload = {
        ...productData,
        design_image_base64: designImageBase64,
      };
      const { data } = await axios.post(`${API}/products/approve`, payload, { headers: authHeaders });
      toast.success("Design approved!");
      fetchStats();
      fetchProducts();

      // Step 3: Push to Printify (backend will upload the image first)
      try {
        setPushing(true);
        const pushResp = await axios.post(
          `${API}/products/${data.id}/push-to-printify`,
          {},
          { headers: authHeaders }
        );
        setPushResult(pushResp.data);
        toast.success("Product pushed to Printify with design image!");
        fetchStats();
        fetchProducts();
      } catch (pushErr) {
        const pushMsg = pushErr.response?.data?.detail || "Could not push to Printify";
        toast.info(pushMsg);
        setPushResult({ message: pushMsg, status: "approved_only" });
      } finally {
        setPushing(false);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to approve design");
    } finally {
      setApproving(false);
    }
  };

  const handleReject = () => {
    setSelectedDesign(null);
    setPushResult(null);
    toast("Design rejected", { description: "Select another design or generate new ones." });
  };

  return (
    <div data-testid="design-generator-page">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate("/")}
          className="p-2 rounded-xl bg-[#0B1120] border border-white/5 hover:border-white/15 transition-colors"
          data-testid="back-to-explorer-button"
        >
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </button>
        <div>
          <h1
            className="text-3xl sm:text-4xl font-black tracking-tighter text-white"
            style={{ fontFamily: "Raleway, sans-serif" }}
          >
            {niche}
          </h1>
          <p className="text-slate-400 text-sm mt-0.5" style={{ fontFamily: "Jost, sans-serif" }}>
            Generate AI-powered design concepts for this niche
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 mb-8">
        <div className="space-y-2 w-full sm:w-56">
          <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Product Type
          </Label>
          <Select value={productType} onValueChange={setProductType}>
            <SelectTrigger
              className="bg-[#0B1120] border-white/10 text-white h-11 rounded-xl"
              data-testid="product-type-dropdown"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#0B1120] border-white/10">
              {PRODUCT_TYPES.map((pt) => (
                <SelectItem key={pt} value={pt} className="text-white hover:bg-white/5">
                  {pt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={generating}
          data-testid="generate-designs-button"
          className="h-11 px-8 bg-[#3D7A5F] hover:bg-[#4F9B7A] text-white font-bold rounded-xl shadow-[0_0_15px_rgba(61,122,95,0.3)] transition-all"
        >
          {generating ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Generating...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Generate Designs
            </span>
          )}
        </Button>
      </div>

      {/* Main Content - Designs Grid + Approval Panel */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: Designs Grid */}
        <div className="flex-1">
          {/* Skeleton Loading */}
          {generating && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4" data-testid="design-loading-skeleton">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-square bg-[#0B1120] rounded-xl border border-white/5" />
                  <div className="bg-[#0B1120] border border-white/5 border-t-0 rounded-b-2xl p-4">
                    <div className="h-4 bg-white/5 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-white/5 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Generated Designs */}
          {!generating && designs.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4" data-testid="designs-grid">
              {designs.map((d, i) => (
                <DesignCard
                  key={d.id}
                  design={d}
                  productType={productType}
                  isSelected={selectedDesign?.id === d.id}
                  onSelect={setSelectedDesign}
                  index={i}
                />
              ))}
            </div>
          )}

          {/* Empty State */}
          {!generating && designs.length === 0 && (
            <div className="text-center py-20 bg-[#0B1120] border border-white/5 rounded-2xl" data-testid="empty-designs-state">
              <Sparkles className="w-10 h-10 text-[#3D7A5F]/40 mx-auto mb-4" />
              <p className="text-slate-400 text-lg mb-1">No designs yet</p>
              <p className="text-slate-500 text-sm">
                Select a product type and click "Generate Designs" to create AI concepts
              </p>
            </div>
          )}
        </div>

        {/* Right: Approval Panel or Selected Design Preview */}
        <div className="w-full lg:w-96 shrink-0">
          {selectedDesign ? (
            <>
              {/* Selected Design Preview (this is the element captured by html2canvas) */}
              <div className="mb-4">
                <DesignMockup design={selectedDesign} productType={productType} captureRef={mockupCaptureRef} />
              </div>

              {/* Image capture indicator */}
              <div className="mb-3 flex items-center gap-2 px-1">
                <Image className="w-3.5 h-3.5 text-[#3D7A5F]" strokeWidth={1.5} />
                <span className="text-xs text-slate-400">
                  Design will be captured as PNG and uploaded to Printify
                </span>
              </div>

              {/* Push Result */}
              {pushResult && (
                <div
                  className={`mb-4 p-4 rounded-xl border ${
                    pushResult.status === "pushed"
                      ? "bg-green-500/10 border-green-500/20 text-green-400"
                      : "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
                  }`}
                  data-testid="push-result"
                >
                  <p className="text-sm font-medium">{pushResult.message}</p>
                  {pushResult.printify_url && (
                    <a
                      href={pushResult.printify_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm mt-2 hover:underline"
                      data-testid="printify-link"
                    >
                      View on Printify <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}

              {/* Approval Form */}
              {!pushResult && (
                <ApprovalPanel
                  design={selectedDesign}
                  productType={productType}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  approving={approving}
                  pushing={pushing}
                  capturing={capturing}
                  prices={prices}
                  compareAtMarkup={compareAtMarkup}
                />
              )}
            </>
          ) : (
            <div className="bg-[#0B1120] border border-white/5 rounded-2xl p-8 text-center" data-testid="no-design-selected">
              <Palette className="w-10 h-10 text-[#3D7A5F]/30 mx-auto mb-4" />
              <p className="text-slate-400 text-sm">Select a design to see details and approve it</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

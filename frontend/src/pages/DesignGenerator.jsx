/**
 * DesignGenerator - Page 2 & 3 Combined
 * Shows selected niche, lets user pick product type, generate AI designs.
 * Uses GPT Image 1 to generate actual graphic design images.
 * Selecting a design opens the approval panel with editable fields.
 * Approve pushes the real AI image to Printify.
 */
import { useState, useEffect } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import axios from "axios";
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
  Loader2,
  Tag,
  DollarSign,
  Palette,
  Type,
  ExternalLink,
  Image,
  ImageOff,
} from "lucide-react";

/* ─── Design Preview Component ───────────────────────────────── */
/* Shows the AI-generated image if available, otherwise falls back to CSS mockup */
function DesignPreview({ design, productType, size = "normal", imageUrl }) {
  const colors = design?.colors || ["#1a1a2e", "#3D7A5F", "#ffffff"];
  const isSmall = size === "small";
  const hasImage = !!imageUrl;

  // If we have a real AI image, show it
  if (hasImage) {
    return (
      <div
        className={`relative overflow-hidden rounded-xl border border-white/10 ${
          isSmall ? "w-full aspect-square" : "w-full aspect-[3/4]"
        }`}
        data-testid={`design-preview-${design?.id || "preview"}`}
      >
        <img
          src={imageUrl}
          alt={design?.title || "AI Generated Design"}
          className="w-full h-full object-cover"
        />
        {/* Style badge overlay */}
        <div className="absolute bottom-3 left-3">
          <span className="text-[10px] font-semibold uppercase tracking-widest px-2 py-1 rounded-md bg-black/60 text-white backdrop-blur-sm">
            {design?.style || "Bold"}
          </span>
        </div>
        {/* AI badge */}
        <div className="absolute top-3 right-3">
          <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-md bg-[#3D7A5F]/80 text-white backdrop-blur-sm flex items-center gap-1">
            <Image className="w-2.5 h-2.5" /> AI
          </span>
        </div>
      </div>
    );
  }

  // Fallback: CSS text mockup (for designs without images)
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-white/10 ${
        isSmall ? "w-full aspect-square" : "w-full aspect-[3/4]"
      }`}
      style={{ backgroundColor: colors[0] || "#1a1a2e" }}
      data-testid={`design-preview-${design?.id || "preview"}`}
    >
      <div className="absolute inset-0 flex items-center justify-center opacity-10">
        <div className="text-[100px] font-black text-white/20" style={{ fontFamily: "Raleway" }}>
          {productType?.[0] || "T"}
        </div>
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
        <div className="absolute top-4 right-4 w-10 h-10 rounded-full opacity-30" style={{ backgroundColor: colors[2] }} />
        <p
          className={`font-black leading-tight tracking-tight ${isSmall ? "text-lg" : "text-2xl sm:text-3xl"}`}
          style={{ color: colors[1] || "#ffffff", fontFamily: "Raleway, sans-serif", textShadow: `0 2px 8px ${colors[0]}80` }}
        >
          {design?.design_text || "Design Preview"}
        </p>
        <div className={`${isSmall ? "w-8 h-0.5" : "w-16 h-1"} rounded-full mt-3`} style={{ backgroundColor: colors[2] }} />
      </div>
      <div className="absolute bottom-3 left-3">
        <span className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-md flex items-center gap-1" style={{ backgroundColor: `${colors[1]}20`, color: colors[1] }}>
          <ImageOff className="w-2.5 h-2.5" /> {design?.style || "Bold"}
        </span>
      </div>
    </div>
  );
}

/* ─── Design Card ──────────────────────────────────────────── */
function DesignCard({ design, productType, isSelected, onSelect, index, imageUrl }) {
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
      <DesignPreview design={design} productType={productType} size="small" imageUrl={imageUrl} />
      <div className="bg-[#0B1120] border border-white/5 border-t-0 rounded-b-2xl p-4">
        <h4 className="text-sm font-bold text-white truncate mb-1" style={{ fontFamily: "Raleway" }}>
          {design.title}
        </h4>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {(design.colors || []).map((c, i) => (
              <div key={i} className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: c }} />
            ))}
          </div>
          <span className="text-[11px] text-slate-500">{design.style}</span>
          {design.has_image && (
            <span className="text-[9px] text-[#3D7A5F] font-semibold uppercase ml-auto">AI Image</span>
          )}
        </div>
      </div>
    </button>
  );
}

/* ─── Approval Panel (Right Side) ────────────────────────────── */
function ApprovalPanel({ design, productType, onApprove, onReject, approving, pushing, prices, compareAtMarkup }) {
  const basePrice = getPriceForProduct(productType, prices);
  const compareAt = getCompareAtPrice(basePrice, compareAtMarkup);

  const [title, setTitle] = useState(design?.title || "");
  const [description, setDescription] = useState(design?.description || "");
  const [tags, setTags] = useState((design?.tags || []).join(", "));
  const [selectedType, setSelectedType] = useState(productType);
  const [sellingPrice, setSellingPrice] = useState(basePrice);
  const [compareAtPrice, setCompareAtPrice] = useState(compareAt);
  const [selectedVariants, setSelectedVariants] = useState(["Black", "White"]);

  useEffect(() => {
    const newPrice = getPriceForProduct(selectedType, prices);
    setSellingPrice(newPrice);
    setCompareAtPrice(getCompareAtPrice(newPrice, compareAtMarkup));
  }, [selectedType, prices, compareAtMarkup]);

  const toggleVariant = (v) => {
    setSelectedVariants((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]);
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
      <h3 className="text-xl font-bold text-white mb-6 tracking-tight" style={{ fontFamily: "Raleway" }}>
        Approve & Push
      </h3>

      <ScrollArea className="h-[calc(100vh-420px)] pr-2">
        <div className="space-y-5">
          {/* Product Title */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 flex items-center gap-1.5">
              <Type className="w-3 h-3" /> Product Title
            </Label>
            <Input data-testid="product-title-input" value={title} onChange={(e) => setTitle(e.target.value)}
              className="bg-[#050814] border-white/10 text-white h-11 rounded-xl focus:ring-2 focus:ring-[#3D7A5F]" />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">SEO Description</Label>
            <Textarea data-testid="product-description-input" value={description} onChange={(e) => setDescription(e.target.value)}
              rows={3} className="bg-[#050814] border-white/10 text-white rounded-xl focus:ring-2 focus:ring-[#3D7A5F] resize-none" />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 flex items-center gap-1.5">
              <Tag className="w-3 h-3" /> Tags (comma separated)
            </Label>
            <Input data-testid="product-tags-input" value={tags} onChange={(e) => setTags(e.target.value)}
              className="bg-[#050814] border-white/10 text-white h-11 rounded-xl focus:ring-2 focus:ring-[#3D7A5F]" />
          </div>

          {/* Product Type */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Product Type</Label>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="bg-[#050814] border-white/10 text-white h-11 rounded-xl" data-testid="product-type-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0B1120] border-white/10">
                {PRODUCT_TYPES.map((pt) => (
                  <SelectItem key={pt} value={pt} className="text-white hover:bg-white/5">{pt}</SelectItem>
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
              <Input data-testid="selling-price-input" type="number" step="0.01" value={sellingPrice}
                onChange={(e) => { const val = parseFloat(e.target.value); setSellingPrice(val); setCompareAtPrice(getCompareAtPrice(val, compareAtMarkup)); }}
                className="bg-[#050814] border-white/10 text-white h-11 rounded-xl focus:ring-2 focus:ring-[#3D7A5F]" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Compare-at Price</Label>
              <Input data-testid="compare-at-price-input" type="number" step="0.01" value={compareAtPrice}
                onChange={(e) => setCompareAtPrice(parseFloat(e.target.value))}
                className="bg-[#050814] border-white/10 text-slate-400 line-through h-11 rounded-xl" />
            </div>
          </div>

          {/* Color Variants */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 flex items-center gap-1.5">
              <Palette className="w-3 h-3" /> Color Variants
            </Label>
            <div className="flex flex-wrap gap-2">
              {COLOR_VARIANTS.map((v) => (
                <button key={v} onClick={() => toggleVariant(v)}
                  data-testid={`variant-${v.toLowerCase().replace(/\s+/g, "-")}`}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    selectedVariants.includes(v)
                      ? "bg-[#3D7A5F]/20 text-[#3D7A5F] border border-[#3D7A5F]/30"
                      : "bg-[#050814] text-slate-400 border border-white/5 hover:border-white/15"
                  }`}
                >{v}</button>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Action Buttons */}
      <div className="flex gap-3 mt-6 pt-5 border-t border-white/5">
        <Button onClick={handleApprove} disabled={approving || pushing}
          data-testid="approve-push-button"
          className="flex-1 h-11 bg-[#3D7A5F] hover:bg-[#4F9B7A] text-white font-bold rounded-xl shadow-[0_0_15px_rgba(61,122,95,0.3)] transition-all"
        >
          {approving ? (
            <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Approving...</span>
          ) : pushing ? (
            <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Pushing to Printify...</span>
          ) : (
            <span className="flex items-center gap-2"><Check className="w-4 h-4" /> Approve & Push</span>
          )}
        </Button>
        <Button onClick={onReject} variant="ghost" data-testid="reject-button"
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
  const [genProgress, setGenProgress] = useState("");
  const [approving, setApproving] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [prices, setPrices] = useState(DEFAULT_PRICES);
  const [compareAtMarkup, setCompareAtMarkup] = useState(20);
  const [pushResult, setPushResult] = useState(null);
  // Map of design_id -> data:image/png;base64,... URLs (loaded individually)
  const [designImages, setDesignImages] = useState({});

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

  /* Generate 5 designs with AI images using Claude + GPT Image 1 */
  const handleGenerate = async () => {
    setGenerating(true);
    setDesigns([]);
    setSelectedDesign(null);
    setPushResult(null);
    setDesignImages({});
    setGenProgress("Generating design concepts with Claude AI...");

    try {
      const { data } = await axios.post(
        `${API}/designs/generate`,
        { niche, product_type: productType },
        { headers: authHeaders, timeout: 120000 }
      );

      const receivedDesigns = data.designs || [];
      setDesigns(receivedDesigns);
      toast.success(`Generated ${receivedDesigns.length} design concepts! AI images rendering in background...`);
      fetchStats();

      // Start polling for images as they generate in the background
      if (data.images_generating) {
        receivedDesigns.forEach((d) => {
          pollForImage(d.id);
        });
      }
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to generate designs";
      toast.error(msg);
    } finally {
      setGenerating(false);
      setGenProgress("");
    }
  };

  /* Poll for a single design's image until it's ready */
  const pollForImage = async (designId) => {
    const maxAttempts = 20; // 20 x 5s = 100s max
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((r) => setTimeout(r, 5000)); // wait 5s between polls
      try {
        const { data } = await axios.get(`${API}/designs/${designId}/image`, { headers: authHeaders });
        if (data.image_base64) {
          setDesignImages((prev) => ({
            ...prev,
            [designId]: `data:image/png;base64,${data.image_base64}`,
          }));
          // Update the design's has_image flag in state
          setDesigns((prev) =>
            prev.map((d) => d.id === designId ? { ...d, has_image: true, image_status: "ready" } : d)
          );
          return; // Image is ready, stop polling
        }
      } catch {
        // Image not ready yet, keep polling
      }
    }
  };

  /* Approve design: backend fetches the AI image from DB and pushes to Printify */
  const handleApprove = async (productData) => {
    setApproving(true);
    try {
      // No need to send image_base64 — backend fetches it from design_images collection
      const payload = {
        ...productData,
        design_image_base64: null,
      };
      const { data } = await axios.post(`${API}/products/approve`, payload, { headers: authHeaders });
      toast.success("Design approved!");
      fetchStats();
      fetchProducts();

      // Push to Printify (backend will upload the real AI image)
      try {
        setPushing(true);
        const pushResp = await axios.post(
          `${API}/products/${data.id}/push-to-printify`,
          {},
          { headers: authHeaders, timeout: 120000 }
        );
        setPushResult(pushResp.data);
        toast.success(pushResp.data.has_design_image
          ? "Product pushed to Printify with AI design image!"
          : "Product pushed to Printify!");
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
        <button onClick={() => navigate("/")}
          className="p-2 rounded-xl bg-[#0B1120] border border-white/5 hover:border-white/15 transition-colors"
          data-testid="back-to-explorer-button"
        >
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </button>
        <div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-white" style={{ fontFamily: "Raleway, sans-serif" }}>
            {niche}
          </h1>
          <p className="text-slate-400 text-sm mt-0.5" style={{ fontFamily: "Jost, sans-serif" }}>
            Generate AI-powered graphic designs for this niche
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 mb-8">
        <div className="space-y-2 w-full sm:w-56">
          <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Product Type</Label>
          <Select value={productType} onValueChange={setProductType}>
            <SelectTrigger className="bg-[#0B1120] border-white/10 text-white h-11 rounded-xl" data-testid="product-type-dropdown">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#0B1120] border-white/10">
              {PRODUCT_TYPES.map((pt) => (
                <SelectItem key={pt} value={pt} className="text-white hover:bg-white/5">{pt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleGenerate} disabled={generating} data-testid="generate-designs-button"
          className="h-11 px-8 bg-[#3D7A5F] hover:bg-[#4F9B7A] text-white font-bold rounded-xl shadow-[0_0_15px_rgba(61,122,95,0.3)] transition-all"
        >
          {generating ? (
            <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Generating...</span>
          ) : (
            <span className="flex items-center gap-2"><Sparkles className="w-4 h-4" /> Generate Designs</span>
          )}
        </Button>
      </div>

      {/* Main Content - Designs Grid + Approval Panel */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: Designs Grid */}
        <div className="flex-1">
          {/* Loading */}
          {generating && (
            <div data-testid="design-loading-skeleton">
              <div className="mb-6 p-4 rounded-xl bg-[#0B1120] border border-[#3D7A5F]/20 animate-pulse-glow">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-[#3D7A5F] animate-spin" />
                  <div>
                    <p className="text-sm text-white font-medium" data-testid="generation-progress">Generating design concepts with Claude AI...</p>
                    <p className="text-xs text-slate-500 mt-0.5">Design concepts appear first, AI images render in background</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
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
            </div>
          )}

          {/* Generated Designs */}
          {!generating && designs.length > 0 && (
            <>
              {/* Show banner while images are still generating in the background */}
              {designs.some((d) => d.image_status === "generating" && !designImages[d.id]) && (
                <div className="mb-4 p-3 rounded-xl bg-[#0B1120] border border-[#3D7A5F]/20 flex items-center gap-3" data-testid="images-generating-banner">
                  <Loader2 className="w-4 h-4 text-[#3D7A5F] animate-spin shrink-0" />
                  <p className="text-xs text-slate-400">
                    <span className="text-[#3D7A5F] font-medium">AI images rendering...</span> Design cards will update automatically as each image is ready
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4" data-testid="designs-grid">
                {designs.map((d, i) => (
                  <DesignCard key={d.id} design={d} productType={productType}
                    isSelected={selectedDesign?.id === d.id} onSelect={setSelectedDesign} index={i}
                    imageUrl={designImages[d.id]} />
                ))}
              </div>
            </>
          )}

          {/* Empty State */}
          {!generating && designs.length === 0 && (
            <div className="text-center py-20 bg-[#0B1120] border border-white/5 rounded-2xl" data-testid="empty-designs-state">
              <Sparkles className="w-10 h-10 text-[#3D7A5F]/40 mx-auto mb-4" />
              <p className="text-slate-400 text-lg mb-1">No designs yet</p>
              <p className="text-slate-500 text-sm">
                Select a product type and click "Generate Designs" to create AI graphic designs
              </p>
            </div>
          )}
        </div>

        {/* Right: Approval Panel or Selected Design Preview */}
        <div className="w-full lg:w-96 shrink-0">
          {selectedDesign ? (
            <>
              {/* Selected Design Full Preview */}
              <div className="mb-4">
                <DesignPreview design={selectedDesign} productType={productType} imageUrl={designImages[selectedDesign.id]} />
              </div>

              {/* Image status */}
              <div className="mb-3 flex items-center gap-2 px-1">
                {designImages[selectedDesign.id] ? (
                  <>
                    <Image className="w-3.5 h-3.5 text-[#3D7A5F]" strokeWidth={1.5} />
                    <span className="text-xs text-[#3D7A5F] font-medium">
                      AI-generated image ready for Printify
                    </span>
                  </>
                ) : selectedDesign.has_image ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 text-[#3D7A5F] animate-spin" strokeWidth={1.5} />
                    <span className="text-xs text-slate-400">
                      Loading AI image...
                    </span>
                  </>
                ) : (
                  <>
                    <ImageOff className="w-3.5 h-3.5 text-yellow-500" strokeWidth={1.5} />
                    <span className="text-xs text-yellow-500">
                      No image generated — CSS preview only
                    </span>
                  </>
                )}
              </div>

              {/* Push Result */}
              {pushResult && (
                <div className={`mb-4 p-4 rounded-xl border ${
                  pushResult.status === "pushed"
                    ? "bg-green-500/10 border-green-500/20 text-green-400"
                    : "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
                }`} data-testid="push-result">
                  <p className="text-sm font-medium">{pushResult.message}</p>
                  {pushResult.printify_url && (
                    <a href={pushResult.printify_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm mt-2 hover:underline" data-testid="printify-link">
                      View on Printify <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}

              {/* Approval Form */}
              {!pushResult && (
                <ApprovalPanel design={selectedDesign} productType={productType}
                  onApprove={handleApprove} onReject={handleReject}
                  approving={approving} pushing={pushing} prices={prices} compareAtMarkup={compareAtMarkup} />
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

/**
 * ThreadlyCo Design Studio - Centralized Configuration
 * ====================================================
 * Edit prices, margins, discount codes, and product types here.
 * All settings can also be changed from the Settings page in the app.
 * This file serves as the initial defaults before any DB settings are loaded.
 */

// Default selling prices per product type (in USD)
export const DEFAULT_PRICES = {
  "T-Shirt": 24.99,
  "Hoodie": 54.99,
  "Sweatshirt": 44.99,
  "Tank Top": 21.99,
  "Cap": 27.99,
  "Tote Bag": 21.99,
  "Mug": 19.99,
  "Phone Case": 27.99,
};

// Product types available in the dropdown
export const PRODUCT_TYPES = [
  "T-Shirt",
  "Hoodie",
  "Sweatshirt",
  "Tank Top",
  "Cap",
  "Tote Bag",
  "Mug",
  "Phone Case",
];

// Compare-at price markup percentage (20% = original price is 20% above selling price)
export const DEFAULT_COMPARE_AT_MARKUP = 20;

// Default promo code settings
export const DEFAULT_PROMO = {
  code: "",          // e.g. "LAUNCH20"
  percentage: 0,     // e.g. 20 for 20% off
};

// Available color variants for products
export const COLOR_VARIANTS = [
  "Black",
  "White",
  "Navy",
  "Heather Gray",
  "Forest Green",
  "Burgundy",
  "Royal Blue",
  "Charcoal",
];

// Design styles used in generation
export const DESIGN_STYLES = [
  "Bold",
  "Minimal",
  "Vintage",
  "Retro",
  "Grunge",
  "Elegant",
  "Playful",
];

// Heat level configuration for niche filtering
export const HEAT_LEVELS = {
  Hot: { color: "#EF4444", label: "Hot" },
  Rising: { color: "#F59E0B", label: "Rising" },
  Steady: { color: "#3B82F6", label: "Steady" },
};

// Printify API endpoints (update here if Printify changes their API)
export const PRINTIFY_ENDPOINTS = {
  BASE_URL: "https://api.printify.com/v1",
  SHOPS: "/shops.json",
  BLUEPRINTS: "/catalog/blueprints.json",
  CREATE_PRODUCT: (shopId) => `/shops/${shopId}/products.json`,
  PUBLISH_PRODUCT: (shopId, productId) =>
    `/shops/${shopId}/products/${productId}/publish.json`,
};

// Helper: Calculate compare-at (original) price from selling price
export const getCompareAtPrice = (sellingPrice, markupPercent = DEFAULT_COMPARE_AT_MARKUP) => {
  return Math.round(sellingPrice * (1 + markupPercent / 100) * 100) / 100;
};

// Helper: Get price for a product type
export const getPriceForProduct = (productType, pricesOverride = null) => {
  const prices = pricesOverride || DEFAULT_PRICES;
  return prices[productType] || 24.99;
};

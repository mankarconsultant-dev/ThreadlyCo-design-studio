# ThreadlyCo Design Studio - PRD

## Original Problem Statement
Build a full-stack internal tool web app called "ThreadlyCo Design Studio" for a print-on-demand clothing brand. Helps the owner find trending niches, generate AI designs with Claude, and push approved products to Printify.

## Architecture
- **Backend**: FastAPI + MongoDB + Emergent LLM (Claude Sonnet 4) + Printify API
- **Frontend**: React + Tailwind CSS + Shadcn/UI components
- **Auth**: JWT-based password login (admin only)
- **Database**: MongoDB (niches, designs, products, settings, stats, users)

## User Personas
- **Brand Owner (Admin)**: Internal user who discovers niches, generates designs, approves products, and pushes to Printify

## Core Requirements
1. Trend Explorer with niche discovery and heat filters
2. AI Design Generator using Claude API
3. Approve & Push to Printify workflow
4. Settings page for API keys, pricing, discounts
5. Stats Dashboard
6. Simple password auth

## What's Been Implemented (April 13, 2026)
- Login page with JWT auth and admin seed
- Trend Explorer with 16 pre-populated Gen Z/Alpha niches
- Search and heat level filters (All/Hot/Rising/Steady)
- Design Generator with Claude AI integration (5 designs per generation)
- CSS-based product mockup previews
- Approval panel with editable title, description, tags, pricing
- Compare-at price logic (20% markup)
- Push to Printify integration (requires API key in Settings)
- Settings page: Printify API key, Shop ID, pricing editor, promo codes, compare-at markup
- Stats Dashboard (designs generated, approved, pushed, live)
- Product log in sidebar
- Dark theme with forest green accent, Raleway + Jost fonts
- config.js for centralized pricing/settings
- Mobile responsive

## Prioritized Backlog
- P0: All core features implemented
- P1: Real Printify API key testing (user to add)
- P2: Image upload for custom design art, product image overlays
- P2: Bulk design generation and batch approval
- P3: Export product data as CSV, analytics dashboard

## Next Tasks
1. User adds Printify API key in Settings to test real product pushing
2. Add more niche categories as trends evolve
3. Consider adding design history/favorites
4. Add product image generation via AI image tools

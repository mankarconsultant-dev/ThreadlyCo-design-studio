"""
ThreadlyCo Design Studio - Backend Server
==========================================
Main FastAPI server for the print-on-demand design studio.
Handles auth, niche management, AI design generation, Printify integration, and settings.
"""

from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os
import logging
import bcrypt
import jwt
import json
import uuid
import httpx
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field
from typing import List, Optional
from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration
import base64
import asyncio

# ─── Configuration ───────────────────────────────────────────────
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'admin@threadlyco.com')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'ThreadlyAdmin2024!')

# ─── MongoDB Setup ───────────────────────────────────────────────
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# ─── App Setup ───────────────────────────────────────────────────
app = FastAPI(title="ThreadlyCo Design Studio API")
api_router = APIRouter(prefix="/api")

# ─── Logging ─────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ─── Pydantic Models ────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str

class SettingsUpdate(BaseModel):
    printify_api_key: Optional[str] = None
    printify_shop_id: Optional[str] = None
    promo_code: Optional[str] = None
    promo_percentage: Optional[float] = None
    compare_at_markup: Optional[float] = None
    prices: Optional[dict] = None

class GenerateDesignsRequest(BaseModel):
    niche: str
    product_type: str

class ApproveProductRequest(BaseModel):
    design: dict
    product_title: str
    product_description: str
    tags: List[str]
    product_type: str
    selling_price: float
    compare_at_price: float
    variants: Optional[List[str]] = None
    design_image_base64: Optional[str] = None  # Base64 PNG captured from the CSS mockup

class NicheCreate(BaseModel):
    name: str
    heat_level: str = "Steady"
    description: str = ""
    audience: str = ""

# ─── Password Helpers ────────────────────────────────────────────

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

# ─── JWT Helpers ─────────────────────────────────────────────────

def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id, "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=24),
        "type": "access"
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh"
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

# ─── Auth Dependency ─────────────────────────────────────────────

async def get_current_user(request: Request) -> dict:
    """Extract and verify JWT from cookie or Authorization header."""
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ─── Pre-populated Niches ───────────────────────────────────────

DEFAULT_NICHES = [
    {"id": str(uuid.uuid4()), "name": "Dark Humor", "heat_level": "Hot", "description": "Edgy, satirical designs that resonate with Gen Z's ironic sensibility", "audience": "Gen Z, 16-24"},
    {"id": str(uuid.uuid4()), "name": "Anime & Manga", "heat_level": "Hot", "description": "Japanese animation inspired art, characters, and typography", "audience": "Gen Z & Gen Alpha, 12-25"},
    {"id": str(uuid.uuid4()), "name": "Gym Motivation", "heat_level": "Hot", "description": "Bold fitness quotes, lifting culture, and bodybuilding aesthetics", "audience": "Gen Z, 18-28"},
    {"id": str(uuid.uuid4()), "name": "Mental Health", "heat_level": "Rising", "description": "Self-care, therapy culture, and mental wellness awareness designs", "audience": "Gen Z, 16-26"},
    {"id": str(uuid.uuid4()), "name": "Astrology", "heat_level": "Rising", "description": "Zodiac signs, birth charts, and celestial-themed artwork", "audience": "Gen Z, 18-28"},
    {"id": str(uuid.uuid4()), "name": "Y2K Aesthetic", "heat_level": "Rising", "description": "Early 2000s nostalgia with butterfly clips, chrome, and pastel vibes", "audience": "Gen Z & Gen Alpha, 14-24"},
    {"id": str(uuid.uuid4()), "name": "Cottagecore", "heat_level": "Steady", "description": "Rural, pastoral, and cozy nature-inspired romantic designs", "audience": "Gen Z, 16-26"},
    {"id": str(uuid.uuid4()), "name": "Gaming Culture", "heat_level": "Hot", "description": "Esports, retro gaming, controller art, and gamer slang", "audience": "Gen Z & Gen Alpha, 12-28"},
    {"id": str(uuid.uuid4()), "name": "Streetwear", "heat_level": "Hot", "description": "Urban fashion-forward designs with bold graphics and typography", "audience": "Gen Z, 16-28"},
    {"id": str(uuid.uuid4()), "name": "Meme Culture", "heat_level": "Hot", "description": "Internet humor, viral references, and self-deprecating comedy", "audience": "Gen Z & Gen Alpha, 14-26"},
    {"id": str(uuid.uuid4()), "name": "Crypto & Web3", "heat_level": "Rising", "description": "Blockchain culture, WAGMI vibes, and decentralized aesthetics", "audience": "Gen Z, 18-30"},
    {"id": str(uuid.uuid4()), "name": "K-Pop & K-Culture", "heat_level": "Rising", "description": "Korean pop music fan art, Hangul typography, and idol aesthetics", "audience": "Gen Z & Gen Alpha, 12-26"},
    {"id": str(uuid.uuid4()), "name": "Minimalist Typography", "heat_level": "Steady", "description": "Clean, simple text-based designs with powerful one-liners", "audience": "Gen Z, 18-30"},
    {"id": str(uuid.uuid4()), "name": "Retro Futurism", "heat_level": "Rising", "description": "Synthwave, vaporwave, and neon-drenched 80s-meets-future aesthetics", "audience": "Gen Z, 16-28"},
    {"id": str(uuid.uuid4()), "name": "Skateboard Culture", "heat_level": "Steady", "description": "Punk-inspired skate graphics, DIY aesthetic, and counter-culture vibes", "audience": "Gen Z & Gen Alpha, 12-24"},
    {"id": str(uuid.uuid4()), "name": "Bookish & Romantasy", "heat_level": "Rising", "description": "Book lover aesthetics, fantasy romance, and literary quotes", "audience": "Gen Z, 16-28"},
]

# ─── Default Pricing Config ─────────────────────────────────────

DEFAULT_PRICES = {
    "T-Shirt": 24.99,
    "Hoodie": 54.99,
    "Sweatshirt": 44.99,
    "Tank Top": 21.99,
    "Cap": 27.99,
    "Tote Bag": 21.99,
    "Mug": 19.99,
    "Phone Case": 27.99
}

# ─── Startup Events ─────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    """Seed admin user and default settings on startup."""
    # Create indexes
    await db.users.create_index("email", unique=True)

    # Seed admin user
    existing = await db.users.find_one({"email": ADMIN_EMAIL})
    if existing is None:
        hashed = hash_password(ADMIN_PASSWORD)
        await db.users.insert_one({
            "email": ADMIN_EMAIL,
            "password_hash": hashed,
            "name": "Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        logger.info(f"Admin user created: {ADMIN_EMAIL}")
    elif not verify_password(ADMIN_PASSWORD, existing["password_hash"]):
        await db.users.update_one(
            {"email": ADMIN_EMAIL},
            {"$set": {"password_hash": hash_password(ADMIN_PASSWORD)}}
        )
        logger.info("Admin password updated")

    # Seed default settings if not exist
    settings = await db.settings.find_one({"type": "global"}, {"_id": 0})
    if not settings:
        await db.settings.insert_one({
            "type": "global",
            "printify_api_key": "",
            "printify_shop_id": "",
            "promo_code": "",
            "promo_percentage": 0,
            "compare_at_markup": 20,  # 20% above selling price
            "prices": DEFAULT_PRICES,
            "updated_at": datetime.now(timezone.utc).isoformat()
        })
        logger.info("Default settings created")

    # Seed default niches if empty
    niche_count = await db.niches.count_documents({})
    if niche_count == 0:
        for niche in DEFAULT_NICHES:
            await db.niches.insert_one(niche)
        logger.info(f"Seeded {len(DEFAULT_NICHES)} default niches")

    # Write test credentials
    creds_dir = Path("/app/memory")
    creds_dir.mkdir(exist_ok=True)
    with open(creds_dir / "test_credentials.md", "w") as f:
        f.write("# Test Credentials\n\n")
        f.write(f"## Admin\n- Email: {ADMIN_EMAIL}\n- Password: {ADMIN_PASSWORD}\n- Role: admin\n\n")
        f.write("## Auth Endpoints\n- POST /api/auth/login\n- POST /api/auth/logout\n- GET /api/auth/me\n")

# ─── AUTH ROUTES ─────────────────────────────────────────────────

@api_router.post("/auth/login")
async def login(req: LoginRequest, response: Response):
    """Login with email and password. Returns user data and sets JWT cookies."""
    email = req.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)

    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=86400, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")

    return {
        "id": user_id,
        "email": user["email"],
        "name": user.get("name", ""),
        "role": user.get("role", "user"),
        "token": access_token
    }

@api_router.post("/auth/logout")
async def logout(response: Response):
    """Clear auth cookies."""
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Logged out"}

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    """Get current authenticated user."""
    return {"id": user["_id"], "email": user["email"], "name": user.get("name", ""), "role": user.get("role", "")}

# ─── NICHES ROUTES ───────────────────────────────────────────────

@api_router.get("/niches")
async def get_niches(user: dict = Depends(get_current_user)):
    """Get all trending niches."""
    niches = await db.niches.find({}, {"_id": 0}).to_list(100)
    return niches

@api_router.post("/niches")
async def create_niche(niche: NicheCreate, user: dict = Depends(get_current_user)):
    """Add a custom niche."""
    niche_dict = niche.model_dump()
    niche_dict["id"] = str(uuid.uuid4())
    niche_dict["custom"] = True
    await db.niches.insert_one(niche_dict)
    niche_dict.pop("_id", None)
    return niche_dict

# ─── DESIGN GENERATION ROUTES ───────────────────────────────────

@api_router.post("/designs/generate")
async def generate_designs(req: GenerateDesignsRequest, user: dict = Depends(get_current_user)):
    """
    Phase 1: Generate 5 design concepts using Claude AI (fast, ~15s).
    Returns concepts immediately. Then kicks off background image generation.
    Frontend polls /api/designs/{id}/image to check when images are ready.
    """
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="AI API key not configured")

    prompt = f"""You are a professional print-on-demand designer specializing in Gen Z and Gen Alpha trends.

Generate exactly 5 unique design concepts for a {req.product_type} in the "{req.niche}" niche.

Return ONLY valid JSON array with exactly 5 objects. Each object must have:
- "title": catchy product title (max 60 chars)
- "description": SEO-optimized product description (2-3 sentences)
- "design_text": the main text/slogan on the design (max 30 chars)
- "font_style": font style recommendation (e.g. "Bold Sans-Serif", "Handwritten Script", "Retro Block")
- "colors": array of 3 hex color codes used in the design [background, primary, accent]
- "layout": layout description (e.g. "Centered text with graphic below", "Diagonal text overlay")
- "mood": design mood (e.g. "Edgy", "Playful", "Minimalist", "Vintage", "Bold")
- "style": design style category ("Bold", "Minimal", "Vintage", "Retro", "Grunge", "Elegant", "Playful")
- "tags": array of 5 relevant SEO tags
- "image_prompt": a detailed prompt to generate the actual graphic design image (describe the visual: artwork style, graphic elements, text placement, color palette, mood). This should be a complete image generation prompt that creates a print-ready design for a {req.product_type}.

Return ONLY the JSON array, no markdown, no explanation."""

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"design-gen-{uuid.uuid4()}",
            system_message="You are a design generation AI. Return only valid JSON arrays."
        )
        chat.with_model("anthropic", "claude-4-sonnet-20250514")

        user_message = UserMessage(text=prompt)
        response_text = await chat.send_message(user_message)

        cleaned = response_text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()
        if cleaned.startswith("json"):
            cleaned = cleaned[4:].strip()

        designs = json.loads(cleaned)

        for i, design in enumerate(designs):
            design["id"] = str(uuid.uuid4())
            design["niche"] = req.niche
            design["product_type"] = req.product_type
            design["created_at"] = datetime.now(timezone.utc).isoformat()
            design["has_image"] = False  # Will be set to True when background job completes
            design["image_status"] = "generating"  # generating | ready | failed

        # Store designs in DB
        for d in designs:
            await db.designs.insert_one({**d})

        await db.stats.update_one(
            {"type": "global"},
            {"$inc": {"total_generated": len(designs)}},
            upsert=True
        )

        # Remove _id from response
        for d in designs:
            d.pop("_id", None)

        # ─── Kick off background image generation ────────────────────
        design_ids_and_prompts = []
        for d in designs:
            design_ids_and_prompts.append({
                "id": d["id"],
                "title": d["title"],
                "image_prompt": d.get("image_prompt", ""),
                "style": d.get("style", "Bold"),
                "mood": d.get("mood", "modern"),
                "design_text": d.get("design_text", ""),
                "colors": d.get("colors", ["#000", "#fff"]),
                "layout": d.get("layout", ""),
                "product_type": req.product_type,
            })

        # Fire and forget background task
        asyncio.create_task(
            _generate_images_background(design_ids_and_prompts)
        )

        logger.info(f"Returned {len(designs)} design concepts. Image generation started in background.")
        return {"designs": designs, "images_generating": True}

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse AI response: {e}")
        raise HTTPException(status_code=500, detail="Failed to parse AI-generated designs")
    except Exception as e:
        logger.error(f"Design generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Design generation failed: {str(e)}")


async def _remove_background(image_bytes: bytes) -> bytes:
    """Remove background from image using Remove.bg API. Falls back to original if it fails."""
    removebg_api_key = os.environ.get('REMOVEBG_API_KEY', '')
    if not removebg_api_key:
        logger.warning("REMOVEBG_API_KEY not set - skipping background removal")
        return image_bytes

    try:
        async with httpx.AsyncClient(timeout=30) as client_http:
            resp = await client_http.post(
                "https://api.remove.bg/v1.0/removebg",
                headers={"X-Api-Key": removebg_api_key},
                files={"image_file": ("design.png", image_bytes, "image/png")},
                data={"size": "auto", "format": "png"}
            )
            if resp.status_code == 200:
                logger.info("Background removed successfully")
                return resp.content  # Returns PNG with transparent background
            else:
                logger.warning(f"Remove.bg failed: {resp.status_code} - {resp.text[:200]}")
                return image_bytes  # Fall back to original
    except Exception as e:
        logger.error(f"Background removal error: {e}")
        return image_bytes  # Fall back to original
async def _generate_images_background(design_items: list):
    """Background task: generate AI images for each design and store in MongoDB."""
    logger.info(f"Background: Starting image generation for {len(design_items)} designs...")
    image_gen = OpenAIImageGeneration(api_key=EMERGENT_LLM_KEY)

    async def generate_one(item):
        design_id = item["id"]
        try:
            img_prompt = item.get("image_prompt", "")
            if not img_prompt:
                img_prompt = f"A {item['style']} graphic design for a {item['product_type']} with the text '{item['design_text']}'. Style: {item['mood']}. Colors: {', '.join(item['colors'])}. {item['layout']}."

            full_prompt = f"Create a professional print-on-demand {item['product_type']} graphic design. {img_prompt}. The design should be print-ready, high contrast, centered composition, suitable for fabric/product printing. IMPORTANT: Transparent background, no background at all. Just the design artwork isolated with no background."
            images = await image_gen.generate_images(
                prompt=full_prompt,
                model="gpt-image-1",
                number_of_images=1
            )
            if images and len(images) > 0:
                # Remove background before storing
                image_bytes = await _remove_background(images[0])
                img_b64 = base64.b64encode(image_bytes).decode('utf-8')
                await db.design_images.insert_one({
                    "design_id": design_id,
                    "image_base64": img_b64,
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
                await db.designs.update_one(
                    {"id": design_id},
                    {"$set": {"has_image": True, "image_status": "ready"}}
                )
                logger.info(f"Background: Image ready for '{item['title']}'")
            else:
                await db.designs.update_one(
                    {"id": design_id},
                    {"$set": {"image_status": "failed"}}
                )
        except Exception as e:
            logger.error(f"Background: Image failed for '{item['title']}': {e}")
            await db.designs.update_one(
                {"id": design_id},
                {"$set": {"image_status": "failed"}}
            )

    await asyncio.gather(*[generate_one(item) for item in design_items])
    logger.info("Background: All image generation complete.")

# ─── DESIGN IMAGE ENDPOINT ──────────────────────────────────────

@api_router.get("/designs/{design_id}/image")
async def get_design_image(design_id: str, user: dict = Depends(get_current_user)):
    """Serve a design's AI-generated image as base64. Used by frontend to load images individually."""
    img_doc = await db.design_images.find_one({"design_id": design_id}, {"_id": 0})
    if not img_doc or not img_doc.get("image_base64"):
        raise HTTPException(status_code=404, detail="Image not found for this design")
    return {"design_id": design_id, "image_base64": img_doc["image_base64"]}

# ─── PRODUCT / PRINTIFY ROUTES ──────────────────────────────────

@api_router.post("/products/approve")
async def approve_product(req: ApproveProductRequest, user: dict = Depends(get_current_user)):
    """Approve a design and store it. Fetches the AI image from DB for Printify upload."""
    # If no image provided in request, try to fetch from design_images collection
    image_b64 = req.design_image_base64
    if not image_b64 and req.design.get("id"):
        img_doc = await db.design_images.find_one({"design_id": req.design["id"]}, {"_id": 0})
        if img_doc:
            image_b64 = img_doc.get("image_base64")

    product = {
        "id": str(uuid.uuid4()),
        "design": req.design,
        "product_title": req.product_title,
        "product_description": req.product_description,
        "tags": req.tags,
        "product_type": req.product_type,
        "selling_price": req.selling_price,
        "compare_at_price": req.compare_at_price,
        "variants": req.variants or [],
        "design_image_base64": image_b64,
        "has_design_image": image_b64 is not None,
        "status": "approved",
        "printify_product_id": None,
        "printify_image_id": None,
        "printify_url": None,
        "approved_at": datetime.now(timezone.utc).isoformat(),
        "approved_by": user["_id"]
    }

    await db.products.insert_one({**product})
    await db.stats.update_one(
        {"type": "global"},
        {"$inc": {"total_approved": 1}},
        upsert=True
    )

    product.pop("_id", None)
    # Don't return the large base64 in the approval response
    product.pop("design_image_base64", None)
    return product

@api_router.post("/products/{product_id}/push-to-printify")
async def push_to_printify(product_id: str, user: dict = Depends(get_current_user)):
    """
    Push an approved product to Printify with the actual design image.
    Flow: Upload design PNG → Create product with image → Publish product.
    """
    # Get settings for Printify credentials
    settings = await db.settings.find_one({"type": "global"}, {"_id": 0})
    if not settings or not settings.get("printify_api_key") or not settings.get("printify_shop_id"):
        raise HTTPException(status_code=400, detail="Printify API key and Shop ID required. Configure them in Settings.")

    # Get the product from DB
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    api_key = settings["printify_api_key"]
    shop_id = settings["printify_shop_id"]
    base_url = "https://api.printify.com/v1"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    # Map product types to Printify blueprint IDs (common ones)
    blueprint_map = {
        "T-Shirt": 5,
        "Hoodie": 77,
        "Sweatshirt": 175,
        "Tank Top": 163,
        "Cap": 462,
        "Tote Bag": 234,
        "Mug": 68,
        "Phone Case": 20
    }

    blueprint_id = blueprint_map.get(product["product_type"], 5)

    # Calculate prices in cents
    selling_price_cents = int(product["selling_price"] * 100)

    try:
        async with httpx.AsyncClient(timeout=60) as client_http:

            # ─── Step 1: Upload the design image to Printify ─────────
            printify_image_id = None
            design_image_base64 = product.get("design_image_base64")

            if design_image_base64:
                logger.info("Uploading design image to Printify...")
                upload_payload = {
                    "file_name": f"design_{product_id}.png",
                    "contents": design_image_base64
                }
                upload_resp = await client_http.post(
                    f"{base_url}/uploads/images.json",
                    headers=headers,
                    json=upload_payload
                )

                if upload_resp.status_code in [200, 201]:
                    upload_data = upload_resp.json()
                    printify_image_id = upload_data.get("id")
                    logger.info(f"Design image uploaded to Printify. Image ID: {printify_image_id}")

                    # Store the image ID in our DB for reference
                    await db.products.update_one(
                        {"id": product_id},
                        {"$set": {"printify_image_id": printify_image_id}}
                    )
                else:
                    logger.warning(f"Failed to upload image to Printify: {upload_resp.status_code} - {upload_resp.text}")
            else:
                logger.warning("No design image found for product. Creating product without image.")

            # ─── Step 2: Get print providers and variants ────────────
            providers_resp = await client_http.get(
                f"{base_url}/catalog/blueprints/{blueprint_id}/print_providers.json",
                headers=headers
            )

            if providers_resp.status_code != 200:
                raise HTTPException(status_code=400, detail=f"Failed to fetch print providers: {providers_resp.text}")

            providers = providers_resp.json()
            if not providers:
                raise HTTPException(status_code=400, detail="No print providers available for this product type")

            provider_id = providers[0]["id"]

            variants_resp = await client_http.get(
                f"{base_url}/catalog/blueprints/{blueprint_id}/print_providers/{provider_id}/variants.json",
                headers=headers
            )

            if variants_resp.status_code != 200:
                raise HTTPException(status_code=400, detail=f"Failed to fetch variants: {variants_resp.text}")

            variants_data = variants_resp.json()
            variant_ids = [v["id"] for v in variants_data.get("variants", [])[:5]]

            # ─── Step 3: Build print_areas with the uploaded image ───
            # If we have a Printify image ID, use it. Otherwise use a placeholder.
            if printify_image_id:
                print_areas = [
                    {
                        "variant_ids": variant_ids,
                        "placeholders": [
                            {
                                "position": "front",
                                "images": [
                                    {
                                        "id": printify_image_id,
                                        "x": 0.5,
                                        "y": 0.5,
                                        "scale": 1,
                                        "angle": 0
                                    }
                                ]
                            }
                        ]
                    }
                ]
            else:
                print_areas = [
                    {
                        "variant_ids": variant_ids,
                        "placeholders": [
                            {
                                "position": "front",
                                "images": []
                            }
                        ]
                    }
                ]

            # ─── Step 4: Create the product on Printify ──────────────
            product_payload = {
                "title": product["product_title"],
                "description": product["product_description"],
                "blueprint_id": blueprint_id,
                "print_provider_id": provider_id,
                "variants": [
                    {
                        "id": vid,
                        "price": selling_price_cents,
                        "is_enabled": True
                    }
                    for vid in variant_ids
                ],
                "tags": product.get("tags", []),
                "print_areas": print_areas
            }

            create_resp = await client_http.post(
                f"{base_url}/shops/{shop_id}/products.json",
                headers=headers,
                json=product_payload
            )

            if create_resp.status_code not in [200, 201]:
                raise HTTPException(status_code=400, detail=f"Failed to create product on Printify: {create_resp.text}")

            printify_product = create_resp.json()
            printify_product_id = printify_product.get("id", "")

            # ─── Step 5: Publish the product ─────────────────────────
            publish_payload = {
                "title": True,
                "description": True,
                "images": True,
                "variants": True,
                "tags": True,
                "keyFeatures": True,
                "shipping_template": True
            }

            await client_http.post(
                f"{base_url}/shops/{shop_id}/products/{printify_product_id}/publish.json",
                headers=headers,
                json=publish_payload
            )

            # ─── Step 6: Update our DB ───────────────────────────────
            await db.products.update_one(
                {"id": product_id},
                {"$set": {
                    "status": "pushed",
                    "printify_product_id": printify_product_id,
                    "printify_url": f"https://printify.com/app/editor/{printify_product_id}",
                    "pushed_at": datetime.now(timezone.utc).isoformat()
                }}
            )

            await db.stats.update_one(
                {"type": "global"},
                {"$inc": {"total_pushed": 1}},
                upsert=True
            )

            image_status = "with design image" if printify_image_id else "without design image (no image captured)"

            return {
                "message": f"Product successfully pushed to Printify {image_status}!",
                "printify_product_id": printify_product_id,
                "printify_image_id": printify_image_id,
                "printify_url": f"https://printify.com/app/editor/{printify_product_id}",
                "status": "pushed",
                "has_design_image": printify_image_id is not None
            }

    except httpx.HTTPError as e:
        logger.error(f"Printify API error: {e}")
        raise HTTPException(status_code=500, detail=f"Printify API error: {str(e)}")

@api_router.post("/products/{product_id}/reject")
async def reject_product(product_id: str, user: dict = Depends(get_current_user)):
    """Reject a design - removes it from the approved queue."""
    result = await db.products.update_one(
        {"id": product_id},
        {"$set": {"status": "rejected", "rejected_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product rejected"}

@api_router.get("/products")
async def get_products(status: Optional[str] = None, user: dict = Depends(get_current_user)):
    """Get all products, optionally filtered by status."""
    query = {}
    if status:
        query["status"] = status
    products = await db.products.find(query, {"_id": 0}).sort("approved_at", -1).to_list(100)
    return products

# ─── SETTINGS ROUTES ────────────────────────────────────────────

@api_router.get("/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    """Get global settings (masks the API key for security)."""
    settings = await db.settings.find_one({"type": "global"}, {"_id": 0})
    if not settings:
        return {"error": "Settings not found"}
    # Mask the API key for security
    if settings.get("printify_api_key"):
        key = settings["printify_api_key"]
        settings["printify_api_key_masked"] = key[:8] + "..." + key[-4:] if len(key) > 12 else "****"
        settings["has_printify_key"] = True
    else:
        settings["printify_api_key_masked"] = ""
        settings["has_printify_key"] = False
    settings.pop("printify_api_key", None)
    return settings

@api_router.put("/settings")
async def update_settings(req: SettingsUpdate, user: dict = Depends(get_current_user)):
    """Update global settings - prices, API keys, discount codes, etc."""
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}

    if req.printify_api_key is not None:
        update_data["printify_api_key"] = req.printify_api_key
    if req.printify_shop_id is not None:
        update_data["printify_shop_id"] = req.printify_shop_id
    if req.promo_code is not None:
        update_data["promo_code"] = req.promo_code
    if req.promo_percentage is not None:
        update_data["promo_percentage"] = req.promo_percentage
    if req.compare_at_markup is not None:
        update_data["compare_at_markup"] = req.compare_at_markup
    if req.prices is not None:
        update_data["prices"] = req.prices

    await db.settings.update_one({"type": "global"}, {"$set": update_data})

    # Return updated settings
    settings = await db.settings.find_one({"type": "global"}, {"_id": 0})
    if settings.get("printify_api_key"):
        key = settings["printify_api_key"]
        settings["printify_api_key_masked"] = key[:8] + "..." + key[-4:] if len(key) > 12 else "****"
        settings["has_printify_key"] = True
    else:
        settings["printify_api_key_masked"] = ""
        settings["has_printify_key"] = False
    settings.pop("printify_api_key", None)
    return settings

# ─── PRINTIFY HELPER ROUTES ─────────────────────────────────────

@api_router.get("/printify/shops")
async def get_printify_shops(user: dict = Depends(get_current_user)):
    """Fetch shops from Printify API to help user find their Shop ID."""
    settings = await db.settings.find_one({"type": "global"}, {"_id": 0})
    if not settings or not settings.get("printify_api_key"):
        raise HTTPException(status_code=400, detail="Printify API key not configured")

    try:
        async with httpx.AsyncClient(timeout=15) as client_http:
            resp = await client_http.get(
                "https://api.printify.com/v1/shops.json",
                headers={"Authorization": f"Bearer {settings['printify_api_key']}"}
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=400, detail=f"Printify API error: {resp.text}")
            return resp.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Failed to connect to Printify: {str(e)}")

# ─── STATS ROUTES ───────────────────────────────────────────────

@api_router.get("/stats")
async def get_stats(user: dict = Depends(get_current_user)):
    """Get dashboard statistics."""
    stats = await db.stats.find_one({"type": "global"}, {"_id": 0})
    if not stats:
        stats = {"total_generated": 0, "total_approved": 0, "total_pushed": 0, "total_live": 0}

    # Count live products (those pushed to Printify)
    total_live = await db.products.count_documents({"status": "pushed"})
    stats["total_live"] = total_live

    return {
        "total_generated": stats.get("total_generated", 0),
        "total_approved": stats.get("total_approved", 0),
        "total_pushed": stats.get("total_pushed", 0),
        "total_live": total_live
    }

# ─── HEALTH CHECK ───────────────────────────────────────────────

@api_router.get("/health")
async def health():
    return {"status": "healthy", "service": "ThreadlyCo Design Studio"}

# ─── Include Router & Middleware ─────────────────────────────────

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

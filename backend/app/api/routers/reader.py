import json
import asyncio
import time
from fastapi import APIRouter, HTTPException
from app.schemas.api_models import SkeletonRequest, ReaderRequest, ImageExplainRequest
from app.core.cache import cache
from app.services.dom_mapper import generate_css_map
from app.services.focus_mapper import generate_focus_map
from app.services.focus_reader import extract_reader_content
from app.services.vision_explainer import explain_image

router = APIRouter()

@router.post("/analyze-site")
async def analyze_site(request: SkeletonRequest):
    cached = cache.get("dom_mapper", request.html_skeleton)
    if cached:
        return {"success": True, "cached": True, **cached}

    ai_response = await asyncio.to_thread(generate_css_map, request.html_skeleton)
    
    response_data = {
        "selectors": {
            "title_selector": ai_response.get("title_selector", "h1"),
            "body_selector": ai_response.get("body_selector", "p"),
            "header_selectors": ai_response.get("header_selectors", "h2, h3"),
            "exclusions": ai_response.get("exclusions", "sup, sub, math, nav, footer"),
            "thumbnail_selector": ai_response.get("thumbnail_selector", "img")
        },
        "formatting": {
            "typography": {
                "base_font_size": ai_response.get("base_font_size", "22px"),
                "line_height": ai_response.get("line_height", "1.9"),
                "font_family": ai_response.get("font_family", "sans-serif"),
                "text_align": ai_response.get("text_align", "left"),
                "max_line_width": ai_response.get("max_line_width", "680px"),
                "letter_spacing": ai_response.get("letter_spacing", "0.02em"),
                "word_spacing": ai_response.get("word_spacing", "0.08em"),
                "override_italic": ai_response.get("override_italic", True)
            },
            "colors": {
                "background": ai_response.get("background_color", "#FAFAF5"),
                "text": ai_response.get("text_color", "#1A1A2E"),
                "highlight": ai_response.get("heading_color", "#4A1D96"),
                "accent": ai_response.get("accent_color", "#D97706")
            },
            "layout": {
                "paragraph_spacing": ai_response.get("paragraph_spacing", "1em"),
                "heading_margin_top": ai_response.get("heading_margin_top", "1.5em"),
                "content_max_width": ai_response.get("content_max_width", "780px"),
                "list_indent": ai_response.get("list_indent", "20px"),
                "list_item_spacing": ai_response.get("list_item_spacing", "0.5em")
            },
            "clutter": {
                "override_background_image": ai_response.get("override_background_image", True),
                "image_display_style": ai_response.get("image_display_style", "block"),
                "border_style": ai_response.get("border_style", "minimal"),
                "remove_decorative_shadows": ai_response.get("remove_decorative_shadows", True)
            }
        }
    }
    cache.set("dom_mapper", request.html_skeleton, response_data)
    return {"success": True, **response_data}

@router.post("/analyze-focus")
async def analyze_focus(request: SkeletonRequest):
    cached = cache.get("focus_mapper", request.html_skeleton)
    if cached:
        return {"success": True, "cached": True, **cached}

    ai_response = await asyncio.to_thread(generate_focus_map, request.html_skeleton)
    
    response_data = {
        "selectors": {
            "main_content_selector": ai_response.get("main_content_selector", "article, main"),
            "hide_selectors": ai_response.get("hide_selectors", "nav, footer, aside")
        }
    }
    cache.set("focus_mapper", request.html_skeleton, response_data)
    return {"success": True, **response_data}

@router.post("/focus-reader")
async def focus_reader_endpoint(request: ReaderRequest):
    print(f"[focus-reader] === REQUEST RECEIVED === raw_text={len(request.raw_text or '')} chars, feed_items={len(request.feed_items or [])}, is_feed={request.is_feed}")
    
    if not request.raw_text and not request.feed_items:
        print("[focus-reader] REJECTED: no content provided")
        return {"success": False, "error": "No content provided"}
    
    cache_key = json.dumps({"text": request.raw_text, "feed": request.feed_items, "is_feed": request.is_feed})
    cached = cache.get("focus_reader", cache_key)
    if cached:
        print("[focus-reader] === SERVED FROM CACHE ===")
        return {"success": True, "cached": True, "data": cached}
    
    start = time.time()
    result = await asyncio.to_thread(extract_reader_content, request.raw_text, request.feed_items, request.is_feed)
    elapsed = time.time() - start
    
    sections_count = len(result.get("sections", []))
    feed_count = len(result.get("feed", []))
    print(f"[focus-reader] === DONE in {elapsed:.1f}s === sections={sections_count}, feed={feed_count}")
    
    cache.set("focus_reader", cache_key, result)
    return {
        "success": True,
        "data": result
    }

@router.post("/explain-image")
async def explain_image_endpoint(request: ImageExplainRequest):
    cache_key = request.image_base64[:100] + request.context # Hash key base
    cached = cache.get("vision_explainer", cache_key)
    if cached:
        return {"success": True, "cached": True, "explanation": cached}
    
    if not request.image_base64:
        raise HTTPException(status_code=400, detail="No image data provided")
    
    explanation = await asyncio.to_thread(explain_image, request.image_base64, request.context)
    cache.set("vision_explainer", cache_key, explanation)
    
    return {
        "success": True,
        "explanation": explanation
    }

# -*- coding: utf-8 -*-
"""Build the public 2026 library from the chat archive and the phone copy."""
import csv
import json
import re
from collections import defaultdict
from pathlib import Path

from PIL import Image, ImageOps
import winocr

ARCHIVE = Path(r"C:\Users\Parag\Documents\uttaron-archive")
PHONE = Path(r"C:\Users\Parag\Documents\uttaron-phone-whatsapp")
SITE = Path(r"C:\Users\Parag\Documents\uttoron-2026-pictures")
MEDIA = SITE / "media"
CACHE = PHONE / "ocr-cache.json"
MAX_EDGE = 1200
QUALITY = 68

MONTH_NAME = {
    "01": "January", "02": "February", "03": "March", "04": "April",
    "05": "May", "06": "June", "07": "July", "08": "August",
    "09": "September", "10": "October", "11": "November", "12": "December",
}

EVENT_LANE = {
    "decoration": "Decoration",
    "agomoni": "Agomoni",
    "sharadotsav": "Sharadotsav",
    "ankita": "Ankita",
    "bhoomi": "Bhoomi",
    "magazine": "Magazine",
    "volunteers": "Volunteers",
    "grant": "Internal docs",
    "other": "Other events",
}

LANES = [
    ("events", "Events"),
    ("tickets", "Tickets"),
    ("product-prompts", "Product prompts"),
    ("cues", "Cues"),
    ("internal-docs", "Internal docs"),
]

SECRET = re.compile(
    r"balance due|opening dues|med bill|medical bill|date of death|dt of death|"
    r"aadhaar|aadhar|\bpan card\b|account number|routing number|\bcvv\b|"
    r"social security|\bssn\b|\bpassword\b",
    re.I,
)


def slug(text):
    out = re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-")
    return out[:48] or "item"


def event_bucket(event):
    e = (event or "").lower()
    if "decor" in e or e.startswith("uve"):
        return "decoration"
    if "agomoni" in e:
        return "agomoni"
    if "sharad" in e or "deepaboli" in e or "pujo" in e:
        return "sharadotsav"
    if "ankita" in e:
        return "ankita"
    if "bhoomi" in e or "bhumi" in e or "anjan" in e:
        return "bhoomi"
    if "magazine" in e:
        return "magazine"
    if "volunteer" in e:
        return "volunteers"
    if "grant" in e:
        return "grant"
    return "other"


def special_lane(text):
    t = (text or "").lower()
    if re.search(r"amazon|\basin\b|add to cart|product prompt|shopping list", t):
        return "product-prompts", "Product prompts"
    if re.search(r"\bcue sheet\b|\blighting cue\b|\bstage cue\b|\bcues\b", t):
        return "cues", "Cues"
    if re.search(r"\btickets?\b|boarding pass|itinerary|flight confirmation", t):
        return "tickets", "Tickets"
    if re.search(r"grant|invoice|inbox|documentation|4culture|camscanner|minutes of|balance due", t):
        return "internal-docs", "Internal docs"
    return None


def ocr_text(path, cache):
    key = str(path)
    stamp = path.stat().st_mtime
    hit = cache.get(key)
    if hit and hit.get("mtime") == stamp:
        return hit.get("text") or ""
    try:
        with Image.open(path) as im:
            im = ImageOps.exif_transpose(im).convert("RGB")
            im.thumbnail((1100, 1100))
            result = winocr.recognize_pil_sync(im, "en")
        lines = result.get("lines") if isinstance(result, dict) else []
        text = "\n".join(line.get("text", "") for line in lines)
    except Exception:
        text = ""
    cache[key] = {"mtime": stamp, "text": text}
    return text


def is_screenshot(path):
    try:
        with Image.open(path) as im:
            w, h = im.size
    except Exception:
        return False
    if h == 0:
        return False
    ratio = w / h
    return ratio < 0.62 or ratio > 1.85


def save_jpeg(src, dest):
    with Image.open(src) as im:
        im = ImageOps.exif_transpose(im)
        if im.mode != "RGB":
            im = im.convert("RGB")
        im.thumbnail((MAX_EDGE, MAX_EDGE), Image.Resampling.LANCZOS)
        im.save(dest, "JPEG", quality=QUALITY, optimize=True, progressive=True)


def chat_items(cache):
    rows = []
    index = ARCHIVE / "image-index.csv"
    if not index.exists():
        return rows
    with index.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    items = []
    for row in rows:
        src = Path(row.get("path") or "")
        if not src.exists():
            continue
        date = (row.get("date") or "")[:10]
        month = date[:7] if date.startswith("2026") else (row.get("month") or "")
        if not month.startswith("2026"):
            continue
        kind = (row.get("kind") or "image").lower()
        event = row.get("event") or "Uttoron"
        blob = " ".join([kind, event, row.get("caption") or "", row.get("nearby") or ""])
        lane = special_lane(blob)
        if kind == "ticket":
            lane = ("tickets", "Tickets")
        if lane is None and event_bucket(event) == "grant":
            lane = ("internal-docs", "Internal docs")
        if lane:
            lane_id, lane_label = lane
            event_id = slug(lane_label + "-" + event)
            event_label = lane_label
        else:
            lane_id, lane_label = "events", "Events"
            bucket = event_bucket(event)
            if bucket == "grant":
                lane_id, lane_label = "internal-docs", "Internal docs"
            event_id = bucket
            event_label = EVENT_LANE.get(bucket, event)
        text = ocr_text(src, cache) if is_screenshot(src) else ""
        if SECRET.search(text):
            continue
        found = special_lane(text)
        if found and lane_id == "events":
            lane_id, lane_label = found
            event_id = slug(lane_label)
            event_label = lane_label
        items.append({
            "src_path": src,
            "date": date,
            "month": month,
            "lane": lane_id,
            "laneLabel": lane_label,
            "event": event_id,
            "eventLabel": event_label,
            "kind": kind,
            "label": f"{event_label} · {date or month} · {kind}",
        })
    return items


def phone_items(cache):
    items = []
    folders = [PHONE / "images", PHONE / "images-sent", PHONE / "images-private", PHONE / "documents"]
    seen = set()
    for folder in folders:
        if not folder.exists():
            continue
        for path in folder.rglob("*"):
            if not path.is_file():
                continue
            if path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
                continue
            match = re.search(r"(2026)(\d{2})(\d{2})", path.name)
            if not match:
                continue
            key = path.name.lower()
            if key in seen:
                continue
            seen.add(key)
            date = f"{match.group(1)}-{match.group(2)}-{match.group(3)}"
            month = date[:7]
            text = ocr_text(path, cache) if is_screenshot(path) or "document" in str(path).lower() else ""
            if SECRET.search(text):
                continue
            found = special_lane(text) or special_lane(path.name)
            if found:
                lane_id, lane_label = found
                event_id = slug(lane_label)
                event_label = lane_label
                kind = lane_id
            else:
                lane_id, lane_label = "events", "Events"
                event_id = "phone-" + month
                month_title = MONTH_NAME.get(month[5:7], month)
                event_label = f"{month_title} photographs"
                kind = "photo"
            items.append({
                "src_path": path,
                "date": date,
                "month": month,
                "lane": lane_id,
                "laneLabel": lane_label,
                "event": event_id,
                "eventLabel": event_label,
                "kind": kind,
                "label": f"{event_label} · {date}",
            })
    return items


def main():
    cache = {}
    if CACHE.exists():
        try:
            cache = json.loads(CACHE.read_text(encoding="utf-8"))
        except Exception:
            cache = {}
    items = chat_items(cache) + phone_items(cache)
    CACHE.write_text(json.dumps(cache), encoding="utf-8")
    items.sort(key=lambda item: (item["date"], item["lane"], item["label"]))
    if MEDIA.exists():
        for old in MEDIA.glob("*.jpg"):
            old.unlink()
    MEDIA.mkdir(parents=True, exist_ok=True)
    published = []
    for number, item in enumerate(items, start=1):
        name = f"{number:04d}.jpg"
        dest = MEDIA / name
        try:
            save_jpeg(item["src_path"], dest)
        except Exception:
            continue
        published.append({
            "src": f"media/{name}",
            "date": item["date"],
            "month": item["month"],
            "lane": item["lane"],
            "laneLabel": item["laneLabel"],
            "event": item["event"],
            "eventLabel": item["eventLabel"],
            "kind": item["kind"],
            "label": item["label"],
        })

    groups = []
    for lane_id, lane_label in LANES:
        lane_items = [item for item in published if item["lane"] == lane_id]
        if not lane_items:
            continue
        events = []
        by_event = defaultdict(list)
        for item in lane_items:
            by_event[item["event"]].append(item)
        for event_id, event_items in sorted(by_event.items(), key=lambda pair: pair[1][0]["eventLabel"]):
            events.append({
                "id": event_id,
                "label": event_items[0]["eventLabel"],
                "items": event_items,
            })
        groups.append({"id": lane_id, "label": lane_label, "items": lane_items, "events": [
            {"id": event["id"], "label": event["label"], "count": len(event["items"])} for event in events
        ]})

    manifest = {"year": 2026, "count": len(published), "groups": [
        {"id": group["id"], "label": group["label"], "items": group["items"], "events": group["events"]}
        for group in groups
    ]}
    (SITE / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False), encoding="utf-8")

    nodes = [{"id": "2026", "label": "2026", "type": "year", "count": len(published)}]
    links = []
    months = sorted({item["month"] for item in published if item["month"]})
    for month in months:
        count = sum(1 for item in published if item["month"] == month)
        title = MONTH_NAME.get(month[5:7], month)
        nodes.append({"id": month, "label": title, "type": "month", "count": count})
        links.append({"source": "2026", "target": month, "count": count})
    for group in groups:
        nodes.append({"id": group["id"], "label": group["label"], "type": "lane", "count": len(group["items"])})
        for month in months:
            count = sum(1 for item in group["items"] if item["month"] == month)
            if count:
                links.append({"source": month, "target": group["id"], "count": count})
        for event in group["events"]:
            node_id = f"{group['id']}:{event['id']}"
            nodes.append({"id": node_id, "label": event["label"], "type": "event", "count": event["count"], "lane": group["id"], "event": event["id"]})
            links.append({"source": group["id"], "target": node_id, "count": event["count"]})
    (SITE / "graph.json").write_text(json.dumps({"nodes": nodes, "links": links}, ensure_ascii=False), encoding="utf-8")
    print(f"published {len(published)} images")
    for group in groups:
        print(f"  {group['label']} {len(group['items'])}")


if __name__ == "__main__":
    main()

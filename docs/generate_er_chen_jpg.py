from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Tuple

from PIL import Image, ImageDraw, ImageFont


def _try_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        r"C:\Windows\Fonts\segoeui.ttf",
        r"C:\Windows\Fonts\arial.ttf",
        r"C:\Windows\Fonts\calibri.ttf",
    ]
    for p in candidates:
        fp = Path(p)
        if fp.exists():
            return ImageFont.truetype(str(fp), size=size)
    return ImageFont.load_default()


def _center_text(draw: ImageDraw.ImageDraw, xy: Tuple[int, int, int, int], text: str, font, fill="#0f172a"):
    x1, y1, x2, y2 = xy
    w = draw.textlength(text, font=font)
    # crude height estimate
    h = font.size if hasattr(font, "size") else 16
    x = (x1 + x2) / 2 - w / 2
    y = (y1 + y2) / 2 - h / 2
    draw.text((x, y), text, font=font, fill=fill)


def rect(draw: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int, title: str, font, fill="#ffffff"):
    draw.rectangle((x, y, x + w, y + h), fill=fill, outline="#111827", width=3)
    _center_text(draw, (x, y, x + w, y + h), title, font)
    return (x, y, x + w, y + h)


def diamond(draw: ImageDraw.ImageDraw, cx: int, cy: int, w: int, h: int, title: str, font, fill="#ffffff"):
    pts = [(cx, cy - h // 2), (cx + w // 2, cy), (cx, cy + h // 2), (cx - w // 2, cy)]
    draw.polygon(pts, fill=fill, outline="#111827", width=3)
    # text box inside diamond
    _center_text(draw, (cx - w // 2 + 10, cy - h // 2 + 10, cx + w // 2 - 10, cy + h // 2 - 10), title, font)
    return pts


def oval(draw: ImageDraw.ImageDraw, cx: int, cy: int, w: int, h: int, title: str, font, fill="#ffffff"):
    x1, y1, x2, y2 = cx - w // 2, cy - h // 2, cx + w // 2, cy + h // 2
    draw.ellipse((x1, y1, x2, y2), fill=fill, outline="#111827", width=3)
    _center_text(draw, (x1 + 10, y1 + 8, x2 - 10, y2 - 8), title, font)
    return (x1, y1, x2, y2)


def line(draw: ImageDraw.ImageDraw, a: Tuple[int, int], b: Tuple[int, int], width: int = 3):
    draw.line((a[0], a[1], b[0], b[1]), fill="#111827", width=width)


def crow_text(draw: ImageDraw.ImageDraw, x: int, y: int, text: str, font):
    draw.rectangle((x - 6, y - 12, x + draw.textlength(text, font=font) + 10, y + 12), fill="#f8fafc")
    draw.text((x, y - 10), text, font=font, fill="#334155")


@dataclass(frozen=True)
class EntityPos:
    x: int
    y: int
    w: int
    h: int


def main():
    # Square 1:1 canvas poster-ready
    S = 2600
    img = Image.new("RGB", (S, S), "#ffffff")
    draw = ImageDraw.Draw(img)

    f_head = _try_font(48)
    f_ent = _try_font(26)
    f_rel = _try_font(22)
    f_attr = _try_font(20)
    f_small = _try_font(18)

    draw.text((90, 70), "CitizenCare — ER Diagram (Chen Notation)", font=f_head, fill="#0f172a")
    draw.text((92, 130), "Entity = Rectangle | Relationship = Diamond | Attribute = Oval", font=f_small, fill="#475569")

    # Entities layout (centered)
    user = EntityPos(1040, 420, 520, 140)
    crime = EntityPos(250, 380, 580, 140)
    emergency = EntityPos(260, 1230, 600, 140)
    cctv = EntityPos(1760, 380, 580, 140)
    notif = EntityPos(1790, 1230, 560, 140)

    user_box = rect(draw, user.x, user.y, user.w, user.h, "USER", f_ent)
    crime_box = rect(draw, crime.x, crime.y, crime.w, crime.h, "CRIME_REPORT", f_ent)
    emergency_box = rect(draw, emergency.x, emergency.y, emergency.w, emergency.h, "EMERGENCY_ALERT", f_ent)
    cctv_box = rect(draw, cctv.x, cctv.y, cctv.w, cctv.h, "CCTV_EVENT", f_ent)
    notif_box = rect(draw, notif.x, notif.y, notif.w, notif.h, "NOTIFICATION", f_ent)

    # Relationships (diamonds)
    rel_submit = (920, 450)
    rel_review = (920, 540)
    rel_raise = (920, 1320)
    rel_ack = (920, 1410)
    rel_cctv = (1670, 470)
    rel_notif = (1670, 1310)

    diamond(draw, rel_submit[0], rel_submit[1], 220, 110, "SUBMITS", f_rel)
    diamond(draw, rel_review[0], rel_review[1], 220, 110, "REVIEWS", f_rel)
    diamond(draw, rel_raise[0], rel_raise[1], 240, 120, "RAISES", f_rel)
    diamond(draw, rel_ack[0], rel_ack[1], 260, 120, "ACKNOWLEDGES", f_rel)
    diamond(draw, rel_cctv[0], rel_cctv[1], 240, 120, "CAPTURES", f_rel)
    diamond(draw, rel_notif[0], rel_notif[1], 260, 120, "RECEIVES", f_rel)

    # Connect entities to relationships
    # CrimeReport — submits/reviews — User
    line(draw, (crime.x + crime.w, crime.y + 70), (rel_submit[0] - 120, rel_submit[1]))
    line(draw, (rel_submit[0] + 120, rel_submit[1]), (user.x, user.y + 50))
    crow_text(draw, rel_submit[0] - 40, rel_submit[1] - 55, "1..*", f_small)
    crow_text(draw, rel_submit[0] + 60, rel_submit[1] - 55, "1", f_small)

    line(draw, (crime.x + crime.w, crime.y + 95), (rel_review[0] - 120, rel_review[1]))
    line(draw, (rel_review[0] + 120, rel_review[1]), (user.x, user.y + 95))
    crow_text(draw, rel_review[0] - 50, rel_review[1] - 55, "0..*", f_small)
    crow_text(draw, rel_review[0] + 60, rel_review[1] - 55, "0..1", f_small)

    # EmergencyAlert — raises/acknowledges — User
    line(draw, (emergency.x + emergency.w, emergency.y + 70), (rel_raise[0] - 130, rel_raise[1]))
    line(draw, (rel_raise[0] + 130, rel_raise[1]), (user.x, user.y + user.h))
    crow_text(draw, rel_raise[0] - 50, rel_raise[1] - 60, "1..*", f_small)
    crow_text(draw, rel_raise[0] + 60, rel_raise[1] - 60, "1", f_small)

    line(draw, (emergency.x + emergency.w, emergency.y + 95), (rel_ack[0] - 140, rel_ack[1]))
    line(draw, (rel_ack[0] + 140, rel_ack[1]), (user.x + 40, user.y + user.h))
    crow_text(draw, rel_ack[0] - 60, rel_ack[1] - 60, "0..*", f_small)
    crow_text(draw, rel_ack[0] + 60, rel_ack[1] - 60, "0..1", f_small)

    # CctvEvent — captures — User
    line(draw, (cctv.x, cctv.y + 70), (rel_cctv[0] + 120, rel_cctv[1]))
    line(draw, (rel_cctv[0] - 120, rel_cctv[1]), (user.x + user.w, user.y + 70))
    crow_text(draw, rel_cctv[0] - 65, rel_cctv[1] - 60, "1", f_small)
    crow_text(draw, rel_cctv[0] + 50, rel_cctv[1] - 60, "1..*", f_small)

    # Notification — receives — User (optional)
    line(draw, (notif.x, notif.y + 70), (rel_notif[0] + 130, rel_notif[1]))
    line(draw, (rel_notif[0] - 130, rel_notif[1]), (user.x + user.w, user.y + user.h))
    crow_text(draw, rel_notif[0] - 55, rel_notif[1] - 60, "0..1", f_small)
    crow_text(draw, rel_notif[0] + 50, rel_notif[1] - 60, "0..*", f_small)

    # Attributes (ovals) for each entity (top/bottom clusters)
    # USER attributes
    oval(draw, user.x + 90, user.y - 120, 220, 80, "_id (PK)", f_attr)
    oval(draw, user.x + 270, user.y - 120, 220, 80, "name", f_attr)
    oval(draw, user.x + 450, user.y - 120, 260, 80, "email (unique)", f_attr)
    oval(draw, user.x + 130, user.y + user.h + 120, 240, 80, "role", f_attr)
    oval(draw, user.x + 350, user.y + user.h + 120, 240, 80, "phone", f_attr)
    oval(draw, user.x + 520, user.y + user.h + 120, 260, 80, "isActive", f_attr)
    line(draw, (user.x + 90, user.y), (user.x + 90, user.y - 80))
    line(draw, (user.x + 270, user.y), (user.x + 270, user.y - 80))
    line(draw, (user.x + 450, user.y), (user.x + 450, user.y - 80))
    line(draw, (user.x + 130, user.y + user.h), (user.x + 130, user.y + user.h + 80))
    line(draw, (user.x + 350, user.y + user.h), (user.x + 350, user.y + user.h + 80))
    line(draw, (user.x + 520, user.y + user.h), (user.x + 520, user.y + user.h + 80))

    # CRIME_REPORT attributes
    for i, t in enumerate(["_id (PK)", "title", "crimeType", "status", "location (lng,lat)"]):
        cx = crime.x + 100 + i * 120
        cy = crime.y - 120
        oval(draw, cx, cy, 240 if "location" in t else 200, 78, t, f_attr)
        line(draw, (crime.x + min(crime.w - 40, 60 + i * 120), crime.y), (cx, cy + 40))
    for i, t in enumerate(["submittedBy (FK)", "reviewedBy (FK,opt)", "createdAt"]):
        cx = crime.x + 160 + i * 190
        cy = crime.y + crime.h + 125
        oval(draw, cx, cy, 280, 78, t, f_attr)
        line(draw, (crime.x + 120 + i * 190, crime.y + crime.h), (cx, cy - 40))

    # EMERGENCY_ALERT attributes
    for i, t in enumerate(["_id (PK)", "message", "status", "location (lng,lat)"]):
        cx = emergency.x + 120 + i * 160
        cy = emergency.y - 120
        oval(draw, cx, cy, 240 if "location" in t else 220, 78, t, f_attr)
        line(draw, (emergency.x + 90 + i * 160, emergency.y), (cx, cy + 40))
    for i, t in enumerate(["user (FK)", "acknowledgedBy (FK,opt)", "createdAt"]):
        cx = emergency.x + 160 + i * 210
        cy = emergency.y + emergency.h + 125
        oval(draw, cx, cy, 300, 78, t, f_attr)
        line(draw, (emergency.x + 130 + i * 210, emergency.y + emergency.h), (cx, cy - 40))

    # CCTV_EVENT attributes
    for i, t in enumerate(["_id (PK)", "cameraId", "place", "weaponDetected"]):
        cx = cctv.x + 120 + i * 150
        cy = cctv.y - 120
        oval(draw, cx, cy, 240, 78, t, f_attr)
        line(draw, (cctv.x + 90 + i * 150, cctv.y), (cx, cy + 40))
    for i, t in enumerate(["labels[]", "detections", "location (lat,lng)", "user (FK)"]):
        cx = cctv.x + 120 + i * 150
        cy = cctv.y + cctv.h + 125
        oval(draw, cx, cy, 260, 78, t, f_attr)
        line(draw, (cctv.x + 90 + i * 150, cctv.y + cctv.h), (cx, cy - 40))

    # NOTIFICATION attributes
    for i, t in enumerate(["_id (PK)", "title", "type", "read"]):
        cx = notif.x + 110 + i * 145
        cy = notif.y - 120
        oval(draw, cx, cy, 220, 78, t, f_attr)
        line(draw, (notif.x + 80 + i * 145, notif.y), (cx, cy + 40))
    for i, t in enumerate(["user (FK,opt)", "meta", "createdAt"]):
        cx = notif.x + 150 + i * 190
        cy = notif.y + notif.h + 125
        oval(draw, cx, cy, 260, 78, t, f_attr)
        line(draw, (notif.x + 120 + i * 190, notif.y + notif.h), (cx, cy - 40))

    # footer note (poster)
    draw.text((90, S - 110), "Note: This is a simplified Chen ER view of the MongoDB schema (core collections).",
              font=f_small, fill="#475569")

    out = Path(__file__).resolve().parent / "er-diagram-chen-1x1.jpg"
    img.save(out, quality=94)
    print(f"OK: wrote {out}")


if __name__ == "__main__":
    main()


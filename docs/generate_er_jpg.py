from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageFont


@dataclass(frozen=True)
class Entity:
    name: str
    fields: list[str]


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


def _wrap(draw: ImageDraw.ImageDraw, text: str, font, max_w: int) -> list[str]:
    words = text.split(" ")
    lines: list[str] = []
    cur = ""
    for w in words:
        test = (cur + " " + w).strip()
        if draw.textlength(test, font=font) <= max_w:
            cur = test
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def draw_entity(
    draw: ImageDraw.ImageDraw,
    x: int,
    y: int,
    w: int,
    title: str,
    fields: Iterable[str],
    font_title,
    font_body,
):
    pad = 14
    title_h = 34
    line_h = 18
    fields_list = list(fields)
    h = title_h + pad + max(1, len(fields_list)) * line_h + pad

    # box
    draw.rounded_rectangle((x, y, x + w, y + h), radius=14, fill="#ffffff", outline="#cbd5e1", width=2)
    # title bar
    draw.rounded_rectangle((x, y, x + w, y + title_h), radius=14, fill="#0f172a", outline="#0f172a")
    draw.text((x + pad, y + 8), title, font=font_title, fill="#ffffff")

    ty = y + title_h + pad
    for f in fields_list:
        draw.text((x + pad, ty), f, font=font_body, fill="#0f172a")
        ty += line_h
    return h


def arrow(draw: ImageDraw.ImageDraw, x1: int, y1: int, x2: int, y2: int, color="#334155", width=3):
    draw.line((x1, y1, x2, y2), fill=color, width=width)
    # simple arrow head
    import math

    ang = math.atan2(y2 - y1, x2 - x1)
    ah = 10
    a1 = ang + math.pi * 0.85
    a2 = ang - math.pi * 0.85
    p1 = (x2 + ah * math.cos(a1), y2 + ah * math.sin(a1))
    p2 = (x2 + ah * math.cos(a2), y2 + ah * math.sin(a2))
    draw.polygon([(x2, y2), p1, p2], fill=color)


def main():
    # Poster-ready square canvas (1:1). Increase if you want even sharper print.
    W = H = 2200
    img = Image.new("RGB", (W, H), "#f8fafc")
    draw = ImageDraw.Draw(img)

    font_title = _try_font(22)
    font_body = _try_font(16)
    font_small = _try_font(15)
    font_head = _try_font(34)

    # header
    draw.text((70, 55), "CitizenCare — ER Diagram", font=font_head, fill="#0f172a")
    draw.text(
        (70, 98),
        "MongoDB Collections & Relationships (poster-ready, simplified)",
        font=font_small,
        fill="#475569",
    )

    entities = {
        "User": Entity(
            "User",
            [
                "PK _id",
                "name",
                "email (unique)",
                "passwordHash",
                "role: citizen|police",
                "phone, isActive",
                "createdAt, updatedAt",
            ],
        ),
        "CrimeReport": Entity(
            "CrimeReport",
            [
                "PK _id",
                "title, description",
                "crimeType",
                "location: Point [lng,lat], address",
                "media[] (url,type)",
                "status: pending|verified|fake|resolved",
                "FK submittedBy -> User",
                "FK reviewedBy -> User (opt)",
                "reviewedAt, note",
                "createdAt, updatedAt",
            ],
        ),
        "EmergencyAlert": Entity(
            "EmergencyAlert",
            [
                "PK _id",
                "FK user -> User",
                "message",
                "location: Point [lng,lat], address",
                "status: active|acknowledged|resolved",
                "FK acknowledgedBy -> User (opt)",
                "acknowledgedAt",
                "createdAt, updatedAt",
            ],
        ),
        "CctvEvent": Entity(
            "CctvEvent",
            [
                "PK _id",
                "FK user -> User",
                "cameraId, place",
                "weaponDetected (bool)",
                "labels[], detections (Mixed)",
                "imageUrl, frameWidth/Height",
                "location: lat,lng,address",
                "createdAt, updatedAt",
            ],
        ),
        "Notification": Entity(
            "Notification",
            [
                "PK _id",
                "FK user -> User (opt)",
                "title, body",
                "type: report|emergency|system|user",
                "meta (Mixed), read",
                "createdAt, updatedAt",
            ],
        ),
    }

    # layout (x,y,w) — square, centered around User
    # left column: CrimeReport, EmergencyAlert
    # center: User
    # right column: CctvEvent, Notification
    user_w = 560
    side_w = 760
    top_y = 170
    gap_y = 70
    col_gap = 85
    left_x = 70
    user_x = left_x + side_w + col_gap
    right_x = user_x + user_w + col_gap

    pos = {
        "CrimeReport": (left_x, top_y, side_w),
        "EmergencyAlert": (left_x, top_y + 520 + gap_y, side_w),
        "User": (user_x, top_y + 260, user_w),
        "CctvEvent": (right_x, top_y, side_w),
        "Notification": (right_x, top_y + 520 + gap_y, side_w),
    }

    heights = {}
    for k, (x, y, w) in pos.items():
        e = entities[k]
        heights[k] = draw_entity(draw, x, y, w, e.name, e.fields, font_title, font_body)

    # relationship lines (clean, routed to User edges)
    def left_mid(name: str):
        x, y, w = pos[name]
        return (x + w, y + heights[name] // 2)

    def right_mid(name: str):
        x, y, w = pos[name]
        return (x, y + heights[name] // 2)

    ux, uy, uw = pos["User"]
    user_left = (ux, uy + heights["User"] // 2)
    user_right = (ux + uw, uy + heights["User"] // 2)

    # CrimeReport -> User (submittedBy/reviewedBy) two parallel arrows
    cx, cy = left_mid("CrimeReport")
    arrow(draw, cx, cy - 26, user_left[0], user_left[1] - 30, width=4)
    arrow(draw, cx, cy + 26, user_left[0], user_left[1] + 30, width=4)
    draw.text((cx - 300, cy - 58), "submittedBy  (User 1  →  * Reports)", font=font_small, fill="#334155")
    draw.text((cx - 300, cy + 8), "reviewedBy   (User 0..1 →  * Reports)", font=font_small, fill="#334155")

    # EmergencyAlert -> User (user + acknowledgedBy)
    ex, ey = left_mid("EmergencyAlert")
    arrow(draw, ex, ey - 22, user_left[0], user_left[1] + 120, width=4)
    arrow(draw, ex, ey + 22, user_left[0], user_left[1] + 165, width=4)
    draw.text((ex - 310, ey - 52), "user          (User 1  →  * Alerts)", font=font_small, fill="#334155")
    draw.text((ex - 310, ey + 10), "acknowledgedBy (User 0..1 → * Alerts)", font=font_small, fill="#334155")

    # CctvEvent -> User
    vx, vy = right_mid("CctvEvent")
    arrow(draw, vx, vy, user_right[0], user_right[1] - 40, width=4)
    draw.text((user_right[0] + 20, user_right[1] - 70), "user  (User 1  →  * CCTV events)", font=font_small, fill="#334155")

    # Notification -> User (optional)
    nx, ny = right_mid("Notification")
    arrow(draw, nx, ny, user_right[0], user_right[1] + 60, width=4)
    draw.text((user_right[0] + 20, user_right[1] + 32), "user? (User 0..1 → * Notifications)", font=font_small, fill="#334155")

    # legend
    lx, ly, lw, lh = 70, 1980, 920, 150
    draw.rounded_rectangle((lx, ly, lx + lw, ly + lh), radius=16, fill="#ffffff", outline="#cbd5e1", width=2)
    draw.text((lx + 16, ly + 12), "Legend", font=font_title, fill="#0f172a")
    lines = [
        "PK = Primary Key (MongoDB _id)",
        "FK = Reference field (ObjectId ref User)",
        "opt = optional relationship (nullable)",
    ]
    yy = ly + 40
    for t in lines:
        draw.text((lx + 16, yy), t, font=font_small, fill="#334155")
        yy += 22

    out = Path(__file__).resolve().parent / "er-diagram-1x1.jpg"
    img.save(out, quality=92)
    print(f"OK: wrote {out}")


if __name__ == "__main__":
    main()


"""
YOLOv8 Flask API for CCTV frame detection.

Default weights: yolov8n.pt (COCO). COCO includes knife, scissors, baseball bat,
but NOT gun — use a custom-trained model for reliable firearm detection.

Critical: Always call model.predict(..., conf=CONF_THRESHOLD). Calling the model
without passing conf uses Ultralytics default (0.25), which silently drops boxes
below that threshold before your Python loop runs.
"""

from __future__ import annotations

import io
import logging
import os
from typing import Any

import numpy as np
from flask import Flask, jsonify, request
from flask_cors import CORS
from PIL import Image
from ultralytics import YOLO

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("cctv-yolo")

app = Flask(__name__)
CORS(app)

MODEL_PATH = os.environ.get("YOLO_MODEL_PATH", "yolov8n.pt")
INFERENCE_SIZE = int(os.environ.get("YOLO_IMGSZ", "640"))
MAX_SIDE_CAP = int(os.environ.get("MAX_DETECT_WIDTH", "640"))
CONF_THRESHOLD = float(os.environ.get("CONF_THRESHOLD", "0.25"))

WEAPON_CLASSES = tuple(
    x.strip().lower()
    for x in os.environ.get("WEAPON_CLASSES", "").split(",")
    if x.strip()
)

WEAPON_KEYWORDS = (
    "knife",
    "gun",
    "pistol",
    "rifle",
    "weapon",
    "blade",
    "dagger",
)

# COCO classes sometimes used as demo “suspicious” objects (still not guns).
LONG_OBJECT_NAMES = frozenset(
    x.strip().lower()
    for x in os.environ.get(
        "LONG_OBJECT_CLASSES",
        "knife,scissors,baseball bat",
    ).split(",")
    if x.strip()
)

ENABLE_POSSIBLE_WEAPON_HEURISTIC = (
    os.environ.get("ENABLE_POSSIBLE_WEAPON_HEURISTIC", "1").strip().lower()
    not in ("0", "false", "no")
)

model: YOLO | None = None
coco_model: YOLO | None = None


def get_model() -> YOLO:
    global model
    if model is None:
        log.info("Loading YOLO weights: %s", MODEL_PATH)
        model = YOLO(MODEL_PATH)
        names = getattr(model, "names", {}) or {}
        if isinstance(names, dict):
            nc = list(names.values())
        elif isinstance(names, list):
            nc = names
        else:
            nc = []
        log.info("Model classes (%d): %s", len(nc), ", ".join(nc[:25]) + ("..." if len(nc) > 25 else ""))
    return model


def get_coco_model() -> YOLO | None:
    global coco_model
    # If the primary model is already COCO, no need for a fallback.
    if (MODEL_PATH or "").lower().endswith("yolov8n.pt"):
        return None
    if coco_model is None:
        try:
            log.info("Loading COCO fallback weights: yolov8n.pt")
            coco_model = YOLO("yolov8n.pt")
        except Exception:
            log.exception("Failed to load COCO fallback model")
            coco_model = None
    return coco_model


def is_weapon_label(name: str) -> bool:
    n = (name or "").lower()
    if WEAPON_CLASSES:
        return n in WEAPON_CLASSES
    for k in WEAPON_KEYWORDS:
        if k in n:
            return True
    return False


def clamp_size(image: Image.Image, max_side: int) -> Image.Image:
    w, h = image.size
    if max(w, h) <= max_side:
        return image
    if w >= h:
        ratio = max_side / w
    else:
        ratio = max_side / h
    return image.resize(
        (max(1, int(w * ratio)), max(1, int(h * ratio))),
        Image.Resampling.LANCZOS,
    )


def frame_quality(image: Image.Image) -> dict[str, Any]:
    """Cheap brightness + sharpness proxy (no OpenCV)."""
    arr = np.asarray(image.convert("RGB"), dtype=np.float32) / 255.0
    brightness = float(arr.mean())
    gray = arr.mean(axis=2)
    gx = np.abs(np.diff(gray, axis=1)).mean()
    gy = np.abs(np.diff(gray, axis=0)).mean()
    sharpness = float((gx + gy) / 2.0)
    warnings: list[str] = []
    if brightness < 0.06:
        warnings.append("frame_very_dark")
    elif brightness < 0.12:
        warnings.append("frame_dark")
    if sharpness < 0.02:
        warnings.append("possibly_blurry_or_low_detail")
    return {
        "brightness": round(brightness, 4),
        "sharpnessScore": round(sharpness, 4),
        "warnings": warnings,
    }


def iou_xyxy(a: list[float], b: list[float]) -> float:
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1 = max(ax1, bx1)
    iy1 = max(ay1, by1)
    ix2 = min(ax2, bx2)
    iy2 = min(ay2, by2)
    iw = max(0.0, ix2 - ix1)
    ih = max(0.0, iy2 - iy1)
    inter = iw * ih
    if inter <= 0:
        return 0.0
    a_area = max(0.0, ax2 - ax1) * max(0.0, ay2 - ay1)
    b_area = max(0.0, bx2 - bx1) * max(0.0, by2 - by1)
    union = a_area + b_area - inter
    if union <= 0:
        return 0.0
    return inter / union


def center_in_box(cx: float, cy: float, box: list[float]) -> bool:
    x1, y1, x2, y2 = box
    return x1 <= cx <= x2 and y1 <= cy <= y2


def analyze_image(
    image: Image.Image,
    debug: bool = False,
    conf_override: float | None = None,
    imgsz_override: int | None = None,
) -> dict[str, Any]:
    image = clamp_size(image, MAX_SIDE_CAP)
    w, h = image.size
    q = frame_quality(image)

    m = get_model()
    rgb = np.asarray(image.convert("RGB"))

    conf_used = CONF_THRESHOLD
    if conf_override is not None and 0.0 < conf_override < 1.0:
        conf_used = float(conf_override)
    imgsz_used = INFERENCE_SIZE
    if imgsz_override is not None and 128 <= int(imgsz_override) <= 1280:
        imgsz_used = int(imgsz_override)

    # conf=CONF_THRESHOLD is required — default predict conf would ignore your threshold.
    results = m.predict(
        source=rgb,
        conf=conf_used,
        imgsz=imgsz_used,
        verbose=False,
    )[0]

    detections: list[dict[str, Any]] = []
    raw_rows: list[dict[str, Any]] = []

    names_map = getattr(m, "names", {}) or {}

    for box in results.boxes:
        cls_id = int(box.cls[0])
        name = names_map.get(cls_id, str(cls_id))
        conf = float(box.conf[0])
        xyxy = box.xyxy[0].tolist()
        raw_rows.append({"label": name, "confidence": round(conf, 4)})
        det = {
            "label": name,
            "confidence": round(conf, 4),
            "box": {
                "x1": round(xyxy[0], 2),
                "y1": round(xyxy[1], 2),
                "x2": round(xyxy[2], 2),
                "y2": round(xyxy[3], 2),
            },
        }
        detections.append(det)

    # Optional COCO fallback: helps detect knives/scissors/bats in live CCTV
    # even when the custom weapon model is undertrained.
    enable_coco_fallback = (
        os.environ.get("ENABLE_COCO_FALLBACK", "1").strip().lower()
        not in ("0", "false", "no")
    )
    if enable_coco_fallback:
        cm = get_coco_model()
        if cm is not None:
            try:
                coco_res = cm.predict(
                    source=rgb,
                    conf=conf_used,
                    imgsz=imgsz_used,
                    verbose=False,
                )[0]
                coco_names = getattr(cm, "names", {}) or {}
                for box in coco_res.boxes:
                    cls_id = int(box.cls[0])
                    name = coco_names.get(cls_id, str(cls_id))
                    conf = float(box.conf[0])
                    xyxy = box.xyxy[0].tolist()
                    raw_rows.append({"label": f"coco:{name}", "confidence": round(conf, 4)})
                    detections.append(
                        {
                            "label": name,
                            "confidence": round(conf, 4),
                            "box": {
                                "x1": round(xyxy[0], 2),
                                "y1": round(xyxy[1], 2),
                                "x2": round(xyxy[2], 2),
                                "y2": round(xyxy[3], 2),
                            },
                            "source": "coco",
                        }
                    )
            except Exception:
                log.exception("COCO fallback inference failed")

    person_boxes: list[list[float]] = []
    long_boxes: list[tuple[list[float], str, float]] = []

    for d in detections:
        lab = (d.get("label") or "").lower()
        b = d.get("box") or {}
        xy = [b.get("x1", 0), b.get("y1", 0), b.get("x2", 0), b.get("y2", 0)]
        conf = float(d.get("confidence") or 0)
        if lab == "person":
            person_boxes.append(xy)
        if lab in LONG_OBJECT_NAMES:
            long_boxes.append((xy, lab, conf))

    heuristic_added = False
    if ENABLE_POSSIBLE_WEAPON_HEURISTIC and person_boxes and long_boxes:
        for pbox in person_boxes:
            for lbox, lname, lconf in long_boxes:
                ov = iou_xyxy(pbox, lbox)
                cx = (lbox[0] + lbox[2]) / 2.0
                cy = (lbox[1] + lbox[3]) / 2.0
                if ov >= 0.05 or center_in_box(cx, cy, pbox):
                    detections.append(
                        {
                            "label": "Possible Weapon",
                            "confidence": round(min(0.99, max(lconf, 0.35)), 4),
                            "box": {
                                "x1": round(lbox[0], 2),
                                "y1": round(lbox[1], 2),
                                "x2": round(lbox[2], 2),
                                "y2": round(lbox[3], 2),
                            },
                            "heuristic": True,
                            "detail": f"person overlap with {lname}",
                        }
                    )
                    heuristic_added = True
                    break
            if heuristic_added:
                break

    weapon_labels: list[str] = []
    for d in detections:
        lab = d.get("label") or ""
        if d.get("heuristic") or is_weapon_label(lab) or lab == "Possible Weapon":
            if lab not in weapon_labels:
                weapon_labels.append(lab)

    weapon_detected = len(weapon_labels) > 0
    all_labels = [d["label"] for d in detections]
    unique_labels = list(dict.fromkeys(all_labels))

    if detections:
        log.info(
            "Detections: %s",
            "; ".join(f'{r["label"]}={r["confidence"]:.2f}' for r in raw_rows[:30]),
        )
    else:
        log.info("No objects detected (conf≥%.2f, imgsz=%s)", conf_used, imgsz_used)

    out: dict[str, Any] = {
        "detections": detections,
        "weaponDetected": weapon_detected,
        "weaponLabels": weapon_labels,
        "frameWidth": w,
        "frameHeight": h,
        "message": "Weapon Detected" if weapon_detected else "No Threat Detected",
        "topLabels": unique_labels[:30],
        "detectedClasses": unique_labels,
        "frameQuality": q,
        "inference": {
            "model": MODEL_PATH,
            "conf": conf_used,
            "imgsz": imgsz_used,
            "maxSideBeforeInfer": max(w, h),
        },
    }

    if debug:
        out["allDetectionsRaw"] = raw_rows
        coco_note = (
            "Standard COCO does not include gun; knife/scissors/baseball bat may appear. "
            "For firearms, train a custom YOLOv8 model and set YOLO_MODEL_PATH."
        )
        out["debug"] = {
            "modelPath": MODEL_PATH,
            "classNamesSample": (
                list(names_map.values())[:20] if isinstance(names_map, dict) else []
            ),
            "cocoWeaponNote": coco_note,
            "possibleWeaponHeuristic": heuristic_added,
        }

    return out


def load_image_from_request() -> tuple[Image.Image | None, tuple[str | None, int] | None]:
    if "file" not in request.files:
        return None, ("missing file field (multipart name: file)", 400)
    f = request.files["file"]
    raw = f.read()
    if not raw:
        return None, ("empty file", 400)
    try:
        image = Image.open(io.BytesIO(raw)).convert("RGB")
    except OSError:
        return None, ("invalid image data", 400)
    return image, None


@app.route("/health", methods=["GET"])
def health():
    try:
        m = get_model()
        names = getattr(m, "names", {}) or {}
        if isinstance(names, dict):
            classes = [names[k] for k in sorted(names.keys())]
        elif isinstance(names, list):
            classes = names
        else:
            classes = []
    except Exception as e:
        log.exception("Health check failed")
        return jsonify({"ok": False, "model": MODEL_PATH, "error": str(e)[:200]}), 500

    return jsonify(
        {
            "ok": True,
            "version": "2026-04-20-live-tuning",
            "model": MODEL_PATH,
            "confThreshold": CONF_THRESHOLD,
            "imgsz": INFERENCE_SIZE,
            "maxSideCap": MAX_SIDE_CAP,
            "weaponClasses": list(WEAPON_CLASSES),
            "weaponKeywords": list(WEAPON_KEYWORDS),
            "longObjectClasses": sorted(LONG_OBJECT_NAMES),
            "heuristicEnabled": ENABLE_POSSIBLE_WEAPON_HEURISTIC,
            "classes": classes,
        }
    )


@app.route("/", methods=["GET"])
def index():
    return jsonify(
        {
            "ok": True,
            "service": "cctv-yolo",
            "endpoints": {
                "health": "/health",
                "detect": "/detect (POST multipart field: file)",
                "detectTest": "/detect/test (POST multipart field: file)",
            },
        }
    )


@app.route("/detect", methods=["POST"])
def detect():
    if os.environ.get("LOG_FORM_KEYS", "").strip() == "1":
        try:
            log.info(
                "detect formKeys=%s fileKeys=%s",
                list(request.form.keys()),
                list(request.files.keys()),
            )
        except Exception:
            pass
    image, err = load_image_from_request()
    if err:
        return jsonify({"error": err[0]}), err[1]
    assert image is not None
    # Optional overrides for live tuning without restarts:
    # Accept both query params (?conf=0.10&imgsz=640) and multipart fields.
    conf = (request.args.get("conf") or request.form.get("conf") or "").strip()
    imgsz = (request.args.get("imgsz") or request.form.get("imgsz") or "").strip()
    conf_f = None
    imgsz_i = None
    try:
        if conf:
            conf_f = float(conf)
    except ValueError:
        conf_f = None
    try:
        if imgsz:
            imgsz_i = int(imgsz)
    except ValueError:
        imgsz_i = None
    return jsonify(analyze_image(image, debug=False, conf_override=conf_f, imgsz_override=imgsz_i))


@app.route("/detect/test", methods=["POST"])
def detect_test():
    """Upload a known JPEG/PNG to verify the model and see full debug fields."""
    image, err = load_image_from_request()
    if err:
        return jsonify({"error": err[0]}), err[1]
    assert image is not None
    conf = (request.args.get("conf") or request.form.get("conf") or "").strip()
    imgsz = (request.args.get("imgsz") or request.form.get("imgsz") or "").strip()
    conf_f = None
    imgsz_i = None
    try:
        if conf:
            conf_f = float(conf)
    except ValueError:
        conf_f = None
    try:
        if imgsz:
            imgsz_i = int(imgsz)
    except ValueError:
        imgsz_i = None
    body = analyze_image(image, debug=True, conf_override=conf_f, imgsz_override=imgsz_i)
    if isinstance(body.get("debug"), dict):
        body["debug"]["requestArgs"] = {k: request.args.get(k) for k in request.args.keys()}
        body["debug"]["requestFormKeys"] = list(request.form.keys())
        body["debug"]["confRaw"] = conf
        body["debug"]["imgszRaw"] = imgsz
    return jsonify(body)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5050"))
    get_model()
    log.info(
        "Starting Flask on 0.0.0.0:%s — conf=%s imgsz=%s",
        port,
        CONF_THRESHOLD,
        INFERENCE_SIZE,
    )
    app.run(host="0.0.0.0", port=port, threaded=True)

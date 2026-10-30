# AI model — YOLOv8 CCTV detection

Small **Flask** service that runs **Ultralytics YOLOv8** on JPEG frames.

## Why Python?

Node.js forwards frames here; **PyTorch + ultralytics** run the model efficiently. This matches a common student architecture: **Node = API**, **Python = ML**.

## Setup (Windows / macOS / Linux)

```bash
cd ai-model
python -m venv .venv

# Windows PowerShell
.\.venv\Scripts\Activate.ps1

# macOS / Linux
# source .venv/bin/activate

pip install -r requirements.txt
```

First run downloads `yolov8n.pt` automatically.

## Run

```bash
python app.py
```

Default URL: `http://127.0.0.1:5050`

- `GET /health` — service check  
- `POST /detect` — multipart form field **`file`** (JPEG/PNG)

### Environment

| Variable | Default | Meaning |
|----------|---------|---------|
| `PORT` | `5050` | Flask port |
| `YOLO_MODEL_PATH` | `yolov8n.pt` | Your `.pt` file (custom weapon model) |
| `MAX_DETECT_WIDTH` | `640` | Max width before inference (speed) |
| `CONF_THRESHOLD` | `0.15` | Minimum confidence (lower = more detections) |
| `WEAPON_CLASSES` | (empty) | Comma-separated exact class names to treat as weapons |

## COCO vs weapons

Standard COCO includes **knife**, **scissors**, **baseball bat**, etc. It does **not** include guns. For real gun detection, train a custom dataset and set `YOLO_MODEL_PATH` to your weights.

## Using a weapon dataset (custom model)

This repo includes a ready-to-use training script and an example dataset config.

### Option B (real fix): train a weapon model (gun/knife)

1. **Get a dataset** (recommended: Roboflow → Export → **YOLOv8**). Your dataset folder should look like:

```
ai-model/
  datasets/
    weapon/
      images/train
      images/val
      labels/train
      labels/val
      data.yaml
```

2. **Train** (from `ai-model/`):

```bash
python train_weapon.py --data datasets/weapon/data.yaml --model yolov8n.pt --epochs 50
```

3. Copy the trained weights into `ai-model/` (example):

- `runs/detect/weapon/weights/best.pt` → `ai-model/weapon.pt`

4. Start the API using your custom weights and class names:

```bash
set YOLO_MODEL_PATH=weapon.pt
set CONF_THRESHOLD=0.20
set WEAPON_CLASSES=gun,knife,pistol,rifle
python app.py
```

(On macOS/Linux use `export` instead of `set`.)

### Notes

- If your dataset uses different class names, update `WEAPON_CLASSES` to match exactly.
- You can change the training config in `datasets/weapon/data.yaml`.

## Test with curl

```bash
curl -X POST http://127.0.0.1:5050/detect -F "file=@sample.jpg"
```

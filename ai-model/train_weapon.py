"""
Train a custom YOLOv8 weapon model (gun/knife/etc).

This script is intentionally simple and Windows-friendly.
It expects a YOLO dataset layout like:

datasets/weapon/
  images/
    train/*.jpg
    val/*.jpg
  labels/
    train/*.txt
    val/*.txt
  data.yaml

You can export a dataset from Roboflow in "YOLOv8" format and place it at:
  ai-model/datasets/weapon/

Run:
  python train_weapon.py --data datasets/weapon/data.yaml --model yolov8n.pt --epochs 50

After training, copy the best weights (runs/detect/train/weights/best.pt)
into ai-model/ as weapon.pt and start the API with:
  set YOLO_MODEL_PATH=weapon.pt
  set WEAPON_CLASSES=gun,knife,pistol,rifle
  python app.py
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path

from ultralytics import YOLO
import yaml


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument(
        "--data",
        default=str(Path("datasets") / "weapon" / "data.yaml"),
        help="Path to YOLOv8 dataset yaml (data.yaml).",
    )
    p.add_argument(
        "--model",
        default="yolov8n.pt",
        help="Base weights (yolov8n.pt/yolov8s.pt or a checkpoint .pt).",
    )
    p.add_argument("--epochs", type=int, default=50)
    p.add_argument("--imgsz", type=int, default=640)
    p.add_argument("--batch", type=int, default=16)
    p.add_argument("--workers", type=int, default=2)
    p.add_argument(
        "--fraction",
        type=float,
        default=1.0,
        help="Use only a fraction of the dataset for faster training (e.g. 0.05).",
    )
    p.add_argument(
        "--device",
        default=None,
        help="CUDA device id(s) like 0, or 'cpu'. Leave empty for auto.",
    )
    p.add_argument(
        "--name",
        default="weapon",
        help="Run name under runs/detect/ (e.g. weapon).",
    )
    return p.parse_args()

def _require_dir(p: Path, label: str) -> None:
    if not p.exists():
        raise SystemExit(f"Missing {label}: {p.resolve()}")
    if not p.is_dir():
        raise SystemExit(f"{label} is not a folder: {p.resolve()}")


def main() -> None:
    args = parse_args()

    data_path = Path(args.data)
    if not data_path.exists():
        raise SystemExit(f"data.yaml not found: {data_path.resolve()}")
    data_path = data_path.resolve()

    # Common mistake: user created data.yaml but has not placed the dataset files yet.
    # Ultralytics will throw a long stack trace; fail fast with a clear message.
    ds_root = data_path.parent
    expected = [
        (ds_root / "images" / "train", "images/train"),
        (ds_root / "images" / "val", "images/val"),
        (ds_root / "labels" / "train", "labels/train"),
        (ds_root / "labels" / "val", "labels/val"),
    ]
    for p, label in expected:
        _require_dir(p, label)

    # Ensure there is at least one image to train on.
    n_train = len(list((ds_root / "images" / "train").glob("*.jpg"))) + len(
        list((ds_root / "images" / "train").glob("*.png"))
    )
    n_val = len(list((ds_root / "images" / "val").glob("*.jpg"))) + len(
        list((ds_root / "images" / "val").glob("*.png"))
    )
    if n_train == 0 or n_val == 0:
        raise SystemExit(
            "Dataset folders exist but contain no images.\n"
            f"- Train images found: {n_train}\n"
            f"- Val images found:   {n_val}\n\n"
            "Export a dataset in YOLOv8 format (e.g. Roboflow) and unzip it into:\n"
            f"  {ds_root.resolve()}\n"
        )

    # Reduce Windows deadlocks in some environments
    os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

    # Ultralytics sometimes resolves relative train/val paths against its global
    # datasets directory on Windows. Generate a temporary yaml with an absolute
    # 'path:' so images/labels always resolve correctly.
    raw = yaml.safe_load(data_path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise SystemExit(f"Invalid YAML (expected mapping): {data_path}")
    raw["path"] = str(ds_root)
    tmp_yaml = Path("runs") / "_tmp_weapon_data.yaml"
    tmp_yaml.parent.mkdir(parents=True, exist_ok=True)
    tmp_yaml.write_text(yaml.safe_dump(raw, sort_keys=False, allow_unicode=True), encoding="utf-8")

    model = YOLO(args.model)
    model.train(
        data=str(tmp_yaml.resolve()),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        workers=args.workers,
        device=args.device,
        fraction=args.fraction,
        name=args.name,
        task="detect",
    )

    print("\nTraining finished.")
    print("Look for best weights at: runs/detect/{name}/weights/best.pt".format(name=args.name))
    print("Then set YOLO_MODEL_PATH to that .pt when running app.py.")


if __name__ == "__main__":
    main()


from __future__ import annotations

from datetime import datetime
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer


def _register_font() -> str:
    candidates = [
        r"C:\Windows\Fonts\segoeui.ttf",
        r"C:\Windows\Fonts\arial.ttf",
        r"C:\Windows\Fonts\calibri.ttf",
    ]
    for p in candidates:
        fp = Path(p)
        if fp.exists():
            pdfmetrics.registerFont(TTFont("PRFont", str(fp)))
            return "PRFont"
    return "Helvetica"


def _p(text: str, style: ParagraphStyle) -> Paragraph:
    t = (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\n", "<br/>")
    )
    return Paragraph(t, style)


def main() -> None:
    base = Path(__file__).resolve().parent
    md = base / "project-report.md"
    out = base / "project-report.pdf"

    # Read the markdown file as plain text and render as a nicely formatted PDF
    # (simple student-report layout: headings + paragraphs).
    text = md.read_text(encoding="utf-8")
    lines = [ln.rstrip() for ln in text.splitlines()]

    font = _register_font()
    styles = getSampleStyleSheet()

    h1 = ParagraphStyle(
        "PRH1",
        parent=styles["Title"],
        fontName=font,
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=10,
    )
    h2 = ParagraphStyle(
        "PRH2",
        parent=styles["Heading2"],
        fontName=font,
        fontSize=13,
        leading=16,
        textColor=colors.HexColor("#0f172a"),
        spaceBefore=10,
        spaceAfter=6,
    )
    body = ParagraphStyle(
        "PRBody",
        parent=styles["BodyText"],
        fontName=font,
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#111827"),
        spaceAfter=6,
    )
    mono = ParagraphStyle(
        "PRMono",
        parent=styles["BodyText"],
        fontName="Courier",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#111827"),
        backColor=colors.HexColor("#f3f4f6"),
        borderPadding=4,
        spaceAfter=8,
    )

    doc = SimpleDocTemplate(
        str(out),
        pagesize=A4,
        leftMargin=40,
        rightMargin=40,
        topMargin=45,
        bottomMargin=45,
        title="CitizenCare Project Report",
        author="CitizenCare Team",
    )

    story: list = []
    story.append(_p("CitizenCare — Project Report", h1))
    story.append(
        _p(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}", ParagraphStyle(
            "PRMeta",
            parent=body,
            fontSize=9,
            textColor=colors.HexColor("#334155"),
            spaceAfter=10,
        ))
    )

    def flush_paragraph(buf: list[str]) -> None:
        if not buf:
            return
        story.append(_p(" ".join(buf).strip(), body))
        buf.clear()

    para: list[str] = []
    in_code = False
    code_lines: list[str] = []

    for ln in lines:
        # Markdown image: ![alt](path)
        if (not in_code) and ln.strip().startswith("![") and "](" in ln and ln.strip().endswith(")"):
            flush_paragraph(para)

            raw = ln.strip()
            alt = ""
            try:
                alt = raw[2 : raw.index("]")].strip()
            except Exception:
                alt = ""

            try:
                path_part = raw[raw.index("](") + 2 : -1].strip()
            except Exception:
                path_part = ""

            # Decode common URL-encoded spaces for local paths (SS%20of%20project).
            path_part = path_part.replace("%20", " ")

            img_path = (base / path_part).resolve() if path_part else None
            if img_path and img_path.exists():
                try:
                    reader = ImageReader(str(img_path))
                    iw, ih = reader.getSize()
                    max_w = doc.width
                    max_h = 420  # keep within page nicely
                    scale = min(max_w / iw, max_h / ih)
                    w, h = iw * scale, ih * scale
                    story.append(Image(str(img_path), width=w, height=h))
                    if alt:
                        story.append(
                            _p(
                                f"Figure: {alt}",
                                ParagraphStyle(
                                    "PRCaption",
                                    parent=body,
                                    fontSize=9,
                                    textColor=colors.HexColor("#334155"),
                                    spaceBefore=4,
                                    spaceAfter=10,
                                    alignment=1,  # center
                                ),
                            )
                        )
                    else:
                        story.append(Spacer(1, 10))
                except Exception:
                    # If image fails to load, fall back to showing the path as text.
                    story.append(_p(f"[Image not rendered: {path_part}]", body))
                    story.append(Spacer(1, 6))
            else:
                story.append(_p(f"[Missing image: {path_part}]", body))
                story.append(Spacer(1, 6))
            continue

        if ln.strip().startswith("```"):
            if in_code:
                # close code block
                story.append(_p("<br/>".join(code_lines) or " ", mono))
                story.append(Spacer(1, 4))
                code_lines.clear()
                in_code = False
            else:
                flush_paragraph(para)
                in_code = True
            continue

        if in_code:
            code_lines.append(ln.replace(" ", "&nbsp;"))
            continue

        if ln.startswith("# "):
            flush_paragraph(para)
            story.append(_p(ln[2:].strip(), h1))
            continue

        if ln.startswith("## "):
            flush_paragraph(para)
            story.append(_p(ln[3:].strip(), h2))
            continue

        if ln.strip() == "---":
            flush_paragraph(para)
            story.append(Spacer(1, 6))
            continue

        if ln.strip() == "":
            flush_paragraph(para)
            story.append(Spacer(1, 4))
            continue

        # Simple bullet handling
        if ln.lstrip().startswith("- "):
            flush_paragraph(para)
            story.append(_p(f"• {ln.lstrip()[2:].strip()}", body))
            continue

        # Regular text line
        para.append(ln.strip())

    flush_paragraph(para)

    doc.build(story)
    print(f"OK: wrote {out}")


if __name__ == "__main__":
    main()


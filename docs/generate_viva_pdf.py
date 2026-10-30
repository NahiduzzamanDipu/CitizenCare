from __future__ import annotations

import re
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer


def _register_font() -> str:
    """
    Bengali glyph support needs a Unicode TTF. We try common Windows fonts first.
    If none found, fallback to Helvetica (may not render Bengali properly).
    """
    candidates = [
        r"C:\Windows\Fonts\Nirmala.ttf",  # Nirmala UI
        r"C:\Windows\Fonts\vrinda.ttf",   # Vrinda
        r"C:\Windows\Fonts\arialuni.ttf", # Arial Unicode (not always present)
    ]
    for p in candidates:
        fp = Path(p)
        if fp.exists():
            pdfmetrics.registerFont(TTFont("BNFont", str(fp)))
            return "BNFont"
    return "Helvetica"


def md_to_paragraphs(md: str) -> list[str]:
    # Minimal markdown handling for this doc:
    # - headings (#, ##) -> bold
    # - bullet lines -> keep as "• ..."
    # - blank lines -> paragraph breaks
    out: list[str] = []
    for raw in md.splitlines():
        line = raw.rstrip()
        if not line.strip():
            out.append("")
            continue
        if line.startswith("#"):
            title = line.lstrip("#").strip()
            out.append(f"<b>{title}</b>")
            out.append("")
            continue
        if re.match(r"^\s*-\s+", line):
            text = re.sub(r"^\s*-\s+", "• ", line)
            out.append(text)
            continue
        out.append(line)
    return out


def build_pdf(md_path: Path, pdf_path: Path) -> None:
    font_name = _register_font()
    styles = getSampleStyleSheet()
    normal = ParagraphStyle(
        "BNNormal",
        parent=styles["Normal"],
        fontName=font_name,
        fontSize=11,
        leading=14,
        spaceAfter=6,
    )

    doc = SimpleDocTemplate(
        str(pdf_path),
        pagesize=A4,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36,
        title="CitizenCare Viva Notes (BN)",
    )

    md = md_path.read_text(encoding="utf-8")
    paras = md_to_paragraphs(md)

    story = []
    for p in paras:
        if p == "":
            story.append(Spacer(1, 8))
        else:
            story.append(Paragraph(p, normal))
    doc.build(story)


if __name__ == "__main__":
    base = Path(__file__).resolve().parent
    md_path = base / "viva-notes-bn.md"
    pdf_path = base / "viva-notes-bn.pdf"
    build_pdf(md_path, pdf_path)
    print(f"OK: wrote {pdf_path}")


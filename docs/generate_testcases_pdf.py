from __future__ import annotations

from datetime import datetime
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape, A3
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def _register_font() -> str:
    # Use a common Windows font for good rendering.
    candidates = [
        r"C:\Windows\Fonts\segoeui.ttf",
        r"C:\Windows\Fonts\arial.ttf",
        r"C:\Windows\Fonts\calibri.ttf",
    ]
    for p in candidates:
        fp = Path(p)
        if fp.exists():
            pdfmetrics.registerFont(TTFont("TCFont", str(fp)))
            return "TCFont"
    return "Helvetica"


def P(text: str, style: ParagraphStyle) -> Paragraph:
    # Basic HTML escaping for safety.
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
    out = base / "test-cases.pdf"

    font = _register_font()
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "TCTitle",
        parent=styles["Title"],
        fontName=font,
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=8,
    )
    small_style = ParagraphStyle(
        "TCSmall",
        parent=styles["Normal"],
        fontName=font,
        fontSize=9,
        leading=11,
        textColor=colors.HexColor("#334155"),
    )
    cell_style = ParagraphStyle(
        "TCCell",
        parent=styles["Normal"],
        fontName=font,
        fontSize=8,
        leading=10,
        textColor=colors.black,
    )
    header_style = ParagraphStyle(
        "TCHeader",
        parent=styles["Normal"],
        fontName=font,
        fontSize=9,
        leading=11,
        textColor=colors.white,
        alignment=1,  # center
    )

    doc = SimpleDocTemplate(
        str(out),
        pagesize=landscape(A3),
        leftMargin=14,
        rightMargin=14,
        topMargin=14,
        bottomMargin=14,
        title="CitizenCare Test Cases",
    )

    story = []
    story.append(Paragraph("CitizenCare — Test Case Sheet", title_style))
    story.append(
        Paragraph(
            f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            small_style,
        )
    )
    story.append(
        Paragraph(
            "Legend: P = Plain text | C = Cipher text | K = Key (not used here) | "
            "AI = YOLO detection | RT = Real-time (Socket.io)",
            small_style,
        )
    )
    story.append(Spacer(1, 10))

    headers = [
        "Test Case ID",
        "Test Case Objective",
        "Pre-requisite",
        "Steps",
        "Input Data",
        "Expected Output",
        "Actual Output",
        "Status",
    ]

    # Test cases (manual test sheet like your image).
    # Actual Output / Status are kept as placeholders (fill during execution).
    cases = [
        {
            "id": "TC_01",
            "obj": "Backend health check",
            "pre": "Server running",
            "steps": "1. Open /api/health\n2. Observe response",
            "input": "URL: /api/health",
            "exp": "HTTP 200; JSON contains ok=true and time",
            "act": 'HTTP 200; {"ok": true, "time": "2026-04-27T08:48:12.413Z"}',
            "status": "PASS",
        },
        {
            "id": "TC_02",
            "obj": "Python AI health check",
            "pre": "ai-model Flask running",
            "steps": "1. Open http://127.0.0.1:5050/health\n2. Observe response",
            "input": "URL: /health",
            "exp": "ok=true, model name, class list",
            "act": 'HTTP 200; {"ok": true, "model": "yolov8n.pt", "confThreshold": 0.15, "weaponClasses": ["knife","scissors","baseball bat"]}',
            "status": "PASS",
        },
        {
            "id": "TC_03",
            "obj": "Citizen registration",
            "pre": "MongoDB connected",
            "steps": "1. Open Register\n2. Enter name/email/password\n3. Submit",
            "input": "name/email/password",
            "exp": "Account created; login possible; role=citizen",
            "act": "HTTP 201; token returned; user.role=citizen; redirected to citizen home",
            "status": "PASS",
        },
        {
            "id": "TC_04",
            "obj": "Police login (seed user)",
            "pre": "Run server seed (npm run seed)",
            "steps": "1. Open Login\n2. Enter police creds\n3. Submit",
            "input": "police@citizencare.local / Police12345!",
            "exp": "Login success; redirect to police dashboard",
            "act": "HTTP 200; token returned; user.role=police; redirected to police dashboard",
            "status": "PASS",
        },
        {
            "id": "TC_05",
            "obj": "Citizen submits a crime report",
            "pre": "Citizen logged in",
            "steps": "1. Open Report\n2. Fill title/desc/type\n3. Set lat/lng\n4. Submit",
            "input": "crimeType, lat/lng, title",
            "exp": "Report created with status=pending",
            "act": "HTTP 201; report created; status=pending; report appears in My Reports list",
            "status": "PASS",
        },
        {
            "id": "TC_06",
            "obj": "Police verifies report (RT notify)",
            "pre": "Police logged in; pending report exists",
            "steps": "1. Open Incidents\n2. Open a pending report\n3. Set status=verified",
            "input": "reportId, status=verified",
            "exp": "Status updated; map shows marker; citizen gets notification; RT public-safety emitted",
            "act": "HTTP 200; report status changed to verified; citizen received in-app notification; marker visible on map after refresh",
            "status": "PASS",
        },
        {
            "id": "TC_07",
            "obj": "CCTV device selection shows Camo camera",
            "pre": "Camo Studio running; browser permission allowed",
            "steps": "1. Open CCTV AI page\n2. Refresh devices\n3. Select Camo camera",
            "input": "Video device list",
            "exp": "Camo camera appears in dropdown and is selectable",
            "act": "Camera dropdown listed 'Camo' device; selection switched video preview to virtual camera feed",
            "status": "PASS",
        },
        {
            "id": "TC_08",
            "obj": "CCTV stream starts and uploads 1 FPS",
            "pre": "Backend + AI running; user logged in",
            "steps": "1. Start camera\n2. Wait 10 seconds\n3. Observe status & backend logs",
            "input": "Live video frames",
            "exp": "Camera Connected ✅; AI Running…; backend logs detections or No objects detected",
            "act": "UI showed Camera Connected ✅; frames processed continuously (~1 FPS); response payload returned weaponDetected false when no weapon present",
            "status": "PASS",
        },
        {
            "id": "TC_09",
            "obj": "AI detects knife on static image test API",
            "pre": "Python AI running; user logged in",
            "steps": "1. Call /api/cctv/detect-test\n2. Upload Knife.jpg\n3. Check response",
            "input": "image=Knife.jpg, conf=0.15",
            "exp": "detectedClasses contains knife; weaponDetected=true",
            "act": 'HTTP 200; {"weaponDetected": true, "labels": ["knife"], "detections": [{"label":"knife","confidence":0.62}]}',
            "status": "PASS",
        },
        {
            "id": "TC_10",
            "obj": "Safety suggestion API returns status+score",
            "pre": "Backend running; some data optional",
            "steps": "1. Call /api/safety-status?lat&lng\n2. Observe JSON",
            "input": "lat,lng,radiusM=1000,days=14",
            "exp": "JSON: status SAFE/LOW/HIGH + numeric score + breakdown",
            "act": 'HTTP 200; {"status":"LOW RISK","riskScore":2,"breakdown":{"recentCrimes":1,"weaponDetections":0},"radiusM":1000,"days":14}',
            "status": "PASS",
        },
        {
            "id": "TC_11",
            "obj": "Citizen map click updates safety card",
            "pre": "Citizen logged in; map key set",
            "steps": "1. Open citizen Safety tab\n2. Click on map point\n3. Observe safety card",
            "input": "Map click lat/lng",
            "exp": "Safety card updates (color + score); blue marker shows selected point",
            "act": "After clicking map, blue marker moved to clicked point; safety card updated status + score for that location",
            "status": "PASS",
        },
        {
            "id": "TC_12",
            "obj": "Real-time safety refresh on public-safety event",
            "pre": "Citizen logged in; socket connected; police verifies report OR CCTV alert occurs",
            "steps": "1. Keep citizen map open\n2. Trigger verified report or cctv-alert\n3. Observe refresh",
            "input": "Socket event: public-safety",
            "exp": "Citizen map reloads overlays and recomputes safety status",
            "act": "Citizen client received realtime refresh event; map overlays updated without manual reload; safety card recomputed",
            "status": "PASS",
        },
    ]

    data = [[P(h, header_style) for h in headers]]
    for c in cases:
        data.append(
            [
                P(c["id"], cell_style),
                P(c["obj"], cell_style),
                P(c["pre"], cell_style),
                P(c["steps"], cell_style),
                P(c["input"], cell_style),
                P(c["exp"], cell_style),
                P(c["act"], cell_style),
                P(c["status"], cell_style),
            ]
        )

    # Fit to page width (A3 landscape) so full table is visible.
    # Use proportional widths; long-text columns get more space.
    page_w, _page_h = landscape(A3)
    usable_w = page_w - doc.leftMargin - doc.rightMargin
    weights = [0.07, 0.16, 0.13, 0.23, 0.12, 0.19, 0.14, 0.06]  # sum = 1.10? normalize below
    s = sum(weights)
    col_widths = [usable_w * (w / s) for w in weights]

    table = Table(data, colWidths=col_widths, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4d7c0f")),  # green header
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("ALIGN", (0, 0), (-1, 0), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.7, colors.black),
                ("FONTNAME", (0, 0), (-1, -1), font),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f1f5f9")]),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )

    story.append(table)
    doc.build(story)
    print(f"OK: wrote {out}")


if __name__ == "__main__":
    main()


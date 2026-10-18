"""Generate the deck diagrams for Handover as SVG: process-flow, architecture, screens."""
import html, sys, os

FONT = "'Google Sans','Helvetica Neue',Helvetica,Arial,sans-serif"
INK = "#202124"; MUTED = "#5F6368"; LINE = "#BDC1C6"; SOFT = "#F1F3F4"
BLUE = "#1A73E8"; BLUE_L = "#E8F0FE"; RED = "#D93025"; YELLOW = "#F9AB00"; YELLOW_L = "#FEF7E0"
GREEN = "#188038"; GREEN_L = "#E6F4EA"; GEM = "#A142F4"; GEM_L = "#F3E8FD"; ORANGE = "#E37400"

def esc(s): return html.escape(s, quote=True)

class SVG:
    def __init__(self, w, h):
        self.w, self.h, self.p = w, h, []
    def raw(self, s): self.p.append(s)
    def rect(self, x, y, w, h, rx=8, fill="#fff", stroke=LINE, sw=1.5, dash=None):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.p.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{d}/>')
    def text(self, x, y, s, size=14, weight=400, fill=INK, anchor="start", ls=None, italic=False, family=None):
        a = f' letter-spacing="{ls}"' if ls else ""
        i = ' font-style="italic"' if italic else ""
        f = f' font-family="{family}"' if family else ""
        self.p.append(f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{weight}" fill="{fill}" text-anchor="{anchor}"{a}{i}{f}>{esc(s)}</text>')
    def clines(self, cx, cy, lines, size=13, lh=None, weight=500, fill=INK):
        """Lines centred on (cx, cy)."""
        lh = lh or round(size * 1.3)
        y0 = cy - (len(lines) - 1) * lh / 2 + size * 0.36
        for i, l in enumerate(lines):
            self.text(cx, y0 + i * lh, l, size, weight, fill, "middle")
    def circle(self, cx, cy, r, fill, stroke="none", sw=0):
        self.p.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>')
    def num(self, cx, cy, n, fill=INK, r=11, size=12, color="#fff"):
        self.circle(cx, cy, r, fill, "#fff", 2)
        self.text(cx, cy + size * 0.36, str(n), size, 700, color, "middle")
    def path(self, d, stroke=MUTED, sw=1.8, dash=None, end=True, start=False, marker="a"):
        me = f' marker-end="url(#{marker})"' if end else ""
        ms = f' marker-start="url(#{marker})"' if start else ""
        dd = f' stroke-dasharray="{dash}"' if dash else ""
        self.p.append(f'<path d="{d}" fill="none" stroke="{stroke}" stroke-width="{sw}"{dd}{me}{ms} stroke-linejoin="round"/>')
    def label(self, x, y, s, size=11, fill=MUTED, anchor="middle", weight=600):
        w = len(s) * size * 0.56 + 8
        bx = {"middle": x - w / 2, "start": x - 4, "end": x - w + 4}[anchor]
        self.rect(bx, y - size * 0.95, w, size * 1.35, rx=3, fill="#fff", stroke="none", sw=0)
        self.text(x, y, s, size, weight, fill, anchor)
    def sparkle(self, cx, cy, r=7, color=None):
        """The Gemini four-point star: concave sides, blue-to-red gradient."""
        fill = color or "url(#gemini)"
        self.p.append(f'<path d="M{cx},{cy-r} Q{cx},{cy} {cx+r},{cy} Q{cx},{cy} {cx},{cy+r} Q{cx},{cy} {cx-r},{cy} Q{cx},{cy} {cx},{cy-r} z" fill="{fill}"/>')
    def render(self, title, markers):
        defs = "".join(f'<marker id="{k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="{c}"/></marker>' for k, c in markers.items())
        grad = ('<linearGradient id="gemini" x1="0" y1="0" x2="1" y2="1">'
                '<stop offset="0" stop-color="#1BA1E3"/><stop offset="0.35" stop-color="#5489D6"/>'
                '<stop offset="0.65" stop-color="#9B72CB"/><stop offset="1" stop-color="#D96570"/></linearGradient>')
        return (f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{self.w}" height="{self.h}" viewBox="0 0 {self.w} {self.h}" font-family="{FONT}">'
                f'<title>{esc(title)}</title><defs>{grad}{defs}</defs><rect width="{self.w}" height="{self.h}" fill="#fff"/>' + "".join(self.p) + "</svg>")

def icon(kind, x, y, color, scale=1.0):
    g = f'<g transform="translate({x},{y}) scale({scale})" fill="none" stroke="{color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'
    d = {
        "person": '<circle cx="12" cy="8" r="4"/><path d="M4,22 c0,-5 4,-7 8,-7 s8,2 8,7"/>',
        "terminal": '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7,9 l3,3 l-3,3 M12,15 h5"/>',
        "run": '<path d="M4,6 h16 M4,12 h10 M4,18 h16"/><circle cx="18" cy="12" r="2.5"/>',
        "db": '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4,5 v14 a8,3 0 0 0 16,0 v-14 M4,12 a8,3 0 0 0 16,0"/>',
        "key": '<circle cx="8" cy="12" r="4"/><path d="M12,12 h9 M18,12 v3 M21,12 v3"/>',
        "build": '<path d="M4,20 l6,-6 M14,4 l6,6 l-4,4 l-6,-6 z M12,10 l-8,8 v2 h2 l8,-8"/>',
        "calendar": '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3,10 h18 M8,3 v4 M16,3 v4"/>',
        "drive": '<path d="M9,3 h6 l6,11 l-3,5 h-12 l-3,-5 z M9,3 l3,5.5 M15,3 l-6,11 M21,14 h-12"/>',
        "spark": '<path d="M12,0 Q12,12 24,12 Q12,12 12,24 Q12,12 0,12 Q12,12 12,0 z" fill="url(#gemini)" stroke="none"/>',
        "browser": '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3,9 h18 M6.5,6.5 h.01 M9.5,6.5 h.01"/>',
        "api": '<path d="M8,7 l-5,5 l5,5 M16,7 l5,5 l-5,5 M14,4 l-4,16"/>',
        "cloud": '<path d="M7,19 h11 a4,4 0 0 0 0,-8 a6,6 0 0 0 -11.5,-1 a4.5,4.5 0 0 0 .5,9 z"/>',
    }[kind]
    return g + d + "</g>"

# ================================================================ 1. PROCESS FLOW (swimlane flowchart)
def process_flow():
    W, H = 1800, 800
    s = SVG(W, H)
    LX, LW, LABEL = 40, 1720, 110
    lanes = [("LEAVER", "departing employee", 40, 190, "#FFFFFF"), ("HANDOVER", "Gemini agents", 230, 360, "#F6F9FE"), ("SUCCESSOR", "person taking over", 590, 155, "#FFFFFF")]
    for name, sub, y, h, fill in lanes:
        s.rect(LX, y, LW, h, rx=0, fill=fill, stroke=LINE, sw=1.2)
        s.rect(LX, y, LABEL, h, rx=0, fill="#F8F9FA", stroke=LINE, sw=1.2)
        s.text(LX + LABEL / 2, y + h / 2 - 2, name, 11, 700, INK, "middle", ls=1.4)
        s.text(LX + LABEL / 2, y + h / 2 + 14, sub, 10, 400, MUTED, "middle")

    C = [250 + i * 200 for i in range(8)]       # column centres
    YL, Y1, Y2, YS = 135, 320, 500, 667         # row centres
    RW, RH = 160, 64                             # process
    DW, DH = 150, 84                             # decision

    def term(cx, cy, label, fill="#fff"):
        w = max(140, int(len(label) * 7.6 + 36))
        s.rect(cx - w / 2, cy - 22, w, 44, rx=22, fill=fill, stroke=INK, sw=1.6)
        s.text(cx, cy + 5, label, 13, 600, INK, "middle")
    def proc(cx, cy, lines, gem=False, accent=None):
        s.rect(cx - RW / 2, cy - RH / 2, RW, RH, rx=4, fill="#fff", stroke=accent or INK, sw=1.6)
        s.clines(cx, cy, lines, 12.5, 16, 500)
        if gem: s.sparkle(cx + RW / 2 - 13, cy - RH / 2 + 13, 9)
    def dec(cx, cy, lines, gem=False):
        s.raw(f'<path d="M{cx},{cy-DH/2} L{cx+DW/2},{cy} L{cx},{cy+DH/2} L{cx-DW/2},{cy} z" fill="{YELLOW_L}" stroke="{INK}" stroke-width="1.6" stroke-linejoin="round"/>')
        s.clines(cx, cy, lines, 12, 15, 600)
        if gem: s.sparkle(cx, cy - DH / 2 + 1, 8)
    def cyl(cx, cy, label, sub):
        w, h, ry = 150, 70, 10
        x, y = cx - w / 2, cy - h / 2
        s.raw(f'<path d="M{x},{y+ry} v{h-2*ry} a{w/2},{ry} 0 0 0 {w},0 v-{h-2*ry}" fill="{GREEN_L}" stroke="{GREEN}" stroke-width="1.6"/>')
        s.raw(f'<ellipse cx="{cx}" cy="{y+ry}" rx="{w/2}" ry="{ry}" fill="{GREEN_L}" stroke="{GREEN}" stroke-width="1.6"/>')
        s.text(cx, cy + 8, label, 12.5, 600, INK, "middle")
        s.text(cx, cy + 24, sub, 10.5, 400, MUTED, "middle")

    # nodes
    term(C[0], YL, "Employee resigns")
    proc(C[1], YL, ["Connect Drive", "& Calendar"])
    proc(C[1], Y1, ["Extract knowledge", "from each document"], gem=True)
    proc(C[2], Y1, ["Merge & link", "records"], gem=True)
    proc(C[3], Y1, ["Raise a question for", "every missing reason"], gem=True)
    dec(C[4], Y1, ["Open", "questions?"])
    proc(C[5], YL, ["Answer, by voice", "or text (Ari)"], gem=True)
    dec(C[5], Y1, ["Enough to", "act on?"], gem=True)
    proc(C[6], Y1, ["Final review of", "all answers"], gem=True)
    dec(C[7], Y1, ["All reasons", "captured?"], gem=True)
    cyl(C[7], Y2, "Knowledge base", "Firestore")
    proc(C[6], Y2, ["Answer from the", "knowledge base,", "citing records"], gem=True)
    term(C[4], YS, "Successor starts")
    proc(C[5], YS, ["Ask, browse the map", "or use an AI tool"])
    term(C[7] - 20, YS, "Action backed by rationale", GREEN_L)

    # edges
    A = lambda d, **k: s.path(d, **k)
    A(f"M{C[0]+70},{YL} H{C[1]-RW/2-1}")
    A(f"M{C[1]},{YL+22} V{Y1-RH/2-1}")
    A(f"M{C[1]+RW/2},{Y1} H{C[2]-RW/2-1}")
    A(f"M{C[2]+RW/2},{Y1} H{C[3]-RW/2-1}")
    A(f"M{C[3]+RW/2},{Y1} H{C[4]-DW/2-1}")
    # D1 yes -> answer
    A(f"M{C[4]},{Y1-DH/2} V{YL} H{C[5]-RW/2-1}"); s.label(C[4] + 20, Y1 - DH / 2 - 14, "Yes", 11, INK, "middle")
    # answer -> D2
    A(f"M{C[5]},{YL+RH/2} V{Y1-DH/2-1}")
    # D2 yes -> D1 (saved)
    A(f"M{C[5]-DW/2},{Y1} H{C[4]+DW/2+1}"); s.label((C[4] + C[5]) / 2, Y1 - 10, "Yes", 11, INK)
    # D2 no -> answer (sharper follow-up)
    xr = C[5] + DW / 2 + 30
    A(f"M{C[5]+DW/2},{Y1} H{xr} V{YL} H{C[5]+RW/2+1}"); s.label(xr + 6, Y1 - 44, "No", 11, INK, "start")
    s.label((xr + C[7]) / 2, YL - 10, "ask again", 10.5, MUTED, "middle", 500)
    # D1 no -> final review (enters from below)
    ym = (Y1 + Y2) / 2 - 10
    A(f"M{C[4]},{Y1+DH/2} V{ym} H{C[6]} V{Y1+RH/2+1}"); s.label(C[4] + 14, Y1 + DH / 2 + 18, "No", 11, INK, "start")
    # final review -> D3
    A(f"M{C[6]+RW/2},{Y1} H{C[7]-DW/2-1}")
    # D3 no -> answer (joins the follow-up line)
    A(f"M{C[7]},{Y1-DH/2} V{YL} H{xr+1}", end=False); s.label(C[7] + 14, Y1 - DH / 2 - 14, "No", 11, INK, "start")
    # D3 yes -> knowledge base
    A(f"M{C[7]},{Y1+DH/2} V{Y2-35-1}", stroke=GREEN, marker="g"); s.label(C[7] + 14, Y1 + DH / 2 + 18, "Yes · signed off", 11, GREEN, "start")
    # kb -> answer with sources
    A(f"M{C[7]-75},{Y2} H{C[6]+RW/2+1}", stroke=GREEN, marker="g")
    # successor
    A(f"M{C[4]+70},{YS} H{C[5]-RW/2-1}")
    A(f"M{C[5]+RW/2},{YS} H{C[6]-40} V{Y2+RH/2+1}")
    A(f"M{C[6]+40},{Y2+RH/2} V{YS} H{C[7]-20-116}")

    # legend
    ly = 772
    s.rect(60, ly - 11, 36, 22, rx=11, fill="#fff", stroke=INK, sw=1.4); s.text(104, ly + 4, "Start / end", 11.5, 400, MUTED)
    s.rect(200, ly - 11, 36, 22, rx=3, fill="#fff", stroke=INK, sw=1.4); s.text(244, ly + 4, "Process", 11.5, 400, MUTED)
    s.raw(f'<path d="M{330},{ly-12} L{352},{ly} L{330},{ly+12} L{308},{ly} z" fill="{YELLOW_L}" stroke="{INK}" stroke-width="1.4"/>'); s.text(362, ly + 4, "Decision", 11.5, 400, MUTED)
    s.raw(f'<ellipse cx="{462}" cy="{ly-6}" rx="14" ry="4" fill="{GREEN_L}" stroke="{GREEN}" stroke-width="1.4"/><path d="M448,{ly-6} v12 a14,4 0 0 0 28,0 v-12" fill="{GREEN_L}" stroke="{GREEN}" stroke-width="1.4"/>'); s.text(486, ly + 4, "Data store", 11.5, 400, MUTED)
    s.sparkle(582, ly, 9); s.text(598, ly + 4, "Gemini does this step", 11.5, 400, MUTED)
    return s.render("Handover: process flow", {"a": MUTED, "g": GREEN})

# ================================================================ 2. ARCHITECTURE (Google Cloud architecture-diagram style)
def architecture():
    W, H = 1800, 800
    s = SVG(W, H)

    def zone(x, y, w, h, title, color, fill, dash=None, note=None):
        s.rect(x, y, w, h, rx=12, fill=fill, stroke=color, sw=1.5, dash=dash)
        s.text(x + 18, y + 26, title, 12, 700, color, ls=1.4)
        if note: s.text(x + w - 18, y + 26, note, 11.5, 400, MUTED, "end")

    def card(x, y, w, h, ic, color, name, role):
        """Icon on top, name, one-line role."""
        s.rect(x, y, w, h, rx=10, fill="#fff", stroke=LINE, sw=1.5)
        cx = x + w / 2
        s.circle(cx, y + 36, 22, color + "22")
        s.raw(icon(ic, cx - 14, y + 22, color, 1.15))
        s.text(cx, y + 80, name, 15, 700, INK, "middle")
        s.text(cx, y + 99, role, 12, 400, MUTED, "middle")

    def wide(x, y, w, h, ic, color, name, role, chips=()):
        """Icon on the left, name and role beside it, chips underneath."""
        s.rect(x, y, w, h, rx=10, fill="#fff", stroke=LINE, sw=1.5)
        s.circle(x + 40, y + 36, 22, color + "22")
        s.raw(icon(ic, x + 26, y + 22, color, 1.15))
        s.text(x + 76, y + 32, name, 15, 700, INK)
        s.text(x + 76, y + 51, role, 12, 400, MUTED)
        n = 3
        cw = (w - 40 - (n - 1) * 10) / n
        for i, c in enumerate(chips):
            cx = x + 20 + (i % n) * (cw + 10); cy = y + 74 + (i // n) * 30
            s.rect(cx, cy, cw, 24, rx=12, fill=SOFT, stroke="none", sw=0)
            s.text(cx + cw / 2, cy + 16, c, 11.5, 600, "#3C4043", "middle")

    # ---- users and their data (outside the cloud)
    zone(50, 60, 300, 330, "USERS", MUTED, "#fff")
    card(80, 110, 240, 110, "person", INK, "Leaver", "web browser")
    card(80, 250, 240, 110, "person", INK, "Successor", "web browser · AI tools via MCP")
    zone(50, 430, 300, 230, "GOOGLE WORKSPACE", MUTED, "#fff")
    card(80, 475, 110, 110, "drive", "#1FA463", "Drive", "documents")
    card(210, 475, 110, 110, "calendar", BLUE, "Calendar", "events")
    s.text(200, 630, "the leaver's own data, read-only", 11.5, 400, MUTED, "middle")

    # ---- google cloud
    zone(440, 60, 1060, 690, "GOOGLE CLOUD", "#174EA6", "#F8FAFD", dash="8 6",
         note="one project · asia-southeast1 · service-account auth, no API key · secrets in Secret Manager")

    # cloud run as a container with its parts
    RX, RY, RW, RH = 480, 110, 480, 600
    s.rect(RX, RY, RW, RH, rx=12, fill="#fff", stroke=BLUE, sw=2)
    s.raw(icon("run", RX + 18, RY + 14, BLUE, 1.0))
    s.text(RX + 50, RY + 31, "Cloud Run", 15, 700, "#174EA6")
    s.text(RX + 50, RY + 49, "the Handover app · one container", 12, 400, MUTED)
    cw = (RW - 40 - 2 * 16) / 3
    for i, (t_, r_, ic_) in enumerate([("Web UI", "React", "browser"), ("REST API", "FastAPI", "api"), ("MCP server", "for AI tools", "terminal")]):
        card(RX + 20 + i * (cw + 16), RY + 70, cw, 118, ic_, BLUE, t_, r_)
    wide(RX + 20, RY + 215, RW - 40, 140, "spark", GEM, "Gemini agents", "six steps, each tied to something the user sees",
         ["Extract", "Consolidate", "Audit gaps", "Interview (Ari)", "Final review", "Answer"])
    wide(RX + 20, RY + 382, RW - 40, 70, "drive", "#1FA463", "Drive + Calendar reader", "OAuth 2.0 · read-only · one token per leaver")
    s.rect(RX + 20, RY + 480, RW - 40, 70, rx=10, fill="#fff", stroke=LINE, sw=1.5)
    s.circle(RX + 60, RY + 515, 22, ORANGE + "22"); s.raw(icon("db", RX + 46, RY + 501, ORANGE, 1.15))
    s.text(RX + 96, RY + 511, "Store", 15, 700, INK); s.text(RX + 96, RY + 530, "evidence layer + merged layer, written by the agents", 12, 400, MUTED)
    s.text(RX + RW / 2, RY + RH - 16, "one instance, CPU always on · built from the public repo", 11.5, 400, MUTED, "middle")

    # the managed services, one card each
    card(1180, 170, 260, 130, "build", GREEN, "Cloud Build", "builds + deploys the container")
    card(1180, 330, 260, 130, "spark", GEM, "Vertex AI", "Gemini 3.8 Flash · Flash TTS")
    card(1180, 560, 260, 130, "db", ORANGE, "Firestore", "knowledge base · one per leaver")

    # ---- numbered arrows
    mk = {BLUE: "b", GEM: "p", ORANGE: "o", RED: "r", GREEN: "g", "#1FA463": "g", INK: "a"}
    def arrow(d, n, lx, ly, color, dash=None, both=False):
        s.path(d, stroke=color, sw=2, dash=dash, marker=mk[color], start=both)
        s.num(lx, ly, n, color, 12, 12)
    arrow(f"M320,165 H400 V{RY+129} H{RX-2}", 1, 360, 165, BLUE)
    arrow(f"M320,305 H430 V{RY+170} H{RX-2}", 5, 360, 305, BLUE)
    arrow(f"M{RX},{RY+417} H352", 2, 415, RY + 417, "#1FA463")
    arrow(f"M{RX+RW},{RY+285} H1178", 3, 1070, RY + 285, GEM)
    arrow(f"M{RX+RW},{RY+515} H1178", 4, 1070, RY + 515, ORANGE, both=True)
    arrow(f"M1180,{RY+125} H{RX+RW+2}", 6, 1070, RY + 125, GREEN, dash="6 4")

    # ---- key
    KX, KY = 1550, 86
    s.text(KX, KY, "WHAT HAPPENS", 12, 700, INK, ls=1.4)
    key = [(1, BLUE, "The leaver signs in with Google", "and grants read-only access"),
           (2, "#1FA463", "The app reads their Drive files", "and Calendar events"),
           (3, GEM, "Gemini extracts knowledge, raises", "questions, interviews, answers"),
           (4, ORANGE, "Everything is stored per leaver:", "records, questions, answers"),
           (5, BLUE, "The successor asks in the web app", "or from their AI tools over MCP"),
           (6, GREEN, "One command builds the image", "and deploys a new revision")]
    for i, (n, c, l1, l2) in enumerate(key):
        y = KY + 44 + i * 84
        s.num(KX + 12, y + 4, n, c, 12, 12)
        s.text(KX + 34, y, l1, 12.5, 400, INK)
        s.text(KX + 34, y + 18, l2, 12.5, 400, INK)
    return s.render("Handover: architecture", {"a": INK, "b": BLUE, "p": GEM, "o": ORANGE, "r": RED, "g": GREEN})

# ================================================================ 3. WIREFRAMES (low-fidelity, grey boxes)
def wireframes():
    import math
    W, H = 1800, 680
    s = SVG(W, H)
    G1, G2, G3, G4 = "#F8F9FA", "#E8EAED", "#DADCE0", "#80868B"
    FX = [40, 480, 920, 1360]; FW, FY, FH = 400, 84, 400
    s.raw('<defs><filter id="shadow" x="-5%" y="-5%" width="110%" height="115%"><feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#202124" flood-opacity="0.10"/></filter>'
          '<radialGradient id="glow-gold"><stop offset="0" stop-color="#e9b44c" stop-opacity="0.45"/><stop offset="1" stop-color="#e9b44c" stop-opacity="0"/></radialGradient></defs>')
    s.text(40, 46, "LEAVER'S WORKSPACE", 12, 700, INK, ls=1.6); s.path("M215,42 H880", stroke=LINE, sw=1, end=False)
    s.text(920, 46, "SUCCESSOR'S WORKSPACE", 12, 700, INK, ls=1.6); s.path("M1130,42 H1760", stroke=LINE, sw=1, end=False)

    def lbl(x, y, text, size=10, anchor="start", fill=G4):
        s.text(x, y, text, size, 700, fill, anchor, ls=0.8)
    def box(x, y, w, h, label=None, fill=G1, dash=None, rx=8, size=10, stroke=None, color=G4):
        s.rect(x, y, w, h, rx=rx, fill=fill, stroke=stroke or G3, sw=1, dash=dash)
        if label: lbl(x + w / 2, y + h / 2 + 4, label, size, "middle", color)
    def bars(x, y, w, n, lh=12, h=6, last=0.6, fill=G3):
        for i in range(n):
            s.rect(x, y + i * lh, w if i < n - 1 else w * last, h, rx=3, fill=fill, stroke="none", sw=0)
        return y + n * lh
    def button(x, y, w, label, fill=BLUE):
        s.rect(x, y, w, 26, rx=13, fill=fill, stroke="none", sw=0)
        s.text(x + w / 2, y + 17, label, 11, 600, "#fff", "middle")

    def frame(x, title, nav, active):
        s.raw(f'<rect x="{x}" y="{FY}" width="{FW}" height="{FH}" rx="10" fill="#fff" stroke="{G3}" stroke-width="1" filter="url(#shadow)"/>')
        SW = 104
        s.raw(f'<path d="M{x+10},{FY} H{x+SW} V{FY+FH} H{x+10} a10,10 0 0 1 -10,-10 V{FY+10} a10,10 0 0 1 10,-10 z" fill="{G1}"/>')
        s.path(f"M{x+SW},{FY} V{FY+FH}", stroke=G2, sw=1, end=False)
        s.text(x + 16, FY + 32, "Handover", 13, 700, INK)
        for i, item in enumerate(nav):
            iy = FY + 58 + i * 30
            if item == active:
                s.rect(x + 8, iy, SW - 16, 24, rx=6, fill=BLUE_L, stroke="none", sw=0)
                s.text(x + 18, iy + 16, item, 11, 700, BLUE)
            else:
                s.text(x + 18, iy + 16, item, 11, 500, G4)
        cx = x + SW + 20
        s.text(cx, FY + 36, title, 15, 700, INK)
        s.path(f"M{x+SW},{FY+54} H{x+FW}", stroke=G2, sw=1, end=False)
        return cx, FY + 74, FW - SW - 40

    def caption(i, x, title, lines):
        s.rect(x, FY + FH + 28, 26, 22, rx=6, fill=BLUE_L, stroke="none", sw=0)
        s.text(x + 13, FY + FH + 44, f"{i}", 12, 700, BLUE, "middle")
        s.text(x + 36, FY + FH + 45, title, 20, 700)
        for j, l in enumerate(lines): s.text(x, FY + FH + 74 + j * 22, l, 15, 400, MUTED)

    # ---- 1 written questions
    cx, cy, cw = frame(FX[0], "Written questions", ["Questions", "Interview"], "Questions")
    lbl(cx, cy, "4 OF 12 ANSWERED"); s.text(cx + cw, cy, "33%", 10, 700, BLUE, "end")
    s.rect(cx, cy + 8, cw, 5, rx=3, fill=G2, stroke="none", sw=0); s.rect(cx, cy + 8, cw / 3, 5, rx=3, fill=BLUE, stroke="none", sw=0)
    qy = cy + 30
    s.rect(cx, qy, cw, 250, rx=10, fill="#fff", stroke=G3, sw=1)
    lbl(cx + 14, qy + 24, "QUESTION"); bars(cx + 14, qy + 34, cw - 28, 2, 12, 7, 0.7, G4)
    s.rect(cx + 14, qy + 70, cw - 28, 58, rx=8, fill=G1, stroke="none", sw=0)
    s.rect(cx + 14, qy + 70, 3, 58, rx=1.5, fill=BLUE, stroke="none", sw=0)
    lbl(cx + 28, qy + 88, "EVIDENCE QUOTE", 8); bars(cx + 28, qy + 98, cw - 56, 2, 11, 5, 0.5, G3)
    s.rect(cx + 14, qy + 142, cw - 28, 58, rx=8, fill="#fff", stroke=G3, sw=1)
    s.text(cx + 26, qy + 166, "Your answer…", 11, 400, G4)
    button(cx + cw - 94, qy + 212, 80, "Save")
    caption(1, FX[0], "Written questions", ["One card per gap: the question,", "the quote that raised it, an answer box"])

    # ---- 2 interview
    cx, cy, cw = frame(FX[1], "Offboarding interview", ["Questions", "Interview"], "Interview")
    ax, ay, aw, ah = cx, cy, 112, 280
    s.rect(ax, ay, aw, ah, rx=10, fill="#202124", stroke="none", sw=0)
    s.circle(ax + aw / 2, ay + 96, 36, "#2b2d31", "#5f6368", 1); s.circle(ax + aw / 2, ay + 96, 22, "#3c4043", "none", 0)
    s.text(ax + aw / 2, ay + 160, "Ari", 13, 700, "#fff", "middle"); s.text(ax + aw / 2, ay + 176, "AI interviewer", 9, 500, "#9aa0a6", "middle")
    for i, h in enumerate([8, 16, 26, 12, 30, 18, 10, 22, 8]): s.rect(ax + 14 + i * 9.5, ay + 236 - h / 2, 3.5, h, rx=2, fill="#8ab4f8", stroke="none", sw=0)
    tx, tw = ax + aw + 16, cw - aw - 16
    lbl(tx, ay + 10, "SPOKEN QUESTION"); bars(tx, ay + 20, tw, 3, 12, 7, 0.6, G4)
    s.rect(tx, ay + 70, tw, 92, rx=8, fill=G1, stroke=G3, sw=1)
    s.circle(tx + tw / 2, ay + 104, 14, "#fff", G3, 1); s.rect(tx + tw / 2 - 3, ay + 96, 6, 11, rx=3, fill=G4, stroke="none", sw=0)
    lbl(tx + tw / 2, ay + 140, "YOUR ANSWER · VOICE", 9, "middle")
    button(tx, ay + 178, 96, "●  Record", "#D93025")
    box(tx, ay + 222, tw, 58, "FOLLOW-UP, IF NEEDED", "#fff", "4 3")
    caption(2, FX[1], "Offboarding interview", ["Ari asks each question aloud, listens,", "and follows up when the answer is not enough"])

    # ---- 3 ask
    cx, cy, cw = frame(FX[2], "Ask", ["Home", "Ask", "Map", "AI tools"], "Ask")
    s.rect(cx + cw - 150, cy - 4, 150, 30, rx=15, fill=BLUE_L, stroke="none", sw=0); bars(cx + cw - 136, cy + 8, 122, 1, 12, 6, 1, "#8ab4f8")
    lbl(cx, cy + 52, "ANSWER"); bars(cx, cy + 62, cw, 4, 12, 7, 0.5)
    lbl(cx, cy + 128, "SOURCES")
    chips = [("In person", GREEN), ("Decision", "#e9b44c"), ("Person", "#4285F4")]
    chw = (cw - 16) / 3
    for i, (name, col) in enumerate(chips):
        bx = cx + i * (chw + 8)
        s.rect(bx, cy + 138, chw, 30, rx=15, fill="#fff", stroke=G3, sw=1)
        s.circle(bx + 14, cy + 153, 4, col); s.text(bx + 24, cy + 157, name, 9.5, 600, INK)
    s.rect(cx, FY + FH - 60, cw, 38, rx=19, fill="#fff", stroke=G3, sw=1)
    s.text(cx + 16, FY + FH - 36, "Ask a question…", 11, 400, G4)
    s.circle(cx + cw - 19, FY + FH - 41, 13, BLUE); s.path(f"M{cx+cw-23},{FY+FH-41} h8 M{cx+cw-18},{FY+FH-45} l4,4 l-4,4", stroke="#fff", sw=1.6, end=False)
    caption(3, FX[2], "Ask", ["A chat that answers only from the handover", "and shows its sources"])

    # ---- 4 knowledge map: constellation
    cx, cy, cw = frame(FX[3], "Knowledge map", ["Home", "Ask", "Map", "AI tools"], "Map")
    tgx, tgw = cx + cw - 150, 150
    s.rect(tgx, cy - 4, tgw, 26, rx=13, fill=G1, stroke=G3, sw=1)
    s.rect(tgx + 62, cy - 2, 86, 22, rx=11, fill="#fff", stroke=G3, sw=1)
    s.text(tgx + 31, cy + 13, "Groups", 10, 500, G4, "middle"); s.text(tgx + 105, cy + 13, "Constellation", 10, 700, INK, "middle")
    kx, ky, kw, kh = cx, cy + 32, cw, FY + FH - 34 - (cy + 32)
    s.rect(kx, ky, kw, kh, rx=10, fill="#121217", stroke="none", sw=0)
    s.raw(f'<clipPath id="sky"><rect x="{kx}" y="{ky}" width="{kw}" height="{kh}" rx="10"/></clipPath><g clip-path="url(#sky)">')
    mx, my = kx + kw / 2, ky + kh / 2 + 2
    hubs = [(-138, "#e9b44c", "Decisions", 6, 4), (-42, "#a78bfa", "Rules", 6, 4), (42, "#5cc8ff", "People", 6, 4), (138, "#f97066", "Unfinished", 12, 5)]
    for i, (ang, col, name, count, n) in enumerate(hubs):
        s.raw(f'<radialGradient id="neb{i}"><stop offset="0" stop-color="{col}" stop-opacity="0.16"/><stop offset="1" stop-color="{col}" stop-opacity="0"/></radialGradient>')
        a = math.radians(ang); hx, hy = mx + 74 * math.cos(a), my + 62 * math.sin(a)
        nx, ny = mx + 100 * math.cos(a), my + 84 * math.sin(a)
        s.circle(nx, ny, 58, f"url(#neb{i})")
        s.raw(f'<path d="M{mx},{my} L{hx},{hy}" stroke="{col}" stroke-opacity="0.4" stroke-width="1" fill="none"/>')
        stars = []
        for j in range(n):
            sa = math.radians(ang + (-46 + j * (92 / max(n - 1, 1)))); d = [34, 44, 38, 46, 36][j]
            sx, sy = hx + d * math.cos(sa), hy + d * math.sin(sa)
            s.raw(f'<path d="M{hx},{hy} L{sx},{sy}" stroke="{col}" stroke-opacity="0.35" stroke-width="0.8" fill="none"/>')
            stars.append((sx, sy, j % 2 == 0))
        for sx, sy, answered in stars:
            if answered: s.raw(f'<circle cx="{sx}" cy="{sy}" r="5.2" fill="none" stroke="{col}" stroke-opacity="0.8" stroke-width="0.9"/>')
            s.circle(sx, sy, 2.8, col); s.circle(sx, sy, 1.2, "#fff")
        s.raw(f'<circle cx="{hx}" cy="{hy}" r="9" fill="{col}" fill-opacity="0.22" stroke="{col}" stroke-width="1.2"/>')
        s.text(hx, hy + 3, str(count), 8, 700, col, "middle")
        right, low = math.cos(a) > 0, math.sin(a) > 0
        s.text(kx + kw - 12 if right else kx + 12, ky + kh - 12 if low else ky + 18, f"{name.upper()} · {count}", 7.5, 700, col, "end" if right else "start", ls=0.8)
    s.circle(mx, my, 34, "url(#glow-gold)")
    s.circle(mx, my, 13, "#121217", "#e9b44c", 1.2)
    s.text(mx, my + 3, "Maya", 8.5, 400, "#ece9e2", "middle", italic=True, family="Georgia, 'Times New Roman', serif")
    s.raw("</g>")
    s.raw(f'<circle cx="{kx+8}" cy="{ky+kh+13}" r="4.4" fill="none" stroke="{G4}" stroke-width="0.9"/><circle cx="{kx+8}" cy="{ky+kh+13}" r="2.2" fill="{G4}"/>')
    s.text(kx + 18, ky + kh + 16, "ring: explained in person", 8, 500, G4)
    caption(4, FX[3], "Knowledge map", ["A hub per type, every record a star around the leaver;", "a ring marks what she explained in person"])
    return s.render("Handover: wireframes", {"a": INK})

if __name__ == "__main__":
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    for name, svg in [("process-flow", process_flow()), ("architecture", architecture()), ("wireframes", wireframes())]:
        with open(os.path.join(out, name + ".svg"), "w") as fh:
            fh.write(svg)
        print("wrote", name)

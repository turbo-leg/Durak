"""Export the current audit and roadmap to a readable PDF using ReportLab."""

from pathlib import Path
from html import escape
import re

from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    HRFlowable,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'docs' / 'exports' / 'Durak_Project_Audit_and_Roadmap.pdf'
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
FONTS = Path('C:/Windows/Fonts')
for name, filename in [('Report', 'segoeui.ttf'), ('ReportBold', 'segoeuib.ttf'),
                       ('ReportItalic', 'segoeuii.ttf'), ('ReportMono', 'consola.ttf')]:
    pdfmetrics.registerFont(TTFont(name, str(FONTS / filename)))
pdfmetrics.registerFontFamily('Report', normal='Report', bold='ReportBold', italic='ReportItalic')

INK = colors.HexColor('#172a36')
TEAL = colors.HexColor('#126b68')
MUTED = colors.HexColor('#526570')
PALE = colors.HexColor('#edf3f4')
WIDTH = 7.0 * inch
styles = getSampleStyleSheet()
styles.add(ParagraphStyle('BodyReport', fontName='Report', fontSize=9.2, leading=14,
                          textColor=INK, spaceAfter=7))
styles.add(ParagraphStyle('TableReport', parent=styles['BodyReport'], fontSize=8.1,
                          leading=11.5, spaceAfter=0))
styles.add(ParagraphStyle('TitleReport', fontName='ReportBold', fontSize=33, leading=39,
                          textColor=INK, spaceAfter=18))
styles.add(ParagraphStyle('H1Report', fontName='ReportBold', fontSize=23, leading=29,
                          textColor=INK, spaceAfter=15, keepWithNext=True))
styles.add(ParagraphStyle('H2Report', fontName='ReportBold', fontSize=15, leading=20,
                          textColor=TEAL, spaceBefore=15, spaceAfter=8, keepWithNext=True))
styles.add(ParagraphStyle('H3Report', fontName='ReportBold', fontSize=11.5, leading=16,
                          textColor=INK, spaceBefore=11, spaceAfter=6, keepWithNext=True))
styles.add(ParagraphStyle('BulletReport', parent=styles['BodyReport'], leftIndent=13,
                          firstLineIndent=-10))
styles.add(ParagraphStyle('Eyebrow', fontName='ReportBold', fontSize=9, leading=14,
                          textColor=TEAL, spaceAfter=14))


def inline(value):
    value = escape(value)
    value = re.sub(r'`([^`]+)`', r'<font name="ReportMono" size="8">\1</font>', value)
    value = re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', value)
    # Local Markdown links become labels; the source filenames remain in the report.
    value = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'\1', value)
    return value


def para(value, style='BodyReport'):
    return Paragraph(inline(value), styles[style])


def add_table(story, rows):
    # Long findings are easier to scan as individual blocks than a narrow 3-column table.
    if rows[0][0] == 'Priority':
        for priority, finding, action in rows[1:]:
            story.append(para(priority + ' / ' + finding, 'H3Report'))
            story.append(para('**Action:** ' + action))
        return
    if rows[0][0] == 'Layer':
        for layer, responsibility, evidence in rows[1:]:
            story.append(para(layer, 'H3Report'))
            story.append(para(responsibility))
            story.append(para('**Evidence and limits:** ' + evidence))
        return
    widths = [WIDTH * 0.35, WIDTH * 0.65] if len(rows[0]) == 2 else None
    data = [[para(cell, 'TableReport') for cell in row] for row in rows]
    table = Table(data, colWidths=widths, repeatRows=1, hAlign='LEFT')
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PALE),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 9),
        ('RIGHTPADDING', (0, 0), (-1, -1), 9),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LINEBELOW', (0, 0), (-1, -1), 0.4, colors.HexColor('#d5e0e3')),
    ]))
    story.extend([table, Spacer(1, 10)])


def add_markdown(story, path):
    lines = path.read_text(encoding='utf-8-sig').splitlines()
    index = 0
    while index < len(lines):
        line = lines[index].strip()
        if not line:
            index += 1
            continue
        if line.startswith('|'):
            rows = []
            while index < len(lines) and lines[index].strip().startswith('|'):
                cells = [cell.strip() for cell in lines[index].strip().strip('|').split('|')]
                if not all(re.fullmatch(r':?-+:?', cell) for cell in cells):
                    rows.append(cells)
                index += 1
            add_table(story, rows)
            continue
        heading = re.match(r'^(#{1,3})\s+(.+)', line)
        if heading:
            if heading[2] == 'Tranche 0 results':
                story.append(PageBreak())
            story.append(para(heading[2], f'H{len(heading[1])}Report'))
            index += 1
            continue
        bullet = re.match(r'^(?:- |\d+\. )(.+)', line)
        if bullet:
            text = bullet[1].replace('[x] ', 'Completed: ').replace('[ ] ', 'Planned: ')
            story.append(para('• ' + text, 'BulletReport'))
            index += 1
            continue
        paragraph = [line]
        index += 1
        while index < len(lines) and lines[index].strip() and not re.match(
            r'^(?:#|\||- |\d+\. )', lines[index].strip()
        ):
            paragraph.append(lines[index].strip())
            index += 1
        story.append(para(' '.join(paragraph)))


def page_footer(canvas, document):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor('#d5e0e3'))
    canvas.line(54, 40, 558, 40)
    canvas.setFont('Report', 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(54, 26, 'DURAK  /  Technical audit & implementation roadmap  /  20 Oct 2026')
    canvas.drawRightString(558, 26, str(document.page))
    canvas.restoreState()


story = [Spacer(1, 42), para('DURAK PROJECT MANAGER / ENGINEERING REPORT', 'Eyebrow'),
         Paragraph('Durak<br/>Project Audit<br/>&amp; Roadmap', styles['TitleReport']),
         para('20 October 2026'), Spacer(1, 16),
         HRFlowable(width=WIDTH, thickness=2, color=TEAL), Spacer(1, 20),
         para('Current status', 'H2Report'),
         para('The existing React / Colyseus / shared-rules monorepo has a substantial '
              'working gameplay core. A playable Three.js table and multiplayer integrity '
              'tranche are implemented. Further polish and public-release validation remain.'),
         para('**Baseline:** 218 tests passed; four lint warnings; ten server type errors; '
              'root production build failed.'),
         para('**Current checks:** 297 tests pass, all workspace type checks pass, '
              'client lint is clean and the root build succeeds. The client bundle-size warning remains.'),
         para('**Implemented:** private network state, verified room identities, lobby guards, '
              'a real 3D table, complete bot and two-client browser matches, rematch/refresh '
              'recovery and WebGL fallback. Custom shared engine rules are retained.'),
         para('**Next release blockers:** four high dependency advisories remain after compatible '
              'updates removed all critical findings. Physical-device performance, production '
              'persistence, Redis, external Discord integration and deployment need validation.'),
         Spacer(1, 12), para('Report contents', 'H2Report'),
         para('1. Full project audit — architecture, baseline checks, prioritized findings and custom rules.'),
         para('2. Implementation roadmap — milestones, acceptance criteria and first-tranche results.'),
         Spacer(1, 12),
         para('Source of record: docs/PROJECT_AUDIT.md and docs/PROJECT_PLAN.md. '
              'The audit describes the original baseline; the roadmap records subsequent fixes. '
              'Local browser smoke checks passed; no deployment or complete production acceptance '
              'run has been performed.'), PageBreak()]
add_markdown(story, ROOT / 'docs' / 'PROJECT_AUDIT.md')
story.append(PageBreak())
add_markdown(story, ROOT / 'docs' / 'PROJECT_PLAN.md')

document = SimpleDocTemplate(str(OUTPUT), pagesize=(612, 792),
    leftMargin=54, rightMargin=54, topMargin=48, bottomMargin=56,
    title='Durak Project Audit and Implementation Roadmap',
    author='Durak Project Manager', subject='Technical audit, release blockers and implementation roadmap')
document.build(story, onFirstPage=page_footer, onLaterPages=page_footer)
print(OUTPUT)

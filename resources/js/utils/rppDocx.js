import {
    Document, Packer, Paragraph, TextRun, HeadingLevel,
    Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType,
    VerticalAlign, convertInchesToTwip, LineRuleType, ImageRun,
    Math, MathRun, MathFraction, MathSubScript, MathSuperScript,
    MathSubSuperScript, MathRadical, MathLimitUpper, MathLimitLower,
    MathSum, MathIntegral,
    LevelFormat,
} from 'docx';
import { mml2omml } from 'mathml2omml';
import katex from 'katex';
import html2canvas from 'html2canvas';

const MATH_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/math';
const DEFAULT_FONT = 'Arial';
const LINE = { line: 360, lineRule: LineRuleType.AUTO };

const HD_REF_PREFIX = 'rpp-hd';
const HD_BULLET_REF_PREFIX = 'rpp-hd-bullet';

const buildIndent = (leftTwips, hangingTwips) => ({ left: leftTwips, hanging: hangingTwips });

const orderedLevels = [
    { level: 0, format: LevelFormat.DECIMAL, text: '%1.', style: { run: { bold: true }, paragraph: { indent: buildIndent(360, 360) } } },
    { level: 1, format: LevelFormat.LOWER_LETTER, text: '%2)', style: { run: { bold: true }, paragraph: { indent: buildIndent(720, 360) } } },
    { level: 2, format: LevelFormat.LOWER_ROMAN, text: '%3.', style: { run: { bold: true }, paragraph: { indent: buildIndent(1080, 360) } } },
];

const bulletLevels = [
    { level: 0, format: LevelFormat.BULLET, text: '\u2022', style: { run: { bold: true }, paragraph: { indent: buildIndent(360, 360) } } },
    { level: 1, format: LevelFormat.BULLET, text: '\u25E6', style: { run: { bold: true }, paragraph: { indent: buildIndent(720, 360) } } },
    { level: 2, format: LevelFormat.BULLET, text: '\u25AA', style: { run: { bold: true }, paragraph: { indent: buildIndent(1080, 360) } } },
];

const numberingConfigs = [];
let ordSeq = 0;
let bulSeq = 0;

const newListRef = (isOrdered) => {
    const reference = isOrdered
        ? `${HD_REF_PREFIX}-${ordSeq++}`
        : `${HD_BULLET_REF_PREFIX}-${bulSeq++}`;
    numberingConfigs.push({ reference, levels: isOrdered ? orderedLevels : bulletLevels });
    return reference;
};

function mathChildren(container) {
    const children = [];
    for (const child of container.children) {
        const item = toMathNode(child);
        if (item) children.push(item);
    }
    return children;
}

function toMathNode(item) {
    const local = item.localName;
    const firstMath = (name) => {
        const els = item.getElementsByTagNameNS(MATH_NS, name);
        return els.length ? els[0] : null;
    };

    switch (local) {
        case 'r': {
            const t = item.getElementsByTagNameNS(MATH_NS, 't')[0];
            return new MathRun(t ? t.textContent : '');
        }
        case 'f': {
            const num = firstMath('num');
            const den = firstMath('den');
            return new MathFraction({
                numerator: num ? mathChildren(num) : [new MathRun('')],
                denominator: den ? mathChildren(den) : [new MathRun('')],
            });
        }
        case 'sSup': {
            const e = firstMath('e');
            const sup = firstMath('sup');
            return new MathSuperScript({
                children: e ? mathChildren(e) : [new MathRun('')],
                superScript: sup ? mathChildren(sup) : [new MathRun('')],
            });
        }
        case 'sSub': {
            const e = firstMath('e');
            const sub = firstMath('sub');
            return new MathSubScript({
                children: e ? mathChildren(e) : [new MathRun('')],
                subScript: sub ? mathChildren(sub) : [new MathRun('')],
            });
        }
        case 'sSubSup': {
            const e = firstMath('e');
            const sub = firstMath('sub');
            const sup = firstMath('sup');
            return new MathSubSuperScript({
                children: e ? mathChildren(e) : [new MathRun('')],
                subScript: sub ? mathChildren(sub) : [new MathRun('')],
                superScript: sup ? mathChildren(sup) : [new MathRun('')],
            });
        }
        case 'rad': {
            const e = firstMath('e');
            const degEls = item.getElementsByTagNameNS(MATH_NS, 'deg');
            const deg = degEls.length ? mathChildren(degEls[0]) : [];
            return new MathRadical({
                children: e ? mathChildren(e) : [new MathRun('')],
                degree: deg.length ? deg : undefined,
            });
        }
        case 'limLow': {
            const e = firstMath('e');
            const lim = firstMath('lim');
            return new MathLimitLower({
                children: e ? mathChildren(e) : [new MathRun('')],
                limit: lim ? mathChildren(lim) : [new MathRun('')],
            });
        }
        case 'limUpp': {
            const e = firstMath('e');
            const lim = firstMath('lim');
            return new MathLimitUpper({
                children: e ? mathChildren(e) : [new MathRun('')],
                limit: lim ? mathChildren(lim) : [new MathRun('')],
            });
        }
        case 'nary': {
            const chr = item.getElementsByTagNameNS(MATH_NS, 'chr')[0];
            const chrVal = chr ? chr.getAttributeNS(MATH_NS, 'val') : '';
            const e = firstMath('e');
            const sub = firstMath('sub');
            const sup = firstMath('sup');
            const children = e ? mathChildren(e) : [new MathRun('')];
            const subChildren = sub ? mathChildren(sub) : [new MathRun('')];
            const supChildren = sup ? mathChildren(sup) : [new MathRun('')];
            if (chrVal === '\u222B') {
                return new MathIntegral({ children, subScript: subChildren, superScript: supChildren });
            }
            return new MathSum({ children, subScript: subChildren, superScript: supChildren });
        }
        default: {
            const sub = mathChildren(item);
            return sub.length === 1 ? sub[0] : (sub.length ? sub : null);
        }
    }
}

function convertOmmlToMath(ommlString) {
    const dom = new DOMParser().parseFromString(ommlString, 'text/xml');
    let oMath = dom.getElementsByTagNameNS(MATH_NS, 'oMath')[0];
    if (!oMath) {
        oMath = dom.querySelector('m\\:oMath, math');
    }
    if (!oMath) return null;
    return new Math({ children: mathChildren(oMath) });
}

const svgToPng = (svgString, width, height) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((png) => {
                    URL.revokeObjectURL(url);
                    if (png) resolve(png.arrayBuffer());
                    else reject(new Error('canvas.toBlob returned null'));
                }, 'image/png');
            } catch (e) {
                URL.revokeObjectURL(url);
                reject(e);
            }
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('svg image failed to load'));
        };
        img.src = url;
    });
};

async function tryCaptureVisualization(el) {
    try {
        const svg = el.querySelector('svg');
        if (svg) {
            const w = svg.getAttribute('width') || svg.viewBox?.baseVal?.width || 600;
            const h = svg.getAttribute('height') || svg.viewBox?.baseVal?.height || 400;
            return await svgToPng(svg.outerHTML, Number(w) || 600, Number(h) || 400);
        }
        const canvas = el.querySelector('canvas');
        if (canvas) {
            const blob = await new Promise((res) => {
                try { canvas.toBlob((b) => res(b), 'image/png'); }
                catch { res(null); }
            });
            if (blob) return await blob.arrayBuffer();
        }
    } catch (e) {
        console.warn('tryCaptureVisualization failed:', e);
    }
    return null;
}

async function katexSpanToImage(el) {
    const annotation = el.querySelector('annotation[encoding="application/x-tex"]');
    const latex = annotation ? annotation.textContent.trim() : '';
    if (!latex) throw new Error('no LaTeX annotation available');

    const display = !!el.closest('.katex-display');
    const holder = document.createElement('div');
    holder.style.cssText = 'position:fixed;left:-10000px;top:0;z-index:-1;background:#ffffff;white-space:nowrap;';
    // KaTeX 0.16 tidak mendukung output:'svg'; render HTML visual lalu ambil gambarnya.
    holder.innerHTML = katex.renderToString(latex, {
        output: 'html',
        displayMode: display,
        throwOnError: false
    });
    document.body.appendChild(holder);

    try {
        const rect = holder.getBoundingClientRect();
        const width = globalThis.Math.max(1, globalThis.Math.round(rect.width));
        const height = globalThis.Math.max(1, globalThis.Math.round(rect.height));
        const canvas = await html2canvas(holder, { backgroundColor: '#ffffff', scale: 2 });
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error('canvas.toBlob returned null');
        const buffer = await blob.arrayBuffer();
        return new ImageRun({
            type: 'png',
            data: new Uint8Array(buffer),
            transformation: { width, height }
        });
    } finally {
        holder.remove();
    }
}

const UNSUPPORTED_OMML = /<m:(acc|m|sPre|bar|groupChr|eqArr|func)\b/;

async function equationToDocx(el) {
    const annotation = el.querySelector('annotation[encoding="application/x-tex"]');
    const latex = annotation ? annotation.textContent.trim() : '';
    let cause = null;
    try {
        const mathElement = el.querySelector('.katex-mathml math') || el.querySelector('math');
        if (mathElement) {
            const omml = mml2omml(mathElement.outerHTML, { disableDecode: true });
            if (omml && omml.includes('oMath') && !UNSUPPORTED_OMML.test(omml)) {
                const math = convertOmmlToMath(omml);
                if (math) return math;
                cause = new Error('OMML to docx Math conversion returned empty');
            } else {
                cause = new Error('OMML conversion produced unsupported or no oMath');
            }
        } else {
            cause = new Error('no <math> element inside .katex');
        }
    } catch (e) {
        cause = e;
    }
    console.warn('Equation OMML path failed, falling back to PNG image:', cause);

    try {
        return await katexSpanToImage(el);
    } catch (e) {
        console.warn('Equation PNG fallback failed, keeping LaTeX text:', e);
        const visual = el.querySelector('.katex-html');
        const text = latex || (visual ? visual.textContent.trim() : el.textContent.trim());
        return new TextRun({ text, font: 'Cambria Math' });
    }
}

const LATEX_RE = /\\[a-zA-Z]+|\{[^}]+\}|[_^]\S/;

async function tryRawLatex(text) {
    const trimmed = text.trim();
    if (!LATEX_RE.test(trimmed)) return null;
    try {
        const html = katex.renderToString(trimmed, { throwOnError: true, displayMode: false });
        const tmp = document.createElement('span');
        tmp.innerHTML = html;
        const katexEl = tmp.querySelector('.katex');
        if (!katexEl) return null;
        return await equationToDocx(katexEl);
    } catch { return null; }
}

async function parseInline(element, inherited = {}) {
    const children = [];
    for (const node of element.childNodes) {
        if (node.nodeType === 3) {
            if (node.textContent) {
                const eq = await tryRawLatex(node.textContent);
                children.push(eq || new TextRun({ text: node.textContent, ...inherited }));
            }
            continue;
        }
        if (node.nodeType !== 1) continue;

        const tag = node.tagName.toLowerCase();
        switch (tag) {
            case 'strong':
            case 'b':
                children.push(...await parseInline(node, { ...inherited, bold: true }));
                break;
            case 'em':
            case 'i':
                children.push(...await parseInline(node, { ...inherited, italics: true }));
                break;
            case 'u':
                children.push(...await parseInline(node, { ...inherited, underline: {} }));
                break;
            case 'code':
                children.push(...await parseInline(node, { ...inherited, font: 'Courier New', size: 20 }));
                break;
            case 'span':
                if (node.classList && node.classList.contains('katex')) {
                    children.push(await equationToDocx(node));
                } else {
                    children.push(...await parseInline(node, inherited));
                }
                break;
            case 'br':
                children.push(new TextRun({ text: ' ', ...inherited }));
                break;
            default:
                children.push(...await parseInline(node, inherited));
                break;
        }
    }
    return children.length > 0 ? children : [new TextRun({ text: element.textContent, ...inherited })];
}

const headingParagraph = (level, text, runs = null) => {
    const children = runs || [new TextRun({ text: level === 1 || level === 2 ? text.toUpperCase() : text, bold: true, size: level === 1 ? 28 : 22 })];
    switch (level) {
        case 1:
            return new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 480, ...LINE },
                border: { bottom: { style: BorderStyle.DOUBLE, size: 6, color: '000000' } },
                children,
            });
        case 2:
            return new Paragraph({
                spacing: { before: 480, after: 200, ...LINE },
                border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '000000' } },
                children,
            });
        default:
            return new Paragraph({
                spacing: { before: 400, after: 200, ...LINE },
                border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'eeeeee' } },
                children,
            });
    }
};

async function parseList(listEl, { level = 0, reference } = {}) {
    const container = [];
    const isOrdered = listEl.tagName.toLowerCase() === 'ol';
    if (!reference) reference = newListRef(isOrdered);
    const currentLevel = level > 2 ? 2 : level;

    for (const node of listEl.childNodes) {
        if (node.nodeType !== 1 || node.tagName !== 'LI') continue;

        const lead = [];
        const nested = [];
        for (const n of node.childNodes) {
            if (n.nodeType === 3) {
                if (n.textContent) {
                    const eq = await tryRawLatex(n.textContent);
                    lead.push(eq || new TextRun(n.textContent));
                }
            } else if (n.nodeType === 1) {
                if (n.tagName === 'OL' || n.tagName === 'UL') {
                    nested.push(n);
                } else {
                    lead.push(...await parseInline(n));
                }
            }
        }

        const children = lead.length ? lead : [new TextRun(node.textContent)];

        container.push(new Paragraph({
            children,
            numbering: { reference, level: currentLevel },
            spacing: { after: 80, ...LINE },
        }));

        for (const nl of nested) {
            container.push(...await parseList(nl, { level: currentLevel + 1, reference }));
        }
    }
    return container;
}

const tableCellBorders = {
    top: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
    bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
    left: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
    right: { style: BorderStyle.SINGLE, size: 6, color: '000000' }
};

async function parseTable(tableEl) {
    const rows = tableEl.querySelectorAll('tr');
    const tableRows = [];

    for (const row of rows) {
        const cells = row.querySelectorAll('th, td');
        const tableCells = [];
        for (const cell of cells) {
            const runs = await parseInline(cell, cell.tagName === 'TH' ? { bold: true } : {});
            tableCells.push(new TableCell({
                children: [new Paragraph({
                    children: runs.length ? runs : [new TextRun('')],
                    alignment: cell.tagName === 'TH' ? AlignmentType.CENTER : AlignmentType.LEFT,
                    spacing: { after: 0, ...LINE }
                })],
                shading: cell.tagName === 'TH' ? { fill: 'f0f0f0' } : undefined,
                margins: { top: 120, bottom: 120, left: 180, right: 180 },
                verticalAlign: VerticalAlign.CENTER,
                borders: tableCellBorders
            }));
        }

        tableRows.push(new TableRow({
            children: tableCells
        }));
    }

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: tableRows
    });
}

const signatureCellParagraphs = (cellDiv) => {
    const ps = cellDiv.querySelectorAll('p');
    return Array.from(ps).map(p => {
        const bold = p.classList.contains('font-bold');
        const underline = p.classList.contains('underline');
        const keepSpace = p.classList.contains('mb-16');
        return new Paragraph({
            children: [new TextRun({
                text: p.textContent,
                bold,
                underline: underline ? {} : undefined
            })],
            alignment: AlignmentType.CENTER,
            spacing: { after: keepSpace ? 960 : 60, ...LINE }
        });
    });
};

const noBorders = {
    top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
};

function parseSignature(section) {
    const gridEl = section.children.length ? section.children[0] : null;
    const cells = gridEl ? Array.from(gridEl.children) : [];

    const row = new TableRow({
        cantSplit: true,
        children: cells.map(cell => new TableCell({
            children: cell.children.length
                ? signatureCellParagraphs(cell)
                : [new Paragraph({ children: [new TextRun('')] })],
            verticalAlign: VerticalAlign.TOP,
            margins: { top: 40, bottom: 40, left: 80, right: 80 },
            borders: noBorders
        }))
    });

    return [
        new Paragraph({ children: [], spacing: { before: 480 } }),
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: noBorders,
            rows: [row]
        })
    ];
}

async function parseBlock(element) {
    const children = [];

    for (const node of element.childNodes) {
        if (node.nodeType === 3) {
            const text = node.textContent.trim();
            if (text) {
                children.push(new Paragraph({
                    children: [new TextRun(text)],
                    spacing: { after: 240, ...LINE },
                    alignment: AlignmentType.JUSTIFIED
                }));
            }
            continue;
        }
        if (node.nodeType !== 1) continue;

        if (node.id === 'signature-section') {
            children.push(...parseSignature(node));
            continue;
        }

        const tag = node.tagName.toLowerCase();
        switch (tag) {
            case 'h1':
            case 'h2':
            case 'h3': {
                const level = tag === 'h1' ? 1 : tag === 'h2' ? 2 : 3;
                const runs = node.querySelector('.katex') ? await parseInline(node, { bold: true }) : null;
                children.push(headingParagraph(level, node.textContent, runs));
                break;
            }
            case 'p':
                children.push(new Paragraph({
                    children: await parseInline(node),
                    spacing: { after: 240, ...LINE },
                    alignment: AlignmentType.JUSTIFIED
                }));
                break;
            case 'ul':
            case 'ol':
                children.push(...await parseList(node));
                break;
            case 'pre':
                children.push(new Paragraph({
                    children: [new TextRun({ text: node.textContent, font: 'Courier New', size: 20 })],
                    spacing: { after: 160, ...LINE }
                }));
                break;
            case 'table':
                children.push(await parseTable(node));
                break;
            case 'span': {
                if (node.classList?.contains('katex-display')) {
                    const katexEl = node.querySelector('.katex');
                    if (katexEl) {
                        const eq = await equationToDocx(katexEl);
                        if (eq) {
                            children.push(new Paragraph({
                                children: [eq],
                                spacing: { after: 240, ...LINE },
                                alignment: AlignmentType.CENTER
                            }));
                            break;
                        }
                    }
                }
                children.push(...await parseBlock(node));
                break;
            }
            case 'div':
            case 'section': {
                if (node.classList?.contains('katex-display')) {
                    const katexEl = node.querySelector('.katex');
                    if (katexEl) {
                        const eq = await equationToDocx(katexEl);
                        if (eq) {
                            children.push(new Paragraph({
                                children: [eq],
                                spacing: { after: 240, ...LINE },
                                alignment: AlignmentType.CENTER
                            }));
                            break;
                        }
                    }
                }
                const vizEl = node.querySelector('.mermaid, .mermaid-container, .jxgbox, .scratchblocks, canvas');
                if (vizEl && !node.classList?.contains('no-print')) {
                    const imgData = await tryCaptureVisualization(node);
                    if (imgData) {
                        children.push(new Paragraph({
                            children: [new ImageRun({ data: imgData, transformation: { width: 500, height: 300 } })],
                            spacing: { after: 240, ...LINE },
                            alignment: AlignmentType.CENTER
                        }));
                    } else {
                        children.push(...await parseBlock(node));
                    }
                } else {
                    children.push(...await parseBlock(node));
                }
                break;
            }
            case 'br':
                children.push(new Paragraph({ children: [] }));
                break;
            default:
                children.push(...await parseBlock(node));
                break;
        }
    }

    return children.length > 0 ? children : [new Paragraph({ children: [] })];
}

async function generateRppDoc(element) {
    const children = await parseBlock(element);
    const doc = new Document({
        numbering: { config: numberingConfigs },
        styles: {
            default: {
                document: {
                    run: { font: DEFAULT_FONT, size: 22 },
                    paragraph: { spacing: { after: 120, line: 360, lineRule: LineRuleType.AUTO } }
                }
            }
        },
        sections: [{
            properties: {
                page: {
                    margin: {
                        top: convertInchesToTwip(1),
                        bottom: convertInchesToTwip(1),
                        left: convertInchesToTwip(1),
                        right: convertInchesToTwip(1)
                    }
                }
            },
            children: children
        }]
    });
    return Packer.toBlob(doc);
}

export { generateRppDoc };
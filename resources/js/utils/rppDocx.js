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

const MATH_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/math';
const DEFAULT_FONT = 'Arial';
const LINE = { line: 360, lineRule: LineRuleType.AUTO };

const HD_REF_PREFIX = 'rpp-hd';
const HD_BULLET_REF_PREFIX = 'rpp-hd-bullet';

const buildIndent = (leftTwips, hangingTwips) => ({ left: leftTwips, hanging: hangingTwips });

const orderedLevels = [
    { level: 0, format: LevelFormat.DECIMAL, text: '%1.', style: { paragraph: { indent: buildIndent(360, 360) } } },
    { level: 1, format: LevelFormat.LOWER_LETTER, text: '%2)', style: { paragraph: { indent: buildIndent(720, 360) } } },
    { level: 2, format: LevelFormat.LOWER_ROMAN, text: '%3.', style: { paragraph: { indent: buildIndent(1080, 360) } } },
];

const bulletLevels = [
    { level: 0, format: LevelFormat.BULLET, text: '\u2022', style: { paragraph: { indent: buildIndent(360, 360) } } },
    { level: 1, format: LevelFormat.BULLET, text: '\u25E6', style: { paragraph: { indent: buildIndent(720, 360) } } },
    { level: 2, format: LevelFormat.BULLET, text: '\u25AA', style: { paragraph: { indent: buildIndent(1080, 360) } } },
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

async function katexSpanToImage(el) {
    const annotation = el.querySelector('annotation[encoding="application/x-tex"]');
    const latex = annotation ? annotation.textContent.trim() : '';
    if (!latex) throw new Error('no LaTeX annotation available');

    const display = !!el.closest('.katex-display');
    const svg = katex.renderToString(latex, {
        output: 'svg',
        displayMode: display,
        throwOnError: false
    });

    const holder = document.createElement('div');
    holder.innerHTML = svg;
    const svgEl = holder.querySelector('svg');
    if (!svgEl) throw new Error('katex produced no svg');

    const ptToPx = (pt) => {
        const px = parseFloat(pt) * 96 / 72;
        return px > 1 ? globalThis.Math.round(px) : 1;
    };
    const width = ptToPx(svgEl.getAttribute('width') || '10');
    const height = ptToPx(svgEl.getAttribute('height') || '10');

    const buffer = await svgToPng(svg, width, height);
    return new ImageRun({
        type: 'png',
        data: new Uint8Array(buffer),
        transformation: { width, height }
    });
}

async function equationToDocx(el) {
    let cause = null;
    try {
        const mathElement = el.querySelector('.katex-mathml math') || el.querySelector('math');
        if (mathElement) {
            const omml = mml2omml(mathElement.outerHTML, { disableDecode: true });
            if (omml && omml.includes('oMath')) {
                const math = convertOmmlToMath(omml);
                if (math) return math;
            }
            cause = new Error('OMML conversion produced no oMath');
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
        console.warn('Equation PNG fallback failed, keeping plain text:', e);
        return null;
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

async function parseInline(element) {
    const children = [];
    for (const node of element.childNodes) {
        if (node.nodeType === 3) {
            if (node.textContent) {
                const eq = await tryRawLatex(node.textContent);
                children.push(eq || new TextRun(node.textContent));
            }
            continue;
        }
        if (node.nodeType !== 1) continue;

        const tag = node.tagName.toLowerCase();
        switch (tag) {
            case 'strong':
            case 'b':
                children.push(new TextRun({ text: node.textContent, bold: true }));
                break;
            case 'em':
            case 'i':
                children.push(new TextRun({ text: node.textContent, italics: true }));
                break;
            case 'u':
                children.push(new TextRun({ text: node.textContent, underline: {} }));
                break;
            case 'code':
                children.push(new TextRun({ text: node.textContent, font: 'Courier New', size: 20 }));
                break;
            case 'span':
                if (node.classList && node.classList.contains('katex')) {
                    const eq = await equationToDocx(node);
                    if (eq) {
                        children.push(eq);
                    } else {
                        children.push(new TextRun({ text: node.textContent }));
                    }
                } else {
                    children.push(...await parseInline(node));
                }
                break;
            case 'br':
                children.push(new TextRun(' '));
                break;
            default:
                children.push(...await parseInline(node));
                break;
        }
    }
    return children.length > 0 ? children : [new TextRun(element.textContent)];
}

const headingParagraph = (level, text) => {
    switch (level) {
        case 1:
            return new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 480, ...LINE },
                border: { bottom: { style: BorderStyle.DOUBLE, size: 6, color: '000000' } },
                children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 28 })],
            });
        case 2:
            return new Paragraph({
                spacing: { before: 480, after: 200, ...LINE },
                border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '000000' } },
                children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 22 })],
            });
        default:
            return new Paragraph({
                spacing: { before: 400, after: 200, ...LINE },
                border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'eeeeee' } },
                children: [new TextRun({ text: text, bold: true, size: 22 })],
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
            const runs = await parseInline(cell);
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
                children.push(headingParagraph(1, node.textContent));
                break;
            case 'h2':
                children.push(headingParagraph(2, node.textContent));
                break;
            case 'h3':
                children.push(headingParagraph(3, node.textContent));
                break;
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
            case 'div':
            case 'section':
                children.push(...await parseBlock(node));
                break;
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
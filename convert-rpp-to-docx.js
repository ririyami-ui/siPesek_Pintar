/**
 * Convert RPP HTML (with KaTeX-rendered math) to DOCX with native Word equations (OMML).
 */

import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import * as docx from 'docx';
import * as mathml2omml from 'mathml2omml';

const {
    Document, Packer, Paragraph, TextRun, HeadingLevel,
    Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType,
    convertInchesToTwip, VerticalAlign,
    Math, MathRun, MathFraction, MathSubScript, MathSuperScript,
    MathSubSuperScript, MathRadical, MathLimitUpper, MathLimitLower,
    MathSum, MathIntegral,
} = docx;

/**
 * Convert an OMML string to a docx Math object.
 *
 * Uses JSDOM to parse the OMML XML, then walks the tree to build
 * docx math nodes. All components come from the same `docx` package
 * so the rendered output uses valid Office Math (<m:oMath>) elements.
 */
function omitXmlChildren(node) {
    return Array.from(node.children).filter(n => n.namespaceURI === 'http://schemas.openxmlformats.org/officeDocument/2006/math');
}

function convertOmmlChildren(container) {
    const children = [];
    for (const child of omitXmlChildren(container)) {
        const item = convertOmmlChild(child);
        if (item) children.push(item);
    }
    return children;
}

function convertOmmlChild(item) {
    const local = item.localName; // e.g. 'r', 'f', 'sSup'
    const m = 'http://schemas.openxmlformats.org/officeDocument/2006/math';
    const firstExp = (name) => {
        const els = item.getElementsByTagNameNS(m, name);
        return els.length ? els[0] : null;
    };

    switch (local) {
        case 'r': {
            const t = item.getElementsByTagNameNS(m, 't')[0];
            return new MathRun(t ? t.textContent : '');
        }
        case 'f': {
            const num = firstExp('num');
            const den = firstExp('den');
            return new MathFraction({
                numerator: num ? convertOmmlChildren(num) : [new MathRun('')],
                denominator: den ? convertOmmlChildren(den) : [new MathRun('')],
            });
        }
        case 'sSup': {
            const e = firstExp('e');
            const sup = firstExp('sup');
            return new MathSuperScript({
                children: e ? convertOmmlChildren(e) : [new MathRun('')],
                superScript: sup ? convertOmmlChildren(sup) : [new MathRun('')],
            });
        }
        case 'sSub': {
            const e = firstExp('e');
            const sub = firstExp('sub');
            return new MathSubScript({
                children: e ? convertOmmlChildren(e) : [new MathRun('')],
                subScript: sub ? convertOmmlChildren(sub) : [new MathRun('')],
            });
        }
        case 'sSubSup': {
            const e = firstExp('e');
            const sub = firstExp('sub');
            const sup = firstExp('sup');
            return new MathSubSuperScript({
                children: e ? convertOmmlChildren(e) : [new MathRun('')],
                subScript: sub ? convertOmmlChildren(sub) : [new MathRun('')],
                superScript: sup ? convertOmmlChildren(sup) : [new MathRun('')],
            });
        }
        case 'rad': {
            const e = firstExp('e');
            const degEls = item.getElementsByTagNameNS(m, 'deg');
            const deg = degEls.length ? convertOmmlChildren(degEls[0]) : [];
            return new MathRadical({
                children: e ? convertOmmlChildren(e) : [new MathRun('')],
                degree: deg.length ? deg : undefined,
            });
        }
        case 'limLow': {
            const e = firstExp('e');
            const lim = firstExp('lim');
            return new MathLimitLower({
                children: e ? convertOmmlChildren(e) : [new MathRun('')],
                limit: lim ? convertOmmlChildren(lim) : [new MathRun('')],
            });
        }
        case 'limUpp': {
            const e = firstExp('e');
            const lim = firstExp('lim');
            return new MathLimitUpper({
                children: e ? convertOmmlChildren(e) : [new MathRun('')],
                limit: lim ? convertOmmlChildren(lim) : [new MathRun('')],
            });
        }
        case 'nary': {
            const chr = item.getElementsByTagNameNS(m, 'chr')[0];
            const chrVal = chr ? chr.getAttributeNS(m, 'val') : '';
            const e = firstExp('e');
            const sub = firstExp('sub');
            const sup = firstExp('sup');
            const children = e ? convertOmmlChildren(e) : [new MathRun('')];
            const subChildren = sub ? convertOmmlChildren(sub) : [new MathRun('')];
            const supChildren = sup ? convertOmmlChildren(sup) : [new MathRun('')];
            if (chrVal === '\u222B') {
                return new MathIntegral({ children, subScript: subChildren, superScript: supChildren });
            }
            return new MathSum({ children, subScript: subChildren, superScript: supChildren });
        }
        default:
            // Unhandled container: descend into children
            const sub = convertOmmlChildren(item);
            return sub.length ? wrapInGroup(sub) : null;
    }
}

function wrapInGroup(children) {
    if (children.length === 1) return children[0];
    return children;
}

function convertOmmlToMath(ommlString) {
    const dom = new JSDOM(ommlString, { contentType: 'text/xml' });
    const doc = dom.window.document;
    let oMath = doc.getElementsByTagNameNS('http://schemas.openxmlformats.org/officeDocument/2006/math', 'oMath')[0];
    if (!oMath) {
        oMath = dom.window.document.querySelector('m\\:oMath, m\\:math');
    }
    if (!oMath) {
        throw new Error('No oMath element found in OMML');
    }
    return new Math({ children: convertOmmlChildren(oMath) });
}

/**
 * Process HTML: replace KaTeX-rendered math spans with data-omml spans.
 *
 * Each `<span class="katex">` contains MathML inside `.katex-mathml <math>`.
 * We extract the MathML, convert it to OMML, and replace the span with
 * `<span data-omml="<m:oMath>...</m:oMath>">` so it becomes a native Word equation.
 */
function processHtml(htmlContent) {
    const dom = new JSDOM(htmlContent);
    const document = dom.window.document;
    let equationCount = 0;

    const katexSpans = document.querySelectorAll('span.katex');
    katexSpans.forEach((span) => {
        let mathElement = span.querySelector('.katex-mathml math');
        if (!mathElement) {
            mathElement = span.querySelector('math');
        }
        if (!mathElement) return;

        const omml = mathml2omml.mml2omml(mathElement.outerHTML, { disableDecode: true });

        const placeholder = document.createElement('span');
        placeholder.setAttribute('data-omml', omml);
        span.replaceWith(placeholder);
        equationCount++;
    });

    return { processedHtml: document.body.innerHTML, equationCount };
}

/**
 * Parse HTML DOM elements to docx children recursively.
 */
function parseHtmlToDocxChildren(element, ctx) {
    const { docx: d, mathml2omml: m2o } = ctx;
    const children = [];
    
    const {
        Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
        WidthType, BorderStyle, AlignmentType, convertInchesToTwip
    } = d;
    
    const NodeConst = element.ownerDocument.defaultView.Node;
    
    for (const node of element.childNodes) {
        if (node.nodeType === NodeConst.TEXT_NODE) {
            const text = node.textContent.trim();
            if (text) {
                children.push(new Paragraph({
                    children: [new TextRun(text)]
                }));
            }
            continue;
        }
        
        if (node.nodeType !== NodeConst.ELEMENT_NODE) continue;
        
        const tag = node.tagName.toLowerCase();
        
        switch (tag) {
            case 'h1':
                children.push(new Paragraph({
                    text: node.textContent,
                    heading: HeadingLevel.HEADING_1,
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 200 }
                }));
                break;
            
            case 'h2':
                children.push(new Paragraph({
                    text: node.textContent,
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 240, after: 120 }
                }));
                break;
            
            case 'h3':
                children.push(new Paragraph({
                    text: node.textContent,
                    heading: HeadingLevel.HEADING_3,
                    spacing: { before: 200, after: 100 }
                }));
                break;
            
            case 'p':
                children.push(new Paragraph({
                    children: parseInlineElements(node, ctx),
                    spacing: { after: 120 },
                    alignment: AlignmentType.JUSTIFIED
                }));
                break;
            
            case 'strong':
            case 'b':
                children.push(new Paragraph({
                    children: [new TextRun({ text: node.textContent, bold: true })]
                }));
                break;
            
            case 'em':
            case 'i':
                children.push(new Paragraph({
                    children: [new TextRun({ text: node.textContent, italics: true })]
                }));
                break;
            
            case 'ul':
                for (const li of node.querySelectorAll('li')) {
                    children.push(new Paragraph({
                        children: [new TextRun({ text: `• ${li.textContent}` })],
                        indent: { left: convertInchesToTwip(0.5) },
                        spacing: { after: 60 }
                    }));
                }
                break;
            
            case 'ol':
                let idx = 1;
                for (const li of node.querySelectorAll('li')) {
                    children.push(new Paragraph({
                        children: [new TextRun({ text: `${idx}. ${li.textContent}` })],
                        indent: { left: convertInchesToTwip(0.5) },
                        spacing: { after: 60 }
                    }));
                    idx++;
                }
                break;
            
            case 'table':
                children.push(parseTable(node, ctx));
                break;
            
            case 'div':
            case 'section':
                // Recursively process block-level divs
                const blockChildren = parseHtmlToDocxChildren(node, ctx);
                children.push(...blockChildren);
                break;
            
            case 'br':
                children.push(new Paragraph({ children: [] }));
                break;
            
            default:
                // For unhandled tags, process children recursively
                const fallback = parseHtmlToDocxChildren(node, ctx);
                children.push(...fallback);
                break;
        }
    }
    
    return children.length > 0 ? children : [new TextRun(element.textContent)];
}

/**
 * Parse inline elements (inside paragraphs) for rich text.
 */
function parseInlineElements(element, ctx) {
    const { docx: d } = ctx;
    const { TextRun } = d;
    const children = [];
    
    const NodeConst = element.ownerDocument.defaultView.Node;
    
    for (const node of element.childNodes) {
        if (node.nodeType === NodeConst.TEXT_NODE) {
            const text = node.textContent;
            if (text) {
                children.push(new TextRun(text));
            }
            continue;
        }
        
        if (node.nodeType !== NodeConst.ELEMENT_NODE) continue;
        
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
                // Check if it's an office-math element with OMML
                const omml = node.getAttribute('data-omml');
                if (omml && mathml2omml) {
                    // Native Word equation (OMML) via docx Math component
                    try {
                        children.push(convertOmmlToMath(omml));
                    } catch (e) {
                        console.warn('OMML to docx Math conversion failed:', e.message);
                        children.push(new TextRun({ text: node.textContent }));
                    }
                } else {
                    children.push(new TextRun({ text: node.textContent }));
                }
                break;
            
            default:
                children.push(new TextRun({ text: node.textContent }));
                break;
        }
    }
    
    return children.length > 0 ? children : [new TextRun(element.textContent)];
}

/**
 * Parse HTML table to docx Table.
 */
function parseTable(tableEl, ctx) {
    const { docx: d } = ctx;
    const {
        Table, TableRow, TableCell, Paragraph, TextRun,
        WidthType, BorderStyle, VerticalAlign, AlignmentType
    } = d;
    
    const rows = tableEl.querySelectorAll('tr');
    const tableRows = [];
    
    for (const row of rows) {
        const cells = row.querySelectorAll('th, td');
        const tableCells = Array.from(cells).map(cell => {
            return new TableCell({
                children: [new Paragraph({
                    children: [new TextRun({ text: cell.textContent })],
                    alignment: cell.tagName === 'TH' ? AlignmentType.CENTER : AlignmentType.LEFT
                })],
                shading: cell.tagName === 'TH' ? { fill: 'f0f0f0' } : undefined,
                verticalAlign: VerticalAlign.CENTER,
                borders: {
                    top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                    bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                    left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                    right: { style: BorderStyle.SINGLE, size: 1, color: '000000' }
                }
            });
        });
        
        tableRows.push(new TableRow({
            children: tableCells
        }));
    }
    
    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: tableRows
    });
}

/**
 * Main execution.
 */
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
        console.error('Usage: node convert-rpp-to-docx.js <inputHtmlPath> <outputDocxPath>');
        process.exit(1);
    }
    
    const inputPath = args[0];
    const outputPath = args[1];
    
    // Read HTML file
    if (!fs.existsSync(inputPath)) {
        console.error(`Input file not found: ${inputPath}`);
        process.exit(1);
    }
    
    const htmlContent = fs.readFileSync(inputPath, 'utf8');
    console.log('Processing RPP HTML...');
    
    // Process HTML (handle KaTeX, remove unsupported elements)
    const { processedHtml, equationCount } = processHtml(htmlContent);
    console.log(`Found ${equationCount} equation(s)`);
    
    // Build DOCX document
    console.log('Building DOCX document...');
    
    const dom = new JSDOM(`<body>${processedHtml}</body>`);
    const body = dom.window.document.body;
    const children = parseHtmlToDocxChildren(body, { docx, mathml2omml });
    
    const doc = new Document({
        sections: [{
            properties: {},
            children: children
        }]
    });
    
    // Write DOCX file
    console.log(`Writing DOCX to: ${outputPath}`);
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(outputPath, buffer);
    
    console.log(`SUCCESS: DOCX created with ${equationCount} equation(s)`);
}

main().catch(err => {
    console.error('Error:', err.message);
    console.error(err.stack);
    process.exit(1);
});
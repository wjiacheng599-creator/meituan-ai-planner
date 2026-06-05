const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, AlignmentType, VerticalAlign, WidthType } = require('docx');

const markdownPath = path.join(__dirname, '../output/doc/美团AI规划师_参赛设计文档.md');
const outputPath = path.join(__dirname, '../output/doc/美团AI规划师_参赛设计文档.docx');

function parseMarkdown(markdown) {
  const lines = markdown.split('\n');
  const elements = [];
  let currentTable = [];
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('---')) {
      continue;
    }

    if (line.startsWith('|')) {
      inTable = true;
      currentTable.push(line);
      continue;
    }

    if (inTable && !line.startsWith('|')) {
      elements.push({ type: 'table', content: currentTable });
      currentTable = [];
      inTable = false;
    }

    if (line.startsWith('# ')) {
      elements.push({ type: 'heading1', content: line.slice(2) });
    } else if (line.startsWith('## ')) {
      elements.push({ type: 'heading2', content: line.slice(3) });
    } else if (line.startsWith('### ')) {
      elements.push({ type: 'heading3', content: line.slice(4) });
    } else if (line.startsWith('#### ')) {
      elements.push({ type: 'heading4', content: line.slice(5) });
    } else if (line.startsWith('> ')) {
      elements.push({ type: 'blockquote', content: line.slice(2) });
    } else if (line.startsWith('**') && line.endsWith('**')) {
      elements.push({ type: 'bold', content: line.slice(2, -2) });
    } else if (line.startsWith('1. ') || line.match(/^\d+\. /)) {
      elements.push({ type: 'list', content: line });
    } else if (line.startsWith('- ')) {
      elements.push({ type: 'bullet', content: line.slice(2) });
    } else if (line.startsWith('```')) {
      let codeBlock = '';
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeBlock += lines[i] + '\n';
        i++;
      }
      elements.push({ type: 'code', content: codeBlock.trim() });
    } else if (line.trim()) {
      elements.push({ type: 'paragraph', content: line });
    }
  }

  if (inTable) {
    elements.push({ type: 'table', content: currentTable });
  }

  return elements;
}

function createDocument(elements) {
  const doc = new Document({
    title: '美团AI规划师 - 参赛设计文档',
    creator: '美团AI规划师参赛团队',
    description: '美团AI规划师竞赛参赛设计文档',
  });

  for (const element of elements) {
    switch (element.type) {
      case 'heading1':
        doc.addSection({
          children: [
            new Paragraph({
              text: element.content,
              heading: HeadingLevel.HEADING_1,
              spacing: { after: 200 },
            }),
          ],
        });
        break;

      case 'heading2':
        doc.addSection({
          children: [
            new Paragraph({
              text: element.content,
              heading: HeadingLevel.HEADING_2,
              spacing: { after: 150 },
            }),
          ],
        });
        break;

      case 'heading3':
        doc.addSection({
          children: [
            new Paragraph({
              text: element.content,
              heading: HeadingLevel.HEADING_3,
              spacing: { after: 100 },
            }),
          ],
        });
        break;

      case 'heading4':
        doc.addSection({
          children: [
            new Paragraph({
              text: element.content,
              heading: HeadingLevel.HEADING_4,
              spacing: { after: 80 },
            }),
          ],
        });
        break;

      case 'paragraph':
        doc.addSection({
          children: [
            new Paragraph({
              text: element.content,
              spacing: { after: 100 },
            }),
          ],
        });
        break;

      case 'bold':
        doc.addSection({
          children: [
            new Paragraph({
              children: [new TextRun({ text: element.content, bold: true })],
              spacing: { after: 100 },
            }),
          ],
        });
        break;

      case 'blockquote':
        doc.addSection({
          children: [
            new Paragraph({
              text: element.content,
              border: { left: { size: 12, color: '0070C0', space: 4 } },
              spacing: { before: 50, after: 100 },
              indent: { left: 720 },
            }),
          ],
        });
        break;

      case 'list':
      case 'bullet':
        doc.addSection({
          children: [
            new Paragraph({
              text: element.content,
              spacing: { after: 50 },
              indent: { left: 720 },
            }),
          ],
        });
        break;

      case 'code':
        doc.addSection({
          children: [
            new Paragraph({
              text: element.content,
              style: 'Code',
              spacing: { after: 100 },
            }),
          ],
        });
        break;

      case 'table':
        const rows = element.content
          .filter((l) => l.trim())
          .map((line) => line.split('|').map((cell) => cell.trim()).filter((c) => c));
        
        if (rows.length > 0 && rows[0].length > 0) {
          const table = new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: rows.map((row, rowIndex) => {
              const isHeader = rowIndex === 0 || (rowIndex === 1 && row.every((c) => c.includes('-')));
              if (isHeader && rowIndex === 1) return null;
              
              return new TableRow({
                children: row.map((cell) => {
                  return new TableCell({
                    children: [
                      new Paragraph({
                        text: cell,
                        bold: isHeader,
                        alignment: AlignmentType.CENTER,
                      }),
                    ],
                    verticalAlign: VerticalAlign.CENTER,
                  });
                }),
              });
            }).filter(Boolean),
          });
          
          doc.addSection({
            children: [table],
            spacing: { after: 150 },
          });
        }
        break;

      default:
        break;
    }
  }

  return doc;
}

async function main() {
  try {
    const markdown = fs.readFileSync(markdownPath, 'utf-8');
    const elements = parseMarkdown(markdown);
    const doc = createDocument(elements);
    
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(outputPath, buffer);
    
    console.log(`Word文档已生成: ${outputPath}`);
  } catch (error) {
    console.error('生成文档失败:', error);
  }
}

main();
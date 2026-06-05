const fs = require('fs');
const path = require('path');
const officegen = require('officegen');

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

function main() {
  try {
    const markdown = fs.readFileSync(markdownPath, 'utf-8');
    const elements = parseMarkdown(markdown);
    
    const docx = officegen('docx');

    docx.on('finalize', function(written) {
      console.log('文档已生成，字节数:', written);
    });

    docx.on('error', function(err) {
      console.error('生成文档出错:', err);
    });

    for (const element of elements) {
      switch (element.type) {
        case 'heading1': {
          const p = docx.createP();
          p.addText(element.content, { bold: true, font_size: 18 });
          p.addLineBreak();
          break;
        }

        case 'heading2': {
          const p = docx.createP();
          p.addText(element.content, { bold: true, font_size: 16 });
          p.addLineBreak();
          break;
        }

        case 'heading3': {
          const p = docx.createP();
          p.addText(element.content, { bold: true, font_size: 14 });
          p.addLineBreak();
          break;
        }

        case 'heading4': {
          const p = docx.createP();
          p.addText(element.content, { bold: true, font_size: 12 });
          p.addLineBreak();
          break;
        }

        case 'paragraph': {
          const p = docx.createP();
          p.addText(element.content);
          p.addLineBreak();
          break;
        }

        case 'bold': {
          const p = docx.createP();
          p.addText(element.content, { bold: true });
          p.addLineBreak();
          break;
        }

        case 'blockquote': {
          const p = docx.createP();
          p.options.indentFirstLine = 720;
          p.addText(element.content, { italic: true, color: '333333' });
          p.addLineBreak();
          break;
        }

        case 'list':
        case 'bullet': {
          const p = docx.createP();
          p.options.indentFirstLine = 720;
          p.addText(element.content);
          p.addLineBreak();
          break;
        }

        case 'code': {
          const p = docx.createP();
          p.addText(element.content, { font: 'Courier New', font_size: 10 });
          p.addLineBreak();
          break;
        }

        case 'table': {
          const rows = element.content
            .filter((l) => l.trim())
            .map((line) => line.split('|').map((cell) => cell.trim()).filter((c) => c));
          
          if (rows.length > 0 && rows[0].length > 0) {
            const tableRows = rows.map((row, rowIndex) => {
              const isHeader = rowIndex === 0 || (rowIndex === 1 && row.every((c) => c.includes('-')));
              if (isHeader && rowIndex === 1) return null;
              
              return row.map((cell) => {
                return { text: cell, opts: { bold: isHeader } };
              });
            }).filter(Boolean);

            if (tableRows.length > 0) {
              const tableData = tableRows.map(row => row.map(cell => cell.text));
              const table = docx.createTable(tableData);

              const firstRow = table[0];
              if (firstRow) {
                firstRow.forEach(cell => {
                  Object.keys(cell).forEach(key => {
                    if (cell[key] && typeof cell[key] === 'object') {
                      if (cell[key].addText) {
                        const textObj = cell[key].getTextObj();
                        if (textObj) {
                          textObj.bold = true;
                        }
                      }
                    }
                  });
                });
              }
            }

            const p = docx.createP();
            p.addLineBreak();
          }
          break;
        }

        default:
          break;
      }
    }

    const output = fs.createWriteStream(outputPath);
    docx.generate(output);

    output.on('close', () => {
      console.log(`Word文档已生成: ${outputPath}`);
    });

  } catch (error) {
    console.error('生成文档失败:', error);
  }
}

main();
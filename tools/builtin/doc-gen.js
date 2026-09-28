const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', '..', 'data', 'documents');

module.exports = {
  name: 'doc_gen',
  description: 'Generate document (PDF, TXT, MD, CSV) from text.',
  params: { title: 'string', content: 'string', format: 'string' },
  run: async ({ title, content, format = 'txt' }) => {
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    
    const filename = title.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.' + format;
    const filepath = path.join(OUTPUT_DIR, filename);
    
    if (format === 'txt' || format === 'md') {
      fs.writeFileSync(filepath, content);
    } else if (format === 'csv') {
      fs.writeFileSync(filepath, content);
    } else if (format === 'json') {
      fs.writeFileSync(filepath, JSON.stringify(content, null, 2));
    }
    
    return `Document generated: ${filename}`;
  }
};

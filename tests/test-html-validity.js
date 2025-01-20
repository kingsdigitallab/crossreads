import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const OUTPUT_DIR = '../app/data/allographs/types/';

function validateHTML(filePath) {
  try {
    const htmlContent = fs.readFileSync(filePath, 'utf8');
    const dom = new JSDOM(htmlContent);
    if (!dom.window.document.querySelector('body')) {
      throw new Error('No body element found in the HTML document.');
    }
    console.log(`Validated: ${filePath}`);
  } catch (error) {
    console.error(`Invalid HTML: ${filePath} - ${error.message}`);
  }
}

function testHTMLFilesInDirectory(directoryPath) {
  fs.readdirSync(directoryPath).forEach(file => {
    const filePath = path.join(directoryPath, file);
    if (fs.statSync(filePath).isFile() && path.extname(filePath) === '.html') {
      validateHTML(filePath);
    }
  });
}

testHTMLFilesInDirectory(path.join(__dirname, OUTPUT_DIR));

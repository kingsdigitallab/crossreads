import fs from 'fs';
import path from 'path';
import { HtmlValidate, formatterFactory } from 'html-validate';

const htmlValidate = new HtmlValidate();
const formatter = formatterFactory('text');
const __dirname = path.dirname(new URL(import.meta.url).pathname);

const OUTPUT_DIR = '../app/data/allographs/types/';

async function validateHTML(filePath) {
  try {
    const report = await htmlValidate.validateFile(filePath);
    if (report.valid) {
      console.log(`Validated: ${filePath}`);
    } else {
      console.error(`Invalid HTML: ${filePath}\n${formatter(report.results)}`);
    }
  } catch (error) {
    console.error(`Error reading file: ${filePath} - ${error.message}`);
  }
}

function testHTMLFilesInDirectory(directoryPath, invalidCount = 0) {
  fs.readdirSync(directoryPath).forEach(async file => {
    const filePath = path.join(directoryPath, file);
    if (fs.statSync(filePath).isFile() && path.extname(filePath) === '.html') {
      await validateHTML(filePath);
      if (!report.valid) {
        invalidCount++;
      }
    }
  });
  console.log(`Number of invalid files: ${invalidCount}`);
}

testHTMLFilesInDirectory(path.join(__dirname, OUTPUT_DIR));

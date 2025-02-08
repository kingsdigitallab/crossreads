import fs from 'fs';
import path from 'path';
import { HtmlValidate, formatterFactory } from 'html-validate';

const htmlValidate = new HtmlValidate();
const formatter = formatterFactory('text');
const __dirname = path.dirname(new URL(import.meta.url).pathname);

const INPUT_DIR = '../app/data/allographs/types/';

async function isHTMLValid(filePath) {
  let ret = false
  try {
    const report = await htmlValidate.validateFile(filePath);
    if (report.valid) {
      ret = true;
      console.log(`Validated: ${filePath}`);
    } else {
      console.error(`Invalid HTML: ${filePath}\n${formatter(report.results)}`);
    }
  } catch (error) {
    console.error(`Error reading file: ${filePath} - ${error.message}`);
  }
  return ret
}

async function testHTMLFilesInDirectory(directoryPath) {
  let ret = 0;
  for (let file of fs.readdirSync(directoryPath)) {
    const filePath = path.join(directoryPath, file);
    if (fs.statSync(filePath).isFile() && path.extname(filePath) === '.html') {
      ret += await isHTMLValid(filePath) ? 0 : 1;
    }
  };
  console.log(`Number of invalid files: ${ret}`);
  return ret;
}

testHTMLFilesInDirectory(path.join(__dirname, INPUT_DIR));

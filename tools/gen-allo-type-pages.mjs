import fs from 'node:fs';
import path from 'node:path';

import { fileURLToPath } from 'node:url';
import { utils } from '../app/utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants for easy editing
const VARIANT_RULES_JSON_PATH = '../app/data/variant-rules.json';
const OUTPUT_DIR = '../app/data/allographs/types/';
const HTML_TEMPLATE_PATH = 'allo-type.liquid';
const DEFINITIONS_PATH = '../app/data/pal/definitions-digipal.json'
const SEARCH_PAGE_URL = 'https://kingsdigitallab.github.io/crossreads/search.html'

async function processVariantRule(variantRule, definitions) {
  let context = JSON.parse(JSON.stringify(variantRule))
  
  context['component-features'] = variantRule['component-features'].map(feature => `  <li>${feature.component} is ${feature.feature}</li>`).join('\n')
  context['examples-url'] = `${SEARCH_PAGE_URL}?f.scr=${definitions.scripts[context.script]}&f.chr=${variantRule.allograph}&f.cxf=${variantRule['component-features'].map(feature => `${feature.component} is ${feature.feature}`).join('|')}`

  let htmlContent = await utils.renderTemplate(HTML_TEMPLATE_PATH, context)

  // Create the file name using allograph and variant-name
  const fileName = `${context.script}-${variantRule.allograph}-${variantRule['variant-name']}.html`;

  // Write the HTML content to a file
  const outputPath = path.join(__dirname, OUTPUT_DIR, fileName);
  fs.writeFileSync(outputPath, htmlContent)
  console.log(`HTML file created: ${outputPath}`);
}

function emptyOutputFolder() {
  const outputDir = path.join(__dirname, OUTPUT_DIR);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }  

  const files = fs.readdirSync(outputDir);

  for (const file of files) {
    const filePath = path.join(outputDir, file);
    const fileExtension = path.extname(filePath);

    if (fileExtension === '.html') {
      fs.unlinkSync(filePath);
    }
  }
}

async function main() {
  emptyOutputFolder(OUTPUT_DIR)

  const variantRulesFilePath = path.join(__dirname, VARIANT_RULES_JSON_PATH);

  const variantRules = utils.readJsonFile(variantRulesFilePath)

  let definitions = utils.readJsonFile(DEFINITIONS_PATH)

  for (const variantRule of variantRules) {
    await processVariantRule(variantRule, definitions);
  }
}

main()

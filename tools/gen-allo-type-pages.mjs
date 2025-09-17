import fs from 'node:fs';
import path from 'node:path';

import { fileURLToPath } from 'node:url';
import { utils } from '../app/utils.mjs';
import * as toolbox from './toolbox.mjs'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants for easy editing
const OUTPUT_DIR = '../app/data/allographs/types/';
const HTML_TEMPLATE_PATH = 'allo-type.liquid';
const SEARCH_PAGE_URL = 'https://kingsdigitallab.github.io/crossreads/search.html'

function processVariantRule(variantRule, definitions, thumbs) {
  let context = JSON.parse(JSON.stringify(variantRule))

  function getLabel(itemKey, itemType) {
    return utils.getLabelFromDefinition(itemKey, itemType, definitions)
  }
  
  context['script'] = getLabel(variantRule.script, 'scr')
  context['grapheme'] = utils.getGraphemeFromCharacter(variantRule.allograph)
  context['component-features'] = variantRule['component-features'].map(feature => `  <li>${getLabel(feature.component, 'cxf')} is ${getLabel(feature.feature, 'fea')}</li>`).join('\n')
  context['examples-url'] = `${SEARCH_PAGE_URL}?f.scr=${variantRule.script}&f.chr=${variantRule.allograph}&f.cxf=${variantRule['component-features'].map(feature => `${feature.component} is ${feature.feature}`).join('|')}`

  let variantKey = `${variantRule.script}-${variantRule.allograph}-${variantRule['variant-name']}`
  context['variant-key'] = variantKey
  let thumbInfo = thumbs?.data?.[variantKey]
  if (thumbInfo) {
    context['thumbInfo'] = thumbInfo
    thumbInfo.place = utils.capitaliseWords(thumbInfo?.pla?.[0] ?? 'unknown')
    thumbInfo.docId = utils.getDocIdFromString(thumbInfo.fil, true)
    // thmubInfo.linkAnnotator = `https://kingsdigitallab.github.io/crossreads/annotator.html?obj={{thumbInfo.}}&img=ISic000085.jpg&sup=0&ann={{thmbInfo.id}}`
  }

  let htmlContent = toolbox.renderTemplate(HTML_TEMPLATE_PATH, context)

  // Create the file name using allograph and variant-name
  const fileName = `${variantKey}.html`

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

function main() {
  emptyOutputFolder(OUTPUT_DIR)

  // const variantRulesFilePath = path.join(__dirname, VARIANT_RULES_JSON_PATH);

  const variantRules = utils.readJsonFile('VARIANT_RULES')

  let definitions = utils.readJsonFile('DEFINITIONS')

  let thumbs = utils.readJsonFile('THUMBS_ALL')

  for (const variantRule of variantRules) {
    processVariantRule(variantRule, definitions, thumbs);
  }
}

main()

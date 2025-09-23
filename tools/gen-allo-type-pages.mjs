import fs from 'node:fs';
import path from 'node:path';

import { fileURLToPath } from 'node:url';
import { utils, SETTINGS } from '../app/utils.mjs';
import * as toolbox from './toolbox.mjs'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants for easy editing
const OUTPUT_DIR = '../app/data/allographs/types/';
const HTML_TEMPLATE_PATH = 'allo-type.liquid';
const SEARCH_PAGE_URL = 'https://kingsdigitallab.github.io/crossreads/search.html'

function processVariantRule(variantRule, definitions, thumbs, variantRules) {
  let context = JSON.parse(JSON.stringify(variantRule))

  function getLabel(itemKey, itemType) {
    return utils.getLabelFromDefinition(itemKey, itemType, definitions)
  }

  // find more specific and genral rules
  let rulesSpecific = []
  let rulesGeneral = []
  let componentFeatureToType = {}
  for (let otherRule of variantRules) {
    if (otherRule === variantRule) continue;
    if (otherRule.script !== variantRule.script) continue;
    if (otherRule.allograph !== variantRule.allograph) continue;
    if (otherRule['variant-name'].includes(variantRule['variant-name'])) {
      rulesSpecific.push(otherRule)    
    }
    if (variantRule['variant-name'].includes(otherRule['variant-name'])) {
      rulesGeneral.push(otherRule)
      for (let cf of otherRule['component-features']) {
        let cfSlug = `${cf.component}-${cf.feature}`
        componentFeatureToType[cfSlug] = componentFeatureToType[cfSlug] ?? otherRule['variant-name']
      }
    }
  }
  context['rulesGeneral'] = rulesGeneral
  context['rulesSpecific'] = rulesSpecific

  //  
  context['scriptLabel'] = getLabel(variantRule.script, 'scr')
  context['grapheme'] = utils.getGraphemeFromCharacter(variantRule.allograph)
  context['component-features'] = variantRule['component-features'].map(cf => {
    return {
      label: `${getLabel(cf.component, 'cxf')} is ${getLabel(cf.feature, 'fea')}`,
      inheritedFrom: componentFeatureToType[`${cf.component}-${cf.feature}`],
    }
  }).sort((a, b) => a.label.localeCompare(b.label))
  context['examples-url'] = `${SEARCH_PAGE_URL}?f.scr=${variantRule.script}&f.chr=${variantRule.allograph}&f.cxf=${variantRule['component-features'].map(feature => `${feature.component} is ${feature.feature}`).join('|')}`

  let variantKey = `${variantRule.script}-${variantRule.allograph}-${variantRule['variant-name']}`
  context['variant-key'] = variantKey
  let thumbInfo = thumbs?.data?.[variantKey]
  if (thumbInfo) {
    context['thumbInfo'] = thumbInfo
    thumbInfo.place = utils.capitaliseWords(thumbInfo?.pla?.[0] ?? 'unknown')
    thumbInfo.docId = utils.getDocIdFromString(thumbInfo.fil, true)
    thumbInfo.linkInscription = SETTINGS.CORPUS_BUILDING_INSCRIPTION_URL.replace('{docId}', thumbInfo.docId)
    thumbInfo.displayDateRange = utils.getDisplayDateRange([thumbInfo.daf, thumbInfo.dat])
    // thmubInfo.linkAnnotator = `https://kingsdigitallab.github.io/crossreads/annotator.html?obj={{thumbInfo.}}&img=ISic000085.jpg&sup=0&ann={{thmbInfo.id}}`
  }

  let htmlContent = toolbox.renderTemplate(HTML_TEMPLATE_PATH, context)

  // Create the file name using allograph and variant-name
  const fileName = `${variantKey}.html`

  // Write the HTML content to a file
  const outputPath = path.join(__dirname, OUTPUT_DIR, fileName);
  
  fs.writeFileSync(outputPath, htmlContent)

  // if (variantRule['variant-name'] === 'type2.4') {
  //   console.log(variantRule['variant-name'])
  //   process.exit()
  // }

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

  let thumbs = utils.readJsonFile('INDEX_THUMBS')

  for (const variantRule of variantRules) {
    processVariantRule(variantRule, definitions, thumbs, variantRules);
  }
}

main()

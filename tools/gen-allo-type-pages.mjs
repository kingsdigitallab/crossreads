import fs from 'fs';
import path from 'path';

import { fileURLToPath } from 'url';
import { utils } from '../app/utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants for easy editing
const VARIANT_RULES_JSON_PATH = '../app/data/variant-rules.json';
const OUTPUT_DIR = '../app/data/allographs/types/';
const HTML_TEMPLATE_PATH = 'templates/allo-type.html';
const DEFINITIONS_PATH = '../app/data/pal/definitions-digipal.json'
const SEARCH_PAGE_URL = 'https://kingsdigitallab.github.io/crossreads/search.html'

// Path to the JSON file
const variantRulesFilePath = path.join(__dirname, VARIANT_RULES_JSON_PATH);

let definitions = utils.readJsonFile(DEFINITIONS_PATH)

// Read the variant rules file
fs.readFile(variantRulesFilePath, 'utf8', async (err, data) => {
  if (err) {
    console.error('Error reading JSON file:', err);
    return;
  }

  emptyOutputFolder(OUTPUT_DIR)

  // Parse the JSON data
  const variantRules = JSON.parse(data);

  // Read the HTML template
  fs.readFile(path.join(__dirname, HTML_TEMPLATE_PATH), 'utf8', (templateErr, templateData) => {
    if (templateErr) {
      console.error('Error reading HTML template:', templateErr);
      return;
    }

    // Ensure the output directory exists
    const outputDir = path.join(__dirname, OUTPUT_DIR);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Iterate over each variant rule in the list
    variantRules.forEach(variantRule => {
      processVariantRule(variantRule, templateData);
    });
  });
});

// Function to process each variant rule
function processVariantRule(variantRule, templateData) {
  // Create a dictionary of variables and their values
  const variables = {
    'script': getScriptFromCharacter(variantRule.allograph),
    'allograph': variantRule.allograph,
    'variant-name': variantRule['variant-name'],
    'component-features': variantRule['component-features'].map(feature => `  <li>${feature.component} is ${feature.feature}</li>`).join('\n'),
  };

  variables['examples-url'] = `${SEARCH_PAGE_URL}?f.scr=${definitions.scripts[variables.script]}&f.chr=${variantRule.allograph}&f.cxf=${variantRule['component-features'].map(feature => `${feature.component} is ${feature.feature}`).join('|')}`

  // Replace variables in the template
  let htmlContent = templateData;
  for (const [key, value] of Object.entries(variables)) {
    htmlContent = htmlContent.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }

  // Create the file name using allograph and variant-name
  const fileName = `${variables.script}-${variantRule.allograph}-${variantRule['variant-name']}.html`;

  // Write the HTML content to a file
  const outputPath = path.join(__dirname, OUTPUT_DIR, fileName);
  fs.writeFile(outputPath, htmlContent, 'utf8', err => {
    if (err) {
      console.error('Error writing HTML file:', err);
    } else {
      console.log(`HTML file created: ${outputPath}`);
    }
  });
}

function getScriptFromCharacter(character) {
  // that method is flawed, as a unicode point can be reused for different allographs
  // and we could have dotted notation for variants (or descriptions for 'ligature').
  // return utils.getScriptFromUnicode(variantRule['allograph'])
  let ret = null
  
  for (const [key, allograph] of Object.entries(definitions.allographs)) {
    if (allograph.character === character) {
      ret = allograph.script
      break
    }
  }
  
  return ret
}

function emptyOutputFolder(folderPath) {
    const files = fs.readdirSync(folderPath);

    for (const file of files) {
      const filePath = path.join(folderPath, file);
      const fileExtension = path.extname(filePath);

      if (fileExtension === '.html') {
        fs.unlinkSync(filePath);
      }
    }
}

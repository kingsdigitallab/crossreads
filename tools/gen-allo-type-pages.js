const fs = require('fs');
const path = require('path');

// Constants for easy editing
const JSON_FILE_PATH = '../data/variant-rules.json';
const OUTPUT_DIR = 'allographs/types/';
const HTML_TEMPLATE_PATH = '../templates/html-template.html';

// Path to the JSON file
const jsonFilePath = path.join(__dirname, JSON_FILE_PATH);

// Read the JSON file
fs.readFile(jsonFilePath, 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading JSON file:', err);
    return;
  }

  // Parse the JSON data
  const variantRules = JSON.parse(data);

  // Read the HTML template
  fs.readFile(path.join(__dirname, HTML_TEMPLATE_PATH), 'utf8', (templateErr, templateData) => {
    if (templateErr) {
      console.error('Error reading HTML template:', templateErr);
      return;
    }

    // Iterate over each item in the list
    variantRules.forEach(item => {
      // Create a dictionary of variables and their values
      const variables = {
        '{{allograph}}': item['allograph'],
        '{{variant-name}}': item['variant-name'],
        '{{component-features}}': item['component-features'].map(feature => `  <li>${feature.component} is ${feature.feature}</li>`).join('\n')
      };

      // Replace variables in the template
      let htmlContent = templateData;
      for (const [key, value] of Object.entries(variables)) {
        htmlContent = htmlContent.replace(new RegExp(key, 'g'), value);
      }

      // Create the file name using allograph and variant-name
      const fileName = `${item['allograph']}-${item['variant-name']}.html`;

      // Define the output directory
      const outputDir = path.join(__dirname, OUTPUT_DIR);

      // Ensure the output directory exists
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
      }

      // Write the HTML content to a file
      const outputPath = path.join(outputDir, fileName);
      fs.writeFile(outputPath, htmlContent, 'utf8', err => {
        if (err) {
          console.error('Error writing HTML file:', err);
        } else {
          console.log(`HTML file created: ${outputPath}`);
        }
      });
    });
  });
});

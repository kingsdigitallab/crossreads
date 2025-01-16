const fs = require('fs');
const path = require('path');

// Path to the JSON file
const jsonFilePath = path.join(__dirname, 'app', 'data', 'variant-rules.json');

// Read the JSON file
fs.readFile(jsonFilePath, 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading JSON file:', err);
    return;
  }

  // Parse the JSON data
  const variantRules = JSON.parse(data);

  // Iterate over each item in the list
  variantRules.forEach(item => {
    // Create the HTML content
    let htmlContent = '<ul>\n';
    for (const [key, value] of Object.entries(item)) {
      htmlContent += `  <li>${key}: ${value}</li>\n`;
    }
    htmlContent += '</ul>';

    // Create the file name using allograph and variant-name
    const fileName = `${item['allograph']}-${item['variant-name']}.html`;

    // Define the output directory
    const outputDir = path.join(__dirname, 'output');

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

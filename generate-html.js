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
    let htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${item['allograph']} - ${item['variant-name']}</title>
</head>
<body>
  <h1>${item['allograph']}</h1>
  <h2>${item['variant-name']}</h2>
</body>
</html>`;

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

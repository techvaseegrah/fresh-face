const fs = require('fs').promises;
const path = require('path');

// The code block we want to insert into each model file.
// Using require('mongoose')... makes it robust even if Schema isn't directly imported.
const tenantIdFieldCode = `
  tenantId: { 
    type: require('mongoose').Schema.Types.ObjectId, 
    ref: 'Tenant', 
    required: true, 
    index: true 
  },`;

async function addTenantIdToModels() {
  const modelsDir = path.join(__dirname, '..',  'models');
  console.log(`🚀 Starting script. Scanning directory: ${modelsDir}`);

  try {
    const files = await fs.readdir(modelsDir);

    for (const file of files) {
      // We only care about TypeScript model files
      if (path.extname(file) !== '.ts') {
        continue;
      }
      
      // We do not want to modify the Tenant model itself
      if (file === 'Tenant.ts') {
        console.log(`- Skipping ${file} (this is the Tenant model)`);
        continue;
      }

      const filePath = path.join(modelsDir, file);
      let content = await fs.readFile(filePath, 'utf-8');

      // Check if the file has already been modified to prevent duplicates
      if (content.includes('tenantId:')) {
        console.log(`- Skipping ${file} (already contains 'tenantId')`);
        continue;
      }

      // This regex finds the first occurrence of `new Schema({`
      // It handles variations like `new mongoose.Schema({`
      const schemaRegex = /(new\s+(mongoose\.)?Schema\(\{)/;

      if (schemaRegex.test(content)) {
        // We replace the found pattern with itself, plus our new field code
        // This inserts our code right after the opening `{`
        content = content.replace(schemaRegex, `$1${tenantIdFieldCode}`);
        await fs.writeFile(filePath, content, 'utf-8');
        console.log(`✅ Successfully modified ${file}`);
      } else {
        console.log(`⚠️  WARNING: Could not find 'new Schema({' pattern in ${file}. Please modify this file manually.`);
      }
    }
  } catch (error) {
    console.error('❌ An error occurred:', error);
  }

  console.log('🎉 Script finished. Please review the changes in your editor or with `git diff`.');
}

addTenantIdToModels();
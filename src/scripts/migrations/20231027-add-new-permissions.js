const { MongoClient } = require('mongodb');
// Point to the .env file in the root directory
require('dotenv').config({ path: '../../.env' }); 

const MONGODB_URI ="mongodb+srv://dhanush:Dhanush@cluster0.7ymwvxu.mongodb.net/test2?retryWrites=true&w=majority&appName=Cluster0";

// --- PERMISSIONS TO ADD ---
// These must exactly match the values in your src/lib/permissions.ts file.
const PERMISSIONS_TO_ADD = [
  'BUDGET_READ',
  'BUDGET_MANAGE',
  'SOP_MANAGE',
  'SOP_READ',
  'SOP_REPORTS_READ',
  'SOP_SUBMIT_CHECKLIST',
  'TELECALLING_PERFORM',
  'TELECALLING_VIEW_DASHBOARD',
  'TELECALLING_VIEW_REPORTS',
];

async function runPermissionMigration() {
  if (!MONGODB_URI) {
    console.error('Error: MONGODB_URI is not defined. Please check your .env file.');
    process.exit(1);
  }

  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db();
    console.log('Successfully connected to the database.');

    console.log('Finding and updating "ADMINISTRATOR" roles...');
    
    const result = await db.collection('roles').updateMany(
      { name: 'ADMINISTRATOR' },
      { $addToSet: { permissions: { $each: PERMISSIONS_TO_ADD } } }
    );

    console.log('\n--- Migration Results ---');
    console.log('Migration process completed.');
    console.log(`- Total "ADMINISTRATOR" roles found: ${result.matchedCount}`);
    console.log(`- Roles updated with new permissions: ${result.modifiedCount}`);
    if (result.matchedCount > 0 && result.modifiedCount === 0) {
        console.log('All admin roles were already up-to-date.');
    }
    console.log('-------------------------\n');

  } catch (error) {
    console.error('An error occurred during the migration:', error);
  } finally {
    await client.close();
    console.log('Database connection closed.');
  }
}

runPermissionMigration();
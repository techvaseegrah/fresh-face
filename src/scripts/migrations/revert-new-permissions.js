// File: scripts/migrations/YYYYMMDD-revert-new-permissions.js

const { MongoClient } = require('mongodb');
// Point to the .env file in the root directory. Adjust if your structure is different.
require('dotenv').config({ path: '../../.env' }); 

// WARNING: This connection string is hardcoded. 
// Ensure this is the correct database you intend to modify.
const MONGODB_URI ="mongodb+srv://dhanush:Dhanush@cluster0.7ymwvxu.mongodb.net/test2?retryWrites=true&w=majority&appName=Cluster0";

// --- PERMISSIONS TO REMOVE ---
// This is the exact same list from the original script.
// The script will remove these specific permissions from the array.
const PERMISSIONS_TO_REMOVE = [
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

async function runRevertMigration() {
  if (!MONGODB_URI) {
    console.error('Error: MONGODB_URI is not defined.');
    process.exit(1);
  }

  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db();
    console.log('Successfully connected to the database.');

    console.log('Finding "ADMINISTRATOR" roles and removing specific permissions...');
    
    // The core logic: Use updateMany with the $pull operator
    const result = await db.collection('roles').updateMany(
      { name: 'ADMINISTRATOR' }, // Filter: Find all roles named 'ADMINISTRATOR'
      {
        $pull: { 
          permissions: { $in: PERMISSIONS_TO_REMOVE } 
        }
      } // Update: PULL (remove) all items from the permissions array that are in our list
    );

    console.log('\n--- Revert Script Results ---');
    console.log('Revert process completed.');
    console.log(`- Total "ADMINISTRATOR" roles found: ${result.matchedCount}`);
    console.log(`- Roles updated (permissions removed): ${result.modifiedCount}`);
    if (result.matchedCount > 0 && result.modifiedCount === 0) {
        console.log('No roles were found that contained the specified permissions to remove.');
    }
    console.log('-----------------------------\n');

  } catch (error) {
    console.error('An error occurred during the revert process:', error);
  } finally {
    await client.close();
    console.log('Database connection closed.');
  }
}

console.log('WARNING: This script will remove permissions from your database.');
// Adding a small delay to give you a moment to cancel if run by accident.
setTimeout(() => {
    runRevertMigration();
}, 3000); // 3-second delay
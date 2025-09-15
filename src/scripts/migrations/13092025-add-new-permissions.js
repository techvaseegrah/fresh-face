const { MongoClient } = require('mongodb');
// Point to the .env file in the root directory
require('dotenv').config({ path: '../../.env' }); 

const MONGODB_URI ="mongodb+srv://techvaseegrah:kAsdW78pc8G8Rd29@ffprod.vrpjiy0.mongodb.net/?retryWrites=true&w=majority&appName=FFProd";

// --- PERMISSIONS TO ADD ---
// These must exactly match the values in your src/lib/permissions.ts file.
const PERMISSIONS_TO_ADD = [
   'reports:advance:read',
   'reports:advance:manage',
   'reports:incentive-payout:read',
   'reports:incentive-payout:manage',
   'reports:leave:read',
   'reports:leave:manage',
   'reports:target:read',
   'reports:target:manage',
   'reports:performance:read',
   'reports:performance:manage',
   'reports:salary:read',
   'reports:salary:manage',
   'reports:shift:read',
   'reports:shift:manage',
   'reports:incentive:read',
   'reports:incentive:manage',
   'reports:staff-sales:read',
   'reports:staff-sales:manage',
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
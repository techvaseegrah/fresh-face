// scripts/seed-initial-tenant.js
const bcrypt = require('bcryptjs');
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config({ path: '../.env' }); // Make sure to point to your .env file

const MONGODB_URI = "mongodb+srv://dhanush:Dhanush@cluster0.7ymwvxu.mongodb.net/test2?retryWrites=true&w=majority&appName=Cluster0"

// --- Configuration for your first "master" tenant ---
const TENANT_NAME = 'Glamour Salon'; // New Salon Name
const TENANT_SUBDOMAIN = 'glamour';      // New, unique subdomain
const USER_EMAIL = 'owner@glamour.com';  // New User Email
const USER_PASSWORD = 'Password123!';    // New Password
const USER_NAME = 'Glamour Salon Owner'; // New User Name
const ROLE_NAME = 'OWNER';               // Role name can be the same, it will be scoped to the tenant
const ROLE_DISPLAY_NAME = 'Salon Owner';


async function seedSecondTenant() {
  if (!MONGODB_URI) {
    console.error('Error: MONGODB_URI is not defined in your .env file.');
    process.exit(1);
  }
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db();
    console.log('Successfully connected to database.');

    // 1. Create the Tenant
    const tenantResult = await db.collection('tenants').updateOne(
      { subdomain: TENANT_SUBDOMAIN },
      { $setOnInsert: { name: TENANT_NAME, subdomain: TENANT_SUBDOMAIN, createdAt: new Date(), updatedAt: new Date() } },
      { upsert: true }
    );
    
    const tenant = await db.collection('tenants').findOne({ subdomain: TENANT_SUBDOMAIN });
    const tenantId = tenant._id;
    console.log(`Tenant '${tenant.name}' prepared with ID: ${tenantId}`);
    
    // 2. Create the Role FOR THIS TENANT
    const roleResult = await db.collection('roles').updateOne(
      { name: ROLE_NAME, tenantId: tenantId },
      { $setOnInsert: { 
          tenantId: tenantId, 
          name: ROLE_NAME,
          displayName: ROLE_DISPLAY_NAME,
          permissions: ['*'], // Give this role all permissions
          isActive: true,
          isSystemRole: true,
          createdAt: new Date(),
          updatedAt: new Date()
      }},
      { upsert: true }
    );

    const role = await db.collection('roles').findOne({ name: ROLE_NAME, tenantId: tenantId });
    const roleId = role._id;
    console.log(`Role '${role.displayName}' prepared for tenant with ID: ${roleId}`);
    
    // 3. Create the User FOR THIS TENANT
    const userExists = await db.collection('users').findOne({ email: USER_EMAIL });

    if (!userExists) {
        const hashedPassword = await bcrypt.hash(USER_PASSWORD, 12);
        await db.collection('users').insertOne({
            email: USER_EMAIL,
            password: hashedPassword,
            name: USER_NAME,
            tenantId: tenantId,
            roleId: roleId, // Correctly using roleId
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        console.log('Admin user created successfully.');
    } else {
        console.log('Admin user with this email already exists.');
    }

    console.log('\n--- Your First Tenant is Ready ---');
    console.log(`Subdomain: ${TENANT_SUBDOMAIN}`);
    console.log(`Login Email: ${USER_EMAIL}`);
    console.log(`Login Password: ${USER_PASSWORD}`);
    
  } catch (error) {
    console.error('Error during seeding:', error);
  } finally {
    await client.close();
    console.log('Database connection closed.');
  }
}

seedSecondTenant();
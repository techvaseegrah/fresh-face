import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Setting from '@/models/Setting';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { getServerSession } from 'next-auth';
import { getTenantIdOrBail } from '@/lib/tenant';

// Define the shape of the loyalty settings for strong typing
interface ILoyaltySettings {
  rupeesForPoints: number;
  pointsAwarded: number;
}

/**
 * A read-only helper function to get loyalty settings for a specific tenant.
 * If no setting is found in the database, it returns a hardcoded default value
 * without creating a new database entry.
 * @param {string} tenantId - The ID of the tenant.
 * @returns {Promise<ILoyaltySettings>} The loyalty settings.
 */
async function getLoyaltySettings(tenantId: string): Promise<ILoyaltySettings> {
  const defaultSettings: ILoyaltySettings = { rupeesForPoints: 100, pointsAwarded: 6 };

  // .lean() is a performance optimization for read-only queries.
  const settingDoc = await Setting.findOne({ key: 'loyalty', tenantId }).lean();

  // If a setting document exists, return its 'value'. Otherwise, return the default.
  return settingDoc ? (settingDoc.value as ILoyaltySettings) : defaultSettings;
}

// ===================================================================
//  GET: Handler for fetching the current loyalty settings for the UI.
// ===================================================================
export async function GET(req: NextRequest) {
  try {
    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) {
      return tenantId;
    }

    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.LOYALTY_SETTINGS_READ)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    await connectToDatabase();
    
    const settings = await getLoyaltySettings(tenantId);

    return NextResponse.json({ success: true, settings });

  } catch (error: any) {
    console.error(`Error in GET /api/settings/loyalty:`, error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred.' }, { status: 500 });
  }
}

// ===================================================================
//  PUT: Handler for updating (or creating) the loyalty settings.
// ===================================================================
export async function PUT(req: NextRequest) {
  try {
    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) {
      return tenantId;
    }

    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.LOYALTY_SETTINGS_UPDATE)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    const body: ILoyaltySettings = await req.json();

    // Server-side validation
    if (typeof body.rupeesForPoints !== 'number' || typeof body.pointsAwarded !== 'number' || body.rupeesForPoints <= 0) {
      return NextResponse.json({ success: false, message: 'Invalid data. Please provide valid numbers for settings.' }, { status: 400 });
    }

    await connectToDatabase();

    // Atomically find a document matching the tenantId and key, and update it.
    // If it doesn't exist (upsert: true), create it.
    const updatedSetting = await Setting.findOneAndUpdate(
      { key: 'loyalty', tenantId: tenantId },
      {
        $set: { value: body }, // Always update the 'value' field with the new settings.
        $setOnInsert: { key: 'loyalty', tenantId: tenantId } // Only set these fields on document creation.
      },
      {
        new: true,          // Return the modified document rather than the original.
        upsert: true,       // Create a new document if one doesn't exist.
        runValidators: true // Ensure schema validations are run.
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Loyalty settings updated successfully!',
      settings: updatedSetting.value,
    });

  } catch (error: any) {
    console.error(`Error in PUT /api/settings/loyalty:`, error);

    // Provide a specific error message if the duplicate key error still occurs,
    // which indicates the schema/index fix was not applied correctly.
    if (error.code === 11000) {
      return NextResponse.json({ success: false, message: 'Database conflict. Please ensure the Setting schema has the correct compound index.' }, { status: 500 });
    }
    
    return NextResponse.json({ success: false, message: 'Failed to update settings.' }, { status: 500 });
  }
}
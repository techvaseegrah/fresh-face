import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';
import Setting from '@/models/Setting'; // Make sure this path is correct

// The unique key for this specific setting.
const SETTING_KEY = 'telecallingDays';

/**
 * @description GET handler to retrieve the telecallingDays setting for the current tenant.
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    await dbConnect();
    
    // This query works perfectly with your existing model.
    const setting = await Setting.findOne({
      tenantId: session.user.tenantId,
      key: SETTING_KEY,
    }).lean();

    // If the setting is not found in the DB, return a sensible default.
    const telecallingDays = setting?.value || 30;

    return NextResponse.json({ telecallingDays });

  } catch (error) {
    console.error(`Failed to get setting ${SETTING_KEY}:`, error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * @description POST handler to update or create the telecallingDays setting.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { telecallingDays } = body;

    // Validation remains crucial.
    if (typeof telecallingDays !== 'number' || telecallingDays <= 0) {
      return NextResponse.json({ message: 'telecallingDays must be a positive number' }, { status: 400 });
    }

    await dbConnect();

    // This query is designed for your schema. It will find the document by
    // tenantId and key, and update it. If it doesn't exist, `upsert: true` creates it.
    await Setting.findOneAndUpdate(
      { tenantId: session.user.tenantId, key: SETTING_KEY },
      { 
        $set: { 
          value: telecallingDays,
          // We can set the other fields from your model for completeness.
          description: "The number of days after a client's last visit to add them to the telecalling queue.",
          category: "Telecalling",
        } 
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({ message: 'Settings saved successfully!' });

  } catch (error) {
    console.error(`Failed to save setting ${SETTING_KEY}:`, error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
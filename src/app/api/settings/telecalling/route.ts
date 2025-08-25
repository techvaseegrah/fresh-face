import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';
import Setting from '@/models/Setting';

const SETTING_KEY = 'telecallingDays';

/**
 * @description GET handler to retrieve the telecallingDays setting range.
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    await dbConnect();
    
    const setting = await Setting.findOne({
      tenantId: session.user.tenantId,
      key: SETTING_KEY,
    }).lean();

    // If the setting is not found, return a sensible default range.
    const telecallingDays = setting?.value || { from: 30, to: 60 };

    // The key here is the same, but the value is now an object.
    return NextResponse.json({ telecallingDays });

  } catch (error) {
    console.error(`Failed to get setting ${SETTING_KEY}:`, error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * @description POST handler to update or create the telecallingDays setting range.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    // Expect `fromDays` and `toDays` from the frontend.
    const { fromDays, toDays } = body;

    // --- NEW VALIDATION FOR THE RANGE ---
    if (fromDays == null || toDays == null || Number(fromDays) <= 0 || Number(toDays) <= 0) {
      return NextResponse.json({ message: 'Both "from" and "to" days must be positive numbers.' }, { status: 400 });
    }
    if (Number(fromDays) >= Number(toDays)) {
      return NextResponse.json({ message: '"From" days must be less than "To" days.' }, { status: 400 });
    }

    await dbConnect();

    // The `value` field will now store an object.
    await Setting.findOneAndUpdate(
      { tenantId: session.user.tenantId, key: SETTING_KEY },
      { 
        $set: { 
          value: { from: Number(fromDays), to: Number(toDays) },
          description: "The time window (in days ago) for when lapsed clients are added to the queue.",
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
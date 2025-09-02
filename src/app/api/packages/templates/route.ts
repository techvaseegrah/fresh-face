import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';
import PackageTemplate, { IPackageTemplate } from '@/models/PackageTemplate';

// --- Best Practice: Import models that might be used for population in the future ---
// While we are not populating 'items' in this specific route, following the established
// pattern ensures consistency and prepares the codebase for future enhancements where
// we might need to display service/product names directly.
import '@/models/ServiceItem';
import '@/models/Product';
// -----------------------------------------------------------------------------------


/**
 * @method GET
 * @description Retrieves a list of all package templates for the authenticated tenant.
 * Supports filtering by `isActive` status.
 * @permission read:packages
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.tenantId) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }
        const tenantId = session.user.tenantId;

        await dbConnect();

        const { searchParams } = new URL(request.url);
        const isActive = searchParams.get('isActive');

        const query: { tenantId: any; isActive?: boolean } = { tenantId };
        if (isActive) {
            query.isActive = isActive === 'true';
        }

        const templates = await PackageTemplate.find(query)
            .sort({ createdAt: -1 })
            .lean(); // .lean() for faster read-only operations

        return NextResponse.json(templates, { status: 200 });
    } catch (error: any) {
        console.error("Error fetching package templates:", error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}

/**
 * @method POST
 * @description Creates a new package template for the authenticated tenant.
 * @permission manage:packages
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.tenantId) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }
        const tenantId = session.user.tenantId;
        
        const body: Omit<IPackageTemplate, 'tenantId'> = await request.json();

        // Server-side validation
        if (!body.name || !body.price || body.price < 0 || !body.validityInDays || !body.items || body.items.length === 0) {
            return NextResponse.json({ message: "Validation Error: Missing or invalid required fields." }, { status: 400 });
        }

        await dbConnect();

        const newTemplate = new PackageTemplate({
          ...body,
          tenantId, // Ensure tenantId is from the authenticated session
        });

        await newTemplate.save();

        return NextResponse.json(newTemplate, { status: 201 });
    } catch (error: any) {
        console.error("Error creating package template:", error);
        if (error.name === 'ValidationError') {
            return NextResponse.json({ message: "Validation Error", details: error.errors }, { status: 400 });
        }
        return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
    }
}
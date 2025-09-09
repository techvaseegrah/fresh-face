import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';
import Tool from '@/models/Tool';
import ToolLog from '@/models/ToolLog';
import { getTenantIdOrBail } from '@/lib/tenant';

// This line prevents Next.js from caching the API response,
// ensuring that search results are always fresh.
export const dynamic = 'force-dynamic';

// The POST function is correct and does not need changes.
export async function POST(request: NextRequest) {
    await dbConnect();
    const tenantIdOrBail = getTenantIdOrBail(request);
    if (tenantIdOrBail instanceof NextResponse) { return tenantIdOrBail; }
    const tenantId = tenantIdOrBail;

    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user || !session.user.id) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }
        
        const userId = session.user.id;
        const body = await request.json();
        const { name, category, openingStock, maintenanceDueDate } = body;

        if (!name || openingStock === undefined || openingStock < 0) {
            return NextResponse.json({ message: 'Missing required fields: name and openingStock.' }, { status: 400 });
        }
        
        const newTool = new Tool({
            tenantId,
            name,
            category,
            openingStock,
            currentStock: openingStock,
            maintenanceDueDate,
        });
        await newTool.save();

        const toolLog = new ToolLog({
            tenantId,
            toolId: newTool._id,
            userId,
            action: 'OPENING_STOCK',
            quantityChange: openingStock,
            stockBefore: 0,
            stockAfter: openingStock,
            remarks: 'Initial stock entry',
        });
        await toolLog.save();

        return NextResponse.json(newTool, { status: 201 });

    } catch (error: any) {
        console.error('Error creating tool:', error);
        if (error.code === 11000) {
            return NextResponse.json({ message: `A tool with the name "${error.keyValue.name}" already exists.` }, { status: 409 });
        }
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}


// GET: Fetch all tools for the tenant (with corrected database call)
export async function GET(request: NextRequest) {
    await dbConnect();
    
    try {
        const tenantIdOrBail = getTenantIdOrBail(request);
        if (tenantIdOrBail instanceof NextResponse) { return tenantIdOrBail; }
        const tenantId = tenantIdOrBail;

        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }
        
        const { searchParams } = new URL(request.url);
        const searchQuery = searchParams.get('search') || '';
        const categoryQuery = searchParams.get('category') || '';
        
        // This query object is built correctly
        const query: any = {
            tenantId,
            isActive: true
        };

        if (searchQuery) {
            query.name = { $regex: searchQuery, $options: 'i' };
        }

        if (categoryQuery) {
            query.category = categoryQuery;
        }
        
        console.log("API sending this query to MongoDB:", JSON.stringify(query));

        // --- THE FIX IS HERE ---
        // We now pass the dynamic 'query' object to the find method
        const tools = await Tool.find(query).sort({ name: 1 });
        // --- END OF FIX ---

        return NextResponse.json(tools, { status: 200 });

    } catch (error) {
        console.error('Error fetching tools:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
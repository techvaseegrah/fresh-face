import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import DailyReconciliation from '@/models/DailyReconciliation'; // Your updated model
import { getTenantIdOrBail } from '@/lib/tenant';

/**
 * @description Get an existing Daily Reconciliation report for a specific date.
 * @route GET /api/reconciliation?date=YYYY-MM-DD
 * NOTE: No changes are needed in this function. It will work as is.
 */
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    const tenantIdOrResponse = getTenantIdOrBail(request);
    if (tenantIdOrResponse instanceof NextResponse) return tenantIdOrResponse;
    const tenantId = tenantIdOrResponse;

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date) {
      return NextResponse.json({ message: 'Date parameter is required' }, { status: 400 });
    }

    const reportDate = new Date(date);
    reportDate.setUTCHours(0, 0, 0, 0);

    const report = await DailyReconciliation.findOne({
      date: reportDate,
      tenantId: new mongoose.Types.ObjectId(tenantId),
    });

    if (!report) {
      return NextResponse.json({ message: 'No reconciliation report found for this date.' }, { status: 404 });
    }

    return NextResponse.json(report, { status: 200 });
  } catch (error) {
    console.error('Failed to fetch reconciliation data:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * @description Create or Update a Daily Reconciliation report.
 * @route POST /api/reconciliation
 */
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const tenantIdOrResponse = getTenantIdOrBail(request);
    if (tenantIdOrResponse instanceof NextResponse) return tenantIdOrResponse;
    const tenantId = tenantIdOrResponse;

    const body = await request.json();
    
    if (!body.date || !body.software || !body.bank || !body.cash) {
      return NextResponse.json({ message: 'Missing required fields in request body.' }, { status: 400 });
    }

    const reportDate = new Date(body.date);
    reportDate.setUTCHours(0, 0, 0, 0);

    const { software, bank, cash } = body;
    
    const gpayDiff = bank.gpayDeposit - software.gpay;
    const cardDiff = bank.cardDeposit - software.card;
    const expectedClosing = software.cash - cash.expenses - cash.depositDone;
    const cashDiff = expectedClosing - cash.closingCash;
    
    // --- CHANGES START HERE ---
    const finalData = {
      // Keep existing data from the body
      software: body.software,
      bank: {
        gpayDeposit: bank.gpayDeposit,
        cardDeposit: bank.cardDeposit,
        bankRemarks: bank.bankRemarks || '', // ADD THIS LINE: Get bankRemarks from body
      },
      cash: {
        depositDone: cash.depositDone,
        expenses: cash.expenses,
        closingCash: cash.closingCash,
        cashRemarks: cash.cashRemarks || '', // ADD THIS LINE: Get cashRemarks from body
      },
      
      // Keep your server-side calculated fields
      date: reportDate,
      tenantId: new mongoose.Types.ObjectId(tenantId),
      differences: { gpayDiff, cardDiff, cashDiff },
      status: (gpayDiff === 0 && cardDiff === 0 && cashDiff === 0) ? 'Reconciled' : 'Discrepancy',
    };
    // --- CHANGES END HERE ---
    
    const result = await DailyReconciliation.findOneAndUpdate(
      { date: reportDate, tenantId: new mongoose.Types.ObjectId(tenantId) },
      finalData,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error('Failed to save reconciliation data:', error);
    if (error instanceof mongoose.Error.ValidationError) {
      return NextResponse.json({ message: "Validation Error", details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
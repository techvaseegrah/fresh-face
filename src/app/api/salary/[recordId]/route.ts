import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { getServerSession } from 'next-auth/next';
import dbConnect from '../../../../lib/mongodb';
import SalaryRecord, { ISalaryRecord } from '../../../../models/SalaryRecord';
import Staff, { IStaff } from '../../../../models/staff';
import { authOptions } from '../../../../lib/auth';
import { PERMISSIONS, hasPermission } from '../../../../lib/permissions';

// --- Interfaces for Payloads and Responses ---
interface MarkAsPaidPayloadFE {
  isPaid: boolean; 
  paidDate: string; // Expected as YYYY-MM-DD string
}

interface PopulatedStaffDetailsFE {
  id: string;
  name: string;
  image?: string | null;
  position: string;
}

// UPDATED: Response interface with new fields
interface SalaryRecordResponseFE {
  id: string;
  staffId: string | PopulatedStaffDetailsFE;
  month: string;
  year: number;
  fixedSalary: number; // NEW
  baseSalary: number;
  bonus: number;
  deductions: number;
  advanceDeducted: number;
  netSalary: number;
  isPaid: boolean;
  paidDate: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// A more specific type for lean Mongoose documents to help with type safety
type SalaryDbRecord = ISalaryRecord & {
    _id: mongoose.Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
    otAmount?: number;
    totalDeductions?: number;
    staffId: IStaff | mongoose.Types.ObjectId | string;
};


// --- Helper Functions ---

/**
 * Checks if the current user has the required permission.
 * @param {string} permission - The permission to check for.
 * @returns {Promise<{error: string, status: number} | null>} - Null if authorized, or an error object if not.
 */
async function checkPermissions(permission: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role?.permissions) {
    return { error: 'Authentication required. Please log in.', status: 401 };
  }
  const userPermissions = session.user.role.permissions;
  if (!hasPermission(userPermissions, permission)) {
    return { error: 'Forbidden: You do not have permission to perform this action.', status: 403 };
  }
  return null; 
}

/**
 * Formats a raw database record into a clean front-end response object.
 * @param {SalaryDbRecord} record - The raw record from the database.
 * @param {IStaff | null} [populatedStaffParam] - Optional pre-populated staff details.
 * @returns {SalaryRecordResponseFE} - The formatted record for the front-end.
 */
function formatRecordForResponse(
    record: SalaryDbRecord,
    populatedStaffParam?: IStaff | null
): SalaryRecordResponseFE {
    let staffDetailsFE: string | PopulatedStaffDetailsFE;
    const staffDataToUse = populatedStaffParam || 
        (record.staffId && typeof record.staffId === 'object' && '_id' in record.staffId ? record.staffId as IStaff : null);

    if (staffDataToUse) {
        staffDetailsFE = {
            id: staffDataToUse._id.toString(),
            name: staffDataToUse.name,
            image: staffDataToUse.image || null,
            position: staffDataToUse.position,
        };
    } else if (record.staffId) {
        staffDetailsFE = record.staffId.toString();
    } else {
        staffDetailsFE = "Unknown Staff";
    }
    
    return {
        id: record._id.toString(),
        staffId: staffDetailsFE,
        month: record.month,
        year: record.year,
        fixedSalary: record.fixedSalary,
        baseSalary: record.baseSalary,
        bonus: record.otAmount || 0, // Maps bonus to otAmount
        deductions: record.totalDeductions || 0, // Maps deductions to totalDeductions
        advanceDeducted: record.advanceDeducted,
        netSalary: record.netSalary,
        isPaid: record.isPaid,
        paidDate: record.paidDate ? new Date(record.paidDate).toISOString().split('T')[0] : null,
        createdAt: record.createdAt ? new Date(record.createdAt).toISOString() : undefined,
        updatedAt: record.updatedAt ? new Date(record.updatedAt).toISOString() : undefined,
    };
}


// --- API Handlers ---

/**
 * GET handler to fetch a single salary record by its ID.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { recordId: string } }
) {
  try {
    const permissionError = await checkPermissions(PERMISSIONS.READ_SALARY);
    if (permissionError) {
      return NextResponse.json({ success: false, error: permissionError.error }, { status: permissionError.status });
    }

    await dbConnect();
    const { recordId } = params;
    const { searchParams } = new URL(req.url);
    const populateStaffQuery = searchParams.get('populateStaff');

    if (!recordId || !mongoose.Types.ObjectId.isValid(recordId)) {
      return NextResponse.json({ success: false, error: 'Invalid record ID format' }, { status: 400 });
    }

    const salaryRecordDb = await SalaryRecord.findById(recordId).lean() as SalaryDbRecord | null;

    if (!salaryRecordDb) {
      return NextResponse.json({ success: false, error: 'Salary record not found' }, { status: 404 });
    }

    let populatedStaff: IStaff | null = null;
    if (populateStaffQuery === 'true' && salaryRecordDb.staffId && mongoose.Types.ObjectId.isValid(salaryRecordDb.staffId.toString())) {
        populatedStaff = await Staff.findById(salaryRecordDb.staffId)
                                    .select('name image position')
                                    .lean();
    }
    
    const responseRecord = formatRecordForResponse(salaryRecordDb, populatedStaff);
    return NextResponse.json({ success: true, data: responseRecord });

  } catch (error: any) {
    console.error(`Error fetching salary record [GET /api/salary/${params?.recordId}]:`, error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to fetch salary record' }, { status: 500 });
  }
}

/**
 * PATCH handler to mark a salary record as paid.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { recordId: string } }
) {
  try {
    const permissionError = await checkPermissions(PERMISSIONS.UPDATE_SALARY);
    if (permissionError) {
      return NextResponse.json({ success: false, error: permissionError.error }, { status: permissionError.status });
    }

    await dbConnect();
    const { recordId } = params;

    if (!recordId || !mongoose.Types.ObjectId.isValid(recordId)) {
      return NextResponse.json({ success: false, error: 'Invalid record ID format' }, { status: 400 });
    }

    const payload = (await req.json()) as MarkAsPaidPayloadFE;

    if (typeof payload.isPaid !== 'boolean' || payload.isPaid !== true || !payload.paidDate) {
      return NextResponse.json({ success: false, error: 'Invalid payload: "isPaid" must be true and "paidDate" is required.' }, { status: 400 });
    }
    try {
      new Date(payload.paidDate).toISOString();
    } catch (e) {
      return NextResponse.json({ success: false, error: 'Invalid "paidDate" format.' }, { status: 400 });
    }

    const updatedSalaryRecordDb = await SalaryRecord.findByIdAndUpdate(
      recordId,
      { 
        isPaid: true,
        paidDate: new Date(payload.paidDate)
      },
      { new: true, runValidators: true }
    ).lean() as SalaryDbRecord | null;

    if (!updatedSalaryRecordDb) {
      return NextResponse.json({ success: false, error: 'Salary record not found' }, { status: 404 });
    }
    
    const populatedStaff = await Staff.findById(updatedSalaryRecordDb.staffId)
                                      .select('name image position')
                                      .lean();
    
    const responseRecord = formatRecordForResponse(updatedSalaryRecordDb, populatedStaff);
    return NextResponse.json({ success: true, data: responseRecord });

  } catch (error: any) {
    console.error(`Error updating salary record [PATCH /api/salary/${params?.recordId}]:`, error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to update salary record' }, { status: 500 });
  }
}

/**
 * DELETE handler to delete a salary record.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { recordId: string } }
) {
  try {
    const permissionError = await checkPermissions(PERMISSIONS.DELETE_SALARY);
    if (permissionError) {
      return NextResponse.json({ success: false, error: permissionError.error }, { status: permissionError.status });
    }

    await dbConnect();
    const { recordId } = params;

    if (!recordId || !mongoose.Types.ObjectId.isValid(recordId)) {
      return NextResponse.json({ success: false, error: 'Invalid record ID format' }, { status: 400 });
    }

    const deletedRecord = await SalaryRecord.findByIdAndDelete(recordId).lean();

    if (!deletedRecord) {
      return NextResponse.json({ success: false, error: 'Salary record not found or already deleted' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Salary record deleted successfully', data: { id: recordId } });

  } catch (error: any) {
    console.error(`Error deleting salary record [DELETE /api/salary/${params?.recordId}]:`, error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to delete salary record' }, { status: 500 });
  }
}
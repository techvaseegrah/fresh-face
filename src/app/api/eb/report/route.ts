import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { getTenantIdOrBail } from '@/lib/tenant';
import connectToDatabase from '@/lib/mongodb';
import EBReading, { IEBReading } from '@/models/ebReadings';
import Appointment from '@/models/Appointment'; // Appointment model-ஐ import செய்யவும்

// Report உருவாக்க தேவையானவை
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- HELPER FUNCTIONS ---

// Excel ஃபைல் உருவாக்கும் ஃபங்ஷன்
async function generateExcel(data: any[]) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('EB Report');

  worksheet.columns = [
    { header: 'Date', key: 'date', width: 15 },
    { header: 'Meter', key: 'meter', width: 15 },
    { header: 'Start Units', key: 'startUnits', width: 15 },
    { header: 'End Units', key: 'endUnits', width: 15 },
    { header: 'Units Consumed', key: 'unitsConsumed', width: 18 },
    { header: 'Appointments', key: 'appointments', width: 15 },
    { header: 'Cost Per Unit', key: 'costPerUnit', width: 15 },
    { header: 'Total Cost', key: 'totalCost', width: 15 },
  ];

  worksheet.getRow(1).font = { bold: true };

  data.forEach(item => {
    worksheet.addRow({
      date: item.date,
      meter: item.meter,
      startUnits: item.startUnits,
      endUnits: item.endUnits,
      unitsConsumed: item.unitsConsumed,
      appointments: item.appointments,
      costPerUnit: item.costPerUnit,
      totalCost: item.totalCost,
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// PDF ஃபைல் உருவாக்கும் ஃபங்ஷன்
async function generatePdf(data: any[]) {
  const doc = new jsPDF();
  doc.text('EB Consumption Report', 14, 15);

  autoTable(doc, {
    startY: 20,
    head: [['Date', 'Meter', 'Start Units', 'End Units', 'Consumed', 'Appts', 'Cost/Unit', 'Total Cost']],
    body: data.map(item => [
      item.date,
      item.meter,
      item.startUnits,
      item.endUnits,
      item.unitsConsumed,
      item.appointments,
      item.costPerUnit,
      item.totalCost,
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [45, 55, 72] }
  });

  const pdfBuffer = doc.output('arraybuffer');
  return Buffer.from(pdfBuffer);
}


// --- API ROUTE ---

export async function POST(request: NextRequest) {
  try {
    const tenantId = getTenantIdOrBail(request);
    if (tenantId instanceof NextResponse) return tenantId;

    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.EB_VIEW_CALCULATE)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { startDate: startDateStr, endDate: endDateStr, format } = await request.json();
    if (!startDateStr || !endDateStr || !format) {
      return NextResponse.json({ success: false, message: 'Start date, end date, and format are required.' }, { status: 400 });
    }

    await connectToDatabase();

    const startDate = new Date(startDateStr);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(endDateStr);
    endDate.setHours(23, 59, 59, 999);
    
    // அடுத்த நாளையும் கணக்கில் எடுக்க வேண்டும்
    const nextDayOfEndDate = new Date(endDate);
    nextDayOfEndDate.setDate(nextDayOfEndDate.getDate() + 1);
    nextDayOfEndDate.setHours(0,0,0,0);


    // டேட்டாபேஸிலிருந்து EB Readings மற்றும் Appointments-ஐ எடுக்கவும்
    const readings: IEBReading[] = await EBReading.find({
      tenantId,
      date: { $gte: startDate, $lte: nextDayOfEndDate },
    }).sort({ date: 1, meterIdentifier: 1 });

    const appointments = await Appointment.aggregate([
        { $match: { tenantId, date: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } }, count: { $sum: 1 } } }
    ]);

    const appointmentCounts: { [key: string]: number } = appointments.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
    }, {});


    // ரிப்போர்ட்டுக்கான டேட்டாவைத் தயார் செய்யவும்
    const reportData = [];
    for (let i = 0; i < readings.length; i++) {
        const currentReading = readings[i];
        
        // அடுத்த দিনের ரீடிங்கைக் கண்டறியவும்
        const nextDayReading = readings.find(r => 
            new Date(r.date).toDateString() === new Date(new Date(currentReading.date).getTime() + 24 * 60 * 60 * 1000).toDateString() &&
            r.meterIdentifier === currentReading.meterIdentifier
        );

        if (new Date(currentReading.date) > endDate) continue;

        const dateKey = currentReading.date.toISOString().split('T')[0];

        reportData.push({
            date: new Date(currentReading.date).toLocaleDateString('en-IN'),
            meter: currentReading.meterIdentifier === 'meter-2' ? 'Meter 02' : 'Meter 01',
            startUnits: currentReading.morningUnits?.toFixed(2) ?? 'N/A',
            endUnits: nextDayReading?.morningUnits?.toFixed(2) ?? 'N/A',
            unitsConsumed: currentReading.unitsConsumed?.toFixed(2) ?? 'N/A',
            appointments: appointmentCounts[dateKey] ?? 0,
            costPerUnit: currentReading.costPerUnit?.toFixed(2) ?? 'N/A',
            totalCost: currentReading.totalCost?.toFixed(2) ?? 'N/A'
        });
    }

    let fileBuffer: Buffer;
    let contentType: string;
    let filename: string;

    if (format === 'excel') {
      fileBuffer = await generateExcel(reportData);
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      filename = 'EB_Report.xlsx';
    } else {
      fileBuffer = await generatePdf(reportData);
      contentType = 'application/pdf';
      filename = 'EB_Report.pdf';
    }

    // ஃபைலை client-க்கு அனுப்பவும்
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
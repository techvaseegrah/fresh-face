// app/api/eb/report/route.ts

import { NextRequest, NextResponse } from "next/server";
// We will create these new functions in the next steps
import { getEbReportData } from "@/lib/data/ebReportData"; 
import { createEbExcelReport, createEbPdfReport } from "@/lib/reportGeneratorEb"; 

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let { startDate, endDate, format } = body;

    if (!startDate || !endDate || !format) {
      return NextResponse.json({ message: "Missing required parameters" }, { status: 400 });
    }

    // --- Date Normalization (Crucial for accurate queries) ---
    let normalizedStartDate = new Date(startDate);
    normalizedStartDate.setHours(0, 0, 0, 0);
    let normalizedEndDate = new Date(endDate);
    normalizedEndDate.setHours(23, 59, 59, 999);
    console.log(`Fetching EB data from ${normalizedStartDate.toISOString()} to ${normalizedEndDate.toISOString()}`);

    // 1. Delegate to the data expert to fetch EB-specific data
    const reportData = await getEbReportData(normalizedStartDate, normalizedEndDate);
    console.log(`Found ${reportData.length} EB records for the report.`);

    let fileBuffer: Buffer;
    let contentType: string;
    let filename: string;

    // 2. Delegate to the designer to generate the EB-specific report file
    if (format === "excel") {
      fileBuffer = await createEbExcelReport(reportData);
      contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      filename = `eb_report_${new Date().toISOString().split('T')[0]}.xlsx`;
    } else {
      fileBuffer = await createEbPdfReport(reportData, new Date(startDate), new Date(endDate));
      contentType = "application/pdf";
      filename = `eb_report_${new Date().toISOString().split('T')[0]}.pdf`;
    }

    // 3. Send the finished file back to the browser
    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("Content-Disposition", `attachment; filename="${filename}"`);
    return new NextResponse(fileBuffer, { status: 200, headers });

  } catch (error: any) {
    console.error("EB Report generation failed:", error);
    return NextResponse.json({ message: "Internal Server Error", error: error.message }, { status: 500 });
  }
}
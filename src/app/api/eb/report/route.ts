// app/api/eb/report/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getEbReportData } from "@/lib/data/ebReportData"; // Use our new data expert
import { createEbExcelReport, createEbPdfReport } from "@/lib/reportGeneratorEb"; 

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let { startDate, endDate, format } = body;

    if (!startDate || !endDate || !format) {
      return NextResponse.json({ message: "Missing required parameters" }, { status: 400 });
    }

    let normalizedStartDate = new Date(startDate);
    normalizedStartDate.setHours(0, 0, 0, 0);
    let normalizedEndDate = new Date(endDate);
    normalizedEndDate.setHours(23, 59, 59, 999);
    
    // 1. Get the combined data from our new function
    const reportData = await getEbReportData(normalizedStartDate, normalizedEndDate);

    let fileBuffer: Buffer;
    let contentType: string;
    let filename: string;

    // 2. Pass the data to the appropriate report generator
    if (format === "excel") {
      fileBuffer = await createEbExcelReport(reportData);
      contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      filename = `eb_report_${new Date().toISOString().split('T')[0]}.xlsx`;
    
   // 3. Send the file back
    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("Content-Disposition", `attachment; filename="${filename}"`);
    return new NextResponse(fileBuffer, { status: 200, headers });
    }
  } catch (error: any) {
    console.error("EB Report generation failed:", error);
    return NextResponse.json({ message: "Internal Server Error", error: error.message }, { status: 500 });
  }
}
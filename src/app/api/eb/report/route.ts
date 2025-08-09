// /app/api/eb/report/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getEbReportData } from "@/lib/data/ebReportData";
import { createEbExcelReport } from "@/lib/reportGeneratorEb";
import { getTenantIdOrBail } from "@/lib/tenant";

export async function POST(request: NextRequest) {
  try {
    const tenantId = getTenantIdOrBail(request);
    if (tenantId instanceof NextResponse) {
        return tenantId;
    }

    const body = await request.json();
    const { startDate, endDate, format } = body;

    if (!startDate || !endDate || !format) {
      return NextResponse.json({ message: "Missing required parameters" }, { status: 400 });
    }

    const normalizedStartDate = new Date(startDate);
    normalizedStartDate.setHours(0, 0, 0, 0);

    const normalizedEndDate = new Date(endDate);
    normalizedEndDate.setHours(23, 59, 59, 999);

    // This line now correctly passes the tenantId.
    // You must now update the getEbReportData function to accept it.
    const reportData = await getEbReportData(normalizedStartDate, normalizedEndDate, tenantId);

    if (format === "excel") {
      const fileBuffer = await createEbExcelReport(reportData);
      const filename = `eb_report_${new Date().toISOString().split("T")[0]}.xlsx`;
      
      const headers = new Headers();
      headers.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      headers.set("Content-Disposition", `attachment; filename="${filename}"`);
      headers.set("Access-Control-Expose-Headers", "Content-Disposition");

      return new NextResponse(fileBuffer, { status: 200, headers });
    }

    if (format === "pdf") {
      return NextResponse.json({ data: reportData });
    }

    return NextResponse.json({ message: "Invalid format type" }, { status: 400 });
  } catch (error: any) {
    console.error("EB report generation failed:", error);
    return NextResponse.json({ message: "Internal Server Error", error: error.message }, { status: 500 });
  }
}
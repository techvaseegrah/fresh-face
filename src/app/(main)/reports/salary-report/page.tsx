'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import {
  IndianRupee, Calendar, Search, Download,
  CheckCircle, Clock, FileSpreadsheet
} from 'lucide-react';
import { useStaff, StaffMember, SalaryRecordType, StaffProvider } from '../../../../context/StaffContext';
import Card from '../../../../components/ui/Card';
import Button from '../../../../components/ui/Button';
import { format, parseISO } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { useSession } from 'next-auth/react';


// --- Main Report Component ---
const SalaryReport = () => {
    // --- THIS IS THE FIX (1/2): Get the fetch function from the context ---
    const { salaryRecords, staffMembers, loadingSalary, fetchSalaryRecords } = useStaff();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [currentMonthIndex, setCurrentMonthIndex] = useState(new Date().getMonth());
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const [isExporting, setIsExporting] = useState(false);
    
    const months = useMemo(() => ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'], []);
    const years = useMemo(() => {
      const startYear = new Date().getFullYear() - 5;
      return Array.from({ length: 10 }, (_, i) => startYear + i);
    }, []);
    
    // --- THIS IS THE FIX (2/2): Call the fetch function when the component loads ---
    useEffect(() => {
      if (fetchSalaryRecords) {
        fetchSalaryRecords({ populateStaff: 'true' });
      }
    }, [fetchSalaryRecords]);

    const enrichedSalaryRecords = useMemo(() => {
      if (!salaryRecords.length || !staffMembers.length) return [];
      const staffMap = new Map(staffMembers.map(staff => [staff.id, staff]));
      return salaryRecords.map(record => {
        const recordStaffId = typeof record.staffId === 'string' ? record.staffId : (record.staffId as any)?.id;
        const fullStaffDetails = staffMap.get(recordStaffId);
        return fullStaffDetails ? { ...record, staffDetails: fullStaffDetails } : record;
      });
    }, [salaryRecords, staffMembers]);

    const currentMonthRecords = useMemo(() => {
      const selectedMonth = months[currentMonthIndex];
      return enrichedSalaryRecords.filter(r => r.month === selectedMonth && r.year === currentYear);
    }, [enrichedSalaryRecords, months, currentMonthIndex, currentYear]);

    const filteredAndPaidRecords = useMemo(() => {
        return currentMonthRecords.filter(record => 
            record.isPaid && 
            record.staffDetails?.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [currentMonthRecords, searchTerm]);

    const summaryStats = useMemo(() => {
        const paidRecords = currentMonthRecords.filter(r => r.isPaid);
        const totalExpense = paidRecords.reduce((total, r) => total + (r.netSalary ?? 0), 0);
        const processedCount = currentMonthRecords.length;
        const paidCount = paidRecords.length;
        const pendingCount = processedCount - paidCount;
        return { totalExpense, processedCount, paidCount, pendingCount };
    }, [currentMonthRecords]);
    
    const handleExport = (formatType: 'pdf' | 'excel') => {
        if (filteredAndPaidRecords.length === 0) {
            toast.info("No paid salary data to export for this month.");
            return;
        }
        setIsExporting(true);
        const monthStr = months[currentMonthIndex];
        const yearStr = currentYear;
        const fileName = `salary_report_${monthStr.toLowerCase()}_${yearStr}`;

        try {
            const headers = [ 'Staff ID', 'Staff Name', 'Position', 'Base Salary (₹)', 'OT Amount (₹)', 'Extra Day Pay (₹)', 'Addition (₹)', 'Deduction (₹)', 'Advance Ded. (₹)', 'Net Salary (₹)', 'Paid Date' ];
            const body = filteredAndPaidRecords.map(record => {
                const staff = record.staffDetails;
                return [
                    staff?.staffIdNumber || 'N/A', staff?.name || 'Unknown', staff?.position || 'N/A',
                    record.baseSalary, record.otAmount, record.extraDayPay, record.foodDeduction, record.recurExpense,
                    record.advanceDeducted, record.netSalary, record.paidDate ? format(parseISO(record.paidDate), 'yyyy-MM-dd') : 'N/A',
                ];
            });

            if (formatType === 'pdf') {
                const doc = new jsPDF({ orientation: 'landscape' });
                doc.setFontSize(18); doc.text(`Salary Report: ${monthStr} ${yearStr}`, 14, 20);
                autoTable(doc, { head: [headers], body, startY: 30, theme: 'grid' });
                doc.save(`${fileName}.pdf`);
            } else {
                const worksheet = XLSX.utils.aoa_to_sheet([headers, ...body]);
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, `Salary ${monthStr} ${yearStr}`);
                XLSX.writeFile(workbook, `${fileName}.xlsx`);
            }
            toast.success(`${formatType.toUpperCase()} report exported successfully!`);
        } catch (error) {
            toast.error(`Failed to export ${formatType.toUpperCase()} report.`);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="font-sans">
            <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Salary Report</h1>
                    <p className="text-sm text-slate-500 mt-1">Review paid salary data for employees.</p>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <select value={currentMonthIndex} onChange={e => setCurrentMonthIndex(Number(e.target.value))} className="p-2 border border-gray-300 rounded-md shadow-sm text-sm">{months.map((month, index) => <option key={month} value={index}>{month}</option>)}</select>
                    <select value={currentYear} onChange={e => setCurrentYear(Number(e.target.value))} className="p-2 border border-gray-300 rounded-md shadow-sm text-sm">{years.map(year => <option key={year} value={year}>{year}</option>)}</select>
                </div>
            </header>

            <Card>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8 p-6">
                    <div className="bg-purple-50 p-6 rounded-lg"><p className="text-sm text-purple-800">Total Paid this Month</p><p className="text-3xl font-bold text-purple-900">₹{summaryStats.totalExpense.toLocaleString('en-IN')}</p></div>
                    <div className="bg-teal-50 p-6 rounded-lg"><p className="text-sm text-teal-800">Processed Salaries</p><p className="text-3xl font-bold text-teal-900">{summaryStats.processedCount}</p></div>
                    <div className="bg-amber-50 p-6 rounded-lg"><p className="text-sm text-amber-800">Pending Payments</p><p className="text-3xl font-bold text-amber-900">{summaryStats.pendingCount}</p></div>
                </div>

                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 p-4 border-t">
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input type="text" placeholder="Search paid staff..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 w-full pr-4 py-2 border border-slate-300 rounded-lg"/>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleExport('pdf')} disabled={isExporting}><Download size={16} className="mr-2 text-red-600"/>PDF</Button>
                        <Button variant="outline" size="sm" onClick={() => handleExport('excel')} disabled={isExporting}><FileSpreadsheet size={16} className="mr-2 text-green-600"/>Excel</Button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="p-4 text-left text-xs font-semibold text-slate-500 uppercase">Staff</th>
                                <th className="p-4 text-left text-xs font-semibold text-slate-500 uppercase">Net Amount</th>
                                <th className="p-4 text-left text-xs font-semibold text-slate-500 uppercase">Payment Date</th>
                                <th className="p-4 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                        {loadingSalary ? <tr><td colSpan={4} className="text-center p-10">Loading Salary Data...</td></tr> : 
                         filteredAndPaidRecords.length > 0 ? (
                            filteredAndPaidRecords.map((record) => {
                                const staff = record.staffDetails;
                                return (
                                    <tr key={`paid-${record.id}`} className="hover:bg-slate-50">
                                        <td className="p-4"><div className="flex items-center"><div className="font-medium text-slate-900">{staff?.name || 'Unknown'}</div></div></td>
                                        <td className="p-4 font-bold">₹{record.netSalary.toLocaleString('en-IN')}</td>
                                        <td className="p-4">{record.paidDate ? format(parseISO(record.paidDate), 'MMM d, yyyy') : 'N/A'}</td>
                                        <td className="p-4"><span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800"><CheckCircle size={14} /> Paid</span></td>
                                    </tr>
                                )
                            })
                         ) : ( <tr><td colSpan={4} className="text-center p-10 text-slate-500">No paid salaries found for this period.</td></tr> )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

// --- Page Wrapper with Context Provider ---
const SalaryReportPage = () => (
    <StaffProvider>
        <SalaryReport />
    </StaffProvider>
);

export default SalaryReportPage;
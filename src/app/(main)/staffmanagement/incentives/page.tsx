'use client';

import React, { useState, useEffect, ReactNode, useMemo } from 'react';
import { toast } from 'react-toastify';
import { IndianRupee, Calendar, CheckCircle, XCircle, RefreshCcw, Star, Gift, BarChartBig, Settings, PlusCircle, Download, AlertTriangle } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { useSession } from 'next-auth/react';
import { PERMISSIONS, hasPermission } from '@/lib/permissions';

// ===================================================================
// HELPER COMPONENTS & INTERFACES
// ===================================================================

interface StaffMember {
  id: string;
  name: string;
  hasSalary: boolean;
}
interface Rule { target: { multiplier: number; }; sales: { includeServiceSale: boolean; includeProductSale: boolean; reviewNameValue: number; reviewPhotoValue: number; }; incentive: { rate: number; doubleRate: number; applyOn: 'totalSaleValue' | 'serviceSaleOnly'; };}
interface SettingsProps { onClose: () => void; tenantId: string; }

const defaultRule: Rule = { target: { multiplier: 5 }, sales: { includeServiceSale: true, includeProductSale: true, reviewNameValue: 200, reviewPhotoValue: 300 }, incentive: { rate: 0.05, doubleRate: 0.10, applyOn: 'totalSaleValue' }};

function IncentiveSettingsModal({ onClose, tenantId }: SettingsProps): JSX.Element {
  const [dailyRule, setDailyRule] = useState<Rule>(defaultRule);
  const [monthlyRule, setMonthlyRule] = useState<Rule>({ ...defaultRule, sales: {...defaultRule.sales, includeProductSale: false }, incentive: {...defaultRule.incentive, applyOn: 'serviceSaleOnly' }});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchRules() {
      setLoading(true);
      if (!tenantId) {
          toast.error('Tenant information not available.');
          setLoading(false);
          return;
      }
      try {
        const headers = new Headers();
        headers.append('X-Tenant-ID', tenantId);
        const res = await fetch('/api/incentives/rules', { headers });
        const data = await res.json();
        if (res.ok) {
          setDailyRule(data.daily);
          setMonthlyRule(data.monthly);
        } else {
          toast.error(data.message || 'Failed to load rules.');
        }
      } catch (err) {
        toast.error('Network error fetching rules.');
      } finally {
        setLoading(false);
      }
    }
    fetchRules();
  }, [tenantId]);

  const handleSave = async () => {
    setSaving(true);
    if (!tenantId) {
      toast.error('Tenant information not available.');
      setSaving(false);
      return;
    }
    try {
        const headers = new Headers();
        headers.append('Content-Type', 'application/json');
        headers.append('X-Tenant-ID', tenantId);
        const res = await fetch('/api/incentives/rules', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ daily: dailyRule, monthly: monthlyRule })
        });
        const data = await res.json();
        if(res.ok) {
            toast.success(data.message || 'Rules saved successfully!');
            setTimeout(() => onClose(), 1500);
        } else {
            toast.error(data.message || "An error occurred while saving.");
        }
    } catch (err) {
        toast.error('Network error saving rules.');
    } finally {
        setSaving(false);
    }
  };
  
  const handleRuleChange = (ruleType: 'daily' | 'monthly', path: string, value: any) => {
    const setter = ruleType === 'daily' ? setDailyRule : setMonthlyRule;
    setter(prev => {
        const keys = path.split('.');
        let temp = JSON.parse(JSON.stringify(prev));
        let current = temp as any;
        for (let i = 0; i < keys.length - 1; i++) { current = current[keys[i]]; }
        current[keys[keys.length - 1]] = value;
        return temp;
    });
  };
  if (loading) return <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 text-white font-bold">Loading Settings...</div>;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6 text-gray-800 border-b pb-2">Manage Incentive Rules</h2>
        <div className="grid md:grid-cols-2 gap-8">
            <RuleEditor title="Incentive 1: Daily Rules" rule={dailyRule} onChange={(path, value) => handleRuleChange('daily', path, value)} />
            <RuleEditor title="Incentive 2: Monthly Rules" rule={monthlyRule} onChange={(path, value) => handleRuleChange('monthly', path, value)} />
        </div>
        <div className="flex justify-end gap-4 mt-6 pt-4 border-t">
            <Button onClick={onClose} variant="danger">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} variant="black">{saving ? 'Saving...' : 'Save All Rules'}</Button>
        </div>
      </div>
    </div>
  );
}

const RuleEditor = ({ title, rule, onChange }: { title: string; rule: Rule; onChange: (path: string, value: any) => void; }) => (
    <Card title={title}>
        <div className="space-y-4 p-2">
            <div><label className="font-semibold text-gray-700 block mb-1">Target Multiplier (of Salary)</label><input type="number" value={rule.target.multiplier} onChange={(e) => onChange('target.multiplier', Number(e.target.value))} className="w-full p-2 border rounded text-black"/></div>
            <div>
                <label className="font-semibold text-gray-700 block mb-1">Sales to Include for Target</label>
                <div className="flex items-center mt-1"><input type="checkbox" id={`${title}-service`} checked={rule.sales.includeServiceSale} onChange={(e) => onChange('sales.includeServiceSale', e.target.checked)} className="h-4 w-4"/><label htmlFor={`${title}-service`} className="ml-2 text-gray-600">Service Sale</label></div>
                <div className="flex items-center mt-1"><input type="checkbox" id={`${title}-product`} checked={rule.sales.includeProductSale} onChange={(e) => onChange('sales.includeProductSale', e.target.checked)} className="h-4 w-4"/><label htmlFor={`${title}-product`} className="ml-2 text-gray-600">Product Sale</label></div>
            </div>
            <div><label className="font-semibold text-gray-700 block mb-1">Review (Name) Value (₹)</label><input type="number" value={rule.sales.reviewNameValue} onChange={(e) => onChange('sales.reviewNameValue', Number(e.target.value))} className="w-full p-2 border rounded text-black"/></div>
            <div><label className="font-semibold text-gray-700 block mb-1">Review (Photo) Value (₹)</label><input type="number" value={rule.sales.reviewPhotoValue} onChange={(e) => onChange('sales.reviewPhotoValue', Number(e.target.value))} className="w-full p-2 border rounded text-black"/></div>
            <hr/>
            <div><label className="font-semibold text-gray-700 block mb-1">Incentive Rate (e.g., 0.05 for 5%)</label><input type="number" step="0.01" value={rule.incentive.rate} onChange={(e) => onChange('incentive.rate', Number(e.target.value))} className="w-full p-2 border rounded text-black"/></div>
            <div><label className="font-semibold text-gray-700 block mb-1">Double Incentive Rate (e.g., 0.10 for 10%)</label><input type="number" step="0.01" value={rule.incentive.doubleRate} onChange={(e) => onChange('incentive.doubleRate', Number(e.target.value))} className="w-full p-2 border rounded text-black"/></div>
            <div>
                <label className="font-semibold text-gray-700 block mb-1">Apply Incentive On</label>
                 <select value={rule.incentive.applyOn} onChange={(e) => onChange('incentive.applyOn', e.target.value)} className="w-full p-2 border rounded text-black bg-white"><option value="totalSaleValue">Total Sale Value</option><option value="serviceSaleOnly">Service Sale Only</option></select>
            </div>
        </div>
    </Card>
);

const InputWithIcon = ({ icon, ...props }: { icon: ReactNode; placeholder: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; type?: string; }) => (
    <div className="relative"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">{icon}</div><input {...props} className="w-full pl-10 p-3 border rounded-lg bg-gray-50 text-black" type={props.type || 'number'} /></div>
);

const IncentiveResultsModal = ({ isOpen, onClose, data }: { isOpen: boolean; onClose: () => void; data: any; }) => {
    if (!isOpen || !data) return null;
    const totalIncentive = (data.incentive1_daily?.incentiveAmount || 0) + (data.incentive2_monthly?.incentiveAmount || 0);
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl">
                <div className="p-6">
                    <h2 className="text-xl font-bold text-gray-800">Results for {data.staffName} on {data.calculationDate}</h2>
                    <p className="text-4xl font-bold text-green-600 my-4">Total: ₹{totalIncentive.toFixed(2)}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <IncentiveResultCard title="Incentive 1: Daily" data={data.incentive1_daily} />
                        <IncentiveResultCard title="Incentive 2: Monthly" data={data.incentive2_monthly} />
                    </div>
                    <div className="flex justify-end pt-4 mt-4 border-t">
                        <Button onClick={onClose} variant="danger">Close</Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const IncentiveResultCard = ({ title, data }: { title: string; data: any; }) => {
    if (!data || Object.keys(data).length === 0) {
        return (
            <div className="bg-gray-100 p-4 rounded-lg">
                <h3 className="font-bold text-lg text-gray-700">{title}</h3>
                <p className="text-sm text-gray-500 mt-2">No data available.</p>
            </div>
        );
    }
    const isTargetMet = data.isTargetMet;
    return (
        <div className={`p-4 rounded-lg shadow-md bg-white border-l-4 ${isTargetMet ? 'border-green-500' : 'border-red-500'}`}>
            <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg text-gray-800">{title}</h3>
                <span className={`flex items-center text-xs font-semibold px-2 py-1 rounded-full ${isTargetMet ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100'}`}>
                    {isTargetMet ? <CheckCircle size={14} className="mr-1" /> : <XCircle size={14} className="mr-1" />}
                    {isTargetMet ? 'Target Met' : 'Target Missed'}
                </span>
            </div>
            <div className="mt-3 space-y-1">
                {Object.entries(data).map(([key, value]) => {
                    if (key === 'isTargetMet') return null;
                    const keyFormatted = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                    let valueFormatted;
                    if (typeof value === 'number') {
                        valueFormatted = key.toLowerCase().includes('rate') ? String(value) : `₹${value.toFixed(2)}`;
                    } else {
                        valueFormatted = String(value).replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    }
                    return (
                        <div key={key} className="flex justify-between text-sm">
                            <span className="text-gray-500">{keyFormatted}:</span>
                            <span className="font-medium text-gray-800">{valueFormatted}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ===================================================================
// MAIN PAGE COMPONENT
// ===================================================================

export default function IncentivesPage() {
  const { data: session } = useSession();
  const userPermissions = useMemo(() => session?.user?.role?.permissions || [], [session]);
  const currentTenantId = session?.user?.tenantId; 
  const canManageIncentives = useMemo(() => hasPermission(userPermissions, PERMISSIONS.STAFF_INCENTIVES_MANAGE), [userPermissions]);
  
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);

  const getMonthRange = () => {
    const date = new Date();
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
    return { firstDay, lastDay };
  };
  const [reportStartDate, setReportStartDate] = useState(getMonthRange().firstDay);
  const [reportEndDate, setReportEndDate] = useState(getMonthRange().lastDay);

  const [reviewsWithName, setReviewsWithName] = useState('');
  const [reviewsWithPhoto, setReviewsWithPhoto] = useState('');

  const [loading, setLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [loadingStaff, setLoadingStaff] = useState(true);
  
  const [results, setResults] = useState<any>(null);
  const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);

  const selectedStaffMember = useMemo(() => staffList.find(staff => staff.id === selectedStaffId), [selectedStaffId, staffList]);
  const isCalculationDisabled = loading || !selectedStaffId || !selectedStaffMember?.hasSalary;

  // ✅ CORRECTED CODE IS HERE
  useEffect(() => {
    const fetchStaff = async () => {
      setLoadingStaff(true);
      if (!currentTenantId) { setLoadingStaff(false); return; }
      try {
        const headers = new Headers();
        headers.append('X-Tenant-ID', currentTenantId);
        const response = await fetch('/api/staff?action=list', { headers }); 
        const result = await response.json();
        if (response.ok && Array.isArray(result.data)) {
            // Transform the API data to match the StaffMember interface
            const transformedStaffList = result.data.map((staff: any) => ({
              id: staff.id,
              name: staff.name,
              hasSalary: staff.salary !== null && staff.salary !== undefined && staff.salary > 0,
            }));
            
            setStaffList(transformedStaffList);

            if (transformedStaffList.length > 0) {
              setSelectedStaffId(transformedStaffList[0].id);
            }
        } else {
            toast.error(result.message || "Failed to fetch staff.");
        }
      } catch (error) { toast.error('Network error fetching staff.'); } 
      finally { setLoadingStaff(false); }
    };
    fetchStaff();
  }, [currentTenantId]);

  const handleLogReviews = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffId) return toast.error('Please select a staff member.');
    if (!currentTenantId) return toast.error('Tenant information not available.');
    setLoading(true);
    try {
        const headers = new Headers();
        headers.append('Content-Type', 'application/json');
        headers.append('X-Tenant-ID', currentTenantId);
        const response = await fetch('/api/incentives', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                staffId: selectedStaffId, 
                date: logDate,
                reviewsWithName: Number(reviewsWithName) || 0,
                reviewsWithPhoto: Number(reviewsWithPhoto) || 0,
            }),
        });
        const data = await response.json();
        if (response.ok) {
            toast.success(data.message || 'Daily data locked in successfully!');
            setReviewsWithName('');
            setReviewsWithPhoto('');
        } else { toast.error(data.message || 'An error occurred.'); }
    } catch (error) { toast.error('An error occurred while saving.'); } 
    finally { setLoading(false); }
  };

  const handleCalculateIncentive = async () => {
    if (!selectedStaffId) return toast.error('Please select a staff member.');
    if (!currentTenantId) return toast.error('Tenant information not available.');
    setLoading(true);
    setResults(null); 
    try {
        const headers = new Headers();
        headers.append('X-Tenant-ID', currentTenantId);
        const response = await fetch(`/api/incentives/calculation/${selectedStaffId}?date=${logDate}`, { headers });
        const data = await response.json();
        if (response.ok) {
            setResults(data);
            setIsResultsModalOpen(true);
            toast.success('Incentives calculated successfully!');
        } else { toast.error(data.message || 'Failed to calculate incentive.'); }
    } catch (error) { toast.error('A network error occurred during calculation.'); } 
    finally { setLoading(false); }
  };
  
  const fetchReportData = async () => {
    if (!currentTenantId) {
        toast.error('Tenant information not available.');
        return null;
    }
    setIsDownloading(true);
    try {
        const headers = new Headers();
        headers.append('Content-Type', 'application/json');
        headers.append('X-Tenant-ID', currentTenantId);
        const response = await fetch('/api/incentives/report', {
            method: 'POST',
            headers,
            body: JSON.stringify({ startDate: reportStartDate, endDate: reportEndDate }),
        });
        const result = await response.json();
        if (response.ok && result.success) {
            if (result.data.dailyReport.length === 0 && result.data.monthlyReport.length === 0) {
                toast.info('No incentive data found for the selected period.');
                return null;
            }
            return result.data;
        } else {
            toast.error(result.message || 'Failed to fetch report data.');
            return null;
        }
    } catch (error) {
        toast.error('Network error while fetching report data.');
        return null;
    } finally {
        setIsDownloading(false);
    }
  };

  const handleDownloadAllPdf = async () => {
    const reportData = await fetchReportData();
    if (!reportData) return;

    const { dailyReport, monthlyReport, staffSummary } = reportData;
    const doc = new jsPDF() as jsPDF & { lastAutoTable: { finalY: number } };
    let lastY = 15;

    doc.setFontSize(16);
    doc.text(`Incentive Report: ${reportStartDate} to ${reportEndDate}`, 14, lastY);
    lastY += 10;

    if (dailyReport.length > 0) {
        doc.setFontSize(12);
        doc.text("Daily Incentive Details", 14, lastY);
        lastY += 7;
        autoTable(doc, {
            head: [Object.keys(dailyReport[0])],
            body: dailyReport.map((row: any) => Object.values(row)),
            startY: lastY,
            theme: 'grid',
            headStyles: { fillColor: [44, 62, 80] },
        });
        lastY = doc.lastAutoTable.finalY; 
    }

    if (monthlyReport.length > 0) {
        lastY += 12;
        doc.setFontSize(12);
        doc.text("Monthly Incentive Summary", 14, lastY);
        lastY += 7;
        autoTable(doc, {
            head: [Object.keys(monthlyReport[0])],
            body: monthlyReport.map((row: any) => Object.values(row)),
            startY: lastY,
            theme: 'grid',
            headStyles: { fillColor: [22, 160, 133] },
        });
        lastY = doc.lastAutoTable.finalY;
    }

    if (staffSummary.length > 0) {
        lastY += 12;
        doc.setFontSize(12);
        doc.text("Staff-wise Total Summary", 14, lastY);
        lastY += 7;
        autoTable(doc, {
            head: [Object.keys(staffSummary[0])],
            body: staffSummary.map((row: any) => Object.values(row)),
            startY: lastY,
            theme: 'grid',
            headStyles: { fillColor: [127, 140, 141] },
        });
    }
    
    doc.save(`incentive-report_${reportStartDate}_to_${reportEndDate}.pdf`);
    toast.success("PDF report downloaded!");
  };

  const handleDownloadAllExcel = async () => {
    const reportData = await fetchReportData();
    if (!reportData) return;
    
    const { dailyReport, monthlyReport, staffSummary } = reportData;
    const workbook = XLSX.utils.book_new();

    if (dailyReport.length > 0) {
      const dailyWorksheet = XLSX.utils.json_to_sheet(dailyReport);
      XLSX.utils.book_append_sheet(workbook, dailyWorksheet, "Daily Details");
    }

    if (monthlyReport.length > 0) {
      const monthlyWorksheet = XLSX.utils.json_to_sheet(monthlyReport);
      XLSX.utils.book_append_sheet(workbook, monthlyWorksheet, "Monthly Summary");
    }

    if (staffSummary.length > 0) {
      const summaryWorksheet = XLSX.utils.json_to_sheet(staffSummary);
      XLSX.utils.book_append_sheet(workbook, summaryWorksheet, "Staff Totals");
    }

    XLSX.writeFile(workbook, `incentive-report_${reportStartDate}_to_${reportEndDate}.xlsx`);
    toast.success("Excel report downloaded!");
  };

  const handleResetData = async () => { /* Your implementation */ };

  return (
    <div className="bg-gray-50 min-h-screen">
      {isSettingsModalOpen && currentTenantId && <IncentiveSettingsModal onClose={() => setIsSettingsModalOpen(false)} tenantId={currentTenantId} />}
      <IncentiveResultsModal isOpen={isResultsModalOpen} onClose={() => setIsResultsModalOpen(false)} data={results} />
      
      <div className="container mx-auto p-4 md:p-8">
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-800">Incentives Dashboard</h1>
            {canManageIncentives && ( <Button onClick={() => setIsSettingsModalOpen(true)} variant="outline" className="flex items-center gap-2"> <Settings size={16} /> Manage Rules </Button> )}
        </div>
        
        <Card>
            <h2 className="text-xl font-semibold text-gray-700 border-b pb-3 mb-4">Context for Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Staff Member</label>
                <select value={selectedStaffId} onChange={(e) => setSelectedStaffId(e.target.value)} className="w-full p-3 border rounded-lg bg-gray-50 text-black" disabled={loadingStaff}>
                  {loadingStaff ? <option>Loading...</option> : staffList.length === 0 ? <option>No staff found</option> : staffList.map((staff) => (<option key={staff.id} value={staff.id}>{staff.name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} className="w-full p-2.5 border rounded-lg bg-gray-50 text-black" />
              </div>
            </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
          <div className="space-y-8">
            <Card>
                <h2 className="text-xl font-semibold text-gray-700 border-b pb-3 mb-4">Log Reviews & Sync Sales</h2>
                <form onSubmit={handleLogReviews} className="space-y-4">
                    <p className="text-sm text-gray-500 -mt-2 mb-2">Use this to sync sales and lock in the day's incentive rule.</p>
                    <InputWithIcon icon={<Star size={18} />} placeholder="Reviews (Name Only)" value={reviewsWithName} onChange={e => setReviewsWithName(e.target.value)} />
                    <InputWithIcon icon={<Gift size={18} />} placeholder="Reviews (with Photo)" value={reviewsWithPhoto} onChange={e => setReviewsWithPhoto(e.target.value)} />
                    {canManageIncentives && (
                      <Button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2" variant="black">
                          <PlusCircle size={18} /> {loading ? 'Saving...' : 'Save & Lock Day'}
                      </Button>
                    )}
                </form>
            </Card>
            <Card>
                <h2 className="text-xl font-semibold text-gray-700 border-b pb-3 mb-4">Download Bulk Reports</h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                          <input type="date" value={reportStartDate} onChange={(e) => setReportStartDate(e.target.value)} className="w-full p-2.5 border rounded-lg bg-gray-50 text-black" />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                          <input type="date" value={reportEndDate} onChange={(e) => setReportEndDate(e.target.value)} className="w-full p-2.5 border rounded-lg bg-gray-50 text-black" />
                      </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t mt-4">
                      <Button onClick={handleDownloadAllPdf} disabled={isDownloading} className="flex items-center justify-center gap-2" variant="outline">
                         <Download size={16} />
                         {isDownloading ? 'Generating...' : 'Download PDF'}
                      </Button>
                      <Button onClick={handleDownloadAllExcel} disabled={isDownloading} className="flex items-center justify-center gap-2" variant="outline">
                         <Download size={16} />
                         {isDownloading ? 'Generating...' : 'Download Excel'}
                      </Button>
                  </div>
                </div>
            </Card>
          </div>
          
          <Card>
              <h2 className="text-xl font-semibold text-gray-700 border-b pb-3 mb-4">Actions & Results</h2>
              <div className="grid grid-cols-1 gap-4">
                  <Button onClick={handleCalculateIncentive} disabled={isCalculationDisabled} className="w-full" variant="black">
                      {loading ? 'Calculating...' : 'Calculate Individual Incentive'}
                  </Button>
                  {selectedStaffMember && !selectedStaffMember.hasSalary && (
                    <div className="flex items-center gap-2 text-sm text-yellow-700 bg-yellow-50 p-3 rounded-lg">
                        <AlertTriangle size={20} /><span>Cannot calculate: Staff salary is not set.</span>
                    </div>
                  )}
                  {canManageIncentives && (
                    <Button onClick={handleResetData} disabled={loading || !selectedStaffId} className="w-full flex items-center justify-center gap-2" variant="danger">
                        <RefreshCcw size={16} /> {loading ? 'Resetting...' : "Reset Day's Reviews"}
                    </Button>
                  )}
              </div>
               <div className="mt-6 bg-gray-100 p-6 rounded-lg min-h-[150px] flex flex-col justify-center">
                    <div className="text-center text-gray-400">
                        <BarChartBig size={48} className="mx-auto mb-4" />
                        <h3 className="font-semibold text-lg text-gray-600">Individual results pop-up here</h3>
                        <p className="text-sm">Click 'Calculate' to get live results.</p>
                    </div>
                </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
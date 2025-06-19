'use client';
import React, { useState, useEffect } from 'react';
import { IndianRupee, Calendar, CheckCircle, XCircle, RefreshCcw } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

// Interface for the data we expect from the API
interface StaffMember {
  id: string;
  name: string;
}

// ===================================================================
//  Settings Modal Component (No Changes)
// ===================================================================
interface Rule {
  target: { multiplier: number };
  sales: { includeServiceSale: boolean; includeProductSale: boolean; reviewNameValue: number; reviewPhotoValue: number; };
  incentive: { rate: number; applyOn: 'totalSaleValue' | 'serviceSaleOnly'; };
}

interface SettingsProps {
  onClose: () => void;
}

const defaultRule: Rule = {
  target: { multiplier: 5 },
  sales: { includeServiceSale: true, includeProductSale: true, reviewNameValue: 200, reviewPhotoValue: 300 },
  incentive: { rate: 0.05, applyOn: 'totalSaleValue' }
};

function IncentiveSettingsModal({ onClose }: SettingsProps) {
  const [dailyRule, setDailyRule] = useState<Rule>(defaultRule);
  const [monthlyRule, setMonthlyRule] = useState<Rule>({ ...defaultRule, sales: {...defaultRule.sales, includeProductSale: false }, incentive: {...defaultRule.incentive, applyOn: 'serviceSaleOnly' }});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function fetchRules() {
      setLoading(true);
      try {
        const res = await fetch('/api/incentives/rules');
        const data = await res.json();
        if (res.ok) {
          setDailyRule(data.daily);
          setMonthlyRule(data.monthly);
        } else {
          setMessage(data.message || 'Failed to load rules.');
        }
      } catch (err) {
        setMessage('Network error fetching rules.');
      } finally {
        setLoading(false);
      }
    }
    fetchRules();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
        const res = await fetch('/api/incentives/rules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ daily: dailyRule, monthly: monthlyRule })
        });
        const data = await res.json();
        setMessage(data.message || "An error occurred.");
        if(res.ok) {
            setTimeout(() => onClose(), 1500);
        }
    } catch (err) {
        setMessage('Network error saving rules.');
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
        for (let i = 0; i < keys.length - 1; i++) {
            current = current[keys[i]];
        }
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
        {message && <p className={`mt-4 text-center p-2 rounded ${message.includes('success') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{message}</p>}
        <div className="flex justify-end gap-4 mt-6 pt-4 border-t">
            <Button onClick={onClose} variant="danger">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} variant="black">{saving ? 'Saving...' : 'Save All Rules'}</Button>
        </div>
      </div>
    </div>
  );
}

// Helper sub-component for the modal form (No Changes)
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
            <div>
                <label className="font-semibold text-gray-700 block mb-1">Apply Incentive On</label>
                 <select value={rule.incentive.applyOn} onChange={(e) => onChange('incentive.applyOn', e.target.value)} className="w-full p-2 border rounded text-black bg-white"><option value="totalSaleValue">Total Sale Value</option><option value="serviceSaleOnly">Service Sale Only</option></select>
            </div>
        </div>
    </Card>
);

// ========================================================
//  MAIN PAGE COMPONENT (UPDATED)
// ========================================================

export default function IncentivesPage() {
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [serviceSale, setServiceSale] = useState('');
  const [productSale, setProductSale] = useState('');
  const [reviewsWithName, setReviewsWithName] = useState('');
  const [reviewsWithPhoto, setReviewsWithPhoto] = useState('');
  const [customerCount, setCustomerCount] = useState('');

  const [loading, setLoading] = useState(false);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [message, setMessage] = useState('');
  const [results, setResults] = useState<any>(null);

  useEffect(() => {
    const fetchStaff = async () => {
      setLoadingStaff(true);
      try {
        const response = await fetch('/api/staff?action=list'); 
        if (!response.ok) {
          setMessage(`Error: Could not load staff. Status: ${response.status}`);
          return;
        }
        const result = await response.json();
        if (result.data && Array.isArray(result.data)) {
          setStaffList(result.data);
          if (result.data.length > 0) setSelectedStaffId(result.data[0].id);
        } else {
          setMessage("Error: Received invalid data for staff list.");
        }
      } catch (error) {
        setMessage('Error: A network or parsing error occurred.');
      } finally {
        setLoadingStaff(false);
      }
    };
    fetchStaff();
  }, []);

  const handleLogSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffId) { setMessage('Please select a staff member.'); return; }
    setLoading(true);
    setMessage('');
    setResults(null);
    try {
        const response = await fetch('/api/incentives', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                staffId: selectedStaffId, date,
                serviceSale: Number(serviceSale) || 0,
                productSale: Number(productSale) || 0,
                reviewsWithName: Number(reviewsWithName) || 0,
                reviewsWithPhoto: Number(reviewsWithPhoto) || 0,
                customerCount: Number(customerCount) || 0,
            }),
        });
        const data = await response.json();
        setMessage(data.message || (response.ok ? 'Success!' : 'An error occurred.'));
        if (response.ok) {
            setServiceSale('');
            setProductSale('');
            setReviewsWithName('');
            setReviewsWithPhoto('');
            setCustomerCount('');
        }
    } catch (error) {
        setMessage('An error occurred while logging the sale.');
    } finally {
        setLoading(false);
    }
  };

  const handleCalculateIncentive = async () => {
    if (!selectedStaffId) { setMessage('Please select a staff member.'); return; }
    setLoading(true);
    setMessage('');
    setResults(null);
    try {
        const response = await fetch(`/api/incentives/${selectedStaffId}?date=${date}`);
        const data = await response.json();
        if (response.ok) {
            setResults(data);
        } else {
            setMessage(data.message || 'Failed to calculate incentive.');
        }
    } catch (error) {
        setMessage('An error occurred during calculation.');
    } finally {
        setLoading(false);
    }
  };

  // <-- NEW FUNCTION TO HANDLE RESETTING DATA -->
  const handleResetData = async () => {
    if (!selectedStaffId) {
        setMessage('Please select a staff member to reset data.');
        return;
    }
    // Add a confirmation dialog to prevent accidental deletion
    const isConfirmed = window.confirm(`Are you sure you want to reset all logged sales and reviews for ${staffList.find(s => s.id === selectedStaffId)?.name} on ${date}? This action cannot be undone.`);
    
    if (!isConfirmed) {
        return;
    }

    setLoading(true);
    setMessage('');
    setResults(null); // Clear previous results
    try {
        const response = await fetch('/api/incentives/reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ staffId: selectedStaffId, date: date }),
        });
        const data = await response.json();
        setMessage(data.message || 'An error occurred during reset.');
    } catch (error) {
        setMessage('A network error occurred while resetting data.');
    } finally {
        setLoading(false);
    }
  };

  const renderResultCard = (title: string, data: any) => {
    if (!data || Object.keys(data).length === 0) {
        return <Card title={title} className="w-full"><p className="text-gray-500">No data available to calculate.</p></Card>;
    }
    return (
        <Card title={title} className="w-full">
            <div className="space-y-2">
                <div className={`flex justify-between items-center p-2 rounded ${data.isTargetMet ? 'bg-green-100' : 'bg-red-100'}`}>
                    <span className="font-medium text-gray-800">Target Met:</span>
                    {data.isTargetMet ? <CheckCircle className="text-green-600"/> : <XCircle className="text-red-600"/>}
                </div>
                {Object.entries(data).map(([key, value]) => {
                    if (key === 'isTargetMet' || typeof value === 'undefined') return null;
                    const keyFormatted = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                    return (
                        <div key={key} className="flex justify-between border-b pb-1">
                            <span className="text-gray-600">{keyFormatted}:</span>
                            <span className="font-semibold text-gray-900">{typeof value === 'number' ? `₹${value.toFixed(2)}` : String(value)}</span>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {isSettingsModalOpen && <IncentiveSettingsModal onClose={() => setIsSettingsModalOpen(false)} />}
      
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Sales & Review Incentives</h1>
        <Button onClick={() => setIsSettingsModalOpen(true)} variant="black">Manage Rules</Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Staff Member</label>
          <select value={selectedStaffId} onChange={(e) => setSelectedStaffId(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-gray-900 bg-white" disabled={loadingStaff || staffList.length === 0}>
            {loadingStaff ? <option>Loading...</option> : staffList.length === 0 ? <option>No staff found</option> : staffList.map((staff) => (<option key={staff.id} value={staff.id}>{staff.name}</option>))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-gray-900" />
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-8">
        <Card title="Log Daily Sales & Reviews" className="border-blue-200">
            <form onSubmit={handleLogSale} className="space-y-4">
                <input 
                    type="number" 
                    placeholder="Number of Customers Served" 
                    value={customerCount} 
                    onChange={e => setCustomerCount(e.target.value)} 
                    className="w-full p-2 border rounded text-black"
                    required
                />
                <input type="number" placeholder="Service Sale (₹)" value={serviceSale} onChange={e => setServiceSale(e.target.value)} className="w-full p-2 border rounded text-black"/>
                <input type="number" placeholder="Product Sale (₹)" value={productSale} onChange={e => setProductSale(e.target.value)} className="w-full p-2 border rounded text-black"/>
                <input type="number" placeholder="Reviews (Name Only)" value={reviewsWithName} onChange={e => setReviewsWithName(e.target.value)} className="w-full p-2 border rounded text-black"/>
                <input type="number" placeholder="Reviews (with Photo)" value={reviewsWithPhoto} onChange={e => setReviewsWithPhoto(e.target.value)} className="w-full p-2 border rounded text-black"/>
                <Button type="submit" disabled={loading} className="w-full" variant="black">{loading ? 'Logging...' : 'Log Data'}</Button>
            </form>
        </Card>
        <Card title="Calculate Incentives" className="border-green-200">
            <div className="flex flex-col h-full justify-center space-y-4">
                <p className="text-center text-gray-600">Calculate incentives for the selected staff and date.</p>
                <Button onClick={handleCalculateIncentive} disabled={loading} className="w-full" variant="black">{loading ? 'Calculating...' : 'Calculate Now'}</Button>
                {/* <-- NEW RESET BUTTON --> */}
                <Button onClick={handleResetData} disabled={loading} className="w-full flex items-center justify-center gap-2" variant="danger">
                  <RefreshCcw size={16} />
                  {loading ? 'Resetting...' : "Reset Day's Data"}
                </Button>
            </div>
        </Card>
      </div>
      <div className="mt-8">
        {message && <div className="p-4 mb-4 text-sm text-center text-blue-700 bg-blue-100 rounded-lg">{message}</div>}
        {results && (
            <div className="space-y-6">
                <h2 className="text-xl font-semibold text-center text-gray-700">Results for {results.staffName} on {results.calculationDate}</h2>
                <div className="grid md:grid-cols-2 gap-8">
                    {renderResultCard("Incentive 1: Daily Target", results.incentive1_daily)}
                    {renderResultCard("Incentive 2: Monthly Target", results.incentive2_monthly)}
                </div>
            </div>
        )}
      </div>
    </div>
  );
}
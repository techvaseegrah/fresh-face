import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

// Interfaces and default data
interface Rule { target: { multiplier: number; }; sales: { includeServiceSale: boolean; includeProductSale: boolean; reviewNameValue: number; reviewPhotoValue: number; }; incentive: { rate: number; doubleRate: number; applyOn: 'totalSaleValue' | 'serviceSaleOnly'; };}
interface SettingsProps { onClose: () => void; tenantId: string; }
const defaultRule: Rule = { target: { multiplier: 5 }, sales: { includeServiceSale: true, includeProductSale: true, reviewNameValue: 200, reviewPhotoValue: 300 }, incentive: { rate: 0.05, doubleRate: 0.10, applyOn: 'totalSaleValue' }};

// Helper component
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

// Main Modal Component
export default function IncentiveSettingsModal({ onClose, tenantId }: SettingsProps) {
  const [dailyRule, setDailyRule] = useState<Rule>(defaultRule);
  const [monthlyRule, setMonthlyRule] = useState<Rule>({ ...defaultRule, sales: {...defaultRule.sales, includeProductSale: false }, incentive: {...defaultRule.incentive, applyOn: 'serviceSaleOnly' }});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchRules() {
      setLoading(true);
      try {
        const headers = new Headers({ 'X-Tenant-ID': tenantId });
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
    try {
        const headers = new Headers({ 'Content-Type': 'application/json', 'X-Tenant-ID': tenantId });
        const res = await fetch('/api/incentives/rules', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ daily: dailyRule, monthly: monthlyRule })
        });
        const data = await res.json();
        if(res.ok) {
            toast.success(data.message || 'Rules saved successfully!');
            setTimeout(onClose, 1500);
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
        let temp = { ...prev };
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
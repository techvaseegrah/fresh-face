'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

// ✨ --- MODIFICATION: Added includePackageSale and includeGiftCardSale --- ✨
interface MultiplierRule {
  target: { multiplier: number; };
  sales: {
    includeServiceSale: boolean;
    includeProductSale: boolean;
    includePackageSale?: boolean; // Now optional for the Daily rule
    includeGiftCardSale?: boolean; // Now optional for the Daily rule
    reviewNameValue?: number; 
    reviewPhotoValue?: number;
  };
  incentive: {
    rate: number;
    doubleRate: number;
    applyOn: 'totalSaleValue' | 'serviceSaleOnly';
  };
}

interface FixedTargetRule {
  target: { targetValue: number; };
  incentive: {
    rate: number;
    doubleRate: number;
  };
}


interface SettingsProps {
  onClose: () => void;
  tenantId: string;
}

// ✨ --- MODIFICATION: Added new properties to the default daily rule --- ✨
const defaultDailyRule: MultiplierRule = {
  target: { multiplier: 5 },
  sales: { 
    includeServiceSale: true, 
    includeProductSale: true, 
    includePackageSale: false, // Default to false
    includeGiftCardSale: false, // Default to false
    reviewNameValue: 200, 
    reviewPhotoValue: 300 
  },
  incentive: { rate: 0.05, doubleRate: 0.10, applyOn: 'totalSaleValue' }
};
const defaultMonthlyRule: MultiplierRule = {
  target: { multiplier: 5 },
  sales: { includeServiceSale: true, includeProductSale: false },
  incentive: { rate: 0.05, doubleRate: 0.10, applyOn: 'serviceSaleOnly' }
};
const defaultPackageRule: FixedTargetRule = {
    target: { targetValue: 20000 },
    incentive: { rate: 0.03, doubleRate: 0.05 }
};
const defaultGiftCardRule: FixedTargetRule = {
    target: { targetValue: 10000 },
    incentive: { rate: 0.01, doubleRate: 0.02 }
};


const MultiplierRuleEditor = ({ title, rule, onChange, ruleType }: { title: string; rule: MultiplierRule; onChange: (path: string, value: any) => void; ruleType: 'daily' | 'monthly' }) => (
    <Card>
        <div className="p-4">
            <h3 className="text-xl font-bold text-slate-800 mb-4 border-b pb-2">{title}</h3>
            <div className="space-y-4">
                <div>
                    <label className="font-semibold text-gray-700 block mb-1">Target Multiplier (of Salary)</label>
                    <input type="number" value={rule.target.multiplier} onChange={(e) => onChange(`${ruleType}.target.multiplier`, Number(e.target.value))} className="w-full p-2 border rounded text-black bg-white focus:ring-2 focus:ring-indigo-500"/>
                </div>
                <div>
                    <label className="font-semibold text-gray-700 block mb-1">Sales to Include for Target</label>
                    <div className="flex items-center mt-2"><input type="checkbox" id={`${ruleType}-service`} checked={rule.sales.includeServiceSale} onChange={(e) => onChange(`${ruleType}.sales.includeServiceSale`, e.target.checked)} className="h-4 w-4 rounded"/><label htmlFor={`${ruleType}-service`} className="ml-2 text-gray-600">Service Sale</label></div>
                    <div className="flex items-center mt-1"><input type="checkbox" id={`${ruleType}-product`} checked={rule.sales.includeProductSale} onChange={(e) => onChange(`${ruleType}.sales.includeProductSale`, e.target.checked)} className="h-4 w-4 rounded"/><label htmlFor={`${ruleType}-product`} className="ml-2 text-gray-600">Product Sale</label></div>
                    
                    {/* ✨ --- MODIFICATION: Add Package and Gift Card checkboxes ONLY for the Daily rule --- ✨ */}
                    {ruleType === 'daily' && (
                        <>
                            <div className="flex items-center mt-1"><input type="checkbox" id="daily-package" checked={rule.sales.includePackageSale} onChange={(e) => onChange('daily.sales.includePackageSale', e.target.checked)} className="h-4 w-4 rounded"/><label htmlFor="daily-package" className="ml-2 text-gray-600">Package Sale</label></div>
                            <div className="flex items-center mt-1"><input type="checkbox" id="daily-giftcard" checked={rule.sales.includeGiftCardSale} onChange={(e) => onChange('daily.sales.includeGiftCardSale', e.target.checked)} className="h-4 w-4 rounded"/><label htmlFor="daily-giftcard" className="ml-2 text-gray-600">Gift Card Sale</label></div>
                        </>
                    )}
                </div>
                {ruleType === 'daily' && rule.sales.reviewNameValue !== undefined && (
                    <>
                        <div>
                            <label className="font-semibold text-gray-700 block mb-1">Review (Name) Value (₹)</label>
                            <input type="number" value={rule.sales.reviewNameValue} onChange={(e) => onChange('daily.sales.reviewNameValue', Number(e.target.value))} className="w-full p-2 border rounded text-black bg-white focus:ring-2 focus:ring-indigo-500"/>
                        </div>
                        <div>
                            <label className="font-semibold text-gray-700 block mb-1">Review (Photo) Value (₹)</label>
                            <input type="number" value={rule.sales.reviewPhotoValue} onChange={(e) => onChange('daily.sales.reviewPhotoValue', Number(e.target.value))} className="w-full p-2 border rounded text-black bg-white focus:ring-2 focus:ring-indigo-500"/>
                        </div>
                    </>
                )}
                <hr/>
                <div>
                    <label className="font-semibold text-gray-700 block mb-1">Incentive Rate (e.g., 0.05 for 5%)</label>
                    <input type="number" step="0.01" value={rule.incentive.rate} onChange={(e) => onChange(`${ruleType}.incentive.rate`, Number(e.target.value))} className="w-full p-2 border rounded text-black bg-white focus:ring-2 focus:ring-indigo-500"/>
                </div>
                <div>
                    <label className="font-semibold text-gray-700 block mb-1">Double Incentive Rate (for 2x Target)</label>
                    <input type="number" step="0.01" value={rule.incentive.doubleRate} onChange={(e) => onChange(`${ruleType}.incentive.doubleRate`, Number(e.target.value))} className="w-full p-2 border rounded text-black bg-white focus:ring-2 focus:ring-indigo-500"/>
                </div>
                <div>
                    <label className="font-semibold text-gray-700 block mb-1">Apply Incentive On</label>
                    <select value={rule.incentive.applyOn} onChange={(e) => onChange(`${ruleType}.incentive.applyOn`, e.target.value)} className="w-full p-2 border rounded text-black bg-white focus:ring-2 focus:ring-indigo-500">
                        <option value="totalSaleValue">Total Achieved Value</option>
                        <option value="serviceSaleOnly">Service Sale Only</option>
                    </select>
                </div>
            </div>
        </div>
    </Card>
);

const FixedTargetRuleEditor = ({ title, rule, onChange, ruleType }: { title: string; rule: FixedTargetRule; onChange: (path: string, value: any) => void; ruleType: 'package' | 'giftCard' }) => (
    <Card>
        <div className="p-4">
            <h3 className="text-xl font-bold text-slate-800 mb-4 border-b pb-2">{title}</h3>
            <div className="space-y-4">
                <div>
                    <label className="font-semibold text-gray-700 block mb-1">Monthly Target Value (₹)</label>
                    <input type="number" value={rule.target.targetValue} onChange={(e) => onChange(`${ruleType}.target.targetValue`, Number(e.target.value))} className="w-full p-2 border rounded text-black bg-white focus:ring-2 focus:ring-indigo-500"/>
                </div>
                <hr/>
                <div>
                    <label className="font-semibold text-gray-700 block mb-1">Incentive Rate (e.g., 0.03 for 3%)</label>
                    <input type="number" step="0.01" value={rule.incentive.rate} onChange={(e) => onChange(`${ruleType}.incentive.rate`, Number(e.target.value))} className="w-full p-2 border rounded text-black bg-white focus:ring-2 focus:ring-indigo-500"/>
                </div>
                <div>
                    <label className="font-semibold text-gray-700 block mb-1">Double Incentive Rate (for 2x Target)</label>
                    <input type="number" step="0.01" value={rule.incentive.doubleRate} onChange={(e) => onChange(`${ruleType}.incentive.doubleRate`, Number(e.target.value))} className="w-full p-2 border rounded text-black bg-white focus:ring-2 focus:ring-indigo-500"/>
                </div>
            </div>
        </div>
    </Card>
);

export default function IncentiveSettingsModal({ onClose, tenantId }: SettingsProps) {
  const [dailyRule, setDailyRule] = useState<MultiplierRule>(defaultDailyRule);
  const [monthlyRule, setMonthlyRule] = useState<MultiplierRule>(defaultMonthlyRule);
  const [packageRule, setPackageRule] = useState<FixedTargetRule>(defaultPackageRule);
  const [giftCardRule, setGiftCardRule] = useState<FixedTargetRule>(defaultGiftCardRule);

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
          setDailyRule({ ...defaultDailyRule, ...data.daily, sales: { ...defaultDailyRule.sales, ...data.daily?.sales } });
          setMonthlyRule({ ...defaultMonthlyRule, ...data.monthly });
          setPackageRule({ ...defaultPackageRule, ...data.package });
          setGiftCardRule({ ...defaultGiftCardRule, ...data.giftCard });
        } else {
          toast.error(data.message || 'Failed to load rules.');
        }
      } catch (err) {
        toast.error('Network error fetching rules.');
      } finally {
        setLoading(false);
      }
    }
    if (tenantId) {
        fetchRules();
    }
  }, [tenantId]);

  const handleSave = async () => {
    setSaving(true);
    try {
        const headers = new Headers({ 'Content-Type': 'application/json', 'X-Tenant-ID': tenantId });
        const res = await fetch('/api/incentives/rules', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ 
                daily: dailyRule, 
                monthly: monthlyRule,
                package: packageRule,
                giftCard: giftCardRule
            })
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
  
  const handleRuleChange = (path: string, value: any) => {
    const ruleType = path.split('.')[0] as 'daily' | 'monthly' | 'package' | 'giftCard';
    const setterMap = {
        daily: setDailyRule,
        monthly: setMonthlyRule,
        package: setPackageRule,
        giftCard: setGiftCardRule
    };
    const setter = setterMap[ruleType];

    setter((prev: MultiplierRule | FixedTargetRule) => {
        const keys = path.split('.').slice(1);
        let temp = JSON.parse(JSON.stringify(prev));
        let current = temp as any;
        for (let i = 0; i < keys.length - 1; i++) {
            current = current[keys[i]];
        }
        current[keys[keys.length - 1]] = value;
        return temp;
    });
  };

  if (loading) {
      return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="text-white font-bold text-lg">Loading Settings...</div>
          </div>
      );
  }
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4 animate-fade-in">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6 text-gray-800 border-b pb-3">Manage Incentive Rules</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MultiplierRuleEditor title="Incentive 1: Daily" rule={dailyRule} onChange={handleRuleChange} ruleType="daily" />
            <MultiplierRuleEditor title="Incentive 2: Monthly" rule={monthlyRule} onChange={handleRuleChange} ruleType="monthly" />
            <FixedTargetRuleEditor title="Incentive 3: Package" rule={packageRule} onChange={handleRuleChange} ruleType="package" />
            <FixedTargetRuleEditor title="Incentive 4: Gift Card" rule={giftCardRule} onChange={handleRuleChange} ruleType="giftCard" />
        </div>
        <div className="flex justify-end gap-4 mt-8 pt-4 border-t">
            <Button onClick={onClose} variant="outline">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} variant="success">{saving ? 'Saving...' : 'Save All Rules'}</Button>
        </div>
      </div>
    </div>
  );
}
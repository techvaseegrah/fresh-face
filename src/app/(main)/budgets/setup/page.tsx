"use client";

import { useState, useMemo, useEffect, ElementType } from 'react';
import { useSession } from 'next-auth/react';
import { IBudgetItem } from '@/types/budget';
import { PlusCircle, Trash2, PiggyBank, ShoppingCart, BarChart2 } from 'lucide-react';

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);
const months = [
  { value: 1, name: 'January' }, { value: 2, name: 'February' },
  { value: 3, name: 'March' }, { value: 4, name: 'April' },
  { value: 5, name: 'May' }, { value: 6, name: 'June' },
  { value: 7, name: 'July' }, { value: 8, name: 'August' },
  { value: 9, name: 'September' }, { value: 10, name: 'October' },
  { value: 11, name: 'November' }, { value: 12, name: 'December' },
];

type DashboardCardProps = {
  title: string;
  value: number;
  icon: ElementType;
  colorClass: string;
};

const DashboardCard = ({ title, value, icon: Icon, colorClass }: DashboardCardProps) => (
  <div className={`relative p-6 rounded-xl shadow-lg text-white overflow-hidden ${colorClass}`}>
    <div className="relative z-10">
      <p className="text-sm font-semibold uppercase">{title}</p>
      <p className="text-4xl font-bold mt-2">₹{value.toLocaleString()}</p>
    </div>
    <div className="absolute -right-4 -bottom-4 opacity-20 z-0">
      <Icon size={80} />
    </div>
  </div>
);

export default function BudgetSetupPage() {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(currentYear);
  const [fixedExpenses, setFixedExpenses] = useState<IBudgetItem[]>([]);
  const [variableExpenses, setVariableExpenses] = useState<IBudgetItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  const { data: session, status } = useSession();

  const totalFixed = useMemo(() => fixedExpenses.reduce((sum, item) => sum + item.amount, 0), [fixedExpenses]);
  const totalVariable = useMemo(() => variableExpenses.reduce((sum, item) => sum + item.amount, 0), [variableExpenses]);
  const grandTotal = totalFixed + totalVariable;

  const fetchBudget = async () => {
    if (status !== 'authenticated' || !session?.user?.tenantId) {
      setMessage("Error: User session not found. Please log in again.");
      return;
    }

    setIsLoading(true);
    setMessage('');
    try {
      const headers = new Headers();
      headers.append('x-tenant-id', session.user.tenantId);

      const res = await fetch(`/api/budgets?month=${month}&year=${year}`, { headers });
      
      if (res.ok) {
        const { data } = await res.json();
        setFixedExpenses(data.fixedExpenses || []);
        setVariableExpenses(data.variableExpenses || []);
        setMessage(data ? 'Budget loaded successfully.' : 'No budget found for this period. You can create one.');
      } else {
        setFixedExpenses([]);
        setVariableExpenses([]);
        const result = await res.json();
        setMessage(`Info: ${result.error || 'No budget found. You can create one.'}`);
      }
    } catch (error) {
      setMessage('An error occurred while fetching the budget.');
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    if (status === 'authenticated') {
      fetchBudget();
    }
  }, [month, year, status]);

  // --- MODIFIED: Added real-time validation logic ---
  const handleItemChange = (type: 'fixed' | 'variable', index: number, field: 'category' | 'amount', value: string) => {
    const updater = type === 'fixed' ? setFixedExpenses : setVariableExpenses;
    updater(prev => {
      const newItems = [...prev];
      const itemToUpdate = { ...newItems[index] };

      if (field === 'amount') {
        // Allow only numbers
        const numericValue = value.replace(/[^0-9]/g, '');
        itemToUpdate.amount = Number(numericValue);
      } else if (field === 'category') {
        // Allow only letters and spaces
        const stringValue = value.replace(/[^a-zA-Z\s]/g, '');
        itemToUpdate.category = stringValue;
      }
      
      newItems[index] = itemToUpdate;
      return newItems;
    });
  };

  const addItem = (type: 'fixed' | 'variable') => {
    const newItem: IBudgetItem = { category: '', amount: 0, type: type === 'fixed' ? 'Fixed' : 'Variable' };
    (type === 'fixed' ? setFixedExpenses : setVariableExpenses)(prev => [...prev, newItem]);
  };

  const removeItem = (type: 'fixed' | 'variable', index: number) => {
    (type === 'fixed' ? setFixedExpenses : setVariableExpenses)(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    if (!session?.user?.tenantId) {
      setMessage("Error: Cannot save budget. User session not found.");
      return;
    }

    if ([...fixedExpenses, ...variableExpenses].some(item => item.category.trim() === '')) {
      setMessage('Error: All budget items must have a category name.');
      return;
    }

    setIsLoading(true);
    const payload = { month, year, fixedExpenses, variableExpenses };

    try {
      const headers = new Headers({
        'Content-Type': 'application/json',
        'x-tenant-id': session.user.tenantId,
      });

      const res = await fetch('/api/budgets', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      setMessage(res.ok ? 'Budget saved successfully!' : `Error: ${result.error || result.message || 'An unknown error occurred.'}`);
    } catch (error) {
      setMessage('An unexpected network error occurred.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const renderExpenseSection = (title: string, items: IBudgetItem[], type: 'fixed' | 'variable', total: number) => (
    <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-violet-500">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-700">{title}</h2>
        <p className="font-bold text-lg text-gray-800">Total: ₹{total.toLocaleString()}</p>
      </div>
      {items.map((item, index) => (
        <div key={index} className="grid grid-cols-12 gap-3 mb-3 items-center">
          <input type="text" placeholder="Category Name" value={item.category} onChange={(e) => handleItemChange(type, index, 'category', e.target.value)} className="col-span-6 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" />
          {/* --- MODIFIED: Changed type to "text" and added inputMode for better validation control --- */}
          <input type="text" inputMode="numeric" placeholder="Amount" value={item.amount || ''} onChange={(e) => handleItemChange(type, index, 'amount', e.target.value)} className="col-span-5 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" />
          <button type="button" onClick={() => removeItem(type, index)} className="col-span-1 flex justify-center text-red-500 hover:text-red-700 transition-colors"><Trash2 size={20} /></button>
        </div>
      ))}
      <button type="button" onClick={() => addItem(type)} className="mt-2 flex items-center text-blue-600 hover:text-blue-800 font-semibold transition-colors"><PlusCircle size={20} className="mr-2" /> Add Item</button>
    </div>
  );

  return (
    <main className="p-4 sm:p-8 bg-gray-50 min-h-screen">
      
      {/* --- Header and Filter Section --- */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Budget Setup</h1>
          <p className="text-gray-500 mt-1">Select a month and year to manage your budget.</p>
        </div>
        <div className="flex items-center gap-4">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500">
            {months.map(m => <option key={m.value} value={m.value}>{m.name}</option>)}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Dashboard Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <DashboardCard title="Total Fixed Expenses" value={totalFixed} icon={PiggyBank} colorClass="bg-gradient-to-tr from-pink-500 to-rose-500" />
        <DashboardCard title="Total Variable Expenses" value={totalVariable} icon={ShoppingCart} colorClass="bg-gradient-to-tr from-cyan-400 to-teal-400" />
        <DashboardCard title="Grand Total Budget" value={grandTotal} icon={BarChart2} colorClass="bg-gradient-to-tr from-violet-500 to-purple-500" />
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-8">
        {renderExpenseSection('Fixed Expenses', fixedExpenses, 'fixed', totalFixed)}
        {renderExpenseSection('Variable Expenses', variableExpenses, 'variable', totalVariable)}
        <div className="bg-white p-4 rounded-lg shadow-md flex justify-between items-center mt-8">
          <div>
            {message && <p className={`text-sm font-semibold ${message.startsWith('Error:') ? 'text-red-600' : (message.startsWith('Info:') ? 'text-blue-600' : 'text-green-600')}`}>{message}</p>}
          </div>
          <button type="submit" disabled={isLoading || status !== 'authenticated'} className="bg-green-600 text-white font-semibold py-2 px-6 rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400">
            {isLoading ? 'Saving...' : 'Save Budget'}
          </button>
        </div>
      </form>
    </main>
  );
}
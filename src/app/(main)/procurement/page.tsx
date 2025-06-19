// app/(main)/procurement/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { DocumentTextIcon, ChevronLeftIcon, ChevronRightIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

interface ProcurementRecord {
  _id: string;
  name: string;
  quantity: number;
  price: number;
  totalPrice: number;
  date: string;
  vendorName: string;
  brand: string;
  unit: string;
  unitPerItem: number;
  expiryDate?: string;
  createdBy: string;
  updatedBy?: string;
}

const UNITS = ['kg', 'gram', 'liter', 'ml', 'piece'];

export default function ProcurementPage() {
  const { data: session } = useSession();
  const [records, setRecords] = useState<ProcurementRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ProcurementRecord | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    quantity: 0,
    price: 0,
    date: new Date().toISOString().split('T')[0],
    vendorName: '',
    brand: '',
    unit: 'kg',
    unitPerItem: 0,
    expiryDate: '',
  });

  console.log(records);
  

  const totalPrice = formData.quantity * formData.price;

  const canReadProcurement = session && hasPermission(session.user.role.permissions, PERMISSIONS.PROCUREMENT_READ);
  const canCreateProcurement = session && hasPermission(session.user.role.permissions, PERMISSIONS.PROCUREMENT_CREATE);
  const canUpdateProcurement = session && hasPermission(session.user.role.permissions, PERMISSIONS.PROCUREMENT_UPDATE);
  const canDeleteProcurement = session && hasPermission(session.user.role.permissions, PERMISSIONS.PROCUREMENT_DELETE);

  useEffect(() => {
    if (canReadProcurement) {
      fetchRecords();
    }
  }, [page, canReadProcurement]);

  const fetchRecords = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/procurement?page=${page}&limit=10`);
      const data = await response.json();
      if (data.success) {
        setRecords(data.records);
        setTotalPages(data.totalPages || 1);
      }
    } catch (error) {
      console.error('Error fetching procurement records:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingRecord ? '/api/procurement' : '/api/procurement';
      const method = editingRecord ? 'PUT' : 'POST';
      const body = {
        ...(editingRecord && { recordId: editingRecord._id }),
        ...formData,
        expiryDate: formData.expiryDate || undefined,
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json();
        if (editingRecord) {
          setRecords(records.map((r) => (r._id === editingRecord._id ? data.record : r)));
        } else {
          setRecords([data.record, ...records]);
        }
        setIsFormOpen(false);
        setEditingRecord(null);
        setFormData({
          name: '',
          quantity: 0,
          price: 0,
          date: new Date().toISOString().split('T')[0],
          vendorName: '',
          brand: '',
          unit: 'kg',
          unitPerItem: 0,
          expiryDate: '',
        });
      } else {
        const errorData = await response.json();
        alert(errorData.message);
      }
    } catch (error) {
      console.error('Error saving procurement record:', error);
      alert('Failed to save record');
    }
  };

  const handleEdit = (record: ProcurementRecord) => {
    setEditingRecord(record);
    setFormData({
      name: record.name,
      quantity: record.quantity,
      price: record.price,
      date: new Date(record.date).toISOString().split('T')[0],
      vendorName: record.vendorName,
      brand: record.brand,
      unit: record.unit,
      unitPerItem: record.unitPerItem,
      expiryDate: record.expiryDate ? new Date(record.expiryDate).toISOString().split('T')[0] : '',
    });
    setIsFormOpen(true);
  };

  const handleDelete = async (recordId: string) => {
    if (!confirm('Are you sure you want to delete this record?')) return;
    try {
      const response = await fetch(`/api/procurement?recordId=${recordId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setRecords(records.filter((r) => r._id !== recordId));
      } else {
        const errorData = await response.json();
        alert(errorData.message);
      }
    } catch (error) {
      console.error('Error deleting procurement record:', error);
      alert('Failed to delete record');
    }
  };

  if (!canReadProcurement) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <p className="text-red-500">You do not have permission to view procurement records.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
          <div className="grid grid-cols-1 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-white rounded-lg shadow"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Procurement Management</h1>
          <p className="text-sm text-gray-500">Manage purchased products and their details</p>
        </div>
        <div className="text-sm text-gray-500">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {canCreateProcurement && (
        <div className="bg-white rounded-lg shadow p-6">
          <button
            onClick={() => {
              setIsFormOpen(!isFormOpen);
              setEditingRecord(null);
              setFormData({
                name: '',
                quantity: 0,
                price: 0,
                date: new Date().toISOString().split('T')[0],
                vendorName: '',
                brand: '',
                unit: 'kg',
                unitPerItem: 0,
                expiryDate: '',
              });
            }}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            {isFormOpen ? 'Cancel' : 'Add New Record'}
          </button>
          {isFormOpen && (
            <form onSubmit={handleFormSubmit} className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Product Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm p-1 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="quantity" className="block text-sm font-medium text-gray-700">
                  Quantity
                </label>
                <input
                  id="quantity"
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm p-1 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
              <div>
                <label htmlFor="price" className="block text-sm font-medium text-gray-700">
                  Price per Unit (INR)
                </label>
                <input
                  id="price"
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm p-1 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
              <div>
                <label htmlFor="totalPrice" className="block text-sm font-medium text-gray-700">
                  Total Price (INR)
                </label>
                <input
                  id="totalPrice"
                  type="text"
                  value={totalPrice.toFixed(2)}
                  readOnly
                  className="mt-1 w-full rounded-md border-gray-300 bg-gray-100 p-2 text-sm text-gray-500"
                />
              </div>
              <div>
                <label htmlFor="date" className="block text-sm font-medium text-gray-700">
                  Purchase Date
                </label>
                <input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm p-1 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="vendorName" className="block text-sm font-medium text-gray-700">
                  Vendor Name
                </label>
                <input
                  id="vendorName"
                  type="text"
                  value={formData.vendorName}
                  onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm p-1 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="brand" className="block text-sm font-medium text-gray-700">
                  Brand
                </label>
                <input
                  id="brand"
                  type="text"
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm p-1 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="unit" className="block text-sm font-medium text-gray-700">
                  Unit
                </label>
                <select
                  id="unit"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm p-1 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  required
                >
                  {UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="unitPerItem" className="block text-sm font-medium text-gray-700">
                  Unit per Item
                </label>
                <input
                  id="unitPerItem"
                  type="number"
                  value={formData.unitPerItem}
                  onChange={(e) => setFormData({ ...formData, unitPerItem: parseFloat(e.target.value) || 0 })}
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm p-1 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  min="0.01"
                  step="0.01"
                  required
                />
              </div>
              <div>
                <label htmlFor="expiryDate" className="block text-sm font-medium text-gray-700">
                  Expiry Date (Optional)
                </label>
                <input
                  id="expiryDate"
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm p-1 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <button
                  type="submit"
                  className="mt-4 px-2 py-1 rounded-md text-sm bg-blue-500 text-white font-semibold hover:bg-blue-600"
                >
                  {editingRecord ? 'Update Record' : 'Add Record'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Name</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Quantity</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-800 uppercase tracking-wide">Price/Unit</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-800 uppercase tracking-wide">Total</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-800 uppercase tracking-wide">Supplier</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Brand</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Unit</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Unit/Item</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Expiry</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-800 uppercase tracking-wide">By</th>
              {(canUpdateProcurement || canDeleteProcurement) && (
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Action</th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {records.map((record) => (
              <tr key={record._id}>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">{record.name}</td>
                <td className="px-4 py-2 whitespace-nowrap text-right text-sm text-gray-600">{record.quantity}</td>
                <td className="px-2 py-2 whitespace-nowrap text-sm text-right text-gray-800 font-semibold">
                  {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(record.price)}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-right text-gray-800 font-semibold">
                  {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(record.price * record.quantity)}
                </td>
                <td className="px-2 py-2 whitespace-nowrap text-sm text-gray-600">
                  {new Date(record.date).toLocaleDateString('en-US')}
                </td>
                <td className="px-2 py-2 whitespace-nowrap text-sm text-gray-800 font-semibold">{record.vendorName}</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">{record.brand}</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">{record.unit}</td>
                <td className="px-4 py-2 whitespace-nowrap text-right text-sm text-gray-600">{record.unitPerItem}</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">
                  {record.expiryDate ? new Date(record.expiryDate).toLocaleDateString('en-US') : 'N/A'}
                </td>
                <td className="px-2 py-2 whitespace-nowrap text-sm text-gray-800 font-semibold">{record.createdBy}</td>
                {(canUpdateProcurement || canDeleteProcurement) && (
                  <td className="px-2 py-2 whitespace-nowrap text-sm">
                    {canUpdateProcurement && (
                      <button
                        onClick={() => handleEdit(record)}
                        className="text-blue-500 hover:text-blue-600 mr-2"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                    )}
                    {canDeleteProcurement && (
                      <button
                        onClick={() => handleDelete(record._id)}
                        className="text-blue-500 hover:text-blue-400"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {records.length === 0 && (
          <div className="text-center py-8">
            <DocumentTextIcon className="h-16 w-16 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No procurement records found.</p>
          </div>
        )}
        <div className="flex justify-between items-center p-4 border-t border-gray-200">
          <button
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
            className={`px-4 py-2 rounded-md text-sm font-medium flex items-center ${
              page === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
            }`}
          >
            <ChevronLeftIcon className="h-4 w-4 mr-1" />
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page === totalPages}
            className={`px-4 py-2 rounded-md text-sm font-medium flex items-center ${
              page === totalPages
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
            }`}
          >
            Next
            <ChevronRightIcon className="h-4 w-4 ml-1" />
          </button>
        </div>
      </div>
    </div>
  );
}
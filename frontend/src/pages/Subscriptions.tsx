import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, ArrowLeft, RefreshCw, CheckCircle, PauseCircle, XCircle, DollarSign } from 'lucide-react';

interface LineItem {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  tax: number;
  total: number;
}

interface Subscription {
  id: string;
  customerName: string;
  status: 'Draft' | 'Quotation' | 'Confirmed' | 'Active' | 'Closed' | 'Paused';
  cadence: string;
  items: LineItem[];
  grandTotal: number;
}

export default function Subscriptions() {
  const navigate = useNavigate();
  const userRole = localStorage.getItem('userRole') || 'admin';
  const userEmail = localStorage.getItem('userEmail') || 'user@brightloop.com';

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([
    {
      id: 'SUB-1001',
      customerName: 'Acme Corp',
      status: 'Quotation',
      cadence: 'Monthly',
      items: [
        { id: '1', productName: 'Brightloop Enterprise Core', quantity: 2, unitPrice: 1200, tax: 192, total: 2592 }
      ],
      grandTotal: 2592
    }
  ]);

  // Modal / New Quotation state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [cadence, setCadence] = useState('Monthly');
  
  // Dynamic line item table state
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: Date.now().toString(), productName: 'Enterprise License', quantity: 1, unitPrice: 1200, tax: 144, total: 1344 }
  ]);

  const handleAddItem = () => {
    setLineItems([
      ...lineItems,
      { id: Date.now().toString(), productName: 'Odoo Variant Add-on', quantity: 1, unitPrice: 560, tax: 67, total: 627 }
    ]);
  };

  const handleUpdateItem = (id: string, field: keyof LineItem, value: any) => {
    setLineItems(lineItems.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unitPrice') {
          const subtotal = updated.quantity * updated.unitPrice;
          updated.tax = subtotal * 0.12; // 12% sample tax
          updated.total = subtotal + updated.tax;
        }
        return updated;
      }
      return item;
    }));
  };

  const handleCreateQuotation = (e: React.FormEvent) => {
    e.preventDefault();
    const grandTotal = lineItems.reduce((acc, curr) => acc + curr.total, 0);
    const newSub: Subscription = {
      id: `SUB-${Math.floor(1000 + Math.random() * 9000)}`,
      customerName,
      status: 'Quotation',
      cadence,
      items: lineItems,
      grandTotal
    };

    setSubscriptions([...subscriptions, newSub]);
    setIsModalOpen(false);
    setCustomerName('');
    setLineItems([{ id: Date.now().toString(), productName: 'Enterprise License', quantity: 1, unitPrice: 1200, tax: 144, total: 1344 }]);
  };

  const handleStatusChange = (subId: string, newStatus: Subscription['status']) => {
    setSubscriptions(subscriptions.map(sub => sub.id === subId ? { ...sub, status: newStatus } : sub));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      {/* Top Header */}
      <div className="max-w-6xl mx-auto flex items-center justify-between mb-8 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/catalog')}
            className="p-2 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="w-6 h-6 text-indigo-400" />
              Quotations & Subscription Lifecycle
            </h1>
            <p className="text-slate-400 text-sm">Logged in as <span className="text-indigo-400 uppercase font-semibold">{userRole}</span> ({userEmail})</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/catalog')}
            className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
          >
            Manage Catalog
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>Create Quotation</span>
          </button>
        </div>
      </div>

      {/* Subscriptions List / State Machine View */}
      <div className="max-w-6xl mx-auto space-y-6">
        {subscriptions.map((sub) => (
          <div key={sub.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-indigo-400 bg-indigo-950 px-2.5 py-1 rounded-lg border border-indigo-800/50">
                    {sub.id}
                  </span>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg uppercase tracking-wider ${
                    sub.status === 'Active' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50' :
                    sub.status === 'Confirmed' ? 'bg-blue-950 text-blue-400 border border-blue-800/50' :
                    sub.status === 'Paused' ? 'bg-amber-950 text-amber-400 border border-amber-800/50' :
                    sub.status === 'Closed' ? 'bg-rose-950 text-rose-400 border border-rose-800/50' :
                    'bg-slate-800 text-slate-300'
                  }`}>
                    Status: {sub.status}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white mt-2">Customer: {sub.customerName}</h3>
                <p className="text-slate-400 text-xs">Cadence: {sub.cadence}</p>
              </div>

              <div className="text-right">
                <div className="text-xs text-slate-400">Grand Total (Incl. Tax)</div>
                <div className="text-xl font-bold text-emerald-400">${sub.grandTotal.toFixed(2)}</div>
              </div>
            </div>

            {/* Line Items Table Preview */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="p-2.5 rounded-l-lg">Product / Variant</th>
                    <th className="p-2.5">Qty</th>
                    <th className="p-2.5">Unit Price</th>
                    <th className="p-2.5">Tax</th>
                    <th className="p-2.5 rounded-r-lg text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {sub.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="p-2.5 font-medium text-white">{item.productName}</td>
                      <td className="p-2.5">{item.quantity}</td>
                      <td className="p-2.5">${item.unitPrice}</td>
                      <td className="p-2.5">${item.tax.toFixed(2)}</td>
                      <td className="p-2.5 text-right font-semibold text-emerald-400">${item.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Strict Lifecycle State Machine Action Bar */}
            <div className="mt-6 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-400">
                Lifecycle State Controls (Draft $\rightarrow$ Quotation $\rightarrow$ Confirmed $\rightarrow$ Active $\rightarrow$ Closed)[cite: 3]
              </div>
              <div className="flex flex-wrap gap-2">
                {sub.status === 'Quotation' && (
                  <button
                    onClick={() => handleStatusChange(sub.id, 'Confirmed')}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow"
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Confirm Quotation
                  </button>
                )}
                {sub.status === 'Confirmed' && (
                  <button
                    onClick={() => handleStatusChange(sub.id, 'Active')}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Activate Subscription
                  </button>
                )}
                {sub.status === 'Active' && (
                  <button
                    onClick={() => handleStatusChange(sub.id, 'Paused')}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow"
                  >
                    <PauseCircle className="w-3.5 h-3.5" /> Pause
                  </button>
                )}
                {sub.status === 'Paused' && (
                  <button
                    onClick={() => handleStatusChange(sub.id, 'Active')}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Resume
                  </button>
                )}
                {sub.status !== 'Closed' && (
                  <button
                    onClick={() => handleStatusChange(sub.id, 'Closed')}
                    className="px-3 py-1.5 bg-rose-600/80 hover:bg-rose-600 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Close
                  </button>
                )}
              </div>
            </div>

          </div>
        ))}
      </div>

      {/* Modal: Create Quotation / Subscription */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white mb-4">Create New Quotation / Subscription</h3>
            
            <form onSubmit={handleCreateQuotation} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Customer Name</label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Globex Corporation"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Cadence</label>
                  <select
                    value={cadence}
                    onChange={(e) => setCadence(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Daily">Daily</option>
                    <option value="Weekly">Weekly</option>
                    <option value="Monthly">Monthly</option>
                    <option value="Yearly">Yearly</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Line Item Table Builder */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">Itemized Line Items</span>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium"
                  >
                    + Add Item
                  </button>
                </div>

                <div className="space-y-2">
                  {lineItems.map((item) => (
                    <div key={item.id} className="grid grid-cols-12 gap-2 items-center bg-slate-900 p-2 rounded-lg border border-slate-800">
                      <div className="col-span-5">
                        <input
                          type="text"
                          value={item.productName}
                          onChange={(e) => handleUpdateItem(item.id, 'productName', e.target.value)}
                          placeholder="Product/Variant Name"
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleUpdateItem(item.id, 'quantity', Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white"
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => handleUpdateItem(item.id, 'unitPrice', Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white"
                        />
                      </div>
                      <div className="col-span-2 text-right text-xs font-semibold text-emerald-400">
                        ${item.total.toFixed(0)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium shadow-lg shadow-indigo-600/20"
                >
                  Save Quotation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
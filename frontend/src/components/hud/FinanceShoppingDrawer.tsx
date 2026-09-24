"use client";

import React, { useState, useEffect } from 'react';
import {
  FinancialTransaction, FinanceSummary, Subscription, ShoppingItem,
  getTransactions, createTransaction, deleteTransaction, getFinanceSummary,
  getSubscriptions, createSubscription, deleteSubscription,
  getShoppingItems, createShoppingItem, toggleShoppingItem, deleteShoppingItem
} from '@/lib/api';
import { DollarSign, CreditCard, ShoppingBag, Plus, Trash2, CheckSquare, Square, X, Calendar, PieChart, ShieldAlert } from 'lucide-react';

interface FinanceShoppingDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'expenses' | 'subscriptions' | 'shopping';
  refreshTrigger?: number;
}

export const FinanceShoppingDrawer: React.FC<FinanceShoppingDrawerProps> = ({ 
  isOpen, 
  onClose,
  initialTab = 'expenses',
  refreshTrigger 
}) => {
  const [activeTab, setActiveTab] = useState<'expenses' | 'subscriptions' | 'shopping'>(initialTab);
  const [error, setError] = useState<string | null>(null);
  
  // Data states
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(false);

  // New Transaction Form State
  const [txType, setTxType] = useState<'expense' | 'income'>('expense');
  const [txCategory, setTxCategory] = useState('General');
  const [txAmount, setTxAmount] = useState('');
  const [txMerchant, setTxMerchant] = useState('');
  const [txDate, setTxDate] = useState('');
  const [txNotes, setTxNotes] = useState('');

  // New Subscription Form State
  const [subName, setSubName] = useState('');
  const [subAmount, setSubAmount] = useState('');
  const [subDate, setSubDate] = useState('');
  const [subCycle, setSubCycle] = useState('monthly');

  // New Shopping Item Form State
  const [itemName, setItemName] = useState('');
  const [itemQty, setItemQty] = useState('1');
  const [itemCategory, setItemCategory] = useState('Grocery');
  const [itemWarranty, setItemWarranty] = useState('');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, refreshTrigger]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, refreshTrigger]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [txData, sumData, subData, shopData] = await Promise.all([
        getTransactions(),
        getFinanceSummary(),
        getSubscriptions(),
        getShoppingItems()
      ]);
      setTransactions(txData);
      setSummary(sumData);
      setSubscriptions(subData);
      setShoppingItems(shopData);
    } catch (err) {
      console.error("Failed to fetch finance/shopping data:", err);
      setError(err instanceof Error ? err.message : 'Operation failed.');
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txAmount || isNaN(parseFloat(txAmount))) return;
    try {
      const created = await createTransaction({
        type: txType,
        category: txCategory,
        amount: parseFloat(txAmount),
        merchant: txMerchant || undefined,
        transaction_date: txDate || undefined,
        notes: txNotes || undefined
      });
      setTransactions([created, ...transactions]);
      setTxAmount('');
      setTxMerchant('');
      setTxNotes('');
      // Refresh summary
      const sum = await getFinanceSummary();
      setSummary(sum);
    } catch (err) {
      console.error("Transaction error:", err);
      setError(err instanceof Error ? err.message : 'Operation failed.');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleDeleteTransaction = async (id: number) => {
    if (!window.confirm('Delete this transaction? This cannot be undone.')) return;
    try {
      await deleteTransaction(id);
      setTransactions(transactions.filter(t => t.id !== id));
      const sum = await getFinanceSummary();
      setSummary(sum);
    } catch (err) {
      console.error("Delete transaction error:", err);
      setError(err instanceof Error ? err.message : 'Operation failed.');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleCreateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subName.trim() || !subAmount || !subDate) return;
    try {
      const created = await createSubscription({
        service_name: subName,
        amount: parseFloat(subAmount),
        next_billing_date: subDate,
        billing_cycle: subCycle
      });
      setSubscriptions([...subscriptions, created]);
      setSubName('');
      setSubAmount('');
      setSubDate('');
    } catch (err) {
      console.error("Subscription error:", err);
      setError(err instanceof Error ? err.message : 'Operation failed.');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleDeleteSubscription = async (id: number) => {
    if (!window.confirm('Delete this subscription? This cannot be undone.')) return;
    try {
      await deleteSubscription(id);
      setSubscriptions(subscriptions.filter(s => s.id !== id));
    } catch (err) {
      console.error("Delete sub error:", err);
      setError(err instanceof Error ? err.message : 'Operation failed.');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleCreateShoppingItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) return;
    try {
      const created = await createShoppingItem({
        item_name: itemName,
        quantity: parseInt(itemQty) || 1,
        category: itemCategory,
        warranty_expiry: itemWarranty || undefined
      });
      setShoppingItems([created, ...shoppingItems]);
      setItemName('');
      setItemQty('1');
      setItemWarranty('');
    } catch (err) {
      console.error("Shopping item error:", err);
      setError(err instanceof Error ? err.message : 'Operation failed.');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleToggleShopping = async (id: number) => {
    try {
      const updated = await toggleShoppingItem(id);
      setShoppingItems(shoppingItems.map(i => i.id === id ? { ...i, purchased: updated.purchased } : i));
    } catch (err) {
      console.error("Toggle shopping error:", err);
      setError(err instanceof Error ? err.message : 'Operation failed.');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleDeleteShopping = async (id: number) => {
    if (!window.confirm('Delete this item? This cannot be undone.')) return;
    try {
      await deleteShoppingItem(id);
      setShoppingItems(shoppingItems.filter(i => i.id !== id));
    } catch (err) {
      console.error("Delete shopping error:", err);
      setError(err instanceof Error ? err.message : 'Operation failed.');
      setTimeout(() => setError(null), 5000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="relative z-10 w-full max-w-lg h-full bg-[#020c1b]/95 border-l border-cyan-500/40 p-6 flex flex-col justify-between shadow-[0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-xl animate-in slide-in-from-right duration-200 text-cyan-200">
        
        {/* Header */}
        <div>
          <div className="flex items-center justify-between border-b border-cyan-900/60 pb-4 mb-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-cyan-400 animate-pulse" />
              <span className="font-orbitron font-bold text-cyan-100 tracking-wider text-sm">
                FINANCE & SHOPPING MATRIX
              </span>
            </div>
            <button onClick={onClose} aria-label="Close" className="p-1 rounded-md text-cyan-400 hover:text-cyan-100 hover:bg-cyan-950/60 transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-2 mb-4 bg-cyan-950/40 p-1 rounded-lg border border-cyan-900/60">
            <button
              onClick={() => setActiveTab('expenses')}
              className={`flex-1 py-1.5 text-[11px] font-orbitron font-bold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'expenses' ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/50 shadow-[0_0_10px_rgba(6,182,212,0.2)]' : 'text-cyan-500 hover:text-cyan-300'
              }`}
            >
              <DollarSign size={14} />
              <span>EXPENSES</span>
            </button>
            <button
              onClick={() => setActiveTab('subscriptions')}
              className={`flex-1 py-1.5 text-[11px] font-orbitron font-bold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'subscriptions' ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/50 shadow-[0_0_10px_rgba(6,182,212,0.2)]' : 'text-cyan-500 hover:text-cyan-300'
              }`}
            >
              <CreditCard size={14} />
              <span>BILLS ({subscriptions.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('shopping')}
              className={`flex-1 py-1.5 text-[11px] font-orbitron font-bold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'shopping' ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/50 shadow-[0_0_10px_rgba(6,182,212,0.2)]' : 'text-cyan-500 hover:text-cyan-300'
              }`}
            >
              <ShoppingBag size={14} />
              <span>SHOPPING ({shoppingItems.length})</span>
            </button>
          </div>

          {error && (
            <div className="mx-5 mb-4 px-4 py-2.5 bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-mono rounded-lg flex items-center gap-2">
              <span className="text-red-400">⚠</span>
              <span>{error}</span>
            </div>
          )}

          {/* Expenses Tab */}
          {activeTab === 'expenses' && (
            <div className="space-y-4">
              {/* Finance Summary Widget */}
              {summary && (
                <div className="grid grid-cols-3 gap-2 p-3 bg-cyan-950/40 border border-cyan-800/50 rounded-lg text-center font-orbitron">
                  <div>
                    <div className="text-[9px] text-cyan-500 uppercase">INCOME</div>
                    <div className="text-xs font-bold text-emerald-400">₹{summary.total_income.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-cyan-500 uppercase">EXPENSES</div>
                    <div className="text-xs font-bold text-red-400">₹{summary.total_expense.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-cyan-500 uppercase">NET SAVINGS</div>
                    <div className={`text-xs font-bold ${summary.net_savings >= 0 ? 'text-cyan-300' : 'text-amber-400'}`}>
                      ₹{summary.net_savings.toFixed(2)}
                    </div>
                  </div>
                </div>
              )}

              {/* Add Transaction Form */}
              <form onSubmit={handleCreateTransaction} className="p-3 bg-cyan-950/30 border border-cyan-800/40 rounded-lg space-y-2">
                <div className="flex gap-2">
                  <select
                    value={txType}
                    onChange={(e: any) => setTxType(e.target.value)}
                    className="bg-[#03152c] border border-cyan-800/60 rounded px-2 py-1 text-xs text-cyan-300 focus:outline-none font-orbitron"
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                  <input
                    id="tx-amount-input"
                    name="tx_amount"
                    type="number"
                    step="0.01"
                    autoComplete="off"
                    required
                    placeholder="Amount (₹)..."
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    className="flex-1 bg-[#03152c] border border-cyan-800/60 rounded px-3 py-1.5 text-xs text-cyan-100 placeholder-cyan-600 focus:outline-none focus:border-cyan-400"
                  />
                  <select
                    value={txCategory}
                    onChange={(e) => setTxCategory(e.target.value)}
                    className="bg-[#03152c] border border-cyan-800/60 rounded px-2 py-1 text-xs text-cyan-300 focus:outline-none"
                  >
                    <option value="Food & Dining">Food & Dining</option>
                    <option value="Shopping">Shopping</option>
                    <option value="Housing & Bills">Housing & Bills</option>
                    <option value="Transportation">Transportation</option>
                    <option value="Entertainment">Entertainment</option>
                    <option value="General">General</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <input
                    id="tx-merchant-input"
                    name="tx_merchant"
                    type="text"
                    autoComplete="off"
                    placeholder="Merchant / Source..."
                    value={txMerchant}
                    onChange={(e) => setTxMerchant(e.target.value)}
                    className="flex-1 bg-[#03152c] border border-cyan-800/60 rounded px-3 py-1 text-xs text-cyan-100 placeholder-cyan-600 focus:outline-none"
                  />
                  <input
                    id="tx-date-input"
                    name="tx_date"
                    type="date"
                    autoComplete="off"
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="bg-[#03152c] border border-cyan-800/60 rounded px-2 py-1 text-xs text-cyan-300 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1 bg-cyan-600/30 hover:bg-cyan-500/40 border border-cyan-400/60 text-cyan-100 rounded text-xs font-orbitron font-bold flex items-center gap-1 transition-all"
                  >
                    <Plus size={14} /> LOG
                  </button>
                </div>
              </form>

              {/* Transactions List */}
              <div className="max-h-[45vh] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {transactions.length === 0 ? (
                  <div className="text-center py-8 text-cyan-600 text-xs font-orbitron">NO TRANSACTION HISTORY</div>
                ) : (
                  transactions.map((tx) => (
                    <div key={tx.id} className="p-3 rounded-lg bg-cyan-950/40 border border-cyan-800/50 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-xs text-cyan-100">{tx.merchant || tx.category}</div>
                        <div className="text-[10px] text-cyan-500 flex items-center gap-2">
                          <span>{tx.category}</span>
                          <span>•</span>
                          <span>{new Date(tx.transaction_date).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-orbitron font-bold ${tx.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {tx.type === 'income' ? '+' : '-'}₹{tx.amount.toFixed(2)}
                        </span>
                        <button onClick={() => handleDeleteTransaction(tx.id)} aria-label="Delete transaction" className="text-cyan-700 hover:text-red-400 transition-colors p-1">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Subscriptions Tab */}
          {activeTab === 'subscriptions' && (
            <div className="space-y-4">
              <form onSubmit={handleCreateSubscription} className="p-3 bg-cyan-950/30 border border-cyan-800/40 rounded-lg space-y-2">
                <input
                  id="sub-name-input"
                  name="sub_name"
                  type="text"
                  autoComplete="off"
                  required
                  placeholder="Service Name (e.g. Netflix, AWS, Gym)..."
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  className="w-full bg-[#03152c] border border-cyan-800/60 rounded px-3 py-1.5 text-xs text-cyan-100 placeholder-cyan-600 focus:outline-none"
                />
                <div className="flex gap-2">
                  <input
                    id="sub-amount-input"
                    name="sub_amount"
                    type="number"
                    step="0.01"
                    autoComplete="off"
                    required
                    placeholder="Amount (₹)..."
                    value={subAmount}
                    onChange={(e) => setSubAmount(e.target.value)}
                    className="flex-1 bg-[#03152c] border border-cyan-800/60 rounded px-3 py-1 text-xs text-cyan-100 placeholder-cyan-600 focus:outline-none"
                  />
                  <input
                    id="sub-date-input"
                    name="sub_date"
                    type="date"
                    autoComplete="off"
                    required
                    value={subDate}
                    onChange={(e) => setSubDate(e.target.value)}
                    className="bg-[#03152c] border border-cyan-800/60 rounded px-2 py-1 text-xs text-cyan-300 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1 bg-cyan-600/30 hover:bg-cyan-500/40 border border-cyan-400/60 text-cyan-100 rounded text-xs font-orbitron font-bold flex items-center gap-1 transition-all"
                  >
                    <Plus size={14} /> ADD
                  </button>
                </div>
              </form>

              {/* Subscriptions List */}
              <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {subscriptions.length === 0 ? (
                  <div className="text-center py-8 text-cyan-600 text-xs font-orbitron">NO ACTIVE SUBSCRIPTIONS DETECTED</div>
                ) : (
                  subscriptions.map((sub) => (
                    <div key={sub.id} className="p-3 rounded-lg bg-cyan-950/40 border border-cyan-800/50 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-xs text-cyan-100">{sub.service_name}</div>
                        <div className="text-[10px] text-cyan-500 flex items-center gap-2">
                          <Calendar size={10} /> Next bill: {new Date(sub.next_billing_date).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-orbitron font-bold text-cyan-200">
                          ₹{sub.amount.toFixed(2)}/{sub.billing_cycle}
                        </span>
                        <button onClick={() => handleDeleteSubscription(sub.id)} aria-label="Delete subscription" className="text-cyan-700 hover:text-red-400 transition-colors p-1">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Shopping Tab */}
          {activeTab === 'shopping' && (
            <div className="space-y-4">
              <form onSubmit={handleCreateShoppingItem} className="p-3 bg-cyan-950/30 border border-cyan-800/40 rounded-lg space-y-2">
                <input
                  id="shop-item-name"
                  name="item_name"
                  type="text"
                  autoComplete="off"
                  required
                  placeholder="Item name..."
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full bg-[#03152c] border border-cyan-800/60 rounded px-3 py-1.5 text-xs text-cyan-100 placeholder-cyan-600 focus:outline-none"
                />
                <div className="flex gap-2">
                  <input
                    id="shop-item-qty"
                    name="item_qty"
                    type="number"
                    autoComplete="off"
                    placeholder="Qty"
                    value={itemQty}
                    onChange={(e) => setItemQty(e.target.value)}
                    className="w-16 bg-[#03152c] border border-cyan-800/60 rounded px-2 py-1 text-xs text-cyan-300 focus:outline-none font-orbitron"
                  />
                  <input
                    id="shop-item-warranty"
                    name="item_warranty"
                    type="date"
                    autoComplete="off"
                    title="Warranty Expiry Date (Optional)"
                    value={itemWarranty}
                    onChange={(e) => setItemWarranty(e.target.value)}
                    className="flex-1 bg-[#03152c] border border-cyan-800/60 rounded px-2 py-1 text-xs text-cyan-300 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1 bg-cyan-600/30 hover:bg-cyan-500/40 border border-cyan-400/60 text-cyan-100 rounded text-xs font-orbitron font-bold flex items-center gap-1 transition-all"
                  >
                    <Plus size={14} /> ADD ITEM
                  </button>
                </div>
              </form>

              {/* Shopping List */}
              <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {shoppingItems.length === 0 ? (
                  <div className="text-center py-8 text-cyan-600 text-xs font-orbitron">SHOPPING LIST EMPTY</div>
                ) : (
                  shoppingItems.map((item) => (
                    <div
                      key={item.id}
                      className={`p-3 rounded-lg border flex items-center justify-between gap-3 transition-all ${
                        item.purchased ? 'bg-cyan-950/10 border-cyan-900/30 opacity-50' : 'bg-cyan-950/40 border-cyan-800/50 hover:border-cyan-500/50'
                      }`}
                    >
                      <button onClick={() => handleToggleShopping(item.id)} aria-label="Toggle shopping item" className="text-cyan-400 hover:text-cyan-200 transition-colors">
                        {item.purchased ? <CheckSquare size={16} className="text-cyan-400" /> : <Square size={16} />}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className={`text-xs font-semibold ${item.purchased ? 'line-through text-cyan-500' : 'text-cyan-100'}`}>
                          {item.item_name} (x{item.quantity})
                        </div>
                        {item.warranty_expiry && (
                          <div className="text-[10px] text-amber-400/80 flex items-center gap-1 mt-0.5">
                            <ShieldAlert size={10} />
                            Warranty till: {new Date(item.warranty_expiry).toLocaleDateString()}
                          </div>
                        )}
                      </div>

                      <button onClick={() => handleDeleteShopping(item.id)} aria-label="Delete shopping item" className="text-cyan-700 hover:text-red-400 transition-colors p-1">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-cyan-900/60 text-center text-[10px] font-orbitron text-cyan-600">
          ROCKY FINANCE & MONEY MANAGEMENT ENGINE v3.0
        </div>

      </div>
    </div>
  );
};

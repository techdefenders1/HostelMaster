import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { NavModule } from '../layout/Sidebar';
import {
  Users,
  Building2,
  IndianRupee,
  TrendingUp,
  Receipt,
  AlertTriangle,
  ArrowUpRight,
  TrendingDown,
  UserPlus,
  BedDouble,
  CreditCard,
  RefreshCw,
} from 'lucide-react';

interface DashboardStats {
  summary: {
    totalStudents: number;
    activeStudents: number;
    totalRooms: number;
    totalBeds: number;
    occupiedBeds: number;
    availableBeds: number;
    occupancyPercentage: number;
    currentMonthRent: number;
    currentMonthCollection: number;
    currentMonthPending: number;
    totalIncome: number;
    totalExpenses: number;
    totalPendingRent: number;
    netIncome: number;
  };
  recent: {
    payments: any[];
    students: any[];
    expenses: any[];
    pendingDues: any[];
    allocations: any[];
  };
  charts: {
    monthlyFinancials: { month: string; rentBilled: number; collection: number; expenses: number }[];
    admissionsTrend: { month: string; count: number }[];
    occupancy: { occupied: number; available: number };
  };
}

interface DashboardProps {
  onNavigate: (module: NavModule) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const stats = await api.get<DashboardStats>('/dashboard/stats');
      setData(stats);
    } catch (err: any) {
      setError('Failed to fetch dashboard statistics: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center space-y-3">
          <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
          <p className="text-slate-400 text-sm">Loading hostel records from database...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-2xl text-center">
        <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
        <p className="text-red-300 font-medium mb-3">{error || 'Data unavailable.'}</p>
        <button
          onClick={fetchDashboardData}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl border border-slate-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const { summary, recent, charts } = data;

  // Chart scaling calculations
  const maxFinancialVal = Math.max(
    100,
    ...charts.monthlyFinancials.map(m => Math.max(m.rentBilled, m.collection, m.expenses))
  );

  return (
    <div className="space-y-6">
      {/* Quick Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white">Hostel Overview</h2>
          <p className="text-xs text-slate-400">Real-time statistics computed directly from hostel database</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onNavigate('students')}
            className="flex items-center space-x-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-xl transition shadow-md shadow-indigo-600/20"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Student</span>
          </button>
          <button
            onClick={() => onNavigate('rooms')}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl border border-slate-700 transition"
          >
            <BedDouble className="w-3.5 h-3.5 text-indigo-400" />
            <span>Allocate Bed</span>
          </button>
          <button
            onClick={() => onNavigate('rent')}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl border border-slate-700 transition"
          >
            <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
            <span>Collect Rent</span>
          </button>
          <button
            onClick={fetchDashboardData}
            title="Refresh database records"
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl border border-slate-700 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Students */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">Total Students</span>
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white mb-1">{summary.totalStudents}</div>
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-emerald-400 font-medium">{summary.activeStudents} Active</span>
            <span className="text-slate-600">&bull;</span>
            <span className="text-slate-400">{summary.totalStudents - summary.activeStudents} Inactive / Vacated</span>
          </div>
        </div>

        {/* Card 2: Bed Occupancy */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">Bed Occupancy</span>
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white mb-1">
            {summary.occupancyPercentage}%
          </div>
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-indigo-400 font-medium">{summary.occupiedBeds} of {summary.totalBeds} Beds</span>
            <span className="text-slate-600">&bull;</span>
            <span className="text-emerald-400">{summary.availableBeds} Vacant</span>
          </div>
        </div>

        {/* Card 3: Monthly Collection */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">This Month Collection</span>
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white mb-1">
            ₹{summary.currentMonthCollection.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-slate-400">Billed: ₹{summary.currentMonthRent.toFixed(0)}</span>
            <span className="text-slate-600">&bull;</span>
            <span className={summary.currentMonthPending > 0 ? 'text-amber-400 font-medium' : 'text-slate-400'}>
              ₹{summary.currentMonthPending.toFixed(0)} Pending
            </span>
          </div>
        </div>

        {/* Card 4: Net Operating Income */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">Net Operating Income</span>
            <div className={`p-2 rounded-xl border ${summary.netIncome >= 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-2xl font-bold mb-1 ${summary.netIncome >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            ₹{summary.netIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-slate-400">Income: ₹{summary.totalIncome.toFixed(0)}</span>
            <span className="text-slate-600">&bull;</span>
            <span className="text-slate-400">Expenses: ₹{summary.totalExpenses.toFixed(0)}</span>
          </div>
        </div>
      </div>

      {/* Visual Analytics / Charts Section (Real Database Data) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Financial Flow Chart */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white">Monthly Rent vs Expenses</h3>
              <p className="text-xs text-slate-400">6-Month historical performance based on ledger records</p>
            </div>
            <div className="flex items-center space-x-3 text-xs">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                Collection
              </span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
                Invoiced
              </span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                Expenses
              </span>
            </div>
          </div>

          <div className="h-56 flex items-end justify-between gap-3 pt-6 pb-2 px-2 border-b border-slate-800">
            {charts.monthlyFinancials.map((m, idx) => {
              const colHeight = Math.max(4, Math.round((m.collection / maxFinancialVal) * 160));
              const billHeight = Math.max(4, Math.round((m.rentBilled / maxFinancialVal) * 160));
              const expHeight = Math.max(4, Math.round((m.expenses / maxFinancialVal) * 160));

              return (
                <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group">
                  <div className="w-full flex items-end justify-center gap-1 h-44">
                    {/* Billed bar */}
                    <div
                      style={{ height: `${billHeight}px` }}
                      className="w-3 bg-indigo-600/70 hover:bg-indigo-500 rounded-t-sm transition-all"
                      title={`Billed: $${m.rentBilled}`}
                    />
                    {/* Collection bar */}
                    <div
                      style={{ height: `${colHeight}px` }}
                      className="w-3 bg-emerald-500 hover:bg-emerald-400 rounded-t-sm transition-all"
                      title={`Collection: $${m.collection}`}
                    />
                    {/* Expense bar */}
                    <div
                      style={{ height: `${expHeight}px` }}
                      className="w-3 bg-rose-500/80 hover:bg-rose-400 rounded-t-sm transition-all"
                      title={`Expenses: $${m.expenses}`}
                    />
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 mt-2 truncate w-full text-center">
                    {m.month.slice(5)}/{m.month.slice(2, 4)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-3 text-xs text-slate-400">
            <span>Historical Rent Receivables Total: ${summary.totalPendingRent.toFixed(2)}</span>
            <button
              onClick={() => onNavigate('reports')}
              className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
            >
              Detailed Reports <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Occupancy Donut / Breakdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white mb-1">Hostel Bed Status</h3>
            <p className="text-xs text-slate-400 mb-4">Capacity distribution across {summary.totalRooms} rooms</p>

            <div className="relative flex items-center justify-center py-4">
              <div className="w-36 h-36 rounded-full border-8 border-slate-800 flex items-center justify-center relative overflow-hidden">
                <div
                  className="absolute inset-0 rounded-full border-8 border-indigo-500 transition-all"
                  style={{
                    clipPath: `polygon(50% 50%, 50% 0%, ${summary.occupancyPercentage >= 25 ? '100% 0%' : `${50 + summary.occupancyPercentage * 2}% 0%`}, ${summary.occupancyPercentage >= 50 ? '100% 100%' : '100% 50%'}, ${summary.occupancyPercentage >= 75 ? '0% 100%' : '50% 100%'}, ${summary.occupancyPercentage >= 100 ? '0% 0%' : '0% 50%'})`,
                  }}
                />
                <div className="text-center z-10">
                  <span className="text-2xl font-bold text-white">{summary.occupancyPercentage}%</span>
                  <span className="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Occupied</span>
                </div>
              </div>
            </div>

            <div className="space-y-2.5 pt-2">
              <div className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-800/50">
                <span className="text-slate-300 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                  Occupied Beds
                </span>
                <span className="font-semibold text-white font-mono">{summary.occupiedBeds} Beds</span>
              </div>
              <div className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-800/50">
                <span className="text-slate-300 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Vacant Available Beds
                </span>
                <span className="font-semibold text-emerald-400 font-mono">{summary.availableBeds} Beds</span>
              </div>
              <div className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-800/50">
                <span className="text-slate-300 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-600" />
                  Total Registered Capacity
                </span>
                <span className="font-semibold text-slate-300 font-mono">{summary.totalBeds} Beds</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigate('rooms')}
            className="w-full mt-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl border border-slate-700 transition text-center"
          >
            Manage Rooms & Bed Allocations
          </button>
        </div>
      </div>

      {/* Recent Activity Feeds */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Payments */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white">Recent Rent Payments</h3>
              <p className="text-xs text-slate-400">Latest receipts recorded in system</p>
            </div>
            <button
              onClick={() => onNavigate('rent')}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
            >
              View All
            </button>
          </div>

          {recent.payments.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              No payment transactions recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {recent.payments.map((p, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                      <Receipt className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">{p.student_name}</p>
                      <p className="text-[11px] text-slate-400 font-mono">
                        {p.receipt_number} &bull; {p.payment_mode}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-emerald-400 font-mono">
                      +₹{p.amount.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-slate-500">{p.payment_date}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Dues Alert */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Pending Rent Dues
              </h3>
              <p className="text-xs text-slate-400">Immediate outstanding balances</p>
            </div>
            <button
              onClick={() => onNavigate('dues')}
              className="text-xs text-amber-400 hover:text-amber-300 font-medium"
            >
              All Dues
            </button>
          </div>

          {recent.pendingDues.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              No outstanding rent dues pending!
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {recent.pendingDues.map((d, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-white">{d.student_name}</p>
                    <p className="text-[11px] text-slate-400">
                      Period: {d.billing_period} &bull; Due: {d.due_date}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-amber-400 font-mono">
                      ₹{d.pending_amount.toFixed(2)}
                    </p>
                    <button
                      onClick={() => onNavigate('rent')}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 underline"
                    >
                      Collect &bull; Receipt
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

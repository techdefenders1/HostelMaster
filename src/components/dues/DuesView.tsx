import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { StudentDue } from '../../types';
import {
  IndianRupee,
  AlertTriangle,
  Search,
  ArrowUpDown,
  Phone,
  BedDouble,
  CreditCard,
  Printer,
  Download,
  CheckCircle2,
  Calendar
} from 'lucide-react';

export const DuesView: React.FC = () => {
  const [dues, setDues] = useState<StudentDue[]>([]);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [minDue, setMinDue] = useState('');
  const [sortBy, setSortBy] = useState('outstanding');
  const [order, setOrder] = useState('DESC');

  const fetchDues = async () => {
    setIsLoading(true);
    try {
      const q = new URLSearchParams({
        search,
        min_due: minDue,
        sort: sortBy,
        order,
      });
      const res = await api.get<{ dues: StudentDue[]; totalOutstanding: number }>(`/dues?${q.toString()}`);
      setDues(res.dues);
      setTotalOutstanding(res.totalOutstanding);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDues();
  }, [search, minDue, sortBy, order]);

  const handleExportCsv = () => {
    const headers = ['Student Name', 'Admission #', 'Room #', 'Mobile', 'Total Invoiced', 'Total Paid', 'Outstanding Balance', 'Oldest Due Date', 'Days Overdue'];
    const rows = dues.map(d => [
      `"${d.full_name}"`,
      `"${d.admission_number}"`,
      `"${d.room_number || 'N/A'}"`,
      `"${d.mobile}"`,
      d.total_billed.toFixed(2),
      d.total_paid.toFixed(2),
      d.outstanding.toFixed(2),
      `"${d.oldest_due_date || 'N/A'}"`,
      d.daysOverdue,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `hostel-student-dues-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <IndianRupee className="w-5 h-5 text-amber-400" />
            Student Dues Tracker
          </h2>
          <p className="text-xs text-slate-400">
            Real-time aging analysis and overdue rent receivables
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportCsv}
            disabled={dues.length === 0}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-medium rounded-xl border border-slate-700 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl border border-slate-700 transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print List</span>
          </button>
        </div>
      </div>

      {/* KPI Highlight Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 block font-medium">Total Unpaid Dues</span>
            <span className="text-2xl font-bold text-amber-400 font-mono">
              ₹{totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 block font-medium">Students with Dues</span>
            <span className="text-2xl font-bold text-white font-mono">
              {dues.length} Students
            </span>
          </div>
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
            <BedDouble className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 block font-medium">Overdue &gt; 30 Days</span>
            <span className="text-2xl font-bold text-red-400 font-mono">
              {dues.filter(d => d.daysOverdue >= 30).length} Critical
            </span>
          </div>
          <div className="p-3 bg-red-500/10 text-red-400 rounded-xl border border-red-500/20">
            <Calendar className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-wrap gap-3 items-center justify-between shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by student, admission #, room..."
            className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-1.5 text-xs text-slate-400">
            <span>Sort By:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-xs text-white rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="outstanding">Outstanding Balance</option>
              <option value="days_overdue">Days Overdue</option>
              <option value="name">Student Name</option>
            </select>
          </div>

          <button
            onClick={() => setOrder(order === 'ASC' ? 'DESC' : 'ASC')}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 text-xs flex items-center gap-1"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>{order === 'ASC' ? 'Ascending' : 'Descending'}</span>
          </button>
        </div>
      </div>

      {/* Dues List Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/60 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">Admission #</th>
                <th className="py-3 px-4">Room & Bed</th>
                <th className="py-3 px-4">Phone</th>
                <th className="py-3 px-4">Total Invoiced</th>
                <th className="py-3 px-4">Total Paid</th>
                <th className="py-3 px-4">Outstanding Balance</th>
                <th className="py-3 px-4">Oldest Due Date</th>
                <th className="py-3 px-4">Days Overdue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    Calculating dues...
                  </td>
                </tr>
              ) : dues.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
                    All students are fully settled up! No outstanding dues.
                  </td>
                </tr>
              ) : (
                dues.map((d) => (
                  <tr key={d.student_id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3.5 px-4 font-bold text-white">{d.full_name}</td>
                    <td className="py-3.5 px-4 font-mono text-indigo-300 font-medium">
                      {d.admission_number}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-300">
                      {d.room_number ? `Room ${d.room_number}` : 'Vacated / None'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-500" />
                        {d.mobile}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-400">
                      ₹{d.total_billed.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-emerald-400">
                      ₹{d.total_paid.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-base text-amber-400">
                      ₹{d.outstanding.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 font-mono">
                      {d.oldest_due_date || '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          d.daysOverdue >= 30
                            ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                            : d.daysOverdue >= 10
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {d.daysOverdue > 0 ? `${d.daysOverdue} Days` : 'Due Today'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

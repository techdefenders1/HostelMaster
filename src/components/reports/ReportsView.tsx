import React, { useState, useEffect } from 'react';
import { api, ApiError } from '../../api/client';
import { Student } from '../../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  BarChart3,
  Calendar,
  Filter,
  Download,
  Printer,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Users,
  Building2,
  DollarSign,
  TrendingDown,
  FileText
} from 'lucide-react';

interface ReportMeta {
  id: string;
  key: string;
  name: string;
  category: string;
  description: string;
}

export const ReportsView: React.FC = () => {
  const [reportsList, setReportsList] = useState<ReportMeta[]>([]);
  const [selectedReportKey, setSelectedReportKey] = useState<string>('student_report');
  const [selectedReportMeta, setSelectedReportMeta] = useState<ReportMeta | null>(null);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [month, setMonth] = useState('');
  const [studentId, setStudentId] = useState('');
  const [category, setCategory] = useState('all');
  const [paymentMode, setPaymentMode] = useState('all');

  // Students list for student statement filter
  const [students, setStudents] = useState<Student[]>([]);

  // Report execution result
  const [reportResult, setReportResult] = useState<{
    reportKey: string;
    columns: { header: string; key: string }[];
    rows: any[];
    summary: Record<string, any>;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load report list
  useEffect(() => {
    const fetchList = async () => {
      try {
        const res = await api.get<{ reports: ReportMeta[] }>('/reports/list');
        setReportsList(res.reports);
        if (res.reports.length > 0) {
          setSelectedReportMeta(res.reports[0]);
        }
      } catch (err) {
        console.error(err);
      }
    };

    const fetchStudentsList = async () => {
      try {
        const res = await api.get<{ students: Student[] }>('/students?limit=200');
        setStudents(res.students);
        if (res.students.length > 0) {
          setStudentId(res.students[0].id);
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchList();
    fetchStudentsList();
  }, []);

  const runReport = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        month,
        student_id: studentId,
        category,
        payment_mode: paymentMode,
      });

      const res = await api.get(`/reports/run/${selectedReportKey}?${q.toString()}`);
      setReportResult(res);
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Failed to execute report.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const found = reportsList.find(r => r.key === selectedReportKey);
    setSelectedReportMeta(found || null);
    runReport();
  }, [selectedReportKey, studentId, month, category, paymentMode]);

  const handleExportCsv = () => {
    if (!reportResult || reportResult.rows.length === 0) return;

    const headers = reportResult.columns.map(c => `"${c.header}"`).join(',');
    const rows = reportResult.rows.map(row => {
      return reportResult.columns
        .map(col => {
          const val = row[col.key] !== undefined && row[col.key] !== null ? String(row[col.key]) : '';
          return `"${val.replace(/"/g, '""')}"`;
        })
        .join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${selectedReportKey}-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPdf = () => {
    if (!reportResult || reportResult.rows.length === 0) return;

    const doc = new jsPDF('landscape');
    const title = selectedReportMeta?.name || 'Hostel Report';

    // Header bar
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 297, 24, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`HostelMaster - ${title}`, 14, 15);
    doc.setFontSize(8);
    doc.text(`Generated on ${new Date().toLocaleString()}`, 230, 15);

    const headers = reportResult.columns.map(c => c.header);
    const body = reportResult.rows.map(row =>
      reportResult.columns.map(c => (row[c.key] !== undefined && row[c.key] !== null ? String(row[c.key]) : '—'))
    );

    autoTable(doc, {
      startY: 30,
      head: [headers],
      body: body,
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] },
      styles: { fontSize: 8, cellPadding: 3 },
    });

    doc.save(`${selectedReportKey}-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
            Hostel Intelligence & Reports
          </h2>
          <p className="text-xs text-slate-400">
            Generate 18 comprehensive reports with real database auditing & analytics
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportCsv}
            disabled={!reportResult || reportResult.rows.length === 0}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-medium rounded-xl border border-slate-700 transition"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handleExportPdf}
            disabled={!reportResult || reportResult.rows.length === 0}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-medium rounded-xl border border-slate-700 transition"
          >
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            <span>Export PDF</span>
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl border border-slate-700 transition"
          >
            <Printer className="w-3.5 h-3.5 text-slate-400" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Report Selector & Filters Grid */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Select Report (18 Types Available)
            </label>
            <select
              value={selectedReportKey}
              onChange={(e) => setSelectedReportKey(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500 font-medium"
            >
              {reportsList.map((r) => (
                <option key={r.key} value={r.key}>
                  [{r.category}] {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Conditional filter: Student Statement */}
          {selectedReportKey === 'student_statement' && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Select Student for Statement
              </label>
              <select
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500"
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name} ({s.admission_number})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Conditional filter: Month */}
          {['rent_report', 'monthly_financial_report'].includes(selectedReportKey) && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Billing Month (Optional)
              </label>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          {/* Date range filters for date-based reports */}
          {['payment_report', 'expense_report', 'admission_report'].includes(selectedReportKey) && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">From Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">To Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </>
          )}

          <div className="flex items-end">
            <button
              onClick={runReport}
              disabled={isLoading}
              className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Querying Database...' : 'Run Query'}</span>
            </button>
          </div>
        </div>

        {selectedReportMeta && (
          <div className="pt-2 text-xs text-slate-400 border-t border-slate-800/80 flex items-center justify-between">
            <span>{selectedReportMeta.description}</span>
            <span className="font-mono text-indigo-400 uppercase text-[10px] bg-slate-800 px-2 py-0.5 rounded">
              Report Code: {selectedReportMeta.key}
            </span>
          </div>
        )}
      </div>

      {/* Summary KPI Badges for current report */}
      {reportResult && reportResult.summary && Object.keys(reportResult.summary).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(reportResult.summary).map(([k, v]) => (
            <div key={k} className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider truncate">
                {k.replace(/([A-Z])/g, ' $1')}
              </span>
              <span className="text-base font-bold text-white font-mono mt-0.5 block truncate">
                {typeof v === 'number' ? (k.toLowerCase().includes('total') || k.toLowerCase().includes('balance') || k.toLowerCase().includes('income') || k.toLowerCase().includes('profit') ? `₹${v.toFixed(2)}` : v) : v}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Report Results Table */}
      <div id="printable-report" className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/60 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                {reportResult?.columns.map((col) => (
                  <th key={col.key} className="py-3 px-4">
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {isLoading ? (
                <tr>
                  <td colSpan={reportResult?.columns.length || 5} className="py-8 text-center text-slate-400">
                    Executing report query on database...
                  </td>
                </tr>
              ) : !reportResult || reportResult.rows.length === 0 ? (
                <tr>
                  <td colSpan={reportResult?.columns.length || 5} className="py-8 text-center text-slate-500">
                    No records found matching the report criteria.
                  </td>
                </tr>
              ) : (
                reportResult.rows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-800/30 transition">
                    {reportResult.columns.map((col) => {
                      const val = row[col.key];
                      const isMoney = typeof val === 'number' && (col.key.includes('amount') || col.key.includes('rent') || col.key.includes('income') || col.key.includes('expenses') || col.key.includes('total') || col.key.includes('debit') || col.key.includes('credit'));
                      return (
                        <td key={col.key} className="py-3 px-4 font-mono text-slate-300">
                          {isMoney ? `₹${val.toFixed(2)}` : val !== null && val !== undefined ? String(val) : '—'}
                        </td>
                      );
                    })}
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

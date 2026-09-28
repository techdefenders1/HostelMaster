import React, { useState, useEffect } from 'react';
import { api, ApiError } from '../../api/client';
import { RentRecord, Payment, Receipt, Student } from '../../types';
import { printReceipt, printReceiptContainer, openReceiptInNewTab } from '../../utils/printReceipt';
import { useBranding } from '../../context/BrandingContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Receipt as ReceiptIcon,
  CreditCard,
  IndianRupee,
  Plus,
  Search,
  Filter,
  CheckCircle,
  AlertCircle,
  Clock,
  Printer,
  Download,
  X,
  FileText,
  Calendar,
  Layers,
  Building,
  UserCheck,
  ExternalLink
} from 'lucide-react';

export const RentView: React.FC = () => {
  const { currency, logo, settings } = useBranding();
  const [activeTab, setActiveTab] = useState<'rent' | 'payments'>('rent');
  const [records, setRecords] = useState<RentRecord[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [summary, setSummary] = useState({ totalBilled: 0, totalPaid: 0, totalPending: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters
  const [monthFilter, setMonthFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [paymentModeFilter, setPaymentModeFilter] = useState('all');

  // Modals
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);

  // Generate form
  const curMonthStr = new Date().toISOString().slice(0, 7);
  const [generateForm, setGenerateForm] = useState({
    mode: 'batch', // 'batch' or 'single'
    student_id: '',
    billing_month: curMonthStr,
    due_date: `${curMonthStr}-10`,
    discount: '0',
    late_fee: '0',
    other_charges: '0',
    notes: '',
  });

  // Payment form
  const [paymentForm, setPaymentForm] = useState({
    student_id: '',
    rent_id: '',
    amount: '',
    payment_mode: 'Cash',
    payment_date: new Date().toISOString().split('T')[0],
    transaction_ref: '',
    notes: '',
  });

  const [formSubmitting, setFormSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchRentRecords = async () => {
    setIsLoading(true);
    try {
      const q = new URLSearchParams({
        status: statusFilter,
        month: monthFilter,
        search,
        limit: '50',
      });
      const res = await api.get<{ records: RentRecord[]; summary: any }>(`/rent?${q.toString()}`);
      setRecords(res.records);
      setSummary(res.summary);
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Failed to load rent invoices.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPayments = async () => {
    setIsLoading(true);
    try {
      const q = new URLSearchParams({
        payment_mode: paymentModeFilter,
        search,
        limit: '50',
      });
      const res = await api.get<{ payments: Payment[]; totalCollected: number }>(`/payments?${q.toString()}`);
      setPayments(res.payments);
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Failed to load payment history.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const res = await api.get<{ students: Student[] }>('/students?status=active&limit=100');
      setStudents(res.students);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  useEffect(() => {
    if (activeTab === 'rent') {
      fetchRentRecords();
    } else {
      fetchPayments();
    }
  }, [activeTab, statusFilter, monthFilter, paymentModeFilter]);

  const handleOpenGenerate = () => {
    setGenerateForm({
      mode: 'batch',
      student_id: '',
      billing_month: curMonthStr,
      due_date: `${curMonthStr}-10`,
      discount: '0',
      late_fee: '0',
      other_charges: '0',
      notes: '',
    });
    setModalError(null);
    setIsGenerateOpen(true);
  };

  const handleGenerateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setModalError(null);

    try {
      const res = await api.post('/rent/generate', generateForm);
      setSuccess(res.message);
      setIsGenerateOpen(false);
      fetchRentRecords();
    } catch (err: any) {
      setModalError(err instanceof ApiError ? err.message : 'Rent generation failed.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleOpenPayment = (targetRent?: RentRecord) => {
    setPaymentForm({
      student_id: targetRent ? targetRent.student_id : (students.length > 0 ? students[0].id : ''),
      rent_id: targetRent ? targetRent.id : '',
      amount: targetRent ? targetRent.pending_amount.toString() : '',
      payment_mode: 'Cash',
      payment_date: new Date().toISOString().split('T')[0],
      transaction_ref: '',
      notes: '',
    });
    setModalError(null);
    setIsPaymentOpen(true);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setModalError(null);

    try {
      const res = await api.post('/payments', paymentForm);
      setSuccess(res.message);
      setIsPaymentOpen(false);
      fetchRentRecords();
      fetchPayments();

      if (res.receipt) {
        setSelectedReceipt(res.receipt);
        setIsReceiptOpen(true);
      }
    } catch (err: any) {
      setModalError(err instanceof ApiError ? err.message : 'Payment recording failed.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleViewReceipt = async (receiptNumber: string) => {
    try {
      const res = await api.get<{ receipt: Receipt }>(`/payments/receipt/${receiptNumber}`);
      setSelectedReceipt(res.receipt);
      setIsReceiptOpen(true);
    } catch (err) {
      setError('Could not retrieve receipt data.');
    }
  };

  const handlePrintReceipt = () => {
    printReceiptContainer('printable-receipt');
  };

  const handlePrintInNewTab = () => {
    if (!selectedReceipt) return;
    openReceiptInNewTab({
      ...selectedReceipt,
      logoData: selectedReceipt.logoData || logo || undefined,
      signatureData: selectedReceipt.signatureData || settings?.signature_data || undefined,
      currency: selectedReceipt.currency || currency || '₹',
    });
  };

  const handleDownloadPdfReceipt = (receipt: Receipt) => {
    const doc = new jsPDF();

    // Header background banner
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 210, 36, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(receipt.hostelName || 'HOSTEL MANAGEMENT SYSTEM', 14, 18);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(receipt.hostelAddress || 'Campus Hostel Residence', 14, 25);
    doc.text(`Phone: ${receipt.phone || '—'}  |  Email: ${receipt.email || '—'}`, 14, 30);

    // Optional Logo in header top right
    if (receipt.logoData || logo) {
      try {
        doc.addImage((receipt.logoData || logo) as string, 'PNG', 170, 5, 26, 26);
      } catch {
        // Continue if image format is not compatible
      }
    }

    // Title & Receipt #
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('OFFICIAL PAYMENT RECEIPT', 14, 48);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Receipt #: ${receipt.receiptNumber}`, 140, 48);
    doc.setFont('helvetica', 'normal');
    doc.text(`Payment Date: ${receipt.paymentDate}`, 140, 54);

    // Student & Room Details
    const isRoomAssigned = receipt.roomNumber && receipt.roomNumber !== 'N/A' && !receipt.roomNumber.includes('आवंटित नहीं');
    const roomText = isRoomAssigned
      ? `Room: ${receipt.roomNumber} (Bed: ${receipt.bedNumber || '—'})${receipt.floor ? ` - ${receipt.floor}` : ''}`
      : 'Unassigned / Direct Payment';
    const fatherInfo = receipt.fatherName ? `\nFather: ${receipt.fatherName}` : '';
    const mobileInfo = receipt.studentMobile ? `\nMobile: ${receipt.studentMobile}` : '';
    const courseInfo = [receipt.course, receipt.college].filter(Boolean).join(' - ');

    autoTable(doc, {
      startY: 60,
      head: [['Student Details', 'Accommodation Details']],
      body: [
        [
          `Name: ${receipt.studentName}${fatherInfo}\nAdmission #: ${receipt.admissionNumber}${mobileInfo}${courseInfo ? `\nCourse: ${courseInfo}` : ''}`,
          `${roomText}\nBilling Period: ${receipt.billingPeriod}`,
        ],
      ],
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
      styles: { fontSize: 10, cellPadding: 4 },
    });

    const txnDisplay = receipt.transactionRef && receipt.transactionRef !== 'N/A'
      ? receipt.transactionRef
      : (receipt.paymentMode === 'Cash' ? 'Cash Payment' : '—');

    // Payment Particulars
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 8,
      head: [['Description', 'Payment Mode', 'Transaction Reference', 'Amount Paid']],
      body: [
        [
          `Hostel Rent & Accommodation (${receipt.billingPeriod})`,
          receipt.paymentMode,
          txnDisplay,
          `Rs. ${receipt.amount.toFixed(2)}`,
        ],
      ],
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42] },
      columnStyles: {
        3: { halign: 'right', fontStyle: 'bold' },
      },
    });

    // Ledger Summary Box
    const finalY = (doc as any).lastAutoTable.finalY + 8;
    if (receipt.amountInWords) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.text(`Amount in Words: ${receipt.amountInWords}`, 14, finalY);
    }
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Bill Remaining Balance: Rs. ${receipt.billRemainingBalance.toFixed(2)}`, 130, finalY);
    doc.setFont('helvetica', 'bold');
    doc.text(`Overall Outstanding Dues: Rs. ${receipt.overallRemainingDues.toFixed(2)}`, 130, finalY + 6);

    // Signature Area
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Authorized Signature:', 14, finalY + 20);

    const sigData = receipt.signatureData || settings?.signature_data;
    if (sigData) {
      try {
        doc.addImage(sigData, 'PNG', 14, finalY + 22, 36, 14);
      } catch {
        // Fallback to signature line
      }
    }

    doc.line(14, finalY + 38, 70, finalY + 38);
    doc.text(receipt.authorizedSignature || settings?.authorized_signature || 'Hostel Administrator', 14, finalY + 43);

    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text('This is a system-generated official receipt from HostelMaster.', 14, 280);

    doc.save(`Receipt-${receipt.receiptNumber}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ReceiptIcon className="w-5 h-5 text-indigo-400" />
            Rent Billing & Payments
          </h2>
          <p className="text-xs text-slate-400">
            Generate invoices, process collections & issue verifiable receipts
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <div className="bg-slate-900 p-1 rounded-xl border border-slate-800 flex space-x-1">
            <button
              onClick={() => setActiveTab('rent')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTab === 'rent'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Invoices ({records.length})
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTab === 'payments'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Payment Receipts ({payments.length})
            </button>
          </div>

          <button
            onClick={() => handleOpenPayment()}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-600/20 transition cursor-pointer"
          >
            <IndianRupee className="w-4 h-4" />
            <span>Record Payment</span>
          </button>

          <button
            onClick={handleOpenGenerate}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Generate Invoices</span>
          </button>
        </div>
      </div>

      {/* Financial Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 block font-medium">Total Billed</span>
            <span className="text-xl font-bold text-white font-mono">
              ₹{summary.totalBilled.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 block font-medium">Total Collected</span>
            <span className="text-xl font-bold text-emerald-400 font-mono">
              ₹{summary.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 block font-medium">Pending Receivables</span>
            <span className="text-xl font-bold text-amber-400 font-mono">
              ₹{summary.totalPending.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {success && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {activeTab === 'rent' ? (
        /* RENT INVOICES TABLE */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm space-y-4">
          <div className="p-4 border-b border-slate-800 flex flex-wrap gap-3 items-center justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-2 text-xs text-slate-400">
                <Calendar className="w-3.5 h-3.5" />
                <span>Month:</span>
                <input
                  type="month"
                  value={monthFilter}
                  onChange={(e) => setMonthFilter(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-xs text-white rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-indigo-500"
                />
                {monthFilter && (
                  <button onClick={() => setMonthFilter('')} className="text-slate-500 hover:text-white text-xs">
                    Clear
                  </button>
                )}
              </div>

              <div className="flex items-center space-x-2 text-xs text-slate-400">
                <Filter className="w-3.5 h-3.5" />
                <span>Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-xs text-white rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Invoices</option>
                  <option value="pending">Pending</option>
                  <option value="partially_paid">Partially Paid</option>
                  <option value="paid">Fully Paid</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>
            </div>

            <span className="text-xs text-slate-400">
              Showing <span className="font-semibold text-white">{records.length}</span> invoices
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800/60 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Room & Bed</th>
                  <th className="py-3 px-4">Billing Period</th>
                  <th className="py-3 px-4">Base Rent</th>
                  <th className="py-3 px-4">Total Amount</th>
                  <th className="py-3 px-4">Paid</th>
                  <th className="py-3 px-4">Pending</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {isLoading ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      Loading invoices...
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-500">
                      No invoices found. Click "Generate Invoices" to create rent bills.
                    </td>
                  </tr>
                ) : (
                  records.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3.5 px-4 font-semibold text-white">
                        {rec.student_name}
                        <span className="text-[10px] text-slate-400 block font-mono">
                          {rec.admission_number}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-indigo-300">
                        Room {rec.room_number} &bull; {rec.bed_number}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-300 font-medium">
                        {rec.billing_period}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-400">
                        ₹{rec.rent_amount.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-white">
                        ₹{rec.total_amount.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-emerald-400">
                        ₹{rec.paid_amount.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-amber-400">
                        ₹{rec.pending_amount.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">{rec.due_date}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                            rec.status === 'paid'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : rec.status === 'partially_paid'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {rec.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {rec.pending_amount > 0 ? (
                          <button
                            onClick={() => handleOpenPayment(rec)}
                            className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-[11px] font-medium rounded-lg border border-emerald-500/30 transition"
                          >
                            Pay
                          </button>
                        ) : (
                          <span className="text-emerald-400 text-[11px] font-medium flex items-center justify-end gap-1">
                            <CheckCircle className="w-3.5 h-3.5" /> Paid
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* PAYMENTS LIST TABLE */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm space-y-4">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs text-slate-400">
              <Filter className="w-3.5 h-3.5" />
              <span>Payment Mode:</span>
              <select
                value={paymentModeFilter}
                onChange={(e) => setPaymentModeFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-xs text-white rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Modes</option>
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Card">Card</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <span className="text-xs text-slate-400">
              Total Receipts: <span className="font-semibold text-white">{payments.length}</span>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800/60 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Receipt #</th>
                  <th className="py-3 px-4">Payment Date</th>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Room & Bed</th>
                  <th className="py-3 px-4">Period</th>
                  <th className="py-3 px-4">Payment Mode</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      Loading payments...
                    </td>
                  </tr>
                ) : payments.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-500">
                      No payments recorded yet. Click "Record Payment" to process student rent.
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-indigo-300">
                        {p.receipt_number}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">{p.payment_date}</td>
                      <td className="py-3.5 px-4 font-semibold text-white">
                        {p.student_name}
                        <span className="text-[10px] text-slate-400 block font-mono">
                          {p.admission_number}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-400">
                        {p.room_number ? `Room ${p.room_number}` : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">{p.billing_period || 'General'}</td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-medium border border-slate-700">
                          {p.payment_mode}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                        +₹{p.amount.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                        {p.transaction_ref || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleViewReceipt(p.receipt_number)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 text-[11px] font-medium rounded-lg border border-slate-700 flex items-center gap-1 transition ml-auto"
                        >
                          <Printer className="w-3 h-3" />
                          <span>Receipt</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Generate Rent Invoices Modal */}
      {isGenerateOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ReceiptIcon className="w-5 h-5 text-indigo-400" />
                Generate Monthly Rent Invoices
              </h3>
              <button onClick={() => setIsGenerateOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-xs text-red-300 rounded-xl">
                {modalError}
              </div>
            )}

            <form onSubmit={handleGenerateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Generation Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setGenerateForm({ ...generateForm, mode: 'batch' })}
                    className={`py-2 px-3 rounded-xl text-xs font-medium border text-center transition ${
                      generateForm.mode === 'batch'
                        ? 'bg-indigo-600 border-indigo-500 text-white font-semibold'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    Batch (All Active Residents)
                  </button>
                  <button
                    type="button"
                    onClick={() => setGenerateForm({ ...generateForm, mode: 'single' })}
                    className={`py-2 px-3 rounded-xl text-xs font-medium border text-center transition ${
                      generateForm.mode === 'single'
                        ? 'bg-indigo-600 border-indigo-500 text-white font-semibold'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    Single Specific Student
                  </button>
                </div>
              </div>

              {generateForm.mode === 'single' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Select Student *</label>
                  <select
                    required
                    value={generateForm.student_id}
                    onChange={(e) => setGenerateForm({ ...generateForm, student_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Choose active resident --</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name} ({s.admission_number})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Billing Month (YYYY-MM) *</label>
                  <input
                    type="month"
                    required
                    value={generateForm.billing_month}
                    onChange={(e) => {
                      const m = e.target.value;
                      setGenerateForm({ ...generateForm, billing_month: m, due_date: `${m}-10` });
                    }}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Payment Due Date *</label>
                  <input
                    type="date"
                    required
                    value={generateForm.due_date}
                    onChange={(e) => setGenerateForm({ ...generateForm, due_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Discount (₹)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={generateForm.discount}
                    onChange={(e) => setGenerateForm({ ...generateForm, discount: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Late Fee (₹)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={generateForm.late_fee}
                    onChange={(e) => setGenerateForm({ ...generateForm, late_fee: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Other Charges (₹)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={generateForm.other_charges}
                    onChange={(e) => setGenerateForm({ ...generateForm, other_charges: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Notes</label>
                <input
                  type="text"
                  value={generateForm.notes}
                  onChange={(e) => setGenerateForm({ ...generateForm, notes: e.target.value })}
                  placeholder="e.g. Regular monthly hostel rent"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsGenerateOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl border border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl"
                >
                  {formSubmitting ? 'Generating...' : 'Generate Rent Invoices'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {isPaymentOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <IndianRupee className="w-5 h-5 text-emerald-400" />
                Record Rent Payment
              </h3>
              <button onClick={() => setIsPaymentOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-xs text-red-300 rounded-xl">
                {modalError}
              </div>
            )}

            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Student *</label>
                <select
                  required
                  value={paymentForm.student_id}
                  onChange={(e) => {
                    const sid = e.target.value;
                    const studentRents = records.filter(r => r.student_id === sid && r.pending_amount > 0);
                    setPaymentForm({
                      ...paymentForm,
                      student_id: sid,
                      rent_id: studentRents.length > 0 ? studentRents[0].id : '',
                      amount: studentRents.length > 0 ? studentRents[0].pending_amount.toString() : paymentForm.amount,
                    });
                  }}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Choose Student --</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} ({s.admission_number})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Apply to Bill / Rent Invoice
                </label>
                <select
                  value={paymentForm.rent_id}
                  onChange={(e) => {
                    const rId = e.target.value;
                    const sel = records.find(r => r.id === rId);
                    setPaymentForm({
                      ...paymentForm,
                      rent_id: rId,
                      amount: sel ? sel.pending_amount.toString() : paymentForm.amount,
                    });
                  }}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500 font-mono"
                >
                  <option value="">-- Oldest Outstanding Balance (Auto) --</option>
                  {records
                    .filter(r => r.student_id === paymentForm.student_id && r.pending_amount > 0)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.billing_period} - Billed: ₹{r.total_amount} | Pending: ₹{r.pending_amount}
                      </option>
                    ))}
                </select>
              </div>

              {(() => {
                const selectedBill = records.find(r => r.id === paymentForm.rent_id) ||
                  records.find(r => r.student_id === paymentForm.student_id && r.pending_amount > 0);
                const totalRent = selectedBill?.total_amount || 0;
                const pendingBefore = selectedBill?.pending_amount || 0;
                const enteredAmt = parseFloat(paymentForm.amount) || 0;
                const remainingAfter = Math.max(0, pendingBefore - enteredAmt);

                if (!paymentForm.student_id || totalRent <= 0) return null;

                return (
                  <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/80 text-xs space-y-1.5">
                    <div className="flex justify-between text-slate-300">
                      <span>कुल किराया (Total Rent):</span>
                      <span className="font-bold font-mono text-white">₹{totalRent.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>वर्तमान बकाया (Pending Balance):</span>
                      <span className="font-bold font-mono text-amber-400">₹{pendingBefore.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    {enteredAmt > 0 && (
                      <div className="flex justify-between pt-1.5 border-t border-slate-700/60 text-xs">
                        <span className="text-slate-400 font-medium">भुगतान के बाद शेष किराया (Remaining Rent):</span>
                        <span className={`font-bold font-mono text-sm ${remainingAfter > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                          ₹{remainingAfter.toLocaleString(undefined, { minimumFractionDigits: 2 })} {remainingAfter === 0 ? '(पूर्ण चुकता ✓)' : ''}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500 font-mono text-base font-bold text-emerald-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Payment Mode *</label>
                  <select
                    required
                    value={paymentForm.payment_mode}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_mode: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Card">Card</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Payment Date *</label>
                  <input
                    type="date"
                    required
                    value={paymentForm.payment_date}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Transaction Ref #</label>
                  <input
                    type="text"
                    value={paymentForm.transaction_ref}
                    onChange={(e) => setPaymentForm({ ...paymentForm, transaction_ref: e.target.value })}
                    placeholder="UPI Ref, Cheque #..."
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Notes</label>
                <input
                  type="text"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  placeholder="e.g. Paid in full by student"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsPaymentOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl border border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting || !paymentForm.student_id || !paymentForm.amount}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl"
                >
                  {formSubmitting ? 'Processing...' : 'Confirm & Generate Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Official Receipt Modal */}
      {isReceiptOpen && selectedReceipt && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-y-auto receipt-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsReceiptOpen(false);
          }}
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl my-8 receipt-modal-dialog">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4 no-print">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Printer className="w-5 h-5 text-indigo-400" />
                Payment Receipt #{selectedReceipt.receiptNumber}
              </h3>
              <button
                type="button"
                onClick={() => setIsReceiptOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Receipt printable layout */}
            <div id="printable-receipt" className="bg-white text-slate-900 p-6 rounded-xl shadow-inner space-y-5">
              {/* Receipt Header */}
              <div className="border-b border-slate-200 pb-4 text-center">
                {(selectedReceipt.logoData || logo) && (
                  <div className="flex justify-center mb-2">
                    <img
                      src={(selectedReceipt.logoData || logo) as string}
                      alt={selectedReceipt.hostelName || 'Hostel Logo'}
                      className="receipt-logo-img max-h-16 max-w-44 object-contain rounded"
                    />
                  </div>
                )}
                <h2 className="text-lg font-bold uppercase tracking-tight text-slate-900">
                  {selectedReceipt.hostelName}
                </h2>
                <p className="text-[11px] text-slate-500">{selectedReceipt.hostelAddress}</p>
                <p className="text-[11px] text-slate-500">
                  Phone: {selectedReceipt.phone} | Email: {selectedReceipt.email}
                </p>
                <div className="mt-2 inline-block px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-800 font-bold text-xs rounded-full uppercase">
                  Official Rent Payment Receipt
                </div>
              </div>

              {/* Meta information grid */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Student Name / छात्र का नाम:</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {selectedReceipt.studentName}
                    {selectedReceipt.fatherName && (
                      <span className="font-normal text-slate-600 text-xs ml-1">(S/o श्री {selectedReceipt.fatherName})</span>
                    )}
                  </span>
                  <span className="text-slate-500 block font-mono text-[11px]">
                    ID: {selectedReceipt.admissionNumber}
                    {selectedReceipt.studentMobile && ` • 📞 ${selectedReceipt.studentMobile}`}
                  </span>
                  {(selectedReceipt.course || selectedReceipt.college) && (
                    <span className="text-slate-500 block text-[11px]">
                      {[selectedReceipt.course, selectedReceipt.college].filter(Boolean).join(' - ')}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Receipt Number / रसीद नं.:</span>
                  <span className="font-mono font-bold text-indigo-700">{selectedReceipt.receiptNumber}</span>
                  <span className="text-slate-500 block text-[11px]">दिनांक (Date): {selectedReceipt.paymentDate}</span>
                </div>
              </div>

              {(() => {
                const isAlloc = selectedReceipt.roomNumber && selectedReceipt.roomNumber !== 'N/A' && !selectedReceipt.roomNumber.includes('आवंटित नहीं');
                const totalRentAmount = selectedReceipt.totalRent !== undefined && selectedReceipt.totalRent > 0
                  ? selectedReceipt.totalRent
                  : (selectedReceipt.amount + (selectedReceipt.billRemainingBalance || 0));
                const remainingRentAmount = selectedReceipt.remainingRent !== undefined
                  ? selectedReceipt.remainingRent
                  : (selectedReceipt.billRemainingBalance !== undefined ? selectedReceipt.billRemainingBalance : Math.max(0, totalRentAmount - selectedReceipt.amount));

                return (
                  <>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-slate-500 text-[10px] block">Room (कमरा):</span>
                        <span className="font-semibold text-slate-800 font-mono">
                          {isAlloc ? `Room ${selectedReceipt.roomNumber}${selectedReceipt.floor ? ` (${selectedReceipt.floor})` : ''}` : 'आवंटित नहीं'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px] block">Bed (बेड):</span>
                        <span className="font-semibold text-slate-800 font-mono">
                          {isAlloc ? (selectedReceipt.bedNumber || '—') : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px] block">Billing Period (अवधि):</span>
                        <span className="font-semibold text-slate-800 font-mono">{selectedReceipt.billingPeriod}</span>
                      </div>
                    </div>

                    {/* 3-Box Rent Breakdown */}
                    <div className="grid grid-cols-3 gap-2.5 text-xs">
                      <div className="p-2.5 bg-blue-50/80 border border-blue-200 rounded-lg">
                        <span className="text-[10px] font-bold uppercase text-slate-600 block">कुल किराया (Total Rent):</span>
                        <span className="text-base font-extrabold text-slate-900 font-mono block">
                          ₹{totalRentAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] text-slate-500">कमरा निर्धारित किराया</span>
                      </div>

                      <div className="p-2.5 bg-emerald-50/80 border border-emerald-200 rounded-lg">
                        <span className="text-[10px] font-bold uppercase text-emerald-800 block">जमा राशि (Amount Paid):</span>
                        <span className="text-base font-extrabold text-emerald-700 font-mono block">
                          ₹{selectedReceipt.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] text-emerald-600">वर्तमान भुगतान</span>
                      </div>

                      <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-lg">
                        <span className="text-[10px] font-bold uppercase text-slate-600 block">बकाया किराया (Remaining Rent):</span>
                        <span className={`text-base font-extrabold font-mono block ${remainingRentAmount > 0 ? 'text-amber-800' : 'text-emerald-700'}`}>
                          ₹{remainingRentAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] text-slate-500">{remainingRentAmount > 0 ? 'भुगतान के बाद शेष' : 'पूर्ण चुकता (Nil)'}</span>
                      </div>
                    </div>

                    {/* Payment Details Table */}
                    <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                      <div className="bg-slate-100 p-2 font-semibold grid grid-cols-4 border-b border-slate-200 text-slate-700">
                        <span className="col-span-1">विवरण (Description)</span>
                        <span className="text-right">कुल किराया (Total)</span>
                        <span className="text-right">जमा राशि (Paid)</span>
                        <span className="text-right">बकाया (Remaining)</span>
                      </div>
                      <div className="p-3 grid grid-cols-4 items-center bg-white">
                        <div className="col-span-1">
                          <span className="font-bold text-slate-900 block">Hostel Rent & Accommodation</span>
                          <span className="text-[11px] text-slate-500">
                            Mode: {selectedReceipt.paymentMode}{' '}
                            {selectedReceipt.transactionRef && selectedReceipt.transactionRef !== 'N/A' && !selectedReceipt.transactionRef.includes('नकद')
                              ? `(Ref: ${selectedReceipt.transactionRef})`
                              : (selectedReceipt.paymentMode === 'Cash' ? '(नकद भुगतान)' : '')}
                          </span>
                        </div>
                        <span className="text-right font-mono font-bold text-slate-800 text-sm">
                          ₹{totalRentAmount.toFixed(2)}
                        </span>
                        <span className="text-right font-mono font-bold text-emerald-700 text-sm">
                          ₹{selectedReceipt.amount.toFixed(2)}
                        </span>
                        <span className={`text-right font-mono font-bold text-sm ${remainingRentAmount > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                          ₹{remainingRentAmount.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Amount in words */}
                    {selectedReceipt.amountInWords && (
                      <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                        <span className="text-slate-500 text-[10px] block font-semibold uppercase">शब्दों में राशि (Amount in Words):</span>
                        <span className="font-semibold text-slate-800 text-[11px]">{selectedReceipt.amountInWords}</span>
                      </div>
                    )}

                    {/* Balance ledger summary */}
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center text-xs">
                      <span className="text-slate-600">वर्तमान बिल शेष किराया (Bill Remaining Rent):</span>
                      <span className={`font-bold font-mono text-sm ${remainingRentAmount > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                        ₹{remainingRentAmount.toFixed(2)}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center text-xs">
                      <span className="text-slate-600">छात्र का कुल बकाया (Overall Student Outstanding):</span>
                      <span className={`font-bold font-mono text-sm ${selectedReceipt.overallRemainingDues > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                        ₹{selectedReceipt.overallRemainingDues.toFixed(2)}
                      </span>
                    </div>
                  </>
                );
              })()}

              {/* Footer signature */}
              <div className="pt-4 flex justify-between items-end border-t border-slate-200 text-[11px]">
                <div>
                  <div className="inline-block px-2.5 py-1 bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold rounded text-[10px] uppercase tracking-wider">
                    ✓ PAID &bull; VERIFIED
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">Printed via HostelMaster</div>
                </div>
                <div className="text-right flex flex-col items-end">
                  {(selectedReceipt.signatureData || settings?.signature_data) ? (
                    <div className="mb-1">
                      <img
                        src={(selectedReceipt.signatureData || settings?.signature_data) as string}
                        alt="Manager Signature"
                        className="receipt-signature-img max-h-12 max-w-44 object-contain"
                      />
                    </div>
                  ) : (
                    <div className="h-8" />
                  )}
                  <div className="w-40 border-b border-slate-400 mb-1" />
                  <span className="font-bold text-slate-800 text-xs block">
                    {selectedReceipt.authorizedSignature || settings?.authorized_signature || 'Hostel Warden / Manager'}
                  </span>
                  <span className="text-[10px] text-slate-500 block">Authorized Signatory / अधिकृत हस्ताक्षर</span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-end space-x-2.5 no-print flex-wrap gap-y-2">
              <button
                type="button"
                onClick={() => setIsReceiptOpen(false)}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium rounded-xl border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5 text-slate-400" />
                <span>बंद करें (Close)</span>
              </button>
              <button
                type="button"
                onClick={handlePrintReceipt}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/20 flex items-center gap-1.5 transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>प्रिंट रसीद (Print Dialog)</span>
              </button>
              <button
                type="button"
                onClick={handlePrintInNewTab}
                title="ब्राउज़र के नए टैब में रसीद खोलकर सिस्टम प्रिंट डायलॉग दिखाएं"
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white text-xs font-medium rounded-xl border border-indigo-500/30 flex items-center gap-1.5 transition cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                <span>नया टैब में प्रिंट (New Tab Print)</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  handleDownloadPdfReceipt({
                    ...selectedReceipt,
                    logoData: selectedReceipt.logoData || logo || undefined,
                    signatureData: selectedReceipt.signatureData || settings?.signature_data || undefined,
                    currency: selectedReceipt.currency || currency || '₹',
                  })
                }
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Download PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

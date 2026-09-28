import express, { Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../auth.js';
import { queryOne, queryAll } from '../db.js';

const router = express.Router();
router.use(requireAuth);

// GET /api/reports/list
router.get('/list', (req: AuthenticatedRequest, res: Response) => {
  const reports = [
    { id: '1', key: 'student_report', name: 'Student Report', category: 'Students', description: 'Comprehensive list of all registered students with contact & academic info.' },
    { id: '2', key: 'active_student_report', name: 'Active Student Report', category: 'Students', description: 'Currently active residing students with room/bed numbers.' },
    { id: '3', key: 'vacated_student_report', name: 'Vacated Student Report', category: 'Students', description: 'Students who have checked out or vacated.' },
    { id: '4', key: 'room_report', name: 'Room Report', category: 'Rooms & Beds', description: 'Rooms listing with floor, room type, capacity and rent.' },
    { id: '5', key: 'bed_availability_report', name: 'Bed Availability Report', category: 'Rooms & Beds', description: 'Vacant beds ready for immediate student allocation.' },
    { id: '6', key: 'occupancy_report', name: 'Occupancy Report', category: 'Rooms & Beds', description: 'Detailed occupancy rates breakdown across all rooms.' },
    { id: '7', key: 'rent_report', name: 'Rent Report', category: 'Financials', description: 'All generated rent invoices, discounts, and late fees.' },
    { id: '8', key: 'pending_rent_report', name: 'Pending Rent Report', category: 'Financials', description: 'Unpaid and overdue rent invoices with outstanding balances.' },
    { id: '9', key: 'payment_report', name: 'Payment Report', category: 'Financials', description: 'Detailed log of all payments received with receipt numbers.' },
    { id: '10', key: 'expense_report', name: 'Expense Report', category: 'Expenses', description: 'Categorized operational hostel expenditures.' },
    { id: '11', key: 'income_report', name: 'Income Report', category: 'Financials', description: 'Total revenue and collections filtered by date range and mode.' },
    { id: '12', key: 'income_vs_expense_report', name: 'Income vs Expense Report', category: 'Financials', description: 'Monthly profit/loss statement comparing revenue and costs.' },
    { id: '13', key: 'student_statement', name: 'Student Statement', category: 'Students', description: 'Account ledger statement for a selected student showing all debits and credits.' },
    { id: '14', key: 'monthly_financial_report', name: 'Monthly Financial Report', category: 'Financials', description: 'High-level executive financial summary for a chosen month.' },
    { id: '15', key: 'admission_report', name: 'Admission Report', category: 'Students', description: 'New student admissions within a specified date period.' },
    { id: '16', key: 'vacating_report', name: 'Vacating Report', category: 'Rooms & Beds', description: 'Historical checkouts and vacating records.' },
    { id: '17', key: 'room_allocation_history', name: 'Room Allocation History', category: 'Rooms & Beds', description: 'Complete chronological history of room and bed assignments.' },
    { id: '18', key: 'payment_collection_summary', name: 'Payment Collection Summary', category: 'Financials', description: 'Payment totals aggregated by payment method (Cash, UPI, Bank, Card).' },
  ];

  res.json({ reports });
});

// GET /api/reports/run/:key: Execute a specific report with real database data
router.get('/run/:key', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { key } = req.params;
    const { start_date, end_date, month, student_id, room_id, category, payment_mode } = req.query;

    let columns: { header: string; key: string }[] = [];
    let rows: any[] = [];
    let summary: Record<string, any> = {};

    switch (key) {
      case 'student_report': {
        columns = [
          { header: 'Admission #', key: 'admission_number' },
          { header: 'Full Name', key: 'full_name' },
          { header: 'Mobile', key: 'mobile' },
          { header: 'College', key: 'college' },
          { header: 'Course', key: 'course' },
          { header: 'Admission Date', key: 'admission_date' },
          { header: 'Status', key: 'status' },
        ];
        rows = queryAll('SELECT * FROM students ORDER BY admission_date DESC');
        summary = { totalStudents: rows.length };
        break;
      }

      case 'active_student_report': {
        columns = [
          { header: 'Admission #', key: 'admission_number' },
          { header: 'Student Name', key: 'full_name' },
          { header: 'Room #', key: 'room_number' },
          { header: 'Bed #', key: 'bed_number' },
          { header: 'Mobile', key: 'mobile' },
          { header: 'Admission Date', key: 'admission_date' },
          { header: 'Allocated Date', key: 'allocation_date' },
        ];
        rows = queryAll(
          `SELECT s.*, r.room_number, b.bed_number, a.allocation_date
           FROM students s
           JOIN room_allocations a ON a.student_id = s.id AND a.status = 'active'
           JOIN rooms r ON a.room_id = r.id
           JOIN beds b ON a.bed_id = b.id
           WHERE s.status = 'active'
           ORDER BY r.room_number ASC, b.bed_number ASC`
        );
        summary = { activeResidents: rows.length };
        break;
      }

      case 'vacated_student_report': {
        columns = [
          { header: 'Admission #', key: 'admission_number' },
          { header: 'Student Name', key: 'full_name' },
          { header: 'Room #', key: 'room_number' },
          { header: 'Bed #', key: 'bed_number' },
          { header: 'Allocated Date', key: 'allocation_date' },
          { header: 'Vacated Date', key: 'vacate_date' },
        ];
        rows = queryAll(
          `SELECT s.admission_number, s.full_name, r.room_number, b.bed_number, a.allocation_date, a.vacate_date
           FROM room_allocations a
           JOIN students s ON a.student_id = s.id
           JOIN rooms r ON a.room_id = r.id
           JOIN beds b ON a.bed_id = b.id
           WHERE a.status = 'vacated'
           ORDER BY a.vacate_date DESC`
        );
        summary = { totalVacatedRecords: rows.length };
        break;
      }

      case 'room_report': {
        columns = [
          { header: 'Room #', key: 'room_number' },
          { header: 'Floor', key: 'floor' },
          { header: 'Type', key: 'room_type' },
          { header: 'Capacity', key: 'capacity' },
          { header: 'Total Beds', key: 'total_beds' },
          { header: 'Occupied Beds', key: 'occupied_beds' },
          { header: 'Available Beds', key: 'available_beds' },
          { header: 'Monthly Rent', key: 'monthly_rent' },
        ];
        const rawRooms = queryAll('SELECT * FROM rooms ORDER BY room_number ASC');
        rows = rawRooms.map(r => {
          const beds = queryAll('SELECT status FROM beds WHERE room_id = ?', [r.id]);
          const totalBeds = beds.length;
          const occupied = beds.filter(b => b.status === 'occupied').length;
          return {
            ...r,
            total_beds: totalBeds,
            occupied_beds: occupied,
            available_beds: totalBeds - occupied,
          };
        });
        summary = {
          totalRooms: rows.length,
          totalCapacity: rows.reduce((s, r) => s + r.capacity, 0),
        };
        break;
      }

      case 'bed_availability_report': {
        columns = [
          { header: 'Room #', key: 'room_number' },
          { header: 'Floor', key: 'floor' },
          { header: 'Room Type', key: 'room_type' },
          { header: 'Bed #', key: 'bed_number' },
          { header: 'Monthly Rent', key: 'monthly_rent' },
          { header: 'Status', key: 'status' },
        ];
        rows = queryAll(
          `SELECT r.room_number, r.floor, r.room_type, b.bed_number, r.monthly_rent, b.status
           FROM beds b
           JOIN rooms r ON b.room_id = r.id
           WHERE b.status = 'available'
           ORDER BY r.room_number ASC, b.bed_number ASC`
        );
        summary = { availableBeds: rows.length };
        break;
      }

      case 'occupancy_report': {
        columns = [
          { header: 'Room #', key: 'room_number' },
          { header: 'Floor', key: 'floor' },
          { header: 'Capacity', key: 'capacity' },
          { header: 'Occupied', key: 'occupied' },
          { header: 'Available', key: 'available' },
          { header: 'Occupancy %', key: 'occupancy_rate' },
        ];
        const roomsList = queryAll('SELECT * FROM rooms ORDER BY room_number ASC');
        let totalCap = 0;
        let totalOcc = 0;
        rows = roomsList.map(r => {
          const beds = queryAll('SELECT status FROM beds WHERE room_id = ?', [r.id]);
          const occ = beds.filter(b => b.status === 'occupied').length;
          const totalBeds = beds.length;
          const rate = totalBeds > 0 ? Math.round((occ / totalBeds) * 100) : 0;
          totalCap += totalBeds;
          totalOcc += occ;
          return {
            room_number: r.room_number,
            floor: r.floor,
            capacity: totalBeds,
            occupied: occ,
            available: totalBeds - occ,
            occupancy_rate: `${rate}%`,
          };
        });
        const overallRate = totalCap > 0 ? Math.round((totalOcc / totalCap) * 100) : 0;
        summary = {
          totalBeds: totalCap,
          occupiedBeds: totalOcc,
          availableBeds: totalCap - totalOcc,
          overallOccupancyRate: `${overallRate}%`,
        };
        break;
      }

      case 'rent_report': {
        columns = [
          { header: 'Invoice #', key: 'id' },
          { header: 'Student Name', key: 'student_name' },
          { header: 'Billing Period', key: 'billing_period' },
          { header: 'Rent', key: 'rent_amount' },
          { header: 'Discount', key: 'discount' },
          { header: 'Late Fee', key: 'late_fee' },
          { header: 'Total', key: 'total_amount' },
          { header: 'Paid', key: 'paid_amount' },
          { header: 'Pending', key: 'pending_amount' },
          { header: 'Status', key: 'status' },
        ];
        let sql = `SELECT rn.*, s.full_name as student_name
                   FROM rent_records rn
                   JOIN students s ON rn.student_id = s.id WHERE 1=1`;
        const p: any[] = [];
        if (month) {
          sql += ' AND rn.billing_month = ?';
          p.push(month);
        }
        if (student_id) {
          sql += ' AND rn.student_id = ?';
          p.push(student_id);
        }
        sql += ' ORDER BY rn.billing_month DESC';
        rows = queryAll(sql, p);
        summary = {
          totalInvoices: rows.length,
          totalBilled: rows.reduce((s, r) => s + r.total_amount, 0),
          totalPaid: rows.reduce((s, r) => s + r.paid_amount, 0),
          totalPending: rows.reduce((s, r) => s + r.pending_amount, 0),
        };
        break;
      }

      case 'pending_rent_report': {
        columns = [
          { header: 'Student Name', key: 'student_name' },
          { header: 'Admission #', key: 'admission_number' },
          { header: 'Room #', key: 'room_number' },
          { header: 'Billing Period', key: 'billing_period' },
          { header: 'Total Billed', key: 'total_amount' },
          { header: 'Paid', key: 'paid_amount' },
          { header: 'Outstanding', key: 'pending_amount' },
          { header: 'Due Date', key: 'due_date' },
        ];
        rows = queryAll(
          `SELECT rn.*, s.full_name as student_name, s.admission_number, r.room_number
           FROM rent_records rn
           JOIN students s ON rn.student_id = s.id
           JOIN rooms r ON rn.room_id = r.id
           WHERE rn.pending_amount > 0
           ORDER BY rn.due_date ASC`
        );
        summary = {
          unpaidInvoices: rows.length,
          totalOutstanding: rows.reduce((s, r) => s + r.pending_amount, 0),
        };
        break;
      }

      case 'payment_report': {
        columns = [
          { header: 'Receipt #', key: 'receipt_number' },
          { header: 'Date', key: 'payment_date' },
          { header: 'Student Name', key: 'student_name' },
          { header: 'Amount', key: 'amount' },
          { header: 'Payment Mode', key: 'payment_mode' },
          { header: 'Reference', key: 'transaction_ref' },
        ];
        let sql = `SELECT p.*, s.full_name as student_name
                   FROM payments p
                   JOIN students s ON p.student_id = s.id WHERE 1=1`;
        const p: any[] = [];
        if (start_date) {
          sql += ' AND p.payment_date >= ?';
          p.push(start_date);
        }
        if (end_date) {
          sql += ' AND p.payment_date <= ?';
          p.push(end_date);
        }
        if (payment_mode && payment_mode !== 'all') {
          sql += ' AND p.payment_mode = ?';
          p.push(payment_mode);
        }
        sql += ' ORDER BY p.payment_date DESC';
        rows = queryAll(sql, p);
        summary = {
          totalPaymentsCount: rows.length,
          totalCollected: rows.reduce((s, r) => s + r.amount, 0),
        };
        break;
      }

      case 'expense_report': {
        columns = [
          { header: 'Date', key: 'date' },
          { header: 'Category', key: 'category' },
          { header: 'Description', key: 'description' },
          { header: 'Amount', key: 'amount' },
          { header: 'Payment Mode', key: 'payment_mode' },
          { header: 'Vendor', key: 'vendor' },
        ];
        let sql = 'SELECT * FROM expenses WHERE 1=1';
        const p: any[] = [];
        if (category && category !== 'all') {
          sql += ' AND category = ?';
          p.push(category);
        }
        if (start_date) {
          sql += ' AND date >= ?';
          p.push(start_date);
        }
        if (end_date) {
          sql += ' AND date <= ?';
          p.push(end_date);
        }
        sql += ' ORDER BY date DESC';
        rows = queryAll(sql, p);
        summary = {
          totalExpensesCount: rows.length,
          totalExpensesAmount: rows.reduce((s, r) => s + r.amount, 0),
        };
        break;
      }

      case 'income_report': {
        columns = [
          { header: 'Receipt #', key: 'receipt_number' },
          { header: 'Payment Date', key: 'payment_date' },
          { header: 'Student Name', key: 'student_name' },
          { header: 'Payment Mode', key: 'payment_mode' },
          { header: 'Amount', key: 'amount' },
        ];
        rows = queryAll(
          `SELECT p.receipt_number, p.payment_date, s.full_name as student_name, p.payment_mode, p.amount
           FROM payments p
           JOIN students s ON p.student_id = s.id
           ORDER BY p.payment_date DESC`
        );
        summary = {
          totalIncome: rows.reduce((s, r) => s + r.amount, 0),
        };
        break;
      }

      case 'income_vs_expense_report': {
        columns = [
          { header: 'Month', key: 'month' },
          { header: 'Total Income', key: 'income' },
          { header: 'Total Expenses', key: 'expenses' },
          { header: 'Net Margin', key: 'net_income' },
        ];
        const monthlyData: any[] = [];
        const d = new Date();
        for (let i = 11; i >= 0; i--) {
          const cur = new Date(d.getFullYear(), d.getMonth() - i, 1);
          const mStr = cur.toISOString().slice(0, 7);
          const inc = queryOne<{ total: number }>('SELECT coalesce(sum(amount), 0) as total FROM payments WHERE strftime("%Y-%m", payment_date) = ?', [mStr])?.total || 0;
          const exp = queryOne<{ total: number }>('SELECT coalesce(sum(amount), 0) as total FROM expenses WHERE strftime("%Y-%m", date) = ?', [mStr])?.total || 0;
          monthlyData.push({
            month: mStr,
            income: inc,
            expenses: exp,
            net_income: inc - exp,
          });
        }
        rows = monthlyData;
        const totalInc = rows.reduce((s, r) => s + r.income, 0);
        const totalExp = rows.reduce((s, r) => s + r.expenses, 0);
        summary = {
          totalIncome: totalInc,
          totalExpenses: totalExp,
          netProfit: totalInc - totalExp,
        };
        break;
      }

      case 'student_statement': {
        columns = [
          { header: 'Date', key: 'date' },
          { header: 'Transaction Type', key: 'type' },
          { header: 'Description', key: 'description' },
          { header: 'Billed / Debit', key: 'debit' },
          { header: 'Paid / Credit', key: 'credit' },
        ];
        if (!student_id) {
          rows = [];
          summary = { message: 'Please select a student to generate student ledger statement.' };
        } else {
          const student = queryOne<{ full_name: string }>('SELECT full_name FROM students WHERE id = ?', [student_id]);
          const rents = queryAll('SELECT created_at as date, billing_period, total_amount FROM rent_records WHERE student_id = ?', [student_id]);
          const pays = queryAll('SELECT payment_date as date, receipt_number, amount, payment_mode FROM payments WHERE student_id = ?', [student_id]);

          const combined = [
            ...rents.map(r => ({
              date: r.date.split('T')[0],
              type: 'Rent Invoice',
              description: `Rent for period ${r.billing_period}`,
              debit: r.total_amount,
              credit: 0,
            })),
            ...pays.map(p => ({
              date: p.date,
              type: 'Payment Received',
              description: `Receipt #${p.receipt_number} via ${p.payment_mode}`,
              debit: 0,
              credit: p.amount,
            })),
          ];

          combined.sort((a, b) => (a.date > b.date ? 1 : -1));
          rows = combined;
          const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
          const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
          summary = {
            studentName: student?.full_name || 'N/A',
            totalBilled: totalDebit,
            totalPaid: totalCredit,
            currentBalanceDue: Math.max(0, totalDebit - totalCredit),
          };
        }
        break;
      }

      case 'monthly_financial_report': {
        const curMonth = (month as string) || new Date().toISOString().slice(0, 7);
        columns = [
          { header: 'Metric', key: 'metric' },
          { header: 'Amount', key: 'value' },
        ];
        const rentTotal = queryOne<{ total: number }>('SELECT coalesce(sum(total_amount), 0) as total FROM rent_records WHERE billing_month = ?', [curMonth])?.total || 0;
        const collectionTotal = queryOne<{ total: number }>('SELECT coalesce(sum(amount), 0) as total FROM payments WHERE strftime("%Y-%m", payment_date) = ?', [curMonth])?.total || 0;
        const expenseTotal = queryOne<{ total: number }>('SELECT coalesce(sum(amount), 0) as total FROM expenses WHERE strftime("%Y-%m", date) = ?', [curMonth])?.total || 0;

        rows = [
          { metric: `Rent Invoiced (${curMonth})`, value: `₹${rentTotal.toFixed(2)}` },
          { metric: `Actual Payments Collected (${curMonth})`, value: `₹${collectionTotal.toFixed(2)}` },
          { metric: `Operational Expenses (${curMonth})`, value: `₹${expenseTotal.toFixed(2)}` },
          { metric: `Operating Net Cashflow (${curMonth})`, value: `₹${(collectionTotal - expenseTotal).toFixed(2)}` },
        ];
        summary = { month: curMonth };
        break;
      }

      case 'admission_report': {
        columns = [
          { header: 'Admission Date', key: 'admission_date' },
          { header: 'Admission #', key: 'admission_number' },
          { header: 'Student Name', key: 'full_name' },
          { header: 'Mobile', key: 'mobile' },
          { header: 'College', key: 'college' },
          { header: 'Course', key: 'course' },
        ];
        let sql = 'SELECT * FROM students WHERE 1=1';
        const p: any[] = [];
        if (start_date) {
          sql += ' AND admission_date >= ?';
          p.push(start_date);
        }
        if (end_date) {
          sql += ' AND admission_date <= ?';
          p.push(end_date);
        }
        sql += ' ORDER BY admission_date DESC';
        rows = queryAll(sql, p);
        summary = { totalAdmissions: rows.length };
        break;
      }

      case 'vacating_report': {
        columns = [
          { header: 'Vacated Date', key: 'vacate_date' },
          { header: 'Student Name', key: 'student_name' },
          { header: 'Admission #', key: 'admission_number' },
          { header: 'Room #', key: 'room_number' },
          { header: 'Bed #', key: 'bed_number' },
          { header: 'Allocation Date', key: 'allocation_date' },
        ];
        rows = queryAll(
          `SELECT a.vacate_date, a.allocation_date, s.full_name as student_name, s.admission_number, r.room_number, b.bed_number
           FROM room_allocations a
           JOIN students s ON a.student_id = s.id
           JOIN rooms r ON a.room_id = r.id
           JOIN beds b ON a.bed_id = b.id
           WHERE a.status = 'vacated'
           ORDER BY a.vacate_date DESC`
        );
        summary = { totalVacated: rows.length };
        break;
      }

      case 'room_allocation_history': {
        columns = [
          { header: 'Allocation Date', key: 'allocation_date' },
          { header: 'Status', key: 'status' },
          { header: 'Student Name', key: 'student_name' },
          { header: 'Room #', key: 'room_number' },
          { header: 'Bed #', key: 'bed_number' },
          { header: 'Monthly Rent', key: 'monthly_rent' },
          { header: 'Vacate Date', key: 'vacate_date' },
        ];
        rows = queryAll(
          `SELECT a.*, s.full_name as student_name, r.room_number, b.bed_number
           FROM room_allocations a
           JOIN students s ON a.student_id = s.id
           JOIN rooms r ON a.room_id = r.id
           JOIN beds b ON a.bed_id = b.id
           ORDER BY a.allocation_date DESC`
        );
        summary = { totalHistoricalAllocations: rows.length };
        break;
      }

      case 'payment_collection_summary': {
        columns = [
          { header: 'Payment Method', key: 'payment_mode' },
          { header: 'Total Transactions', key: 'count' },
          { header: 'Total Amount Collected', key: 'total_amount' },
        ];
        rows = queryAll(
          `SELECT payment_mode, count(*) as count, coalesce(sum(amount), 0) as total_amount
           FROM payments
           GROUP BY payment_mode
           ORDER BY total_amount DESC`
        );
        const grandTotal = rows.reduce((s, r) => s + r.total_amount, 0);
        summary = { grandTotalCollected: grandTotal };
        break;
      }

      default:
        res.status(404).json({ error: 'Report not found.' });
        return;
    }

    res.json({
      reportKey: key,
      columns,
      rows,
      summary,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to run report: ' + err.message });
  }
});

export default router;

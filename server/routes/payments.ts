import express, { Request, Response } from 'express';
import { requireAuth, AuthenticatedRequest, logAudit } from '../auth.js';
import { queryOne, queryAll, runQuery } from '../db.js';

const router = express.Router();

function convertNumberToIndianWords(num: number): string {
  if (isNaN(num) || num <= 0) return 'Zero Rupees Only / शून्य रुपये मात्र';

  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function numToWords(n: number): string {
    if (n === 0) return '';
    if (n < 20) return a[n] + ' ';
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '') + ' ';
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred ' + numToWords(n % 100);
    if (n < 100000) return numToWords(Math.floor(n / 1000)) + 'Thousand ' + numToWords(n % 1000);
    if (n < 10000000) return numToWords(Math.floor(n / 100000)) + 'Lakh ' + numToWords(n % 100000);
    return numToWords(Math.floor(n / 10000000)) + 'Crore ' + numToWords(n % 10000000);
  }

  const intPart = Math.floor(num);
  const words = numToWords(intPart).trim();
  return words ? `${words} Rupees Only` : 'Zero Rupees Only';
}

function enrichReceiptPayload(receipt: any): any {
  if (!receipt) return receipt;

  // Enrich missing student metadata
  if (receipt.admissionNumber) {
    const student = queryOne<any>(
      'SELECT id, full_name, father_name, mobile, course, college FROM students WHERE admission_number = ?',
      [receipt.admissionNumber]
    );
    if (student) {
      if (!receipt.studentMobile && student.mobile) receipt.studentMobile = student.mobile;
      if (!receipt.fatherName && student.father_name) receipt.fatherName = student.father_name;
      if (!receipt.course && student.course) receipt.course = student.course;
      if (!receipt.college && student.college) receipt.college = student.college;

      // If room is missing or 'N/A'
      const isMissingRoom = !receipt.roomNumber || receipt.roomNumber === 'N/A' || receipt.roomNumber === '—' || receipt.roomNumber === 'null';
      if (isMissingRoom) {
        const activeAlloc = queryOne<any>(
          `SELECT r.room_number, b.bed_number, r.floor, r.room_type
           FROM room_allocations a
           JOIN rooms r ON a.room_id = r.id
           JOIN beds b ON a.bed_id = b.id
           WHERE a.student_id = ? AND a.status = 'active'
           ORDER BY a.created_at DESC LIMIT 1`,
          [student.id]
        );
        if (activeAlloc) {
          receipt.roomNumber = activeAlloc.room_number;
          receipt.bedNumber = activeAlloc.bed_number;
          receipt.floor = activeAlloc.floor;
          receipt.roomType = activeAlloc.room_type;
        } else {
          const pastAlloc = queryOne<any>(
            `SELECT r.room_number, b.bed_number, r.floor, r.room_type
             FROM room_allocations a
             JOIN rooms r ON a.room_id = r.id
             JOIN beds b ON a.bed_id = b.id
             WHERE a.student_id = ?
             ORDER BY a.created_at DESC LIMIT 1`,
            [student.id]
          );
          if (pastAlloc) {
            receipt.roomNumber = pastAlloc.room_number;
            receipt.bedNumber = pastAlloc.bed_number;
            receipt.floor = pastAlloc.floor;
            receipt.roomType = pastAlloc.room_type;
          }
        }
      }
    }
  }

  // Ensure roomNumber is never 'N/A'
  if (!receipt.roomNumber || receipt.roomNumber === 'N/A' || receipt.roomNumber === 'null') {
    receipt.roomNumber = 'आवंटित नहीं (Unassigned)';
  }
  if (!receipt.bedNumber || receipt.bedNumber === 'N/A' || receipt.bedNumber === 'null') {
    receipt.bedNumber = '—';
  }

  // Amount in words
  if (!receipt.amountInWords && receipt.amount) {
    receipt.amountInWords = convertNumberToIndianWords(receipt.amount);
  }

  // Transaction ref clean
  if (!receipt.transactionRef || receipt.transactionRef === 'N/A') {
    receipt.transactionRef = receipt.paymentMode === 'Cash' ? 'नकद (Cash Payment)' : '—';
  }

  // Total Rent calculation & enrichment
  const currentAmt = Number(receipt.amount) || 0;
  const remBal = receipt.billRemainingBalance !== undefined ? Number(receipt.billRemainingBalance) : 0;

  if (receipt.totalRent === undefined || receipt.totalRent === null || receipt.totalRent === 0) {
    let tr = 0;
    if (receipt.rentId) {
      const rr = queryOne<any>('SELECT total_amount FROM rent_records WHERE id = ?', [receipt.rentId]);
      if (rr && rr.total_amount) tr = Number(rr.total_amount);
    }
    if (!tr && receipt.admissionNumber) {
      const alloc = queryOne<any>(
        `SELECT a.monthly_rent FROM room_allocations a
         JOIN students s ON a.student_id = s.id
         WHERE s.admission_number = ?
         ORDER BY a.created_at DESC LIMIT 1`,
        [receipt.admissionNumber]
      );
      if (alloc && alloc.monthly_rent) tr = Number(alloc.monthly_rent);
    }
    if (!tr) {
      tr = currentAmt + remBal;
    }
    receipt.totalRent = tr;
  }

  if (receipt.remainingRent === undefined || receipt.remainingRent === null) {
    receipt.remainingRent = receipt.billRemainingBalance !== undefined
      ? Number(receipt.billRemainingBalance)
      : Math.max(0, Number(receipt.totalRent || 0) - currentAmt);
  }

  if (receipt.billRemainingBalance === undefined || receipt.billRemainingBalance === null) {
    receipt.billRemainingBalance = receipt.remainingRent;
  }

  if (receipt.previouslyPaid === undefined || receipt.previouslyPaid === null) {
    receipt.previouslyPaid = Math.max(0, Number(receipt.totalRent || 0) - Number(receipt.remainingRent || 0) - currentAmt);
  }

  if (receipt.totalPaid === undefined || receipt.totalPaid === null) {
    receipt.totalPaid = Number(receipt.previouslyPaid || 0) + currentAmt;
  }

  return receipt;
}

function renderReceiptPrintHtml(rawReceipt: any): string {
  const receipt = enrichReceiptPayload(rawReceipt);
  const currencySymbol = receipt.currency || '₹';
  const logoHtml = receipt.logoData
    ? `<img src="${receipt.logoData}" alt="${receipt.hostelName || 'Hostel Logo'}" style="max-height: 56px; max-width: 180px; object-fit: contain;" />`
    : `<div style="width: 44px; height: 44px; border-radius: 10px; background: #4f46e5; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 20px;">H</div>`;

  const signatureHtml = receipt.signatureData
    ? `<div style="text-align: right; margin-bottom: 4px;">
        <img src="${receipt.signatureData}" alt="Manager Signature" style="max-height: 50px; max-width: 170px; object-fit: contain; display: inline-block;" />
       </div>`
    : `<div style="height: 38px;"></div>`;

  const isRoomAllocated = receipt.roomNumber && receipt.roomNumber !== 'N/A' && !receipt.roomNumber.includes('आवंटित नहीं');
  const roomDisplay = isRoomAllocated
    ? `कमरा: Room ${receipt.roomNumber} &bull; बेड: ${receipt.bedNumber}${receipt.floor ? ` (${receipt.floor})` : ''}`
    : 'आवंटित नहीं (General / Direct)';

  const studentFatherDisplay = receipt.fatherName ? ` <span style="font-size: 11px; font-weight: 500; color: #475569;">(S/o श्री ${receipt.fatherName})</span>` : '';
  const collegeCourseDisplay = [receipt.course, receipt.college].filter(Boolean).join(' - ') || '—';

  return `<!DOCTYPE html>
<html lang="hi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Payment Receipt #${receipt.receiptNumber}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans Devanagari", sans-serif;
      color: #0f172a;
      background: #f1f5f9;
      font-size: 13px;
      line-height: 1.45;
      padding: 20px;
    }
    .print-actions {
      max-width: 760px;
      margin: 0 auto 16px auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #1e293b;
      color: #fff;
      padding: 12px 18px;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .print-actions button {
      cursor: pointer;
      font-weight: 600;
      font-size: 13px;
      border-radius: 8px;
      padding: 8px 16px;
      border: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
    }
    .btn-print {
      background: #4f46e5;
      color: #ffffff;
    }
    .btn-print:hover {
      background: #4338ca;
    }
    .btn-close {
      background: #334155;
      color: #cbd5e1;
    }
    .btn-close:hover {
      background: #475569;
      color: #ffffff;
    }
    .receipt-container {
      max-width: 760px;
      margin: 0 auto;
      border: 2px solid #0f172a;
      border-radius: 12px;
      padding: 24px;
      background: #ffffff;
      box-shadow: 0 8px 24px rgba(0,0,0,0.08);
    }
    .header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 14px;
      margin-bottom: 14px;
    }
    .brand-col {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .hostel-info h1 {
      font-size: 20px;
      font-weight: 800;
      text-transform: uppercase;
      color: #0f172a;
    }
    .hostel-info p {
      font-size: 11px;
      color: #475569;
    }
    .receipt-badge-col {
      text-align: right;
    }
    .badge {
      display: inline-block;
      background: #eef2ff;
      color: #3730a3;
      border: 1px solid #c7d2fe;
      font-weight: 800;
      font-size: 11px;
      padding: 4px 12px;
      border-radius: 9999px;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .rcp-number {
      font-family: monospace;
      font-size: 14px;
      font-weight: 700;
      color: #4338ca;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 16px;
    }
    .meta-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .meta-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
    }
    .meta-value {
      font-size: 13px;
      font-weight: 600;
      color: #0f172a;
    }
    .particulars-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    .particulars-table th {
      background: #f1f5f9;
      border-top: 1px solid #cbd5e1;
      border-bottom: 1px solid #cbd5e1;
      padding: 8px 10px;
      text-align: left;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #475569;
    }
    .particulars-table td {
      border-bottom: 1px solid #e2e8f0;
      padding: 10px;
      font-size: 12px;
      color: #1e293b;
    }
    .text-right {
      text-align: right;
    }
    .amount-paid {
      font-size: 15px;
      font-weight: 800;
      font-family: monospace;
      color: #047857;
    }
    .rent-stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 12px;
      margin-bottom: 16px;
    }
    .stat-card {
      border: 1.5px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .stat-total {
      background: #f0f9ff;
      border-color: #bae6fd;
    }
    .stat-paid {
      background: #f0fdf4;
      border-color: #bbf7d0;
    }
    .stat-balance {
      background: #fffbeb;
      border-color: #fde68a;
    }
    .stat-title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      color: #475569;
    }
    .stat-num {
      font-size: 17px;
      font-weight: 800;
      font-family: monospace;
      color: #0f172a;
    }
    .stat-desc {
      font-size: 10px;
      color: #64748b;
    }
    .text-red {
      color: #b91c1c !important;
    }
    .text-green {
      color: #047857 !important;
    }
    .summary-strip {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      margin-bottom: 20px;
    }
    .footer-section {
      border-top: 1px solid #e2e8f0;
      padding-top: 14px;
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
    }
    .verification-stamp {
      display: inline-block;
      padding: 4px 10px;
      background: #ecfdf5;
      border: 1.5px solid #10b981;
      border-radius: 6px;
      color: #065f46;
      font-weight: 800;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .signature-box {
      text-align: right;
      min-width: 180px;
    }
    .signature-line {
      width: 160px;
      border-bottom: 1.5px solid #475569;
      margin: 4px 0 4px auto;
    }
    .signatory-title {
      font-size: 12px;
      font-weight: 700;
      color: #0f172a;
    }
    @media print {
      body {
        background: #ffffff !important;
        padding: 0 !important;
      }
      .no-print, .print-actions {
        display: none !important;
      }
      .receipt-container {
        border: 2px solid #000000 !important;
        box-shadow: none !important;
        max-width: 100% !important;
        padding: 16px !important;
      }
    }
  </style>
</head>
<body>
  <div class="print-actions no-print">
    <div>
      <strong>रसीद #${receipt.receiptNumber}</strong>
      <span style="font-size: 11px; color: #94a3b8; margin-left: 8px;">(सिस्टम प्रिंट डायलॉग नीचे दिए बटन से खोलें)</span>
    </div>
    <div style="display: flex; gap: 10px;">
      <button class="btn-print" onclick="window.print()">
        🖨️ सिस्टम प्रिंट करें (Print Dialog)
      </button>
      <button class="btn-close" onclick="window.close()">
        ✕ बंद करें (Close)
      </button>
    </div>
  </div>

  <div class="receipt-container">
    <div class="header-row">
      <div class="brand-col">
        ${logoHtml}
        <div class="hostel-info">
          <h1>${receipt.hostelName || 'HOSTEL RESIDENCE'}</h1>
          <p>${receipt.hostelAddress || 'Hostel Campus'}</p>
          <p>फ़ोन: ${receipt.phone || '—'} &bull; ईमेल: ${receipt.email || '—'}</p>
        </div>
      </div>
      <div class="receipt-badge-col">
        <span class="badge">Official Rent Receipt</span>
        <div class="rcp-number"># ${receipt.receiptNumber}</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 2px;">दिनांक: ${receipt.paymentDate}</div>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-item">
        <span class="meta-label">Student Name / छात्र का नाम:</span>
        <span class="meta-value">${receipt.studentName}${studentFatherDisplay}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Admission / Roll No:</span>
        <span class="meta-value" style="font-family: monospace;">${receipt.admissionNumber}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Contact / मोबाइल नंबर:</span>
        <span class="meta-value">${receipt.studentMobile || '—'}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Course / College (कोर्स/कॉलेज):</span>
        <span class="meta-value">${collegeCourseDisplay}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Room & Bed / कमरा व बेड:</span>
        <span class="meta-value">${roomDisplay}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Billing Period / किराया अवधि:</span>
        <span class="meta-value">${receipt.billingPeriod}</span>
      </div>
    </div>
    
    <div class="rent-stats-grid">
      <div class="stat-card stat-total">
        <span class="stat-title">कुल किराया (Total Rent)</span>
        <span class="stat-num">${currencySymbol} ${Number(receipt.totalRent || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        <span class="stat-desc">कमरा निर्धारित किराया (Monthly Rent)</span>
      </div>

      <div class="stat-card stat-paid">
        <span class="stat-title">जमा राशि (Amount Paid)</span>
        <span class="stat-num text-green">${currencySymbol} ${Number(receipt.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        <span class="stat-desc">वर्तमान भुगतान (Paid in this receipt)</span>
      </div>

      <div class="stat-card stat-balance">
        <span class="stat-title">बकाया किराया (Remaining Rent)</span>
        <span class="stat-num ${Number(receipt.remainingRent || 0) > 0 ? 'text-red' : 'text-green'}">
          ${currencySymbol} ${Number(receipt.remainingRent || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span class="stat-desc">${Number(receipt.remainingRent || 0) > 0 ? 'भुगतान के बाद शेष बकाया' : 'पूर्ण चुकता (Paid in Full)'}</span>
      </div>
    </div>

    <table class="particulars-table">
      <thead>
        <tr>
          <th>विवरण (Description)</th>
          <th class="text-right">कुल किराया (Total Rent)</th>
          <th class="text-right">जमा राशि (Amount Paid)</th>
          <th>माध्यम (Payment Mode)</th>
          <th class="text-right">बकाया किराया (Remaining Rent)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <strong>Hostel Rent & Accommodation Fee</strong><br />
            <span style="font-size: 11px; color: #64748b;">Billing Cycle: ${receipt.billingPeriod}</span>
            ${receipt.roomType ? `<div style="font-size: 10px; color: #475569; margin-top: 2px;">Accommodation Type: ${receipt.roomType}</div>` : ''}
          </td>
          <td class="text-right font-mono" style="font-size: 13px; font-weight: 700; color: #0f172a;">
            ${currencySymbol} ${Number(receipt.totalRent || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>
          <td class="text-right">
            <span class="amount-paid">${currencySymbol} ${Number(receipt.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </td>
          <td>
            <strong>${receipt.paymentMode}</strong><br />
            <span style="font-family: monospace; font-size: 10px; color: #64748b;">${receipt.transactionRef && receipt.transactionRef !== 'N/A' ? receipt.transactionRef : (receipt.paymentMode === 'Cash' ? 'नकद भुगतान (Cash)' : '—')}</span>
          </td>
          <td class="text-right font-mono" style="font-size: 13px; font-weight: 800; color: ${Number(receipt.remainingRent || 0) > 0 ? '#b91c1c' : '#047857'};">
            ${currencySymbol} ${Number(receipt.remainingRent || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>
        </tr>
      </tbody>
    </table>

    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; font-size: 12px;">
      <span style="color: #64748b; font-weight: 700; text-transform: uppercase; font-size: 10px; display: block; margin-bottom: 2px;">शब्दों में राशि (Amount in Words):</span>
      <span style="font-weight: 700; color: #0f172a; font-size: 13px;">${receipt.amountInWords || convertNumberToIndianWords(receipt.amount)}</span>
    </div>

    <div class="summary-strip">
      <div>
        <span style="color: #475569;">वर्तमान बिल शेष किराया (Bill Remaining Rent):</span>
        <strong style="font-family: monospace; color: ${Number(receipt.remainingRent || 0) > 0 ? '#b91c1c' : '#047857'}; margin-left: 6px; font-size: 13px;">
          ${currencySymbol} ${Number(receipt.remainingRent || 0).toFixed(2)}
        </strong>
      </div>
      <div>
        <span style="color: #475569;">छात्र का कुल बकाया (Overall Student Dues):</span>
        <strong style="font-family: monospace; color: ${Number(receipt.overallRemainingDues || 0) > 0 ? '#b91c1c' : '#047857'}; margin-left: 6px; font-size: 13px;">
          ${currencySymbol} ${Number(receipt.overallRemainingDues || 0).toFixed(2)}
        </strong>
      </div>
    </div>

    <div class="footer-section">
      <div>
        <div class="verification-stamp">
          ✓ PAID &bull; VERIFIED
        </div>
        <div style="font-size: 10px; color: #64748b; margin-top: 4px;">
          Payment Mode: ${receipt.paymentMode} &bull; Auth Ref: ${receipt.receiptNumber}
        </div>
      </div>

      <div class="signature-box">
        ${signatureHtml}
        <div class="signature-line"></div>
        <div class="signatory-title">${receipt.authorizedSignature || 'Hostel Warden / Manager'}</div>
        <div style="font-size: 10px; color: #64748b;">Authorized Signatory / अधिकृत हस्ताक्षर</div>
      </div>
    </div>
  </div>

  <script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        try {
          window.focus();
          window.print();
        } catch (e) {
          console.warn('Auto print failed:', e);
        }
      }, 500);
    });
  </script>
</body>
</html>`;
}

// GET /api/payments/receipt/:receiptNumber/print: Public/Direct printable receipt HTML
router.get('/receipt/:receiptNumber/print', (req: Request, res: Response) => {
  try {
    const receiptRow = queryOne<{ receipt_data: string }>(
      'SELECT receipt_data FROM receipts WHERE receipt_number = ?',
      [req.params.receiptNumber]
    );

    if (!receiptRow) {
      res.status(404).send('<h3>रसीद नहीं मिली (Receipt not found)</h3>');
      return;
    }

    const receipt = JSON.parse(receiptRow.receipt_data);
    const settings = queryOne<any>('SELECT * FROM settings LIMIT 1');
    if (settings) {
      if (!receipt.logoData && settings.logo_data) {
        receipt.logoData = settings.logo_data;
      }
      if (!receipt.signatureData && settings.signature_data) {
        receipt.signatureData = settings.signature_data;
      }
      if (!receipt.authorizedSignature && settings.authorized_signature) {
        receipt.authorizedSignature = settings.authorized_signature;
      }
      if (!receipt.currency || receipt.currency === '$') {
        receipt.currency = settings.currency || '₹';
      }
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderReceiptPrintHtml(receipt));
  } catch (err: any) {
    res.status(500).send('<h3>रसीद लोड करने में त्रुटि: ' + err.message + '</h3>');
  }
});

router.use(requireAuth);

// GET /api/payments: List payments
router.get('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { student_id, payment_mode, start_date, end_date, search, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit as string, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    let where: string[] = [];
    let params: any[] = [];

    if (student_id) {
      where.push('p.student_id = ?');
      params.push(student_id);
    }
    if (payment_mode && payment_mode !== 'all') {
      where.push('p.payment_mode = ?');
      params.push(payment_mode);
    }
    if (start_date) {
      where.push('p.payment_date >= ?');
      params.push(start_date);
    }
    if (end_date) {
      where.push('p.payment_date <= ?');
      params.push(end_date);
    }
    if (search && typeof search === 'string' && search.trim()) {
      const q = `%${search.trim()}%`;
      where.push('(p.receipt_number LIKE ? OR s.full_name LIKE ? OR s.admission_number LIKE ? OR p.transaction_ref LIKE ?)');
      params.push(q, q, q, q);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countRow = queryOne<{ count: number }>(
      `SELECT count(*) as count
       FROM payments p
       JOIN students s ON p.student_id = s.id
       ${whereSql}`,
      params
    );
    const total = countRow?.count || 0;

    const payments = queryAll(
      `SELECT p.*,
        s.full_name as student_name, s.admission_number, s.mobile as student_mobile,
        rn.billing_period, rn.room_id, rn.bed_id,
        r.room_number, b.bed_number
       FROM payments p
       JOIN students s ON p.student_id = s.id
       LEFT JOIN rent_records rn ON p.rent_id = rn.id
       LEFT JOIN rooms r ON rn.room_id = r.id
       LEFT JOIN beds b ON rn.bed_id = b.id
       ${whereSql}
       ORDER BY p.payment_date DESC, p.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    const totalCollected = queryOne<{ total: number }>(
      `SELECT coalesce(sum(p.amount), 0) as total
       FROM payments p
       JOIN students s ON p.student_id = s.id
       ${whereSql}`,
      params
    )?.total || 0;

    res.json({
      payments,
      totalCollected,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch payments: ' + err.message });
  }
});

// POST /api/payments: Record a payment
router.post('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { student_id, rent_id, amount, payment_mode, payment_date, transaction_ref, notes } = req.body;

    const payAmount = parseFloat(amount);
    if (isNaN(payAmount) || payAmount <= 0) {
      res.status(400).json({ error: 'Payment amount must be a positive number greater than zero.' });
      return;
    }

    if (!payment_mode) {
      res.status(400).json({ error: 'Payment mode (Cash, UPI, Bank Transfer, Card, Other) is required.' });
      return;
    }

    // 1. Validate student with complete profile details
    const student = queryOne<{
      id: string;
      full_name: string;
      admission_number: string;
      father_name?: string;
      mobile?: string;
      course?: string;
      college?: string;
    }>(
      'SELECT id, full_name, admission_number, father_name, mobile, course, college FROM students WHERE id = ?',
      [student_id]
    );
    if (!student) {
      res.status(404).json({ error: 'Student not found.' });
      return;
    }

    // 2. Validate rent record
    let rentRecord = null;
    if (rent_id) {
      rentRecord = queryOne<{
        id: string;
        student_id: string;
        room_id: string;
        bed_id: string;
        billing_period: string;
        total_amount: number;
        paid_amount: number;
        pending_amount: number;
        status: string;
      }>('SELECT * FROM rent_records WHERE id = ?', [rent_id]);

      if (!rentRecord) {
        res.status(404).json({ error: 'Selected rent bill not found.' });
        return;
      }
      if (rentRecord.student_id !== student_id) {
        res.status(400).json({ error: 'Selected rent bill does not belong to this student.' });
        return;
      }
      if (rentRecord.pending_amount <= 0) {
        res.status(400).json({ error: 'This rent bill has already been fully paid.' });
        return;
      }
      if (payAmount > rentRecord.pending_amount) {
        res.status(400).json({
          error: `Payment amount (₹${payAmount.toFixed(2)}) exceeds the pending balance of this bill (₹${rentRecord.pending_amount.toFixed(2)}).`,
        });
        return;
      }
    } else {
      // Find oldest pending rent bill for this student
      rentRecord = queryOne<{
        id: string;
        student_id: string;
        room_id: string;
        bed_id: string;
        billing_period: string;
        total_amount: number;
        paid_amount: number;
        pending_amount: number;
        status: string;
      }>('SELECT * FROM rent_records WHERE student_id = ? AND pending_amount > 0 ORDER BY billing_month ASC LIMIT 1', [student_id]);
    }

    // Retrieve settings for receipt prefix
    const settings = queryOne<{
      hostel_name: string;
      hostel_address: string;
      phone: string;
      email: string;
      receipt_prefix: string;
      currency: string;
      authorized_signature: string;
      logo_data?: string | null;
      signature_data?: string | null;
    }>('SELECT * FROM settings LIMIT 1');

    const prefix = settings?.receipt_prefix || 'RCP-';
    const timestampStr = Date.now().toString().slice(-6);
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const receiptNumber = `${prefix}${timestampStr}-${randomSuffix}`;

    const paymentId = 'pay_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const now = new Date().toISOString();
    const effectiveDate = payment_date || now.split('T')[0];

    // 3. Insert payment
    runQuery(
      `INSERT INTO payments (
        id, receipt_number, student_id, rent_id, payment_date, amount,
        payment_mode, transaction_ref, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        paymentId,
        receiptNumber,
        student_id,
        rentRecord ? rentRecord.id : null,
        effectiveDate,
        payAmount,
        payment_mode,
        transaction_ref?.trim() || null,
        notes?.trim() || null,
        now,
      ]
    );

    // 4. Update Rent Record if attached, or track rent allocation
    let totalRentAmount = payAmount;
    let previousPending = payAmount;
    let previouslyPaid = 0;
    let newPaid = payAmount;
    let newPending = 0;

    if (rentRecord) {
      totalRentAmount = rentRecord.total_amount;
      previousPending = rentRecord.pending_amount;
      previouslyPaid = rentRecord.paid_amount;
      newPaid = rentRecord.paid_amount + payAmount;
      newPending = Math.max(0, rentRecord.total_amount - newPaid);
      const newStatus = newPending === 0 ? 'paid' : 'partially_paid';

      runQuery(
        'UPDATE rent_records SET paid_amount = ?, pending_amount = ?, status = ?, updated_at = ? WHERE id = ?',
        [newPaid, newPending, newStatus, now, rentRecord.id]
      );
    } else {
      // Check active allocation for student
      const alloc = queryOne<{ id: string; monthly_rent: number; room_id: string; bed_id: string }>(
        'SELECT id, monthly_rent, room_id, bed_id FROM room_allocations WHERE student_id = ? AND status = "active" LIMIT 1',
        [student_id]
      );
      if (alloc && alloc.monthly_rent > 0) {
        totalRentAmount = alloc.monthly_rent;
        previousPending = alloc.monthly_rent;
        previouslyPaid = 0;
        newPaid = payAmount;
        newPending = Math.max(0, totalRentAmount - payAmount);
      }
    }

    // 5. Calculate student's overall outstanding dues
    const totalDuesRow = queryOne<{ dues: number }>(
      'SELECT coalesce(sum(pending_amount), 0) as dues FROM rent_records WHERE student_id = ?',
      [student_id]
    );
    const remainingStudentDues = totalDuesRow?.dues || 0;

    // Room and Bed details for receipt
    let roomNumber = '';
    let bedNumber = '';
    let floor = '';
    let roomType = '';

    if (rentRecord && rentRecord.room_id) {
      const room = queryOne<{ room_number: string; floor: string; room_type: string }>('SELECT room_number, floor, room_type FROM rooms WHERE id = ?', [rentRecord.room_id]);
      const bed = queryOne<{ bed_number: string }>('SELECT bed_number FROM beds WHERE id = ?', [rentRecord.bed_id]);
      if (room) {
        roomNumber = room.room_number;
        floor = room.floor;
        roomType = room.room_type;
      }
      if (bed) bedNumber = bed.bed_number;
    }

    // Fallback: If not found via rent record, query student active or past room allocation
    if (!roomNumber) {
      const alloc = queryOne<{ room_number: string; bed_number: string; floor: string; room_type: string }>(
        `SELECT r.room_number, b.bed_number, r.floor, r.room_type
         FROM room_allocations a
         JOIN rooms r ON a.room_id = r.id
         JOIN beds b ON a.bed_id = b.id
         WHERE a.student_id = ? AND a.status = 'active'
         ORDER BY a.created_at DESC LIMIT 1`,
        [student_id]
      );
      if (alloc) {
        roomNumber = alloc.room_number;
        bedNumber = alloc.bed_number;
        floor = alloc.floor;
        roomType = alloc.room_type;
      } else {
        const pastAlloc = queryOne<{ room_number: string; bed_number: string; floor: string; room_type: string }>(
          `SELECT r.room_number, b.bed_number, r.floor, r.room_type
           FROM room_allocations a
           JOIN rooms r ON a.room_id = r.id
           JOIN beds b ON a.bed_id = b.id
           WHERE a.student_id = ?
           ORDER BY a.created_at DESC LIMIT 1`,
          [student_id]
        );
        if (pastAlloc) {
          roomNumber = pastAlloc.room_number;
          bedNumber = pastAlloc.bed_number;
          floor = pastAlloc.floor;
          roomType = pastAlloc.room_type;
        }
      }
    }

    let cleanPeriod = rentRecord?.billing_period;
    if (!cleanPeriod) {
      const d = new Date(effectiveDate);
      cleanPeriod = d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    }

    const cleanTransactionRef = transaction_ref?.trim()
      ? transaction_ref.trim()
      : (payment_mode === 'Cash' ? 'नकद भुगतान (Cash)' : '—');

    const amountInWords = convertNumberToIndianWords(payAmount);

    // 6. Generate and save receipt payload
    const receiptData = {
      receiptNumber,
      rentId: rentRecord ? rentRecord.id : null,
      paymentDate: effectiveDate,
      studentName: student.full_name,
      admissionNumber: student.admission_number,
      studentMobile: student.mobile || '',
      fatherName: student.father_name || '',
      course: student.course || '',
      college: student.college || '',
      roomNumber: roomNumber || 'आवंटित नहीं (Unassigned)',
      bedNumber: bedNumber || '—',
      floor: floor || '',
      roomType: roomType || '',
      billingPeriod: cleanPeriod,
      totalRent: totalRentAmount,
      amount: payAmount,
      previouslyPaid: previouslyPaid,
      totalPaid: newPaid,
      remainingRent: newPending,
      amountInWords,
      paymentMode: payment_mode,
      transactionRef: cleanTransactionRef,
      previousPending: previousPending,
      billRemainingBalance: newPending,
      overallRemainingDues: remainingStudentDues,
      hostelName: settings?.hostel_name || 'Hostel Management System',
      hostelAddress: settings?.hostel_address || '',
      phone: settings?.phone || '',
      email: settings?.email || '',
      currency: settings?.currency || '₹',
      authorizedSignature: settings?.authorized_signature || 'Hostel Warden / Manager',
      logoData: settings?.logo_data || null,
      signatureData: settings?.signature_data || null,
      notes: notes || '',
    };

    const receiptId = 'rcp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    runQuery(
      `INSERT INTO receipts (id, payment_id, receipt_number, student_id, receipt_data, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [receiptId, paymentId, receiptNumber, student_id, JSON.stringify(receiptData), now]
    );

    logAudit(
      'PAYMENT_RECORDED',
      `Payment of ₹${payAmount} recorded for ${student.full_name} (${receiptNumber}) via ${payment_mode}`,
      req.user!.id,
      req.user!.username,
      req.ip
    );

    res.status(201).json({
      success: true,
      message: `Payment of ₹${payAmount.toFixed(2)} recorded successfully. Receipt #${receiptNumber} generated.`,
      paymentId,
      receiptNumber,
      receipt: receiptData,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to record payment: ' + err.message });
  }
});

// GET /api/payments/receipt/:receiptNumber
router.get('/receipt/:receiptNumber', (req: AuthenticatedRequest, res: Response) => {
  try {
    const receiptRow = queryOne<{ receipt_data: string }>(
      'SELECT receipt_data FROM receipts WHERE receipt_number = ?',
      [req.params.receiptNumber]
    );

    if (!receiptRow) {
      res.status(404).json({ error: 'Receipt not found.' });
      return;
    }

    const rawReceipt = JSON.parse(receiptRow.receipt_data);
    const receipt = enrichReceiptPayload(rawReceipt);
    const settings = queryOne<any>('SELECT * FROM settings LIMIT 1');
    if (settings) {
      if (!receipt.logoData && settings.logo_data) {
        receipt.logoData = settings.logo_data;
      }
      if (!receipt.signatureData && settings.signature_data) {
        receipt.signatureData = settings.signature_data;
      }
      if (!receipt.authorizedSignature && settings.authorized_signature) {
        receipt.authorizedSignature = settings.authorized_signature;
      }
      if (!receipt.currency || receipt.currency === '$') {
        receipt.currency = settings.currency || '₹';
      }
    }

    res.json({ receipt });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch receipt: ' + err.message });
  }
});

export default router;

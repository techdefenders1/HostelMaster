import { Receipt } from '../types';

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

/**
 * Builds a standalone, print-ready HTML string for the receipt.
 */
export function getReceiptFullHtml(receipt: Receipt): string {
  const currencySymbol = receipt.currency || '₹';
  const logoHtml = receipt.logoData
    ? `<img src="${receipt.logoData}" alt="${receipt.hostelName || 'Hostel Logo'}" style="max-height: 56px; max-width: 180px; object-fit: contain;" />`
    : `<div style="width: 44px; height: 44px; border-radius: 10px; background: #4f46e5; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 20px;">H</div>`;

  const signatureHtml = receipt.signatureData
    ? `<div style="text-align: right; margin-bottom: 4px;">
        <img src="${receipt.signatureData}" alt="Manager Signature" style="max-height: 48px; max-width: 160px; object-fit: contain; display: inline-block;" />
       </div>`
    : `<div style="height: 38px;"></div>`;

  const isRoomAllocated = receipt.roomNumber && receipt.roomNumber !== 'N/A' && !receipt.roomNumber.includes('आवंटित नहीं');
  const roomDisplay = isRoomAllocated
    ? `कमरा: Room ${receipt.roomNumber} &bull; बेड: ${receipt.bedNumber || '—'}${receipt.floor ? ` (${receipt.floor})` : ''}`
    : 'आवंटित नहीं (General / Direct)';

  const studentFatherDisplay = receipt.fatherName ? ` <span style="font-size: 11px; font-weight: 500; color: #475569;">(S/o श्री ${receipt.fatherName})</span>` : '';
  const collegeCourseDisplay = [receipt.course, receipt.college].filter(Boolean).join(' - ') || '—';
  const amountWords = receipt.amountInWords || convertNumberToIndianWords(receipt.amount);
  const cleanTxnRef = receipt.transactionRef && receipt.transactionRef !== 'N/A'
    ? receipt.transactionRef
    : (receipt.paymentMode === 'Cash' ? 'नकद भुगतान (Cash)' : '—');

  const totalRentAmount = receipt.totalRent !== undefined && receipt.totalRent > 0
    ? receipt.totalRent
    : (receipt.amount + (receipt.billRemainingBalance || 0));
  const remainingRentAmount = receipt.remainingRent !== undefined
    ? receipt.remainingRent
    : (receipt.billRemainingBalance !== undefined ? receipt.billRemainingBalance : Math.max(0, totalRentAmount - receipt.amount));

  return `<!DOCTYPE html>
<html lang="hi">
  <head>
    <meta charset="utf-8" />
    <title>Rent Receipt #${receipt.receiptNumber}</title>
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
        background: #ffffff;
        font-size: 13px;
        line-height: 1.45;
        padding: 16px;
      }
      .receipt-container {
        max-width: 720px;
        margin: 0 auto;
        border: 2px solid #0f172a;
        border-radius: 12px;
        padding: 20px;
        background: #ffffff;
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
        font-size: 19px;
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
        font-size: 13px;
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
        padding: 12px 14px;
        margin-bottom: 14px;
      }
      .meta-label {
        font-size: 10px;
        text-transform: uppercase;
        font-weight: 700;
        color: #64748b;
        display: block;
        margin-bottom: 2px;
      }
      .meta-value {
        font-weight: 700;
        color: #0f172a;
      }
      .particulars-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 14px;
      }
      .particulars-table th {
        background: #0f172a;
        color: #ffffff;
        font-size: 11px;
        text-transform: uppercase;
        font-weight: 700;
        padding: 8px 12px;
        text-align: left;
      }
      .particulars-table th.text-right {
        text-align: right;
      }
      .particulars-table td {
        padding: 10px 12px;
        border-bottom: 1px solid #e2e8f0;
        font-size: 12px;
      }
      .particulars-table td.text-right {
        text-align: right;
      }
      .amount-paid {
        font-family: monospace;
        font-size: 15px;
        font-weight: 800;
        color: #047857;
      }
      .rent-stats-grid {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 12px;
        margin-bottom: 14px;
      }
      .stat-card {
        border: 1.5px solid #e2e8f0;
        border-radius: 8px;
        padding: 10px 12px;
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
        font-size: 16px;
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
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        padding: 10px 14px;
        margin-bottom: 16px;
        font-size: 12px;
      }
      .footer-section {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        padding-top: 12px;
        border-top: 2px dashed #cbd5e1;
      }
      .verification-stamp {
        border: 2px solid #059669;
        color: #059669;
        font-size: 10px;
        font-weight: 800;
        padding: 5px 10px;
        border-radius: 6px;
        text-transform: uppercase;
        display: inline-block;
      }
      .signature-box {
        text-align: right;
        min-width: 160px;
      }
      .signature-line {
        width: 160px;
        border-bottom: 1.5px solid #334155;
        margin-bottom: 4px;
        margin-left: auto;
      }
      .signatory-title {
        font-size: 11px;
        font-weight: 700;
        color: #1e293b;
      }
      .print-actions-bar {
        text-align: center;
        margin-bottom: 16px;
      }
      @media print {
        .print-actions-bar {
          display: none !important;
        }
        body {
          padding: 0 !important;
        }
      }
    </style>
  </head>
  <body>
    <div class="print-actions-bar">
      <button onclick="window.print()" style="padding: 8px 18px; font-size: 13px; font-weight: 700; background: #4f46e5; color: white; border: none; border-radius: 8px; cursor: pointer; margin-right: 8px;">
        🖨️ प्रिंट करें (Print Dialog)
      </button>
      <button onclick="window.close()" style="padding: 8px 16px; font-size: 13px; font-weight: 600; background: #334155; color: white; border: none; border-radius: 8px; cursor: pointer;">
        ✕ विंडो बंद करें (Close)
      </button>
    </div>

    <div class="receipt-container">
      <div class="header-row">
        <div class="brand-col">
          ${logoHtml}
          <div class="hostel-info">
            <h1>${receipt.hostelName || 'Hostel Accommodation'}</h1>
            <p>${receipt.hostelAddress || 'Official Residence Facility'}</p>
            <p>Phone: ${receipt.phone || '—'} &bull; Email: ${receipt.email || '—'}</p>
          </div>
        </div>
        <div class="receipt-badge-col">
          <span class="badge">Official Rent Receipt</span>
          <div class="rcp-number"># ${receipt.receiptNumber}</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
            Date: <strong>${receipt.paymentDate}</strong>
          </div>
        </div>
      </div>

      <div class="meta-grid">
        <div>
          <div style="margin-bottom: 8px;">
            <span class="meta-label">Student Name / छात्र का नाम:</span>
            <span class="meta-value" style="font-size: 13px;">${receipt.studentName}${studentFatherDisplay}</span>
          </div>
          <div style="margin-bottom: 8px;">
            <span class="meta-label">Admission Number / नामांकन सं.:</span>
            <span class="meta-value" style="font-family: monospace;">${receipt.admissionNumber}</span>
          </div>
          <div>
            <span class="meta-label">Contact / मोबाइल नंबर:</span>
            <span class="meta-value">${receipt.studentMobile || '—'}</span>
          </div>
        </div>

        <div>
          <div style="margin-bottom: 8px;">
            <span class="meta-label">Allocated Room & Bed / कमरा व बेड:</span>
            <span class="meta-value">${roomDisplay}</span>
          </div>
          <div style="margin-bottom: 8px;">
            <span class="meta-label">Billing Period / किराया अवधि:</span>
            <span class="meta-value">${receipt.billingPeriod}</span>
          </div>
          <div>
            <span class="meta-label">Course / College (कोर्स/कॉलेज):</span>
            <span class="meta-value">${collegeCourseDisplay}</span>
          </div>
        </div>
      </div>

      <div class="rent-stats-grid">
        <div class="stat-card stat-total">
          <span class="stat-title">कुल किराया (Total Rent)</span>
          <span class="stat-num">${currencySymbol} ${totalRentAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          <span class="stat-desc">कमरा निर्धारित किराया (Monthly Rent)</span>
        </div>

        <div class="stat-card stat-paid">
          <span class="stat-title">जमा राशि (Amount Paid)</span>
          <span class="stat-num text-green">${currencySymbol} ${receipt.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          <span class="stat-desc">वर्तमान भुगतान (Paid in this receipt)</span>
        </div>

        <div class="stat-card stat-balance">
          <span class="stat-title">बकाया किराया (Remaining Rent)</span>
          <span class="stat-num ${remainingRentAmount > 0 ? 'text-red' : 'text-green'}">
            ${currencySymbol} ${remainingRentAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span class="stat-desc">${remainingRentAmount > 0 ? 'भुगतान के बाद शेष बकाया' : 'पूर्ण चुकता (Paid in Full)'}</span>
        </div>
      </div>

      <table class="particulars-table">
        <thead>
          <tr>
            <th>Description / विवरण</th>
            <th class="text-right">Total Rent / कुल किराया</th>
            <th class="text-right">Amount Paid / जमा राशि</th>
            <th>Mode / माध्यम</th>
            <th class="text-right">Remaining / शेष किराया</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>Hostel Rent & Accommodation Fee</strong><br />
              <span style="font-size: 11px; color: #64748b;">Billing Cycle: ${receipt.billingPeriod}</span>
              ${receipt.roomType ? `<div style="font-size: 10px; color: #475569; margin-top: 2px;">Room Type: ${receipt.roomType}</div>` : ''}
            </td>
            <td class="text-right font-mono" style="font-size: 13px; font-weight: 700; color: #0f172a;">
              ${currencySymbol} ${totalRentAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
            <td class="text-right">
              <span class="amount-paid">${currencySymbol} ${receipt.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </td>
            <td>
              <strong>${receipt.paymentMode}</strong><br />
              <span style="font-family: monospace; font-size: 10px; color: #64748b;">${cleanTxnRef}</span>
            </td>
            <td class="text-right font-mono" style="font-size: 13px; font-weight: 800; color: ${remainingRentAmount > 0 ? '#b91c1c' : '#047857'};">
              ${currencySymbol} ${remainingRentAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
          </tr>
        </tbody>
      </table>

      <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; font-size: 12px;">
        <span style="color: #64748b; font-weight: 700; text-transform: uppercase; font-size: 10px; display: block; margin-bottom: 2px;">शब्दों में राशि (Amount in Words):</span>
        <span style="font-weight: 700; color: #0f172a; font-size: 13px;">${amountWords}</span>
      </div>

      <div class="summary-strip">
        <div>
          <span style="color: #475569;">वर्तमान बिल शेष किराया (Bill Remaining Rent):</span>
          <strong style="font-family: monospace; color: ${remainingRentAmount > 0 ? '#b91c1c' : '#047857'}; margin-left: 6px; font-size: 13px;">
            ${currencySymbol} ${remainingRentAmount.toFixed(2)}
          </strong>
        </div>
        <div>
          <span style="color: #475569;">छात्र का कुल बकाया (Overall Student Dues):</span>
          <strong style="font-family: monospace; color: ${receipt.overallRemainingDues > 0 ? '#b91c1c' : '#047857'}; margin-left: 6px; font-size: 13px;">
            ${currencySymbol} ${receipt.overallRemainingDues.toFixed(2)}
          </strong>
        </div>
      </div>

      <div class="footer-section">
        <div>
          <div class="verification-stamp">
            &check; PAID &bull; VERIFIED
          </div>
          <div style="font-size: 10px; color: #64748b; margin-top: 4px;">
            Payment Mode: ${receipt.paymentMode} &bull; Auth Token: ${receipt.receiptNumber}
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
      // Automatically trigger print dialog when page loads in new tab
      window.onload = function() {
        setTimeout(function() {
          try {
            window.focus();
            window.print();
          } catch (e) {
            console.warn('Auto print failed:', e);
          }
        }, 300);
      };
    </script>
  </body>
</html>`;
}

/**
 * Triggers the browser's native print dialog synchronously for the on-screen container.
 * Keeps user activation token intact so browsers/iframes don't block the dialog.
 */
export function printReceiptContainer(containerId = 'printable-receipt'): void {
  const container = document.getElementById(containerId);
  if (!container) {
    window.focus();
    window.print();
    return;
  }

  // 1. Immediately add printing-receipt class to body for CSS print rules
  document.body.classList.add('printing-receipt');

  const cleanup = () => {
    document.body.classList.remove('printing-receipt');
    window.removeEventListener('afterprint', cleanup);
  };

  window.addEventListener('afterprint', cleanup);

  // 2. Synchronous call to window.print() inside the click user gesture
  try {
    window.focus();
    window.print();
  } catch (err) {
    console.warn('Direct window.print encountered an error:', err);
  } finally {
    // Safety cleanup in case afterprint does not fire
    setTimeout(cleanup, 2000);
  }
}

/**
 * Opens a clean, standalone printable receipt in a new tab and triggers window.print().
 * Completely circumvents any iframe sandbox restrictions (e.g. lack of 'allow-modals').
 */
export function openReceiptInNewTab(receipt: Receipt): void {
  const html = getReceiptFullHtml(receipt);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  // Create temporary anchor to open in new tab
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Revoke object URL after delay
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/**
 * Programmatic receipt printing utility for printing receipt data directly
 */
export function printReceipt(receipt: Receipt): void {
  const existingContainer = document.getElementById('printable-receipt');
  if (existingContainer) {
    printReceiptContainer('printable-receipt');
    return;
  }
  openReceiptInNewTab(receipt);
}

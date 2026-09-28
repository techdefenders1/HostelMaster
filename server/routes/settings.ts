import express, { Response } from 'express';
import { requireAuth, AuthenticatedRequest, logAudit } from '../auth.js';
import { queryOne, runQuery } from '../db.js';

const router = express.Router();
router.use(requireAuth);

// GET /api/settings: Get system settings
router.get('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    let settings = queryOne<any>('SELECT * FROM settings LIMIT 1');
    if (!settings) {
      settings = {
        hostel_name: 'Sunrise Executive Hostel',
        hostel_address: '104 University Boulevard, Campus Town, CA 90210',
        phone: '+1 (555) 234-5678',
        email: 'admin@sunrisehostel.com',
        website: 'https://sunrisehostel.example.com',
        currency: '₹',
        date_format: 'YYYY-MM-DD',
        default_rent: 550,
        receipt_prefix: 'RCP-',
        invoice_prefix: 'INV-',
        late_fee: 25,
        authorized_signature: 'Hostel Warden / Manager',
        logo_data: null,
        signature_data: null,
      };
    } else {
      if (settings.currency === '$' || !settings.currency) {
        settings.currency = '₹';
      }
    }
    res.json({ settings });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch settings: ' + err.message });
  }
});

// PUT /api/settings: Update system settings
router.put('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      hostel_name,
      hostel_address,
      phone,
      email,
      website,
      logo_data,
      signature_data,
      currency,
      date_format,
      default_rent,
      receipt_prefix,
      invoice_prefix,
      late_fee,
      authorized_signature,
    } = req.body;

    if (!hostel_name || !hostel_name.trim()) {
      res.status(400).json({ error: 'Hostel name is required.' });
      return;
    }

    const rent = parseFloat(default_rent) || 500;
    const lFee = parseFloat(late_fee) || 0;

    const existing = queryOne<{ id: string }>('SELECT id FROM settings LIMIT 1');
    const settingsId = existing ? existing.id : 'default_settings';

    if (existing) {
      runQuery(
        `UPDATE settings SET
          hostel_name = ?, hostel_address = ?, phone = ?, email = ?,
          website = ?, logo_data = ?, signature_data = ?, currency = ?,
          date_format = ?, default_rent = ?, receipt_prefix = ?,
          invoice_prefix = ?, late_fee = ?, authorized_signature = ?
         WHERE id = ?`,
        [
          hostel_name.trim(),
          hostel_address?.trim() || '',
          phone?.trim() || '',
          email?.trim() || '',
          website?.trim() || '',
          logo_data || null,
          signature_data || null,
          currency || '₹',
          date_format || 'YYYY-MM-DD',
          rent,
          receipt_prefix?.trim() || 'RCP-',
          invoice_prefix?.trim() || 'INV-',
          lFee,
          authorized_signature?.trim() || 'Hostel Warden / Manager',
          settingsId,
        ]
      );
    } else {
      runQuery(
        `INSERT INTO settings (
          id, hostel_name, hostel_address, phone, email, website, logo_data, signature_data,
          currency, date_format, default_rent, receipt_prefix, invoice_prefix,
          late_fee, authorized_signature
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          settingsId,
          hostel_name.trim(),
          hostel_address?.trim() || '',
          phone?.trim() || '',
          email?.trim() || '',
          website?.trim() || '',
          logo_data || null,
          signature_data || null,
          currency || '₹',
          date_format || 'YYYY-MM-DD',
          rent,
          receipt_prefix?.trim() || 'RCP-',
          invoice_prefix?.trim() || 'INV-',
          lFee,
          authorized_signature?.trim() || 'Hostel Warden / Manager',
        ]
      );
    }

    logAudit('SETTINGS_UPDATED', `Updated hostel settings: ${hostel_name}`, req.user!.id, req.user!.username, req.ip);

    res.json({ success: true, message: 'Hostel configuration saved successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update settings: ' + err.message });
  }
});

export default router;

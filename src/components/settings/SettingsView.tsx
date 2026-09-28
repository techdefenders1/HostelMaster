import React, { useState, useEffect, useRef } from 'react';
import { api, ApiError } from '../../api/client';
import { SystemSettings } from '../../types';
import { TwoFactorSettingsCard } from '../security/TwoFactorSettingsCard';
import { useAuth } from '../../context/AuthContext';
import { useBranding } from '../../context/BrandingContext';
import {
  Settings,
  Save,
  CheckCircle,
  AlertCircle,
  Building,
  Upload,
  Trash2,
  FileSignature,
  FileText,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  ImageIcon
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { twoFactorEnabled } = useAuth();
  const { updateBranding } = useBranding();
  const [activeTab, setActiveTab] = useState<'general' | '2fa'>('general');

  const [settings, setSettings] = useState<SystemSettings>({
    hostel_name: '',
    hostel_address: '',
    phone: '',
    email: '',
    website: '',
    logo_data: '',
    signature_data: '',
    currency: '₹',
    date_format: 'YYYY-MM-DD',
    default_rent: 550,
    receipt_prefix: 'RCP-',
    invoice_prefix: 'INV-',
    late_fee: 25,
    authorized_signature: 'Hostel Warden / Manager',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const res = await api.get<{ settings: SystemSettings }>('/settings');
      setSettings({
        ...res.settings,
        currency: res.settings.currency === '$' || !res.settings.currency ? '₹' : res.settings.currency,
      });
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Failed to load settings.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Handle Logo file upload
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError('Logo file size should be less than 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setSettings((prev) => ({ ...prev, logo_data: result }));
      setSuccess('हॉस्टल लोगो लोड हो गया है। स्थायी रूप से सेव करने के लिए नीचे "सेव करें" दबाएं।');
    };
    reader.readAsDataURL(file);
  };

  // Handle Signature file upload
  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError('Signature file size should be less than 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setSettings((prev) => ({ ...prev, signature_data: result }));
      setSuccess('मैनेजर सिग्नेचर लोड हो गया है। स्थायी रूप से सेव करने के लिए नीचे "सेव करें" दबाएं।');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setSettings((prev) => ({ ...prev, logo_data: '' }));
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const handleRemoveSignature = () => {
    setSettings((prev) => ({ ...prev, signature_data: '' }));
    if (signatureInputRef.current) signatureInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await api.put('/settings', settings);
      updateBranding(settings);
      setSuccess('हॉस्टल सेटिंग्स, लोगो और सिग्नेचर सफलतापूर्वक सुरक्षित हो गए हैं।');
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="py-12 text-center text-slate-400 text-xs">Loading hostel configuration...</div>;
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Title & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-400" />
            Hostel System Settings & Security
          </h2>
          <p className="text-xs text-slate-400">
            हॉस्टल प्रोफ़ाइल, लोगो, मैनेजर सिग्नेचर, मुद्रा (₹) व 2FA सुरक्षा सेटिंग्स
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex p-1 bg-slate-900 border border-slate-800 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              activeTab === 'general'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            हॉस्टल सेटिंग्स (General)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('2fa')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${
              activeTab === '2fa'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {twoFactorEnabled ? (
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>गूगल 2FA (Authenticator)</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {success && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* TAB 2: GOOGLE AUTHENTICATOR / 2FA */}
      {activeTab === '2fa' ? (
        <TwoFactorSettingsCard />
      ) : (
        /* TAB 1: GENERAL HOSTEL SETTINGS */
        <div className="space-y-6">
          {/* Quick 2FA status strip */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div
                className={`p-2 rounded-xl border ${
                  twoFactorEnabled
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                }`}
              >
                {twoFactorEnabled ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
              </div>
              <div>
                <span className="text-xs font-semibold text-white block">
                  Google Authenticator (2FA): {twoFactorEnabled ? 'चालू है (Active)' : 'बंद है (Disabled)'}
                </span>
                <span className="text-[11px] text-slate-400">
                  {twoFactorEnabled
                    ? 'लॉगिन करते समय 6-digit OTP कोड आवश्यक है।'
                    : 'टू-फैक्टर ऑथेंटिकेशन चालू करने और QR कोड देखने के लिए यहाँ क्लिक करें।'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('2fa')}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-indigo-300 hover:text-white rounded-xl border border-slate-700 transition flex items-center gap-1.5 self-start sm:self-center"
            >
              <span>{twoFactorEnabled ? '2FA सेटिंग्स देखें' : '2FA चालू करें'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* BRANDING: LOGO & SIGNATURE UPLOADS */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-6 shadow-sm">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                <ImageIcon className="w-4 h-4 text-indigo-400" />
                हॉस्टल लोगो एवं मैनेजर सिग्नेचर (Branding & Authorized Signatures)
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. HOSTEL LOGO */}
                <div className="bg-slate-950/70 border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-indigo-400" />
                        हॉस्टल लोगो (Hostel Logo)
                      </span>
                      {settings.logo_data && (
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>हटाएं</span>
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mb-3">
                      यह लोगो आपके साइडबार, हेडर और सभी <strong>रेंट रसीदों (Rent Receipts)</strong> के शीर्ष पर दिखेगा।
                    </p>

                    {/* Logo Preview */}
                    <div className="h-28 bg-slate-900 rounded-xl border border-dashed border-slate-700 flex items-center justify-center p-3 mb-3">
                      {settings.logo_data ? (
                        <img
                          src={settings.logo_data}
                          alt="Hostel Logo"
                          className="max-h-full max-w-full object-contain rounded"
                        />
                      ) : (
                        <div className="text-center text-slate-500">
                          <ImageIcon className="w-7 h-7 mx-auto mb-1 text-slate-600" />
                          <span className="text-[11px] block">कोई लोगो अपलोड नहीं है</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                      id="hostel-logo-upload"
                    />
                    <label
                      htmlFor="hostel-logo-upload"
                      className="cursor-pointer w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 transition text-center"
                    >
                      <Upload className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{settings.logo_data ? 'नया लोगो अपलोड करें' : 'लोगो फोटो चुनें (PNG, JPG)'}</span>
                    </label>
                  </div>
                </div>

                {/* 2. MANAGER SIGNATURE */}
                <div className="bg-slate-950/70 border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                        <FileSignature className="w-3.5 h-3.5 text-emerald-400" />
                        मैनेजर सिग्नेचर (Manager Signature)
                      </span>
                      {settings.signature_data && (
                        <button
                          type="button"
                          onClick={handleRemoveSignature}
                          className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>हटाएं</span>
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mb-3">
                      यह सिग्नेचर रेंट रसीद पर <strong>"अधिकृत हस्ताक्षर (Authorized Signatory)"</strong> के ऊपर प्रिंट होगी।
                    </p>

                    {/* Signature Preview */}
                    <div className="h-28 bg-white/95 rounded-xl border border-dashed border-slate-700 flex items-center justify-center p-3 mb-3">
                      {settings.signature_data ? (
                        <img
                          src={settings.signature_data}
                          alt="Manager Signature"
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <div className="text-center text-slate-400">
                          <FileSignature className="w-7 h-7 mx-auto mb-1 text-slate-400" />
                          <span className="text-[11px] block text-slate-500">कोई सिग्नेचर अपलोड नहीं है</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <input
                      ref={signatureInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleSignatureUpload}
                      className="hidden"
                      id="manager-signature-upload"
                    />
                    <label
                      htmlFor="manager-signature-upload"
                      className="cursor-pointer w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 transition text-center"
                    >
                      <Upload className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{settings.signature_data ? 'नया सिग्नेचर बदलें' : 'सिग्नेचर फोटो अपलोड करें (PNG/JPG)'}</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Hostel Profile Details */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-sm">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                <Building className="w-4 h-4 text-indigo-400" />
                हॉस्टल जानकारी (Hostel Profile Details)
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Hostel Legal Name *</label>
                  <input
                    type="text"
                    required
                    value={settings.hostel_name}
                    onChange={(e) => setSettings({ ...settings, hostel_name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Hostel Website URL</label>
                  <input
                    type="url"
                    value={settings.website}
                    onChange={(e) => setSettings({ ...settings, website: e.target.value })}
                    placeholder="https://hostel.example.com"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Hostel Physical Address</label>
                <textarea
                  rows={2}
                  value={settings.hostel_address}
                  onChange={(e) => setSettings({ ...settings, hostel_address: e.target.value })}
                  placeholder="Street, City, State, PIN"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Official Support Phone</label>
                  <input
                    type="tel"
                    value={settings.phone}
                    onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Official Support Email</label>
                  <input
                    type="email"
                    value={settings.email}
                    onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Financial & Document Configuration */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-sm">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                <FileText className="w-4 h-4 text-indigo-400" />
                मुद्रा (Currency ₹), रसीद उपसर्ग और बिलिंग नियम
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    करेंसी चिन्ह (Currency Symbol)
                  </label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      maxLength={5}
                      value={settings.currency}
                      onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                      className="w-24 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500 font-mono text-center font-bold text-base"
                    />
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, currency: '₹' })}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${
                        settings.currency === '₹'
                          ? 'bg-indigo-600 text-white border-indigo-500'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                      }`}
                    >
                      ₹ (INR)
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    पूरे सिस्टम में रुपीस (₹) डिफ़ॉल्ट रूप से सक्रिय है।
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Receipt Number Prefix</label>
                  <input
                    type="text"
                    value={settings.receipt_prefix}
                    onChange={(e) => setSettings({ ...settings, receipt_prefix: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Invoice Number Prefix</label>
                  <input
                    type="text"
                    value={settings.invoice_prefix}
                    onChange={(e) => setSettings({ ...settings, invoice_prefix: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Default Monthly Rent (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={settings.default_rent}
                    onChange={(e) => setSettings({ ...settings, default_rent: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Default Late Fee (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={settings.late_fee}
                    onChange={(e) => setSettings({ ...settings, late_fee: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  अधिकृत हस्ताक्षरकर्ता पदनाम (Authorized Receipt Signatory Title)
                </label>
                <input
                  type="text"
                  value={settings.authorized_signature}
                  onChange={(e) => setSettings({ ...settings, authorized_signature: e.target.value })}
                  placeholder="उदा. Hostel Warden / Manager / Authorized Administrator"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center space-x-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/25 transition cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'सुरक्षित हो रहा है...' : 'सेटिंग्स व बदलाव सेव करें (Save Configuration)'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

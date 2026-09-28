import React, { useState, useEffect } from 'react';
import { useAuth, Setup2FAData } from '../../context/AuthContext';
import { api, ApiError } from '../../api/client';
import {
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  Copy,
  Check,
  Download,
  AlertTriangle,
  CheckCircle2,
  Lock,
  RefreshCw,
  Power,
  KeyRound,
  LifeBuoy
} from 'lucide-react';

export const TwoFactorSettingsCard: React.FC = () => {
  const { twoFactorEnabled, enable2FAInit, enable2FAConfirm, disable2FA } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Enabling 2FA setup state
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [setupData, setSetupData] = useState<Setup2FAData | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);

  // Disabling 2FA state
  const [isDisabling, setIsDisabling] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');

  // Reconfiguring state
  const [isReconfiguring, setIsReconfiguring] = useState(false);
  const [reconfPassword, setReconfPassword] = useState('');

  const clearAlerts = () => {
    setError(null);
    setSuccess(null);
  };

  // Start Enable 2FA flow (Generates QR Code)
  const handleStartSetup = async () => {
    clearAlerts();
    setIsLoading(true);
    try {
      const data = await enable2FAInit();
      setSetupData(data);
      setIsSettingUp(true);
      setIsDisabling(false);
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'QR कोड जनरेट करने में त्रुटि हुई।');
    } finally {
      setIsLoading(false);
    }
  };

  // Confirm 2FA setup with 6-digit code
  const handleConfirmSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupData || verifyCode.trim().length !== 6) return;
    clearAlerts();
    setIsLoading(true);
    try {
      await enable2FAConfirm(setupData.setupToken, verifyCode.trim());
      setSuccess('Google Authenticator सफलतापूर्वक चालू हो गया है! अब लॉगिन करते समय आपको यह 6-अंकों का कोड दर्ज करना होगा।');
      setIsSettingUp(false);
      setSetupData(null);
      setVerifyCode('');
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'अमान्य कोड। कृपया Google Authenticator में नया कोड देखें।');
    } finally {
      setIsLoading(false);
    }
  };

  // Turn OFF 2FA
  const handleDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disablePassword) return;
    clearAlerts();
    setIsLoading(true);
    try {
      await disable2FA(disablePassword);
      setSuccess('टू-फैक्टर ऑथेंटिकेशन बंद कर दिया गया है। अब आप सीधे यूजरनेम और पासवर्ड से लॉगिन कर सकेंगे।');
      setIsDisabling(false);
      setDisablePassword('');
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'पासवर्ड गलत है।');
    } finally {
      setIsLoading(false);
    }
  };

  // Copy manual secret key
  const handleCopyKey = () => {
    if (!setupData) return;
    navigator.clipboard.writeText(setupData.manualKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  // Copy recovery codes
  const handleCopyCodes = () => {
    if (!setupData) return;
    navigator.clipboard.writeText(setupData.recoveryCodes.join('\n'));
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 2000);
  };

  // Download recovery codes as file
  const handleDownloadCodes = () => {
    if (!setupData) return;
    const content = `HostelMaster - 2FA Recovery Codes\nGenerated: ${new Date().toISOString()}\n\n` +
      setupData.recoveryCodes.join('\n') +
      `\n\nKeep these codes safe! Each code can be used once if you lose access to Google Authenticator.`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hostelmaster-recovery-codes-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-start sm:items-center space-x-3.5">
          <div className={`p-3 rounded-2xl border ${
            twoFactorEnabled
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
          }`}>
            {twoFactorEnabled ? <ShieldCheck className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">Google Authenticator (2FA)</h3>
              <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full ${
                twoFactorEnabled
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}>
                {twoFactorEnabled ? 'चालू है (ACTIVE)' : 'बंद है (OFF)'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {twoFactorEnabled
                ? 'आपका खाता सुरक्षित है। लॉगिन करते समय Google Authenticator का 6-digit OTP कोड डालना अनिवार्य है।'
                : 'वर्तमान में 2FA बंद है। आप सीधे यूजरनेम और पासवर्ड से लॉगिन कर सकते हैं। सुरक्षा बढ़ाने के लिए इसे चालू करें।'}
            </p>
          </div>
        </div>

        {/* Action Toggle Button */}
        <div>
          {!twoFactorEnabled ? (
            <button
              type="button"
              onClick={handleStartSetup}
              disabled={isLoading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition flex items-center gap-2 shadow-lg shadow-emerald-600/20"
            >
              {isLoading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Smartphone className="w-3.5 h-3.5" />
              )}
              <span>2FA चालू करें (Enable 2FA)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIsDisabling(!isDisabling);
                setIsSettingUp(false);
                clearAlerts();
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-red-600/20 hover:text-red-300 hover:border-red-500/40 text-slate-300 text-xs font-medium rounded-xl border border-slate-700 transition flex items-center gap-2"
            >
              <Power className="w-3.5 h-3.5" />
              <span>{isDisabling ? 'रद्द करें' : '2FA बंद करें (Disable)'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {success && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 flex items-start space-x-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300 flex items-start space-x-2.5">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* DISABLE 2FA FORM (When 2FA is currently ON) */}
      {isDisabling && twoFactorEnabled && (
        <form onSubmit={handleDisable2FA} className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3 max-w-md">
          <div className="flex items-center gap-2 text-xs font-semibold text-red-300">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span>टू-फैक्टर ऑथेंटिकेशन बंद करें</span>
          </div>
          <p className="text-[11px] text-slate-400">
            सुरक्षा पुष्टि के लिए अपना वर्तमान पासवर्ड दर्ज करें। बंद करने के बाद अगली बार केवल यूजरनेम और पासवर्ड से लॉगिन होगा।
          </p>
          <div>
            <input
              type="password"
              required
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              placeholder="वर्तमान पासवर्ड दर्ज करें"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isLoading || !disablePassword}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition"
            >
              {isLoading ? 'प्रोसेसिंग...' : 'पुष्टि करें और 2FA बंद करें'}
            </button>
            <button
              type="button"
              onClick={() => setIsDisabling(false)}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl"
            >
              रद्द करें
            </button>
          </div>
        </form>
      )}

      {/* SETUP 2FA FORM (Shows QR Code & Verifies) */}
      {isSettingUp && setupData && (
        <div className="p-5 bg-slate-950 rounded-2xl border border-indigo-500/30 space-y-6">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-indigo-400" />
              <span>Google Authenticator सेट करें (QR Code स्कैन करें)</span>
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              नीचे दिए गए चरणों का पालन करें और अपने फ़ोन में Google Authenticator कॉन्फ़िगर करें:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* Step 1: QR Code */}
            <div className="flex flex-col items-center p-4 bg-slate-900 rounded-xl border border-slate-800 text-center">
              <div className="p-3 bg-white rounded-xl shadow-md mb-3">
                <img src={setupData.qrCodeUrl} alt="Google Authenticator QR Code" className="w-44 h-44" />
              </div>
              <span className="text-[11px] font-semibold text-slate-300 mb-1">
                चरण 1: Google Authenticator ऐप से यह QR कोड स्कैन करें
              </span>
              <p className="text-[10px] text-slate-400 mb-2">
                Google Authenticator में (+) पर टैप करें &gt; 'Scan a QR code' चुनें।
              </p>

              {/* Manual Key Fallback */}
              <div className="w-full mt-2 pt-2 border-t border-slate-800 text-left">
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                  <span>यदि स्कैन नहीं हो रहा (मैनुअल की):</span>
                  <button
                    type="button"
                    onClick={handleCopyKey}
                    className="text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 font-medium"
                  >
                    {copiedKey ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey ? 'कॉपी हो गया' : 'कुंजी कॉपी करें'}</span>
                  </button>
                </div>
                <div className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-indigo-300 break-all select-all text-center">
                  {setupData.manualKey}
                </div>
              </div>
            </div>

            {/* Step 2 & 3: Verification Code & Recovery Codes */}
            <div className="space-y-4">
              {/* Verification Code Input */}
              <form onSubmit={handleConfirmSetup} className="p-4 bg-slate-900 rounded-xl border border-slate-800 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-white mb-1">
                    चरण 2: Google Authenticator से 6-अंकों का कोड दर्ज करें *
                  </label>
                  <p className="text-[11px] text-slate-400 mb-2">
                    ऐप में दिख रहा 6-digit कोड डालें ताकि पुष्टि हो सके कि सेटअप सही है।
                  </p>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={verifyCode}
                      onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="000000"
                      required
                      autoFocus
                      className="w-full pl-10 pr-4 text-center tracking-[0.35em] text-xl font-mono py-2 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={isLoading || verifyCode.length !== 6}
                    className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition shadow-md"
                  >
                    {isLoading ? 'सत्यापित किया जा रहा है...' : 'सत्यापित करें और 2FA चालू करें'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSettingUp(false);
                      setSetupData(null);
                      setVerifyCode('');
                    }}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl"
                  >
                    रद्द करें
                  </button>
                </div>
              </form>

              {/* Recovery Codes Box */}
              <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                    <LifeBuoy className="w-3.5 h-3.5" />
                    बैकअप रिकवरी कोड्स (Recovery Codes)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyCodes}
                      className="text-[11px] text-slate-400 hover:text-white inline-flex items-center gap-1"
                    >
                      {copiedCodes ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedCodes ? 'कॉपी हो गया' : 'कॉपी करें'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadCodes}
                      className="text-[11px] text-slate-400 hover:text-white inline-flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      <span>डाउनलोड</span>
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400">
                  यदि फ़ोन गुम या खराब हो जाए, तो इनमें से किसी एक कोड से आप लॉगिन कर सकेंगे:
                </p>
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  {setupData.recoveryCodes.map((code, idx) => (
                    <div
                      key={idx}
                      className="px-2 py-1 bg-slate-950 border border-slate-800 rounded font-mono text-[11px] text-slate-300 text-center tracking-wider select-all"
                    >
                      {code}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

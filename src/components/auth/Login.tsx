import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useBranding } from '../../context/BrandingContext';
import {
  Lock,
  User,
  KeyRound,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  LifeBuoy,
  Eye,
  EyeOff,
  UserPlus,
  LogIn,
  Hotel,
  CheckCircle2,
  ArrowLeft,
  Sparkles
} from 'lucide-react';

export const Login: React.FC = () => {
  const {
    initialized,
    mode,
    login,
    loginStep2,
    cancelStep2,
    register,
    error,
    successMessage,
    isLoading,
    clearMessages,
  } = useAuth();
  const { logo, hostelName } = useBranding();

  // Active tab: 'login' or 'register'
  // When system has 0 users (uninitialized), default directly to 'register'!
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(initialized === false ? 'register' : 'login');

  React.useEffect(() => {
    if (initialized === false) {
      setActiveTab('register');
    }
  }, [initialized]);

  // Form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // 2FA step state
  const [totpCode, setTotpCode] = useState('');
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    if (initialized === false) {
      setActiveTab('register');
      return;
    }
    if (!username.trim() || !password) return;
    await login(username.trim(), password);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    if (!username.trim() || !password || !confirmPassword) return;
    await register(username.trim(), password, confirmPassword);
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    const code = useRecoveryCode ? recoveryCode.trim() : totpCode.trim();
    if (!code) return;
    await loginStep2(code);
  };

  // If in Step 2 (Google Authenticator Code Prompt)
  if (mode === 'login_step2') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 p-6 sm:p-8 relative">
          <button
            type="button"
            onClick={cancelStep2}
            className="absolute top-6 left-6 inline-flex items-center text-xs text-slate-400 hover:text-white transition gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>लॉगिन पर वापस जाएं</span>
          </button>

          <div className="text-center mt-6 mb-6">
            <div className="inline-flex p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl mb-3 border border-emerald-500/20">
              <ShieldCheck className="w-8 h-8 text-emerald-400" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Google Authenticator</h1>
            <p className="text-slate-400 text-xs mt-1">
              टू-फैक्टर ऑथेंटिकेशन (2FA) कोड दर्ज करें
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start space-x-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}

          {successMessage && !error && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start space-x-2.5 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleStep2Submit} className="space-y-5">
            {!useRecoveryCode ? (
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  6-अंकों का Google Authenticator कोड
                </label>
                <p className="text-[11px] text-slate-400 mb-3">
                  अपने मोबाइल में Google Authenticator ऐप खोलें और current 6-digit OTP डालें।
                </p>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    required
                    autoFocus
                    className="w-full pl-10 pr-4 text-center tracking-[0.4em] text-2xl font-mono py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  One-Time Recovery Code (रिकवरी कोड)
                </label>
                <p className="text-[11px] text-slate-400 mb-3">
                  अपना 8-character बैकअप रिकवरी कोड दर्ज करें (जैसे: 4A8B-9F2C)।
                </p>
                <div className="relative">
                  <LifeBuoy className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400" />
                  <input
                    type="text"
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                    placeholder="XXXX-XXXX"
                    required
                    autoFocus
                    className="w-full pl-10 pr-4 text-center tracking-widest text-base font-mono py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || (!useRecoveryCode ? totpCode.length !== 6 : !recoveryCode)}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:opacity-60 text-white font-semibold rounded-xl shadow-lg shadow-emerald-600/20 transition-all text-xs flex items-center justify-center space-x-2"
            >
              {isLoading ? (
                <span>सत्यापित किया जा रहा है...</span>
              ) : (
                <>
                  <span>सत्यापित करें और लॉगिन करें</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => {
                  setUseRecoveryCode(!useRecoveryCode);
                  clearMessages();
                }}
                className="text-xs text-indigo-400 hover:text-indigo-300 underline"
              >
                {useRecoveryCode
                  ? 'Google Authenticator 6-digit कोड का उपयोग करें'
                  : 'फ़ोन खो गया? बैकअप रिकवरी कोड का उपयोग करें'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Unified Auth Screen: Tab 1 = Login Account, Tab 2 = Create Account
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 p-6 sm:p-8">
        {/* Brand Header */}
        <div className="text-center mb-6">
          {logo ? (
            <div className="inline-flex p-2 bg-white/5 rounded-2xl mb-3 border border-slate-700 shadow-md max-h-16 max-w-40 items-center justify-center">
              <img src={logo} alt={hostelName} className="max-h-12 max-w-full object-contain" />
            </div>
          ) : (
            <div className="inline-flex p-3 bg-indigo-600/10 text-indigo-400 rounded-2xl mb-3 border border-indigo-500/20 shadow-md">
              <Hotel className="w-8 h-8" />
            </div>
          )}
          <h1 className="text-2xl font-bold text-white tracking-tight">{hostelName || 'HostelMaster'}</h1>
          <p className="text-slate-400 text-xs mt-1">
            हॉस्टल मैनेजमेंट सिस्टम &bull; Hostel Management Portal
          </p>
        </div>

        {/* First-time setup banner when database has 0 users */}
        {initialized === false && (
          <div className="mb-5 p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-xs shadow-inner">
            <div className="flex items-start gap-2.5">
              <Sparkles className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-indigo-300 text-xs uppercase tracking-wide">प्रारंभिक सेटअप (Fresh Setup Mode)</h4>
                <p className="text-slate-300 text-[11px] mt-0.5 leading-relaxed">
                  डेटाबेस में अभी कोई अकाउंट मौजूद नहीं है। कृपया नीचे दिए गए फॉर्म से अपना नया एडमिन अकाउंट बनाएं।
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab Switcher: Login Account / Create Account */}
        <div className="flex p-1 bg-slate-950 rounded-2xl border border-slate-800 mb-6">
          <button
            type="button"
            onClick={() => {
              setActiveTab('login');
              clearMessages();
            }}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === 'login'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>लॉगिन अकाउंट (Login)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('register');
              clearMessages();
            }}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === 'register'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>क्रिएट अकाउंट (Register)</span>
          </button>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start space-x-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-300">{error}</p>
          </div>
        )}

        {successMessage && !error && (
          <div className="mb-5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start space-x-2.5 text-xs text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {activeTab === 'login' ? (
          /* TAB 1: LOGIN ACCOUNT */
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {initialized === false && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center justify-between">
                <span>डेटाबेस में अभी कोई अकाउंट नहीं है।</span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('register');
                    clearMessages();
                  }}
                  className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-bold rounded-lg ml-2 shrink-0"
                >
                  नया अकाउंट बनाएं →
                </button>
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                यूजरनेम (Username)
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="अपना यूजरनेम दर्ज करें"
                  required
                  autoFocus
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                पासवर्ड (Password)
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="पासवर्ड दर्ज करें"
                  required
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading || !username.trim() || !password}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:opacity-60 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/25 transition-all text-xs flex items-center justify-center space-x-2"
              >
                {isLoading ? (
                  <span>लॉगिन किया जा रहा है...</span>
                ) : (
                  <>
                    <span>लॉगिन करें (Sign In)</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>

            <div className="text-center pt-2">
              <span className="text-xs text-slate-400">नया अकाउंट बनाना चाहते हैं? </span>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('register');
                  clearMessages();
                }}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold underline"
              >
                क्रिएट अकाउंट पर जाएं
              </button>
            </div>
          </form>
        ) : (
          /* TAB 2: CREATE ACCOUNT */
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            {initialized === false && (
              <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-300">
                ⭐ <strong>मुख्य व्यवस्थापक (Super Admin):</strong> यह आपका पहला एडमिनिस्ट्रेटर अकाउंट होगा जिसके पास पूरे सिस्टम का नियंत्रण होगा।
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {initialized === false ? 'नया एडमिन यूजरनेम (Admin Username) *' : 'नया यूजरनेम (Username) *'}
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="कम से कम 3 अक्षर (e.g. admin)"
                  required
                  autoFocus
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                पासवर्ड (Password) *
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="कम से कम 8 अक्षर (1 Upper, 1 Lower, 1 Number, 1 Special)"
                  required
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                नियम: कम से कम 8 अक्षर, एक बड़ा अक्षर (A-Z), एक छोटा (a-z), एक नंबर (0-9) और विशेष चिह्न (@, #, $)।
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                कन्फर्म पासवर्ड (Confirm Password) *
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="पासवर्ड दोबारा दर्ज करें"
                  required
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-[11px] text-indigo-300">
              💡 अकाउंट बनने के बाद सीधे लॉगिन हो जाएगा। टू-फैक्टर ऑथेंटिकेशन (Google Authenticator) आप अंदर सेटिंग में जाकर कभी भी चालू कर सकते हैं।
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading || !username.trim() || !password || !confirmPassword}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:opacity-60 text-white font-semibold rounded-xl shadow-lg shadow-emerald-600/25 transition-all text-xs flex items-center justify-center space-x-2"
              >
                {isLoading ? (
                  <span>अकाउंट बनाया जा रहा है...</span>
                ) : (
                  <>
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>{initialized === false ? 'नया एडमिन अकाउंट बनाएं और शुरू करें' : 'क्रिएट अकाउंट और लॉगिन करें'}</span>
                  </>
                )}
              </button>
            </div>

            <div className="text-center pt-2">
              <span className="text-xs text-slate-400">पहले से अकाउंट है? </span>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('login');
                  clearMessages();
                }}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold underline"
              >
                लॉगिन करें (Sign In)
              </button>
            </div>
          </form>
        )}

        <div className="mt-6 pt-5 border-t border-slate-800 text-center">
          <p className="text-[11px] text-slate-500">
            सुरक्षित हॉस्टल मैनेजमेंट सिस्टम &bull; Secure Session Protection
          </p>
        </div>
      </div>
    </div>
  );
};

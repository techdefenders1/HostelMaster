import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useBranding } from '../../context/BrandingContext';
import { LogOut, User, Shield, Menu } from 'lucide-react';

interface NavbarProps {
  onToggleSidebar: () => void;
  activeModuleTitle: string;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar, activeModuleTitle }) => {
  const { user, logout, twoFactorEnabled } = useAuth();
  const { logo, hostelName } = useBranding();

  return (
    <header className="bg-slate-900 border-b border-slate-800 h-16 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30">
      <div className="flex items-center space-x-3 min-w-0">
        <button
          onClick={onToggleSidebar}
          className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 lg:hidden shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>

        {logo && (
          <div className="w-7 h-7 rounded-lg bg-white/5 border border-slate-700 p-0.5 hidden sm:flex items-center justify-center shrink-0">
            <img src={logo} alt={hostelName} className="max-w-full max-h-full object-contain" />
          </div>
        )}

        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
            {activeModuleTitle}
          </h1>
        </div>
      </div>

      <div className="flex items-center space-x-3 shrink-0">
        <div className="hidden sm:flex items-center space-x-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/60">
          <div className={`w-2 h-2 rounded-full ${twoFactorEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          <span className="text-xs text-slate-300 font-medium flex items-center gap-1">
            <Shield className={`w-3.5 h-3.5 ${twoFactorEnabled ? 'text-emerald-400' : 'text-amber-400'}`} />
            {twoFactorEnabled ? '2FA Active' : '2FA Off'}
          </span>
        </div>

        <div className="flex items-center space-x-2 pl-2 border-l border-slate-800">
          <div className="flex items-center space-x-2 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700/60">
            <User className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-semibold text-white">{user?.username}</span>
            <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded font-mono uppercase">
              {user?.role}
            </span>
          </div>

          <button
            onClick={logout}
            title="Log Out"
            className="p-2 text-slate-400 hover:text-red-400 rounded-xl hover:bg-red-500/10 transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

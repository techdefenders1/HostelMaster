import React from 'react';
import { useBranding } from '../../context/BrandingContext';
import {
  LayoutDashboard,
  Users,
  Building2,
  Receipt,
  IndianRupee,
  TrendingDown,
  BarChart3,
  Settings,
  ShieldAlert,
  Database,
  History,
  X,
  Hotel
} from 'lucide-react';

export type NavModule =
  | 'dashboard'
  | 'students'
  | 'rooms'
  | 'rent'
  | 'dues'
  | 'expenses'
  | 'reports'
  | 'settings'
  | 'security'
  | 'backups'
  | 'audit';

interface SidebarProps {
  currentModule: NavModule;
  onSelectModule: (module: NavModule) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentModule,
  onSelectModule,
  isOpen,
  onClose,
}) => {
  const { logo, hostelName } = useBranding();

  const navItems: { id: NavModule; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'students', label: 'Students', icon: Users },
    { id: 'rooms', label: 'Rooms & Beds', icon: Building2 },
    { id: 'rent', label: 'Rent & Payments', icon: Receipt },
    { id: 'dues', label: 'Student Dues', icon: IndianRupee },
    { id: 'expenses', label: 'Expenses', icon: TrendingDown },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'settings', label: 'Hostel Settings', icon: Settings },
    { id: 'security', label: 'Security & 2FA', icon: ShieldAlert },
    { id: 'backups', label: 'Backup & Restore', icon: Database },
    { id: 'audit', label: 'Audit Logs', icon: History },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-xs"
        />
      )}

      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 w-64 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800">
          <div className="flex items-center space-x-3 overflow-hidden">
            {logo ? (
              <div className="w-9 h-9 rounded-xl bg-white/5 border border-slate-700/80 p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                <img src={logo} alt={hostelName} className="max-w-full max-h-full object-contain" />
              </div>
            ) : (
              <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-600/30 shrink-0">
                <Hotel className="w-5 h-5" />
              </div>
            )}
            <div className="truncate">
              <span className="font-bold text-white text-sm tracking-tight block truncate" title={hostelName}>
                {hostelName}
              </span>
              <span className="text-[10px] text-indigo-400 font-medium block">
                Hostel Management
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentModule === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectModule(item.id);
                  onClose();
                }}
                className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer info */}
        <div className="p-4 border-t border-slate-800/80 text-center">
          <div className="text-[11px] text-slate-500 font-mono">
            HostelMaster v2.4 Pro
          </div>
          <div className="text-[10px] text-slate-600 mt-0.5">
            SQLite Database &bull; TOTP Secured
          </div>
        </div>
      </aside>
    </>
  );
};

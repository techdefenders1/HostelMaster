import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BrandingProvider } from './context/BrandingContext';
import { Login } from './components/auth/Login';
import { Navbar } from './components/layout/Navbar';
import { Sidebar, NavModule } from './components/layout/Sidebar';
import { Dashboard } from './components/dashboard/Dashboard';
import { StudentsView } from './components/students/StudentsView';
import { RoomsView } from './components/rooms/RoomsView';
import { RentView } from './components/rent/RentView';
import { DuesView } from './components/dues/DuesView';
import { ExpensesView } from './components/expenses/ExpensesView';
import { ReportsView } from './components/reports/ReportsView';
import { SettingsView } from './components/settings/SettingsView';
import { SecurityView } from './components/security/SecurityView';
import { BackupView } from './components/backup/BackupView';
import { AuditLogsView } from './components/audit/AuditLogsView';
import { RefreshCw } from 'lucide-react';

const MODULE_TITLES: Record<NavModule, string> = {
  dashboard: 'Dashboard Overview',
  students: 'Student Records Management',
  rooms: 'Rooms & Bed Allocations',
  rent: 'Rent Billing & Receipts',
  dues: 'Outstanding Dues Tracker',
  expenses: 'Operational Expense Management',
  reports: 'Hostel Intelligence & Reports',
  settings: 'Hostel System Configuration & 2FA Setup',
  security: 'Security & Two-Factor Authentication',
  backups: 'Database Snapshots & Disaster Recovery',
  audit: 'Administrative Audit Trail',
};

const MainApp: React.FC = () => {
  const { mode } = useAuth();
  const [currentModule, setCurrentModule] = useState<NavModule>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // 1. Initial State / Loading
  if (mode === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 text-indigo-400">
            <RefreshCw className="w-8 h-8 animate-spin" />
          </div>
          <div className="text-center">
            <h3 className="text-white font-bold text-base">HostelMaster</h3>
            <p className="text-slate-400 text-xs mt-1">सुरक्षित डेटाबेस और सत्र सत्यापन...</p>
          </div>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated: Shows Login & Create Account, or Step 2 (Google Authenticator TOTP)
  if (mode !== 'authenticated') {
    return <Login />;
  }

  // 3. Authenticated Dashboard & Management Suite
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Sidebar */}
      <Sidebar
        currentModule={currentModule}
        onSelectModule={(mod) => setCurrentModule(mod)}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:pl-64 min-w-0">
        <Navbar
          activeModuleTitle={MODULE_TITLES[currentModule]}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {currentModule === 'dashboard' && <Dashboard onNavigate={(m) => setCurrentModule(m)} />}
          {currentModule === 'students' && <StudentsView />}
          {currentModule === 'rooms' && <RoomsView />}
          {currentModule === 'rent' && <RentView />}
          {currentModule === 'dues' && <DuesView />}
          {currentModule === 'expenses' && <ExpensesView />}
          {currentModule === 'reports' && <ReportsView />}
          {currentModule === 'settings' && <SettingsView />}
          {currentModule === 'security' && <SecurityView />}
          {currentModule === 'backups' && <BackupView />}
          {currentModule === 'audit' && <AuditLogsView />}
        </main>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrandingProvider>
        <MainApp />
      </BrandingProvider>
    </AuthProvider>
  );
};

export default App;

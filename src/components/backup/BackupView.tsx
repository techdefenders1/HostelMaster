import React, { useState, useEffect } from 'react';
import { api, ApiError } from '../../api/client';
import { BackupItem } from '../../types';
import {
  Database,
  Download,
  RotateCcw,
  Trash2,
  Plus,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  Clock,
  HardDrive
} from 'lucide-react';

export const BackupView: React.FC = () => {
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [restoringFilename, setRestoringFilename] = useState<string | null>(null);
  const [backupToDelete, setBackupToDelete] = useState<{ id: string; filename: string } | null>(null);
  const [backupToRestore, setBackupToRestore] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchBackups = async () => {
    setIsLoading(true);
    try {
      const res = await api.get<{ backups: BackupItem[] }>('/backups');
      setBackups(res.backups);
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Failed to fetch backups.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const handleCreateBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await api.post('/backups', { notes });
      setSuccess(`Backup created successfully: ${res.backup.filename}`);
      setNotes('');
      fetchBackups();
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Backup creation failed.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRestoreBackup = (filename: string) => {
    setBackupToRestore(filename);
  };

  const handleConfirmRestoreBackup = async () => {
    if (!backupToRestore) return;
    const filename = backupToRestore;
    setRestoringFilename(filename);
    setError(null);
    setSuccess(null);
    setBackupToRestore(null);

    try {
      const res = await api.post('/backups/restore', { filename });
      setSuccess(res.message);
      fetchBackups();
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Restore operation failed.');
    } finally {
      setRestoringFilename(null);
    }
  };

  const handleDeleteBackup = (id: string, filename: string) => {
    setBackupToDelete({ id, filename });
  };

  const handleConfirmDeleteBackup = async () => {
    if (!backupToDelete) return;
    try {
      await api.delete(`/backups/${backupToDelete.id}`);
      setSuccess(`Backup file "${backupToDelete.filename}" deleted.`);
      setBackupToDelete(null);
      fetchBackups();
    } catch (err: any) {
      setError('Failed to delete backup.');
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Database className="w-5 h-5 text-indigo-400" />
          Database Backup & Disaster Recovery
        </h2>
        <p className="text-xs text-slate-400">
          Create snapshots of hostel database, review backups & safely restore with automatic safety pre-snapshots
        </p>
      </div>

      {success && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300 flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Create Backup Box */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-sm">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
          <HardDrive className="w-4 h-4 text-indigo-400" />
          Create New Snapshot
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Captures complete relational state: students, rooms, beds, allocations, rent invoices, receipts, audit logs, and settings.
        </p>

        <form onSubmit={handleCreateBackup} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Backup notes (e.g. Pre-month end closing snapshot)"
            className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={isCreating}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/20 flex items-center justify-center gap-1.5 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isCreating ? 'Creating Snapshot...' : 'Create Backup'}</span>
          </button>
        </form>
      </div>

      {/* Backups List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider text-slate-400">
            Available Database Backups ({backups.length})
          </h3>
          <span className="text-[11px] text-slate-500">Stored in server storage</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/60 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Backup Filename</th>
                <th className="py-3 px-4">Created Date & Time</th>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4">Notes</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Loading backups list...
                  </td>
                </tr>
              ) : backups.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No database backups found. Click "Create Backup" above.
                  </td>
                </tr>
              ) : (
                backups.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3.5 px-4 font-mono font-semibold text-white">
                      {b.filename}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                      {new Date(b.created_at).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-300">
                      {(b.file_size / 1024).toFixed(1)} KB
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">{b.notes || '—'}</td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleRestoreBackup(b.filename)}
                          disabled={restoringFilename === b.filename}
                          title="Restore from this backup"
                          className="px-2.5 py-1 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 rounded-lg border border-amber-500/30 text-[11px] font-medium flex items-center gap-1 transition"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>{restoringFilename === b.filename ? 'Restoring...' : 'Restore'}</span>
                        </button>
                        <button
                          onClick={() => handleDeleteBackup(b.id, b.filename)}
                          title="Delete backup"
                          className="p-1 hover:bg-slate-800 text-slate-400 hover:text-red-400 rounded-lg transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Restore Confirmation Modal */}
      {backupToRestore && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-amber-400">
              <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">डेटाबेस रीस्टोर करें (Restore Database)</h3>
                <p className="text-xs text-slate-400">बैकअप फ़ाइल से डेटा पुनर्स्थापित करें</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-2">
              <span className="text-slate-500 block">फ़ाइल (Target Backup):</span>
              <span className="font-mono font-bold text-amber-300 block break-all">{backupToRestore}</span>
              <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-800">
                सुरक्षा नोट: रीस्टोर करने से पहले मौजूदा लाइव डेटा का एक ऑटोमैटिक सेफ्टी स्नैपशॉट अपने आप बन जाएगा।
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setBackupToRestore(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition cursor-pointer"
              >
                रद्द करें (Cancel)
              </button>
              <button
                type="button"
                onClick={handleConfirmRestoreBackup}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-amber-600/20 transition flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>हाँ, रीस्टोर करें (Restore)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Backup Confirmation Modal */}
      {backupToDelete && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-red-400">
              <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">बैकअप फ़ाइल हटाएं (Delete Backup)</h3>
                <p className="text-xs text-slate-400">यह बैकअप संग्रह से फ़ाइल को हटा देगा।</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300">
              <span className="text-slate-500 block">फ़ाइल नाम:</span>
              <span className="font-mono text-white text-xs block break-all font-semibold mt-1">{backupToDelete.filename}</span>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setBackupToDelete(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition cursor-pointer"
              >
                रद्द करें (Cancel)
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteBackup}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-red-600/20 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>हाँ, हटाएं (Delete)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

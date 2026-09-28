import React, { useState, useEffect } from 'react';
import { api, ApiError } from '../../api/client';
import { Student } from '../../types';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Eye,
  Edit,
  Trash2,
  Phone,
  Building,
  GraduationCap,
  Calendar,
  X,
  CheckCircle,
  AlertCircle,
  Clock,
  ShieldCheck,
  CreditCard,
  BedDouble,
  DollarSign
} from 'lucide-react';

export const StudentsView: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalStudents, setTotalStudents] = useState(0);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [viewingStudentId, setViewingStudentId] = useState<string | null>(null);
  const [studentDetails, setStudentDetails] = useState<any | null>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [isDeletingStudent, setIsDeletingStudent] = useState(false);

  // Form state
  const initialFormState = {
    admission_number: '',
    full_name: '',
    father_name: '',
    mother_name: '',
    mobile: '',
    alternate_mobile: '',
    email: '',
    dob: '',
    gender: 'Male',
    address: '',
    city: '',
    state: '',
    pincode: '',
    college: '',
    course: '',
    year_semester: '',
    admission_date: new Date().toISOString().split('T')[0],
    guardian_name: '',
    guardian_mobile: '',
    id_proof_type: 'National ID / Aadhaar',
    id_proof_number: '',
    notes: '',
  };

  const [formData, setFormData] = useState(initialFormState);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchStudents = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: '15',
        status: statusFilter,
        search,
      });
      const res = await api.get<{ students: Student[]; pagination: any }>(`/students?${queryParams.toString()}`);
      setStudents(res.students);
      setTotalPages(res.pagination.totalPages || 1);
      setTotalStudents(res.pagination.total || 0);
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Failed to load students.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [page, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchStudents();
  };

  const handleOpenAdd = () => {
    setEditingStudent(null);
    const prefix = 'ADM-' + new Date().getFullYear() + '-';
    const rand = Math.floor(100 + Math.random() * 900);
    setFormData({ ...initialFormState, admission_number: `${prefix}${rand}` });
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      admission_number: student.admission_number,
      full_name: student.full_name,
      father_name: student.father_name || '',
      mother_name: student.mother_name || '',
      mobile: student.mobile,
      alternate_mobile: student.alternate_mobile || '',
      email: student.email || '',
      dob: student.dob || '',
      gender: student.gender || 'Male',
      address: student.address || '',
      city: student.city || '',
      state: student.state || '',
      pincode: student.pincode || '',
      college: student.college || '',
      course: student.course || '',
      year_semester: student.year_semester || '',
      admission_date: student.admission_date,
      guardian_name: student.guardian_name || '',
      guardian_mobile: student.guardian_mobile || '',
      id_proof_type: student.id_proof_type || 'National ID / Aadhaar',
      id_proof_number: student.id_proof_number || '',
      notes: student.notes || '',
    });
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);

    try {
      if (editingStudent) {
        await api.put(`/students/${editingStudent.id}`, formData);
        setSuccess(`Student "${formData.full_name}" profile updated.`);
      } else {
        await api.post('/students', formData);
        setSuccess(`Student "${formData.full_name}" registered successfully.`);
      }
      setIsAddModalOpen(false);
      fetchStudents();
    } catch (err: any) {
      setFormError(err instanceof ApiError ? err.message : 'Operation failed.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleViewProfile = async (studentId: string) => {
    setViewingStudentId(studentId);
    setIsDetailsLoading(true);
    try {
      const details = await api.get(`/students/${studentId}`);
      setStudentDetails(details);
    } catch (err: any) {
      setError('Failed to fetch student profile.');
    } finally {
      setIsDetailsLoading(false);
    }
  };

  const handleToggleStatus = async (student: Student, newStatus: string) => {
    try {
      await api.post(`/students/${student.id}/status`, { status: newStatus });
      setSuccess(`Status of ${student.full_name} changed to ${newStatus}.`);
      fetchStudents();
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Failed to update student status.');
    }
  };

  const handleDeleteStudent = (student: Student) => {
    setStudentToDelete(student);
  };

  const handleConfirmDeleteStudent = async () => {
    if (!studentToDelete) return;
    setIsDeletingStudent(true);
    try {
      await api.delete(`/students/${studentToDelete.id}`);
      setSuccess(`छात्र "${studentToDelete.full_name}" (${studentToDelete.admission_number}) और संबंधित रिकॉर्ड्स हटा दिए गए हैं।`);
      setStudentToDelete(null);
      fetchStudents();
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Cannot delete student.');
    } finally {
      setIsDeletingStudent(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            Student Management
          </h2>
          <p className="text-xs text-slate-400">
            Registered students directory ({totalStudents} Total Records)
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/25 transition"
        >
          <UserPlus className="w-4 h-4" />
          <span>Register New Student</span>
        </button>
      </div>

      {success && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filters and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row gap-3 items-center justify-between shadow-sm">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, admission #, mobile, college..."
            className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </form>

        <div className="flex items-center space-x-3 w-full md:w-auto">
          <div className="flex items-center space-x-1.5 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <span>Status:</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="bg-slate-800 border border-slate-700 text-xs text-white rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="vacated">Vacated</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {/* Students Data Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/60 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Admission #</th>
                <th className="py-3 px-4">Room & Bed</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">College / Course</th>
                <th className="py-3 px-4">Admission Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Loading student directory...
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No students found matching current criteria.
                  </td>
                </tr>
              ) : (
                students.map((student) => {
                  const alloc = student.currentAllocation;
                  return (
                    <tr key={student.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white">{student.full_name}</div>
                        <div className="text-[11px] text-slate-400">{student.gender}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-indigo-300 font-medium">
                        {student.admission_number}
                      </td>
                      <td className="py-3.5 px-4">
                        {alloc ? (
                          <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-indigo-500/10 text-indigo-300 rounded-lg border border-indigo-500/20 font-mono text-[11px]">
                            <BedDouble className="w-3 h-3 text-indigo-400" />
                            <span>Room {alloc.room_number} &bull; {alloc.bed_number}</span>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">No Active Bed</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1 text-slate-300">
                          <Phone className="w-3 h-3 text-slate-500" />
                          <span>{student.mobile}</span>
                        </div>
                        {student.email && (
                          <div className="text-[10px] text-slate-500 truncate max-w-[140px]">
                            {student.email}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-slate-300 font-medium truncate max-w-[160px]">
                          {student.college || '—'}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[160px]">
                          {student.course} {student.year_semester ? `(${student.year_semester})` : ''}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">
                        {student.admission_date}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                            student.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : student.status === 'vacated'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-slate-700 text-slate-300'
                          }`}
                        >
                          {student.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => handleViewProfile(student.id)}
                            title="View Full Profile & Statement"
                            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-indigo-400 rounded-lg transition"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(student)}
                            title="Edit Student Information"
                            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 rounded-lg transition"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteStudent(student)}
                            title="Delete Student"
                            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-red-400 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-3 bg-slate-800/40 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>
              Page {page} of {totalPages} ({totalStudents} students total)
            </span>
            <div className="flex space-x-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded-lg text-white font-medium"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded-lg text-white font-medium"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Student Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-400" />
                {editingStudent ? 'Edit Student Details' : 'Register New Student'}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-xs text-red-300 rounded-xl">
                {formError}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Admission Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.admission_number}
                    onChange={(e) => setFormData({ ...formData, admission_number: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Admission Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.admission_date}
                    onChange={(e) => setFormData({ ...formData, admission_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Mobile Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    placeholder="+1 (555) 000-0000"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Alternate Mobile
                  </label>
                  <input
                    type="tel"
                    value={formData.alternate_mobile}
                    onChange={(e) => setFormData({ ...formData, alternate_mobile: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="student@example.com"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={formData.dob}
                    onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Gender
                  </label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Guardian Name
                  </label>
                  <input
                    type="text"
                    value={formData.guardian_name}
                    onChange={(e) => setFormData({ ...formData, guardian_name: e.target.value })}
                    placeholder="Parent / Guardian"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Guardian Mobile
                  </label>
                  <input
                    type="tel"
                    value={formData.guardian_mobile}
                    onChange={(e) => setFormData({ ...formData, guardian_mobile: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    College / Institute
                  </label>
                  <input
                    type="text"
                    value={formData.college}
                    onChange={(e) => setFormData({ ...formData, college: e.target.value })}
                    placeholder="University Name"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Course & Semester
                  </label>
                  <input
                    type="text"
                    value={formData.course}
                    onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                    placeholder="e.g. B.Tech Computer Science, Sem 3"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    ID Proof Type & Number
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={formData.id_proof_type}
                      onChange={(e) => setFormData({ ...formData, id_proof_type: e.target.value })}
                      className="px-2 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="National ID / Aadhaar">National ID / Aadhaar</option>
                      <option value="Passport">Passport</option>
                      <option value="Driver License">Driver License</option>
                      <option value="College Student ID">College Student ID</option>
                    </select>
                    <input
                      type="text"
                      value={formData.id_proof_number}
                      onChange={(e) => setFormData({ ...formData, id_proof_number: e.target.value })}
                      placeholder="ID Number"
                      className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Permanent Address
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Street, City, State, ZIP"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Additional Notes
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Medical conditions, food preferences, remarks..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl border border-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/20 transition"
                >
                  {formSubmitting ? 'Saving...' : editingStudent ? 'Update Student' : 'Save & Register'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Student Complete Profile & Ledger History Modal */}
      {viewingStudentId && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-indigo-400" />
                Student Comprehensive Record
              </h3>
              <button
                onClick={() => {
                  setViewingStudentId(null);
                  setStudentDetails(null);
                }}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isDetailsLoading || !studentDetails ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                Loading student records...
              </div>
            ) : (
              <div className="space-y-6">
                {/* Header card with financial overview */}
                <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                  <div className="md:col-span-2">
                    <h4 className="text-base font-bold text-white">{studentDetails.student.full_name}</h4>
                    <p className="text-xs text-indigo-300 font-mono mt-0.5">
                      Admission #{studentDetails.student.admission_number} &bull; Mobile: {studentDetails.student.mobile}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {studentDetails.student.college || 'No college noted'} &bull; {studentDetails.student.course || ''}
                    </p>
                  </div>
                  <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Total Paid</span>
                    <span className="text-base font-bold text-emerald-400 font-mono">
                      ${studentDetails.financialSummary.totalPaid.toFixed(2)}
                    </span>
                  </div>
                  <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Balance Due</span>
                    <span className={`text-base font-bold font-mono ${studentDetails.financialSummary.outstanding > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
                      ${studentDetails.financialSummary.outstanding.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Historical Allocations */}
                <div>
                  <h5 className="text-xs font-bold text-white mb-2 flex items-center gap-1.5 uppercase tracking-wider text-slate-400">
                    <BedDouble className="w-3.5 h-3.5 text-indigo-400" />
                    Room & Bed Allocation History
                  </h5>
                  {studentDetails.allocations.length === 0 ? (
                    <p className="text-xs text-slate-500 italic p-3 bg-slate-950 rounded-xl">No room allocations recorded.</p>
                  ) : (
                    <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase">
                          <tr>
                            <th className="py-2 px-3">Room</th>
                            <th className="py-2 px-3">Bed</th>
                            <th className="py-2 px-3">Allocated Date</th>
                            <th className="py-2 px-3">Vacated Date</th>
                            <th className="py-2 px-3">Monthly Rent</th>
                            <th className="py-2 px-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {studentDetails.allocations.map((a: any) => (
                            <tr key={a.id}>
                              <td className="py-2 px-3 font-semibold text-white">Room {a.room_number}</td>
                              <td className="py-2 px-3 text-indigo-300 font-mono">{a.bed_number}</td>
                              <td className="py-2 px-3 text-slate-400">{a.allocation_date}</td>
                              <td className="py-2 px-3 text-slate-400">{a.vacate_date || 'Current Active'}</td>
                              <td className="py-2 px-3 font-mono text-slate-200">₹{a.monthly_rent}</td>
                              <td className="py-2 px-3">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${a.status === 'active' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                                  {a.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Rent Bills & Payments */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Rent Records */}
                  <div>
                    <h5 className="text-xs font-bold text-white mb-2 uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-indigo-400" />
                      Rent Invoices ({studentDetails.rentRecords.length})
                    </h5>
                    <div className="max-h-48 overflow-y-auto bg-slate-950 rounded-xl border border-slate-800 p-2 space-y-2">
                      {studentDetails.rentRecords.length === 0 ? (
                        <p className="text-xs text-slate-500 italic p-2">No invoices generated.</p>
                      ) : (
                        studentDetails.rentRecords.map((rn: any) => (
                          <div key={rn.id} className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs flex justify-between items-center">
                            <div>
                              <span className="font-semibold text-white block">Period: {rn.billing_period}</span>
                              <span className="text-[10px] text-slate-400">Due: {rn.due_date}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-mono text-slate-200 block">₹{rn.total_amount}</span>
                              <span className={`text-[10px] font-semibold ${rn.status === 'paid' ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {rn.status} (₹{rn.pending_amount} pending)
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Payment History */}
                  <div>
                    <h5 className="text-xs font-bold text-white mb-2 uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                      Payments Received ({studentDetails.payments.length})
                    </h5>
                    <div className="max-h-48 overflow-y-auto bg-slate-950 rounded-xl border border-slate-800 p-2 space-y-2">
                      {studentDetails.payments.length === 0 ? (
                        <p className="text-xs text-slate-500 italic p-2">No payments recorded.</p>
                      ) : (
                        studentDetails.payments.map((p: any) => (
                          <div key={p.id} className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs flex justify-between items-center">
                            <div>
                              <span className="font-semibold text-emerald-400 font-mono block">+₹{p.amount.toFixed(2)}</span>
                              <span className="text-[10px] text-slate-400 font-mono">{p.receipt_number} &bull; {p.payment_mode}</span>
                            </div>
                            <span className="text-[10px] text-slate-400">{p.payment_date}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-3 border-t border-slate-800">
                  <button
                    onClick={() => {
                      setViewingStudentId(null);
                      setStudentDetails(null);
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl border border-slate-700"
                  >
                    Close Record
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Student Delete Confirmation Modal */}
      {studentToDelete && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-red-400">
              <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">छात्र हटाएं (Delete Student)</h3>
                <p className="text-xs text-slate-400">यह स्थायी रूप से छात्र रिकॉर्ड हटा देगा।</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1.5">
              <div>
                <span className="text-slate-500 block text-[11px]">छात्र का नाम (Name):</span>
                <span className="font-bold text-white text-sm">{studentToDelete.full_name}</span>
              </div>
              <div className="flex justify-between text-slate-400 pt-1">
                <span>Admission #: <strong className="text-white font-mono">{studentToDelete.admission_number}</strong></span>
                <span>Mobile: <strong className="text-white font-mono">{studentToDelete.mobile}</strong></span>
              </div>
              <p className="text-[11px] text-amber-400/90 pt-2 border-t border-slate-800">
                ⚠️ नोट: छात्र को हटाने पर उनका आवंटित बेड (Room Bed) स्वतः खाली हो जाएगा तथा उनके रेंट रिकॉर्ड्स व रसीदें साफ हो जाएंगी।
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                disabled={isDeletingStudent}
                onClick={() => setStudentToDelete(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition cursor-pointer"
              >
                रद्द करें (Cancel)
              </button>
              <button
                type="button"
                disabled={isDeletingStudent}
                onClick={handleConfirmDeleteStudent}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-lg shadow-red-600/20 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeletingStudent ? 'हटाया जा रहा है...' : 'हाँ, डिलीट करें (Delete)'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

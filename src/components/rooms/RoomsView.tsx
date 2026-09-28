import React, { useState, useEffect } from 'react';
import { api, ApiError } from '../../api/client';
import { Room, Bed, RoomAllocation, Student } from '../../types';
import {
  Building2,
  Plus,
  BedDouble,
  UserCheck,
  ArrowRightLeft,
  LogOut,
  X,
  Search,
  Filter,
  Users,
  CheckCircle,
  AlertCircle,
  Clock,
  Layers,
  Edit,
  Trash2
} from 'lucide-react';

export const RoomsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'rooms' | 'allocations'>('rooms');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [allocations, setAllocations] = useState<RoomAllocation[]>([]);
  const [availableStudents, setAvailableStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters
  const [floorFilter, setFloorFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [allocationStatusFilter, setAllocationStatusFilter] = useState('active');

  // Modals
  const [isAddRoomOpen, setIsAddRoomOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [isAddBedOpen, setIsAddBedOpen] = useState(false);
  const [selectedRoomForBed, setSelectedRoomForBed] = useState<Room | null>(null);
  const [isAllocateOpen, setIsAllocateOpen] = useState(false);
  const [isVacateOpen, setIsVacateOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [selectedAllocation, setSelectedAllocation] = useState<RoomAllocation | null>(null);
  const [roomToDelete, setRoomToDelete] = useState<Room | null>(null);
  const [isDeletingRoom, setIsDeletingRoom] = useState(false);

  // Form states
  const [roomForm, setRoomForm] = useState({
    room_number: '',
    floor: '1st Floor',
    room_type: 'Double',
    capacity: 2,
    monthly_rent: 550,
    description: '',
    auto_create_beds: true,
  });

  const [bedForm, setBedForm] = useState({
    bed_number: '',
    notes: '',
  });

  const [allocateForm, setAllocateForm] = useState({
    student_id: '',
    room_id: '',
    bed_id: '',
    allocation_date: new Date().toISOString().split('T')[0],
    expected_checkout_date: '',
    monthly_rent: '',
    deposit_amount: '0',
    notes: '',
  });

  const [vacateForm, setVacateForm] = useState({
    vacate_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [transferForm, setTransferForm] = useState({
    new_room_id: '',
    new_bed_id: '',
    transfer_date: new Date().toISOString().split('T')[0],
    new_monthly_rent: '',
    notes: '',
  });

  const [formSubmitting, setFormSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchRooms = async () => {
    setIsLoading(true);
    try {
      const q = new URLSearchParams();
      if (floorFilter) q.append('floor', floorFilter);
      if (typeFilter) q.append('type', typeFilter);
      const res = await api.get<{ rooms: Room[] }>(`/rooms?${q.toString()}`);
      setRooms(res.rooms);
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Failed to load rooms.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAllocations = async () => {
    try {
      const q = new URLSearchParams({ status: allocationStatusFilter, limit: '50' });
      const res = await api.get<{ allocations: RoomAllocation[] }>(`/allocations?${q.toString()}`);
      setAllocations(res.allocations);
    } catch (err: any) {
      console.error('Failed to load allocations:', err);
    }
  };

  const fetchActiveStudentsWithoutBed = async () => {
    try {
      const res = await api.get<{ students: Student[] }>('/students?status=active&limit=100');
      // Filter out students who already have an active allocation
      const unallocated = res.students.filter(s => !s.currentAllocation);
      setAvailableStudents(unallocated);
    } catch (err) {
      console.error('Failed to load available students:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'rooms') {
      fetchRooms();
    } else {
      fetchAllocations();
    }
  }, [activeTab, floorFilter, typeFilter, allocationStatusFilter]);

  const handleOpenAddRoom = () => {
    setEditingRoom(null);
    setRoomForm({
      room_number: '',
      floor: '1st Floor',
      room_type: 'Double',
      capacity: 2,
      monthly_rent: 550,
      description: '',
      auto_create_beds: true,
    });
    setModalError(null);
    setIsAddRoomOpen(true);
  };

  const handleOpenEditRoom = (room: Room) => {
    setEditingRoom(room);
    setRoomForm({
      room_number: room.room_number,
      floor: room.floor,
      room_type: room.room_type,
      capacity: room.capacity,
      monthly_rent: room.monthly_rent,
      description: room.description || '',
      auto_create_beds: false,
    });
    setModalError(null);
    setIsAddRoomOpen(true);
  };

  const handleRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setModalError(null);

    try {
      if (editingRoom) {
        await api.put(`/rooms/${editingRoom.id}`, roomForm);
        setSuccess(`Room ${roomForm.room_number} updated.`);
      } else {
        await api.post('/rooms', roomForm);
        setSuccess(`Room ${roomForm.room_number} created with capacity ${roomForm.capacity}.`);
      }
      setIsAddRoomOpen(false);
      fetchRooms();
    } catch (err: any) {
      setModalError(err instanceof ApiError ? err.message : 'Operation failed.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteRoom = (room: Room) => {
    setRoomToDelete(room);
  };

  const handleConfirmDeleteRoom = async () => {
    if (!roomToDelete) return;
    setIsDeletingRoom(true);
    try {
      await api.delete(`/rooms/${roomToDelete.id}`);
      setSuccess(`कमरा ${roomToDelete.room_number} और उसके सभी बेड्स सफलतापूर्वक हटा दिए गए हैं।`);
      setRoomToDelete(null);
      fetchRooms();
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'कमरा हटाने में त्रुटि हुई।');
    } finally {
      setIsDeletingRoom(false);
    }
  };

  const handleOpenAddBed = (room: Room) => {
    setSelectedRoomForBed(room);
    const nextNum = (room.beds?.length || 0) + 1;
    setBedForm({
      bed_number: `Bed ${nextNum}`,
      notes: '',
    });
    setModalError(null);
    setIsAddBedOpen(true);
  };

  const handleBedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoomForBed) return;
    setFormSubmitting(true);
    setModalError(null);

    try {
      await api.post('/beds', {
        room_id: selectedRoomForBed.id,
        bed_number: bedForm.bed_number,
        notes: bedForm.notes,
      });
      setSuccess(`Bed "${bedForm.bed_number}" added to Room ${selectedRoomForBed.room_number}.`);
      setIsAddBedOpen(false);
      fetchRooms();
    } catch (err: any) {
      setModalError(err instanceof ApiError ? err.message : 'Failed to add bed.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleOpenAllocate = (prefillRoom?: Room, prefillBedId?: string) => {
    fetchActiveStudentsWithoutBed();
    setAllocateForm({
      student_id: '',
      room_id: prefillRoom?.id || (rooms.length > 0 ? rooms[0].id : ''),
      bed_id: prefillBedId || '',
      allocation_date: new Date().toISOString().split('T')[0],
      expected_checkout_date: '',
      monthly_rent: prefillRoom ? prefillRoom.monthly_rent.toString() : '',
      deposit_amount: '0',
      notes: '',
    });
    setModalError(null);
    setIsAllocateOpen(true);
  };

  const handleAllocateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setModalError(null);

    try {
      await api.post('/allocations/allocate', allocateForm);
      setSuccess('Student successfully allocated to bed.');
      setIsAllocateOpen(false);
      fetchRooms();
      fetchAllocations();
    } catch (err: any) {
      setModalError(err instanceof ApiError ? err.message : 'Allocation failed.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleOpenVacate = (allocation: RoomAllocation) => {
    setSelectedAllocation(allocation);
    setVacateForm({
      vacate_date: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setModalError(null);
    setIsVacateOpen(true);
  };

  const handleVacateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAllocation) return;
    setFormSubmitting(true);
    setModalError(null);

    try {
      await api.post(`/allocations/${selectedAllocation.id}/vacate`, vacateForm);
      setSuccess(`Student vacated. Bed released to available status.`);
      setIsVacateOpen(false);
      fetchRooms();
      fetchAllocations();
    } catch (err: any) {
      setModalError(err instanceof ApiError ? err.message : 'Vacating failed.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleOpenTransfer = (allocation: RoomAllocation) => {
    setSelectedAllocation(allocation);
    setTransferForm({
      new_room_id: '',
      new_bed_id: '',
      transfer_date: new Date().toISOString().split('T')[0],
      new_monthly_rent: '',
      notes: '',
    });
    setModalError(null);
    setIsTransferOpen(true);
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAllocation) return;
    setFormSubmitting(true);
    setModalError(null);

    try {
      await api.post(`/allocations/${selectedAllocation.id}/transfer`, transferForm);
      setSuccess('Student transferred to new room/bed successfully.');
      setIsTransferOpen(false);
      fetchRooms();
      fetchAllocations();
    } catch (err: any) {
      setModalError(err instanceof ApiError ? err.message : 'Transfer failed.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Selected room beds for allocation dropdown
  const selectedAllocRoom = rooms.find(r => r.id === allocateForm.room_id);
  const availableBedsInAllocRoom = selectedAllocRoom?.beds?.filter(b => b.status === 'available') || [];

  // Selected room beds for transfer dropdown
  const selectedTransferRoom = rooms.find(r => r.id === transferForm.new_room_id);
  const availableBedsInTransferRoom = selectedTransferRoom?.beds?.filter(b => b.status === 'available') || [];

  return (
    <div className="space-y-6">
      {/* Top Header & Tab Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-400" />
            Rooms & Bed Allocations
          </h2>
          <p className="text-xs text-slate-400">
            Real-time hostel layout, bed availability & resident allocations
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <div className="bg-slate-900 p-1 rounded-xl border border-slate-800 flex space-x-1">
            <button
              onClick={() => setActiveTab('rooms')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTab === 'rooms'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Rooms & Beds ({rooms.length})
            </button>
            <button
              onClick={() => setActiveTab('allocations')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTab === 'allocations'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Allocations History
            </button>
          </div>

          <button
            onClick={() => handleOpenAllocate()}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-600/20 transition"
          >
            <UserCheck className="w-4 h-4" />
            <span>Allocate Student</span>
          </button>

          <button
            onClick={handleOpenAddRoom}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Room</span>
          </button>
        </div>
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

      {activeTab === 'rooms' ? (
        /* ROOMS & BEDS VIEW */
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-wrap gap-4 items-center justify-between shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-2 text-xs text-slate-400">
                <Filter className="w-3.5 h-3.5" />
                <span>Floor:</span>
                <select
                  value={floorFilter}
                  onChange={(e) => setFloorFilter(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-xs text-white rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">All Floors</option>
                  <option value="Ground Floor">Ground Floor</option>
                  <option value="1st Floor">1st Floor</option>
                  <option value="2nd Floor">2nd Floor</option>
                  <option value="3rd Floor">3rd Floor</option>
                  <option value="4th Floor">4th Floor</option>
                </select>
              </div>

              <div className="flex items-center space-x-2 text-xs text-slate-400">
                <span>Room Type:</span>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-xs text-white rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">All Types</option>
                  <option value="Single">Single</option>
                  <option value="Double">Double</option>
                  <option value="Triple">Triple</option>
                  <option value="Four Bed">Four Bed</option>
                  <option value="Dormitory">Dormitory</option>
                </select>
              </div>
            </div>

            <div className="text-xs text-slate-400">
              Showing <span className="font-semibold text-white">{rooms.length}</span> configured rooms
            </div>
          </div>

          {/* Rooms Grid */}
          {isLoading ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Loading rooms and bed status...
            </div>
          ) : rooms.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-500 text-xs">
              No rooms found. Click "Add Room" to create your first hostel room.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {rooms.map((room) => {
                const isFull = room.availableBeds === 0 && room.totalBeds > 0;
                return (
                  <div
                    key={room.id}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition flex flex-col justify-between shadow-sm"
                  >
                    <div>
                      {/* Room Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-white">Room {room.room_number}</h3>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-indigo-300 font-semibold border border-slate-700">
                              {room.floor}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {room.room_type} &bull; Monthly: ₹{room.monthly_rent.toFixed(2)}
                          </p>
                        </div>

                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleOpenEditRoom(room)}
                            title="Edit Room"
                            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteRoom(room)}
                            title="Delete Room"
                            className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Capacity Bar */}
                      <div className="mb-4">
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-slate-400">
                            Occupancy: {room.occupiedBeds} / {room.totalBeds} Beds ({room.capacity} Max)
                          </span>
                          <span className={`font-semibold ${isFull ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {isFull ? 'Full' : `${room.availableBeds} Available`}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${room.occupancyRate}%` }}
                            className={`h-full rounded-full transition-all ${
                              isFull ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                          />
                        </div>
                      </div>

                      {/* Beds list inside room */}
                      <div className="space-y-2 mb-4">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                          Beds Configuration
                        </span>
                        <div className="grid grid-cols-1 gap-1.5">
                          {room.beds && room.beds.length > 0 ? (
                            room.beds.map((bed) => {
                              const isOccupied = bed.status === 'occupied';
                              return (
                                <div
                                  key={bed.id}
                                  className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition ${
                                    isOccupied
                                      ? 'bg-slate-950/70 border-indigo-950/60'
                                      : 'bg-slate-800/40 border-slate-700/60'
                                  }`}
                                >
                                  <div className="flex items-center space-x-2.5">
                                    <BedDouble
                                      className={`w-4 h-4 shrink-0 ${
                                        isOccupied ? 'text-indigo-400' : 'text-emerald-400'
                                      }`}
                                    />
                                    <div>
                                      <span className="font-semibold text-white block">
                                        {bed.bed_number}
                                      </span>
                                      {isOccupied && bed.student_name ? (
                                        <span className="text-[11px] text-indigo-300 block truncate max-w-[140px]">
                                          {bed.student_name}
                                        </span>
                                      ) : (
                                        <span className="text-[10px] text-emerald-400 block font-medium">
                                          Available
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div>
                                    {isOccupied ? (
                                      <button
                                        onClick={() => {
                                          const alloc = allocations.find(a => a.bed_id === bed.id && a.status === 'active');
                                          if (alloc) handleOpenVacate(alloc);
                                          else {
                                            // Fallback minimal allocation object
                                            handleOpenVacate({
                                              id: bed.allocation_id || '',
                                              student_id: bed.student_id || '',
                                              room_id: room.id,
                                              bed_id: bed.id,
                                              allocation_date: bed.allocation_date || '',
                                              monthly_rent: room.monthly_rent,
                                              deposit_amount: 0,
                                              status: 'active',
                                              created_at: '',
                                              student_name: bed.student_name,
                                              room_number: room.room_number,
                                              bed_number: bed.bed_number,
                                            });
                                          }
                                        }}
                                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-medium rounded-lg border border-slate-700 transition"
                                      >
                                        Vacate
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => handleOpenAllocate(room, bed.id)}
                                        className="px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-[10px] font-medium rounded-lg border border-emerald-500/30 transition"
                                      >
                                        Allocate
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <p className="text-xs text-slate-500 italic">No beds in this room yet.</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bottom card footer */}
                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <span className="text-slate-500 text-[11px]">
                        {room.beds?.length || 0} of {room.capacity} beds created
                      </span>
                      {(room.beds?.length || 0) < room.capacity && (
                        <button
                          onClick={() => handleOpenAddBed(room)}
                          className="text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Add Bed
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ALLOCATIONS HISTORY VIEW */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm space-y-4">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-400">Filter Allocation Status:</span>
              <select
                value={allocationStatusFilter}
                onChange={(e) => setAllocationStatusFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-xs text-white rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="active">Active Residents</option>
                <option value="vacated">Vacated History</option>
                <option value="transferred">Transferred History</option>
                <option value="all">All Historical Records</option>
              </select>
            </div>
            <span className="text-xs text-slate-400">
              Total Records: <span className="font-semibold text-white">{allocations.length}</span>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800/60 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Room & Bed</th>
                  <th className="py-3 px-4">Allocated Date</th>
                  <th className="py-3 px-4">Vacated Date</th>
                  <th className="py-3 px-4">Monthly Rent</th>
                  <th className="py-3 px-4">Deposit</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {allocations.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      No allocations recorded matching current filter.
                    </td>
                  </tr>
                ) : (
                  allocations.map((alloc) => (
                    <tr key={alloc.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white">{alloc.student_name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {alloc.admission_number} &bull; {alloc.student_mobile}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono">
                        <span className="font-semibold text-indigo-300">Room {alloc.room_number}</span>
                        <span className="text-slate-400 block text-[11px]">{alloc.bed_number}</span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">{alloc.allocation_date}</td>
                      <td className="py-3.5 px-4 text-slate-400">
                        {alloc.vacate_date || <span className="text-emerald-400">Currently Active</span>}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-medium text-white">₹{alloc.monthly_rent}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-400">₹{alloc.deposit_amount}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                            alloc.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : alloc.status === 'transferred'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {alloc.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {alloc.status === 'active' && (
                          <div className="flex items-center justify-end space-x-1">
                            <button
                              onClick={() => handleOpenTransfer(alloc)}
                              title="Transfer Bed"
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 text-[11px] font-medium rounded-lg border border-slate-700 flex items-center gap-1 transition"
                            >
                              <ArrowRightLeft className="w-3 h-3" />
                              <span>Transfer</span>
                            </button>
                            <button
                              onClick={() => handleOpenVacate(alloc)}
                              title="Vacate Bed"
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-red-300 text-[11px] font-medium rounded-lg border border-slate-700 flex items-center gap-1 transition"
                            >
                              <LogOut className="w-3 h-3" />
                              <span>Vacate</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Room Modal */}
      {isAddRoomOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-400" />
                {editingRoom ? 'Edit Room' : 'Add New Room'}
              </h3>
              <button onClick={() => setIsAddRoomOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-xs text-red-300 rounded-xl">
                {modalError}
              </div>
            )}

            <form onSubmit={handleRoomSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Room Number *</label>
                  <input
                    type="text"
                    required
                    value={roomForm.room_number}
                    onChange={(e) => setRoomForm({ ...roomForm, room_number: e.target.value })}
                    placeholder="e.g. 101, A-12"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Floor *</label>
                  <select
                    value={roomForm.floor}
                    onChange={(e) => setRoomForm({ ...roomForm, floor: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Ground Floor">Ground Floor</option>
                    <option value="1st Floor">1st Floor</option>
                    <option value="2nd Floor">2nd Floor</option>
                    <option value="3rd Floor">3rd Floor</option>
                    <option value="4th Floor">4th Floor</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Room Type</label>
                  <select
                    value={roomForm.room_type}
                    onChange={(e) => setRoomForm({ ...roomForm, room_type: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Single">Single</option>
                    <option value="Double">Double</option>
                    <option value="Triple">Triple</option>
                    <option value="Four Bed">Four Bed</option>
                    <option value="Dormitory">Dormitory</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Capacity (Beds) *</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    required
                    value={roomForm.capacity}
                    onChange={(e) => setRoomForm({ ...roomForm, capacity: parseInt(e.target.value, 10) || 1 })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Monthly Rent (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    required
                    value={roomForm.monthly_rent}
                    onChange={(e) => setRoomForm({ ...roomForm, monthly_rent: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Description / Amenities</label>
                <input
                  type="text"
                  value={roomForm.description}
                  onChange={(e) => setRoomForm({ ...roomForm, description: e.target.value })}
                  placeholder="e.g. Attached Bathroom, Balcony, AC"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {!editingRoom && (
                <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={roomForm.auto_create_beds}
                    onChange={(e) => setRoomForm({ ...roomForm, auto_create_beds: e.target.checked })}
                    className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Automatically create {roomForm.capacity} bed slots (Bed 1, Bed 2...)</span>
                </label>
              )}

              <div className="pt-3 border-t border-slate-800 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsAddRoomOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl border border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl"
                >
                  {formSubmitting ? 'Saving...' : editingRoom ? 'Update Room' : 'Create Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Bed Modal */}
      {isAddBedOpen && selectedRoomForBed && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <BedDouble className="w-5 h-5 text-indigo-400" />
                Add Bed to Room {selectedRoomForBed.room_number}
              </h3>
              <button onClick={() => setIsAddBedOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-xs text-red-300 rounded-xl">
                {modalError}
              </div>
            )}

            <form onSubmit={handleBedSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Bed Number / Label *</label>
                <input
                  type="text"
                  required
                  value={bedForm.bed_number}
                  onChange={(e) => setBedForm({ ...bedForm, bed_number: e.target.value })}
                  placeholder="e.g. Bed 3, Bed B"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Notes</label>
                <input
                  type="text"
                  value={bedForm.notes}
                  onChange={(e) => setBedForm({ ...bedForm, notes: e.target.value })}
                  placeholder="Upper bunk, window side..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsAddBedOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl border border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl"
                >
                  {formSubmitting ? 'Adding...' : 'Add Bed'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Allocate Student Modal */}
      {isAllocateOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-emerald-400" />
                Allocate Bed to Student
              </h3>
              <button onClick={() => setIsAllocateOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-xs text-red-300 rounded-xl">
                {modalError}
              </div>
            )}

            <form onSubmit={handleAllocateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Select Student *</label>
                <select
                  required
                  value={allocateForm.student_id}
                  onChange={(e) => setAllocateForm({ ...allocateForm, student_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Choose unallocated student --</option>
                  {availableStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} ({s.admission_number})
                    </option>
                  ))}
                </select>
                {availableStudents.length === 0 && (
                  <p className="text-[11px] text-amber-400 mt-1">
                    All registered active students currently have beds assigned or none exist. Register a student first.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Target Room *</label>
                  <select
                    required
                    value={allocateForm.room_id}
                    onChange={(e) => {
                      const rId = e.target.value;
                      const sel = rooms.find(r => r.id === rId);
                      setAllocateForm({
                        ...allocateForm,
                        room_id: rId,
                        bed_id: '',
                        monthly_rent: sel ? sel.monthly_rent.toString() : allocateForm.monthly_rent,
                      });
                    }}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Choose Room --</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        Room {r.room_number} ({r.availableBeds} beds available)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Available Bed *</label>
                  <select
                    required
                    value={allocateForm.bed_id}
                    onChange={(e) => setAllocateForm({ ...allocateForm, bed_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Choose Bed --</option>
                    {availableBedsInAllocRoom.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bed_number}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Allocation Date *</label>
                  <input
                    type="date"
                    required
                    value={allocateForm.allocation_date}
                    onChange={(e) => setAllocateForm({ ...allocateForm, allocation_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Monthly Rent (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={allocateForm.monthly_rent}
                    onChange={(e) => setAllocateForm({ ...allocateForm, monthly_rent: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Deposit (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={allocateForm.deposit_amount}
                    onChange={(e) => setAllocateForm({ ...allocateForm, deposit_amount: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Notes</label>
                <input
                  type="text"
                  value={allocateForm.notes}
                  onChange={(e) => setAllocateForm({ ...allocateForm, notes: e.target.value })}
                  placeholder="Terms, check-in remarks..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsAllocateOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl border border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting || !allocateForm.student_id || !allocateForm.bed_id}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl"
                >
                  {formSubmitting ? 'Allocating...' : 'Confirm Allocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Vacate Bed Modal */}
      {isVacateOpen && selectedAllocation && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <LogOut className="w-5 h-5 text-red-400" />
                Vacate Bed Allocation
              </h3>
              <button onClick={() => setIsVacateOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-800/60 rounded-xl text-xs mb-4 border border-slate-700">
              <span className="font-semibold text-white block">{selectedAllocation.student_name}</span>
              <span className="text-slate-400 block font-mono">
                Room {selectedAllocation.room_number} &bull; {selectedAllocation.bed_number}
              </span>
            </div>

            {modalError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-xs text-red-300 rounded-xl">
                {modalError}
              </div>
            )}

            <form onSubmit={handleVacateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Effective Vacating Date *</label>
                <input
                  type="date"
                  required
                  value={vacateForm.vacate_date}
                  onChange={(e) => setVacateForm({ ...vacateForm, vacate_date: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Vacating Reason / Remarks</label>
                <textarea
                  rows={2}
                  value={vacateForm.notes}
                  onChange={(e) => setVacateForm({ ...vacateForm, notes: e.target.value })}
                  placeholder="Key returned, room inspected, deposit refunded..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsVacateOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl border border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl"
                >
                  {formSubmitting ? 'Vacating...' : 'Vacate Bed'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Bed Modal */}
      {isTransferOpen && selectedAllocation && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-indigo-400" />
                Transfer Student to New Bed
              </h3>
              <button onClick={() => setIsTransferOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-800/60 rounded-xl text-xs mb-4 border border-slate-700">
              <span className="font-semibold text-white block">{selectedAllocation.student_name}</span>
              <span className="text-slate-400 block font-mono">
                Current: Room {selectedAllocation.room_number} &bull; {selectedAllocation.bed_number}
              </span>
            </div>

            {modalError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-xs text-red-300 rounded-xl">
                {modalError}
              </div>
            )}

            <form onSubmit={handleTransferSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">New Target Room *</label>
                  <select
                    required
                    value={transferForm.new_room_id}
                    onChange={(e) => {
                      const rId = e.target.value;
                      const sel = rooms.find(r => r.id === rId);
                      setTransferForm({
                        ...transferForm,
                        new_room_id: rId,
                        new_bed_id: '',
                        new_monthly_rent: sel ? sel.monthly_rent.toString() : '',
                      });
                    }}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Choose Room --</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        Room {r.room_number} ({r.availableBeds} beds available)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">New Target Bed *</label>
                  <select
                    required
                    value={transferForm.new_bed_id}
                    onChange={(e) => setTransferForm({ ...transferForm, new_bed_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Choose Bed --</option>
                    {availableBedsInTransferRoom.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bed_number}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Transfer Date *</label>
                  <input
                    type="date"
                    required
                    value={transferForm.transfer_date}
                    onChange={(e) => setTransferForm({ ...transferForm, transfer_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">New Monthly Rent (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={transferForm.new_monthly_rent}
                    onChange={(e) => setTransferForm({ ...transferForm, new_monthly_rent: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Transfer Reason</label>
                <input
                  type="text"
                  value={transferForm.notes}
                  onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
                  placeholder="Requested quiet room, roommate preference..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsTransferOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl border border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting || !transferForm.new_bed_id}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl"
                >
                  {formSubmitting ? 'Transferring...' : 'Complete Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Room Delete Confirmation Modal */}
      {roomToDelete && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-red-400">
              <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">कमरा हटाएं (Delete Room)</h3>
                <p className="text-xs text-slate-400">यह स्थायी रूप से कमरा और उसके बेड्स हटा देगा।</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Room Number:</span>
                <span className="font-bold text-white text-base">Room {roomToDelete.room_number}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Floor / Floor Type:</span>
                <span className="text-slate-200">{roomToDelete.floor} &bull; {roomToDelete.room_type}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Total Beds / Capacity:</span>
                <span className="text-indigo-300 font-mono font-bold">{roomToDelete.totalBeds || roomToDelete.capacity} Beds</span>
              </div>
              <p className="text-[11px] text-amber-400/90 pt-2 border-t border-slate-800">
                ⚠️ चेतावनी: इस कमरे को हटाने पर इसके अंदर मौजूद सभी बेड्स (Beds) और कमरे का रिकॉर्ड पूरी तरह से साफ हो जाएगा।
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                disabled={isDeletingRoom}
                onClick={() => setRoomToDelete(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition cursor-pointer"
              >
                रद्द करें (Cancel)
              </button>
              <button
                type="button"
                disabled={isDeletingRoom}
                onClick={handleConfirmDeleteRoom}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-lg shadow-red-600/20 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeletingRoom ? 'कमरा हटाया जा रहा है...' : 'हाँ, कमरा हटाएं (Delete Room)'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

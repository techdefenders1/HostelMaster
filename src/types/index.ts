export interface User {
  id: string;
  username: string;
  role: string;
}

export interface AuthStatus {
  initialized: boolean;
  twoFactorEnabled: boolean;
  authenticated: boolean;
  user: User | null;
}

export interface Student {
  id: string;
  admission_number: string;
  full_name: string;
  father_name?: string;
  mother_name?: string;
  mobile: string;
  alternate_mobile?: string;
  email?: string;
  dob?: string;
  gender: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  college?: string;
  course?: string;
  year_semester?: string;
  admission_date: string;
  guardian_name?: string;
  guardian_mobile?: string;
  id_proof_type?: string;
  id_proof_number?: string;
  photo_url?: string;
  status: 'active' | 'inactive' | 'vacated' | 'suspended';
  notes?: string;
  created_at: string;
  updated_at: string;
  currentAllocation?: {
    room_number: string;
    bed_number: string;
    allocation_date: string;
    monthly_rent: number;
  } | null;
}

export interface Room {
  id: string;
  room_number: string;
  floor: string;
  room_type: string;
  capacity: number;
  monthly_rent: number;
  description?: string;
  status: string;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  occupancyRate: number;
  beds?: Bed[];
}

export interface Bed {
  id: string;
  room_id: string;
  bed_number: string;
  status: 'available' | 'occupied' | 'reserved' | 'maintenance';
  notes?: string;
  room_number?: string;
  floor?: string;
  room_type?: string;
  monthly_rent?: number;
  allocation_id?: string;
  student_id?: string;
  allocation_date?: string;
  student_name?: string;
  admission_number?: string;
  student_mobile?: string;
}

export interface RoomAllocation {
  id: string;
  student_id: string;
  room_id: string;
  bed_id: string;
  allocation_date: string;
  expected_checkout_date?: string;
  vacate_date?: string;
  monthly_rent: number;
  deposit_amount: number;
  status: 'active' | 'vacated' | 'transferred';
  notes?: string;
  created_at: string;
  student_name?: string;
  admission_number?: string;
  student_mobile?: string;
  student_email?: string;
  room_number?: string;
  floor?: string;
  room_type?: string;
  bed_number?: string;
}

export interface RentRecord {
  id: string;
  student_id: string;
  allocation_id?: string;
  room_id: string;
  bed_id: string;
  billing_month: string;
  billing_period: string;
  rent_amount: number;
  discount: number;
  late_fee: number;
  other_charges: number;
  total_amount: number;
  paid_amount: number;
  pending_amount: number;
  due_date: string;
  status: 'pending' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';
  notes?: string;
  student_name?: string;
  admission_number?: string;
  student_mobile?: string;
  room_number?: string;
  bed_number?: string;
  created_at: string;
}

export interface Payment {
  id: string;
  receipt_number: string;
  student_id: string;
  rent_id?: string;
  payment_date: string;
  amount: number;
  payment_mode: string;
  transaction_ref?: string;
  notes?: string;
  student_name?: string;
  admission_number?: string;
  student_mobile?: string;
  billing_period?: string;
  room_number?: string;
  bed_number?: string;
  created_at: string;
}

export interface Receipt {
  receiptNumber: string;
  paymentDate: string;
  studentName: string;
  admissionNumber: string;
  studentMobile?: string;
  fatherName?: string;
  course?: string;
  college?: string;
  roomNumber: string;
  bedNumber: string;
  floor?: string;
  roomType?: string;
  billingPeriod: string;
  totalRent?: number;
  amount: number;
  previouslyPaid?: number;
  totalPaid?: number;
  remainingRent?: number;
  amountInWords?: string;
  paymentMode: string;
  transactionRef: string;
  previousPending: number;
  billRemainingBalance: number;
  overallRemainingDues: number;
  hostelName: string;
  hostelAddress: string;
  phone: string;
  email: string;
  currency: string;
  authorizedSignature: string;
  logoData?: string;
  signatureData?: string;
  notes?: string;
}

export interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  payment_mode: string;
  vendor?: string;
  reference_number?: string;
  notes?: string;
  created_at: string;
}

export interface StudentDue {
  student_id: string;
  full_name: string;
  admission_number: string;
  mobile: string;
  email: string;
  student_status: string;
  room_number: string | null;
  bed_number: string | null;
  total_billed: number;
  total_paid: number;
  outstanding: number;
  oldest_due_date: string | null;
  oldest_pending_amount: number | null;
  daysOverdue: number;
}

export interface SystemSettings {
  id?: string;
  hostel_name: string;
  hostel_address: string;
  phone: string;
  email: string;
  website: string;
  logo_data?: string;
  signature_data?: string;
  currency: string;
  date_format: string;
  default_rent: number;
  receipt_prefix: string;
  invoice_prefix: string;
  late_fee: number;
  authorized_signature: string;
}

export interface BackupItem {
  id: string;
  filename: string;
  file_size: number;
  created_at: string;
  notes?: string;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  username?: string;
  action: string;
  details?: string;
  ip_address: string;
  created_at: string;
}

export type Role = 'member' | 'admin';
export type BookingStatus = 'Confirmed' | 'Cancelled' | 'Completed';
export type MembershipStatus = 'Active' | 'Frozen' | 'Expired';

export interface AuthInfo { token: string; role: Role; name: string; member_id: string | null; }

export interface Trainer { 
  trainer_id: string; 
  full_name: string; 
  specialization: string; 
  working_hours: string; 
  photo?: string; // Тренердің суретіне арналған өріс қосылды
  phone?: string;
}

export interface Slot { time: string; available: boolean; }
export interface SlotsResponse { trainer_id: string; date: string; slots: Slot[]; }

export interface Booking {
  booking_id: string; member_id: string; member_name: string;
  trainer_id: string; trainer_name: string; specialization: string;
  session_start: string; status: BookingStatus;
  amount_kzt: string | null; payment_status: string | null; can_cancel: boolean;
}
export interface Member {
  member_id: string; full_name: string; phone: string; email: string | null;
  membership_status: MembershipStatus; membership_end_date: string | null;
}
export interface BusiestTrainer { trainer_id: string; trainer_name: string; total_bookings: number; }
export interface Summary {
  bookings_today: number; active_members: number; revenue_month_kzt: number;
  cancellation_rate: number; busiest_trainers: BusiestTrainer[];
}
export interface CreateBookingBody {
  trainer_id: string; session_start: string; payment_method: string; simulate_payment_failure: boolean;
}
export interface ApiError { error: string; message: string; alternatives?: string[]; }
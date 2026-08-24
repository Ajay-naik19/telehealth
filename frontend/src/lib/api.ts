const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/backend";

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

type ApiEnvelope<T = unknown> = {
  success: boolean;
  data: T | null;
  message: string;
  error?: string | null;
  [key: string]: unknown;
};

function isApiEnvelope(value: unknown): value is ApiEnvelope {
  return Boolean(
    value &&
      typeof value === "object" &&
      "success" in value &&
      "data" in value &&
      "message" in value,
  );
}

export async function apiRequest<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { body: requestBody, headers, ...rest } = options;

  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...headers,
    },
    credentials: "include", // send cookies (JWT tokens)
    body: requestBody ? JSON.stringify(requestBody) : undefined,
    ...rest,
  });

  const responseBody = await res
    .json()
    .catch(() => ({ message: res.statusText }));

  if (!res.ok) {
    const error = responseBody as Record<string, unknown>;
    const message =
      (error && typeof error === "object" && "message" in error && typeof error.message === "string" && error.message) ||
      (error && typeof error === "object" && "error" in error && typeof error.error === "string" && error.error) ||
      res.statusText ||
      "Something went wrong";
    throw new ApiError(res.status, message);
  }

  // handle 204 No Content
  if (res.status === 204) return undefined as T;

  if (isApiEnvelope(responseBody)) {
    if (!responseBody.success) {
      throw new ApiError(res.status, responseBody.message || responseBody.error || "Request failed");
    }

    if (responseBody.data !== null && responseBody.data !== undefined) {
      return responseBody.data as T;
    }

    return responseBody as T;
  }

  return responseBody as T;
}

const request = apiRequest;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// --- Auth ---

export function logout() {
  return request<void>("/api/auth/logout", { method: "GET" });
}

export interface AdminAuthUser {
  id: number;
  phone: string;
}

export interface AdminDashboardStats {
  totalPatients: number;
  totalDoctors: number;
  totalAppointments: number;
  activeAppointments: number;
  completedToday: number;
  totalOrders: number;
  totalRevenue: number;
  lowStockCount: number;
}

export interface AdminDoctorListItem {
  id: number;
  phone: string;
  created_at: string;
  full_name: string | null;
  specialization: string | null;
  experience_years: number | null;
  qualification: string | null;
  hospital_name: string | null;
}

export interface AdminPatientListItem {
  id: number;
  phone: string;
  created_at: string;
  full_name: string | null;
  gender: string | null;
  date_of_birth: string | null;
  blood_group: string | null;
}

export interface AdminAppointmentListItem {
  id: number;
  doctor_id: number;
  user_id: number;
  appointment_date: string;
  appointment_time: string;
  status: "scheduled" | "started" | "completed" | "cancelled" | string;
  room_id: string | null;
  patient_name: string | null;
  doctor_name: string | null;
}

export function adminLogin(phone: string, password: string) {
  return request<{ admin: AdminAuthUser; accessToken: string }>("/api/admin/login", {
    method: "POST",
    body: { phone, password },
  });
}

export function getAdminDashboardStats() {
  return request<AdminDashboardStats>("/api/admin/stats");
}

export function getAdminDoctors(page = 1) {
  return request<AdminDoctorListItem[]>(`/api/admin/doctors?page=${page}`);
}

export function getAdminPatients(page = 1) {
  return request<AdminPatientListItem[]>(`/api/admin/patients?page=${page}`);
}

export function getAdminAppointments(params?: { page?: number; status?: string; doctorId?: number; date?: string }) {
  const search = new URLSearchParams();
  if (params?.page) search.set("page", String(params.page));
  if (params?.status) search.set("status", params.status);
  if (typeof params?.doctorId === "number") search.set("doctorId", String(params.doctorId));
  if (params?.date) search.set("date", params.date);

  const query = search.toString();
  return request<AdminAppointmentListItem[]>(`/api/admin/appointments${query ? `?${query}` : ""}`);
}

// --- Profile ---

function normalizeUserProfile(profile: UserProfile | (Partial<UserProfile> & { fullName?: string })): UserProfile {
  const fallbackFullName =
    "fullName" in profile && typeof profile.fullName === "string"
      ? profile.fullName.trim()
      : "";

  const normalizedFullName =
    (typeof profile.full_name === "string" && profile.full_name.trim()) ||
    fallbackFullName ||
    "";

  return {
    ...profile,
    full_name: normalizedFullName,
  } as UserProfile;
}

function normalizeDoctorProfile(profile: DoctorProfile | (Partial<DoctorProfile> & { fullName?: string })): DoctorProfile {
  const fallbackFullName =
    "fullName" in profile && typeof profile.fullName === "string"
      ? profile.fullName.trim()
      : "";

  const normalizedFullName =
    (typeof profile.full_name === "string" && profile.full_name.trim()) ||
    fallbackFullName ||
    "";

  return {
    ...profile,
    full_name: normalizedFullName,
  } as DoctorProfile;
}

export function getUserProfile() {
  return request<{ profile: UserProfile | (Partial<UserProfile> & { fullName?: string }) }>("/patient/profile", {
    headers: { Accept: "application/json" },
  }).then((res) => ({
    ...res,
    profile: normalizeUserProfile(res.profile),
  }));
}

export function getDoctorProfile() {
  return request<{ profile: DoctorProfile | (Partial<DoctorProfile> & { fullName?: string }) }>("/doctor/profile", {
    headers: { Accept: "application/json" },
  }).then((res) => ({
    ...res,
    profile: normalizeDoctorProfile(res.profile),
  }));
}

// --- Appointments ---

export function getUpcomingAppointments(page = 1, limit = 10) {
  return request<{ appointments: Appointment[]; total: number }>(
    `/api/appointments/upcoming?page=${page}&limit=${limit}`,
  );
}

export function getAppointmentHistory(page = 1, limit = 10) {
  return request<{ appointments: Appointment[]; total: number }>(
    `/api/appointments/history?page=${page}&limit=${limit}`,
  );
}

export function getUserActiveAppointment() {
  return request<{ appointment?: ActiveAppointment | null } | ActiveAppointment[]>("/api/appointments/patient").then((res) => {
    if (Array.isArray(res)) {
      return { appointment: res[0] || null };
    }
    return { appointment: res.appointment || null };
  });
}

export function getDoctorActiveAppointment() {
  return request<{ appointment?: DoctorActiveAppointment | null } | DoctorActiveAppointment[]>("/api/appointments/doctor").then((res) => {
    if (Array.isArray(res)) {
      return { appointment: res[0] || null };
    }
    return { appointment: res.appointment || null };
  });
}

export function getDoctorAllAppointments() {
  return request<{ appointments: DoctorActiveAppointment[] }>("/api/appointments/doctor/all");
}

export function cancelAppointment(id: number, reason?: string) {
  return request<{ success: boolean; message: string }>(`/api/appointments/${id}/cancel`, {
    method: "POST",
    body: { reason },
  });
}

export function rescheduleAppointment(
  id: number,
  data: {
    doctorId: number;
    appointment_date: string;
    appointment_time: string;
    lockToken: string;
    symptoms?: string;
  },
) {
  return request<{ success: boolean; message?: string }>(`/api/appointments/${id}/reschedule`, {
    method: "POST",
    body: data,
  });
}

export function startAppointment(id: number) {
  return request<{ roomId: string }>(`/appointments/${id}/start`, {
    method: "POST",
  });
}

export interface DoctorVideoRoomResponse {
  roomId: string;
  appointment: {
    id: number;
    patientName: string;
    doctorName: string;
  };
  userId: number;
  userRole: "doctor";
}

export interface PatientVideoRoomResponse {
  roomId: string;
  appointmentId: number;
  userId: number;
  userName: string;
  doctorName: string;
  userRole: "user";
}

export function getDoctorVideoRoom(roomId: string) {
  return request<DoctorVideoRoomResponse>(`/doctor/video/${roomId}`);
}

export function getPatientVideoRoom(roomId: string) {
  return request<PatientVideoRoomResponse>(`/patient/video/${roomId}`);
}

export function saveConsultationNotes(roomId: string, notes: string) {
  return request<{ success: boolean; data: null; error: null; message: string }>("/api/notes/save", {
    method: "POST",
    body: { roomId, notes },
  });
}

export function getRecentPrescription() {
  return request<{ appointment?: { id: number; room_id: string }; roomId?: string; appointmentId?: number }>(
    "/api/appointments/recent-prescription",
  ).then((res) => {
    if (res.appointment) {
      return { appointment: res.appointment };
    }
    if (res.roomId && res.appointmentId) {
      return {
        appointment: {
          id: res.appointmentId,
          room_id: res.roomId,
        },
      };
    }
    throw new ApiError(500, "Invalid prescription response");
  });
}

// --- Schedule ---

export function getDoctorSchedule() {
  return request<DoctorScheduleData>("/api/schedule/my");
}

export function updateDoctorSchedule(schedules: DoctorScheduleUpdateItem[]) {
  return request<DoctorScheduleEntry[]>("/api/schedule/my", {
    method: "PUT",
    body: { schedules },
  });
}

export function addDoctorScheduleOverride(payload: DoctorScheduleOverrideCreatePayload) {
  return request<{ id: number }>("/api/schedule/override", {
    method: "POST",
    body: payload,
  });
}

export function removeDoctorScheduleOverride(id: number) {
  return request<{ success: boolean; data: null; error: null; message: string }>(`/api/schedule/override/${id}`, {
    method: "DELETE",
  });
}

// --- Booking Flow ---

export interface AvailableDoctor {
  id: number;
  full_name: string;
  name?: string;
  specialization: string;
  experience_years?: number;
  qualification?: string;
  hospital_name?: string;
}

export interface TimeSlot {
  time: string;
  status: "available" | "locked" | "booked";
}

export async function getAvailableDoctors() {
  return request<AvailableDoctor[]>("/api/doctors/available");
}

export async function getAvailableSlots(doctorId: number, date: string) {
  return request<TimeSlot[]>(`/api/slots?doctorId=${doctorId}&date=${date}`);
}

export async function lockSlot(doctorId: number, date: string, time: string) {
  return request<{ lockToken: string }>("/api/slots/lock", {
    method: "POST",
    body: { doctorId, date, time },
  });
}

export function unlockSlot(doctorId: number, date: string, time: string, lockToken: string) {
  return request<{ success: boolean; message: string }>("/api/slots/unlock", {
    method: "POST",
    body: { doctorId, date, time, lockToken },
  });
}

export function bookAppointment(data: {
  doctorId: number;
  appointment_date: string;
  appointment_time: string;
  lockToken: string;
  symptoms?: string;
}) {
  return request<{ success: boolean }>("/appointments/book", {
    method: "POST",
    body: data,
  });
}

// --- Types (re-exported for convenience) ---

export interface UserProfile {
  id: number;
  user_id: number;
  full_name: string;
  gender: string;
  dob: string;
  weight_kg: number;
  height_cm: number;
  blood_group: string;
  allergies: string | null;
}

export interface DoctorProfile {
  id: number;
  user_id: number;
  full_name: string;
  specialization: string;
  experience: number;
  qualification: string | null;
  hospital: string | null;
  bio: string | null;
}

export interface Appointment {
  id: number;
  user_id: number;
  doctor_id: number;
  appointment_date: string;
  appointment_time: string;
  status: "scheduled" | "started" | "completed" | "cancelled";
  room_id: string | null;
  symptoms: string | null;
  doctor_name?: string;
  patient_name?: string;
  specialization?: string;
}

export interface ActiveAppointment {
  id: number;
  appointment_date: string;
  appointment_time: string;
  status: "scheduled" | "started" | "completed" | "cancelled";
  room_id: string | null;
  doctor_name: string;
  specialization: string;
}

export interface DoctorActiveAppointment {
  id: number;
  appointment_date: string;
  appointment_time: string;
  status: "scheduled" | "started" | "completed" | "cancelled";
  room_id: string | null;
  user_name: string;
  gender: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  blood_group: string | null;
  allergies: string | null;
  symptoms: string | null;
}

export interface DoctorSchedule {
  id: number;
  doctor_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export interface DoctorScheduleEntry {
  id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export interface DoctorScheduleOverride {
  id: number;
  override_date: string;
  override_type: "unavailable" | "custom";
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
}

export interface DoctorScheduleData {
  weeklySchedule: DoctorScheduleEntry[];
  overrides: DoctorScheduleOverride[];
}

export interface DoctorScheduleUpdateItem {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface DoctorScheduleOverrideCreatePayload {
  date: string;
  reason: string;
}

// --- Pharmacy ---

export interface PharmacyCategory {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
}

export interface PharmacyProduct {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  price: string;
  compare_at_price: string | null;
  image_url: string | null;
  prescription_required: boolean;
  avg_rating: string;
  review_count: number;
  stock_quantity: number;
  category_name: string;
  category_slug: string;
}

export interface PharmacyPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CartItem {
  product_id: number;
  name: string;
  slug: string;
  price: string;
  image_url: string | null;
  quantity: number;
  stock_quantity: number;
  prescription_required?: boolean;
}

export interface PharmacyOrder {
  id: number;
  status: string;
  total_amount: number;
  subtotal: number;
  shipping_fee: number;
  shipping_name: string;
  shipping_phone: string;
  shipping_address: string;
  shipping_city: string;
  shipping_state: string;
  shipping_pincode: string;
  notes?: string | null;
  created_at: string;
  item_count?: number;
}

export interface PharmacyOrderItem {
  order_id: number;
  product_id: number;
  product_name: string;
  product_image: string | null;
  quantity: number;
  unit_price: string;
  total_price: string;
}

export interface PharmacyProductDetailResponse {
  success: boolean;
  product: PharmacyProduct;
  reviews: Array<{
    id: number;
    rating: number;
    title?: string | null;
    comment?: string | null;
    reviewer_name?: string;
    created_at?: string;
  }>;
  inWishlist: boolean;
  userReview: unknown;
  hasPurchased: boolean;
}

export function getPharmacyCategories() {
  return request<{ success: boolean; categories: PharmacyCategory[] }>(
    "/api/pharmacy/categories",
  );
}

export function getPharmacyProducts(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  return request<{
    success: boolean;
    products: PharmacyProduct[];
    pagination: PharmacyPagination;
  }>(`/api/pharmacy/products?${qs}`);
}

export function addToCart(productId: number, quantity: number) {
  return request<{ success: boolean; message: string; cartCount: number }>(
    "/api/pharmacy/cart/add",
    { method: "POST", body: { productId, quantity } },
  );
}

export function removeFromCart(productId: number) {
  return request<{ success: boolean; message: string }>(
    `/api/pharmacy/cart/remove/${productId}`,
    { method: "DELETE" },
  );
}

export function updateCartItem(productId: number, quantity: number) {
  return request<{ success: boolean; message: string; cartCount: number }>(
    "/api/pharmacy/cart/update",
    { method: "PUT", body: { productId, quantity } },
  );
}

export function getCart() {
  return request<{
    success: boolean;
    items: CartItem[];
    subtotal: number;
    itemCount: number;
  }>("/api/pharmacy/cart");
}

export function toggleWishlist(productId: number) {
  return request<{ success: boolean; added: boolean }>(
    "/api/pharmacy/wishlist/toggle",
    { method: "POST", body: { productId } },
  );
}

export function getWishlist() {
  return request<{ success: boolean; wishlist: PharmacyProduct[] }>(
    "/api/pharmacy/wishlist",
  );
}

export function placePharmacyOrder(payload: {
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  notes?: string;
}) {
  return request<{ success: boolean; message: string; order: PharmacyOrder }>(
    "/api/pharmacy/orders",
    { method: "POST", body: payload },
  );
}

export function getPharmacyOrders() {
  return request<{ success: boolean; orders: PharmacyOrder[] }>(
    "/api/pharmacy/orders",
  );
}

export function getPharmacyOrderDetail(orderId: number) {
  return request<{ success: boolean; order: PharmacyOrder & { items: PharmacyOrderItem[] } }>(
    `/api/pharmacy/orders/${orderId}`,
  );
}

export function getPharmacyProductBySlug(slug: string) {
  return request<PharmacyProductDetailResponse>(
    `/api/pharmacy/products/${slug}`,
  );
}

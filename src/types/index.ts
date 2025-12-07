export type AttendanceStatus = "attending" | "not_attending" | "waitlist";
export type UserRole = "admin" | "subadmin" | "member" | "visitor" | "guest";

// イベント（カウント付き）
export interface EventWithCounts {
  id: string;
  title: string;
  description: string | null;
  eventDate: Date;
  location: string | null;
  capacity: number | null;
  fee: number | null;
  feeVisible: boolean;
  deadline: Date | null;
  deadlineEnabled: boolean;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  attendingCount: number;
  waitlistCount: number;
  myAttendance?: {
    status: AttendanceStatus;
    comment: string | null;
    position: number | null;
  } | null;
}

// 参加者情報
export interface AttendanceWithUser {
  id: string;
  status: AttendanceStatus;
  comment: string | null;
  position: number | null;
  createdAt: Date;
  user: {
    id: string;
    nickname: string;
    profileImageUrl: string | null;
  };
}

// メンバー情報（公開）
export interface MemberPublic {
  id: string;
  nickname: string;
  profileImageUrl: string | null;
}

// メンバー情報（詳細）
export interface MemberFull extends MemberPublic {
  role: UserRole;
  gender: string | null;
  age: number | null;
  ageVisible: boolean;
  comment: string | null;
  createdAt: Date;
}

// API レスポンス型
export interface ApiResponse<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

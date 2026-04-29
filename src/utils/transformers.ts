// ============================================
// API Transformers - تبدیل داده‌های API به فرمت frontend
// ============================================

import type { IUser, IUserMembership } from '@/types';

/**
 * تبدیل snake_case API به camelCase frontend
 */

// Helper: تبدیل ایمن string
const safeString = (value: unknown, fallback = ''): string => {
  return value != null ? String(value) : fallback;
};

// Helper: تبدیل ایمن number
const safeNumber = (value: unknown, fallback = 0): number => {
  const num = Number(value);
  return isNaN(num) ? fallback : num;
};

// Helper: تبدیل ایمن boolean
const safeBoolean = (value: unknown, fallback = false): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true';
  return fallback;
};

/**
 * تبدیل user از API به فرمت frontend
 */
export const transformApiUser = (apiUser: Record<string, unknown>): Partial<IUser> => {
  return {
    id: safeString(apiUser.id || apiUser.user_id),
    username: safeString(apiUser.username || apiUser.email),
    email: safeString(apiUser.email),
    phone: safeString(apiUser.phone || apiUser.phone_number),
    firstName: safeString(apiUser.first_name || apiUser.firstName),
    lastName: safeString(apiUser.last_name || apiUser.lastName),
    avatar: apiUser.avatar ? safeString(apiUser.avatar) : undefined,
    role: safeString(apiUser.role || apiUser.organizational_role, 'user') as IUser['role'],
    organizationId: apiUser.organization_id ? safeString(apiUser.organization_id) : undefined,
    departmentId: apiUser.department_id ? safeString(apiUser.department_id) : undefined,
    teamIds: Array.isArray(apiUser.team_ids) ? apiUser.team_ids.map(String) : [],
    isVerified: safeBoolean(apiUser.is_verified || apiUser.isVerified),
    isAppAdmin: safeBoolean(apiUser.is_app_admin || apiUser.isAppAdmin || apiUser.admin_access),
    createdAt: safeString(apiUser.created_at || apiUser.createdAt, new Date().toISOString()),
    updatedAt: safeString(apiUser.updated_at || apiUser.updatedAt, new Date().toISOString()),
    status: apiUser.status ? safeString(apiUser.status) : undefined,
  };
};

/**
 * تبدیل user membership از API به فرمت frontend
 */
export const transformApiMembership = (apiMembership: Record<string, unknown>): Partial<IUserMembership> => {
  return {
    membershipId: safeString(apiMembership.id || apiMembership.membership_id),
    userId: safeString(apiMembership.user_id || apiMembership.userId),
    name: safeString(apiMembership.name || apiMembership.full_name),
    email: safeString(apiMembership.email),
    phone: safeString(apiMembership.phone || apiMembership.phone_number),
    status: safeString(apiMembership.status || apiMembership.membership_status),
    roleName: safeString(apiMembership.role_name || apiMembership.roleName),
    roleId: apiMembership.role_id ? safeNumber(apiMembership.role_id) : undefined,
    teamRoleId: apiMembership.team_role_id ? safeNumber(apiMembership.team_role_id) : undefined,
    teamId: safeNumber(apiMembership.team_id),
    teamName: safeString(apiMembership.team_name),
    departmentId: apiMembership.department_id ? safeNumber(apiMembership.department_id) : undefined,
    departmentName: safeString(apiMembership.department_name),
    requestedDate: apiMembership.requested_date ? safeString(apiMembership.requested_date) : undefined,
  };
};

/**
 * تبدیل دسته‌ای users
 */
export const transformApiUsers = (apiUsers: Record<string, unknown>[]): Partial<IUser>[] => {
  return apiUsers.map(transformApiUser);
};

/**
 * تبدیل دسته‌ای memberships
 */
export const transformApiMemberships = (apiMemberships: Record<string, unknown>[]): Partial<IUserMembership>[] => {
  return apiMemberships.map(transformApiMembership);
};

/**
 * استخراج data از response های مختلف API
 */
export const extractApiData = <T = unknown>(response: unknown): T | null => {
  if (!response || typeof response !== 'object') return null;

  const obj = response as Record<string, unknown>;

  // ساختار: { success: true, data: {...} }
  if (obj.data !== undefined) {
    return obj.data as T;
  }

  // ساختار: { results: [...] }
  if (obj.results !== undefined) {
    return obj.results as T;
  }

  // ساختار: { items: [...] }
  if (obj.items !== undefined) {
    return obj.items as T;
  }

  // خود response data است
  return response as T;
};

/**
 * تبدیل pagination metadata
 */
export const transformPagination = (apiResponse: Record<string, unknown>) => {
  return {
    total: safeNumber(apiResponse.total || apiResponse.count, 0),
    page: safeNumber(apiResponse.page || apiResponse.current_page, 1),
    pageSize: safeNumber(apiResponse.page_size || apiResponse.per_page, 20),
    hasNext: safeBoolean(apiResponse.has_next || apiResponse.hasNext),
    hasPrev: safeBoolean(apiResponse.has_prev || apiResponse.hasPrev),
  };
};

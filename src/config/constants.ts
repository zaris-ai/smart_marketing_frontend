// ============================================
// Constants - ثابت‌های پروژه
// ============================================

export const APP_CONFIG = {
  name: 'اطلس',
  description: 'پلتفرم مدیریت داده اطلس',
  version: '1.0.0',
} as const;

export const API_ENDPOINTS = {
  // Auth
  AUTH: {
    HEALTH: '/ums/auth/health/',
    LOGIN_STEP1: '/ums/auth/login/step1/',
    LOGIN_STEP2: '/ums/auth/login/step2/',
    SIGNUP: '/ums/auth/signup/',
    VERIFY_SIGNUP_OTP: '/ums/auth/signup/verify-otp/',
    RESEND_SIGNUP_OTP: '/ums/auth/signup/resend-otp/',
    REFRESH_TOKEN: '/ums/auth/token/refresh/',
  },
  // User
  USER: {
    PROFILE: '/ums/users/profile/',
    UPDATE_PROFILE: '/user/profile',
    CHANGE_PASSWORD: '/user/change-password',
  },
  // Dashboard
  DASHBOARD: {
    STATS: '/dashboard/stats',
    RECENT_ACTIVITY: '/dashboard/activity',
  },
  // Organization
  ORGANIZATION: {
    DEPARTMENTS: '/organization/departments',
    TEAMS: '/organization/teams',
    DEPARTMENT_TEAMS: (departmentId: string) => `/organization/departments/${departmentId}/teams`,
  },
  // Admin (UMS)
  ADMIN: {
    // Memberships
    MEMBERSHIPS_USERS: '/ums/memberships/users/',
    MEMBERSHIP_USER_DETAIL: (id: string | number) => `/ums/memberships/users/${id}/`,
    MEMBERSHIPS_PENDING: '/ums/memberships/pending/',
    MEMBERSHIP_APPROVE: (id: string | number) => `/ums/memberships/${id}/approve/`,
    MEMBERSHIP_REJECT: (id: string | number) => `/ums/memberships/${id}/reject/`,
    ASSIGNABLE_ROLES: '/ums/memberships/assignable-roles/',
    TEAM_ASSIGNABLE_ROLES: (teamId: number) => `/ums/memberships/teams/${teamId}/assignable-roles`,
    // Hierarchy
    TEAMS_HIERARCHY: '/ums/teams/hierarchy/',
    // Permissions
    PERMISSIONS_FRONT_ITEMS: '/ums/permissions/front-items/',
    PERMISSIONS_USER_ASSETS: '/ums/permissions/user-assets/',
    PERMISSIONS_USER_EXCEPTIONS: '/ums/permissions/user-exceptions/',
    PERMISSIONS_USER_EXCEPTION_DELETE: (id: number) => `/ums/permissions/user-exceptions/${id}/`,
    PERMISSIONS_USER_EXCEPTIONS_BULK: '/ums/permissions/user-exceptions/bulk/',
    PERMISSIONS_CHECK: '/ums/permissions/check/',
    PERMISSIONS_CHECK_BATCH: '/ums/permissions/check/batch/',
    PERMISSIONS_ROLE_DEFAULTS: '/ums/permissions/role-defaults/',
    PERMISSIONS_ROLE_DEFAULTS_BULK: '/ums/permissions/role-defaults/bulk/',
    PERMISSIONS_ROLE_DEFAULT_DELETE: (id: number) => `/ums/permissions/role-defaults/${id}/`,
    // Asset Access
    ACCESS_ASSETS_LIST: '/datacat/access/assets/list/',
    ACCESS_ASSETS_DETAIL: '/datacat/access/assets/detail/',
    // Inventory
    INVENTORY_ADD: '/datacat/access/inventory/add/',
    INVENTORY_REMOVE: '/datacat/access/inventory/remove/',
    INVENTORY_LIST: '/datacat/access/inventory/list/',
    // Projects
    PROJECTS_LIST: '/datacat/access/projects/list/',
    PROJECTS_DETAIL: '/datacat/access/projects/detail/',
    // Sensitivity
    SENSITIVITY_UPDATE: '/datacat/access/sensitivity/update/',
  },
  // Search
  SEARCH: {
    UNIFIED: '/datacat/search/',
  },
} as const;

export const ROUTES = {
  // Public
  HOME: '/',
  ABOUT: '/about',
  CONTACT: '/contact',
  
  // Auth
  AUTH: {
    LOGIN: '/auth/login',
    VERIFY_LOGIN: '/auth/verify-login',
    REGISTER: '/auth/login',
    VERIFY_SIGNUP: '/auth/verify-otp',
  },
  
  // Dashboard
  DASHBOARD: {
    HOME: '/dashboard',
    PROFILE: '/dashboard/profile',
    SETTINGS: '/dashboard/settings',
    USERS: '/dashboard/users',
    USER_SPECIAL_ACCESS: (userId: string) => `/dashboard/users/${userId}/special-access`,
    USER_ADD_SPECIAL_ACCESS: (userId: string) => `/dashboard/users/${userId}/add-special-access`,
    INVENTORY: '/dashboard/inventory',
    PROJECTS: '/dashboard/projects',
    DATASETS: '/dashboard/datasets',
    DATASETS_TAB: (tab: 'dataset' | 'source' | 'host') => `/dashboard/datasets?tab=${tab}`,
    SOURCES: '/dashboard/sources',
    HOSTS: '/dashboard/hosts',
    TAGS: '/dashboard/tags',
    GLOSSARY: '/dashboard/glossary',
    DEPARTMENTS: '/dashboard/departments',
    TEAMS: '/dashboard/teams',
    ACCESS_MANAGEMENT: '/dashboard/access-management',
    ROLE_PERMISSIONS: '/dashboard/role-permissions',
    ROLES: '/dashboard/roles',
    ROLE_DETAIL: (roleId: string | number) => `/dashboard/roles/${roleId}`,
  },
} as const;

export const OTP_CONFIG = {
  length: 6,
  expireTime: 120, // seconds
  resendDelay: 60, // seconds
} as const;

export const VALIDATION = {
  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: 'فرمت ایمیل نامعتبر است',
  },
  phone: {
    pattern: /^09\d{9}$/,
    message: 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود',
  },
  password: {
    minLength: 8,
    pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])/,
    message: 'رمز عبور باید شامل حروف بزرگ، کوچک، عدد و کاراکتر خاص باشد',
  },
  otp: {
    pattern: /^\d{6}$/,
    message: 'کد تایید باید ۶ رقم باشد',
  },
  name: {
    minLength: 2,
    maxLength: 50,
    pattern: /^[\u0600-\u06FFa-zA-Z\s]+$/,
    message: 'نام باید فقط شامل حروف فارسی یا انگلیسی باشد',
  },
} as const;

export const ROLES = {
  ORGANIZATION: 'organization',
  DEPARTMENT: 'department',
  TEAM_MEMBER: 'team_member',
} as const;

export const ROLE_LABELS = {
  [ROLES.ORGANIZATION]: 'سازمان',
  [ROLES.DEPARTMENT]: 'دپارتمان',
  [ROLES.TEAM_MEMBER]: 'عضو تیم',
} as const;

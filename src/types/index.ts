// ============================================
// Types - تایپ‌های کلی پروژه
// ============================================

// User Types
export interface IUser {
  id: string;
  user_id?: string;  // Alternative field name from some backends
  username: string; // email as username
  email: string;
  phone: string;
  phone_number?: string;  // Alternative field name
  firstName: string;
  first_name?: string;  // Alternative field name (snake_case)
  lastName: string;
  last_name?: string;  // Alternative field name (snake_case)
  full_name?: string;  // Some backends combine first + last name
  avatar?: string;
  role: 'organization' | 'department' | 'team_member' | 'user';
  organizational_role?: string;  // Alternative field name
  organizationId?: string;
  organization_id?: string;  // snake_case alternative
  departmentId?: string;
  department_id?: string;  // snake_case alternative
  teamIds?: string[];
  isVerified: boolean;
  is_verified?: boolean;  // snake_case alternative
  is_app_admin?: boolean;  // app admin flag from backend
  isAppAdmin?: boolean;  // camelCase alternative
  admin_access?: boolean;  // admin access flag from backend
  adminAccess?: boolean;  // camelCase alternative
  createdAt: string;
  updatedAt: string;
  status?: string;  // Backend may include status field
  created_at?: string;  // snake_case alternative
  updated_at?: string;  // snake_case alternative
}

// Organization Types
export interface IDepartment {
  id: string;
  name: string;
  description?: string;
}

export interface ITeam {
  id: string;
  name: string;
  departmentId: string;
  description?: string;
}

// Auth Types - Login (Two-Step with OTP)
export interface ILoginStep1Request {
  email: string;
  password: string;
}

export interface ILoginStep1Response {
  success: boolean;
  message: string;
  session_id: string; // برای ارسال در step2
  error?: {
    message?: string;
    details?: Record<string, string[]>;
  };
}

export interface ILoginStep2Request {
  session_id?: string;  // Optional - backend might not use this
  email?: string;        // Alternative identifier
  otp_code: string;
}

export interface ILoginStep2Response {
  success: boolean;
  message: string;
  data?: {
    user: {
      id: number;
      email: string;
      username: string;
      full_name: string;
      phone: string;
      status: string;
      created_at: string;
      updated_at: string;
      memberships: Array<{
        id: number;
        status: string;
        approved_at?: string;
        team_id: number;
        role_id: number;
        team_name: string;
        department_id?: number;
        department_name?: string;
        organization_id?: number;
        organization_name?: string;
        unit_type_id?: number;
        unit_type?: string;
        role_name: string;
        approved_by?: string;
      }>;
    };
    team_roles?: Array<{
      id: number;
      team_role_id: number;
      status: string;
      team_id: number;
      team_name: string;
      department_id?: number;
      department_name?: string;
      organization_id?: number;
      organization_name?: string;
      role_id: number;
      role_name: string;
    }>;
    tokens: {
      access: string;
      refresh: string;
      access_expires_in: number;
      refresh_expires_in: number;
    };
  };
  error?: any;
}

// Team Request Types
export interface ITeamRequest {
  team_id: number;
  organizational_role: string; // 'admin', 'member', etc.
}

// Auth Types - Register (Multi-step with OTP)
export interface ISignupRequest {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  password: string;
  password_confirm: string;
  team_requests?: ITeamRequest[]; // اختیاری
}

export interface ISignupResponse {
  success: boolean;
  message: string;
  data: {
    otp_sent: boolean;
    otp_expires_in: number;
    dev_otp?: string; // فقط در محیط توسعه
  };
  error?: {
    message?: string;
    details?: Record<string, string[]>;
  };
}

export interface IVerifySignupOtpRequest {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  password: string;
  password_confirm: string;
  otp_code: string;
  team_requests?: ITeamRequest[]; // اختیاری
}

export interface IVerifySignupOtpResponse {
  success: boolean;
  message: string;
  data: {
    user: IUser;
    team_role_requests?: any[];
    memberships?: Array<{
      id: number;
      membership_id?: number;
      team_id: number;
      team_name?: string;
      team?: { name: string };
      role_name?: string;
      team_role_name?: string;
      status: string;
    }>;
    tokens: {
      access: string;
      refresh: string;
      access_expires_in: number;
      refresh_expires_in: number;
    } | null; // null if user needs admin approval
  };
}

export interface IResendSignupOtpRequest {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  password: string;
  password_confirm: string;
  team_requests?: ITeamRequest[];
}

export interface IResendSignupOtpResponse {
  success: boolean;
  message: string;
}

// Legacy types for backward compatibility
export interface IRegisterStepOneData {
  email: string; // username
  phone: string;
  firstName: string;
  lastName: string;
  password: string;
  confirmPassword: string;
}

export interface IRegisterStepTwoData {
  role: 'organization' | 'department' | 'team_member';
  departmentId?: string;
  teamIds?: string[];
}

export interface IRegisterRequest {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  password: string;
  role: 'organization' | 'department' | 'team_member';
  // فقط برای role = 'department' ارسال می‌شود
  departmentId?: string;
  // فقط برای role = 'team_member' ارسال می‌شود
  // می‌تواند شامل تیم‌هایی از دپارتمان‌های مختلف باشد
  teamIds?: string[];
}

export interface IRegisterResponse {
  success: boolean;
  message: string;
  requireOtp: boolean;
  tempToken: string;
}

// Admin / User Management Types

/** یک نقش قابل تخصیص — از GET /ums/memberships/assignable-roles/ */
export interface IAssignableRole {
  id: number;
  name: string;
  description?: string;
  is_admin_role?: boolean;
}

/** اطلاعات کامل کاربر از GET /ums/memberships/users/{user_id}/ */
export interface IUserDetail {
  membershipId: string;
  userId: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: string;
  teamName: string;
  teamId: number;
  departmentName: string;
  departmentId?: number;
  organizationName?: string;
  roleName: string;
  roleId?: number;
  requestedDate?: string;
  joinedDate?: string;
  isActive: boolean;
  avatar?: string;
}

/** یک عضویت کاربر در یک تیم — نمایش normalised از backend */
export interface IUserMembership {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  roleName: string;
  roleId?: number;         // ID نقش تیمی (team_role_id)
  teamRoleId?: number;     // alias برای backward-compat
  teamId: number;
  teamName: string;
  departmentId?: number;
  departmentName?: string;
  requestedDate?: string;  // تاریخ درخواست عضویت
}

/** یک ردیف ادغام‌شده در جدول کاربران (یک کاربر، چند عضویت) */
export interface IManagedUserRow {
  userId: string;
  name: string;
  email: string;
  phone: string;
  firstRole: string;
  firstRoleId?: number;
  firstTeam: string;
  firstDepartment: string;
  status: string;
  memberships: IUserMembership[];
}

export interface IAdminTeam {
  id: number;
  name: string;
  departmentId?: number;
  departmentName?: string;
}

/** Organization hierarchy types - از /ums/teams/hierarchy/ */
export interface IOrganization {
  id: number;
  name: string;
  description?: string;
  unitType: 'organization';
  departments: IDepartmentHierarchy[];
}

export interface IDepartmentHierarchy {
  id: number;
  name: string;
  description?: string;
  unitType: 'department' | 'organization';
  teams: ITeamHierarchy[];
}

export interface ITeamHierarchy {
  id: number;
  name: string;
  description?: string;
  unitType: 'team' | 'department' | 'organization';
}

export interface IOrganizationResponse {
  success: boolean;
  data: {
    organizations: IOrganization[];
  };
  message?: string;
}

export type AssetType = 'dataset' | 'source' | 'host' | 'dataset_field' | 'schema' | 'project';

/** Front Item - بخش‌های داشبورد که کاربر به آن دسترسی دارد */
export interface IFrontItem {
  id: number;
  key: string; // unique identifier (e.g., 'dashboard', 'users', 'datasets')
  name: string; // display name
  type: 'menu' | 'page' | 'section' | 'feature';
  path?: string; // route path
  hasAccess: boolean; // آیا کاربر دسترسی دارد
  permission?: number; // سطح دسترسی: 0=none, 1=read, 2=write, 3=admin
  parent?: string; // parent key (برای منوهای تو در تو)
  order?: number; // ترتیب نمایش
}

/** User Context - اطلاعات کاربر از front-items API */
export interface IUserContext {
  is_app_admin: boolean;
  roles: Array<{ id: number; name: string }>;
  hierarchy: {
    team_id: number;
    team_name: string;
    department_id: number;
    department_name: string;
    organization_id: number;
    organization_name: string;
  };
}

/** پاسخ API برای front-items */
export interface IFrontItemsResponse {
  success: boolean;
  data: {
    datasets?: Array<{ id: number; name: string }>;
    sources?: Array<{ id: number; name: string }>;
    hosts?: Array<{ id: number; name: string }>;
    upload_enabled?: boolean;
    admin_access?: boolean;
    user_context?: IUserContext;
  };
  message?: string;
}

/** آیتم asset — از GET /datacat/access/assets/list/ */
export interface IAccessibleAsset {
  id: number;
  assetType: AssetType;
  assetId: number;
  name: string;
  isPublic?: boolean;
  addedDate?: string;
  description?: string;
}

/** برای backward-compat — همان IAccessibleAsset */
export interface IFrontItemAsset {
  assetId: number;
  assetType: AssetType;
  name: string;
  description?: string;
}

/** User Asset - دسترسی کاربر به یک asset (combined role + exceptions) */
export interface IUserAsset {
  assetType: AssetType;
  assetId: number;
  permission: 0 | 1 | 2 | 3; // 0=DENY, 1=READ, 2=WRITE, 3=DELETE
  source: 'role_default' | 'user_exception';
  name?: string;
  teamId?: number;
}

export interface IUserExceptionItem {
  id?: number;
  assetType: AssetType;
  assetId: number;
  assetName?: string;
  permission: number;
  permission_name:number;
  teamId?: number;
  userId?: number;
}

export interface IUserExceptionBulkRequest {
  team_id: number;
  user_id: number;
  exceptions: Array<{
    asset_type: AssetType;
    asset_id: number;
    permission: 0 | 1 | 2 | 3;
    ip_id?: number;
  }>;
}

// ─── Permission Check Types ──────────────────────────────────────────────────

/** Single permission check request */
export interface IPermissionCheckRequest {
  user_id: number;
  asset_type: AssetType;
  asset_id: number;
  team_id: number;
}

/** Permission check response */
export interface IPermissionCheckResponse {
  permission: 'none' | 'read' | 'write' | 'delete';
  allowed: boolean;
  level?: number; // 0=none, 1=read, 2=write, 3=delete
}

/** Batch permission check request */
export interface IPermissionBatchCheckRequest {
  user_id: number;
  checks: Array<{
    asset_type: AssetType;
    asset_id: number;
    team_id: number;
  }>;
}

/** Role default permission */
export interface IRoleDefault {
  id: number;
  roleId: number;
  roleName: string;
  assetType: AssetType;
  permission: 0 | 1 | 2 | 3;
}

/** Role defaults bulk update request */
export interface IRoleDefaultsBulkRequest {
  role_defaults: Array<{
    role_id: number;
    asset_type: AssetType;
    permission: 0 | 1 | 2 | 3;
  }>;
}

// API Response Types
export interface IApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: Record<string, string[]>;
}

export interface IPaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
}

// Form Types
export type FormStatus = 'idle' | 'loading' | 'success' | 'error';
// ─── Asset Catalog Types ─────────────────────────────────────────────────────

/** Add Asset to Inventory Request */
export interface IAddAssetToInventoryRequest {
  team_id: number;
  asset_type: AssetType;
  asset_id: number;
  make_public?: boolean;
}

/** Remove Asset from Inventory Request */
export interface IRemoveAssetFromInventoryRequest {
  team_id: number;
  asset_type: AssetType;
  asset_id: number;
}

/** Asset Detail - جزئیات کامل یک asset */
export interface IAssetDetail {
  id: number;
  name: string;
  description?: string;
  type: AssetType;
  schema?: Array<{
    name: string;
    type: string;
    nullable: boolean;
    description?: string;
  }>;
  lineage?: {
    sources: number[];
    targets: number[];
  };
  ownerTeam?: string;
  sensitivity?: 'public' | 'internal' | 'confidential';
  createdDate?: string;
  lastModified?: string;
  tags?: string[];
}

/** Update Sensitivity Request */
export interface IUpdateSensitivityRequest {
  dataset_id: number;
  sensitivity_level: 'public' | 'internal' | 'confidential';
}

/** Project - پروژه تیم */
export interface IProject {
  id: number;
  name: string;
  teamId: number;
  description?: string;
  datasetsCount: number; // تعداد datasets
  createdDate: string;
  owner?: string;
}

/** Project Detail با لیست datasets */
export interface IProjectDetail {
  id: number;
  name: string;
  teamId: number;
  description?: string;
  createdDate: string;
  owner?: string;
  datasets: Array<{
    id: number;
    name: string;
    permission: 'read' | 'write' | 'delete';
  }>;
}

// ─── Search & Catalog Types ──────────────────────────────────────────────────

/** Search Parameters */
export interface ISearchParams {
  q?: string;                    // Search query (optional - if empty, returns all)
  asset_type?: string;           // Comma-separated types
  tags?: string;                 // Comma-separated tag names
  sensitivity?: string;          // Comma-separated sensitivity levels
  team_id?: number;              // Restrict to specific team (from session)
  page?: number;                 // Page number (default 1)
  page_size?: number;            // Results per page (default 20, max 100)
  sort?: 'relevance' | 'name' | 'date' | 'name_asc' | 'name_desc' | 'created_at_desc';  // Sort order
  permission_level?: string;     // Comma-separated permissions (READ, WRITE, DELETE)
  sensitivity_level?: string;    // Filter datasets (public, confidential, critical)
  tag_ids?: string;              // Comma-separated tag IDs (AND logic)
  source_type?: string;          // Filter sources by type (RDBMS, File, API, etc.)
}

/** Search Result Item */
export interface ISearchResult {
  id: number;
  name: string;
  type: AssetType;
  description?: string;
  teamName?: string;
  sensitivity?: 'public' | 'internal' | 'confidential';
  tags?: string[];
  highlight?: string; // HTML with <mark> tags
  createdDate?: string;
  lastModified?: string;
  // اضافه شده از API response
  sourceName?: string; // برای datasets: نام source
  sourceType?: string; // نوع source (PostgreSQL, MySQL, S3, etc.)
  parentDatasetName?: string; // برای dataset_field: نام dataset والد
  effectivePermission?: string; // سطح دسترسی (READ, WRITE, DELETE)
}

/** Search Facets - برای فیلترها */
export interface ISearchFacets {
  asset_type?: Record<AssetType, number>;
  source_types?: Record<string, number>;
  sensitivity?: Record<string, number>;
  tags?: Record<string, number>;
}

/** Search Response */
export interface ISearchResponse {
  total: number;
  results: ISearchResult[];
  facets?: ISearchFacets;
  page?: number;
  pageSize?: number;
}

// ─── Role Management Types ───────────────────────────────────────────────────

/** Role (Assignable Role) */
export interface IRole {
  id: number;
  name: string;
  description?: string;
  unit_type?: string;
  unit_type_id?: number;
  permissions_count?: number;
  is_admin_role?: boolean; // آیا نقش مدیریتی است؟
}

/** Role Default Permission */
export interface IRoleDefaultPermission {
  id: number;
  role_id: number;
  role_name?: string;
  asset_type: AssetType;
  asset_id?: number;
  asset_name?: string;
  permission: 'read' | 'write' | 'delete' | 'deny';
  created_at?: string;
}

/** Inventory Item (Assets in team inventory) */
export interface IInventoryItem {
  id: number;
  asset_type: AssetType;
  asset_id: number;
  asset_name: string;
  team_id: number;
  is_public: boolean;
  added_date: string;
  added_by?: string;
  ip_id?: number; // For host assets
}

/** Bulk Role Default Request */
export interface IBulkRoleDefaultRequest {
  role_defaults: Array<{
    role_id: number;
    asset_type: AssetType;
    permission: 'read' | 'write' | 'delete' | 'deny';
  }>;
}

// ─── User Role Management Types ──────────────────────────────────────────────

/** Single User Role Assignment */
export interface IUserRoleAssignment {
  id: number;
  status: 'approved' | 'pending' | 'rejected' | 'revoked';
  created_at: string;
  approved_at?: string;
  rejected_at?: string;
  rejection_reason?: string;
  revoked_at?: string;
  revocation_reason?: string;
  team_id: number;
  team_name: string;
  role_id: number;
  role_name: string;
  unit_type: string;
  department_name?: string;
  organization_name?: string;
  approved_by_name?: string;
}

/** User Roles Response (all roles grouped by status) */
export interface IUserRolesResponse {
  user_id: number;
  email: string;
  full_name: string;
  user_status: string;
  is_app_admin: boolean;
  roles: {
    approved: IUserRoleAssignment[];
    pending: IUserRoleAssignment[];
    rejected: IUserRoleAssignment[];
    revoked: IUserRoleAssignment[];
  };
}

/** Assign Role Request */
export interface IAssignRoleRequest {
  user_id: number;
  team_id: number;
  role_id: number;
}

/** Update Role Request */
export interface IUpdateRoleRequest {
  new_role_id: number;
}

/** Revoke Role Request */
export interface IRevokeRoleRequest {
  revocation_reason?: string;
}

// ─── User Profile Types ──────────────────────────────────────────────────────

/** Profile Membership */
export interface IProfileMembership {
  membership_id: number;
  status: string;
  approved_at: string;
  team_id: number;
  team_name: string;
  department_id: number;
  department_name: string;
  organization_id: number;
  organization_name: string;
  unit_type_id: number;
  unit_type: string;
  role_id: number;
  role_name: string;
  approved_by: string;
}

/** User Profile */
export interface IUserProfile {
  id: number;
  email: string;
  full_name: string;
  phone: string;
  status: string;
  created_at: string;
  memberships: IProfileMembership[];
}

// ─── Data Lineage Types ──────────────────────────────────────────────────────

/** Lineage Dataset Info */
export interface ILineageDataset {
  id: number;
  name: string;
  display_name: string;
  description?: string;
}

/** Lineage Process (upstream or downstream) */
export interface ILineageProcess {
  process_id: number;
  dataset_id: number;
  dataset_name: string;
  dataset_display_name: string;
  dataset_description?: string;
  process_type_id: number;
  process_type: string;
  process_type_description?: string;
  created_at: string;
  updated_at: string;
}

/** Lineage Response */
export interface ILineageResponse {
  dataset: ILineageDataset;
  upstream: ILineageProcess[];
  downstream: ILineageProcess[];
}

// ─── Dataset Details Types ───────────────────────────────────────────────────

/** Dataset Field (Column) */
export interface IDatasetField {
  id: number;
  dataset_id: number;
  name: string;
  display_name: string;
  data_type: string;
  is_nullable: boolean;
  is_primary_key: boolean;
  description?: string;
  created_at: string;
  updated_at: string;
}

/** Dataset Full Details */
export interface IDatasetDetails {
  id: number;
  name: string;
  display_name: string;
  description?: string;
  source_id: number;
  schema_id: number;
  object_type_id: number;
  record_count: number;
  size_mb: number;
  is_provisional: boolean;
  source_type_name: string;
  db_type_name: string;
  created_at: string;
  updated_at: string;
}

/** Dataset Source Info */
export interface IDatasetSource {
  id: number;
  name: string;
  description?: string;
  source_type_id: number;
  source_type_name: string;
  db_type_name: string;
  database_name: string;
}

/** Dataset Host Info */
export interface IDatasetHost {
  id: number;
  name: string;
  description?: string;
}

/** Dataset Schema Info */
export interface IDatasetSchema {
  id: number;
  name: string;
  description?: string;
}

/** Dataset Object Type Info */
export interface IDatasetObjectType {
  id: number;
  name: string;
  description?: string;
}

/** Dataset Details Response */
export interface IDatasetDetailsResponse {
  dataset: IDatasetDetails;
  source: IDatasetSource;
  host: IDatasetHost;
  schema: IDatasetSchema;
  object_type: IDatasetObjectType;
  fields: IDatasetField[];
}

/** Dataset Overview Info */
export interface IDatasetOverview {
  id: number;
  name: string;
  display_name: string;
  description?: string;
  source_id: number;
  source_name: string;
  source_description?: string;
  source_type_name: string;
  db_type_name: string;
  schema_id: number;
  schema_name: string;
  object_type_id: number;
  object_type_name: string;
  record_count: number;
  size_mb: number;
  is_provisional: boolean;
  created_at: string;
  updated_at: string;
}

/** Dataset Overview Response */
export interface IDatasetOverviewResponse {
  dataset: IDatasetOverview;
}

// ============================================
// Dataset Profiling Types
// ============================================

/** Dataset Profiling Summary */
export interface IDatasetProfilingSummary {
  id: number;
  dataset_id: number;
  dataset_name: string;
  row_count: number;
  column_count: number;
  size_mb: number;
  completeness_pct: number;
  notes?: string;
  profiled_at: string;
  updated_at: string;
}

/** Dataset Field Profiling */
export interface IDatasetFieldProfiling {
  id: number;
  field_id: number;
  field_name: string;
  field_display_name: string;
  data_type: string;
  is_nullable: boolean;
  is_primary_key: boolean;
  field_description?: string;
  null_count: number;
  null_pct: number;
  distinct_count: number;
  distinct_pct: number;
  min_value?: string;
  max_value?: string;
  mean_value?: number;
  median_value?: number;
  std_dev?: number;
  profiled_at: string;
  updated_at: string;
}

/** Dataset Profiling Response */
export interface IDatasetProfilingResponse {
  summary: IDatasetProfilingSummary;
  fields: IDatasetFieldProfiling[];
}

// ============================================
// Tag Types
// ============================================

/** Tag */
export interface ITag {
  id: number;
  name: string;
  tag_category: string;
  description?: string;
  color: string;
  created_at: string;
  updated_at: string;
}

/** Create Tag Request */
export interface ICreateTagRequest {
  name: string;
  tag_category: string;
  description?: string;
  color: string;
}

/** Update Tag Request */
export interface IUpdateTagRequest {
  name?: string;
  tag_category?: string;
  description?: string;
  color?: string;
}

// ============================================
// Glossary Types
// ============================================

/** Glossary Term */
export interface IGlossaryTerm {
  id: number;
  term: string;
  description: string;
  created_at: string;
  updated_at: string;
}

/** Create Glossary Request */
export interface ICreateGlossaryRequest {
  term: string;
  description: string;
}

/** Update Glossary Request */
export interface IUpdateGlossaryRequest {
  term?: string;
  description?: string;
}

// ============================================
// Department Types
// ============================================

export interface IDepartmentItem {
  id: number;
  name: string;
  description: string;
  status: string;
  organization_id: number;
  organization_name: string;
  unit_type_id: number;
  unit_type_name: string;
  created_at: string;
  updated_at: string;
}

export interface ICreateDepartmentRequest {
  name: string;
  description?: string;
  organization_id: number;
  unit_type_id?: number;
}

export interface IUpdateDepartmentRequest {
  name?: string;
  description?: string;
  organization_id?: number;
  unit_type_id?: number;
}

// ============================================
// Host Types
// ============================================

/** Host Overview */
export interface IHostOverview {
  id: number;
  name: string;
  display_name: string;
  description?: string;
  ip_address?: string;
  port?: number;
  host_type?: string;
  environment?: string;
  status?: string;
  created_at: string;
  updated_at: string;
}

/** Host Overview Response */
export interface IHostOverviewResponse {
  host: IHostOverview;
}

// ============================================
// Source Types
// ============================================

/** Source Overview */
export interface ISourceOverview {
  id: number;
  name: string;
  display_name: string;
  description?: string;
  source_type_id: number;
  source_type_name: string;
  db_type_id?: number;
  db_type_name: string;
  database_name: string;
  host_id?: number;
  host_name?: string;
  schema_id?: number;
  schema_name?: string;
  connection_string?: string;
  is_active?: boolean;
  created_at: string;
  updated_at: string;
}

/** Source Overview Response */
export interface ISourceOverviewResponse {
  source: ISourceOverview;
}

// ============================================
// Team Management Types
// ============================================

/** Team Entity - مطابق با API */
export interface ITeamEntity {
  id: number;
  name: string;
  description: string;
  status: string;
  department_id: number;
  department_name: string;
  unit_type_id: number;
  unit_type_name: string;
  created_at: string;
  updated_at: string;
}

/** Team Create/Update Request */
export interface ICreateUpdateTeamRequest {
  name: string;
  description: string;
  status?: string;
  department_id: number;
  unit_type_id?: number;
}

/** Team List Response */
export interface ITeamListResponse {
  success: boolean;
  data: ITeamEntity[];
  message?: string;
}

/** Team Detail Response */
export interface ITeamDetailResponse {
  success: boolean;
  data: ITeamEntity;
  message?: string;
}

/** Team Hierarchy Response */
export interface ITeamHierarchyResponse {
  success: boolean;
  data: IOrganization[];
  message?: string;
}

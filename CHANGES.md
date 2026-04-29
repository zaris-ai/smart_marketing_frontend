# تغییرات اعمال شده در پروژه

## ✅ تغییرات انجام شده

### 1. بهینه‌سازی فونت‌ها
- **کاهش از 8 وزن به 3 وزن**: فقط Regular (400), SemiBold (600), Bold (700)
- **بهبود Performance**: کاهش حجم دانلود فونت‌ها از ~2MB به ~750KB
- **Fallback بهینه**: اضافه شدن Tahoma و Arial به عنوان fallback

### 2. سیستم احراز هویت پیشرفته

#### 🔐 ثبت نام (Register) - دو مرحله‌ای
**مرحله اول: اطلاعات پایه**
- ایمیل (نام کاربری)
- شماره موبایل
- نام و نام خانوادگی
- رمز عبور با نشانگر قدرت رمز
- تکرار رمز عبور

**مرحله دوم: انتخاب نقش**
- **سازمان (Organization)**: فقط نقش، بدون انتخاب اضافی
- **دپارتمان (Department)**: انتخاب دپارتمان
- **عضو تیم (Team Member)**: انتخاب دپارتمان + انتخاب چندین تیم

**پس از تایید**: انتقال به صفحه تایید OTP

#### 🔓 ورود (Login)
- نام کاربری (ایمیل)
- رمز عبور
- پس از ورود: انتقال به صفحه تایید OTP

### 3. طراحی جدید صفحات احراز هویت

#### AuthLayout جدید
- **بخش راست**: فرم ورود/ثبت نام با پس‌زمینه سفید
- **بخش چپ**: تصویر و gradient آبی زیبا (فقط در desktop)
- **Responsive**: در موبایل فقط فرم نمایش داده می‌شود
- **دکمه بازگشت**: در صفحه OTP

### 4. کامپوننت‌های جدید UI

#### Select
- کامپوننت dropdown برای انتخاب تک‌گزینه‌ای
- پشتیبانی از dark mode
- نمایش خطا

#### MultiSelect
- کامپوننت انتخاب چندگانه برای تیم‌ها
- نمایش تگ‌های انتخاب شده
- قابلیت حذف تگ‌ها
- Dropdown با checkbox

#### PasswordStrength
- نمایش قدرت رمز عبور با نوار پیشرفت رنگی
- نمایش شرایط رمز عبور:
  - حداقل ۸ کاراکتر
  - حروف کوچک (a-z)
  - حروف بزرگ (A-Z)
  - اعداد (0-9)
  - کاراکتر خاص (@$!%*?&#)

### 5. تایپ‌ها و Interfaces جدید

```typescript
// User با اطلاعات کامل
interface IUser {
  id: string;
  username: string; // email
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  role: 'organization' | 'department' | 'team_member';
  organizationId?: string;
  departmentId?: string;
  teamIds?: string[];
  // ...
}

// Department & Team
interface IDepartment { id, name, description }
interface ITeam { id, name, departmentId, description }
```

### 6. Validation Schemas جدید

- **loginSchema**: username (email) + password
- **registerStepOneSchema**: اطلاعات پایه با validation کامل
- **registerStepTwoSchema**: نقش + conditional validation برای department/team
- **otpSchema**: کد 6 رقمی

### 7. Services جدید

#### organizationService
- `getDepartments()`: دریافت لیست دپارتمان‌ها
- `getDepartmentTeams(departmentId)`: دریافت تیم‌های یک دپارتمان
- `getAllTeams()`: دریافت همه تیم‌ها

### 8. Constants جدید

```typescript
ROLES = {
  ORGANIZATION: 'organization',
  DEPARTMENT: 'department',
  TEAM_MEMBER: 'team_member',
}

ROLE_LABELS = {
  organization: 'سازمان',
  department: 'دپارتمان',
  team_member: 'عضو تیم',
}

VALIDATION = {
  email: { pattern, message },
  phone: { pattern, message },
  password: { minLength: 8, pattern: کاراکتر خاص, message },
  name: { minLength: 2, maxLength: 50, pattern: فارسی/انگلیسی },
}
```

## 📁 فایل‌های تغییر یافته

### بهبود یافته
- ✅ `src/lib/local_fonts.ts` - کاهش فونت‌ها
- ✅ `src/types/index.ts` - تایپ‌های جدید
- ✅ `src/config/constants.ts` - constants جدید
- ✅ `src/validations/auth.schema.ts` - schemas جدید
- ✅ `src/components/layouts/AuthLayout.tsx` - طراحی جدید
- ✅ `src/pages/auth/verify-otp.tsx` - اضافه شدن دکمه بازگشت

### جدید
- ✨ `src/components/ui/Select.tsx`
- ✨ `src/components/ui/MultiSelect.tsx`
- ✨ `src/components/ui/PasswordStrength.tsx`
- ✨ `src/services/organization.service.ts`

### بازنویسی شده
- 🔄 `src/components/auth/RegisterForm.tsx` - فرم دو مرحله‌ای
- 🔄 `src/components/auth/LoginForm.tsx` - با username (email)

### Backup
- 📦 `src/components/auth/RegisterForm-OLD.tsx`
- 📦 `src/components/auth/LoginForm-OLD.tsx`

## 🎨 تغییرات UI/UX

### رنگ‌بندی
- **Gradient آبی**: `from-blue-500 via-blue-600 to-indigo-700`
- **Decorative elements**: دایره‌های blur شده برای جلوه بصری

### Responsive Design
- Desktop (lg:): نمایش دو ستونه (فرم + تصویر)
- Mobile: فقط فرم با عرض کامل

### Progress Indicator
- نمایش مرحله فعلی در ثبت نام
- دایره‌های شماره‌دار با تیک سبز برای مرحله تکمیل شده

## 🔧 نکات فنی

### Performance
- **Font Optimization**: کاهش ۶۲٪ در حجم فونت‌ها
- **Code Splitting**: آماده برای dynamic imports
- **Memoization**: در PasswordStrength با useMemo

### Type Safety
- تمام کامپوننت‌ها با TypeScript
- Validation با Zod
- Type inference در همه جا

### Best Practices
- **Separation of Concerns**: logic جدا از UI
- **Reusable Components**: کامپوننت‌های قابل استفاده مجدد
- **Conditional Rendering**: بر اساس نقش کاربر
- **Form State Management**: با React Hook Form
- **Error Handling**: نمایش خطاها به کاربر

## 🚀 نحوه استفاده

### ثبت نام
```
/auth/register
→ مرحله 1: اطلاعات پایه
→ مرحله 2: انتخاب نقش
→ تایید OTP
→ Dashboard
```

### ورود
```
/auth/login
→ username + password
→ تایید OTP
→ Dashboard
```

## 📝 TODO برای Backend

Backend باید این endpoint‌ها را پیاده‌سازی کند:

1. **POST /auth/register**
   ```json
   {
     "email": "user@example.com",
     "phone": "09123456789",
     "firstName": "علی",
     "lastName": "احمدی",
     "password": "SecurePass123!",
     "role": "team_member",
     "departmentId": "1",
     "teamIds": ["t1", "t2"]
   }
   ```

2. **POST /auth/login**
   ```json
   {
     "username": "user@example.com",
     "password": "SecurePass123!"
   }
   ```

3. **GET /organization/departments**
4. **GET /organization/departments/:id/teams**

## 🎯 نکات مهم

1. **Mock Data**: در RegisterForm از mock data استفاده شده - باید با API واقعی جایگزین شود
2. **Phone Storage**: در LoginForm، باید phone واقعی از response بیاید
3. **Image**: در AuthLayout یک placeholder SVG است - باید تصویر واقعی جایگزین شود

## 📸 تصویر نهایی

برای افزودن تصویر واقعی در AuthLayout:
```tsx
<Image
  src="/Image/auth-illustration.svg"
  alt="Authentication"
  fill
  className="object-contain"
  priority
/>
```

تصویر را در `/public/Image/auth-illustration.svg` قرار دهید.

---

## 🆕 تغییرات جدید - فوریه 21, 2026

### 1. پشتیبانی از Admin اپلیکیشن در Front Items

**تغییرات Types:**
- اضافه شدن `IUserContext` برای اطلاعات کاربر
- آپدیت `IFrontItemsResponse` برای شامل شدن `user_context` و `is_app_admin`

**تغییرات API:**
- تغییر `/ums/permissions/front-items/` از GET به POST
- ارسال `team_id` در body
- پشتیبانی از admin اپلیکیشن:
  - **چک دوگانه**: هر دو `admin_access` و `is_app_admin` چک می‌شوند
  - اگر یکی از آن‌ها `true` باشد → کاربر Admin است
  - به ادمین تمام دسترسی‌ها داده می‌شود (permission: 3)
  - ادمین همه datasets, sources, hosts را می‌بیند (حتی اگر خالی باشد)
  - **نکته مهم**: ادمین اپلیکیشن تیم ندارد، اما با `admin_access` شناسایی می‌شود

**تغییرات در SidebarMenu:**
- اگر کاربر Admin باشد، `hasAccess()` همیشه `true` برمی‌گرداند
- تمام منوها برای Admin نمایش داده می‌شوند
- فیلتر `permissionKey` برای Admin اعمال نمی‌شود

**Debug API:**
```
POST https://api.tatanext.ir/api/v1/ums/permissions/front-items/debug/
Body: { "team_id": 2 }
```

### 2. تغییر Search API به POST

**قبل:**
```typescript
GET /datacat/search/?team_id=2&q=test
```

**بعد:**
```typescript
POST /datacat/search/
Body: { "team_id": 2, "q": "test" }
```

### 3. آپدیت usePermissions Hook

**قبل:**
```typescript
const { permissions } = usePermissions();
```

**بعد:**
```typescript
const { permissions, isAdmin } = usePermissions(teamId); // teamId اختیاری
```

**ویژگی‌های جدید:**
- فیلد `isAdmin` برای شناسایی ادمین اپلیکیشن
- اگر `isAdmin === true` باشد، `hasAccess(key)` همیشه `true` برمی‌گرداند
- تمام منوها برای ادمین بدون فیلتر نمایش داده می‌شوند

**نکته**: اگر teamId ارسال نشود، API بدون team_id فراخوانی می‌شود.

### 4. تایید نقش کاربر (Approval)

**تایید شد**: کد قبلاً درست بود و از `id` استفاده می‌کند نه `role_id`

در `normalizeRoles`:
```typescript
id: Number(item?.id)  // ✅ درست
```

در `UserApprovalModal`:
```typescript
setSelectedRoleId(matchingRole?.id)  // ✅ درست
```

در `approveMembership`:
```typescript
{ final_role_id: roleId }  // ✅ roleId همان id است
```

---

**تاریخ**: 21 فوریه 2026
**نسخه**: 1.1.0

---

**تاریخ**: 3 فوریه 2026
**نسخه**: 1.0.0

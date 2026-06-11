import {
  AtSymbolIcon,
  BriefcaseIcon,
  EnvelopeIcon,
  FunnelIcon,
  GlobeAltIcon,
  HashtagIcon,
  HomeIcon,
  KeyIcon,
  ListBulletIcon,
  PencilIcon,
  PencilSquareIcon,
  QuestionMarkCircleIcon,
  SignalIcon,
  UserMinusIcon,
  UsersIcon,
  ClipboardDocumentCheckIcon,
  CalendarDaysIcon,
  ChartBarIcon
} from "@heroicons/react/24/outline";
import {
  IconBrandSpeedtest,
  IconBuildingStore,
  IconImageInPicture,
  IconMail,
  IconUpload,
  IconVideo,
} from "@tabler/icons-react";

export interface MenuItem {
  label: string;
  href?: string;
  icon: React.ElementType;
  badge?: number;
  section?: "top" | "seo" | "setting" | "users" | "instagram" | "crm";
}

export const menuItems: MenuItem[] = [
  {
    label: "Users",
    href: "/dashboard/users",
    icon: UsersIcon,
    section: "setting",
  },
  {
    label: "Marketing Capacity",
    href: "/dashboard/marketing-capacity",
    icon: BriefcaseIcon,
    section: "setting",
  },
  {
    label: "Runs",
    href: "/dashboard/runs",
    icon: IconBrandSpeedtest,
    section: "setting",
  },
  {
    label: "Uploader",
    href: "/dashboard/uploader",
    icon: IconUpload,
    section: "setting",
  },
  {
    label: "Emails",
    href: "/dashboard/emails",
    icon: IconMail,
    section: "setting",
  },
  {
    label: 'Daily Planner',
    href: '/dashboard/daily-planner',
    icon: CalendarDaysIcon,
    section: 'users',
  },
  {
    label: 'My Tasks',
    href: '/dashboard/my-tasks',
    icon: ClipboardDocumentCheckIcon,
    section: 'users',
  },
  {
    label: "CRM Sales Funnel",
    href: "/dashboard/crm-funnel",
    icon: FunnelIcon,
    section: "users",
  },
  {
    label: "Email Templates",
    href: "/dashboard/email-templates",
    icon: EnvelopeIcon,
    section: "users",
  },
  {
    label: 'Employee Productivity',
    href: '/dashboard/employee-productivity',
    icon: ChartBarIcon,
    section: 'users',
  },
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: HomeIcon,
    section: "top",
  },
  {
    label: "Searcher",
    href: "/dashboard/searcher",
    icon: GlobeAltIcon,
    section: "top",
  },
  {
    label: "Competitor",
    href: "/dashboard/competitor",
    icon: SignalIcon,
    section: "top",
  },
  {
    label: "Manage Competitor",
    href: "/dashboard/manage_competitor",
    icon: UserMinusIcon,
    section: "top",
  },
  {
    label: "Trends",
    href: "/dashboard/trends",
    icon: HashtagIcon,
    section: "top",
  },
  {
    label: "Outreach",
    href: "/dashboard/outreach",
    icon: AtSymbolIcon,
    section: "top",
  },
  {
    label: "Problem discovery",
    href: "/dashboard/problem_discovery",
    icon: QuestionMarkCircleIcon,
    section: "top",
  },
  {
    label: "Seo analyzer",
    href: "/dashboard/seo",
    icon: ListBulletIcon,
    section: "seo",
  },
  {
    label: "Seo keyword",
    href: "/dashboard/seoKeyword",
    icon: KeyIcon,
    section: "seo",
  },
  {
    label: "Smart Blog",
    href: "/dashboard/smart_blog",
    icon: PencilSquareIcon,
    section: "seo",
  },
  {
    label: "Manual Blog",
    href: "/dashboard/manual-blogs",
    icon: PencilSquareIcon,
    section: "seo",
  },
  {
    label: "Blog",
    href: "/dashboard/blog",
    icon: PencilIcon,
    section: "seo",
  },
  {
    label: "Stores",
    href: "/dashboard/stores",
    icon: IconBuildingStore,
    section: "setting",
  },
  {
    label: "Instagram Story",
    href: "/dashboard/instagram",
    icon: IconVideo,
    section: "instagram",
  },
  {
    label: "Instagram Post",
    href: "/dashboard/instagram_post",
    icon: IconImageInPicture,
    section: "instagram",
  }
];
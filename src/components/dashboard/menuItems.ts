import {
  AtSymbolIcon,
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
} from "@heroicons/react/24/outline";
import { IconBrandSpeedtest, IconBuildingStore, IconImageInPicture, IconMail, IconUpload, IconVideo } from "@tabler/icons-react";

export interface MenuItem {
  label: string;
  href?: string;
  icon: React.ElementType;
  badge?: number;
  section?: "top" | "seo" | "setting" | "crm" | "instagram";
}

export const menuItems: MenuItem[] = [
  {
    label: "Users",
    href: "/dashboard/users",
    icon: UsersIcon,
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
    label: "Dashboard",
    href: "/dashboard",
    icon: HomeIcon,
    section: "top",
  },
  {
    label: "Blog",
    href: "/dashboard/blog",
    icon: PencilIcon,
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
    label: "stores",
    href: "/dashboard/stores",
    icon: IconBuildingStore,
    section: "setting",
  },
  {
    label: "instagram story",
    href: "/dashboard/instagram",
    icon: IconVideo,
    section: "instagram",
  },
  {
    label: "instagram post",
    href: "/dashboard/instagram_post",
    icon: IconImageInPicture,
    section: "instagram",
  },
];

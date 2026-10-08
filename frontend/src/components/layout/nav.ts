import {
  BarChart3, Bot, Home, ListChecks, Plug, Settings, Sparkles, Users, Video, Zap, type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  icon: LucideIcon;
  href?: string; // real page
  comingSoon?: string; // placeholder feature description
  badge?: { text: string; tone: "green" | "purple" };
  hint?: string;
  match?: (path: string) => boolean;
}

/** Sidebar groups, in the order the current Fireflies app shows them. */
export const NAV_GROUPS: NavItem[][] = [
  [
    { label: "Home", icon: Home, href: "/", match: (p) => p === "/" },
    { label: "AskFred", icon: Bot, href: "/askfred", badge: { text: "NEW", tone: "green" } },
  ],
  [
    { label: "Meetings", icon: Video, href: "/meetings", match: (p) => p.startsWith("/meetings") || p.startsWith("/uploads") },
    { label: "Tasks", icon: ListChecks, href: "/tasks" },
    { label: "AI Skills", icon: Sparkles, comingSoon: "AI Skills run custom prompts (follow-up emails, CRM notes, coaching) on every meeting." },
  ],
  [
    { label: "Analytics", icon: BarChart3, href: "/analytics" },
    { label: "Voice Agents", icon: Bot, comingSoon: "Voice Agents hold real-time voice conversations (screening calls, interviews) for you." },
    { label: "Upgrade", icon: Zap, href: "/upgrade", badge: { text: "40% OFF", tone: "green" } },
  ],
];

export const NAV_FOOTER: NavItem[] = [
  { label: "Integrations", icon: Plug, href: "/integrations" },
  { label: "Team", icon: Users, comingSoon: "Invite teammates, share meetings and collaborate in shared channels." },
  { label: "Settings", icon: Settings, href: "/settings" },
];

export const isActive = (item: NavItem, path: string) =>
  item.match ? item.match(path) : !!item.href && (path === item.href || path.startsWith(`${item.href}/`));

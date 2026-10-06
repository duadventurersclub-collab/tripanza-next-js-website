"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import Modal from "@/components/Modal";
import { Toggle } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import {
  MessageCircle,
  Settings,
  LogOut,
  Bot,
  Users,
  Package,
  Globe,
  Radio,
  ClipboardList,
  Volume2,
  Save,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Headset,
  Menu,
  X as XIcon,
} from "lucide-react";

interface DashboardShellProps {
  children: React.ReactNode;
}

export default function DashboardShell({ children }: DashboardShellProps) {
  const { user, logout, updateUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const userRole = user?.role || "cs";
  const userName = user?.name || "Guest";

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "warning" | "info";
  }>({ isOpen: false, title: "", message: "", type: "info" });

  const [profileForm, setProfileForm] = useState({
    name: user?.name || "",
    currentPassword: "",
    password: "",
    sound_notification:
      typeof window !== "undefined"
        ? localStorage.getItem("sound_enabled") !== "false"
        : true,
  });

  const notificationTypes = [
    { type: "new_chat", label: "New waiting chats" },
    { type: "new_message", label: "Messages in your chats" },
    { type: "transfer", label: "Transferred conversations" },
    { type: "gateway", label: "CRM connection alerts" },
  ];
  const [notificationPrefs, setNotificationPrefs] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (!user) return;
    apiFetch("/api/notifications/preferences").then(r => r.json()).then(rows => {
      if (Array.isArray(rows)) setNotificationPrefs(Object.fromEntries(rows.map((p: { notif_type: string; is_enabled: boolean }) => [p.notif_type, p.is_enabled])));
    }).catch(() => {});
  }, [user?.id]);

  const isAdmin = userRole === "admin" || userRole === "super_admin";
  const basePath = isAdmin ? "/admin" : "/cs";
  const isAdminPage = pathname?.startsWith("/admin");

  const isTabActive = (tab: string) => {
    if (isAdminPage) {
      const afterAdmin = pathname === "/admin" ? "" : (pathname?.replace("/admin/", "") || "");
      const currentTab = afterAdmin || "dashboard";
      if (tab === "dashboard" && currentTab === "dashboard") return true;
      return currentTab === tab;
    } else {
      const currentTab = searchParams?.get("tab") || "";
      if (!currentTab && tab === "all") return true;
      return currentTab === tab;
    }
  };

  const navItems = isAdmin
    ? [
        { label: "Dashboard", icon: LayoutDashboard, tab: "dashboard" },
        { label: "Bot Config", icon: Bot, tab: "bot" },
        { label: "Stock", icon: Package, tab: "stock" },
        { label: "Website knowledge", icon: Globe, tab: "website" },
        { label: "Private trips", icon: Package, tab: "private-trips" },
        { label: "Messaging & automation", icon: Radio, tab: "automation" },
        { label: "Users", icon: Users, tab: "users" },
        { label: "Gateway", icon: Radio, tab: "gateway" },
        { label: "Audit Log", icon: ClipboardList, tab: "audit" },
        { label: "Agent settings", icon: Headset, tab: "cs_config" },
      ]
    : [
        { label: "My chatss", icon: Users, tab: "mine" },
        { label: "Waiting", icon: MessageCircle, tab: "waiting" },
        { label: "All", icon: ClipboardList, tab: "all" },
      ];

  const handleSaveProfile = async () => {
    try {
      const res = await apiFetch("/api/auth/profile", {
        method: "PUT",
        body: JSON.stringify(profileForm),
      });
      if (res.ok) {
        await Promise.all(notificationTypes.map(p => apiFetch("/api/notifications/preferences", { method: "PUT", body: JSON.stringify({ notif_type: p.type, is_enabled: notificationPrefs[p.type] !== false }) }).then(r => { if (!r.ok) throw new Error("Could not save notification preferences"); })));
        setProfileForm(f => ({ ...f, currentPassword: "", password: "" }));
        updateUser({ name: profileForm.name });
        localStorage.setItem(
          "sound_enabled",
          profileForm.sound_notification.toString()
        );
        setModalState({
          isOpen: true,
          title: "Saved",
          message: "Profile saved",
          type: "success",
        });
        setSettingsOpen(false);
      } else {
        throw new Error("Could not save");
      }
    } catch {
      setModalState({
        isOpen: true,
        title: "Error",
        message: "Could not save profil",
        type: "error",
      });
    }
  };

  const roleColors: Record<string, string> = {
    super_admin:
      "bg-rose-500/15 text-rose-700 border-rose-500/30",
    admin: "bg-sky-500/15 text-sky-700 border-sky-500/30",
    cs: "bg-brand-600/15 text-brand-700 border-brand-600/30",
  };

  const roleLabels: Record<string, string> = {
    super_admin: "Super Admin",
    admin: "Admin",
    cs: "CS",
  };

  // Return COMPLETE static class strings. Dynamic `from-${hue}-500` strings
  // are purged by Tailwind at build time, which previously left avatars
  // gradient-less. These light-palette variants are all statically present.
  const avatarGradient = (name: string) => {
    const safe = name || "?";
    const hash = safe.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const gradients = [
      "from-brand-600/25 to-orange-700/25",
      "from-orange-500/25 to-rose-700/25",
      "from-rose-500/25 to-brand-600/25",
      "from-brand-600/25 to-brand-600/25",
      "from-sky-500/25 to-brand-600/25",
      "from-orange-400/25 to-brand-600/25",
    ];
    return gradients[hash % gradients.length];
  };

  // Avatar initial, guarded against empty names (was `userName[0]` → crash).
  const avatarInitial = (userName || "?").trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="flex h-[100dvh] bg-slate-50 overflow-hidden text-slate-700 selection:bg-brand-600/30">
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-200/50 bg-white/90 backdrop-blur-xl shadow-sm transition-all duration-300 ease-out transform " +
          (mobileOpen
            ? "translate-x-0 "
            : "-translate-x-full ") +
          "md:relative md:translate-x-0 shrink-0 " +
          (collapsed ? "md:w-[72px]" : "w-64")
        }
      >
        <div className="flex items-center justify-between px-4 h-16 border-b border-slate-200/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-lime-300 border border-lime-400 flex items-center justify-center shrink-0 shadow-lg shadow-brand-600/10">
              <MessageCircle size={20} className="text-brand-700" />
            </div>
            {(!collapsed || mobileOpen) && (
              <span className="text-base font-bold text-slate-900 tracking-tight truncate">
                Tripanza
              </span>
            )}
          </div>
          <button
            className="md:hidden p-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100/50 rounded-lg transition-colors cursor-pointer"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <XIcon size={20} />
          </button>
        </div>

        <nav className="flex-1 flex flex-col px-2 py-4 gap-1 overflow-y-auto overflow-x-hidden">
          {navItems.map((item) => (
            <button
              key={item.tab}
              onClick={() => {
                const targetPath = isAdmin
                  ? (item.tab === "dashboard" ? "/admin" : "/admin/" + item.tab)
                  : ("/cs?tab=" + item.tab);
                router.push(targetPath);
                setMobileOpen(false);
              }}
              className={
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 cursor-pointer relative " +
                (isTabActive(item.tab)
                  ? "bg-brand-600/10 text-brand-700 font-semibold"
                  : "text-slate-600 hover:bg-slate-100/40 hover:text-slate-800")
              }
              title={
                collapsed && !mobileOpen ? item.label : undefined
              }
            >
              {isTabActive(item.tab) && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-brand-700 shadow-[0_0_8px_rgba(49,87,213,0.6)]" />
              )}
              <item.icon
                size={20}
                className={
                  "shrink-0 transition-all duration-200 " +
                  (isTabActive(item.tab)
                    ? "text-brand-700"
                    : "group-hover:text-slate-700")
                }
              />
              {(!collapsed || mobileOpen) && (
                <span className="truncate">{item.label}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="px-2 py-3 border-t border-slate-200/50 flex flex-col gap-1">
          <a href="/" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-100/50 hover:text-slate-800" title="Bot dashboard">
            <Radio size={20} className="shrink-0" />{(!collapsed || mobileOpen) && <span>Bot dashboard</span>}
          </a>
          {isAdmin && (
            <button
              onClick={() => {
                router.push("/cs?tab=all");
                setMobileOpen(false);
              }}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-100/50 hover:text-brand-700 transition-all duration-200 cursor-pointer"
              title={
                collapsed && !mobileOpen ? "Team inbox" : undefined
              }
            >
              <Headset
                size={20}
                className="shrink-0 transition-transform duration-200 hover:scale-110"
              />
              {(!collapsed || mobileOpen) && (
                <span className="truncate font-medium">Team inbox</span>
              )}
            </button>
          )}

          <button
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
            className="hidden md:flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-500 hover:bg-slate-100/50 hover:text-slate-700 transition-all duration-200 cursor-pointer"
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? (
              <PanelLeftOpen
                size={20}
                className="shrink-0 transition-transform duration-200"
              />
            ) : (
              <PanelLeftClose
                size={20}
                className="shrink-0 transition-transform duration-200"
              />
            )}
            {!collapsed && (
              <span className="truncate font-medium">Collapse</span>
            )}
          </button>

          <button
            onClick={() => {
              setProfileForm((f) => ({
                ...f,
                name: user?.name || "",
              }));
              setSettingsOpen(true);
              setMobileOpen(false);
            }}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-100/50 hover:text-slate-800 transition-all duration-200 cursor-pointer"
            title={
              collapsed && !mobileOpen
                ? "Settings"
                : undefined
            }
          >
            <Settings
              size={20}
              className="shrink-0 transition-transform duration-300 hover:rotate-90"
            />
            {(!collapsed || mobileOpen) && (
              <span className="truncate font-medium">Settings</span>
            )}
          </button>

          <button
            onClick={logout}
            aria-label="Sign out dari akun"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-600 hover:bg-rose-500/10 hover:text-rose-700 transition-all duration-200 cursor-pointer"
            title={
              collapsed && !mobileOpen ? "Sign out" : undefined
            }
          >
            <LogOut
              size={20}
              className="shrink-0 transition-transform duration-200 hover:scale-110"
            />
            {(!collapsed || mobileOpen) && (
              <span className="truncate font-medium">Sign out</span>
            )}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
        <header className="h-16 flex items-center justify-between px-4 sm:px-6 border-b border-slate-200/50 glass shrink-0 z-30">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              className="md:hidden p-2 -ml-2 rounded-xl text-slate-600 hover:text-slate-800 hover:bg-slate-100/50 transition-colors cursor-pointer"
            >
              <Menu size={24} />
            </button>
            <div className="flex items-center gap-3">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Tripanza Workspace
              </h1>
              <span className="text-[10px] sm:text-xs text-lime-900 font-medium px-2 py-0.5 rounded-md bg-lime-100 border border-lime-300 hidden sm:inline-flex">
                {isAdminPage ? "Admin" : "Team inbox"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex flex-col items-end hidden sm:flex">
              <span className="text-sm font-semibold text-slate-800 max-w-[150px] truncate">
                {userName}
              </span>
              <span
                className={
                  "text-[10px] mt-0.5 px-2 py-0.5 rounded-md font-medium border " +
                  (roleColors[userRole] ||
                    roleColors.cs)
                }
              >
                {roleLabels[userRole] || "CS"}
              </span>
            </div>
            <div className="relative">
              <div
                className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatarGradient(
                  userName
                )} border border-brand-600/20 flex items-center justify-center text-sm font-bold text-slate-800 shadow-inner`}
                aria-hidden="true"
              >
                {avatarInitial}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-brand-600 border-2 border-slate-50 shadow-sm" />
            </div>
          </div>
        </header>

        <main className="flex-1 flex flex-col overflow-hidden relative">
          {children}
        </main>
      </div>

      <Modal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Account settings"
      >
        <div className="space-y-5 mt-4">
          <div>
            <label htmlFor="profile-name" className="block text-xs font-medium text-slate-600 mb-1.5">
              Full name
            </label>
            <input
              id="profile-name"
              type="text"
              value={profileForm.name}
              onChange={(e) =>
                setProfileForm((f) => ({
                  ...f,
                  name: e.target.value,
                }))
              }
              className="w-full rounded-xl bg-white border border-slate-300/60 px-4 py-2.5 text-sm text-slate-800 placeholder-slate-500 focus-visible:outline-none focus:border-brand-600/60 focus:ring-2 focus:ring-brand-600/20 transition-all"
            />
          </div>
          <div>
            <label htmlFor="current-password" className="block text-xs text-slate-600 mb-2">Current password (to change password)</label>
            <input id="current-password" type="password" autoComplete="current-password" value={profileForm.currentPassword} onChange={e => setProfileForm(f => ({ ...f, currentPassword: e.target.value }))} className="w-full rounded-xl bg-white border border-slate-300 px-4 py-2.5 text-sm" />
          </div>
          <div>
            <label htmlFor="new-password" className="block text-xs text-slate-600 mb-2">New password (optional)</label>
            <input id="new-password" type="password" autoComplete="new-password" minLength={12} value={profileForm.password} onChange={e => setProfileForm(f => ({ ...f, password: e.target.value }))} className="w-full rounded-xl bg-white border border-slate-300 px-4 py-2.5 text-sm" />
          </div>
          <div className="space-y-3 border-t border-slate-200 pt-4">
            <h3 className="text-sm font-semibold">Push notification preferences</h3>
            {notificationTypes.map(p => <div key={p.type} className="flex items-center justify-between text-xs text-slate-600"><span>{p.label}</span><Toggle checked={notificationPrefs[p.type] !== false} onChange={value => setNotificationPrefs(prev => ({ ...prev, [p.type]: value }))} label={p.label} /></div>)}
          </div>
          <div className="flex items-center gap-3 py-2 bg-slate-100/30 px-4 rounded-xl border border-slate-200/60">
            <div className="w-8 h-8 rounded-lg bg-slate-100/80 flex items-center justify-center shrink-0">
              <Volume2 size={16} className="text-brand-700" aria-hidden="true" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-slate-800">
                Notification sound
              </span>
              <span className="text-[11px] text-slate-500">
                Play a sound for new messages
              </span>
            </div>
            <div className="ml-auto">
              <Toggle
                checked={profileForm.sound_notification}
                onChange={(next) =>
                  setProfileForm((f) => ({ ...f, sound_notification: next }))
                }
                label="Enable notification sounds"
              />
            </div>
          </div>
          <button
            onClick={handleSaveProfile}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 py-3 text-sm font-semibold text-white transition-all shadow-lg shadow-brand-600/20 hover:shadow-brand-600/40 active:scale-[0.98] cursor-pointer"
          >
            <Save size={18} />
            Save changes
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={modalState.isOpen}
        onClose={() =>
          setModalState((m) => ({ ...m, isOpen: false }))
        }
        title={modalState.title}
        message={modalState.message}
        type={modalState.type}
      />
    </div>
  );
}

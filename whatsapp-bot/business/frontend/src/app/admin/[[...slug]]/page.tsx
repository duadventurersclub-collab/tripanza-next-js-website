"use client";
import WebsiteKnowledgePanel from "@/components/WebsiteKnowledgePanel";
import PrivateTripsPanel from "@/components/PrivateTripsPanel";
import AIProviderSettings from "@/components/AIProviderSettings";
import WordpressSettings from "@/components/WordpressSettings";
import AutomationPanel from "@/components/AutomationPanel";

export const dynamic = "force-dynamic";

import { useState, useEffect, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import Modal from "@/components/Modal";
import { Toggle, Spinner } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { connect, getIO } from "@/lib/socket";
import { apiFetch } from "@/lib/api";
import { setupPushNotifications } from "@/lib/push";
import {
  Bot,
  Package,
  Users,
  Radio,
  ClipboardList,
  RefreshCw,
  Trash2,
  UserPlus,
  Power,
  Save,
  Eye,
  LayoutDashboard,
  MessageSquare,
  UserCheck,
  Star,
  TrendingUp,
  Clock,
  Wifi,
  WifiOff,
  Pencil,
  ToggleLeft,
  ToggleRight,
  Link2,
  Activity,
  Zap,
  MessageCircle,
  ArrowUpRight,
} from "lucide-react";

type TabType = "dashboard" | "bot" | "stock" | "users" | "gateway" | "audit" | "cs_config" | "website" | "private-trips" | "automation";

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="flex items-center gap-3 text-slate-500">
            <div className="w-5 h-5 rounded-full border-2 border-slate-300 border-t-brand-600 animate-spin" />
            <span className="text-sm">Loading...</span>
          </div>
        </div>
      }
    >
      <AdminContent params={useParams() as { slug?: string[] }} />
    </Suspense>
  );
}

function AdminContent({ params }: { params: { slug?: string[] } }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // Build verification marker — check this in browser console
  // console.log("[ADMIN-PAGE-v3]", { userIsNull: user === null, authLoading, slug: params.slug });

  const slug = params.slug?.[0] || "dashboard";
  const VALID_TABS: TabType[] = ["dashboard", "bot", "stock", "users", "gateway", "audit", "cs_config", "website", "private-trips", "automation"];
  const activeTab: TabType = VALID_TABS.includes(slug as TabType) ? (slug as TabType) : "dashboard";

  useEffect(() => {
    if (user && user.role === "cs") {
      router.replace("/cs");
    }
  }, [user, router]);

  useEffect(() => {
    if (!authLoading && !user) {
      if (typeof window !== "undefined") {
        sessionStorage.setItem("return_to", window.location.pathname);
      }
      router.replace("/login");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user && user.role !== "cs") {
      setupPushNotifications();
      connect();
    }
  }, [user]);

  // Safety: never render anything below this point if user is null or still loading
  if (!user || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-500">
          <div className="w-5 h-5 rounded-full border-2 border-slate-300 border-t-brand-600 animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  if (user.role === "cs") return null;

  return (
    <DashboardShell>
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 lg:p-6">
          {activeTab === "dashboard" && <DashboardPanel />}
          {activeTab === "bot" && <BotConfigPanel />}
          {activeTab === "stock" && <StockConfigPanel />}
          {activeTab === "website" && <WebsiteKnowledgePanel />}
          {activeTab === "private-trips" && <PrivateTripsPanel />}
          {activeTab === "automation" && <AutomationPanel />}
          {activeTab === "users" && <UserPanel />}
          {activeTab === "gateway" && <GatewayPanel />}
          {activeTab === "audit" && <AuditPanel />}
          {activeTab === "cs_config" && <CSConfigPanel />}
        </div>
      </div>
    </DashboardShell>
  );
}

function DashboardPanel() {
  const [stats, setStats] = useState<{
    totalConversations: number;
    activeConversations: number;
    waitingConversations: number;
    resolvedConversations: number;
    botConversations: number;
    totalCs: number;
    onlineCs: number;
    totalCustomers: number;
    todayMessages: number;
    avgRating: number;
    recentReviews: {
      id: string;
      customer_name: string | null;
      wa_number: string;
      rating: number | null;
      review: string | null;
      resolved_at: string;
    }[];
    conversationsByStatus: Record<string, number>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    apiFetch("/api/admin/dashboard-stats")
      .then((res) => res.json())
      .then((data) => {
        setStats(data);
        setLastUpdate(new Date());
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    const socket = getIO();
    if (!socket) return;
    const handler = (data: typeof stats) => {
      setStats(data);
      setLastUpdate(new Date());
      setPulse(true);
      setTimeout(() => setPulse(false), 600);
    };
    socket.on("dashboard:stats", handler);

    return () => {
      socket.off("dashboard:stats", handler);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-slate-500">
          <div className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-brand-600 animate-spin" />
          <span className="text-sm">Loading data...</span>
        </div>
      </div>
    );
  }
  if (!stats || (stats as any).error || !stats.recentReviews) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-600">
        <p>Could not load statistics. Check your administrator access.</p>
      </div>
    );
  }

  const statCards = [
    {
      label: "Total Conversations",
      value: stats.totalConversations,
      icon: MessageSquare,
      gradient: "from-sky-500/10 to-sky-500/5",
      iconBg: "bg-sky-500/15",
      iconColor: "text-sky-700",
      border: "border-sky-500/10",
    },
    {
      label: "Active",
      value: stats.activeConversations,
      icon: Zap,
      gradient: "from-brand-600/10 to-brand-600/5",
      iconBg: "bg-brand-600/15",
      iconColor: "text-brand-700",
      border: "border-brand-600/10",
    },
    {
      label: "Waiting",
      value: stats.waitingConversations,
      icon: Clock,
      gradient: "from-brand-600/10 to-brand-600/5",
      iconBg: "bg-brand-600/15",
      iconColor: "text-brand-700",
      border: "border-brand-600/10",
    },
    {
      label: "Resolved",
      value: stats.resolvedConversations,
      icon: UserCheck,
      gradient: "from-slate-500/10 to-slate-500/5",
      iconBg: "bg-slate-300/15",
      iconColor: "text-slate-600",
      border: "border-slate-300/50",
    },
    {
      label: "Agents online",
      value: stats.onlineCs,
      suffix: `/ ${stats.totalCs}`,
      icon: Users,
      gradient: "from-rose-500/10 to-rose-500/5",
      iconBg: "bg-rose-500/15",
      iconColor: "text-rose-700",
      border: "border-rose-500/10",
      pulse: stats.onlineCs > 0,
    },
    {
      label: "Total customers",
      value: stats.totalCustomers,
      icon: TrendingUp,
      gradient: "from-brand-600/10 to-brand-600/5",
      iconBg: "bg-brand-600/15",
      iconColor: "text-brand-700",
      border: "border-brand-600/10",
    },
    {
      label: "Messages today",
      value: stats.todayMessages,
      icon: MessageCircle,
      gradient: "from-sky-500/10 to-sky-500/5",
      iconBg: "bg-sky-500/15",
      iconColor: "text-sky-700",
      border: "border-sky-500/10",
    },
    {
      label: "Average rating",
      value: stats.avgRating ? stats.avgRating.toFixed(1) : "-",
      icon: Star,
      gradient: "from-yellow-500/10 to-yellow-500/5",
      iconBg: "bg-yellow-500/15",
      iconColor: "text-yellow-400",
      border: "border-yellow-500/10",
    },
  ];

  const total = stats.totalConversations || 1;
  const statusBars = [
    { label: "Bot", count: stats.botConversations, color: "bg-sky-500", pct: ((stats.botConversations / total) * 100).toFixed(1) },
    { label: "Waiting", count: stats.waitingConversations, color: "bg-brand-600", pct: ((stats.waitingConversations / total) * 100).toFixed(1) },
    { label: "Active", count: stats.activeConversations, color: "bg-brand-600", pct: ((stats.activeConversations / total) * 100).toFixed(1) },
    { label: "Resolved", count: stats.resolvedConversations, color: "bg-slate-300", pct: ((stats.resolvedConversations / total) * 100).toFixed(1) },
  ];

  return (
    <div className="max-w-6xl animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-600/10 flex items-center justify-center">
            <LayoutDashboard size={16} className="text-brand-700" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Dashboard</h2>
            <p className="text-xs text-slate-500">Live team performance</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdate && (
            <span className="text-[10px] text-slate-500">
              Live · {lastUpdate.toLocaleTimeString("id-ID")}
            </span>
          )}
          <div className={`w-2 h-2 rounded-full transition-colors duration-300 ${pulse ? "bg-brand-600 shadow-lg shadow-brand-600/50" : "bg-slate-200"}`} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {statCards.map((card) => (
          <div
            key={card.label}
            className={
              "group relative rounded-xl border bg-gradient-to-b " +
              card.gradient + " " + card.border +
              " p-4 hover:border-slate-300/50 transition-all duration-200 cursor-pointer"
            }
          >
            <div className="flex items-start justify-between mb-3">
              <div className={"rounded-lg p-2 relative " + card.iconBg}>
                <card.icon size={17} className={card.iconColor} />
                {"pulse" in card && card.pulse && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-brand-600 border-2 border-slate-50 animate-pulse" />
                )}
              </div>
              <ArrowUpRight
                size={14}
                className="text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity"
              />
            </div>
            <p className="text-[28px] font-bold text-slate-900 leading-none tracking-tight tabular-nums">
              {card.value}
              {"suffix" in card && card.suffix && (
                <span className="text-sm font-normal text-slate-500 ml-1">{card.suffix}</span>
              )}
            </p>
            <p className="text-[11px] text-slate-500 mt-1.5 font-medium tracking-wide uppercase">
              {card.label}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-slate-800">
              Conversations by status
            </h3>
            <span className="text-[10px] text-slate-500">
              Total {stats.totalConversations}
            </span>
          </div>
          <div className="space-y-4">
            {statusBars.map((bar) => (
              <div key={bar.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className={"w-2.5 h-2.5 rounded-sm " + bar.color} />
                    <span className="text-xs text-slate-600 font-medium">
                      {bar.label}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">
                    {bar.count} <span className="text-slate-500">({bar.pct}%)</span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={"h-full rounded-full transition-all duration-700 ease-out " + bar.color}
                    style={{ width: Math.max(2, (bar.count / total) * 100) + "%" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-800">
              Recent reviews
            </h3>
            {stats.recentReviews.length > 0 && (
              <span className="text-[10px] text-slate-500">
                {stats.recentReviews.length} review
              </span>
            )}
          </div>
          {stats.recentReviews.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Star size={24} className="text-slate-600 mb-2" />
              <p className="text-xs text-slate-500">No reviews yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {stats.recentReviews.slice(0, 6).map((review) => (
                <div
                  key={review.id}
                  className="rounded-lg border border-slate-200/50 bg-slate-50/50 p-3 hover:border-slate-300/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-700 truncate max-w-[120px]">
                      {review.customer_name || review.wa_number}
                    </span>
                    <div className="flex items-center gap-0.5 shrink-0">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          size={10}
                          className={
                            star <= (review.rating || 0)
                              ? "text-yellow-400 fill-yellow-400"
                              : "text-slate-600"
                          }
                        />
                      ))}
                    </div>
                  </div>
                  {review.review ? (
                    <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">
                      {review.review}
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-500 italic">No comment</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <CSPerformanceTable />

    </div>
  );
}

function CSPerformanceTable() {
  const [csStats, setCsStats] = useState<{
    id: string;
    name: string;
    role: string;
    is_online: boolean;
    total_claimed: number;
    total_resolved: number;
    avg_rating: number | null;
    active_count: number;
  }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/admin/cs-stats")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setCsStats(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (csStats.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 mt-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-800">
          Agent performance
        </h3>
        <span className="text-[10px] text-slate-500">
          {csStats.length} CS
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wider">CS</th>
              <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Role</th>
              <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Status</th>
              <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Claimed</th>
              <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Resolved</th>
              <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Active</th>
              <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Rating</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/50">
            {csStats.map((cs) => (
              <tr key={cs.id} className="hover:bg-slate-100/30 transition-colors">
                <td className="px-3 py-3 text-slate-800 font-medium text-xs">{cs.name}</td>
                <td className="px-3 py-3 text-center">
                  <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${
                    cs.role === "admin" ? "bg-sky-500/10 text-sky-700" : "bg-brand-600/10 text-brand-700"
                  }`}>
                    {cs.role === "admin" ? "Admin" : "CS"}
                  </span>
                </td>
                <td className="px-3 py-3 text-center">
                  <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    cs.is_online ? "bg-brand-600/10 text-brand-700" : "bg-slate-200/50 text-slate-500"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cs.is_online ? "bg-brand-700" : "bg-slate-300"}`} />
                    {cs.is_online ? "Online" : "Offline"}
                  </span>
                </td>
                <td className="px-3 py-3 text-center text-xs text-slate-700 font-mono">{cs.total_claimed}</td>
                <td className="px-3 py-3 text-center text-xs text-slate-700 font-mono">{cs.total_resolved}</td>
                <td className="px-3 py-3 text-center text-xs text-slate-700 font-mono">{cs.active_count}</td>
                <td className="px-3 py-3 text-center text-xs">
                  {cs.avg_rating != null ? (
                    <span className="font-medium text-yellow-400">{cs.avg_rating}</span>
                  ) : (
                    <span className="text-slate-500">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BotConfigPanel() {
  const [form, setForm] = useState<{
    persona_name: string;
    system_prompt: string;
    business_info: string;
    escalation_keywords: string;
    session_timeout_mins: number | "";
    session_timeout_warning_mins: number | "";
    auto_close_enabled: boolean;
  }>({
    persona_name: "",
    system_prompt: "",
    business_info: "",
    escalation_keywords: "",
    session_timeout_mins: 30,
    session_timeout_warning_mins: 5,
    auto_close_enabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "warning" | "info";
  }>({ isOpen: false, title: "", message: "", type: "info" });

  useEffect(() => {
    apiFetch("/api/admin/bot-config")
      .then((res) => res.json())
      .then((data) => {
        const config = data.config || data;
        setForm({
          persona_name: config.persona_name || "",
          system_prompt: config.system_prompt || "",
          business_info: config.business_info || "",
          escalation_keywords: config.escalation_keywords || "",
          session_timeout_mins: config.session_timeout_mins ?? 30,
          session_timeout_warning_mins: config.session_timeout_warning_mins ?? 5,
          auto_close_enabled: config.auto_close_enabled ?? false,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const timeoutVal = typeof form.session_timeout_mins === "number" && form.session_timeout_mins >= 1
        ? form.session_timeout_mins
        : 30;

      const warningVal = typeof form.session_timeout_warning_mins === "number" && form.session_timeout_warning_mins >= 0
        ? form.session_timeout_warning_mins
        : 5;

      const payload = {
        ...form,
        session_timeout_mins: timeoutVal,
        session_timeout_warning_mins: warningVal,
      };

      const res = await apiFetch("/api/admin/bot-config", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Could not save");
      }

      setForm((f) => ({ ...f, session_timeout_mins: timeoutVal, session_timeout_warning_mins: warningVal }));

      setModal({
        isOpen: true,
        title: "Saved",
        message: "Chatbot settings saved",
        type: "success",
      });
    } catch (err: any) {
      setModal({
        isOpen: true,
        title: "Error",
        message: err.message || "Could not save konfigurasi bot",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-slate-500">
          <div className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-brand-600 animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl animate-fadeIn">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded-lg bg-brand-600/10 flex items-center justify-center">
          <Bot size={16} className="text-brand-700" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">AI chatbot settings</h2>
          <p className="text-xs text-slate-500">AI connection, conversational style, and automation</p>
        </div>
      </div>

      <AIProviderSettings />
      <WordpressSettings />
      <div className="rounded-xl border border-brand-600/20 bg-brand-600/5 p-4 mb-5 text-sm text-slate-700">
        <p>The assistant follows each customer&apos;s conversation, matches their language, and remembers explicitly shared travel preferences. It asks one useful question at a time and keeps trip details tied to your selected website links.</p>
        <p className="text-xs text-slate-600 mt-2">Use the writing instructions below to adjust its tone. Your saved AI API key powers the replies. Private-trip quotes remain inactive until their data connections are ready.</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-5">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Assistant name
          </label>
          <input
            type="text"
            value={form.persona_name}
            onChange={(e) => setForm((f) => ({ ...f, persona_name: e.target.value }))}
            placeholder="Kanika"
            className="w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-500 focus:outline-none focus:border-brand-600/50 focus:ring-1 focus:ring-brand-600/20 transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Assistant writing instructions
          </label>
          <textarea
            value={form.system_prompt}
            onChange={(e) => setForm((f) => ({ ...f, system_prompt: e.target.value }))}
            rows={6}
            placeholder="Warm, concise WhatsApp replies. Use *bold headings*, - bullet points, and key highlights for details. Match the customer's language and avoid repeating questions."
            className="w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-500 focus:outline-none focus:border-brand-600/50 focus:ring-1 focus:ring-brand-600/20 resize-none transition-all font-mono"
          />
          <p className="text-xs text-slate-500 mt-2">The consultant adapts to first enquiries, stays, discounts, concerns, and booking interest while remembering supplied details. Trip details use headings and bullets; casual replies stay short. A clear first trip enquiry gets its official PDF and available reels, and stay enquiries get accommodation photos.</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Business information
          </label>
          <textarea
            value={form.business_info}
            onChange={(e) => setForm((f) => ({ ...f, business_info: e.target.value }))}
            rows={4}
            placeholder="Jam operasional, alamat, kebijakan, FAQ..."
            className="w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-500 focus:outline-none focus:border-brand-600/50 focus:ring-1 focus:ring-brand-600/20 resize-none transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Handoff keywords (comma separated)
          </label>
          <input
            type="text"
            value={form.escalation_keywords}
            onChange={(e) => setForm((f) => ({ ...f, escalation_keywords: e.target.value }))}
            placeholder="bicara admin, CS, supervisor"
            className="w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-500 focus:outline-none focus:border-brand-600/50 focus:ring-1 focus:ring-brand-600/20 transition-all"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Session timeout (minutes)
            </label>
            <input
              type="number"
              value={form.session_timeout_mins}
              onChange={(e) => {
                const val = e.target.value;
                setForm((f) => ({
                  ...f,
                  session_timeout_mins: val === "" ? "" : parseInt(val) || 0,
                }));
              }}
              min={1}
              max={1440}
              className="w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-500 focus:outline-none focus:border-brand-600/50 focus:ring-1 focus:ring-brand-600/20 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Warn before timeout (minutes)
            </label>
            <input
              type="number"
              value={form.session_timeout_warning_mins}
              onChange={(e) => {
                const val = e.target.value;
                setForm((f) => ({
                  ...f,
                  session_timeout_warning_mins: val === "" ? "" : parseInt(val) || 0,
                }));
              }}
              min={0}
              max={1440}
              className="w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-500 focus:outline-none focus:border-brand-600/50 focus:ring-1 focus:ring-brand-600/20 transition-all"
            />
          </div>
          <div className="flex flex-col justify-end pb-1 col-span-2 sm:col-span-1">
            <label className="text-xs font-medium text-slate-600 mb-2 block">
              Auto Close
            </label>
            <Toggle
              checked={form.auto_close_enabled}
              onChange={(next) => setForm((f) => ({ ...f, auto_close_enabled: next }))}
              label="Activekan auto close sesi"
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors disabled:opacity-50"
        >
          <Save size={15} />
          {saving ? "Saving..." : "Save settings"}
        </button>
      </div>

      <Modal
        isOpen={modal.isOpen}
        onClose={() => setModal((m) => ({ ...m, isOpen: false }))}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />
    </div>
  );
}

function StockConfigPanel() {
  const [sourceType, setSourceType] = useState<"google_sheets" | "mysql" | "postgresql">("google_sheets");
  const [configJson, setConfigJson] = useState("{}");
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<Record<string, string>[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [jsonError, setJsonError] = useState("");
  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "warning" | "info";
  }>({ isOpen: false, title: "", message: "", type: "info" });

  useEffect(() => {
    apiFetch("/api/admin/stock-config")
      .then((res) => res.json())
      .then((data) => {
        const config = data.config || data;
        setSourceType(config.source_type || "google_sheets");
        setIsActive(config.is_active ?? false);
        const cj = config.config_json;
        if (typeof cj === "string") {
          try {
            setConfigJson(JSON.stringify(JSON.parse(cj), null, 2));
          } catch {
            setConfigJson(cj);
          }
        } else {
          setConfigJson(JSON.stringify(cj || {}, null, 2));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(configJson);
    } catch {
      setJsonError("Invalid JSON. Please check the format.");
      return;
    }
    setJsonError("");

    setSaving(true);
    try {
      const res = await apiFetch("/api/admin/stock-config", {
        method: "PUT",
        body: JSON.stringify({ source_type: sourceType, config_json: parsed, is_active: isActive }),
      });
      if (!res.ok) throw new Error("Could not save");
      setModal({
        isOpen: true,
        title: "Saved",
        message: "Stock settings saved",
        type: "success",
      });
    } catch {
      setModal({
        isOpen: true,
        title: "Error",
        message: "Could not save konfigurasi stok",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    setPreviewLoading(true);
    try {
      const res = await apiFetch("/api/admin/stock/preview");
      const json = await res.json();
      const rows = Array.isArray(json) ? json : (json.rows || json.data || json.preview || []);
      setPreview(rows);
    } catch {
      setModal({
        isOpen: true,
        title: "Error",
        message: "Could not load preview stok",
        type: "error",
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-slate-500">
          <div className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-brand-600 animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl animate-fadeIn">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded-lg bg-brand-600/10 flex items-center justify-center">
          <Package size={16} className="text-brand-700" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Stock integration</h2>
          <p className="text-xs text-slate-500">Connect and synchronize stock data</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-5">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Source Type
          </label>
          <select
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value as typeof sourceType)}
            className="w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-brand-600/50 focus:ring-1 focus:ring-brand-600/20 transition-all"
          >
            <option value="google_sheets">Google Sheets</option>
            <option value="mysql">MySQL</option>
            <option value="postgresql">PostgreSQL</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Config JSON
          </label>
          {sourceType === "google_sheets" && (
            <div className="mb-2 text-[10px] text-slate-500 space-y-0.5 bg-slate-50/50 rounded-lg p-2.5 border border-slate-200/50">
              <p>Format: {`{ "spreadsheet_id": "...", "sheet_name": "Sheet1", "header_row": 1, "columns": { "name": "A", "price": "B", "stock": "C" }, "credentials_path": "credentials/service-account.json" }`}</p>
              <p className="text-slate-500 mt-1">Store your service account JSON securely and configure its path below.</p>
            </div>
          )}
          {(sourceType === "mysql" || sourceType === "postgresql") && (
            <div className="mb-2 text-[10px] text-slate-500 space-y-0.5 bg-slate-50/50 rounded-lg p-2.5 border border-slate-200/50">
              <p>Format: {`{ "host": "...", "port": ${sourceType === "mysql" ? "3306" : "5432"}, "database": "...", "user": "...", "password": "...", "table": "products", "col_name": "nama_produk", "col_qty": "stok", "col_price": "harga" }`}</p>
              <p className="mt-1">Use a database user with <span className="text-brand-700">read-only</span> permissions.</p>
            </div>
          )}
          <textarea
            value={configJson}
            onChange={(e) => {
              setConfigJson(e.target.value);
              setJsonError("");
            }}
            rows={12}
            className="w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5 text-sm font-mono text-slate-800 placeholder-slate-500 focus:outline-none focus:border-brand-600/50 focus:ring-1 focus:ring-brand-600/20 resize-none transition-all"
          />
          {jsonError && (
            <p className="text-xs text-rose-700 mt-1.5 flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-rose-400" />
              {jsonError}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-slate-600">Enable stock sync</label>
          <Toggle
            checked={isActive}
            onChange={setIsActive}
            label="Activekan sinkronisasi stok"
          />
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors disabled:opacity-50"
          >
            <Save size={15} />
            {saving ? "Saving..." : "Save"}
          </button>

          <button
            onClick={handlePreview}
            disabled={previewLoading}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            <Eye size={15} />
            {previewLoading ? "Loading..." : "Preview"}
          </button>
        </div>

        {preview && preview.length > 0 && (
          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    {Object.keys(preview[0]).map((key) => (
                      <th key={key} className="px-3 py-2.5 text-left font-medium text-slate-600">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className="border-b border-slate-200/50 hover:bg-slate-50/50 transition-colors">
                      {Object.values(row).map((val, j) => (
                        <td key={j} className="px-3 py-2.5 text-slate-700">
                          {String(val)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {preview && preview.length === 0 && (
          <p className="text-xs text-slate-500 text-center py-4">No stock data yet</p>
        )}
      </div>

      <Modal
        isOpen={modal.isOpen}
        onClose={() => setModal((m) => ({ ...m, isOpen: false }))}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />
    </div>
  );
}

interface User {
  id: string;
  name: string;
  email: string;
  role: "super_admin" | "admin" | "cs";
  is_active: boolean;
  is_online?: boolean;
  created_at: string;
}

function UserPanel() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "cs" as User["role"],
  });
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    role: "cs" as User["role"],
    is_active: true,
    password: "",
  });
  const [editLoading, setEditLoading] = useState(false);
  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "warning" | "info";
  }>({ isOpen: false, title: "", message: "", type: "info" });

  const fetchUsers = () => {
    setLoading(true);
    apiFetch("/api/admin/users")
      .then((res) => res.json())
      .then((data) => {
        setUsers((data.users || data || []).filter(Boolean));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await apiFetch("/api/admin/users", {
        method: "POST",
        body: JSON.stringify(createForm),
      });
      if (!res.ok) throw new Error("Could not create the team member");
      setModal({ isOpen: true, title: "Saved", message: "Team member created", type: "success" });
      setShowCreate(false);
      setCreateForm({ name: "", email: "", password: "", role: "cs" });
      fetchUsers();
    } catch {
      setModal({ isOpen: true, title: "Error", message: "Could not create the team member", type: "error" });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await apiFetch("/api/admin/users/" + deleteTarget.id, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete the team member");
      setModal({ isOpen: true, title: "Saved", message: "Team member deleted", type: "success" });
      fetchUsers();
    } catch {
      setModal({ isOpen: true, title: "Error", message: "Could not delete the team member", type: "error" });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleToggleActive = async (u: User) => {
    try {
      const res = await apiFetch("/api/admin/users/" + u.id, {
        method: "PUT",
        body: JSON.stringify({ is_active: !u.is_active }),
      });
      if (!res.ok) throw new Error("Could not update status");
      fetchUsers();
    } catch {
      setModal({ isOpen: true, title: "Error", message: "Could not update account status", type: "error" });
    }
  };

  const openEdit = (u: User) => {
    setEditTarget(u);
    setEditForm({ name: u.name, email: u.email, role: u.role, is_active: u.is_active, password: "" });
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    setEditLoading(true);
    try {
      const body: Record<string, unknown> = {
        name: editForm.name,
        email: editForm.email,
        role: editForm.role,
        is_active: editForm.is_active,
      };
      if (editForm.password) body.password = editForm.password;
      const res = await apiFetch("/api/admin/users/" + editTarget.id, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Could not update the team member");
      setModal({ isOpen: true, title: "Saved", message: "Team member updated", type: "success" });
      setEditTarget(null);
      fetchUsers();
    } catch {
      setModal({ isOpen: true, title: "Error", message: "Could not update the team member", type: "error" });
    } finally {
      setEditLoading(false);
    }
  };

  const roleColors: Record<string, string> = {
    super_admin: "bg-rose-500/15 text-rose-700 border-rose-500/20",
    admin: "bg-sky-500/15 text-sky-700 border-sky-500/20",
    cs: "bg-brand-600/15 text-brand-700 border-brand-600/20",
  };

  const roleLabels: Record<string, string> = {
    super_admin: "Super Admin",
    admin: "Admin",
    cs: "CS",
  };

  const ROLE_LEVEL: Record<string, number> = {
    super_admin: 3,
    admin: 2,
    cs: 1,
  };

  const actorRole = user ? user.role : "cs";
  const actorRoleLevel = ROLE_LEVEL[actorRole] || 0;
  const allowedRoles = Object.keys(ROLE_LEVEL).filter(
    (r) => (ROLE_LEVEL[r] || 0) < actorRoleLevel
  );

  function canModify(target: User | null | undefined): boolean {
    if (!target) return false;
    return (ROLE_LEVEL[target.role] || 0) < actorRoleLevel && target.id !== user?.id;
  }

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-600/10 flex items-center justify-center">
            <Users size={16} className="text-brand-700" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Team members</h2>
            <p className="text-xs text-slate-500">{users.length} user terdaftar</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
        >
          <UserPlus size={15} />
          Add team member
        </button>
      </div>

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-brand-600/20 bg-white p-5 mb-4 space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
              <input
                type="text"
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                required
                className="w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-500 focus:outline-none focus:border-brand-600/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
              <input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                required
                className="w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-500 focus:outline-none focus:border-brand-600/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Password (minimum 6 characters)</label>
              <input
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                required
                minLength={6}
                className="w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-500 focus:outline-none focus:border-brand-600/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
              <select
                value={createForm.role}
                onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value as User["role"] }))}
                className="w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-brand-600/50 transition-all"
              >
                {allowedRoles.map((r) => (
                  <option key={r} value={r}>{roleLabels[r] || r}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors disabled:opacity-50"
            >
              {creating ? "Creating..." : "Save"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-3 text-slate-500">
            <div className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-brand-600 animate-spin" />
            <span className="text-sm">Loading team...</span>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-white/50">
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Name</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Email</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Role</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Koneksi</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/50">
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Users size={24} className="text-slate-600" />
                      <p className="text-sm text-slate-500">No team members yet</p>
                    </div>
                  </td>
                </tr>
              )}
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-100/30 transition-colors">
                  <td className="px-4 py-3.5">
                    <span className="font-medium text-slate-800">{u.name}</span>
                  </td>
                  <td className="px-4 py-3.5 text-slate-600 text-xs">{u.email}</td>
                  <td className="px-4 py-3.5">
                    <span className={"text-[10px] px-2 py-0.5 rounded-full font-medium border " + (roleColors[u.role] || roleColors.cs)}>
                      {roleLabels[u.role] || "CS"}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={"inline-flex items-center gap-1.5 text-xs " + (u.is_active ? "text-brand-700" : "text-slate-500")}>
                      <span className={"w-1.5 h-1.5 rounded-full " + (u.is_active ? "bg-brand-700" : "bg-slate-300")} />
                      {u.is_active ? "Active" : "Nonaktif"}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={"inline-flex items-center gap-1.5 text-xs " + (u.is_online ? "text-brand-700 font-medium" : "text-slate-500")}>
                      <span className={"w-1.5 h-1.5 rounded-full " + (u.is_online ? "bg-brand-700 animate-pulse" : "bg-slate-300")} />
                      {u.is_online ? "Online" : "Offline"}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleToggleActive(u)}
                        disabled={!canModify(u)}
                        title={
                          !canModify(u)
                            ? u.id === user?.id
                              ? "You cannot change your own status"
                              : "You cannot change an account with this role"
                            : u.is_active
                              ? "Nonaktifkan"
                              : "Activekan"
                        }
                        className={
                          "inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors " +
                          (!canModify(u)
                            ? "opacity-30 cursor-not-allowed bg-slate-100 text-slate-500"
                            : u.is_active
                              ? "bg-brand-600/10 text-brand-700 hover:bg-brand-600/20"
                              : "bg-brand-600/10 text-brand-700 hover:bg-brand-600/20")
                        }
                      >
                        {u.is_active ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                      </button>
                      <button
                        onClick={() => openEdit(u)}
                        disabled={!canModify(u)}
                        title={
                          !canModify(u)
                            ? u.id === user?.id
                              ? "Edit your profile in account settings"
                              : "You cannot edit an account with this role"
                            : "Edit"
                        }
                        className={
                          "inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors " +
                          (!canModify(u)
                            ? "opacity-30 cursor-not-allowed bg-slate-100 text-slate-500"
                            : "bg-sky-500/10 text-sky-700 hover:bg-sky-500/20")
                        }
                      >
                        <Pencil size={13} />
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(u)}
                        disabled={!canModify(u)}
                        title={
                          !canModify(u)
                            ? u.id === user?.id
                              ? "You cannot delete your own account"
                              : "You cannot delete an account with this role"
                            : "Delete"
                        }
                        className={
                          "inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors " +
                          (!canModify(u)
                            ? "opacity-30 cursor-not-allowed bg-slate-100 text-slate-500"
                            : "bg-rose-500/10 text-rose-700 hover:bg-rose-500/20")
                        }
                      >
                        <Trash2 size={13} />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        type="warning"
        isConfirm
        title="Delete User"
        message={"Anda yakin ingin menghapus user \"" + (deleteTarget?.name || "") + "\"? Tindakan ini tidak dapat dibatalkan."}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDelete}
      />

      <Modal
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Edit User"
      >
        <div className="space-y-3 mt-2">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-brand-600/50 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
            <input
              type="email"
              value={editForm.email}
              onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-brand-600/50 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
            <select
              value={editForm.role}
              onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value as User["role"] }))}
              disabled={!canModify(editTarget!)}
              className="w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-brand-600/50 transition-all disabled:opacity-50"
            >
              {allowedRoles.map((r) => (
                <option key={r} value={r}>{roleLabels[r] || r}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-xs font-medium text-slate-600">Active</span>
            <Toggle
              checked={editForm.is_active}
              onChange={(next) => setEditForm((f) => ({ ...f, is_active: next }))}
              label="Status aktif user"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">New password (optional)</label>
            <input
              type="password"
              value={editForm.password}
              onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="Minimal 6 karakter"
              className="w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-brand-600/50 transition-all"
            />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setEditTarget(null)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleEdit}
              disabled={editLoading}
              className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors disabled:opacity-50"
            >
              {editLoading ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={modal.isOpen}
        onClose={() => setModal((m) => ({ ...m, isOpen: false }))}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />
    </div>
  );
}

function GatewayPanel() {
  const [status, setStatus] = useState<"connected" | "disconnected" | "loading">("loading");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "warning" | "info";
  }>({ isOpen: false, title: "", message: "", type: "info" });

  useEffect(() => {
    const fetchStatus = () => {
      apiFetch("/api/gateway/status")
        .then((res) => res.json())
        .then((data) => {
          setStatus(data.status === "connected" ? "connected" : "disconnected");
          if (data.status !== "connected") {
            apiFetch("/api/gateway/qr")
              .then((res) => res.json())
              .then((qr) => setQrCode(qr.qr_code || qr.qr || null))
              .catch(() => {});
          } else {
            setQrCode(null);
          }
        })
        .catch(() => setStatus("disconnected"));
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);

    const socket = getIO();
    socket?.on("gateway:status", (data: { status: string }) => {
      setStatus(data.status === "connected" ? "connected" : "disconnected");
    });

    return () => {
      clearInterval(interval);
      socket?.off("gateway:status");
    };
  }, []);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await apiFetch("/api/gateway/disconnect", { method: "POST" });
      if (!res.ok) throw new Error("Disconnect failed");
      setModal({ isOpen: true, title: "Saved", message: "CRM gateway disconnected", type: "success" });
    } catch {
      setModal({ isOpen: true, title: "Error", message: "Could not disconnect the CRM gateway", type: "error" });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await apiFetch("/api/gateway/connect", { method: "POST" });
      if (!res.ok) throw new Error("Connect failed");
      setModal({ isOpen: true, title: "Saved", message: "Connecting the CRM gateway", type: "success" });
    } catch {
      setModal({ isOpen: true, title: "Error", message: "Could not connect the CRM gateway", type: "error" });
    } finally {
      setConnecting(false);
    }
  };

  const statusConfig = {
    connected: {
      color: "from-brand-600/20 to-brand-600/5 border-brand-600/20",
      dot: "bg-brand-700 shadow-[0_0_8px_rgba(49,87,213,0.5)]",
      label: "Terhubung",
      icon: Wifi,
      iconColor: "text-brand-700",
    },
    disconnected: {
      color: "from-rose-500/10 to-rose-500/5 border-rose-500/20",
      dot: "bg-rose-400",
      label: "Terputus",
      icon: WifiOff,
      iconColor: "text-rose-700",
    },
    loading: {
      color: "from-brand-600/10 to-brand-600/5 border-brand-600/20",
      dot: "bg-brand-700 animate-pulse shadow-[0_0_8px_rgba(49,87,213,0.5)]",
      label: "Memeriksa...",
      icon: Activity,
      iconColor: "text-brand-700",
    },
  };

  const current = statusConfig[status];
  const StatusIcon = current.icon;

  return (
    <div className="max-w-lg animate-fadeIn">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded-lg bg-brand-600/10 flex items-center justify-center">
          <Radio size={16} className="text-brand-700" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">WhatsApp Gateway</h2>
          <p className="text-xs text-slate-500">Your shared CRM connection</p>
        </div>
      </div>

      <div className={"rounded-xl border bg-gradient-to-b p-6 " + current.color}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-slate-50/50 flex items-center justify-center border border-slate-200/50">
            <StatusIcon size={20} className={current.iconColor} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={"w-2 h-2 rounded-full " + current.dot} />
              <span className="text-sm font-semibold text-slate-800">{current.label}</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {status === "connected" ? "WhatsApp is connected and ready" : status === "disconnected" ? "CRM gateway is disconnected" : "Connecting..."}
            </p>
          </div>
          {status === "disconnected" && (
            <button
              onClick={() => {
                apiFetch("/api/gateway/qr")
                  .then((r) => r.json())
                  .then((d) => setQrCode(d.qr_code || d.qr || null))
                  .catch(() => {});
              }}
              className="ml-auto flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <RefreshCw size={12} />
              Refresh QR
            </button>
          )}
        </div>

        {qrCode && status === "disconnected" && (
          <div className="flex flex-col items-center gap-3 mb-5">
            <p className="text-xs text-slate-600">Scan this QR code with WhatsApp</p>
            <div className="rounded-xl bg-white p-4 shadow-lg">
              <img
                src={qrCode.startsWith("data:") ? qrCode : "data:image/png;base64," + qrCode}
                alt="QR Code"
                className="w-48 h-48"
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={handleConnect}
            disabled={connecting || status === "connected"}
            className="flex items-center gap-2 rounded-lg bg-brand-600/10 border border-brand-600/20 px-4 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-600/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Link2 size={15} />
            {connecting ? "Connecting..." : "Connect"}
          </button>
          <button
            onClick={handleDisconnect}
            disabled={disconnecting || status !== "connected"}
            className="flex items-center gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-4 py-2.5 text-sm font-medium text-rose-700 hover:bg-rose-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Power size={15} />
            {disconnecting ? "Memutuskan..." : "Disconnect"}
          </button>
        </div>
      </div>

      <Modal
        isOpen={modal.isOpen}
        onClose={() => setModal((m) => ({ ...m, isOpen: false }))}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />
    </div>
  );
}

function AuditPanel() {
  const [logs, setLogs] = useState<
    { id: string; user_name?: string; action: string; details?: string; created_at: string }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/admin/audit-log")
      .then((res) => res.json())
      .then((data) => {
        setLogs(Array.isArray(data) ? data : Array.isArray(data?.logs) ? data.logs : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded-lg bg-brand-600/10 flex items-center justify-center">
          <ClipboardList size={16} className="text-brand-700" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Audit Log</h2>
          <p className="text-xs text-slate-500">Workspace activity history</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-3 text-slate-500">
            <div className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-brand-600 animate-spin" />
            <span className="text-sm">Loading activity...</span>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-white/50">
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Time</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">User</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/50">
              {logs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <ClipboardList size={24} className="text-slate-600" />
                      <p className="text-sm text-slate-500">No activity yet</p>
                    </div>
                  </td>
                </tr>
              )}
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-100/30 transition-colors">
                  <td className="px-4 py-3.5 text-slate-500 font-mono text-xs">
                    {new Date(log.created_at).toLocaleString("id-ID")}
                  </td>
                  <td className="px-4 py-3.5 text-slate-700 text-xs">{log.user_name || "-"}</td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-slate-500 text-xs max-w-xs truncate">{log.details || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CSConfigPanel() {
  const [config, setConfig] = useState<{
    signatureEnabled: boolean;
    signatureTemplate: string;
    quickReplies: string[];
    autoReplyClaimEnabled: boolean;
    autoReplyClaim: string;
    autoReplyResolveEnabled: boolean;
    autoReplyResolve: string;
    waGroupNotifEnabled: boolean;
    waGroupJid: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "warning" | "info";
  }>({ isOpen: false, title: "", message: "", type: "info" });

  useEffect(() => {
    apiFetch("/api/admin/cs-config")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setConfig(data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await apiFetch("/api/admin/cs-config", {
        method: "PUT",
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error("Could not save konfigurasi");
      const data = await res.json();
      setConfig(data);
      setModal({
        isOpen: true,
        title: "Saved",
        message: "Agent settings saved",
        type: "success",
      });
    } catch (err: any) {
      setModal({
        isOpen: true,
        title: "Error",
        message: err.message || "Could not save konfigurasi CS",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-slate-500">
          <Spinner size={16} />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }
  if (!config) return null;

  return (
    <div className="max-w-2xl mx-auto animate-fadeIn">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded-lg bg-brand-600/10 flex items-center justify-center">
          <MessageSquare size={16} className="text-brand-700" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Customer service settings</h2>
          <p className="text-xs text-slate-500">Set up agent signatures and automatic replies</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
        <div className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-700 text-sm">
              {error}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-slate-700">Enable agent signatures</label>
              <Toggle
                checked={config.signatureEnabled}
                onChange={(next) => setConfig({ ...config, signatureEnabled: next })}
                label="Activekan signature otomatis"
              />
            </div>
            <p className="text-xs text-slate-500">Add a signature to every message sent by an agent.</p>
          </div>

          {config.signatureEnabled && (
            <div className="animate-in fade-in slide-in-from-top-4 duration-300">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Signature template
              </label>
              <input
                type="text"
                value={config.signatureTemplate}
                onChange={(e) => setConfig({ ...config, signatureTemplate: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-brand-600/50"
                placeholder="Misal: - {name} (Customer Service)"
              />
              <p className="mt-2 text-xs text-slate-500">
                Insert <code className="text-brand-700 bg-brand-700/10 px-1 py-0.5 rounded">{"{name}"}</code> to insert the sending agent?s name.
              </p>

              <div className="mt-4 p-4 rounded-xl bg-slate-100/50 border border-slate-300">
                <span className="text-xs text-slate-500 mb-2 block font-medium">Stock preview:</span>
                <div className="text-sm text-slate-700">
                  <p>Hello! How can I help you today?</p>
                  <p className="mt-2 text-slate-600 whitespace-pre-wrap">{config.signatureTemplate.replace("{name}", "Budi")}</p>
                </div>
              </div>
            </div>
          )}

          <div className="pt-6 border-t border-slate-200">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Quick replies
            </label>
            <p className="text-xs text-slate-500 mb-3">Enter one reply per line. Agents can insert these replies while chatting.</p>
            <textarea
              value={config.quickReplies?.join("\n") || ""}
              onChange={(e) => setConfig({ ...config, quickReplies: e.target.value.split("\n") })}
              rows={4}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-brand-600/50 custom-scrollbar"
              placeholder="Hello! How can we help you today?&#10;Mohon tunggu sebentar ya..."
            />
          </div>

          <div className="pt-6 border-t border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-slate-700">Automatic reply when a chat is claimed</label>
              <Toggle
                checked={config.autoReplyClaimEnabled}
                onChange={(next) => setConfig({ ...config, autoReplyClaimEnabled: next })}
                label="Activekan pesan otomatis saat chat diambil"
              />
            </div>
            {config.autoReplyClaimEnabled && (
              <div className="mt-3 animate-in fade-in slide-in-from-top-2">
                <textarea
                  value={config.autoReplyClaim}
                  onChange={(e) => setConfig({ ...config, autoReplyClaim: e.target.value })}
                  rows={2}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-brand-600/50"
                  placeholder="Misal: Halo, dengan CS {name} di sini..."
                />
                <p className="mt-1 text-xs text-slate-500">Insert {"{name}"} untuk menyisipkan nama CS.</p>
              </div>
            )}
          </div>

          <div className="pt-6 border-t border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-slate-700">Automatic reply when a chat is resolved</label>
              <Toggle
                checked={config.autoReplyResolveEnabled}
                onChange={(next) => setConfig({ ...config, autoReplyResolveEnabled: next })}
                label="Activekan pesan otomatis saat chat diselesaikan"
              />
            </div>
            {config.autoReplyResolveEnabled && (
              <div className="mt-3 animate-in fade-in slide-in-from-top-2">
                <textarea
                  value={config.autoReplyResolve}
                  onChange={(e) => setConfig({ ...config, autoReplyResolve: e.target.value })}
                  rows={2}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-brand-600/50"
                  placeholder="Misal: Terima kasih telah menghubungi kami..."
                />
                <p className="mt-1 text-xs text-slate-500">Insert {"{name}"} untuk menyisipkan nama CS (opsional).</p>
              </div>
            )}
          </div>

          <div className="pt-6 border-t border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-slate-700">WhatsApp group notifications</label>
              <Toggle
                checked={config.waGroupNotifEnabled}
                onChange={(next) => setConfig({ ...config, waGroupNotifEnabled: next })}
                label="Activekan notifikasi grup WhatsApp"
              />
            </div>
            <p className="text-xs text-slate-500 mb-3">Notify your WhatsApp group about new customers, handoffs, claims, and resolved conversations.</p>
            {config.waGroupNotifEnabled && (
              <div className="animate-in fade-in slide-in-from-top-2">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  WhatsApp group ID (JID)
                </label>
                <input
                  type="text"
                  value={config.waGroupJid}
                  onChange={(e) => setConfig({ ...config, waGroupJid: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-brand-600/50"
                  placeholder="Contoh: 123456789-987654321@g.us"
                />
                <p className="mt-2 text-xs text-slate-500">
                  Send message <code className="text-brand-700 bg-brand-700/10 px-1 py-0.5 rounded">!jid</code> in your WhatsApp group to get its ID. Format: <code className="text-brand-700 bg-brand-700/10 px-1 py-0.5 rounded">xxxxx-xxxxx@g.us</code>
                </p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-200 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
              Save settings
            </button>
          </div>
        </div>
      </div>

      <Modal
        isOpen={modal.isOpen}
        onClose={() => setModal((m) => ({ ...m, isOpen: false }))}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />
    </div>
  );
}

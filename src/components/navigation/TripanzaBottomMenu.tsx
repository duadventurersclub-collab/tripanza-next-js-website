"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import ProfileOtpLogin, { type AuthenticatedUser } from "@/components/auth/ProfileOtpLogin";
import { useSiteSettings } from "@/components/settings/SiteSettingsProvider";
import { readAccountCache, writeAccountCache } from "@/lib/browser-account-cache";

type AccountProfile = {
  id: number;
  name: string;
  email: string;
  avatar: string;
  phone: string;
  state: string;
  dob: string;
  gender: "male" | "female" | "";
  cover: string;
};

type WalletTransaction = {
  id: string;
  amount: number;
  type: "credit" | "debit";
  source: "cashback" | "commission" | "general";
  description: string;
  date: string;
  coupon_code: string;
};

type AccountWallet = {
  currency: string;
  balance: number;
  source_balances: { cashback: number; commission: number; general: number };
  stats: { earned: number; used: number; movements: number };
  transactions: WalletTransaction[];
};

type AccountPayload = {
  authenticated: boolean;
  admin?: boolean;
  profile: AccountProfile | null;
  wallet: AccountWallet;
  bookings: Array<{
    id: number;
    title: string;
    status: string;
    amount: string;
    created_at: string;
  }>;
};

const EMPTY_ACCOUNT: AccountPayload = {
  authenticated: false,
  profile: null,
  wallet: {
    currency: "INR",
    balance: 0,
    source_balances: { cashback: 0, commission: 0, general: 0 },
    stats: { earned: 0, used: 0, movements: 0 },
    transactions: [],
  },
  bookings: [],
};
const DEFAULT_COVER = "https://tripanza.com/wp-content/uploads/2026/09/tripanza-default-profile-cover.png";
const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh",
  "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep",
  "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry",
  "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
];

function Icon({ name }: { name: "home" | "people" | "explore" | "heart" | "profile" | "back" | "wallet" | "ticket" | "compass" }) {
  const paths = {
    home: <path d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" />,
    people: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0M18 4v4M16 6h4M17.5 12.5v3M16 14h3" /></>,
    explore: <><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M3 8h18M7 3l3 5M14 3l3 5M10 11l5 3-5 3v-6Z" /></>,
    heart: <path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.5a5.5 5.5 0 0 0 0-7.8Z" />,
    profile: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    back: <path d="m12 5-7 7 7 7M5 12h14" />,
    wallet: <><path d="M20 8V5H5a2 2 0 0 0 0 4h16v11H5a2 2 0 0 1-2-2V7" /><path d="M21 12h-6v5h6M17 14.5h.01" /></>,
    ticket: <><path d="M3 5h18v5a2 2 0 0 0 0 4v5H3v-5a2 2 0 0 0 0-4Z" /><path d="M15 5v3m0 3v2m0 3v3" /></>,
    compass: <><circle cx="12" cy="12" r="9" /><path d="m16 8-2.5 5.5L8 16l2.5-5.5Z" /></>,
  }[name];

  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">{paths}</svg>;
}

function InstagramIcon() {
  return <svg className="tp-profile-instagram-icon" viewBox="0 0 40 40" aria-hidden="true"><defs><linearGradient id="tp-profile-instagram-gradient" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#ffd600" /><stop offset=".45" stopColor="#ff0169" /><stop offset="1" stopColor="#d300c5" /></linearGradient></defs><rect width="40" height="40" rx="9" fill="url(#tp-profile-instagram-gradient)" /><rect x="9" y="9" width="22" height="22" rx="7" fill="none" stroke="#fff" strokeWidth="2.5" /><circle cx="20" cy="20" r="5.2" fill="none" stroke="#fff" strokeWidth="2.5" /><circle cx="27.3" cy="12.8" r="1.6" fill="#fff" /></svg>;
}

function WhatsAppIcon() {
  return <svg className="tp-profile-whatsapp-icon" viewBox="0 0 512 512" aria-hidden="true"><circle cx="256" cy="256" r="240" fill="#25d366" /><path transform="translate(32 0)" fill="#fff" d="M380.9 97.1C339 55.1 283.2 32 223.9 32 101.5 32 2 131.5 2 253.9c0 39.1 10.2 77.3 29.6 111L.1 480l117.7-30.9c32.4 17.7 68.9 27 106 27h.1c122.3 0 224.1-99.5 224.1-221.9 0-59.3-25.2-115-67.1-157.1ZM223.9 438.7c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3 18.6-68-4.4-7c-18.5-29.4-28.2-63.4-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.5-186.6 184.5Zm101.2-138.1c-5.5-2.8-32.8-16.1-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3s19.9 53.7 22.6 57.4c2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6Z" /></svg>;
}

function savedTripCount() {
  let count = 0;
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index) || "";
      if (key.startsWith("tripanza_saved_tour_") && window.localStorage.getItem(key) === "1") count += 1;
    }
  } catch {
    return 0;
  }
  return count;
}

function amount(value: number, currency: string) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(value || 0);
}

function bookingDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Booking received" : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function transactionDate(value: string) {
  const date = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function ProfileEditor({ profile, onBack, onSaved }: { profile: AccountProfile; onBack: () => void; onSaved: (profile: AccountProfile) => void }) {
  const [form, setForm] = useState({ name: profile.name, email: profile.email, phone: profile.phone, state: profile.state, dob: profile.dob, gender: profile.gender });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/account/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json() as { message?: string; profile?: { id: number; display_name?: string; email: string; phone?: string; state?: string; dob?: string; gender?: "male" | "female" | ""; avatar_url?: string; cover_url?: string } };
      if (!response.ok || !payload.profile) throw new Error(payload.message || "Could not update your profile.");
      onSaved({
        id: payload.profile.id,
        name: payload.profile.display_name || form.name,
        email: payload.profile.email,
        phone: payload.profile.phone || "",
        state: payload.profile.state || "",
        dob: payload.profile.dob || "",
        gender: payload.profile.gender || "",
        avatar: payload.profile.avatar_url || profile.avatar,
        cover: payload.profile.cover_url || profile.cover,
      });
      setMessage("Profile updated successfully.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update your profile.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="tp-profile-edit-view">
    <header><button type="button" onClick={onBack} aria-label="Back to profile"><Icon name="back" /></button><strong>Edit profile</strong><span /></header>
    <div className="tp-profile-edit-intro"><span>{profile.avatar ? <Image src={profile.avatar} alt="" width={72} height={72} unoptimized /> : profile.name.slice(0, 1).toUpperCase()}</span><div><small>YOUR TRAVEL PROFILE</small><h2>Keep the crew in the loop.</h2><p>These details are used for your bookings and Tripanza account.</p></div></div>
    <form onSubmit={save}>
      <label><span>Your name</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} minLength={2} maxLength={80} autoComplete="name" required /></label>
      <label><span>Email address</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} autoComplete="email" required /></label>
      <label><span>WhatsApp number</span><input type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} autoComplete="tel" placeholder="+91 98765 43210" required /></label>
      <label><span>Date of birth</span><input type="date" value={form.dob} onChange={(event) => setForm({ ...form, dob: event.target.value })} autoComplete="bday" required /></label>
      <fieldset><legend>Gender</legend><label><input type="radio" name="gender" value="male" checked={form.gender === "male"} onChange={() => setForm({ ...form, gender: "male" })} required /> Male</label><label><input type="radio" name="gender" value="female" checked={form.gender === "female"} onChange={() => setForm({ ...form, gender: "female" })} required /> Female</label></fieldset>
      <label className="tp-profile-edit-wide"><span>Home state</span><select value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value })} autoComplete="address-level1" required><option value="">Choose your state</option>{INDIAN_STATES.map((state) => <option key={state} value={state}>{state}</option>)}</select></label>
      {message ? <p className={message.includes("successfully") ? "is-success" : "is-error"} role="status">{message}</p> : null}
      <button className="tp-profile-edit-save" type="submit" disabled={saving}>{saving ? "Saving…" : "Save profile"}<b>→</b></button>
    </form>
  </div>;
}

function WalletView({ wallet, onBack }: { wallet: AccountWallet; onBack: () => void }) {
  const [filter, setFilter] = useState<"all" | "credit" | "debit">("all");
  const transactions = filter === "all" ? wallet.transactions : wallet.transactions.filter((item) => item.type === filter);
  return <div className="tp-profile-wallet-view">
    <header><button type="button" onClick={onBack} aria-label="Back to profile"><Icon name="back" /></button><strong>Tripanza Wallet</strong><span /></header>
    <div className="tp-profile-wallet-card"><small>YOUR TRIP FUND</small><span>Total wallet balance</span><strong>{amount(wallet.balance, wallet.currency)}</strong><p>Eligible cashback and admin credit can be used at checkout. Host commission is payout-only.</p><b>TRIPANZA</b></div>
    <div className="tp-wallet-stats"><div><span>Lifetime earned</span><strong>{amount(wallet.stats.earned, wallet.currency)}</strong></div><div><span>Used on trips</span><strong>{amount(wallet.stats.used, wallet.currency)}</strong></div><div><span>Movements</span><strong>{wallet.stats.movements}</strong></div></div>
    <div className="tp-wallet-sources" aria-label="Wallet balance breakdown"><span>Cashback <b>{amount(wallet.source_balances.cashback, wallet.currency)}</b></span><span>Commission <b>{amount(wallet.source_balances.commission, wallet.currency)}</b></span><span>General <b>{amount(wallet.source_balances.general, wallet.currency)}</b></span></div>
    <section className="tp-wallet-activity"><div className="tp-wallet-activity-head"><div><small>WALLET ACTIVITY</small><h2>Money moves</h2></div><div role="tablist" aria-label="Filter wallet activity"><button type="button" className={filter === "all" ? "is-active" : ""} onClick={() => setFilter("all")}>All</button><button type="button" className={filter === "credit" ? "is-active" : ""} onClick={() => setFilter("credit")}>In</button><button type="button" className={filter === "debit" ? "is-active" : ""} onClick={() => setFilter("debit")}>Out</button></div></div>
      {transactions.length ? <div className="tp-wallet-transactions">{transactions.map((item) => <article key={item.id}><i className={item.type === "credit" ? "is-credit" : "is-debit"}>{item.type === "credit" ? "↓" : "↑"}</i><div><strong>{item.description}</strong><span>{transactionDate(item.date)} · {item.source}</span>{item.coupon_code ? <small>Coupon: {item.coupon_code}</small> : null}</div><b className={item.type === "credit" ? "is-credit" : "is-debit"}>{item.type === "credit" ? "+" : "−"}{amount(item.amount, wallet.currency)}</b></article>)}</div> : <div className="tp-wallet-empty"><span>₹</span><strong>No wallet activity yet</strong><p>Your cashback and rewards will appear here after your first eligible booking.</p></div>}
    </section>
  </div>;
}

export default function TripanzaBottomMenu() {
  const settings = useSiteSettings();
  const writeCachedAccount = (account: AccountPayload | null) => writeAccountCache(account, settings);
  const pathname = usePathname();
  const router = useRouter();
  const pathParts = pathname.split("/").filter(Boolean);
  const hiddenOnTourDetail = pathParts[0] === "tours" && pathParts.length > 1;
  const hiddenOnReels = pathParts[0] === "trips";
  const hiddenOnHost = pathParts[0] === "host" || pathParts[0] === "admin" || ["host-dashboard", "admin-host-trips", "add-your-own-trip", "poster-download", "host-reels", "host-customer-booking-history", "host-payout-details", "host-wallet", "crm"].includes(pathParts[0]);
  const hiddenOnRoute = hiddenOnTourDetail || hiddenOnReels || hiddenOnHost || pathParts[0] === "login";
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLElement>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const shouldFetchAccount = !hiddenOnRoute || modalOpen;
  const [walletOpen, setWalletOpen] = useState(false);
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register" | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [savedView, setSavedView] = useState(false);
  const [account, setAccount] = useState<AccountPayload>(EMPTY_ACCOUNT);
  const [accountLoading, setAccountLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!hiddenOnHost) return;
    const openHostProfile = () => {
      setWalletOpen(false);
      setProfileEditOpen(false);
      setAuthMode(null);
      setModalOpen(true);
    };
    window.addEventListener("tripanza:open-profile", openHostProfile);
    return () => window.removeEventListener("tripanza:open-profile", openHostProfile);
  }, [hiddenOnHost]);

  useEffect(() => {
    const refreshSaved = () => setSavedCount(savedTripCount());
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.matches("input,textarea,select,[contenteditable=true]")) setKeyboardOpen(true);
    };
    const onFocusOut = () => window.setTimeout(() => setKeyboardOpen(false), 120);
    const frame = window.requestAnimationFrame(() => {
      const search = new URLSearchParams(window.location.search);
      setSavedView(search.get("tripanza_filter") === "saved");
      if (pathname === "/login") {
        setModalOpen(true);
        setAuthMode("login");
      } else if (search.get("profile") === "1") {
        setModalOpen(true);
        if (search.get("auth") === "1") setAuthMode(search.get("mode") === "register" ? "register" : "login");
      }
      refreshSaved();
    });
    window.addEventListener("storage", refreshSaved);
    window.addEventListener("tripanza:saved-changed", refreshSaved);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      window.removeEventListener("storage", refreshSaved);
      window.removeEventListener("tripanza:saved-changed", refreshSaved);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      window.cancelAnimationFrame(frame);
    };
  }, [pathname]);

  useEffect(() => {
    let active = true;
    const cacheSettings = { cache_revision: settings.cache_revision, browser_cache_seconds: settings.browser_cache_seconds };
    const cached = readAccountCache<AccountPayload>(cacheSettings);
    const cacheFrame = cached ? window.requestAnimationFrame(() => {
      if (!active) return;
      setAccount(cached);
      setAccountLoading(false);
    }) : 0;

    if (!shouldFetchAccount) return () => {
      active = false;
      if (cacheFrame) window.cancelAnimationFrame(cacheFrame);
    };

    const controller = new AbortController();
    fetch("/api/account", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Account refresh failed");
        return response.json() as Promise<AccountPayload>;
      })
      .then((payload) => {
        if (!active) return;
        if (cacheFrame) window.cancelAnimationFrame(cacheFrame);
        writeAccountCache(payload.authenticated ? payload : null, cacheSettings);
        setAccount(payload);
      })
      .catch(() => {
        // Keep the last verified session during temporary WordPress or hosting delays.
        if (active && !cached) setAccount(EMPTY_ACCOUNT);
      })
      .finally(() => { if (active) setAccountLoading(false); });
    return () => {
      active = false;
      controller.abort();
      if (cacheFrame) window.cancelAnimationFrame(cacheFrame);
    };
  }, [shouldFetchAccount, settings.cache_revision, settings.browser_cache_seconds]);

  useEffect(() => {
    if (!modalOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => modalRef.current?.focus(), 30);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (walletOpen) setWalletOpen(false);
        else if (profileEditOpen) setProfileEditOpen(false);
        else if (authMode) setAuthMode(null);
        else setModalOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [authMode, modalOpen, profileEditOpen, walletOpen]);

  useEffect(() => {
    if (account.authenticated) router.prefetch("/dashboard");
  }, [account.authenticated, router]);

  function openProfile() {
    setWalletOpen(false);
    setProfileEditOpen(false);
    setAuthMode(null);
    setModalOpen(true);
  }

  function closeProfile() {
    setWalletOpen(false);
    setProfileEditOpen(false);
    setAuthMode(null);
    setModalOpen(false);
    if (pathname === "/login") router.replace("/");
    window.setTimeout(() => profileButtonRef.current?.focus(), 30);
  }

  function requireLogin(mode: "login" | "register" = "login") {
    setWalletOpen(false);
    setProfileEditOpen(false);
    setAuthMode(mode);
    setModalOpen(true);
  }

  function completeLogin(user?: AuthenticatedUser) {
    setAccount((current) => {
      const next: AccountPayload = {
        ...current,
        authenticated: true,
        profile: {
          id: Number(user?.id) || 0,
          name: user?.display_name || user?.email?.split("@")[0] || "Tripanza traveller",
          email: user?.email || "",
          avatar: "",
          phone: "",
          state: "",
          dob: "",
          gender: "",
          cover: "",
        },
      };
      writeCachedAccount(next);
      return next;
    });
    setAccountLoading(false);
    if (pathname === "/login") {
      const requested = new URLSearchParams(window.location.search).get("next") || "";
      const safeNext = requested.startsWith("/") && !requested.startsWith("//") && !requested.includes("\\") && !requested.startsWith("/login") ? requested : "/dashboard";
      setAuthMode(null);
      setModalOpen(false);
      router.replace(safeNext);
      router.refresh();
    } else {
      router.refresh();
      window.setTimeout(() => setAuthMode(null), 700);
    }
    void fetch("/api/account", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<AccountPayload> : null)
      .then((payload) => {
        if (!payload?.authenticated) return;
        writeCachedAccount(payload);
        setAccount(payload);
      })
      .catch(() => undefined);
  }

  function showSavedTrips() {
    setSavedView(true);
    window.dispatchEvent(new Event("tripanza:show-saved"));
  }

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      writeCachedAccount(null);
      setAccount(EMPTY_ACCOUNT);
      closeProfile();
      router.push("/");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  if (hiddenOnRoute && !hiddenOnHost && pathname !== "/login") return null;

  const active = modalOpen || pathname.startsWith("/account") || pathname.startsWith("/dashboard")
    ? "profile"
    : savedView
      ? "saved"
      : pathname.startsWith("/tours") || pathname.startsWith("/trips")
        ? "explore"
        : "home";
  const displayName = account.profile?.name || "Tripanza traveller";
  const latestBooking = account.bookings[0];

  return <>
    {!hiddenOnRoute && <div className="tpybm-spacer" aria-hidden="true" />}
    {!hiddenOnRoute && <nav className={`tpybm-nav${keyboardOpen ? " is-keyboard-hidden" : ""}`} aria-label="Tripanza navigation">
      <ul className="tpybm-nav__list">
        <li className="tpybm-nav__item"><Link className={`tpybm-nav__link${active === "home" ? " is-active" : ""}`} href="/" onClick={() => setSavedView(false)} aria-current={active === "home" ? "page" : undefined}><span className="tpybm-nav__icon"><Icon name="home" /></span><span className="tpybm-nav__label">Home</span></Link></li>
        <li className="tpybm-nav__item"><Link className="tpybm-nav__link" href="/#why-tripanza" onClick={() => setSavedView(false)}><span className="tpybm-nav__icon"><Icon name="people" /></span><span className="tpybm-nav__label">Icebreaker</span></Link></li>
        <li className="tpybm-nav__item"><Link className={`tpybm-nav__link tpybm-nav__link--primary${active === "explore" ? " is-active" : ""}`} href={settings.reels_enabled ? "/trips" : "/?tripanza_view=all#trips"} onClick={() => { setSavedView(false); if (!settings.reels_enabled) window.dispatchEvent(new Event("tripanza:show-all-trips")); }} aria-current={active === "explore" ? "page" : undefined}><span className="tpybm-nav__icon"><Icon name="explore" /><span className="tpybm-nav__live" /></span><span className="tpybm-nav__label">Explore</span></Link></li>
        <li className="tpybm-nav__item"><Link className={`tpybm-nav__link${active === "saved" ? " is-active" : ""}`} href="/?tripanza_filter=saved#trips" onClick={showSavedTrips} aria-current={active === "saved" ? "page" : undefined}><span className="tpybm-nav__icon"><Icon name="heart" /></span><span className="tpybm-nav__label">Saved</span><span className={`tpybm-nav__count${savedCount ? " has-items" : ""}`} aria-label={`${savedCount} saved trips`}>{savedCount > 99 ? "99+" : savedCount}</span></Link></li>
        <li className="tpybm-nav__item"><button ref={profileButtonRef} className={`tpybm-nav__link${active === "profile" ? " is-active" : ""}`} type="button" onClick={openProfile} aria-haspopup="dialog" aria-controls="tripanzaProfileModal"><span className="tpybm-nav__icon">{account.profile?.avatar ? <Image className="tpybm-nav__avatar" src={account.profile.avatar} alt="" width={27} height={27} unoptimized /> : <Icon name="profile" />}</span><span className="tpybm-nav__label">Me</span></button></li>
      </ul>
    </nav>}

    <section ref={modalRef} tabIndex={-1} id="tripanzaProfileModal" className={`tp-profile-modal${modalOpen ? " show" : ""}${!account.authenticated && !authMode ? " is-guest" : ""}`} role="dialog" aria-modal="true" aria-label="Profile" aria-hidden={!modalOpen}>
      {authMode ? <ProfileOtpLogin mode={authMode} onBack={() => setAuthMode(null)} onClose={closeProfile} onSuccess={completeLogin} /> : walletOpen ? <WalletView wallet={account.wallet} onBack={() => setWalletOpen(false)} /> : profileEditOpen && account.profile ? <ProfileEditor profile={account.profile} onBack={() => setProfileEditOpen(false)} onSaved={(profile) => { setAccount((current) => { const next = { ...current, profile }; writeCachedAccount(next); return next; }); window.setTimeout(() => setProfileEditOpen(false), 700); }} /> : <>
        {!account.authenticated && <header className="tp-profile-guest-head"><button ref={closeButtonRef} type="button" onClick={closeProfile} aria-label="Close profile"><Icon name="back" /></button><button type="button" onClick={() => requireLogin("login")}><Icon name="wallet" /> ₹0</button></header>}
        <div className="tp-profile-shell">
          {account.authenticated && <div className="tp-profile-cover"><Image src={account.profile?.cover || DEFAULT_COVER} alt="" fill sizes="640px" unoptimized /><div className="tp-profile-cover__controls"><button ref={closeButtonRef} type="button" onClick={closeProfile} aria-label="Close profile"><Icon name="back" /></button><button type="button" onClick={() => setWalletOpen(true)} aria-label="Open wallet"><Icon name="wallet" /> {amount(account.wallet.balance, account.wallet.currency)}</button></div></div>}

          <div className={`tp-profile-identity${account.authenticated ? " is-authenticated" : ""}`}>
            {account.authenticated ? <span className="tp-profile-avatar">{account.profile?.avatar ? <Image src={account.profile.avatar} alt={`${displayName} avatar`} width={60} height={60} unoptimized /> : displayName.slice(0, 1).toUpperCase()}</span> : null}
            {accountLoading ? <><span className="tp-profile-eyebrow">Loading your Tripanza</span><h2>Just a moment…</h2></> : account.authenticated ? <><span className="tp-profile-eyebrow">Your Tripanza</span><h2>{displayName}</h2><p>{account.profile?.email || account.profile?.phone}</p><div className="tp-profile-actions"><button type="button" onClick={() => setProfileEditOpen(true)}>Edit Profile</button><Link href="/dashboard" onClick={closeProfile}>Your Bookings</Link><button type="button" onClick={logout} disabled={loggingOut}>{loggingOut ? "Logging out…" : "Logout"}</button></div></> : <><h2>Good trips.<em>All in one place.</em></h2><p>Log in for your bookings, wallet and next escape.</p><div className="tp-profile-actions"><button type="button" onClick={() => requireLogin("login")}>Login</button><button type="button" onClick={() => requireLogin("register")}>Register</button></div></>}
          </div>

          {account.authenticated && latestBooking ? <section className="tp-profile-next-trip" aria-label="Your latest booking"><span><Icon name="ticket" /></span><div><small>Your latest booking</small><h3>{latestBooking.title}</h3><p>{bookingDate(latestBooking.created_at)} <b>{latestBooking.status}</b></p></div><Link href="/dashboard" onClick={closeProfile}>View</Link></section> : null}

          <div className="tp-profile-menu-label">Your Tripanza</div>
          <div className="tp-profile-menu" role="list">
            {account.authenticated ? <Link role="listitem" href="/dashboard" onClick={closeProfile}><span><Icon name="ticket" /><strong>Your Bookings</strong><small>Dates, details &amp; plans.</small></span><b>›</b></Link> : <button type="button" role="listitem" onClick={() => requireLogin()}><span><Icon name="ticket" /><strong>Your Bookings</strong><small>Dates, details &amp; plans.</small></span><b>›</b></button>}
            <Link role="listitem" href="/?tripanza_view=all#trips" onClick={() => { closeProfile(); window.dispatchEvent(new Event("tripanza:show-all-trips")); }}><span><Icon name="compass" /><strong>Explore Trips</strong><small>Find your next escape.</small></span><b>›</b></Link>
            {settings.host_enabled && <Link role="listitem" href="/host" onClick={closeProfile}><span><Icon name="compass" /><strong>Become a Host</strong><small>Build your crew and earn.</small></span><b>›</b></Link>}
            <button type="button" role="listitem" onClick={() => account.authenticated ? setWalletOpen(true) : requireLogin("login")}><span><Icon name="wallet" /><strong>Wallet</strong><small>Cashback &amp; rewards.</small></span><b>›</b></button>
            <Link role="listitem" href="/?tripanza_filter=saved#trips" onClick={() => { showSavedTrips(); closeProfile(); }}><span><Icon name="heart" /><strong>Favourites</strong><small>{savedCount} saved trips.</small></span><b>›</b></Link>
          </div>

          <div className="tp-profile-quick-grid">
            <a href="https://instagram.com/tripanza.co" target="_blank" rel="noreferrer"><span><strong>Follow Tripanza</strong><small>Follow us on Instagram</small></span><InstagramIcon /></a>
            <a href={`https://wa.me/${settings.whatsapp_number}`} target="_blank" rel="noreferrer"><span><strong>Need help?</strong><small>Talk to us on WhatsApp</small></span><WhatsAppIcon /></a>
          </div>

          <nav className="tp-profile-legal" aria-label="Help, company and legal links">
            <strong>Help &amp; legal</strong>
            <div><Link href="/cancellation-policy" onClick={closeProfile}>Cancellation &amp; refunds</Link><Link href="/contact" onClick={closeProfile}>Contact Tripanza</Link><Link href="/tnc" onClick={closeProfile}>Terms &amp; conditions</Link><Link href="/privacy-policy" onClick={closeProfile}>Privacy policy</Link><Link href="/cookies-policy" onClick={closeProfile}>Cookie policy</Link><Link href="/disclaimer" onClick={closeProfile}>Disclaimer</Link><Link href="/about" onClick={closeProfile}>About Tripanza</Link></div>
          </nav>
        </div>
      </>}
    </section>
  </>;
}

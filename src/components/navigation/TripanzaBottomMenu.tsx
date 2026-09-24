"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import ProfileOtpLogin, { type AuthenticatedUser } from "@/components/auth/ProfileOtpLogin";

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
const ACCOUNT_CACHE_KEY = "tripanza_account_cache_v1";
const ACCOUNT_CACHE_TTL = 55 * 60 * 1000;

function readCachedAccount(): AccountPayload | null {
  try {
    const stored = window.sessionStorage.getItem(ACCOUNT_CACHE_KEY);
    if (!stored) return null;
    const cached = JSON.parse(stored) as { savedAt?: number; account?: AccountPayload };
    if (
      !cached.savedAt ||
      Date.now() - cached.savedAt > ACCOUNT_CACHE_TTL ||
      !cached.account?.authenticated ||
      !cached.account.profile
    ) {
      window.sessionStorage.removeItem(ACCOUNT_CACHE_KEY);
      return null;
    }
    return cached.account;
  } catch {
    return null;
  }
}

function writeCachedAccount(account: AccountPayload | null) {
  try {
    if (!account?.authenticated || !account.profile) {
      window.sessionStorage.removeItem(ACCOUNT_CACHE_KEY);
      return;
    }
    window.sessionStorage.setItem(ACCOUNT_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), account }));
  } catch {
    // The live account response still works when browser storage is unavailable.
  }
}

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
    <div className="tp-profile-wallet-card"><small>YOUR TRIP FUND</small><span>Available balance</span><strong>{amount(wallet.balance, wallet.currency)}</strong><p>Cashback, host earnings and eligible rewards live here.</p><b>TRIPANZA</b></div>
    <div className="tp-wallet-stats"><div><span>Lifetime earned</span><strong>{amount(wallet.stats.earned, wallet.currency)}</strong></div><div><span>Used on trips</span><strong>{amount(wallet.stats.used, wallet.currency)}</strong></div><div><span>Movements</span><strong>{wallet.stats.movements}</strong></div></div>
    <div className="tp-wallet-sources" aria-label="Wallet balance breakdown"><span>Cashback <b>{amount(wallet.source_balances.cashback, wallet.currency)}</b></span><span>Commission <b>{amount(wallet.source_balances.commission, wallet.currency)}</b></span><span>General <b>{amount(wallet.source_balances.general, wallet.currency)}</b></span></div>
    <section className="tp-wallet-activity"><div className="tp-wallet-activity-head"><div><small>WALLET ACTIVITY</small><h2>Money moves</h2></div><div role="tablist" aria-label="Filter wallet activity"><button type="button" className={filter === "all" ? "is-active" : ""} onClick={() => setFilter("all")}>All</button><button type="button" className={filter === "credit" ? "is-active" : ""} onClick={() => setFilter("credit")}>In</button><button type="button" className={filter === "debit" ? "is-active" : ""} onClick={() => setFilter("debit")}>Out</button></div></div>
      {transactions.length ? <div className="tp-wallet-transactions">{transactions.map((item) => <article key={item.id}><i className={item.type === "credit" ? "is-credit" : "is-debit"}>{item.type === "credit" ? "↓" : "↑"}</i><div><strong>{item.description}</strong><span>{transactionDate(item.date)} · {item.source}</span>{item.coupon_code ? <small>Coupon: {item.coupon_code}</small> : null}</div><b className={item.type === "credit" ? "is-credit" : "is-debit"}>{item.type === "credit" ? "+" : "−"}{amount(item.amount, wallet.currency)}</b></article>)}</div> : <div className="tp-wallet-empty"><span>₹</span><strong>No wallet activity yet</strong><p>Your cashback and rewards will appear here after your first eligible booking.</p></div>}
    </section>
  </div>;
}

export default function TripanzaBottomMenu() {
  const pathname = usePathname();
  const router = useRouter();
  const pathParts = pathname.split("/").filter(Boolean);
  const hiddenOnTourDetail = pathParts[0] === "tours" && pathParts.length > 1;
  const hiddenOnReels = pathParts[0] === "trips";
  const hiddenOnRoute = hiddenOnTourDetail || hiddenOnReels;
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [modalOpen, setModalOpen] = useState(false);
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
    const refreshSaved = () => setSavedCount(savedTripCount());
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.matches("input,textarea,select,[contenteditable=true]")) setKeyboardOpen(true);
    };
    const onFocusOut = () => window.setTimeout(() => setKeyboardOpen(false), 120);
    const frame = window.requestAnimationFrame(() => {
      const search = new URLSearchParams(window.location.search);
      setSavedView(search.get("tripanza_filter") === "saved");
      if (search.get("profile") === "1") {
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
    const cached = readCachedAccount();
    const cacheFrame = cached ? window.requestAnimationFrame(() => {
      if (!active) return;
      setAccount(cached);
      setAccountLoading(false);
    }) : 0;

    fetch("/api/account", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Account refresh failed");
        return response.json() as Promise<AccountPayload>;
      })
      .then((payload) => {
        if (!active) return;
        if (cacheFrame) window.cancelAnimationFrame(cacheFrame);
        writeCachedAccount(payload.authenticated ? payload : null);
        setAccount(payload);
      })
      .catch(() => {
        // Keep the last verified session during temporary WordPress or hosting delays.
        if (active && !cached) setAccount(EMPTY_ACCOUNT);
      })
      .finally(() => { if (active) setAccountLoading(false); });
    return () => {
      active = false;
      if (cacheFrame) window.cancelAnimationFrame(cacheFrame);
    };
  }, []);

  useEffect(() => {
    if (!modalOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => closeButtonRef.current?.focus(), 30);
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
    router.refresh();
    window.setTimeout(() => setAuthMode(null), 700);
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

  if (hiddenOnRoute) return null;

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
    <div className="tpybm-spacer" aria-hidden="true" />
    <nav className={`tpybm-nav${keyboardOpen ? " is-keyboard-hidden" : ""}`} aria-label="Tripanza navigation">
      <ul className="tpybm-nav__list">
        <li className="tpybm-nav__item"><Link className={`tpybm-nav__link${active === "home" ? " is-active" : ""}`} href="/" onClick={() => setSavedView(false)} aria-current={active === "home" ? "page" : undefined}><span className="tpybm-nav__icon"><Icon name="home" /></span><span className="tpybm-nav__label">Home</span></Link></li>
        <li className="tpybm-nav__item"><Link className="tpybm-nav__link" href="/#why-tripanza" onClick={() => setSavedView(false)}><span className="tpybm-nav__icon"><Icon name="people" /></span><span className="tpybm-nav__label">Icebreaker</span></Link></li>
        <li className="tpybm-nav__item"><Link className={`tpybm-nav__link tpybm-nav__link--primary${active === "explore" ? " is-active" : ""}`} href="/trips" onClick={() => setSavedView(false)} aria-current={active === "explore" ? "page" : undefined}><span className="tpybm-nav__icon"><Icon name="explore" /><span className="tpybm-nav__live" /></span><span className="tpybm-nav__label">Explore</span></Link></li>
        <li className="tpybm-nav__item"><Link className={`tpybm-nav__link${active === "saved" ? " is-active" : ""}`} href="/?tripanza_filter=saved#trips" onClick={showSavedTrips} aria-current={active === "saved" ? "page" : undefined}><span className="tpybm-nav__icon"><Icon name="heart" /></span><span className="tpybm-nav__label">Saved</span><span className={`tpybm-nav__count${savedCount ? " has-items" : ""}`} aria-label={`${savedCount} saved trips`}>{savedCount > 99 ? "99+" : savedCount}</span></Link></li>
        <li className="tpybm-nav__item"><button ref={profileButtonRef} className={`tpybm-nav__link${active === "profile" ? " is-active" : ""}`} type="button" onClick={openProfile} aria-haspopup="dialog" aria-controls="tripanzaProfileModal"><span className="tpybm-nav__icon">{account.profile?.avatar ? <Image className="tpybm-nav__avatar" src={account.profile.avatar} alt="" width={27} height={27} unoptimized /> : <Icon name="profile" />}</span><span className="tpybm-nav__label">Me</span></button></li>
      </ul>
    </nav>

    <section id="tripanzaProfileModal" className={`tp-profile-modal${modalOpen ? " show" : ""}`} role="dialog" aria-modal="true" aria-label="Profile" aria-hidden={!modalOpen}>
      {authMode ? <ProfileOtpLogin mode={authMode} onBack={() => setAuthMode(null)} onSuccess={completeLogin} /> : walletOpen ? <WalletView wallet={account.wallet} onBack={() => setWalletOpen(false)} /> : profileEditOpen && account.profile ? <ProfileEditor profile={account.profile} onBack={() => setProfileEditOpen(false)} onSaved={(profile) => { setAccount((current) => { const next = { ...current, profile }; writeCachedAccount(next); return next; }); window.setTimeout(() => setProfileEditOpen(false), 700); }} /> : <>
        <div className="tp-profile-shell">
          {account.authenticated ? <div className="tp-profile-cover"><Image src={account.profile?.cover || DEFAULT_COVER} alt="" fill sizes="640px" unoptimized /><div className="tp-profile-cover__controls"><button ref={closeButtonRef} type="button" onClick={closeProfile} aria-label="Close profile"><Icon name="back" /></button><button type="button" onClick={() => setWalletOpen(true)} aria-label="Open wallet"><Icon name="wallet" /> {amount(account.wallet.balance, account.wallet.currency)}</button></div></div> : <header className="tp-profile-guest-head"><button ref={closeButtonRef} type="button" onClick={closeProfile} aria-label="Close profile"><Icon name="back" /></button><button type="button" onClick={() => requireLogin("login")}><Icon name="wallet" /> ₹0</button></header>}

          <div className={`tp-profile-identity${account.authenticated ? " is-authenticated" : ""}`}>
            {account.authenticated ? <span className="tp-profile-avatar">{account.profile?.avatar ? <Image src={account.profile.avatar} alt={`${displayName} avatar`} width={60} height={60} unoptimized /> : displayName.slice(0, 1).toUpperCase()}</span> : null}
            {accountLoading ? <><span className="tp-profile-eyebrow">Loading your Tripanza</span><h2>Just a moment…</h2></> : account.authenticated ? <><span className="tp-profile-eyebrow">Your Tripanza</span><h2>{displayName}</h2><p>{account.profile?.email || account.profile?.phone}</p><div className="tp-profile-actions"><button type="button" onClick={() => setProfileEditOpen(true)}>Edit Profile</button><Link href="/dashboard" onClick={closeProfile}>Your Bookings</Link><button type="button" onClick={logout} disabled={loggingOut}>{loggingOut ? "Logging out…" : "Logout"}</button></div></> : <><h2>Good trips.<em>All in one place.</em></h2><p>Log in for your bookings, wallet and next escape.</p><div className="tp-profile-actions"><button type="button" onClick={() => requireLogin("login")}>Login</button><button type="button" onClick={() => requireLogin("register")}>Register</button></div></>}
          </div>

          {account.authenticated && latestBooking ? <section className="tp-profile-next-trip" aria-label="Your latest booking"><span><Icon name="ticket" /></span><div><small>Your latest booking</small><h3>{latestBooking.title}</h3><p>{bookingDate(latestBooking.created_at)} <b>{latestBooking.status}</b></p></div><Link href="/dashboard" onClick={closeProfile}>View</Link></section> : null}

          <div className="tp-profile-menu-label">Your Tripanza</div>
          <div className="tp-profile-menu" role="list">
            {account.authenticated ? <Link role="listitem" href="/dashboard" onClick={closeProfile}><span><Icon name="ticket" /><strong>Your Bookings</strong><small>Dates, details &amp; plans.</small></span><b>›</b></Link> : <button type="button" role="listitem" onClick={() => requireLogin()}><span><Icon name="ticket" /><strong>Your Bookings</strong><small>Dates, details &amp; plans.</small></span><b>›</b></button>}
            <Link role="listitem" href="/tours" onClick={closeProfile}><span><Icon name="compass" /><strong>Explore Trips</strong><small>Find your next escape.</small></span><b>›</b></Link>
            <button type="button" role="listitem" onClick={() => account.authenticated ? setWalletOpen(true) : requireLogin("login")}><span><Icon name="wallet" /><strong>Wallet</strong><small>Cashback &amp; rewards.</small></span><b>›</b></button>
            <Link role="listitem" href="/?tripanza_filter=saved#trips" onClick={() => { showSavedTrips(); closeProfile(); }}><span><Icon name="heart" /><strong>Favourites</strong><small>{savedCount} saved trips.</small></span><b>›</b></Link>
          </div>

          <div className="tp-profile-quick-grid">
            <a href="https://instagram.com/tripanza.co" target="_blank" rel="noreferrer"><span><strong>Follow Tripanza</strong><small>Follow us on Instagram</small></span><b className="tp-profile-instagram">◎</b></a>
            <a href="https://wa.me/918130117254" target="_blank" rel="noreferrer"><span><strong>Need help?</strong><small>Talk to us on WhatsApp</small></span><b className="tp-profile-whatsapp">◔</b></a>
          </div>

          <nav className="tp-profile-legal" aria-label="Help, company and legal links">
            <strong>Help &amp; legal</strong>
            <div><a href="https://tripanza.com/cancellation-policy/">Cancellation &amp; refunds</a><Link href="/contact" onClick={closeProfile}>Contact Tripanza</Link><a href="https://tripanza.com/tnc/">Terms &amp; conditions</a><a href="https://tripanza.com/privacy-policy/">Privacy policy</a><a href="https://tripanza.com/cookies-policy/">Cookie policy</a><a href="https://tripanza.com/disclaimer/">Disclaimer</a><Link href="/about" onClick={closeProfile}>About Tripanza</Link></div>
          </nav>
          <p className="tp-profile-signoff">Made for the group chat that actually travels.</p>
        </div>
      </>}
    </section>
  </>;
}

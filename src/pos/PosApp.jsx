import React, { useState, useMemo, useEffect, useRef, useCallback, createContext, useContext } from "react";
import {
  LayoutDashboard, ShoppingCart, Grid3x3, Receipt, Wallet, Users, Package,
  BarChart3, Monitor, Tag, UserCog, Clock, Settings, Menu, ChevronDown,
  Bell, Wifi, Search, Plus, Minus, X, Check, AlertTriangle, TrendingUp,
  TrendingDown, DollarSign, ShoppingBag, UsersRound, Percent, CreditCard,
  QrCode, Banknote, ChevronRight, ArrowUpCircle, ArrowDownCircle,
  CalendarDays, Globe, ChevronLeft, MoreHorizontal, Home, ClipboardList,
  CircleDot, Flame, AlertCircle, FileWarning, Store, Pencil, Trash2,
  Printer, FileSpreadsheet, FileDown, FileText, PieChart as PieChartIcon,
  Armchair, PauseCircle, RotateCw, Eye, UtensilsCrossed, Send, CheckCircle2,
  ArrowUpRight, Zap, Truck, Filter, List, ReceiptText, Smartphone, Ticket,
  Landmark, UserCircle2, Calculator, Lock, ChevronUp, Loader2, PartyPopper,
  MoreVertical, Split, GitMerge, Info
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell
} from "recharts";
import EventReservationPage from "./EventReservationPage";
import EventReservationReport from "./EventReservationReport";
import GeneralInfoScreen from "./GeneralInfoScreen";
import CustomerOrderingPage from "./CustomerOrderingPage";
import PromotionsPage, { PromotionPickerModal } from "./PromotionsPage";
import SettingsPage from "./SettingsPage";
import { PosDataProvider, useTableOrders, usePromotions, CURRENT_USER, OUTLETS } from "./posStore";
import { printKot, printBill } from "./printSlips";

/* ---------------------------------- THEME ---------------------------------- */
const C = {
  green: "#16A34A",
  greenLight: "#DCFCE7",
  blue: "#2563EB",
  blueLight: "#DBEAFE",
  orange: "#F59E0B",
  orangeLight: "#FEF3C7",
  purple: "#9333EA",
  purpleLight: "#F3E8FF",
  red: "#EF4444",
  redLight: "#FEE2E2",
  teal: "#0D9488",
  tealLight: "#CCFBF1",
  indigo: "#4F46E5",
  indigoLight: "#E0E7FF",
  pink: "#DB2777",
  pinkLight: "#FCE7F3",
  bg: "#F8FAFC",
  tableHead: "#0F5C7A",
};

/* ---------------------------------- NAV DATA ---------------------------------- */
const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "take-order", label: "Self Service / Fastfood", icon: ShoppingCart },
  { id: "tables", label: "Tables", icon: Grid3x3 },
  { id: "orders", label: "Orders", icon: Receipt },
  { id: "settlement", label: "Settlement", icon: Wallet },
  { id: "customers", label: "Customers", icon: Users },
  { id: "inventory", label: "Inventory", icon: Package },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "customer-ordering", label: "Customer Ordering", icon: QrCode },
  { id: "kitchen", label: "Kitchen Display", icon: Monitor },
  { id: "promotions", label: "Promotions", icon: Tag },
  { id: "employees", label: "Employees", icon: UserCog },
  { id: "shift", label: "Shift Management", icon: Clock },
  { id: "bill-reprint", label: "Bill RePrint", icon: ReceiptText },
  { id: "settings", label: "Settings", icon: Settings },
];

const BOTTOM_NAV = [
  { id: "dashboard", label: "Home", icon: Home },
  { id: "orders", label: "Orders", icon: ClipboardList },
  { id: "tables", label: "Tables", icon: Grid3x3 },
  { id: "shift", label: "Shift", icon: Clock },
  { id: "more", label: "More", icon: MoreHorizontal },
];

/* ------------------------ ORDER NOTIFICATIONS (with sound) ------------------------ */
/* One provider drives everything order-related: an item added to a cart ("item ordered")
   and a settled/closed bill ("order closed"). Each event pushes a notification into the
   bell dropdown, shows a floating alert, and plays a short WebAudio chime — no audio
   files needed, so it works offline on the POS terminal. */
const NotificationCtx = createContext(null);
export function useOrderNotifications() {
  return useContext(NotificationCtx) || { notifyItemOrdered: () => {}, notifyOrderClosed: () => {} };
}

const NOTIF_STYLES = {
  item: { icon: UtensilsCrossed, color: C.blue, bg: C.blueLight },
  closed: { icon: CheckCircle2, color: C.green, bg: C.greenLight },
  kot: { icon: Send, color: C.orange, bg: C.orangeLight },
};

// Ascending two-note chime for new items, descending resolve-chime for closed orders.
const TONES = {
  item: [[880, 0, 0.12], [1174, 0.1, 0.16]],
  closed: [[784, 0, 0.12], [1046, 0.1, 0.12], [1318, 0.2, 0.22]],
  kot: [[660, 0, 0.14], [660, 0.18, 0.14]],
};

function NotificationProvider({ children }) {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [soundOn, setSoundOn] = useState(true);
  const [alerts, setAlerts] = useState([]);
  const audioRef = useRef(null);
  const soundRef = useRef(true);
  soundRef.current = soundOn;

  const playTone = useCallback((kind) => {
    if (!soundRef.current || typeof window === "undefined") return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      if (!audioRef.current) audioRef.current = new AC();
      const ctx = audioRef.current;
      if (ctx.state === "suspended") ctx.resume();
      (TONES[kind] || TONES.item).forEach(([freq, delay, dur]) => {
        const t0 = ctx.currentTime + delay;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, t0);
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.22, t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + dur + 0.05);
      });
    } catch {
      /* audio blocked until first gesture — silently ignore */
    }
  }, []);

  const push = useCallback(
    (kind, title, sub) => {
      const entry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        kind,
        title,
        sub,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setItems((prev) => [entry, ...prev].slice(0, 30));
      setUnread((u) => u + 1);
      setAlerts((prev) => [entry, ...prev].slice(0, 3));
      setTimeout(() => setAlerts((prev) => prev.filter((a) => a.id !== entry.id)), 3200);
      playTone(kind);
    },
    [playTone]
  );

  const value = useMemo(
    () => ({
      items,
      unread,
      soundOn,
      toggleSound: () => setSoundOn((s) => !s),
      markAllRead: () => setUnread(0),
      clearAll: () => { setItems([]); setUnread(0); },
      notifyItemOrdered: (name, qty = 1, where) =>
        push("item", `${qty} × ${name} ordered`, where ? `Added to ${where}` : "Added to the running order"),
      notifyKotSent: (where, count) =>
        push("kot", "Order sent to kitchen", `${count} item${count === 1 ? "" : "s"} · ${where}`),
      notifyOrderClosed: (where, amount) =>
        push("closed", `Order closed · ${where}`, amount != null ? `Settled ¥${Number(amount).toLocaleString()}` : "Bill settled"),
    }),
    [items, unread, soundOn, push]
  );

  return (
    <NotificationCtx.Provider value={value}>
      <style>{`@keyframes slideUp { from { transform: translateY(24px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }`}</style>
      {children}
      <NotificationAlerts alerts={alerts} />
    </NotificationCtx.Provider>
  );
}

/* ------------------------------ SAVED ORDER STORE ------------------------------ */
/* "Place Order" persists the running cart as a saved (kitchen-sent) order so it survives
   leaving the Touch Order screen, and every save raises an order notification + chime. */
const OrderStoreCtx = createContext(null);
export function useOrderStore() {
  return useContext(OrderStoreCtx) || { savedOrders: [], saveOrder: () => null };
}

function OrderStoreProvider({ children }) {
  const [savedOrders, setSavedOrders] = useState([]);
  const saveOrder = useCallback((order) => {
    const saved = {
      id: order.id || `ORD-${String(Date.now()).slice(-6)}`,
      table: order.table,
      orderType: order.orderType,
      items: order.items || [],
      itemCount: (order.items || []).reduce((s, i) => s + i.qty, 0),
      subtotal: order.subtotal || 0,
      tax: order.tax || 0,
      total: order.total || 0,
      status: "Saved",
      savedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setSavedOrders((prev) => [saved, ...prev]);
    return saved;
  }, []);
  const value = useMemo(() => ({ savedOrders, saveOrder }), [savedOrders, saveOrder]);
  return <OrderStoreCtx.Provider value={value}>{children}</OrderStoreCtx.Provider>;
}

function NotificationAlerts({ alerts }) {
  if (!alerts.length) return null;
  return (
    <div className="fixed top-4 right-4 z-[999] space-y-2 w-[290px] pointer-events-none">
      {alerts.map((a) => {
        const s = NOTIF_STYLES[a.kind] || NOTIF_STYLES.item;
        const Icon = s.icon;
        return (
          <div
            key={a.id}
            className="bg-white rounded-xl border border-slate-200 shadow-lg p-3 flex items-start gap-3"
            style={{ animation: "slideUp .18s ease-out" }}
          >
            <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: s.bg }}>
              <Icon size={17} color={s.color} />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-800 truncate">{a.title}</div>
              <div className="text-xs text-slate-500 truncate">{a.sub}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NotificationBell() {
  const { items, unread, soundOn, toggleSound, markAllRead, clearAll } = useOrderNotifications();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen((o) => !o); if (!open) markAllRead(); }}
        className="relative p-2 rounded-lg hover:bg-slate-100 text-slate-500"
        aria-label="Order notifications"
      >
        <Bell size={19} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-[320px] max-w-[86vw] bg-white rounded-2xl border border-slate-200 shadow-xl z-50 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
              <div className="text-sm font-bold text-slate-800">Order Notifications</div>
              <button
                onClick={toggleSound}
                className="ml-auto text-[11px] font-semibold px-2 py-1 rounded-lg"
                style={soundOn ? { background: C.greenLight, color: "#166534" } : { background: "#F1F5F9", color: "#64748B" }}
              >
                {soundOn ? "Sound On" : "Sound Off"}
              </button>
              <button onClick={clearAll} className="text-[11px] font-semibold text-slate-400 hover:text-slate-600">Clear</button>
            </div>
            <div className="max-h-[320px] overflow-y-auto divide-y divide-slate-100">
              {items.length === 0 && (
                <div className="px-4 py-8 text-center text-xs text-slate-400">
                  No order activity yet. Add an item or close an order.
                </div>
              )}
              {items.map((n) => {
                const s = NOTIF_STYLES[n.kind] || NOTIF_STYLES.item;
                const Icon = s.icon;
                return (
                  <div key={n.id} className="px-4 py-3 flex items-start gap-3 hover:bg-slate-50">
                    <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: s.bg }}>
                      <Icon size={15} color={s.color} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold text-slate-800">{n.title}</div>
                      <div className="text-[11px] text-slate-500">{n.sub}</div>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">{n.time}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------ LANGUAGE (EN / 日本語) ------------------------------ */
/* The whole UI can flip to Japanese from the language picker in the top bar. Rather than
   threading a t() call through every one of the hundreds of labels in this screen set, the
   dictionary below is applied to rendered text (and placeholders / titles) by a small
   translation layer, so switching to 日本語 localises every screen at once and switching
   back to English restores the originals. */
import { JA_DICT } from "./jaDict";

/* Case-insensitive lookup table so "SETTLE", "Settle" and "settle" all match. */
const JA_LOOKUP = (() => {
  const m = new Map();
  Object.entries(JA_DICT).forEach(([k, v]) => {
    const key = k.trim().toLowerCase();
    if (!m.has(key)) m.set(key, v);
  });
  return m;
})();

/* Strips wrapping punctuation ("Settle:", "Search…", "Name *") before lookup and
   restores it afterwards, so decorated labels still translate. */
function jaFor(raw) {
  const trimmed = String(raw).trim();
  if (!trimmed || /^[\d\s\W]+$/.test(trimmed)) return null;
  if (/[぀-ヿ一-鿿]/.test(trimmed)) return null; // already Japanese
  const direct = JA_LOOKUP.get(trimmed.toLowerCase());
  if (direct) return direct;
  const m = trimmed.match(/^([^A-Za-z]*)([\s\S]*?)([^A-Za-z0-9)%]*)$/);
  if (!m) return null;
  const [, lead, core, tail] = m;
  if (!core) return null;
  const hit = JA_LOOKUP.get(core.trim().toLowerCase());
  return hit ? `${lead}${hit}${tail}` : null;
}

const TRANSLATABLE_ATTRS = ["placeholder", "title", "aria-label", "alt"];

const LangCtx = createContext({ lang: "en", setLang: () => {} });
export function useLanguage() { return useContext(LangCtx); }

function LanguageProvider({ children }) {
  const [lang, setLang] = useState("en");

  useEffect(() => {
    if (typeof document === "undefined") return;
    const originals = new Map();
    const attrOriginals = new Map();

    const translateNode = (node) => {
      if (node.nodeType !== 3) return;
      const raw = node.nodeValue;
      if (!raw || !raw.trim()) return;
      const parent = node.parentElement;
      if (parent && (parent.tagName === "SCRIPT" || parent.tagName === "STYLE")) return;
      const key = raw.trim();
      const ja = jaFor(key);
      if (!ja || ja === key) return;
      if (!originals.has(node)) originals.set(node, raw);
      node.nodeValue = raw.replace(key, ja);
    };

    const translateAttrs = (el) => {
      if (!el || el.nodeType !== 1 || !el.getAttribute) return;
      TRANSLATABLE_ATTRS.forEach((attr) => {
        const val = el.getAttribute(attr);
        if (!val || !val.trim()) return;
        const ja = jaFor(val);
        if (!ja || ja === val) return;
        const store = attrOriginals.get(el) || {};
        if (!(attr in store)) { store[attr] = val; attrOriginals.set(el, store); }
        el.setAttribute(attr, ja);
      });
      if (el.tagName === "INPUT" && /^(button|submit|reset)$/i.test(el.type || "") && el.value) {
        const ja = jaFor(el.value);
        if (ja && ja !== el.value) {
          const store = attrOriginals.get(el) || {};
          if (!("value" in store)) { store.value = el.value; attrOriginals.set(el, store); }
          el.value = ja;
        }
      }
    };

    const walk = (root) => {
      if (!root) return;
      if (root.nodeType === 3) return translateNode(root);
      if (root.nodeType !== 1) return;
      if (root.tagName === "SCRIPT" || root.tagName === "STYLE") return;
      translateAttrs(root);
      root.querySelectorAll && root.querySelectorAll("*").forEach(translateAttrs);
      const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = tw.nextNode())) translateNode(n);
    };

    if (lang !== "ja") {
      document.documentElement.lang = "en";
      return;
    }
    document.documentElement.lang = "ja";
    walk(document.body);
    const obs = new MutationObserver((records) => {
      records.forEach((r) => {
        r.addedNodes.forEach(walk);
        if (r.type === "characterData") translateNode(r.target);
        if (r.type === "attributes" && r.target) translateAttrs(r.target);
      });
    });
    obs.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: TRANSLATABLE_ATTRS,
    });

    return () => {
      obs.disconnect();
      originals.forEach((value, node) => { try { node.nodeValue = value; } catch { /* detached */ } });
      attrOriginals.forEach((store, el) => {
        try {
          Object.entries(store).forEach(([attr, value]) => {
            if (attr === "value") el.value = value;
            else el.setAttribute(attr, value);
          });
        } catch { /* detached */ }
      });
    };
  }, [lang]);


  const value = useMemo(() => ({ lang, setLang }), [lang]);
  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>;
}

const LANG_OPTIONS = [
  { id: "en", label: "English", native: "English" },
  { id: "ja", label: "Japanese", native: "日本語" },
];

function LanguagePicker() {
  const { lang, setLang } = useLanguage();
  const [open, setOpen] = useState(false);
  const current = LANG_OPTIONS.find((l) => l.id === lang) || LANG_OPTIONS[0];
  return (
    <div className="relative hidden md:block">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 hover:border-slate-300"
      >
        <Globe size={16} className="text-slate-400" />
        {current.native}
        <ChevronDown size={14} className="text-slate-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-2 w-44 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden">
            {LANG_OPTIONS.map((l) => (
              <button
                key={l.id}
                onClick={() => { setLang(l.id); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3.5 py-2.5 text-sm text-left hover:bg-slate-50"
                style={lang === l.id ? { background: C.greenLight, color: "#166534", fontWeight: 600 } : {}}
              >
                <span className="flex-1">{l.native}</span>
                {lang === l.id && <Check size={14} color={C.green} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------------------------- SHARED UI ---------------------------------- */
function StatusBadge({ status }) {
  const map = {
    Balanced: { bg: C.greenLight, fg: "#166534", icon: Check },
    Short: { bg: C.redLight, fg: "#991B1B", icon: AlertTriangle },
    Over: { bg: C.blueLight, fg: "#1E40AF", icon: AlertTriangle },
  };
  const s = map[status] || map.Balanced;
  const Icon = s.icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium"
      style={{ background: s.bg, color: s.fg }}
    >
      <Icon size={14} />
      {status}
    </span>
  );
}

function Card({ children, className = "", padded = true, style, ...rest }) {
  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200/70 shadow-sm ${padded ? "p-5" : ""} ${className}`}
      style={style}
      {...rest}
    >
      {children}
    </div>
  );
}

function Button({ children, variant = "primary", size = "md", className = "", ...props }) {
  const base =
    "inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none";
  const sizes = { md: "px-4 py-2.5 text-sm", lg: "px-5 py-3 text-[15px]", sm: "px-3 py-1.5 text-xs" };
  const variants = {
    primary: "text-white shadow-sm hover:shadow-md",
    secondary: "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50",
    ghost: "text-slate-600 hover:bg-slate-100",
    dangerLight: "bg-red-50 text-red-600 hover:bg-red-100",
  };
  const style = variant === "primary" ? { background: C.green } : {};
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} style={style} {...props}>
      {children}
    </button>
  );
}

/* ---------------------------------- TOP NAV ----------------------------------
   Responsive header: desktop keeps the full row (outlet, date, language), while
   phones keep only the hamburger + outlet selector; date & language move into the
   drawer. The header stays sticky on every breakpoint. */
function OutletPicker({ outlet, setOutlet }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative min-w-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 hover:border-slate-300 min-h-[44px] max-w-[52vw] sm:max-w-none"
      >
        <Store size={16} className="text-slate-400 shrink-0" />
        <span className="truncate font-medium">{outlet}</span>
        <ChevronDown size={14} className="text-slate-400 shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-2 w-56 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden">
            {OUTLETS.map((o) => (
              <button
                key={o}
                onClick={() => { setOutlet(o); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3.5 py-3 text-sm text-left hover:bg-slate-50 min-h-[44px]"
                style={outlet === o ? { background: C.greenLight, color: "#166534", fontWeight: 600 } : {}}
              >
                <span className="flex-1 truncate">{o}</span>
                {outlet === o && <Check size={14} color={C.green} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TopNav({ onToggleSidebar, onOpenDrawer, outlet, setOutlet }) {
  return (
    <header className="h-16 shrink-0 bg-white border-b border-slate-200 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 lg:px-6 sticky top-0 z-30">
      <button
        onClick={onToggleSidebar}
        className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hidden lg:inline-flex"
      >
        <Menu size={20} />
      </button>
      <button
        onClick={onOpenDrawer}
        aria-label="Open menu"
        className="lg:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-600 min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
      >
        <Menu size={22} />
      </button>

      <OutletPicker outlet={outlet} setOutlet={setOutlet} />

      <div className="hidden lg:flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 cursor-pointer hover:border-slate-300">
        <CalendarDays size={16} className="text-slate-400" />
        21 Jun 2026, Sat
        <ChevronDown size={14} className="text-slate-400" />
      </div>
      <LanguagePicker />

      <div className="ml-auto flex items-center gap-2 lg:gap-3">
        <div className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium" style={{ background: C.greenLight, color: "#166534" }}>
          <CircleDot size={10} fill="#16A34A" />
          Outlet Open
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Wifi size={14} className="text-emerald-500" />
          <span className="hidden sm:inline">Online</span>
        </div>
        <NotificationBell />
        <div className="hidden sm:flex items-center gap-2 pl-2 lg:pl-3 lg:border-l border-slate-200 cursor-pointer">
          <img
            src="https://i.pravatar.cc/64?img=13"
            className="w-8 h-8 rounded-full object-cover"
            alt="avatar"
          />
          <div className="hidden lg:block leading-tight">
            <div className="text-sm font-semibold text-slate-800">{CURRENT_USER.name}</div>
            <div className="text-xs text-slate-400">{CURRENT_USER.role}</div>
          </div>
          <ChevronDown size={14} className="hidden lg:block text-slate-400" />
        </div>
      </div>
    </header>
  );
}

/* --------------------------- MOBILE DRAWER (hamburger) --------------------------- */
function MobileDrawer({ open, onClose, active, setActive, outlet }) {
  const { lang, setLang } = useLanguage();
  const [langOpen, setLangOpen] = useState(false);
  const current = LANG_OPTIONS.find((l) => l.id === lang) || LANG_OPTIONS[0];
  if (!open) return null;
  return (
    <div className="lg:hidden fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <aside
        className="absolute inset-y-0 left-0 w-[82vw] max-w-[320px] bg-white flex flex-col shadow-2xl"
        style={{ animation: "drawerIn .22s ease-out" }}
      >
        <style>{`@keyframes drawerIn{from{transform:translateX(-100%)}to{transform:translateX(0)}}`}</style>
        <div className="h-16 flex items-center gap-2 px-4 border-b border-slate-200 shrink-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-white text-sm" style={{ background: C.green }}>A</div>
          <span className="font-extrabold tracking-tight text-slate-900">NEED<span style={{ color: C.green }}>POS</span></span>
          <button onClick={onClose} className="ml-auto p-2 rounded-lg hover:bg-slate-100 text-slate-500 min-w-[44px] min-h-[44px] flex items-center justify-center">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setActive(item.id); onClose(); }}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium min-h-[44px] ${
                  isActive ? "text-emerald-700" : "text-slate-600 hover:bg-slate-50"
                }`}
                style={isActive ? { background: C.greenLight } : {}}
              >
                <Icon size={18} className="shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}

          <div className="border-t border-slate-200 mt-3 pt-3 space-y-2">
            <div className="px-3">
              <div className="text-xs font-semibold text-slate-400">Outlet</div>
              <div className="text-sm font-semibold text-slate-800">{outlet}</div>
            </div>
            <div className="px-3">
              <div className="text-xs font-semibold text-slate-400">Date</div>
              <div className="text-sm font-semibold text-slate-800">21 Jun 2026</div>
            </div>
            <div className="px-3">
              <div className="text-xs font-semibold text-slate-400 mb-1">Language</div>
              <button
                onClick={() => setLangOpen((o) => !o)}
                className="w-full flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 min-h-[44px]"
              >
                <Globe size={16} className="text-slate-400" />
                <span className="flex-1 text-left">{current.native}</span>
                <ChevronDown size={14} className="text-slate-400" />
              </button>
              {langOpen && (
                <div className="mt-1 border border-slate-200 rounded-xl overflow-hidden">
                  {LANG_OPTIONS.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => { setLang(l.id); setLangOpen(false); }}
                      className="w-full flex items-center gap-2 px-3.5 py-3 text-sm text-left hover:bg-slate-50 min-h-[44px]"
                      style={lang === l.id ? { background: C.greenLight, color: "#166534", fontWeight: 600 } : {}}
                    >
                      <span className="flex-1">{l.native}</span>
                      {lang === l.id && <Check size={14} color={C.green} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </nav>

        <div className="border-t border-slate-200 p-3 shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <button className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold min-h-[44px]" style={{ background: C.redLight, color: "#991B1B" }}>
            <Lock size={16} /> Logout
          </button>
        </div>
      </aside>
    </div>
  );
}

/* ---------------------------------- SIDEBAR ---------------------------------- */
function Sidebar({ collapsed, active, setActive, promotionsEnabled = true }) {
  return (
    <aside
      className={`hidden lg:flex flex-col shrink-0 bg-white border-r border-slate-200 h-screen sticky top-0 transition-all duration-200 ${
        collapsed ? "w-[76px]" : "w-64"
      }`}
    >
      <div className="h-16 flex items-center gap-2 px-5 border-b border-slate-200 shrink-0">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-white text-sm shrink-0" style={{ background: C.green }}>A</div>
        {!collapsed && (
          <span className="font-extrabold tracking-tight text-slate-900 text-[15px]">
            UPCOMING <span style={{ color: C.green }}>POS</span>
          </span>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
        {NAV_ITEMS.filter((i) => promotionsEnabled || i.id !== "promotions").map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActive(item.id)}
              className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive ? "text-emerald-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              }`}
              style={isActive ? { background: C.greenLight } : {}}
              title={collapsed ? item.label : undefined}
            >
              {isActive && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-full" style={{ background: C.green }} />
              )}
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="p-4 border-t border-slate-200 shrink-0">
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5">
            <div className="text-sm font-semibold text-slate-800">UPCOMING Restaurant</div>
            <div className="text-xs text-slate-400 mb-2">Main Outlet</div>
            <div className="text-xs text-slate-500 space-y-0.5">
              <div>Cashier: <span className="text-slate-700 font-medium">Ranjan</span></div>
              <div>Shift: <span className="text-slate-700 font-medium">Morning</span></div>
              <div>10:00 AM – 06:00 PM</div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

function MobileBottomNav({ active, setActive }) {
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 flex items-stretch z-40 pb-[env(safe-area-inset-bottom)]">
      {BOTTOM_NAV.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setActive(item.id)}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5"
          >
            <Icon size={20} color={isActive ? C.green : "#94A3B8"} />
            <span className="text-[11px] font-medium" style={{ color: isActive ? C.green : "#94A3B8" }}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

/* ---------------------------------- DASHBOARD ---------------------------------- */
// Shift actions (Open/Close Shift) were removed from Quick Actions since they already
// live under the "Shift" tab in the bottom navigation — keeping them here duplicated
// functionality. Takeaway, Delivery & Event fill their place as genuinely new,
// frequently-used order-entry shortcuts that don't otherwise have a dedicated home.
const QUICK_ACTIONS = [
  { label: "Self Service / Fastfood", sub: "Create new order", icon: ShoppingCart, color: C.green, bg: C.greenLight, target: "take-order" },
  { label: "Settlement", sub: "Settle order", icon: Wallet, color: C.blue, bg: C.blueLight, target: "settlement" },
  { label: "Tables", sub: "Table overview", icon: Grid3x3, color: C.orange, bg: C.orangeLight, target: "tables" },
  { label: "Inventory", sub: "Stock overview", icon: Package, color: C.purple, bg: C.purpleLight, target: "inventory" },
  { label: "Takeaway Order", sub: "No table assigned", icon: Truck, color: C.red, bg: C.redLight, target: "takeaway-order" },
  { label: "Delivery Order", sub: "Uber Eats, Demaecan…", icon: Truck, color: C.indigo, bg: C.indigoLight, target: "delivery-order" },
  { label: "Event Order", sub: "Banquets & functions", icon: PartyPopper, color: C.pink, bg: C.pinkLight, target: "event-order" },
  { label: "Kitchen Display", sub: "Live kitchen tickets", icon: Monitor, color: C.blue, bg: C.blueLight, target: "kitchen" },
];

const BUSINESS_CARDS = [
  { label: "Total Sales", value: "¥45,000", delta: "+12.5%", up: true, icon: DollarSign, color: C.green, bg: C.greenLight },
  { label: "Orders", value: "56", delta: "+8.3%", up: true, icon: ShoppingBag, color: C.blue, bg: C.blueLight },
  { label: "Covers", value: "110", delta: "+10.0%", up: true, icon: UsersRound, color: C.orange, bg: C.orangeLight },
  { label: "APC", value: "¥810", delta: "+2.1%", up: true, icon: TrendingUp, color: C.purple, bg: C.purpleLight },
  { label: "Cash Sales", value: "¥20,000", delta: "44.4% of total", up: null, icon: Banknote, color: C.green, bg: C.greenLight },
  { label: "Card Sales", value: "¥18,000", delta: "40.0% of total", up: null, icon: CreditCard, color: C.blue, bg: C.blueLight },
  { label: "QR Payments", value: "¥5,000", delta: "11.1% of total", up: null, icon: QrCode, color: C.red, bg: C.redLight },
  { label: "Discount", value: "¥2,000", delta: "4.4% of total", up: null, icon: Percent, color: C.orange, bg: C.orangeLight },
];

const STATUS_CARDS = [
  { label: "Available Tables", value: "22", icon: Grid3x3, color: C.green, bg: C.greenLight },
  { label: "Occupied Tables", value: "6", icon: UsersRound, color: C.orange, bg: C.orangeLight },
  { label: "Running Orders", value: "14", icon: Receipt, color: C.blue, bg: C.blueLight },
  { label: "Invoices Generated", value: "38", icon: FileWarning, color: "#475569", bg: "#F1F5F9" },
  { label: "Reserved Tables", value: "2", icon: CalendarDays, color: C.red, bg: C.redLight },
  { label: "Pending Settlement", value: "¥12,500", icon: AlertTriangle, color: C.red, bg: C.redLight, alert: true },
];

const SALES_DATA = {
  Today: [
    { t: "01:00", v: 2 }, { t: "04:00", v: 5 }, { t: "08:00", v: 22 }, { t: "10:00", v: 30 },
    { t: "12:00", v: 41 }, { t: "13:00", v: 38 }, { t: "16:00", v: 44 }, { t: "17:00", v: 46 },
    { t: "19:00", v: 40 }, { t: "20:00", v: 33 }, { t: "22:00", v: 18 }, { t: "24:00", v: 6 },
  ],
  Yesterday: [
    { t: "01:00", v: 1 }, { t: "04:00", v: 3 }, { t: "08:00", v: 18 }, { t: "10:00", v: 25 },
    { t: "12:00", v: 35 }, { t: "13:00", v: 33 }, { t: "16:00", v: 38 }, { t: "17:00", v: 40 },
    { t: "19:00", v: 36 }, { t: "20:00", v: 29 }, { t: "22:00", v: 15 }, { t: "24:00", v: 5 },
  ],
  "This Week": [
    { t: "Mon", v: 30 }, { t: "Tue", v: 34 }, { t: "Wed", v: 28 }, { t: "Thu", v: 40 },
    { t: "Fri", v: 46 }, { t: "Sat", v: 45 }, { t: "Sun", v: 38 },
  ],
  "This Month": [
    { t: "W1", v: 210 }, { t: "W2", v: 245 }, { t: "W3", v: 190 }, { t: "W4", v: 260 },
  ],
};

const TOP_ITEMS = [
  { name: "Chicken Tikka", value: "¥18,000", pct: 40, color: C.green },
  { name: "Butter Chicken", value: "¥12,600", pct: 26, color: C.blue },
  { name: "Japanese Wine (60ML)", value: "¥7,200", pct: 16, color: C.purple },
  { name: "Momo", value: "¥4,500", pct: 10, color: C.orange },
  { name: "Coke", value: "¥2,700", pct: 6, color: C.red },
];

const ALERTS = [
  { count: 3, label: "Low Stock", sub: "3 items are running low in stock", color: C.red, bg: C.redLight },
  { count: 2, label: "Kitchen Delay", sub: "2 settlements are pending", color: C.orange, bg: C.orangeLight },
  { count: 2, label: "Pending Settlement", sub: "2 orders are delayed", color: C.red, bg: C.redLight },
  { count: 1, label: "Shift Not Closed", sub: "1 outlet is not yet closed", color: C.orange, bg: C.orangeLight },
  { count: 1, label: "Outlet Not Open", sub: "1 shift is not closed yet", color: C.blue, bg: C.blueLight },
];

const ACTIVITY = [
  { icon: ShoppingCart, color: C.green, bg: C.greenLight, title: "Order #1201", sub: "Table 5 · 2 Items", time: "11:20 AM", tag: "Completed", tagColor: C.green },
  { icon: Wallet, color: C.blue, bg: C.blueLight, title: "Settlement #550", sub: "Cash · ¥4,640", time: "11:15 AM", tag: "Completed", tagColor: C.green },
  { icon: UsersRound, color: C.orange, bg: C.orangeLight, title: "Table 3", sub: "Occupied", time: "11:15 AM", tag: "Occupied", tagColor: C.orange },
  { icon: Users, color: C.purple, bg: C.purpleLight, title: "New Customer", sub: "Rahul Sharma", time: "11:12 AM", tag: "New", tagColor: C.blue },
  { icon: Package, color: "#475569", bg: "#F1F5F9", title: "Inventory Update", sub: "Chicken Tikka · 2.5 KG", time: "11:10 AM", tag: "Updated", tagColor: "#475569" },
];

// Reusable Quick Action card — used on the Dashboard's Quick Actions grid.
// Keeping this as its own component (rather than inlining the markup in a .map)
// makes it easy to reuse elsewhere (e.g. the mobile "More" grid) and keeps the
// Dashboard render function focused on layout rather than card markup.
function QuickActionCard({ action, onClick }) {
  const Icon = action.icon;
  return (
    <button
      onClick={onClick}
      title={action.sub}
      className="group relative bg-white border border-slate-200/70 rounded-2xl p-4 flex items-center gap-3 text-left
                 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-slate-300
                 active:scale-[0.97] active:shadow-sm active:translate-y-0
                 transition-all duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-150 group-hover:scale-105"
        style={{ background: action.bg }}
      >
        <Icon size={20} color={action.color} />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-800 truncate">{action.label}</div>
        <div className="text-xs text-slate-400 truncate">{action.sub}</div>
      </div>
      <ChevronRight
        size={16}
        className="ml-auto shrink-0 text-slate-300 opacity-0 -translate-x-1 transition-all duration-150 group-hover:opacity-100 group-hover:translate-x-0 hidden sm:block"
      />
    </button>
  );
}

function Dashboard({ setActive }) {
  const [period, setPeriod] = useState("Today");
  const data = SALES_DATA[period];

  return (
    <div className="space-y-6 pb-8">
      {/* Quick actions — 2 columns on mobile, 3 on tablet, up to 7 across on desktop.
         7 cards total (Take Order, Settlement, Tables, Inventory, Takeaway, Delivery, Event). */}
      <section>
        <h2 className="text-[17px] font-bold text-slate-800 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-3">
          {QUICK_ACTIONS.map((a) => (
            <QuickActionCard key={a.label} action={a} onClick={() => setActive && setActive(a.target)} />
          ))}
        </div>
      </section>

      {/* Today's business */}
      <section>
        <h2 className="text-[17px] font-bold text-slate-800 mb-3">Today's Business</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-4 gap-3">
          {BUSINESS_CARDS.map((c) => (
            <Card key={c.label} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: c.bg }}>
                  <c.icon size={17} color={c.color} />
                </div>
                {c.up !== null && (
                  <span className="flex items-center gap-0.5 text-xs font-semibold text-emerald-600">
                    <TrendingUp size={12} /> {c.delta}
                  </span>
                )}
              </div>
              <div className="text-xl font-bold text-slate-900">{c.value}</div>
              <div className="text-xs text-slate-400 mt-0.5">
                {c.up === null ? c.delta : c.label}
              </div>
              {c.up !== null && <div className="text-xs text-slate-400">{c.label}</div>}
            </Card>
          ))}
        </div>
      </section>

      {/* Restaurant status */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[17px] font-bold text-slate-800">Restaurant Status</h2>
          <button className="text-sm font-medium" style={{ color: C.green }}>From Main Outlet</button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          {STATUS_CARDS.map((s) => (
            <Card key={s.label} className={`p-4 ${s.alert ? "ring-1 ring-red-200" : ""}`} >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background: s.bg }}>
                <s.icon size={17} color={s.color} />
              </div>
              <div className="text-lg font-bold text-slate-900">{s.value}</div>
              <div className="text-xs text-slate-400">{s.label}</div>
            </Card>
          ))}
        </div>
      </section>

      {/* Sales overview + top selling / alerts / activity */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h3 className="font-bold text-slate-800">Sales Overview</h3>
            <div className="flex bg-slate-100 rounded-lg p-1 text-xs font-medium">
              {Object.keys(SALES_DATA).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className="px-3 py-1.5 rounded-md transition-colors"
                  style={period === p ? { background: C.green, color: "white" } : { color: "#64748B" }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ left: -20, right: 8 }}>
                <CartesianGrid vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="t" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `¥${v}K`} />
                <Tooltip
                  cursor={{ fill: "#F0FDF4" }}
                  contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 12 }}
                  formatter={(v) => [`¥${v},000`, "Sales"]}
                />
                <Bar dataKey="v" fill={C.green} radius={[6, 6, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800">Top 5 Selling Items</h3>
            <button className="text-xs font-medium" style={{ color: C.green }}>View More</button>
          </div>
          <div className="space-y-4">
            {TOP_ITEMS.map((it, i) => (
              <div key={it.name} className="flex items-center gap-3">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                  style={{ background: it.color }}
                >
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700 truncate">{it.name}</span>
                    <span className="text-slate-400 text-xs shrink-0 ml-2">{it.value}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${it.pct}%`, background: it.color }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800">Alerts</h3>
            <button className="text-xs font-medium" style={{ color: C.green }}>View All</button>
          </div>
          <div className="space-y-2.5">
            {ALERTS.map((a, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl" style={{ background: a.bg }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: a.color }}>
                  {a.count}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-800 truncate">{a.label}</div>
                  <div className="text-xs text-slate-500 truncate">{a.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800">Recent Activity</h3>
            <button className="text-xs font-medium" style={{ color: C.green }}>View All</button>
          </div>
          <div className="space-y-1">
            {ACTIVITY.map((a, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5 border-b last:border-0 border-slate-100">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: a.bg }}>
                  <a.icon size={16} color={a.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-800 truncate">{a.title}</div>
                  <div className="text-xs text-slate-400 truncate">{a.sub}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-slate-400 mb-1">{a.time}</div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ color: a.tagColor, background: `${a.tagColor}1A` }}>
                    {a.tag}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------------------------------- COUNT CASH MODAL ---------------------------------- */
const NOTES = [10000, 5000, 2000, 1000];
const COINS = [500, 100, 50, 10];

function CountCashModal({ open, onClose, onConfirm }) {
  const [counts, setCounts] = useState({});

  const total = useMemo(() => {
    return [...NOTES, ...COINS].reduce((sum, d) => sum + (counts[d] || 0) * d, 0);
  }, [counts]);

  if (!open) return null;

  const update = (d, delta) => {
    setCounts((prev) => ({ ...prev, [d]: Math.max(0, (prev[d] || 0) + delta) }));
  };

  const Denomination = ({ d }) => (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-sm font-medium text-slate-600">¥{d.toLocaleString()}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => update(d, -1)}
          className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 text-slate-500"
        >
          <Minus size={13} />
        </button>
        <span className="w-8 text-center text-sm font-semibold text-slate-800">{counts[d] || 0}</span>
        <button
          onClick={() => update(d, 1)}
          className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 text-slate-500"
        >
          <Plus size={13} />
        </button>
      </div>
      <span className="text-sm font-semibold text-slate-800 w-20 text-right">
        ¥{((counts[d] || 0) * d).toLocaleString()}
      </span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-[2px] p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col animate-[slideUp_.2s_ease-out]">
        <div className="flex items-center justify-between px-5 sm:px-6 pt-5 pb-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="font-bold text-slate-800 text-lg">Count Cash</h3>
            <p className="text-xs text-slate-400">Count each denomination to calculate total</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 sm:px-6 py-4 space-y-5">
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Notes</div>
            {NOTES.map((d) => <Denomination key={d} d={d} />)}
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Coins</div>
            {COINS.map((d) => <Denomination key={d} d={d} />)}
          </div>
        </div>

        <div className="px-5 sm:px-6 py-4 border-t border-slate-100 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <span className="font-semibold text-slate-600">Total Amount</span>
            <span className="text-2xl font-extrabold" style={{ color: C.green }}>¥{total.toLocaleString()}</span>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button
              className="flex-1"
              onClick={() => {
                onConfirm(total);
                onClose();
              }}
            >
              Confirm
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- CASH IN / ADD EXPENSE MODAL ---------------------------------- */
function CIOModal({ mode, balance, initialAmount, initialReason, isEdit, onClose, onConfirm, onDelete }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (mode) {
      setAmount(initialAmount != null ? String(initialAmount) : "");
      setReason(initialReason || "");
    }
  }, [mode, initialAmount, initialReason]);

  if (!mode) return null;
  const isIn = mode === "in";
  const amt = parseFloat(amount) || 0;
  const baseBalance = isEdit ? balance + (isIn ? -(initialAmount || 0) : (initialAmount || 0)) : balance;
  const after = isIn ? baseBalance + amt : baseBalance - amt;
  const color = isIn ? C.green : C.red;
  const bg = isIn ? C.greenLight : C.redLight;

  const reset = () => { setAmount(""); setReason(""); };

  const submit = () => {
    if (!amt || !reason.trim()) return;
    onConfirm({ amount: amt, reason: reason.trim() });
    reset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-[2px] p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col animate-[slideUp_.2s_ease-out]">
        <div className="flex items-center justify-between px-5 sm:px-6 pt-5 pb-4 border-b border-slate-100 shrink-0">
          <h3 className="font-bold text-slate-800 text-lg">
            {isEdit ? (isIn ? "Edit Cash In" : "Edit Expense") : (isIn ? "Add Cash In" : "Add Expense")}
          </h3>
          <button onClick={() => { onClose(); reset(); }} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 sm:px-6 py-4 space-y-4">
          <div className="flex items-center gap-3 p-3.5 rounded-xl" style={{ background: bg }}>
            {isIn ? <ArrowUpCircle size={22} color={color} /> : <ArrowDownCircle size={22} color={color} />}
            <div>
              <div className="text-sm font-semibold" style={{ color }}>
                {isIn ? "Cash In" : "Cash Out (Expense)"}
              </div>
              <div className="text-xs" style={{ color }}>Current balance ¥{baseBalance.toLocaleString()}</div>
            </div>
          </div>

          <Field label="Amount">
            <div className="flex items-center gap-1 border border-slate-200 rounded-xl px-3.5 bg-slate-50 focus-within:ring-2 focus-within:ring-emerald-500/30 focus-within:border-emerald-400 transition-all">
              <span className="text-lg font-semibold text-slate-400">¥</span>
              <input
                type="number"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full bg-transparent border-none py-3 text-xl font-semibold text-slate-800 focus:outline-none"
              />
              {amount !== "" && (
                <button onClick={() => setAmount("")} className="text-slate-400 hover:text-slate-600">
                  <X size={16} />
                </button>
              )}
            </div>
          </Field>

          {amt > 0 && (
            <div className="rounded-xl bg-slate-50 p-3.5 text-sm space-y-1.5">
              <div className="flex justify-between text-slate-500">
                <span>Current balance</span>
                <span className="font-medium text-slate-700">¥{baseBalance.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>{isIn ? "+ Adding" : "− Deducting"}</span>
                <span className="font-medium" style={{ color }}>
                  {isIn ? "+" : "−"}¥{amt.toLocaleString()}
                </span>
              </div>
              <div className="border-t border-dashed border-slate-300 my-1.5" />
              <div className="flex justify-between">
                <span className="font-semibold text-slate-700">Balance after</span>
                <span className="font-bold text-slate-900">¥{after.toLocaleString()}</span>
              </div>
            </div>
          )}

          <Field label="Reason">
            <textarea
              className={inputCls}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={isIn ? "e.g. Extra float added, cash sales top-up…" : "e.g. Coffee supplies, staff lunch…"}
            />
          </Field>
        </div>

        <div className="px-5 sm:px-6 py-4 border-t border-slate-100 shrink-0 flex items-center gap-3">
          {isEdit && (
            <button
              onClick={() => { onDelete(); reset(); onClose(); }}
              className="mr-auto flex items-center gap-1.5 text-sm font-medium text-red-500 hover:text-red-600"
            >
              <Trash2 size={14} /> Delete
            </button>
          )}
          <Button variant="secondary" className={isEdit ? "" : "flex-1"} onClick={() => { onClose(); reset(); }}>
            Discard
          </Button>
          <Button
            className={isEdit ? "" : "flex-1"}
            disabled={!amt || !reason.trim()}
            style={{ background: color }}
            onClick={submit}
          >
            {isEdit ? "Save Changes" : "Confirm"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- SHIFT MANAGEMENT ---------------------------------- */
const STEPS = ["Open Shift", "Cash In / Out", "Close Shift"];

function Stepper({ step, setStep }) {
  return (
    <div className="flex items-center gap-2 sm:gap-4 mb-6 overflow-x-auto">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const state = n === step ? "active" : n < step ? "done" : "todo";
        return (
          <React.Fragment key={label}>
            <button
              onClick={() => setStep(n)}
              className="flex items-center gap-2 shrink-0"
            >
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={
                  state === "todo"
                    ? { background: "#F1F5F9", color: "#94A3B8" }
                    : { background: C.green, color: "white" }
                }
              >
                {state === "done" ? <Check size={14} /> : n}
              </span>
              <span
                className="text-sm font-semibold whitespace-nowrap"
                style={{ color: state === "todo" ? "#94A3B8" : "#1E293B" }}
              >
                {label}
              </span>
            </button>
            {i < STEPS.length - 1 && <div className="w-6 sm:w-12 h-px bg-slate-200 shrink-0" />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all";

function OpenShiftStep({ openingCash, onCountCash, onNext }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-1">
        <h3 className="font-bold text-slate-800 mb-4">Opening Cash</h3>
        <Field label="Amount">
          <div className="text-2xl font-extrabold text-slate-900 mb-3">¥{openingCash.toLocaleString()}</div>
        </Field>
        <Button variant="secondary" className="w-full" onClick={onCountCash}>
          <Banknote size={16} /> Count Cash
        </Button>
      </Card>

      <Card className="lg:col-span-1">
        <h3 className="font-bold text-slate-800 mb-4">Shift Information</h3>
        <div className="space-y-3.5">
          <Field label="Outlet">
            <select className={inputCls}><option>UPCOMING Restaurant</option></select>
          </Field>
          <Field label="Shift Type">
            <select className={inputCls}><option>Morning Shift</option><option>Evening Shift</option></select>
          </Field>
          <Field label="Remarks">
            <input className={inputCls} defaultValue="Morning busy hours" />
          </Field>
          <Field label="Opening Note">
            <textarea className={inputCls} rows={2} defaultValue="All good and ready to start the day." />
          </Field>
        </div>
      </Card>

      <Card className="lg:col-span-1">
        <h3 className="font-bold text-slate-800 mb-4">Shift Overview</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: C.blueLight }}>
              <Clock size={18} color={C.blue} />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-900">10:45 AM</div>
              <div className="text-xs text-slate-400">Sat, 21 Jun 2026</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: C.greenLight }}>
              <DollarSign size={18} color={C.green} />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-900">¥45,000</div>
              <div className="text-xs text-slate-400">Today's Sales · +12.5%</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: C.purpleLight }}>
              <UsersRound size={18} color={C.purple} />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-900">12 / 18</div>
              <div className="text-xs text-slate-400">Employees Clocked In</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: C.orangeLight }}>
              <Receipt size={18} color={C.orange} />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-900">14</div>
              <div className="text-xs text-slate-400">Pending Orders</div>
            </div>
          </div>
        </div>
      </Card>

      <div className="lg:col-span-3 flex justify-end gap-3">
        <Button variant="secondary">Cancel</Button>
        <Button onClick={onNext}>Open Shift <ChevronRight size={16} /></Button>
      </div>
    </div>
  );
}

const TXN_HISTORY = [
  { time: "10:20 AM", type: "Cash In", note: "Opening cash added", amount: 3000, up: true },
  { time: "10:35 AM", type: "Cash Out", note: "Coffee supplies", amount: -500, up: false },
  { time: "11:15 AM", type: "Cash In", note: "Cash sales", amount: 1000, up: true },
  { time: "01:20 PM", type: "Cash Out", note: "Staff lunch", amount: -800, up: false },
];

function CashInOutStep({ onNext, onBack, history, openingCash, onAddCashIn, onAddExpense, onEditEntry, onDeleteEntry }) {
  const cashIn = history.filter((h) => h.up).reduce((s, h) => s + h.amount, 0);
  const cashOut = history.filter((h) => !h.up).reduce((s, h) => s + h.amount, 0);
  const opening = openingCash;
  const balance = opening + cashIn + cashOut;
  const rows = history.map((h, i) => ({ ...h, i })).slice().reverse();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: C.greenLight }}>
            <ArrowUpCircle size={20} color={C.green} />
          </div>
          <div className="text-xl font-bold text-slate-900">¥{cashIn.toLocaleString()}</div>
          <div className="text-xs text-slate-400 mb-3">{history.filter(h=>h.up).length} Entries</div>
          <Button size="sm" variant="secondary" className="w-full" onClick={onAddCashIn}><Plus size={14} /> Add Cash In</Button>
        </Card>
        <Card>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: C.redLight }}>
            <ArrowDownCircle size={20} color={C.red} />
          </div>
          <div className="text-xl font-bold text-slate-900">¥{Math.abs(cashOut).toLocaleString()}</div>
          <div className="text-xs text-slate-400 mb-3">{history.filter(h=>!h.up).length} Entries</div>
          <Button size="sm" variant="dangerLight" className="w-full" onClick={onAddExpense}><Plus size={14} /> Add Expense</Button>
        </Card>
        <Card className="sm:col-span-2 xl:col-span-1">
          <h4 className="text-sm font-bold text-slate-700 mb-3">Current Balance</h4>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-500"><span>Opening Cash</span><span className="font-medium text-slate-700">¥{opening.toLocaleString()}</span></div>
            <div className="flex justify-between text-slate-500"><span>Total Cash In</span><span className="font-medium text-emerald-600">+¥{cashIn.toLocaleString()}</span></div>
            <div className="flex justify-between text-slate-500"><span>Total Cash Out</span><span className="font-medium text-red-500">¥{cashOut.toLocaleString()}</span></div>
          </div>
        </Card>
        <Card className="flex flex-col justify-center items-center text-center" style={{ background: C.green }}>
          <Wallet size={22} className="text-white/90 mb-2" />
          <div className="text-2xl font-extrabold text-white">¥{balance.toLocaleString()}</div>
          <div className="text-xs text-white/80">Current Balance</div>
        </Card>
      </div>

      <Card padded={false}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h3 className="font-bold text-slate-800">Transaction History</h3>
          <button className="text-xs font-medium" style={{ color: C.green }}>View All</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 border-y border-slate-100">
                <th className="text-left font-medium px-5 py-2.5">Time</th>
                <th className="text-left font-medium px-5 py-2.5">Type</th>
                <th className="text-left font-medium px-5 py-2.5">Note</th>
                <th className="text-right font-medium px-5 py-2.5">Amount</th>
                <th className="text-right font-medium px-5 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((h) => (
                <tr key={h.i} className="border-b last:border-0 border-slate-50 group hover:bg-slate-50/60">
                  <td className="px-5 py-3 text-slate-500">{h.time}</td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{ color: h.up ? "#166534" : "#991B1B", background: h.up ? C.greenLight : C.redLight }}>
                      {h.up ? <ArrowUpCircle size={12} /> : <ArrowDownCircle size={12} />}
                      {h.type}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{h.note}</td>
                  <td className={`px-5 py-3 text-right font-semibold ${h.up ? "text-emerald-600" : "text-red-500"}`}>
                    {h.up ? "+" : ""}¥{h.amount.toLocaleString()}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onEditEntry(h.i)}
                        className="p-1.5 rounded-lg hover:bg-slate-200/70 text-slate-500 hover:text-slate-700"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => onDeleteEntry(h.i)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-slate-500 hover:text-red-500"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="h-2" />
      </Card>

      <div className="flex justify-between gap-3">
        <Button variant="secondary" onClick={onBack}><ChevronLeft size={16} /> Back</Button>
        <Button onClick={onNext}>Continue <ChevronRight size={16} /></Button>
      </div>
    </div>
  );
}

const TODAYS_SALES_CASH = 45000;

function CloseShiftStep({ countedCash, onCountCash, onBack, history, openingCash, onReset }) {
  const [closingNote, setClosingNote] = useState("All sales recorded and cash verified.");
  const [receipt, setReceipt] = useState(null);

  const cashIn = history.filter((h) => h.up).reduce((s, h) => s + h.amount, 0);
  const cashOut = history.filter((h) => !h.up).reduce((s, h) => s + h.amount, 0);
  const sales = TODAYS_SALES_CASH;
  const opening = openingCash;
  const expected = sales + cashIn + cashOut;
  const diff = countedCash - expected;
  const status = diff === 0 ? "Balanced" : diff > 0 ? "Over" : "Short";

  const handleCloseShift = () => {
    setReceipt({
      voucher: "SC/2026/0118",
      date: "21 Jun 2026, Sat",
      outlet: "UPCOMING Restaurant · Main Outlet",
      cashier: "Ranjan",
      remarks: closingNote,
      opening,
      sales,
      cashIn,
      cashOut,
      cashLog: history,
      expected,
      counted: countedCash,
      diff,
      status,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });
  };

  if (receipt) {
    return <ReceiptSlip data={receipt} onNewShift={onReset} />;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800">Reconciliation Summary</h3>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Expected Cash</span><span className="font-semibold text-slate-800">¥{expected.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Counted Cash</span><span className="font-semibold text-slate-800">¥{countedCash.toLocaleString()}</span></div>
            <div className="flex justify-between pt-3 border-t border-slate-100"><span className="text-slate-500">Difference</span><span className="font-semibold" style={{ color: diff === 0 ? C.green : C.red }}>{diff >= 0 ? "+" : ""}¥{diff.toLocaleString()}</span></div>
          </div>
          <div className="mt-4"><StatusBadge status={status} /></div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800">Cash Breakdown</h3>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between opacity-60"><span className="text-slate-500">Opening (reference only)</span><span className="font-semibold text-slate-800">¥{opening.toLocaleString()}</span></div>
            <div className="flex justify-between pt-3 border-t border-slate-100"><span className="text-slate-500">Sales (Cash)</span><span className="font-semibold text-slate-800">¥{sales.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Cash In</span><span className="font-semibold text-emerald-600">+¥{cashIn.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Cash Out (Expenses)</span><span className="font-semibold text-red-500">¥{cashOut.toLocaleString()}</span></div>
            <div className="flex justify-between pt-3 border-t border-slate-100"><span className="text-slate-700 font-semibold">Expected Closing</span><span className="font-bold text-slate-900">¥{expected.toLocaleString()}</span></div>
          </div>
        </Card>

        <Card>
          <h3 className="font-bold text-slate-800 mb-4">Counted Cash</h3>
          <div className="text-2xl font-extrabold text-slate-900 mb-3">¥{countedCash.toLocaleString()}</div>
          <Button variant="secondary" className="w-full mb-4" onClick={onCountCash}>
            <Banknote size={16} /> Count Cash
          </Button>
          <Field label="Closing Note">
            <textarea
              className={inputCls}
              rows={2}
              value={closingNote}
              onChange={(e) => setClosingNote(e.target.value)}
            />
          </Field>
        </Card>
      </div>

      <div className="flex justify-between gap-3">
        <Button variant="secondary" onClick={onBack}><ChevronLeft size={16} /> Back</Button>
        <div className="flex gap-3">
          <Button variant="secondary">Cancel</Button>
          <Button onClick={handleCloseShift}>Close Shift</Button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- CLOSING RECEIPT SLIP ---------------------------------- */
function SlipRow({ label, value, muted, bold, valueColor }) {
  return (
    <div className="flex justify-between gap-4" style={{ opacity: muted ? 0.6 : 1 }}>
      <span className="text-slate-500">{label}</span>
      <span
        className={bold ? "font-bold text-slate-900" : "font-medium text-slate-700"}
        style={valueColor ? { color: valueColor } : {}}
      >
        {value}
      </span>
    </div>
  );
}

function SlipDivider() {
  return <div className="border-t border-dashed border-slate-300 my-2.5" />;
}

function ReceiptSlip({ data, onNewShift }) {
  return (
    <div className="max-w-2xl">
      <Card>
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: C.greenLight }}>
            <Check size={18} color={C.green} />
          </div>
          <h3 className="font-bold text-slate-800 text-lg">Shift Closed</h3>
          <StatusBadge status={data.status} />
        </div>
        <p className="text-xs text-slate-400 mb-5 ml-[46px]">Closing receipt with reconciliation</p>

        <div className="rounded-2xl bg-slate-50 border border-slate-200/70 p-5 text-[13px] space-y-2">
          <SlipRow label="Voucher" value={data.voucher} />
          <SlipRow label="Date" value={data.date} />
          <SlipRow label="Outlet" value={data.outlet} />
          <SlipRow label="Cashier" value={data.cashier} />
          <SlipRow label="Remarks" value={data.remarks} />
          <SlipDivider />
          <SlipRow label="Opening Cash (reference only)" value={`¥${data.opening.toLocaleString()}`} muted />
          <SlipRow label="Sales (Payments in Cash)" value={`¥${data.sales.toLocaleString()}`} />
          <SlipRow label="Cash In" value={`+¥${data.cashIn.toLocaleString()}`} valueColor={C.green} />
          <SlipRow label="Cash Out" value={`-¥${Math.abs(data.cashOut).toLocaleString()}`} valueColor={C.red} />

          {data.cashLog?.length > 0 && (
            <div className="ml-3 pl-3 border-l-2 border-slate-200 space-y-1 py-1">
              {data.cashLog.map((e, i) => (
                <div key={i} className="flex justify-between text-xs text-slate-400">
                  <span>{e.time} · {e.note}</span>
                  <span style={{ color: e.up ? C.green : C.red }}>{e.up ? "+" : ""}¥{e.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}

          <SlipDivider />
          <SlipRow label="Expected Closing" value={`¥${data.expected.toLocaleString()}`} bold />
          <SlipRow label="Counted Cash" value={`¥${data.counted.toLocaleString()}`} />
          <SlipRow
            label="Difference"
            value={`${data.diff >= 0 ? "+" : ""}¥${data.diff.toLocaleString()} (${data.status})`}
            valueColor={data.diff === 0 ? C.green : C.red}
            bold
          />
          <SlipDivider />
          <div className="text-xs text-slate-400">Closed at {data.time} · Cashier: {data.cashier}</div>
        </div>

        <div className="flex justify-end mt-5">
          <Button variant="secondary" onClick={onNewShift}>
            <Clock size={16} /> Start New Shift
          </Button>
        </div>
      </Card>
    </div>
  );
}

function ShiftManagement() {
  const [step, setStep] = useState(1);
  const [openingCash, setOpeningCash] = useState(25000);
  const [countedCash, setCountedCash] = useState(42000);
  const [modal, setModal] = useState(null); // 'open' | 'close' | null
  const [history, setHistory] = useState(TXN_HISTORY);
  const [cioModal, setCioModal] = useState(null); // 'in' | 'out' | null
  const [editingIndex, setEditingIndex] = useState(null);

  const balance =
    openingCash +
    history.filter((h) => h.up).reduce((s, h) => s + h.amount, 0) +
    history.filter((h) => !h.up).reduce((s, h) => s + h.amount, 0);

  const editingEntry = editingIndex != null ? history[editingIndex] : null;

  const openAddCio = (mode) => {
    setEditingIndex(null);
    setCioModal(mode);
  };

  const openEditCio = (index) => {
    const entry = history[index];
    setEditingIndex(index);
    setCioModal(entry.up ? "in" : "out");
  };

  const handleCioConfirm = ({ amount, reason }) => {
    const isIn = cioModal === "in";
    if (editingIndex != null) {
      setHistory((prev) =>
        prev.map((h, i) =>
          i === editingIndex
            ? { ...h, type: isIn ? "Cash In" : "Cash Out", note: reason, amount: isIn ? amount : -amount, up: isIn }
            : h
        )
      );
    } else {
      setHistory((prev) => [
        ...prev,
        {
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          type: isIn ? "Cash In" : "Cash Out",
          note: reason,
          amount: isIn ? amount : -amount,
          up: isIn,
        },
      ]);
    }
  };

  const handleCioDelete = () => {
    if (editingIndex == null) return;
    setHistory((prev) => prev.filter((_, i) => i !== editingIndex));
  };

  const resetShift = () => {
    setStep(1);
    setOpeningCash(25000);
    setCountedCash(42000);
    setHistory(TXN_HISTORY);
  };

  return (
    <div className="pb-8">
      <div className="mb-1">
        <h1 className="text-xl font-bold text-slate-800">Shift Management</h1>
        <p className="text-sm text-slate-400 mb-5">Open, manage cash flow, and close your shift with a clean reconciliation.</p>
      </div>
      <Stepper step={step} setStep={setStep} />

      {step === 1 && (
        <OpenShiftStep
          openingCash={openingCash}
          onCountCash={() => setModal("open")}
          onNext={() => setStep(2)}
        />
      )}
      {step === 2 && (
        <CashInOutStep
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
          history={history}
          openingCash={openingCash}
          onAddCashIn={() => openAddCio("in")}
          onAddExpense={() => openAddCio("out")}
          onEditEntry={openEditCio}
          onDeleteEntry={(i) => setHistory((prev) => prev.filter((_, idx) => idx !== i))}
        />
      )}
      {step === 3 && (
        <CloseShiftStep
          countedCash={countedCash}
          onCountCash={() => setModal("close")}
          onBack={() => setStep(2)}
          history={history}
          openingCash={openingCash}
          onReset={resetShift}
        />
      )}

      <CountCashModal
        open={!!modal}
        onClose={() => setModal(null)}
        onConfirm={(total) => (modal === "open" ? setOpeningCash(total) : setCountedCash(total))}
      />

      <CIOModal
        mode={cioModal}
        balance={balance}
        isEdit={editingIndex != null}
        initialAmount={editingEntry ? Math.abs(editingEntry.amount) : null}
        initialReason={editingEntry ? editingEntry.note : ""}
        onClose={() => { setCioModal(null); setEditingIndex(null); }}
        onConfirm={handleCioConfirm}
        onDelete={handleCioDelete}
      />
    </div>
  );
}

/* ---------------------------------- SHIFT CLOSE REPORT ---------------------------------- */
const SHIFT_REPORTS = [
  {
    id: "SC-2025-03-26-001",
    date: "2025/03/26 22:15",
    voucher: "VCH-2025-03-26-001",
    module: "Shift Close",
    outlet: "Main Outlet",
    amount: 48700,
    remarks: "Morning Shift Close",
    generatedBy: "Ranjan (Cashier)",
    generatedOn: "2025/03/26 22:16",
    ackBy: "Manager",
    ackOn: "2025/03/26 22:20",
    detail: {
      shiftName: "Morning Shift",
      shiftTime: "10:00 AM - 10:15 PM",
      date: "26 Mar 2025",
      day: "Wednesday",
      outlet: "Main Outlet",
      cashier: "Ranjan (Cashier)",
      status: "Closed",
      duration: "12h 15m",
      sales: {
        totalSales: 45000,
        totalOrders: 56,
        totalCustomers: 110,
        avgOrderValue: 803.57,
        discount: 2000,
        tax: 4500,
        netSales: 45000,
      },
      payments: [
        { label: "Cash", amount: 20000, pct: 44.4, color: C.green },
        { label: "Card", amount: 18000, pct: 40.0, color: C.blue },
        { label: "QR Payment", amount: 5000, pct: 11.1, color: C.orange },
        { label: "Others", amount: 2000, pct: 4.4, color: C.purple },
      ],
      cash: { opening: 20000, cashIn: 4000, cashOut: 1300, balance: 22700 },
      reconciliation: { expected: 48700, counted: 48700, diff: 0, status: "Balanced" },
      cashLog: [
        { time: "10:20 AM", type: "Cash In", reason: "Opening Float", note: "Initial cash for opening", amount: 3000, up: true, by: "Ranjan" },
        { time: "10:35 AM", type: "Cash Out", reason: "Coffee Supplies", note: "Purchased coffee beans", amount: -500, up: false, by: "Ranjan" },
        { time: "11:15 AM", type: "Cash In", reason: "Cash Sales", note: "Additional cash from sales", amount: 1000, up: true, by: "Ranjan" },
        { time: "01:20 PM", type: "Cash Out", reason: "Staff Lunch", note: "Lunch for kitchen staff", amount: -800, up: false, by: "Ranjan" },
      ],
      denominations: [
        { value: 10000, qty: 4 },
        { value: 5000, qty: 1 },
        { value: 1000, qty: 3 },
        { value: 500, qty: 6 },
        { value: 100, qty: 7 },
      ],
      closingNote: "All sales recorded and cash verified.",
      closedBy: "Ranjan (Cashier)",
      closedOn: "2025/03/26 22:15",
    },
  },
];

function SectionLabel({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon size={16} color={C.blue} />
      <h3 className="text-xs font-bold tracking-wide uppercase" style={{ color: C.blue }}>{children}</h3>
    </div>
  );
}

function ReportFilterBar() {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm mb-4">
      <span className="font-semibold" style={{ color: C.blue }}>From Date : 2025/03/25</span>
      <span className="text-slate-300">/</span>
      <span className="font-semibold" style={{ color: C.blue }}>To Date : 2025/03/26</span>
      <span className="text-slate-300">/</span>
      <span className="text-slate-500">Acknowledge Status : <b className="text-slate-700">ALL</b></span>
      <span className="text-slate-300">/</span>
      <span className="text-slate-500">Include : <b className="text-slate-700">ALL</b></span>
    </div>
  );
}

const REPORT_COLS = ["Transaction Date", "Voucher Number Name", "Module", "Outlet", "Amount", "Remarks", "Generated By", "Generated On", "Acknowledge By", "Acknowledge On"];

function ShiftReportTable({ reports, selectedId, onSelect }) {
  return (
    <Card padded={false} className="overflow-hidden mb-6">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: C.tableHead }}>
              {REPORT_COLS.map((h) => (
                <th key={h} className="text-left text-white font-semibold px-4 py-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => {
              const isActive = selectedId === r.id;
              return (
                <tr
                  key={r.id}
                  onClick={() => onSelect(isActive ? null : r.id)}
                  className={`border-t border-slate-100 cursor-pointer transition-colors ${isActive ? "bg-emerald-50" : "hover:bg-slate-50"}`}
                >
                  <td className="px-4 py-3 whitespace-nowrap text-slate-700">{r.date}</td>
                  <td className="px-4 py-3 whitespace-nowrap font-semibold" style={{ color: C.blue }}>{r.voucher}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">{r.module}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">{r.outlet}</td>
                  <td className="px-4 py-3 whitespace-nowrap font-semibold text-slate-800">¥{r.amount.toLocaleString()}.00</td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-500">{r.remarks}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">{r.generatedBy}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-500">{r.generatedOn}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">{r.ackBy}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-500">{r.ackOn}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 text-xs text-slate-400 border-t border-slate-100 flex items-center gap-1.5">
        Showing 1 to {reports.length} of {reports.length} entries
        <span className="text-slate-300">·</span>
        <span className="font-medium" style={{ color: C.blue }}>Tap a row to view the full report</span>
      </div>
    </Card>
  );
}

function ShiftSummaryBar({ d }) {
  const items = [
    { icon: Clock, label: "Shift", value: d.shiftName, sub: d.shiftTime },
    { icon: CalendarDays, label: "Date", value: d.date, sub: d.day },
    { icon: Store, label: "Outlet", value: d.outlet },
    { icon: UsersRound, label: "Cashier", value: d.cashier },
    { icon: Check, label: "Status", value: d.status, valueColor: C.green },
    { icon: Clock, label: "Duration", value: d.duration },
  ];
  return (
    <div className="rounded-2xl overflow-hidden mb-5">
      <div className="px-5 py-2.5 text-white text-sm font-bold flex items-center gap-2" style={{ background: C.tableHead }}>
        <FileText size={16} /> SUMMARY
      </div>
      <div className="bg-white border border-t-0 border-slate-200 px-5 py-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5 rounded-b-2xl">
        {items.map((it, i) => {
          const Icon = it.icon;
          return (
            <div key={i} className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: C.blueLight }}>
                <Icon size={16} color={C.blue} />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] text-slate-400">{it.label}</div>
                <div className="text-sm font-bold truncate" style={{ color: it.valueColor || "#1E293B" }}>{it.value}</div>
                {it.sub && <div className="text-[11px] text-slate-400 truncate">{it.sub}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SalesSummaryCard({ s }) {
  const rows = [
    ["Total Sales", `¥${s.totalSales.toLocaleString()}.00`],
    ["Total Orders", s.totalOrders],
    ["Total Customers", s.totalCustomers],
    ["Average Order Value", `¥${s.avgOrderValue.toFixed(2)}`],
    ["Discount", `¥${s.discount.toLocaleString()}.00`],
    ["Tax Collected", `¥${s.tax.toLocaleString()}.00`],
  ];
  return (
    <Card>
      <SectionLabel icon={TrendingUp}>Sales Summary</SectionLabel>
      <div className="space-y-2.5 text-sm">
        {rows.map(([l, v]) => (
          <div key={l} className="flex justify-between">
            <span className="text-slate-500">{l}</span>
            <span className="font-semibold text-slate-800">{v}</span>
          </div>
        ))}
        <div className="flex justify-between pt-2.5 border-t border-slate-100">
          <span className="font-semibold" style={{ color: C.blue }}>Net Sales</span>
          <span className="font-bold" style={{ color: C.blue }}>¥{s.netSales.toLocaleString()}.00</span>
        </div>
      </div>
    </Card>
  );
}

function PaymentBreakdownCard({ payments }) {
  const total = payments.reduce((sum, p) => sum + p.amount, 0);
  return (
    <Card>
      <SectionLabel icon={PieChartIcon}>Payment Method Breakdown</SectionLabel>
      <div className="flex items-center gap-4">
        <div className="w-24 h-24 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={payments} dataKey="amount" nameKey="label" innerRadius={26} outerRadius={48} paddingAngle={1} stroke="none">
                {payments.map((p, i) => <Cell key={i} fill={p.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-1.5 text-[13px] min-w-0">
          {payments.map((p) => (
            <div key={p.label} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }} />
              <span className="text-slate-600 flex-1 truncate">{p.label}</span>
              <span className="font-semibold text-slate-800">¥{p.amount.toLocaleString()}</span>
              <span className="text-slate-400 w-9 text-right">{p.pct}%</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-between pt-3 mt-3 border-t border-slate-100 text-sm font-bold text-slate-800">
        <span>Total</span><span>¥{total.toLocaleString()} · 100%</span>
      </div>
    </Card>
  );
}

function CashMovementCard({ c }) {
  return (
    <Card>
      <SectionLabel icon={Wallet}>Cash Movement Summary</SectionLabel>
      <div className="space-y-2.5 text-sm">
        <div className="flex justify-between"><span className="text-slate-500">Opening Cash</span><span className="font-semibold text-slate-800">¥{c.opening.toLocaleString()}.00</span></div>
        <div className="flex justify-between"><span className="text-slate-500">Cash In</span><span className="font-semibold" style={{ color: C.green }}>+ ¥{c.cashIn.toLocaleString()}.00</span></div>
        <div className="flex justify-between pb-2.5 border-b border-slate-100"><span className="text-slate-500">Cash Out</span><span className="font-semibold" style={{ color: C.red }}>- ¥{c.cashOut.toLocaleString()}.00</span></div>
        <div className="flex justify-between pt-1">
          <span className="font-semibold" style={{ color: C.blue }}>Current Cash Balance</span>
          <span className="font-bold" style={{ color: C.blue }}>¥{c.balance.toLocaleString()}.00</span>
        </div>
      </div>
    </Card>
  );
}

function ClosingReconciliationCard({ r }) {
  return (
    <Card>
      <SectionLabel icon={ClipboardList}>Closing Reconciliation</SectionLabel>
      <div className="space-y-3 text-sm">
        <div>
          <div className="flex justify-between"><span className="text-slate-500">Expected Cash</span><span className="font-bold text-slate-900">¥{r.expected.toLocaleString()}.00</span></div>
          <div className="text-[11px] text-slate-400">(Opening + Cash In − Cash Out)</div>
        </div>
        <div className="flex justify-between"><span className="text-slate-500">Counted Cash</span><span className="font-semibold text-slate-800">¥{r.counted.toLocaleString()}.00</span></div>
        <div className="flex justify-between pt-2.5 border-t border-slate-100"><span className="text-slate-500">Difference</span><span className="font-semibold" style={{ color: r.diff === 0 ? C.green : C.red }}>¥{r.diff.toLocaleString()}.00</span></div>
        <div className="flex justify-between items-center pt-1"><span className="text-slate-500">Status</span><StatusBadge status={r.status} /></div>
      </div>
    </Card>
  );
}

function CashHistoryCard({ log }) {
  const totalIn = log.filter((l) => l.up).reduce((s, l) => s + l.amount, 0);
  const totalOut = log.filter((l) => !l.up).reduce((s, l) => s + l.amount, 0);
  return (
    <Card padded={false} className="lg:col-span-2 overflow-hidden">
      <div className="px-5 pt-5 pb-1"><SectionLabel icon={Clock}>Cash In / Cash Out History</SectionLabel></div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: C.tableHead }}>
              {["Time", "Type", "Reason", "Note", "Amount", "By"].map((h) => (
                <th key={h} className="text-left text-white font-semibold px-4 py-2.5 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {log.map((l, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{l.time}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: l.up ? C.greenLight : C.redLight, color: l.up ? "#166534" : "#991B1B" }}>{l.type}</span>
                </td>
                <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap">{l.reason}</td>
                <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{l.note}</td>
                <td className="px-4 py-2.5 font-semibold whitespace-nowrap" style={{ color: l.up ? C.green : C.red }}>{l.up ? "+" : "-"} ¥{Math.abs(l.amount).toLocaleString()}.00</td>
                <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{l.by}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between px-5 py-3 border-t border-slate-100 text-sm font-bold">
        <span style={{ color: C.green }}>Total Cash In &nbsp; + ¥{totalIn.toLocaleString()}.00</span>
        <span style={{ color: C.red }}>Total Cash Out &nbsp; - ¥{Math.abs(totalOut).toLocaleString()}.00</span>
      </div>
    </Card>
  );
}

function DenominationCard({ list }) {
  const total = list.reduce((s, d) => s + d.value * d.qty, 0);
  return (
    <Card padded={false} className="overflow-hidden">
      <div className="px-5 pt-5 pb-1"><SectionLabel icon={Banknote}>Denomination Summary (Counted Cash)</SectionLabel></div>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: C.tableHead }}>
            {["Denomination", "Quantity", "Amount (¥)"].map((h) => (
              <th key={h} className="text-left text-white font-semibold px-4 py-2.5 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {list.map((d, i) => (
            <tr key={i} className="border-t border-slate-100">
              <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap">¥{d.value.toLocaleString()}</td>
              <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{d.qty}</td>
              <td className="px-4 py-2.5 font-semibold text-slate-800 whitespace-nowrap">¥{(d.value * d.qty).toLocaleString()}.00</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex justify-between px-5 py-3 border-t border-slate-100 text-sm font-bold">
        <span style={{ color: C.blue }}>Total Counted Cash</span>
        <span style={{ color: C.blue }}>¥{total.toLocaleString()}.00</span>
      </div>
    </Card>
  );
}

function ClosingNoteCard({ d }) {
  return (
    <Card>
      <SectionLabel icon={FileText}>Closing Note</SectionLabel>
      <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm text-slate-600 min-h-[84px] mb-4">
        {d.closingNote}
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-slate-500">Closed By</span><span className="font-semibold text-slate-800">{d.closedBy}</span></div>
        <div className="flex justify-between"><span className="text-slate-500">Closed On</span><span className="font-semibold text-slate-800">{d.closedOn}</span></div>
      </div>
    </Card>
  );
}

function ShiftCloseReportDetail({ report, onNewShift }) {
  const d = report.detail;
  return (
    <div className="mb-2" style={{ animation: "slideUp 0.25s ease" }}>
      <ShiftSummaryBar d={d} />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
        <SalesSummaryCard s={d.sales} />
        <PaymentBreakdownCard payments={d.payments} />
        <CashMovementCard c={d.cash} />
        <ClosingReconciliationCard r={d.reconciliation} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        <CashHistoryCard log={d.cashLog} />
        <DenominationCard list={d.denominations} />
        <ClosingNoteCard d={d} />
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="secondary"><Printer size={16} /> Print Report</Button>
        <Button variant="secondary"><FileDown size={16} /> Export PDF</Button>
        <Button onClick={onNewShift}><Plus size={16} /> New Shift</Button>
      </div>
    </div>
  );
}

function ShiftCloseReportPage() {
  const [selectedId, setSelectedId] = useState(null);
  const selected = SHIFT_REPORTS.find((r) => r.id === selectedId);

  return (
    <div className="pb-8">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-3">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <FileText size={20} color={C.blue} /> Shift Close Report
        </h1>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm"><Printer size={14} /> Print</Button>
          <Button size="sm"><FileSpreadsheet size={14} /> Export Excel</Button>
        </div>
      </div>
      <p className="text-sm text-slate-400 mb-4">Shift close vouchers for the selected outlet and date range — tap a row to open the full report.</p>
      <ReportFilterBar />
      <ShiftReportTable reports={SHIFT_REPORTS} selectedId={selectedId} onSelect={setSelectedId} />
      {selected && <ShiftCloseReportDetail report={selected} onNewShift={() => setSelectedId(null)} />}
    </div>
  );
}

/* ---------------------------------- TABLE LIST ---------------------------------- */
const TABLE_STATUS_META = {
  Vacant: { dot: C.green, label: "#15803D", tint: "#DCFCE7" },
  Occupied: { dot: "#F43F5E", label: "#BE123C", tint: "#FFE4E6" },
  Hold: { dot: C.orange, label: "#B45309", tint: C.orangeLight },
  Billed: { dot: C.blue, label: C.blue, tint: C.blueLight },
};

const TABLE_AREAS = [
  {
    area: "BAR",
    tables: [
      { id: "T1", status: "Occupied", covers: 1, since: "3 hrs ago" },
      { id: "T2", status: "Vacant" },
      { id: "T3", status: "Hold", covers: 2, since: "12 min ago" },
      { id: "T4", status: "Billed", covers: 4, since: "48 min ago" },
    ],
  },
  {
    area: "PATIO",
    tables: [
      { id: "T5", status: "Vacant" },
      { id: "T6", status: "Occupied", covers: 3, since: "22 min ago" },
    ],
  },
  {
    area: "MAIN HALL",
    tables: [
      { id: "T7", status: "Vacant" },
      { id: "T8", status: "Occupied", covers: 2, since: "5 min ago" },
      { id: "T9", status: "Vacant" },
      { id: "T10", status: "Hold", covers: 5, since: "2 min ago" },
      { id: "T11", status: "Billed", covers: 2, since: "1 hr ago" },
      { id: "T12", status: "Vacant" },
    ],
  },
];

function TableStatusIcon({ status }) {
  if (status === "Hold") {
    return (
      <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: C.blue }}>
        <PauseCircle size={24} color="white" fill={C.blue} />
      </div>
    );
  }
  if (status === "Occupied") {
    return (
      <div className="w-12 h-12 rounded-xl flex items-center justify-center">
        <Users size={30} color="#F97316" />
      </div>
    );
  }
  if (status === "Billed") {
    return (
      <div className="w-12 h-12 rounded-xl flex items-center justify-center">
        <FileText size={28} color="#94A3B8" />
      </div>
    );
  }
  return (
    <div className="w-12 h-12 rounded-xl flex items-center justify-center">
      <Armchair size={30} color="#8B5E3C" />
    </div>
  );
}

const TABLE_MENU_ACTIONS = [
  { key: "order", label: "View / Take Order", icon: ShoppingCart },
  { key: "preview", label: "Preview Bill", icon: FileText },
  { key: "print", label: "Print Bill", icon: Printer },
  { key: "settle", label: "Settle Bill", icon: Wallet },
];

function TableCard({ t, isMenuOpen, onToggleMenu, onAction }) {
  const meta = TABLE_STATUS_META[t.status];
  return (
    <div className="relative">
      <Card
        padded={false}
        onClick={() => onAction(t, "order")}
        className="w-[176px] px-4 pt-3 pb-4 flex flex-col items-center text-center cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-150"
      >
        <div className="w-full flex items-start justify-between mb-1">
          <div className="text-left text-[11px] text-slate-400 leading-tight min-h-[28px]">
            {t.status !== "Vacant" ? (
              <>
                <div>C: {t.covers}</div>
                <div>T: {t.since}</div>
                {t.order && <div className="font-bold" style={{ color: C.green }}>¥{Number(t.order.total).toLocaleString()}</div>}
              </>
            ) : null}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleMenu(t.id); }}
            className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 shrink-0"
          >
            <ChevronDown size={13} />
          </button>
        </div>

        <TableStatusIcon status={t.status} />

        <div className="font-bold text-[15px] mt-2" style={{ color: meta.label }}>{t.id}</div>
      </Card>

      {isMenuOpen && (
        <div
          className="absolute z-20 top-9 left-0 w-52 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {TABLE_MENU_ACTIONS.map((m) => (
            <button
              key={m.key}
              onClick={() => onAction(t, m.key)}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 text-left"
            >
              <m.icon size={16} className="text-slate-400 shrink-0" /> {m.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TableListPage({ onSelectTable }) {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [openMenu, setOpenMenu] = useState(null);
  const { orders } = useTableOrders();

  // A saved (placed) order always wins over the demo seed status: the table becomes
  // Occupied and carries its live order total / time until payment frees it again.
  const areas = useMemo(
    () =>
      TABLE_AREAS.map((a) => ({
        ...a,
        tables: a.tables.map((t) => {
          const o = orders[t.id];
          if (!o) return t;
          return {
            ...t,
            status: "Occupied",
            covers: o.cover,
            since: o.createdTime,
            order: o,
          };
        }),
      })),
    [orders]
  );

  const filteredAreas = areas.map((a) => ({
    ...a,
    tables: a.tables.filter((t) => {
      if (filter === "In Use" && t.status === "Vacant") return false;
      if (search && !t.id.toLowerCase().includes(search.toLowerCase()) && !a.area.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }),
  })).filter((a) => a.tables.length > 0);

  const handleAction = (table, action) => {
    setOpenMenu(null);
    if (action === "order") onSelectTable(table);
    // preview / print / settle are visual stubs in this demo build
  };

  return (
    <div className="pb-8" onClick={() => openMenu && setOpenMenu(null)}>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.purpleLight }}>
            <Grid3x3 size={20} color={C.purple} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Table List</h1>
            <p className="text-sm text-slate-400">You can perform Table related actions from here.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <div className="flex bg-slate-100 rounded-xl p-1 text-sm font-semibold">
            {["All", "In Use"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-4 py-2 rounded-lg transition-colors"
                style={filter === f ? { background: "#0F172A", color: "white" } : { color: "#64748B" }}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 bg-white">
            <Search size={15} className="text-slate-400 shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Table/Area..."
              className="text-sm outline-none w-36 sm:w-44 placeholder:text-slate-400"
            />
          </div>
          <Button variant="secondary" size="sm">
            <RotateCw size={14} /> Switch to Custom Layout
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-5 mb-6 text-sm font-medium">
        {Object.entries(TABLE_STATUS_META).map(([k, m]) => (
          <div key={k} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: m.dot }} />
            <span className="text-slate-600">{k}</span>
          </div>
        ))}
      </div>

      {filteredAreas.length === 0 && (
        <div className="text-center text-slate-400 text-sm py-16">No tables match your search.</div>
      )}

      {filteredAreas.map((a) => (
        <div key={a.area} className="mb-8">
          <h3 className="text-xs font-bold tracking-wide text-slate-400 mb-3">{a.area}</h3>
          <div className="flex flex-wrap gap-4">
            {a.tables.map((t) => (
              <TableCard
                key={t.id}
                t={t}
                isMenuOpen={openMenu === t.id}
                onToggleMenu={(id) => setOpenMenu((cur) => (cur === id ? null : id))}
                onAction={handleAction}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------- DISCOUNT MODAL ----------------------------------
   Reached both from "Pay Now" (as an optional step before Settlement) and from the
   Billing screen's left-rail "Discounts" icon — same modal, same logic, two entry points. */
const DISCOUNT_REASON_CHIPS = [
  { key: "vip", label: "VIP Guest", color: "#7C3AED", bg: "#EDE9FE" },
  { key: "employee", label: "Employee", color: "#059669", bg: "#D1FAE5" },
  { key: "manager", label: "Manager Override", color: "#EA580C", bg: "#FFEDD5" },
  { key: "complaint", label: "Guest Complaint", color: "#DC2626", bg: "#FEE2E2" },
];

function DiscountModal({ open, cart, subtotal, orderType, billLabel, onApply, onSkip, onClose }) {
  const [type, setType] = useState("percentage");
  const [targetMenu, setTargetMenu] = useState("ALL");
  const [value, setValue] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [reason, setReason] = useState(null);
  const [remarks, setRemarks] = useState("");

  if (!open) return null;

  const numericValue = parseFloat(value) || 0;
  const rawDiscount = type === "percentage" ? (subtotal * numericValue) / 100 : numericValue;
  const cap = maxAmount ? parseFloat(maxAmount) : Infinity;
  const discountAmount = Math.max(0, Math.min(rawDiscount, cap, subtotal));

  const presets = type === "percentage" ? [5, 10, 15, 20, 50] : [500, 1000, 2000];

  const handleClear = () => {
    setValue("");
    setMaxAmount("");
    setReason(null);
    setRemarks("");
  };

  const handleApply = () => {
    const reasonMeta = DISCOUNT_REASON_CHIPS.find((r) => r.key === reason);
    onApply({
      type,
      value: numericValue,
      amount: Math.round(discountAmount),
      reason: reasonMeta ? reasonMeta.label : null,
      remarks,
      targetMenu,
    });
  };

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-bold text-slate-800 text-lg">Discount</h2>
            <p className="text-xs text-slate-400 mt-0.5">{billLabel}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center shrink-0">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          <div className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs" style={{ background: "#EFF6FF", color: "#1E40AF" }}>
            <Info size={14} className="mt-0.5 shrink-0" />
            <span>The discount displayed on the order may vary from that shown on the billing page.</span>
          </div>

          <div>
            <div className="text-xs font-bold text-slate-400 tracking-wide mb-2">DISCOUNT TYPE</div>
            <div className="grid grid-cols-2 gap-2">
              {[{ id: "percentage", label: "PERCENTAGE (SUB TOTAL)" }, { id: "fixed", label: "FIXED AMOUNT" }].map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setType(t.id); setValue(""); }}
                  className="py-2.5 rounded-xl text-xs sm:text-sm font-bold border transition-colors"
                  style={type === t.id ? { background: C.blue, borderColor: C.blue, color: "white" } : { background: "white", borderColor: "#E2E8F0", color: "#334155" }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <Field label="TARGET MENU">
            <select className={inputCls} value={targetMenu} onChange={(e) => setTargetMenu(e.target.value)}>
              <option>ALL</option>
              {cart.map((c) => (
                <option key={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>

          <div>
            <Field label="APPLY VALUE">
              <input
                className={inputCls}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={type === "percentage" ? "e.g. 10" : "e.g. 500"}
                inputMode="decimal"
              />
            </Field>
            <div className="flex flex-wrap gap-2 mt-2.5">
              {presets.map((p) => (
                <button
                  key={p}
                  onClick={() => setValue(String(p))}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold border hover:border-slate-300"
                  style={{ borderColor: "#E2E8F0", color: "#334155", background: "white" }}
                >
                  {type === "percentage" ? `${p}%` : `¥${p.toLocaleString()}`}
                </button>
              ))}
            </div>
          </div>

          <Field label="MAXIMUM DISCOUNT AMOUNT">
            <input className={inputCls} value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} placeholder="No limit" inputMode="decimal" />
          </Field>

          <div>
            <div className="text-xs font-bold text-slate-400 tracking-wide mb-2">REASON CHIPS</div>
            <div className="flex flex-wrap gap-2">
              {DISCOUNT_REASON_CHIPS.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setReason((cur) => (cur === r.key ? null : r.key))}
                  className="px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-colors"
                  style={reason === r.key ? { background: r.color, borderColor: r.color, color: "white" } : { background: r.bg, borderColor: r.bg, color: r.color }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <Field label="REMARKS">
            <textarea
              className={`${inputCls} min-h-[70px]`}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Enter remarks for discount"
            />
          </Field>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500">
                  <th className="text-left px-3 py-2 font-bold">Item</th>
                  <th className="text-right px-3 py-2 font-bold">Qty</th>
                  <th className="text-right px-3 py-2 font-bold">Value</th>
                </tr>
              </thead>
              <tbody>
                {cart.length === 0 && (
                  <tr><td colSpan={3} className="px-3 py-3 text-center text-slate-400">Cart is empty</td></tr>
                )}
                {cart.map((c) => (
                  <tr key={c.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-700">{c.name}</td>
                    <td className="px-3 py-2 text-right text-slate-500">{c.qty}</td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-700">¥{(c.price * c.qty).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-semibold text-slate-700">¥{subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Discount Amount</span>
              <span className="font-bold" style={{ color: C.red }}>-¥{Math.round(discountAmount).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between gap-3 sticky bottom-0 bg-white">
          <button onClick={onSkip} className="text-sm font-semibold text-slate-500 hover:text-slate-700">
            Skip Discount
          </button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleClear}>Clear</Button>
            <Button onClick={handleApply} disabled={discountAmount <= 0}>Apply & Continue</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- BILLING SCREEN ----------------------------------
   Reached from the cart's "Billing" action. Mirrors the reference Upcoming "POS - Billing"
   layout: a dark icon rail (Tickets / Split / Merge / Change Name / Orders / Discounts /
   Summary / Settle / Print) alongside outlet/billing-info fields and split-payment cards. */
const BILLING_RAIL_ITEMS = [
  { id: "tickets", label: "Tickets", icon: Ticket },
  { id: "split", label: "Split", icon: Split },
  { id: "merge", label: "Merge", icon: GitMerge },
  { id: "change-name", label: "Change Name", icon: Pencil },
  { id: "orders", label: "Orders", icon: ClipboardList },
  { id: "discounts", label: "Discounts", icon: Percent },
  { id: "summary", label: "Summary", icon: FileText },
  { id: "settle", label: "Settle", icon: Wallet },
  { id: "print", label: "Print", icon: Printer },
];

function BillingIconRail({ active, onSelect }) {
  return (
    <div className="w-[72px] sm:w-20 shrink-0 bg-slate-900 flex flex-col items-center py-3 gap-0.5 overflow-y-auto">
      {BILLING_RAIL_ITEMS.map((it) => {
        const Icon = it.icon;
        const isActive = active === it.id;
        return (
          <button
            key={it.id}
            onClick={() => onSelect(it.id)}
            className="w-full flex flex-col items-center gap-1 py-3 text-[10px] font-semibold transition-colors"
            style={{ color: isActive ? "white" : "#94A3B8", background: isActive ? "rgba(255,255,255,0.08)" : "transparent" }}
          >
            <Icon size={18} />
            <span className="text-center leading-tight px-0.5">{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function BillingScreen({ orderType, billOfLabel, bill, onExit, onSettle, onOpenDiscount }) {
  const [rail, setRail] = useState("settle");
  const [company, setCompany] = useState("");
  const [guestName, setGuestName] = useState("");
  const [address, setAddress] = useState("");
  const [search, setSearch] = useState("");
  const [splits, setSplits] = useState([{ id: 1, amount: bill.grandTotal, settled: false }]);

  const recomputeSplits = (count) => {
    const even = Math.floor(bill.grandTotal / count);
    return Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      amount: i === count - 1 ? bill.grandTotal - even * (count - 1) : even,
      settled: false,
    }));
  };

  const addSplit = () => setSplits((prev) => recomputeSplits(prev.length + 1));
  const settleSplit = (id) => setSplits((prev) => prev.map((s) => (s.id === id ? { ...s, settled: true } : s)));
  const allSettled = splits.every((s) => s.settled);
  const settledAmount = splits.filter((s) => s.settled).reduce((sum, s) => sum + s.amount, 0);

  const handleRailSelect = (id) => {
    if (id === "discounts") onOpenDiscount();
    else setRail(id);
  };

  return (
    <div className="fixed inset-0 z-[60] flex bg-slate-50" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <BillingIconRail active={rail} onSelect={handleRailSelect} />

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <div className="shrink-0 bg-white border-b border-slate-200 px-4 sm:px-5 h-14 flex items-center justify-between">
          <h1 className="font-bold text-slate-800 text-sm sm:text-base">POS - Billing</h1>
          <button onClick={onExit} className="flex items-center gap-1.5 font-semibold text-xs sm:text-sm" style={{ color: C.blue }}>
            <ArrowUpRight size={15} /> BACK TO ORDER
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 sm:gap-5 max-w-5xl mx-auto">
            <div className="space-y-4 sm:space-y-5">
              <Card>
                <h2 className="font-bold text-slate-800 mb-4">Billing</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-5">
                  <Field label="Outlet*">
                    <select className={inputCls}><option>INDIAN RESTAURANT VISHNU EXPRESS KURUME</option></select>
                  </Field>
                  <Field label="Branch*">
                    <select className={inputCls}><option>UPCOMING RESTRO PVT.LTD</option></select>
                  </Field>
                  <Field label="Bill Of">
                    <select className={inputCls}><option>{billOfLabel}</option></select>
                  </Field>
                </div>

                <h3 className="font-bold text-slate-800 mb-3 text-sm">Billing Info</h3>
                <div className="mb-3.5">
                  <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3.5 py-2.5 bg-white">
                    <Search size={15} className="text-slate-400 shrink-0" />
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" className="text-sm outline-none w-full placeholder:text-slate-400" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <Field label="Company">
                    <select className={inputCls} value={company} onChange={(e) => setCompany(e.target.value)}>
                      <option value="">Choose Company</option>
                    </select>
                  </Field>
                  <Field label="Address">
                    <input className={inputCls} value={address} onChange={(e) => setAddress(e.target.value)} />
                  </Field>
                  <Field label="Guest Name">
                    <input className={inputCls} value={guestName} onChange={(e) => setGuestName(e.target.value)} />
                  </Field>
                  <Field label="Date*">
                    <input type="date" className={inputCls} defaultValue={new Date().toISOString().slice(0, 10)} />
                  </Field>
                </div>
              </Card>

              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-800 text-sm">Split Payments</h3>
                  <Button variant="secondary" size="sm" onClick={addSplit}>
                    <Plus size={14} /> Add Split
                  </Button>
                </div>
                <div className="space-y-3">
                  {splits.map((s, i) => (
                    <div key={s.id} className="flex items-center justify-between border border-slate-200 rounded-xl px-4 py-3">
                      <div>
                        <div className="text-sm font-bold text-slate-800">Split #{i + 1}</div>
                        <div className="text-xs text-slate-400">Grand Total</div>
                        <div className="text-sm font-semibold text-slate-700">¥{s.amount.toLocaleString()}</div>
                      </div>
                      <Button
                        size="sm"
                        disabled={s.settled}
                        onClick={() => settleSplit(s.id)}
                        style={s.settled ? { background: "#16A34A" } : { background: C.green }}
                      >
                        {s.settled ? (<><Check size={14} /> Settled</>) : "Settle"}
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <div>
              <Card className="lg:sticky lg:top-5">
                <div className="flex justify-between text-sm text-slate-500 mb-2">
                  <span>Total</span><span className="font-semibold text-slate-700">¥{bill.subtotal.toLocaleString()}</span>
                </div>
                {bill.discountAmount > 0 && (
                  <div className="flex justify-between text-sm mb-2" style={{ color: C.red }}>
                    <span>Discount</span><span className="font-semibold">-¥{bill.discountAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm text-slate-500 mb-3">
                  <span>Settled</span><span className="font-semibold text-slate-700">¥{settledAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center rounded-xl bg-slate-100 px-4 py-3 mb-5">
                  <span className="text-sm font-bold text-slate-600">GRAND TOTAL</span>
                  <span className="text-xl font-extrabold text-slate-900">¥{bill.grandTotal.toLocaleString()}</span>
                </div>
                <Button className="w-full mb-2" disabled={!allSettled} onClick={onSettle}>
                  <Printer size={16} /> Settle & Print
                </Button>
                <Button variant="secondary" className="w-full" onClick={onExit}>
                  Clear
                </Button>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- TOUCH ORDER SCREEN ---------------------------------- */
const ORDER_CATEGORIES = ["All Categories", "Beverages", "Food", "Alcohol", "Merchandise"];

const MENU_CATALOG = [
  { id: "m1", name: "Coca-Cola 500ml", price: 350, emoji: "🥤", category: "Beverages", badge: "10%", tax: "Reduced Tax Eligible" },
  { id: "m2", name: "Salmon Bento Box", price: 1200, emoji: "🍱", category: "Food", badge: "10%", tax: "Reduced Tax Eligible" },
  { id: "m3", name: "Chicken Katsu Don", price: 980, emoji: "🍛", category: "Food", badge: "10%", tax: "Reduced Tax Eligible" },
  { id: "m4", name: "Draft Beer 500ml", price: 600, emoji: "🍺", category: "Alcohol", badge: "10%", tax: "Standard Tax Item" },
  { id: "m5", name: "Salmon Sushi Set", price: 1450, emoji: "🍣", category: "Food", badge: "10%", tax: "Reduced Tax Eligible" },
  { id: "m6", name: "Restaurant Gift Card", price: 5000, emoji: "🎁", category: "Merchandise", badge: "0%", tax: "Standard Tax Item", disabled: true },
  { id: "m7", name: "Teriyaki Chicken Don", price: 980, emoji: "🍚", category: "Food", badge: "10%", tax: "Reduced Tax Eligible" },
  { id: "m8", name: "Gyoza (6 pcs)", price: 580, emoji: "🥟", category: "Food", badge: "10%", tax: "Reduced Tax Eligible" },
  { id: "m9", name: "Miso Soup", price: 280, emoji: "🍲", category: "Food", badge: "10%", tax: "Reduced Tax Eligible" },
  { id: "m10", name: "Green Tea (Hot)", price: 300, emoji: "🍵", category: "Beverages", badge: "10%", tax: "Reduced Tax Eligible" },
  { id: "m11", name: "Oolong Tea Bottle", price: 380, emoji: "🧃", category: "Beverages", badge: "10%", tax: "Reduced Tax Eligible" },
  { id: "m12", name: "Hot Sake 180ml", price: 750, emoji: "🍶", category: "Alcohol", badge: "10%", tax: "Standard Tax Item" },
  { id: "m13", name: "House Wine Glass", price: 700, emoji: "🍷", category: "Alcohol", badge: "10%", tax: "Standard Tax Item" },
];

/* ---------------------------------- DUAL TAX ENGINE (JP Dual Tax Edition) ----------------------------------
   Mirrors the Upcoming "Tax Category Master" + "Tax Rule Master" design: a menu item is assigned a
   reusable Tax Category once (never a raw rate). The actual % is resolved at billing time from the
   Tax Rule Master, keyed by Tax Category + Order Type — so "Salmon Bento Box" stays a single menu
   record, taxed at 10% Dine-in but 8% Takeaway / Delivery / Event, with no duplicate SKU ever created. */
const TAX_CATEGORIES = ["Standard Tax Item", "Reduced Tax Eligible", "Tax Exempt", "Non Taxable"];

// Tax Rule Master — Tax Category + Order Type → Rate. Reduced-rate eligible items (most food &
// non-alcoholic drinks) drop to 8% once they leave the premises; Standard items (alcohol, etc.)
// stay at the standard 10% regardless of order type, matching Japan's Consumption Tax rules.
const TAX_RULES = {
  "Reduced Tax Eligible": { "Dine-in": 0.10, Takeaway: 0.08, Delivery: 0.08, Event: 0.08 },
  "Standard Tax Item": { "Dine-in": 0.10, Takeaway: 0.10, Delivery: 0.10, Event: 0.10 },
  "Tax Exempt": { "Dine-in": 0, Takeaway: 0, Delivery: 0, Event: 0 },
  "Non Taxable": { "Dine-in": 0, Takeaway: 0, Delivery: 0, Event: 0 },
};

function getTaxRate(taxCategory, orderType) {
  const rules = TAX_RULES[taxCategory] || TAX_RULES["Standard Tax Item"];
  return rules[orderType] ?? rules["Dine-in"];
}

/* ------------------------- ITEM OPTION (MODIFIER) MASTER -------------------------
   Tapping a menu item opens the option screen first: grouped choices with required /
   optional rules and min–max limits, a per-group Reset, a live running total, and an
   "Add to Cart" action that carries the selection description into the cart line. */
const OPTION_GROUPS_BY_CATEGORY = {
  Food: [
    {
      id: "base", name: "Nan or Rice", required: true, min: 1, max: 1,
      options: [
        { id: "plain-nan", name: "Plain nan", price: 0 },
        { id: "rice-s", name: "Rice (S) (US rice)", price: 0 },
        { id: "rice-m", name: "Rice (M) (US rice)", price: 0 },
        { id: "rice-l", name: "Rice (L) (USA rice)", price: 110 },
      ],
    },
    {
      id: "setdrink", name: "Set drink", required: false, min: 1, max: 1,
      options: [
        { id: "lassi", name: "Lassi", price: 220 },
        { id: "cola", name: "Cola", price: 220 },
        { id: "ginger", name: "Ginger ale", price: 220 },
        { id: "orange", name: "Orange juice", price: 220 },
        { id: "oolong", name: "Oolong tea", price: 220 },
        { id: "coffee-hot", name: "Coffee (HOT)", price: 220 },
        { id: "coffee-ice", name: "Coffee (ICE)", price: 220 },
        { id: "chai-hot", name: "Chai (HOT)", price: 220 },
        { id: "chai-ice", name: "Chai (ICE)", price: 220 },
        { id: "mango-lassi", name: "Mango lassi", price: 220 },
      ],
    },
    {
      id: "timing", name: "Drink timing", required: false, min: 1, max: 1,
      options: [
        { id: "before", name: "Before meals", price: 0 },
        { id: "simul", name: "Simultaneous", price: 0 },
        { id: "after", name: "After meal", price: 0 },
      ],
    },
    {
      id: "dessert", name: "After-dinner ice cream", required: false, min: 1, max: 1,
      options: [
        { id: "vanilla", name: "Ice cream (vanilla)", price: 110 },
        { id: "none", name: "Not attached", price: 0 },
      ],
    },
  ],
  Beverages: [
    {
      id: "size", name: "Size", required: true, min: 1, max: 1,
      options: [
        { id: "regular", name: "Regular", price: 0 },
        { id: "large", name: "Large", price: 120 },
      ],
    },
    {
      id: "ice", name: "Ice level", required: false, min: 1, max: 1,
      options: [
        { id: "normal-ice", name: "Normal ice", price: 0 },
        { id: "less-ice", name: "Less ice", price: 0 },
        { id: "no-ice", name: "No ice", price: 0 },
      ],
    },
  ],
  Alcohol: [
    {
      id: "serve", name: "Serving style", required: true, min: 1, max: 1,
      options: [
        { id: "as-is", name: "As is", price: 0 },
        { id: "chilled", name: "Chilled", price: 0 },
        { id: "on-rocks", name: "On the rocks", price: 50 },
      ],
    },
    {
      id: "snack", name: "Add a snack", required: false, min: 1, max: 2,
      options: [
        { id: "edamame", name: "Edamame", price: 300 },
        { id: "nuts", name: "Mixed nuts", price: 250 },
      ],
    },
  ],
};

const getOptionGroups = (item) => OPTION_GROUPS_BY_CATEGORY[item.category] || [];

function ItemOptionsModal({ item, orderType, onClose, onAdd }) {
  const groups = getOptionGroups(item);
  const [selected, setSelected] = useState({});
  const [qty, setQty] = useState(1);

  const toggle = (group, opt) => {
    setSelected((prev) => {
      const cur = prev[group.id] || [];
      if (cur.includes(opt.id)) return { ...prev, [group.id]: cur.filter((x) => x !== opt.id) };
      if (group.max === 1) return { ...prev, [group.id]: [opt.id] };
      if (cur.length >= group.max) return prev;
      return { ...prev, [group.id]: [...cur, opt.id] };
    });
  };
  const resetGroup = (gid) => setSelected((prev) => ({ ...prev, [gid]: [] }));

  const chosen = groups.flatMap((g) =>
    (selected[g.id] || []).map((oid) => {
      const o = g.options.find((x) => x.id === oid);
      return { group: g.name, id: `${g.id}:${oid}`, name: o.name, price: o.price };
    })
  );
  const optionsTotal = chosen.reduce((s, o) => s + o.price, 0);
  const unitPrice = item.price + optionsTotal;
  const total = unitPrice * qty;
  const missing = groups.filter((g) => g.required && (selected[g.id] || []).length < g.min);
  const canAdd = missing.length === 0;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6" style={{ background: "rgba(15,23,42,0.55)" }}>
      <div className="bg-white w-full max-w-3xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="shrink-0 flex items-start justify-between gap-3 px-5 sm:px-6 pt-5 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3 min-w-0">
            <div className="rounded-xl w-11 h-11 overflow-hidden flex items-center justify-center text-xl shrink-0" style={{ background: C.greenLight }}>
              {item.image ? <img src={item.image} alt={item.name} loading="lazy" width={512} height={512} className="w-full h-full object-cover" /> : item.emoji}
            </div>
            <div className="min-w-0">
              <div className="text-base sm:text-lg font-bold text-slate-800 truncate">{item.name}</div>
              <div className="text-[11px] text-slate-400">
                ¥{item.price.toLocaleString()} · {item.tax} · Tax {Math.round(getTaxRate(item.tax, orderType) * 100)}%
              </div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Option groups */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-5" style={{ background: "#F8FAFC" }}>
          {groups.length === 0 && <p className="text-sm text-slate-400 py-6 text-center">No options for this item — add it straight to the cart.</p>}
          {groups.map((g) => {
            const cur = selected[g.id] || [];
            const invalid = g.required && cur.length < g.min;
            return (
              <div key={g.id}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="text-[13px] font-bold text-slate-700">
                    {g.name}{" "}
                    <span className={`font-semibold ${invalid ? "text-rose-500" : "text-slate-400"}`}>
                      ({g.required ? "Required" : "Optional"}, min {g.min}, max {g.max})
                    </span>
                  </div>
                  <button onClick={() => resetGroup(g.id)} className="text-[11px] font-semibold px-2 py-1 rounded-md text-slate-500 hover:bg-slate-200">
                    Reset
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {g.options.map((o) => {
                    const on = cur.includes(o.id);
                    return (
                      <button
                        key={o.id}
                        onClick={() => toggle(g, o)}
                        className="px-3.5 py-2 rounded-lg text-[13px] font-semibold border transition-colors"
                        style={on ? { background: C.blueLight, borderColor: C.blue, color: C.blue } : { background: "#fff", borderColor: "#E2E8F0", color: "#475569" }}
                      >
                        {o.name}
                        {o.price > 0 && <span className="ml-1.5 text-slate-400">¥{o.price}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-100 px-5 sm:px-6 py-3.5 bg-white">
          <div className="text-[11px] text-slate-400 mb-2 truncate">
            {chosen.length ? chosen.map((c) => c.name).join(" · ") : "Selecting…"}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center active:bg-slate-200"><Minus size={14} /></button>
              <span className="w-6 text-center text-sm font-bold">{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center active:bg-slate-200"><Plus size={14} /></button>
            </div>
            <div className="text-sm font-bold text-slate-700 shrink-0">Total <span style={{ color: C.blue }}>¥{total.toLocaleString()}</span></div>
            <button
              onClick={() => canAdd && onAdd(item, chosen, qty)}
              disabled={!canAdd}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-opacity"
              style={{ background: canAdd ? "#F59E0B" : "#CBD5E1", cursor: canAdd ? "pointer" : "not-allowed" }}
            >
              {canAdd ? "Add to Cart" : `Select ${missing[0].name}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MenuItemCard({ item, onAdd, rate }) {
  const pct = `${Math.round(rate * 100)}%`;
  return (
    <button
      onClick={() => !item.disabled && onAdd(item)}
      disabled={item.disabled}
      title={`${item.tax} · Tax ${pct}`}
      className={`relative bg-white border border-slate-200 rounded-2xl py-4 px-3 flex flex-col items-center justify-center text-center transition-all duration-150 h-full overflow-hidden ${
        item.disabled
          ? "opacity-50 cursor-not-allowed"
          : "hover:shadow-md hover:-translate-y-0.5 active:scale-[0.97] active:shadow-sm"
      }`}
    >
      <span
        className="absolute top-2.5 right-2.5 text-[11px] font-bold px-1.5 py-0.5 rounded"
        style={item.disabled || rate === 0 ? { background: "#F1F5F9", color: "#94A3B8" } : { background: C.blueLight, color: C.blue }}
      >
        {item.disabled ? "0%" : pct}
      </span>
      <div
        className="rounded-xl overflow-hidden flex items-center justify-center mb-2.5 shrink-0 bg-slate-50"
        style={{ background: C.greenLight, width: "clamp(56px, 26%, 130px)", aspectRatio: "1 / 1", fontSize: "clamp(1.1rem, 3vw, 1.5rem)" }}
      >
        {item.image ? (
          <img
            src={item.image}
            alt={item.name}
            loading="lazy"
            width={512}
            height={512}
            className="w-full h-full object-cover"
          />
        ) : (
          item.emoji
        )}
      </div>
      <div className="text-[13px] font-bold text-slate-800 leading-snug mb-1.5 line-clamp-2 flex items-center">{item.name}</div>
      <div className={`text-sm font-semibold ${item.disabled ? "line-through text-slate-300" : "text-slate-500"}`}>
        ¥{item.price.toLocaleString()}
      </div>


    </button>
  );
}

function TouchOrderScreen({ table, onExit, initialOrderType = "Dine-in", requireGeneralInfo = false }) {
  // "Other Info" (General Information) is captured BEFORE the menu appears once a
  // table is selected, and can be reopened any time from the order header.
  const { getOrder, placeOrder, payOrder } = useTableOrders();
  const promo = usePromotions();
  const existingOrder = getOrder(table.id);
  // Attendant defaults to the logged-in user and Cover defaults to 1 — no manual
  // selection needed to start ordering; both stay editable from "Other Info".
  const [generalInfo, setGeneralInfo] = useState(
    existingOrder
      ? { attendant: existingOrder.attendant, cover: String(existingOrder.cover), kot: existingOrder.id, remarks: existingOrder.notes }
      : null
  );
  const [showGeneralInfo, setShowGeneralInfo] = useState(requireGeneralInfo && !existingOrder);
  const { notifyItemOrdered, notifyOrderClosed, notifyKotSent } = useOrderNotifications();
  const { saveOrder } = useOrderStore();
  const [orderToast, setOrderToast] = useState("");
  const [category, setCategory] = useState("All Categories");
  const [search, setSearch] = useState("");
  const [orderType, setOrderType] = useState(initialOrderType);
  const [cartTab, setCartTab] = useState("Orders On Hold");
  const [cartOpen, setCartOpen] = useState(false);
  // Reopening a table restores whatever was previously placed on it.
  const [cart, setCart] = useState(() =>
    existingOrder
      ? existingOrder.items.map((i) => ({ ...i, checked: true }))
      : [
          { id: "m2", name: "Salmon Bento Box", price: 1200, tax: "Reduced Tax Eligible", qty: 1, checked: true },
          { id: "m4", name: "Draft Beer 500ml", price: 600, tax: "Standard Tax Item", qty: 1, checked: true },
        ]
  );

  const items = MENU_CATALOG.filter((m) => {
    if (category !== "All Categories" && m.category !== category) return false;
    if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Menu tap → option screen first; the chosen modifiers become part of the cart line
  // (unique line key + human-readable description) so identical items with different
  // options stay separate rows.
  const [optionItem, setOptionItem] = useState(null);
  const openItem = (item) => {
    if (getOptionGroups(item).length === 0) addItem(item, [], 1);
    else setOptionItem(item);
  };

  const addItem = (item, options = [], addQty = 1) => {
    const lineId = `${item.id}|${options.map((o) => o.id).join(",")}`;
    const optionsTotal = options.reduce((s, o) => s + o.price, 0);
    const desc = options.map((o) => o.name).join(" · ");
    setCart((prev) => {
      const existing = prev.find((p) => (p.lineId || p.id) === lineId);
      if (existing) return prev.map((p) => ((p.lineId || p.id) === lineId ? { ...p, qty: p.qty + addQty } : p));
      return [
        ...prev,
        { lineId, id: item.id, name: item.name, price: item.price + optionsTotal, tax: item.tax, qty: addQty, checked: true, options, desc },
      ];
    });
    notifyItemOrdered(item.name, addQty, table.id);
    setOptionItem(null);
  };
  const updateQty = (id, delta) => {
    setCart((prev) => prev.map((p) => ((p.lineId || p.id) === id ? { ...p, qty: Math.max(0, p.qty + delta) } : p)).filter((p) => p.qty > 0));
  };
  const toggleChecked = (id) => {
    setCart((prev) => prev.map((p) => ((p.lineId || p.id) === id ? { ...p, checked: !p.checked } : p)));
  };

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  // Tax is resolved per line item (Tax Category × current Order Type) rather than a single flat
  // rate, so switching Dine-in ↔ Takeaway/Delivery/Event re-prices reduced-rate items live.
  const taxBreakdown = useMemo(
    () =>
      cart.reduce(
        (acc, i) => {
          const rate = getTaxRate(i.tax, orderType);
          const base = i.price * i.qty;
          const t = Math.round(base * rate);
          const key = `${Math.round(rate * 100)}%`;
          acc.totalTax += t;
          acc.byRate[key] = (acc.byRate[key] || 0) + t;
          acc.baseByRate[key] = (acc.baseByRate[key] || 0) + base;
          return acc;
        },
        { totalTax: 0, byRate: {}, baseByRate: {} }
      ),
    [cart, orderType]
  );
  const tax = taxBreakdown.totalTax;
  const grandTotal = subtotal + tax;
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const rateKeys = Object.keys(taxBreakdown.byRate).sort((a, b) => parseInt(b) - parseInt(a));

  // Optional discount, applied either from the "Pay Now" pre-payment step or from the Billing
  // screen's "Discounts" rail icon. `afterDiscount` remembers which flow to return to once the
  // Discount modal is closed (Apply or Skip), so both entry points share one modal + one state.
  const [discount, setDiscount] = useState(null);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [afterDiscount, setAfterDiscount] = useState("settlement");
  const discountAmount = discount ? discount.amount : 0;
  const finalTotal = Math.max(0, grandTotal - discountAmount);

  const [showBilling, setShowBilling] = useState(false);
  const [showPromoPicker, setShowPromoPicker] = useState(false);
  const BILL_OF_LABELS = { "Dine-in": "Dine In", Takeaway: "Take Away", Delivery: "Delivery", Event: "Event" };

  const openDiscountFrom = (from) => {
    setAfterDiscount(from);
    setShowBilling(false);
    setShowDiscountModal(true);
  };
  const closeDiscountModalTo = (target) => {
    setShowDiscountModal(false);
    if (target === "settlement") setShowSettlement(true);
    else if (target === "billing") setShowBilling(true);
  };

  // Live bill fed into the Upcoming-format settlement screen when "Pay Now" is tapped.
  const [showSettlement, setShowSettlement] = useState(false);
  const liveBill = useMemo(
    () => ({
      id: `live-${table.id}`,
      outlet: "UPCOMING RESTRO — SHIBUYA MAIN",
      table: table.id,
      amount: finalTotal,
      subtotal,
      tax,
      discountAmount,
      items: cart.map((c) => ({ name: c.desc ? `${c.name} (${c.desc})` : c.name, qty: c.qty, price: c.price })),
    }),
    [table.id, finalTotal, subtotal, tax, discountAmount, cart]
  );

  // Shared bill payload for the printed guest receipt (Japanese thermal format).
  const buildBillSlip = (payment = {}) => ({
    outlet: "UPCOMING RESTRO",
    branch: "SHIBUYA MAIN",
    slipNo: generalInfo?.kot || `${table.id}-${String(Date.now()).slice(-8)}`,
    table: table.id,
    cover: Number(generalInfo?.cover) || 1,
    attendant: generalInfo?.attendant || CURRENT_USER.name,
    items: cart.map((c) => ({ name: c.desc ? `${c.name} (${c.desc})` : c.name, qty: c.qty, price: c.price })),
    subtotal,
    tax,
    taxByRate: taxBreakdown.byRate,
    discount: discountAmount,
    total: finalTotal,
    paid: payment.totalPaid || finalTotal,
    change: payment.change || 0,
    method: payment.method || "",
  });

  // Payment success → mark paid (consumes coupon + moves loyalty points), free the
  // table, clear the active order, print the bill and return to Table View.
  const handleSettlementConfirmed = (payment = {}) => {
    setShowSettlement(false);
    setShowBilling(false);
    printBill(buildBillSlip(payment));
    payOrder(table.id, {
      total: finalTotal,
      discount: discountAmount,
      promotionId: discount?.promotionId || null,
      coupon: discount?.coupon || null,
      pointsUsed: discount?.pointsUsed || 0,
      customerId: discount?.customerId || null,
    });
    notifyOrderClosed(table.id, finalTotal);
    setCart([]);
    setDiscount(null);
    onExit("tables");
  };

  // "Place Order" = save the running cart as an order (kitchen-sent) + notify with sound.
  const handlePlaceOrder = () => {
    if (cart.length === 0) return;
    const lines = cart.map((c) => ({ ...c }));
    const saved = saveOrder({
      table: table.id,
      orderType,
      items: lines.map((c) => ({ name: c.desc ? `${c.name} (${c.desc})` : c.name, qty: c.qty, price: c.price })),
      subtotal,
      tax,
      total: finalTotal,
    });
    // Persist against the table itself so it survives navigation and a page refresh.
    placeOrder(table.id, {
      orderType,
      items: lines,
      notes: generalInfo?.remarks || "",
      attendant: generalInfo?.attendant || CURRENT_USER.name,
      cover: Number(generalInfo?.cover) || 1,
      subtotal,
      tax,
      total: finalTotal,
    });
    // Kitchen ticket goes to the printer as soon as the order is sent.
    printKot({
      outlet: "UPCOMING RESTRO — SHIBUYA MAIN",
      kot: generalInfo?.kot || saved.id || `${table.id}-${String(Date.now()).slice(-5)}`,
      table: table.id,
      orderType,
      cover: Number(generalInfo?.cover) || 1,
      attendant: generalInfo?.attendant || CURRENT_USER.name,
      items: lines.map((c) => ({ name: c.name, desc: c.desc, qty: c.qty })),
      notes: generalInfo?.remarks || "",
    });
    notifyKotSent(`${table.id} · ${orderType}`, saved.itemCount);
    setOrderToast(`Ordered · KOT printed · ${saved.itemCount} items · ¥${finalTotal.toLocaleString()}`);
    setTimeout(() => setOrderToast(""), 2400);
    setCartOpen(false);
  };


  const handleHoldOrder = () => {
    if (cart.length === 0) return;
    setOrderToast("Order put on hold");
    setTimeout(() => setOrderToast(""), 2000);
  };

  const ORDER_TYPES = [
    { id: "Dine-in", label: "Dine-in", icon: Store },
    { id: "Takeaway", label: "Takeaway", icon: ShoppingBag },
    { id: "Delivery", label: "Delivery", icon: Truck },
    { id: "Event", label: "Event", icon: PartyPopper },
  ];

  const CategoryChips = ({ vertical }) => (
    <div className={vertical ? "space-y-2" : "flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x"}>
      {ORDER_CATEGORIES.map((c) => (
        <button
          key={c}
          onClick={() => setCategory(c)}
          className={`text-left rounded-xl text-sm font-semibold border transition-colors shrink-0 snap-start ${
            vertical ? "w-full px-3.5 py-2.5" : "px-4 py-2.5 whitespace-nowrap"
          }`}
          style={
            category === c
              ? { background: C.greenLight, borderColor: C.green, color: C.green }
              : { background: "white", borderColor: "#E2E8F0", color: "#334155" }
          }
        >
          {c === "All Categories" ? "ALL CATEGORIES" : c}
        </button>
      ))}
    </div>
  );

  const CartPanelContent = () => (
    <>
      <div className="flex items-center gap-4 sm:gap-5 px-4 sm:px-5 pt-3 sm:pt-4 border-b border-slate-100 overflow-x-auto">
        {["Orders On Hold", "Ordered Items", "View All Orders"].map((t) => (
          <button
            key={t}
            onClick={() => setCartTab(t)}
            className="pb-3 text-[13px] sm:text-sm font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0"
            style={cartTab === t ? { color: C.blue, borderColor: C.blue } : { color: "#94A3B8", borderColor: "transparent" }}
          >
            {t}
          </button>
        ))}
        <button
          className="ml-auto mb-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 shrink-0"
          style={{ background: C.orange }}
        >
          <Zap size={14} /> Actions
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-slate-100">
        <div className="flex gap-2 flex-wrap">
          {ORDER_TYPES.map((o) => (
            <button
              key={o.id}
              onClick={() => setOrderType(o.id)}
              className="flex flex-col items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors min-w-[64px]"
              style={
                orderType === o.id
                  ? { background: C.blue, borderColor: C.blue, color: "white" }
                  : { background: "white", borderColor: "#E2E8F0", color: "#334155" }
              }
            >
              <o.icon size={15} />
              {o.label}
            </button>
          ))}
        </div>
        <div className="text-right shrink-0">
          <div className="text-[11px] text-slate-400">Consumption Tax (Reduced / Standard)</div>
          <div className="text-sm font-bold" style={{ color: C.blue }}>
            {Math.round(getTaxRate("Reduced Tax Eligible", orderType) * 100)}% / {Math.round(getTaxRate("Standard Tax Item", orderType) * 100)}%
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-5 py-2 grid grid-cols-[1fr_auto_auto] gap-2 text-[11px] font-bold text-slate-400 tracking-wide">
        <div>ITEM NAME</div><div>QTY</div><div className="text-right">TOTAL</div>
      </div>

      <div className="flex-1 min-h-[80px] overflow-y-auto px-4 sm:px-5 space-y-4">
        {cart.length === 0 && <p className="text-sm text-slate-400 py-8 text-center">Cart is empty — tap a menu item to add it.</p>}
        {cart.map((item) => (
          <div key={item.lineId || item.id} className="flex items-start gap-2 sm:gap-2.5">
            <button
              onClick={() => toggleChecked(item.lineId || item.id)}
              className="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5"
              style={item.checked ? { background: C.blue, borderColor: C.blue } : { borderColor: "#CBD5E1" }}
            >
              {item.checked && <Check size={12} color="white" />}
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-slate-800 truncate">{item.name}</div>
              {item.desc && <div className="text-[11px] font-medium truncate" style={{ color: C.blue }}>{item.desc}</div>}
              <div className="text-[11px] text-slate-400 truncate">¥{item.price.toLocaleString()} · {item.tax} · Tax {Math.round(getTaxRate(item.tax, orderType) * 100)}%</div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={() => updateQty(item.lineId || item.id, -1)} className="w-8 h-8 sm:w-6 sm:h-6 rounded-full bg-slate-100 flex items-center justify-center active:bg-slate-200"><Minus size={12} /></button>
              <span className="w-4 text-center text-sm font-semibold">{item.qty}</span>
              <button onClick={() => updateQty(item.lineId || item.id, 1)} className="w-8 h-8 sm:w-6 sm:h-6 rounded-full bg-slate-100 flex items-center justify-center active:bg-slate-200"><Plus size={12} /></button>
            </div>
            <div className="w-14 text-right text-sm font-bold text-slate-800 shrink-0">
              {Math.round(item.price * item.qty * (1 + getTaxRate(item.tax, orderType))).toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      <div className="shrink-0 border-t border-slate-100 px-4 sm:px-5 pt-4 pb-4 sm:pb-5">
        <div className="flex justify-between text-sm text-slate-500 mb-1.5">
          <span>Subtotal</span><span className="font-semibold text-slate-700">NPR {subtotal.toLocaleString()}.00</span>
        </div>
        {rateKeys.length > 1 && (
          <div className="mb-1.5 space-y-1">
            {rateKeys.map((rate) => (
              <div key={rate} className="flex justify-between text-xs text-slate-400">
                <span>{rate} Taxable Sales (NPR {taxBreakdown.baseByRate[rate].toLocaleString()})</span>
                <span>NPR {taxBreakdown.byRate[rate].toLocaleString()}.00</span>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-between text-sm text-slate-500 mb-3">
          <span>Consumption Tax{rateKeys.length > 1 ? " (all rates)" : ""}</span><span className="font-semibold text-slate-700">NPR {tax.toLocaleString()}.00</span>
        </div>
        {discount && (
          <div className="flex justify-between text-sm mb-3" style={{ color: C.red }}>
            <span>Discount{discount.reason ? ` (${discount.reason})` : ""}</span>
            <span className="font-semibold">-NPR {discountAmount.toLocaleString()}.00</span>
          </div>
        )}
        <div className="flex justify-between items-center rounded-xl bg-slate-100 px-3.5 py-3 mb-4">
          <span className="text-sm font-bold text-slate-600">GRAND TOTAL</span>
          <span className="text-lg font-extrabold text-slate-900">NPR {finalTotal.toLocaleString()}.00</span>
        </div>
        {promo.enabled && (
          <button
            onClick={() => setShowPromoPicker(true)}
            className="w-full mb-2 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold border min-h-[44px]"
            style={{ background: C.purpleLight, borderColor: "#E9D5FF", color: C.purple }}
          >
            <Tag size={16} /> Discount &amp; Loyalty
          </button>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            disabled={cart.length === 0}
            onClick={() => setShowSettlement(true)}
            className="flex flex-col items-center justify-center gap-1 py-3 sm:py-2.5 rounded-xl text-white text-xs font-bold min-h-[44px] transition-transform active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none"
            style={{ background: "#4F46E5" }}
          >
            <CreditCard size={16} /> Pay Now
          </button>
          <button
            disabled={cart.length === 0}
            onClick={() => setShowBilling(true)}
            className="flex flex-col items-center justify-center gap-1 py-3 sm:py-2.5 rounded-xl text-xs font-bold border min-h-[44px] transition-transform active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none"
            style={{ background: C.greenLight, borderColor: "#BBF7D0", color: "#15803D" }}
          >
            <Receipt size={16} /> Billing
          </button>
          <button
            disabled={cart.length === 0}
            onClick={handleHoldOrder}
            className="flex flex-col items-center justify-center gap-1 py-3 sm:py-2.5 rounded-xl text-xs font-bold border min-h-[44px] transition-transform active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none"
            style={{ background: C.orangeLight, borderColor: "#FDE68A", color: "#B45309" }}
          >
            <PauseCircle size={16} /> Hold
          </button>
          <button
            disabled={cart.length === 0}
            onClick={handlePlaceOrder}
            className="flex flex-col items-center justify-center gap-1 py-3 sm:py-2.5 rounded-xl text-white text-xs font-bold min-h-[44px] transition-transform active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none"
            style={{ background: C.green }}
          >
            <CheckCircle2 size={16} /> Place Order
          </button>
        </div>
      </div>
    </>
  );

  if (showGeneralInfo) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-50" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
        <GeneralInfoScreen
          table={table}
          currentUser={CURRENT_USER.name}
          initial={generalInfo}
          onCancel={() => (generalInfo ? setShowGeneralInfo(false) : onExit())}
          onSave={(info) => {
            setGeneralInfo(info);
            setShowGeneralInfo(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      {/* Top bar */}
      <div className="shrink-0 bg-white border-b border-slate-200 flex flex-wrap items-center gap-x-4 gap-y-1 px-3 sm:px-5 py-2.5 sm:py-0 sm:h-14 text-sm">
        <div className="flex items-center gap-1.5 text-slate-500 font-medium shrink-0 order-1">
          <CalendarDays size={15} /> {new Date().toLocaleDateString("en-GB").split("/").reverse().join("/")}
        </div>
        <div className="ml-auto flex items-center gap-3 sm:gap-5 shrink-0 order-2 sm:order-3">
          <button onClick={() => setShowGeneralInfo(true)} className="flex items-center gap-1.5 font-semibold text-xs sm:text-sm" style={{ color: C.orange }}>
            <Info size={15} /> <span className="hidden xs:inline">OTHER INFO{generalInfo?.cover ? ` · COVER ${generalInfo.cover}` : ""}</span>
          </button>
          <button onClick={onExit} className="flex items-center gap-1.5 font-semibold text-xs sm:text-sm" style={{ color: C.blue }}>
            <ArrowUpRight size={15} /> <span className="hidden xs:inline">DASHBOARD</span>
          </button>
          <div className="flex items-center gap-1.5 font-semibold text-xs sm:text-sm" style={{ color: C.purple }}>
            <UserCog size={15} /> <span className="hidden sm:inline">ADMINISTRATOR</span>
          </div>
        </div>
        <div className="w-full sm:w-auto text-slate-500 truncate order-3 sm:order-2 text-xs sm:text-sm">
          TOUCH ORDER: <span className="font-bold text-slate-800">UPCOMING RESTRO — SHIBUYA MAIN</span>{" "}
          <span className="text-slate-400 hidden sm:inline">[ Dine In: Evening Session Shift ]</span>
        </div>
      </div>

      {/* Badges row */}
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 px-3 sm:px-5 pt-3 sm:pt-4 pb-2">
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-bold border" style={{ borderColor: C.green, color: C.green, background: "white" }}>
            Source: {table.id}
          </span>
          {generalInfo && (
            <span className="px-3 py-1 rounded-full text-xs font-bold border hidden sm:inline" style={{ borderColor: C.orange, color: C.orange, background: "white" }}>
              {generalInfo.kot} · Cover {generalInfo.cover}
              {generalInfo.attendant ? ` · ${generalInfo.attendant}` : ""}
            </span>
          )}
          <span className="px-3 py-1 rounded-full text-xs font-bold text-white" style={{ background: C.green }}>
            STANDARD
          </span>
        </div>
        <div className="px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-semibold border" style={{ borderColor: C.blueLight, color: "#1E40AF", background: "#EFF6FF" }}>
          Reduced-Eligible items ({orderType}): <b>{Math.round(getTaxRate("Reduced Tax Eligible", orderType) * 100)}%</b> · Standard items: <b>{Math.round(getTaxRate("Standard Tax Item", orderType) * 100)}%</b>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        {/* LEFT: Menu */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col px-3 sm:px-5 pb-3 sm:pb-4 overflow-hidden">
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 mb-3 sm:mb-4">
            <h2 className="font-bold text-slate-800 flex items-center gap-2 shrink-0 text-[15px] sm:text-base">
              🍱 Menu of Shibuya Main
              <RotateCw size={14} className="text-slate-400" />
            </h2>
            <div className="flex-1 min-w-[160px] flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2.5 sm:py-2 bg-white">
              <Search size={15} className="text-slate-400 shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Menu Items..."
                className="text-sm outline-none w-full placeholder:text-slate-400"
              />
            </div>
            <Button variant="secondary" size="sm" onClick={() => setShowGeneralInfo(true)} className="shrink-0 hidden sm:inline-flex">
              <ChevronLeft size={14} /> Other Info* {generalInfo?.cover ? `· Cover ${generalInfo.cover}` : ""}
            </Button>
          </div>

          {/* Mobile: horizontal category chips */}
          <div className="md:hidden mb-3">
            <CategoryChips vertical={false} />
          </div>

          <div className="flex-1 min-h-0 flex gap-4 lg:gap-5 overflow-hidden">
            {/* Tablet+: vertical category sidebar */}
            <div className="hidden md:block w-36 lg:w-40 xl:w-44 shrink-0 overflow-y-auto">
              <div className="text-xs font-bold text-slate-400 tracking-wide mb-2">CATEGORIES</div>
              <CategoryChips vertical={true} />
            </div>

            <div className="flex-1 min-w-0 min-h-0 flex flex-col">
              <div className="text-xs font-bold text-slate-400 tracking-wide mb-2.5 sm:mb-3 hidden md:block shrink-0">ITEMS</div>
              <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 sm:pr-1">
                <div
                  className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 md:h-full"
                  style={{
                    gridAutoRows: "minmax(140px, min(300px, calc((100% - 2rem) / 3)))",
                  }}
                >
                  {items.map((item) => (
                    <MenuItemCard key={item.id} item={item} onAdd={openItem} rate={getTaxRate(item.tax, orderType)} />
                  ))}
                  {items.length === 0 && (
                    <div className="col-span-full text-center text-sm text-slate-400 py-10">No items match your search.</div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* RIGHT: Cart — sidebar on desktop, bottom sheet on tablet/mobile */}
        <div className="hidden lg:flex lg:w-[360px] xl:w-[400px] 2xl:w-[440px] shrink-0 bg-white border-l border-slate-200 flex-col">
          <CartPanelContent />
        </div>
      </div>

      {/* Mobile/Tablet: sticky bottom order bar */}
      <div className="lg:hidden shrink-0 bg-white border-t border-slate-200 px-3 sm:px-5 py-2.5 flex items-center gap-3">
        <button
          onClick={() => setCartOpen(true)}
          className="flex-1 flex items-center justify-between gap-3 rounded-xl px-4 py-3 min-h-[44px] text-white font-bold"
          style={{ background: C.green }}
        >
          <span className="flex items-center gap-2 text-sm">
            <Receipt size={16} /> {cartCount} item{cartCount === 1 ? "" : "s"} in cart
          </span>
          <span className="text-sm">NPR {finalTotal.toLocaleString()}.00</span>
        </button>
        {promo.enabled && (
          <button
            onClick={() => setShowPromoPicker(true)}
            aria-label="Discount & Loyalty"
            className="shrink-0 flex items-center justify-center gap-1.5 rounded-xl px-3 py-3 min-h-[44px] min-w-[44px] text-xs font-bold border"
            style={{ background: C.purpleLight, borderColor: "#E9D5FF", color: C.purple }}
          >
            <Tag size={16} /> <span className="hidden sm:inline">Discount</span>
          </button>
        )}
      </div>


      {/* Mobile/Tablet: cart bottom-sheet drawer */}
      {cartOpen && (
        <div className="lg:hidden fixed inset-0 z-[60] flex flex-col justify-end">
          <button className="absolute inset-0 bg-slate-900/40" onClick={() => setCartOpen(false)} aria-label="Close cart" />
          <div className="relative bg-white rounded-t-3xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-4 sm:px-5 pt-4 pb-2 shrink-0">
              <div className="w-10 h-1.5 rounded-full bg-slate-200 mx-auto absolute left-1/2 -translate-x-1/2 top-2" />
              <h3 className="font-bold text-slate-800 mt-3">Order Summary</h3>
              <button onClick={() => setCartOpen(false)} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center mt-3">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <CartPanelContent />
            </div>
          </div>
        </div>
      )}

      {optionItem && (
        <ItemOptionsModal
          key={optionItem.id}
          item={optionItem}
          orderType={orderType}
          onClose={() => setOptionItem(null)}
          onAdd={addItem}
        />
      )}

      <PromotionPickerModal
        open={showPromoPicker}
        subtotal={grandTotal}
        onClose={() => setShowPromoPicker(false)}
        onApply={(d) => setDiscount({ ...d, reason: d.label })}
      />

      {showSettlement && (
        <BillSettlementModal
          bill={liveBill}
          onClose={() => setShowSettlement(false)}
          onConfirm={handleSettlementConfirmed}
          onHold={() => setShowSettlement(false)}
          onOpenDiscount={() => openDiscountFrom("settlement")}
          discountAmount={discountAmount}
        />
      )}

      {showBilling && (
        <BillingScreen
          orderType={orderType}
          billOfLabel={BILL_OF_LABELS[orderType] || orderType}
          bill={{ subtotal, discountAmount, grandTotal: finalTotal }}
          onExit={() => setShowBilling(false)}
          onSettle={() => { setShowBilling(false); handleSettlementConfirmed(); }}
          onOpenDiscount={() => openDiscountFrom("billing")}
        />
      )}

      <DiscountModal
        open={showDiscountModal}
        cart={cart}
        subtotal={subtotal}
        orderType={orderType}
        billLabel={`${table.id} · ${BILL_OF_LABELS[orderType] || orderType}`}
        onApply={(d) => { setDiscount(d); closeDiscountModalTo(afterDiscount); }}
        onSkip={() => { setDiscount(null); closeDiscountModalTo(afterDiscount); }}
        onClose={() => setShowDiscountModal(false)}
      />

      {orderToast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[900] px-4 py-3 rounded-xl text-white text-sm font-semibold shadow-lg flex items-center gap-2"
          style={{ background: C.green, animation: "slideUp .18s ease-out" }}
        >
          <CheckCircle2 size={16} /> {orderToast}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- ORDERS ---------------------------------- */
const RUNNING_ORDERS = [
  { id: "#1201", table: "T6", covers: 3, since: "22 min ago", items: 4, amount: 2140, status: "Occupied", time: "11:20 AM" },
  { id: "#1198", table: "T3", covers: 2, since: "12 min ago", items: 2, amount: 640, status: "Hold", time: "12:32 PM" },
  { id: "#1195", table: "T4", covers: 4, since: "48 min ago", items: 6, amount: 3820, status: "Billed", time: "01:14 PM" },
  { id: "#1189", table: "T8", covers: 2, since: "5 min ago", items: 3, amount: 1260, status: "Occupied", time: "01:47 PM" },
  { id: "#1183", table: "T10", covers: 5, since: "2 min ago", items: 7, amount: 4460, status: "Hold", time: "02:05 PM" },
];

function OrdersPage({ onOpenTable }) {
  return (
    <div className="pb-8">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-800">Orders</h1>
        <p className="text-sm text-slate-400">Running orders across all tables — jump straight back into any one of them.</p>
      </div>
      <Card padded={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: C.tableHead }}>
                {["Order #", "Table", "Items", "Amount", "Status", "Time", "Action"].map((h) => (
                  <th key={h} className="text-left text-white font-semibold px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RUNNING_ORDERS.map((o) => {
                const meta = TABLE_STATUS_META[o.status];
                return (
                  <tr key={o.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold" style={{ color: C.blue }}>{o.id}</td>
                    <td className="px-4 py-3 text-slate-700 font-medium">{o.table}</td>
                    <td className="px-4 py-3 text-slate-600">{o.items}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">¥{o.amount.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: meta.tint, color: meta.label }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.dot }} />{o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{o.time}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onOpenTable({ id: o.table, status: o.status, covers: o.covers, since: o.since })}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold hover:underline"
                        style={{ color: C.green }}
                      >
                        <Eye size={13} /> View / Take Order
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ---------------------------------- SETTLEMENT ---------------------------------- */
const SETTLEMENT_STATUS_META = {
  PENDING: { dot: C.orange, label: "#B45309", tint: C.orangeLight },
  SETTLED: { dot: C.green, label: "#15803D", tint: C.greenLight },
};

const SETTLEMENT_BILLS = [
  {
    id: "s1", outlet: "INDIAN RESTAURANT VISHNU EXPRESS KURUME", bill: "8283-30", ref: "IRVEK8283-9",
    amount: 550, table: "T1", status: "PENDING",
    items: [
      { name: "Chicken Tikka", qty: 2, price: 180 },
      { name: "Butter Naan", qty: 2, price: 40 },
      { name: "Coke", qty: 1, price: 110 },
    ],
  },
  {
    id: "s2", outlet: "INDIAN RESTAURANT VISHNU EXPRESS KURUME", bill: "8283-29", ref: "IRVEK8283-8",
    amount: 1050, table: "T2", status: "SETTLED",
    items: [
      { name: "Butter Chicken", qty: 2, price: 220 },
      { name: "Japanese Wine (60ML)", qty: 3, price: 150 },
      { name: "Momo", qty: 2, price: 90 },
    ],
    payment: "Cash",
  },
  {
    id: "s3", outlet: "INDIAN RESTAURANT VISHNU EXPRESS KURUME", bill: "8283-31", ref: "IRVEK8283-10",
    amount: 780, table: "Take Away", status: "PENDING",
    items: [
      { name: "Paneer Tikka", qty: 1, price: 260 },
      { name: "Garlic Naan", qty: 3, price: 45 },
      { name: "Lassi", qty: 2, price: 95 },
    ],
  },
];

function SettlementStatusBadge({ status }) {
  const m = SETTLEMENT_STATUS_META[status] || SETTLEMENT_STATUS_META.PENDING;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: m.tint, color: m.label }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.dot }} />
      {status}
    </span>
  );
}

/* =====================================================================================
   BILL SETTLEMENT MODULE (Upcoming-format)
   -------------------------------------------------------------------------------------
   - SETTLEMENT_MODE_GROUPS is the single configuration object driving every button,
     dropdown, and enable/disable state on the right-hand panel. Add a new payment
     method (e.g. a new e-wallet) by adding an entry to a group's `methods` array —
     no other component needs to change. Set `enabled: false` on a group or a method
     to grey it out ("not configured by the restaurant").
   - BillSettlementModal is the full-screen settlement screen itself, matching the
     Upcoming POS "Bill Settlement" layout: Bill Summary (left), Settlement Details /
     Settlement Summary (middle), Settlement Mode panel (right).
   ===================================================================================== */

const SETTLEMENT_MODE_GROUPS = [
  {
    id: "cash", label: "Cash", icon: Banknote, color: C.green, bg: C.greenLight, enabled: true,
    methods: [{ id: "cash_jpy", label: "Cash (現金)", enabled: true }],
  },
  {
    id: "card", label: "Card", icon: CreditCard, color: "#4F46E5", bg: "#EEF2FF", enabled: true,
    methods: [
      { id: "stera", label: "Stera", enabled: true },
      { id: "stera_pack", label: "Stera Pack", enabled: true },
    ],
  },
  {
    id: "ewallet", label: "E-Wallet", icon: Smartphone, color: "#16A34A", bg: "#DCFCE7", enabled: true,
    methods: [
      { id: "paypay", label: "PayPay", enabled: true },
      { id: "kurume_pay", label: "Kurume Pay", enabled: true },
      { id: "color_me", label: "Color Me", enabled: false }, // not configured by this outlet
    ],
  },
  {
    id: "company", label: "Company", icon: Truck, color: "#0EA5E9", bg: "#E0F2FE", enabled: true,
    methods: [
      { id: "uber", label: "Uber", enabled: true },
      { id: "demaekan", label: "Demaekan", enabled: true },
      { id: "rocket_now", label: "Rocket Now", enabled: false }, // not configured by this outlet
    ],
  },
  {
    id: "coupon", label: "Coupon", icon: Ticket, color: "#D97706", bg: "#FEF3C7", enabled: true,
    methods: [{ id: "kurume_shouhinken", label: "Kurume 商品券", enabled: true }],
  },
  {
    id: "staff", label: "Staff", icon: UserCircle2, color: "#9333EA", bg: C.purpleLight, enabled: true,
    methods: [{ id: "staff_default", label: "Staff Account", enabled: true }],
  },
  {
    id: "cheque", label: "Cheque", icon: Landmark, color: C.tableHead, bg: "#E0F2FE", enabled: true,
    methods: [{ id: "cheque_default", label: "Cheque", enabled: true }],
  },
  {
    id: "onhold", label: "On Hold", icon: PauseCircle, color: "#B45309", bg: C.orangeLight, enabled: true,
    methods: [{ id: "on_hold_default", label: "On Hold", enabled: true }],
  },
];

function fmt(n) {
  return (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ---- Right-hand settlement mode button (supports a dropdown of sub-methods) ---- */
function SettlementModeButton({ group, expanded, onToggle, onPick }) {
  const Icon = group.icon;
  const groupEnabled = group.enabled && group.methods.some((m) => m.enabled);
  const single = group.methods.length === 1;

  return (
    <div className="w-full">
      <button
        disabled={!groupEnabled}
        onClick={() => (single ? onPick(group, group.methods[0]) : onToggle(group.id))}
        className={`w-full flex items-center justify-between gap-2 px-4 py-3.5 rounded-xl border text-sm font-semibold transition-all ${
          groupEnabled ? "hover:shadow-sm cursor-pointer" : "opacity-40 cursor-not-allowed"
        }`}
        style={{
          background: expanded ? group.bg : "#F1F5F9",
          borderColor: expanded ? group.color : "#E2E8F0",
          color: groupEnabled ? "#334155" : "#94A3B8",
        }}
      >
        <span className="flex items-center gap-2.5">
          <Icon size={16} color={groupEnabled ? group.color : "#94A3B8"} />
          {group.label}
          {!groupEnabled && <Lock size={11} className="text-slate-300" />}
        </span>
        {!single && groupEnabled && (expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
      </button>

      {!single && expanded && groupEnabled && (
        <div className="mt-1.5 ml-2 space-y-1.5 border-l-2 pl-3" style={{ borderColor: group.bg }}>
          {group.methods.map((m) => (
            <button
              key={m.id}
              disabled={!m.enabled}
              onClick={() => onPick(group, m)}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                m.enabled ? "hover:bg-slate-100 text-slate-600" : "opacity-40 cursor-not-allowed text-slate-400"
              }`}
            >
              {m.label}{!m.enabled && " (unavailable)"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---- Middle "Settlement Details" amount entry form ---- */
function SettlementAmountPanel({ group, method, remaining, initialAmount, initialTip, isEditing, onSave, onCancel }) {
  const Icon = group.icon;
  const [amount, setAmount] = useState(initialAmount);
  const [tip, setTip] = useState(initialTip);
  const amt = parseFloat(amount) || 0;

  return (
    <Card className="border-2" style={{ borderColor: group.color }}>
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: group.bg }}>
          <Icon size={17} color={group.color} />
        </div>
        <div>
          <div className="text-xs text-slate-400">{isEditing ? "Editing entry" : "New settlement"}</div>
          <div className="font-bold text-slate-800 text-sm">{method.label}</div>
        </div>
      </div>

      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Amount</label>
      <div className="relative mb-2">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">¥</span>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full border border-slate-200 rounded-xl pl-7 pr-3 py-2.5 text-lg font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
          autoFocus
        />
      </div>
      {remaining > 0 && (
        <button
          onClick={() => setAmount(remaining)}
          className="text-xs font-semibold mb-4 px-2.5 py-1 rounded-lg"
          style={{ background: group.bg, color: group.color }}
        >
          Use remaining ¥{fmt(remaining)}
        </button>
      )}
      {remaining <= 0 && <div className="mb-4" />}

      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Tip (optional)</label>
      <div className="relative mb-5">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">¥</span>
        <input
          type="number"
          value={tip}
          onChange={(e) => setTip(e.target.value)}
          className="w-full border border-slate-200 rounded-xl pl-7 pr-3 py-2.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
        />
      </div>

      <div className="flex gap-2.5">
        <Button variant="secondary" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button className="flex-1" disabled={amt <= 0} onClick={() => onSave({ amount: amt, tip: parseFloat(tip) || 0 })}>
          <Check size={15} /> {isEditing ? "Update" : "Add"}
        </Button>
      </div>
    </Card>
  );
}

/* ---- Bill Summary panel (left column) ---- */
function BillSummaryPanel({ bill }) {
  const Field = ({ label, value }) => (
    <div>
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-sm font-semibold text-slate-800 mt-0.5">{value || "-"}</div>
    </div>
  );
  return (
    <Card>
      <div className="flex items-center gap-2.5 mb-4">
        <FileText size={16} className="text-blue-500" />
        <h3 className="font-bold text-slate-800 text-sm">Bill Summary</h3>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        <Field label="Outlet" value={bill.outlet} />
        <Field label="Company" value={bill.company} />
        <Field label="PAN" value={bill.pan} />
        <Field label="Address" value={bill.address} />
        <Field label="Room Number" value={bill.roomNumber} />
        <Field label="Room Guest" value={bill.roomGuest} />
        <Field label="Bill Amount" value={`¥${fmt(bill.amount)}`} />
        <Field label="Table / Take Away" value={bill.table} />
      </div>
    </Card>
  );
}

/* ---- Settlement Summary table (split-payment ledger) ---- */
function SettlementSummaryTable({ entries, onEdit, onDelete, totalPaid, totalTip, remaining, change }) {
  return (
    <Card padded={false} className="overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 pt-4 pb-3">
        <List size={16} className="text-blue-500" />
        <h3 className="font-bold text-slate-800 text-sm">Settlement Summary</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-y border-slate-100">
              <th className="text-left text-xs font-bold text-slate-500 uppercase tracking-wide px-4 py-2.5">Mode</th>
              <th className="text-right text-xs font-bold text-slate-500 uppercase tracking-wide px-4 py-2.5">Amount</th>
              <th className="text-right text-xs font-bold text-slate-500 uppercase tracking-wide px-4 py-2.5">Tip</th>
              <th className="text-center text-xs font-bold text-slate-500 uppercase tracking-wide px-4 py-2.5">Action</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-xs text-slate-400">
                  No settlement added yet — pick a mode on the right to begin.
                </td>
              </tr>
            )}
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: e.color }} />
                    <span className="font-medium text-slate-700">{e.methodLabel}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right font-semibold text-slate-800">{fmt(e.amount)}</td>
                <td className="px-4 py-2.5 text-right text-slate-500">{fmt(e.tip)}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-center gap-1.5">
                    <button onClick={() => onEdit(e)} title="Edit" className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500">
                      <Pencil size={12} />
                    </button>
                    <button onClick={() => onDelete(e.id)} title="Delete" className="w-7 h-7 rounded-full bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-500">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            <tr style={{ background: C.greenLight }}>
              <td className="px-4 py-2.5 font-bold text-slate-700">Total:</td>
              <td className="px-4 py-2.5 text-right font-bold text-slate-800">{fmt(totalPaid)}</td>
              <td className="px-4 py-2.5 text-right font-bold text-slate-800">{fmt(totalTip)}</td>
              <td></td>
            </tr>
            <tr style={{ background: change > 0 ? C.blueLight : C.orangeLight }}>
              <td className="px-4 py-2.5 font-bold" style={{ color: change > 0 ? "#1E40AF" : "#B45309" }}>
                {change > 0 ? "Change:" : "Remaining:"}
              </td>
              <td colSpan={3} className="px-4 py-2.5 text-right font-bold" style={{ color: change > 0 ? "#1E40AF" : "#B45309" }}>
                {fmt(change > 0 ? change : remaining)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ---- Full-screen Bill Settlement modal ---- */
function BillSettlementModal({ bill, onClose, onConfirm, onHold, onOpenDiscount, discountAmount = 0 }) {
  const [entries, setEntries] = useState([]);
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [picked, setPicked] = useState(null); // { group, method }
  const [editingId, setEditingId] = useState(null);
  const [confirmingHold, setConfirmingHold] = useState(false);
  const [amountStr, setAmountStr] = useState("");
  const [tipStr, setTipStr] = useState("");

  if (!bill) return null;

  const totalPaid = entries.reduce((s, e) => s + e.amount, 0);
  const totalTip = entries.reduce((s, e) => s + e.tip, 0);
  const remaining = Math.max(bill.amount - totalPaid, 0);
  const change = Math.max(totalPaid - bill.amount, 0);
  const canSettle = totalPaid >= bill.amount && bill.amount > 0;

  const editingEntry = editingId ? entries.find((e) => e.id === editingId) : null;
  const remainingForEditing = editingEntry ? remaining + editingEntry.amount : remaining;

  const amt = parseFloat(amountStr) || 0;
  const tipAmt = parseFloat(tipStr) || 0;
  const items = bill.items || [];
  const itemCount = items.reduce((s, i) => s + (i.qty || 0), 0);

  const handleToggleGroup = (groupId) => setExpandedGroup((g) => (g === groupId ? null : groupId));

  const handlePick = (group, method) => {
    if (group.id === "onhold") {
      setConfirmingHold(true);
      return;
    }
    setEditingId(null);
    setPicked({ group, method });
    setExpandedGroup(group.id);
    setAmountStr(remaining > 0 ? String(remaining) : "");
    setTipStr("");
  };

  const handleEditEntry = (entry) => {
    const group = SETTLEMENT_MODE_GROUPS.find((g) => g.id === entry.groupId);
    const method = group?.methods.find((m) => m.id === entry.methodId);
    if (!group || !method) return;
    setEditingId(entry.id);
    setPicked({ group, method });
    setExpandedGroup(group.id);
    setAmountStr(String(entry.amount));
    setTipStr(entry.tip ? String(entry.tip) : "");
  };

  const handleDeleteEntry = (id) => setEntries((prev) => prev.filter((e) => e.id !== id));

  const resetEntry = () => {
    setPicked(null);
    setEditingId(null);
    setExpandedGroup(null);
    setAmountStr("");
    setTipStr("");
  };

  const handleSaveEntry = () => {
    if (!picked || amt <= 0) return;
    const { group, method } = picked;
    const entry = {
      id: editingId || `${Date.now()}`,
      groupId: group.id,
      methodId: method.id,
      methodLabel: group.methods.length > 1 ? `${group.label} · ${method.label}` : method.label,
      color: group.color,
      amount: amt,
      tip: tipAmt,
    };
    setEntries((prev) => (editingId ? prev.map((e) => (e.id === editingId ? entry : e)) : [...prev, entry]));
    resetEntry();
  };

  const pressKey = (k) => {
    if (!picked) return;
    if (k === ".") {
      setAmountStr((s) => (s.includes(".") ? s : (s || "0") + "."));
      return;
    }
    setAmountStr((s) => (s === "0" ? k : s + k));
  };
  const backspace = () => setAmountStr((s) => s.slice(0, -1));

  const handleSettle = () => {
    onConfirm({ billId: bill.id, entries, totalPaid, totalTip, change });
    onClose();
  };

  const handleConfirmHold = () => {
    onHold && onHold(bill.id);
    setConfirmingHold(false);
    onClose();
  };

  const KeyBtn = ({ children, onClick, disabled, variant = "light", className = "" }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl border text-sm font-bold h-11 flex items-center justify-center transition-transform active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none ${
        variant === "light" ? "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
      } ${className}`}
    >
      {children}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-100">
        <div>
          <h2 className="text-lg font-bold text-slate-800 uppercase tracking-wide">Bill Settlement</h2>
          <p className="text-xs text-slate-400">{bill.outlet} — {bill.table}</p>
        </div>
        <div className="flex items-center gap-2.5">
          {onOpenDiscount && (
            <button
              onClick={onOpenDiscount}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-transform active:scale-[0.97]"
              style={{ background: C.orangeLight, borderColor: "#FDE68A", color: "#B45309" }}
            >
              <Percent size={14} />
              {discountAmount > 0 ? `Discount -¥${fmt(discountAmount)}` : "Discount"}
            </button>
          )}
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
          {/* LEFT — Order & Bill Summary */}
          <div className="space-y-4 min-w-0">
            <Card padded={false} className="overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                <FileText size={14} className="text-blue-500" />
                <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide">Order &amp; Bill Summary</h3>
              </div>
              <div className="px-4 py-3 border-b border-slate-100">
                <div className="text-sm font-extrabold text-slate-800 uppercase">
                  {bill.table} · {items[0]?.name || "Order"}
                </div>
              </div>
              <div className="px-4 py-3 space-y-1.5 border-b border-slate-100 text-sm">
                <div className="flex justify-between"><span className="font-semibold text-slate-500">ITEMS ({itemCount})</span><span className="font-semibold text-slate-800">¥{fmt(bill.subtotal ?? bill.amount)}</span></div>
                <div className="flex justify-between"><span className="font-semibold text-slate-500">BILL AMT:</span><span className="font-semibold text-slate-800">¥{fmt(bill.amount)}</span></div>
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-500">REMAINING:</span>
                  <span className="font-extrabold" style={{ color: remaining > 0 ? C.red : C.green }}>¥{fmt(remaining)}</span>
                </div>
              </div>
              <div className="overflow-x-auto max-h-[220px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr className="border-b border-slate-100">
                      <th className="text-left text-xs font-bold text-slate-500 px-4 py-2">Items</th>
                      <th className="text-center text-xs font-bold text-slate-500 px-2 py-2">Qty</th>
                      <th className="text-right text-xs font-bold text-slate-500 px-4 py-2">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 && (
                      <tr><td colSpan={3} className="px-4 py-5 text-center text-xs text-slate-400">No items on this bill.</td></tr>
                    )}
                    {items.map((it, i) => (
                      <tr key={i} className="border-b border-slate-50 last:border-0">
                        <td className="px-4 py-2 text-slate-700 uppercase">{it.name}</td>
                        <td className="px-2 py-2 text-center text-slate-500">{it.qty}</td>
                        <td className="px-4 py-2 text-right font-semibold text-slate-800">{fmt(it.qty * it.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <BillSummaryPanel bill={bill} />

            <SettlementSummaryTable
              entries={entries}
              onEdit={handleEditEntry}
              onDelete={handleDeleteEntry}
              totalPaid={totalPaid}
              totalTip={totalTip}
              remaining={remaining}
              change={change}
            />
          </div>

          {/* RIGHT — Payment & Tip */}
          <div className="space-y-3 min-w-0">
            <div className="flex items-center gap-2">
              <Wallet size={14} className="text-blue-500" />
              <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide">Payment &amp; Tip</h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {SETTLEMENT_MODE_GROUPS.map((group) => (
                <SettlementModeButton
                  key={group.id}
                  group={group}
                  expanded={expandedGroup === group.id}
                  onToggle={handleToggleGroup}
                  onPick={handlePick}
                />
              ))}
            </div>

            <Card>
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs text-slate-400">
                  {picked ? (editingId ? "Editing entry" : "Selected mode") : "Select a payment mode"}
                </div>
                <div className="text-sm font-bold text-slate-800">{picked ? picked.method.label : "—"}</div>
              </div>

              <div className="grid grid-cols-[1fr_auto] gap-2.5">
                {/* Keypad */}
                <div className="grid grid-cols-4 gap-2">
                  {["1", "2", "3"].map((k) => <KeyBtn key={k} disabled={!picked} onClick={() => pressKey(k)}>{k}</KeyBtn>)}
                  <KeyBtn variant="ghost" disabled={!picked} onClick={() => setAmountStr(String(remainingForEditing || ""))}>÷</KeyBtn>
                  {["4", "5", "6"].map((k) => <KeyBtn key={k} disabled={!picked} onClick={() => pressKey(k)}>{k}</KeyBtn>)}
                  <KeyBtn variant="ghost" disabled={!picked} onClick={() => setAmountStr((s) => String((parseFloat(s) || 0) * 2))}>×</KeyBtn>
                  {["7", "8", "9"].map((k) => <KeyBtn key={k} disabled={!picked} onClick={() => pressKey(k)}>{k}</KeyBtn>)}
                  <KeyBtn variant="ghost" disabled={!picked} onClick={() => setAmountStr((s) => String(Math.max((parseFloat(s) || 0) - 100, 0)))}>−</KeyBtn>
                  <KeyBtn disabled={!picked} onClick={() => pressKey(".")}>.</KeyBtn>
                  <KeyBtn disabled={!picked} onClick={() => pressKey("0")}>0</KeyBtn>
                  <KeyBtn variant="ghost" disabled={!picked} onClick={() => setAmountStr("")}>CLEAR</KeyBtn>
                  <KeyBtn variant="ghost" disabled={!picked} onClick={() => setAmountStr((s) => String((parseFloat(s) || 0) + 100))}>+</KeyBtn>
                </div>

                {/* Tip quick keys */}
                <div className="grid grid-rows-4 gap-2 w-[74px]">
                  <KeyBtn variant="ghost" disabled={!picked} onClick={() => setTipStr(String(tipAmt + 10))} className="!text-emerald-600">+10</KeyBtn>
                  <KeyBtn variant="ghost" disabled={!picked} onClick={() => setTipStr(String(tipAmt + 20))}>+20</KeyBtn>
                  <KeyBtn variant="ghost" disabled={!picked} onClick={() => setTipStr(String(tipAmt + 50))}>+50</KeyBtn>
                  <KeyBtn variant="ghost" disabled={!picked} onClick={() => setTipStr("")}>None</KeyBtn>
                </div>
              </div>

              <div className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="font-semibold text-slate-500">TIP AMOUNT:</span><span className="font-bold text-slate-800">¥{fmt(tipAmt)}</span></div>
                <div className="flex justify-between"><span className="font-semibold text-slate-500">SETTLE AMT:</span><span className="font-bold text-slate-800">¥{fmt(amt)}</span></div>
              </div>

              <button
                disabled={!picked || amt <= 0}
                onClick={handleSaveEntry}
                className="mt-3 w-full rounded-xl py-3 text-white text-base font-extrabold transition-transform active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
                style={{ background: C.orange }}
              >
                {editingId ? "UPDATE" : "ADD"} ¥{fmt(amt + tipAmt)}
              </button>

              <button
                disabled={!canSettle}
                onClick={handleSettle}
                className="mt-2 w-full rounded-xl py-3 text-white text-base font-extrabold flex flex-col items-center transition-transform active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
                style={{ background: "#1D4ED8" }}
              >
                <span className="flex items-center gap-2"><Printer size={16} /> SETTLE &amp; PRINT</span>
                <span className="text-[11px] font-semibold opacity-80">
                  ({entries.map((e) => e.methodLabel).join(", ") || "no payment yet"})
                </span>
              </button>

              <div className="mt-2 grid grid-cols-3 gap-2">
                <KeyBtn variant="ghost" onClick={picked ? backspace : onClose}>BACK</KeyBtn>
                <KeyBtn variant="ghost" onClick={resetEntry}>CLEAR</KeyBtn>
                <KeyBtn variant="ghost" onClick={() => setEntries([])} className="!text-[11px] leading-tight">REGENERATE BILL</KeyBtn>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-3 border-t border-slate-100 bg-white">
        <Button variant="secondary">Switch Screen</Button>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={onClose}>Exit</Button>
          <Button disabled={!canSettle} onClick={handleSettle}>
            <Printer size={16} /> Settle &amp; Print
          </Button>
        </div>
      </div>

      {confirmingHold && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <div className="flex items-center gap-2.5 mb-2">
              <PauseCircle size={18} className="text-amber-500" />
              <h3 className="font-bold text-slate-800">Put bill on hold?</h3>
            </div>
            <p className="text-sm text-slate-500 mb-5">The bill will remain unsettled and can be resumed later from the Settlement List.</p>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirmingHold(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleConfirmHold}>Confirm</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ViewBillModal({ bill, onClose, onSettle }) {
  if (!bill) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-[2px] p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col animate-[slideUp_.2s_ease-out]">
        <div className="flex items-center justify-between px-5 sm:px-6 pt-5 pb-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="font-bold text-slate-800 text-lg">Bill #{bill.bill}</h3>
            <p className="text-xs text-slate-400">{bill.outlet}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 sm:px-6 py-4 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <SettlementStatusBadge status={bill.status} />
            <span className="text-xs text-slate-400">Ref# {bill.ref}</span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-400">{bill.table}</span>
          </div>

          <div className="space-y-2">
            {bill.items.map((it, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-slate-600">{it.qty} × {it.name}</span>
                <span className="font-medium text-slate-800">¥{(it.qty * it.price).toLocaleString()}</span>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="font-semibold text-slate-700">Total</span>
            <span className="text-xl font-extrabold text-slate-900">¥{bill.amount.toLocaleString()}</span>
          </div>

          {bill.status === "SETTLED" && bill.payment && (
            <div className="text-xs text-slate-400">Paid via {bill.payment}</div>
          )}
        </div>

        <div className="px-5 sm:px-6 py-4 border-t border-slate-100 shrink-0">
          {bill.status === "PENDING" ? (
            <Button className="w-full" onClick={() => onSettle(bill)}>
              <Wallet size={16} /> Settle Now
            </Button>
          ) : (
            <Button variant="secondary" className="w-full" onClick={onClose}>Close</Button>
          )}
        </div>
      </div>
    </div>
  );
}

function SettlementPage() {
  const [bills, setBills] = useState(SETTLEMENT_BILLS);
  const [search, setSearch] = useState("");
  const [viewBill, setViewBill] = useState(null);
  const [settleBill, setSettleBill] = useState(null);
  const [billOf, setBillOf] = useState("ALL");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bills.filter((b) => {
      if (billOf !== "ALL" && b.status !== billOf) return false;
      if (!q) return true;
      return (
        b.outlet.toLowerCase().includes(q) ||
        b.bill.toLowerCase().includes(q) ||
        b.ref.toLowerCase().includes(q) ||
        b.table.toLowerCase().includes(q)
      );
    });
  }, [bills, search, billOf]);

  const confirmSettlement = ({ billId, entries }) => {
    const paymentLabel = entries.map((e) => e.methodLabel).join(" + ") || "—";
    setBills((prev) => prev.map((b) => (b.id === billId ? { ...b, status: "SETTLED", payment: paymentLabel } : b)));
    setViewBill(null);
  };

  const holdBill = (id) => {
    setBills((prev) => prev.map((b) => (b.id === id ? { ...b, status: "PENDING" } : b)));
    setSettleBill(null);
  };

  return (
    <div className="pb-8">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-800">POS - Bill Settlement</h1>
        <p className="text-sm text-slate-400">Filter pending or settled bills and settle payments from here.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5 items-start">
        {/* Filter Bills */}
        <Card>
          <div className="flex items-start gap-2.5 mb-4">
            <Filter size={18} className="text-blue-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-slate-800">Filter Bills</h3>
              <p className="text-xs text-slate-400">All the fields marked with an asterisk (*) are mandatory.</p>
            </div>
          </div>

          <div className="space-y-3.5">
            <Field label={<>Outlet <span className="text-red-500">*</span></>}>
              <div className={`${inputCls} flex items-center justify-between`}>
                <span className="truncate">Indian Restaurant Vishnu Express Kurume</span>
                <X size={14} className="text-slate-400 shrink-0 ml-2" />
              </div>
            </Field>
            <Field label={<>Settlement Of <span className="text-red-500">*</span></>}>
              <select className={inputCls} defaultValue="BILL">
                <option value="BILL">BILL</option>
                <option value="TABLE">TABLE</option>
                <option value="ORDER">ORDER</option>
              </select>
            </Field>
            <Field label={<>Bill Of <span className="text-red-500">*</span></>}>
              <select className={inputCls} value={billOf} onChange={(e) => setBillOf(e.target.value)}>
                <option value="ALL">ALL</option>
                <option value="PENDING">PENDING</option>
                <option value="SETTLED">SETTLED</option>
              </select>
            </Field>
          </div>

          <div className="flex justify-end gap-2.5 mt-5">
            <Button variant="secondary" onClick={() => { setBillOf("ALL"); setSearch(""); }}>Clear</Button>
            <Button>Search</Button>
          </div>
        </Card>

        {/* Settlement List */}
        <Card padded={false} className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-4 flex-wrap">
            <div className="flex items-center gap-2.5">
              <List size={18} className="text-blue-500" />
              <h3 className="font-bold text-slate-800">Settlement List</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Search:</span>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t border-b border-slate-100">
                  {["Outlet", "Bill#", "Ref#", "Bill Amount", "Table / Take Away", "Status", "Action"].map((h) => (
                    <th key={h} className="text-left text-slate-500 font-semibold text-xs uppercase tracking-wide px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700">{b.outlet}</td>
                    <td className="px-4 py-3 font-semibold" style={{ color: C.blue }}>{b.bill}</td>
                    <td className="px-4 py-3" style={{ color: C.blue }}>{b.ref}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">{b.amount.toLocaleString()}.00</td>
                    <td className="px-4 py-3 text-slate-600">{b.table}</td>
                    <td className="px-4 py-3"><SettlementStatusBadge status={b.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setViewBill(b)}
                          title="View bill"
                          className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => (b.status === "PENDING" ? setSettleBill(b) : setViewBill(b))}
                          title="Settle bill"
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ background: b.status === "PENDING" ? C.blueLight : "#F1F5F9", color: b.status === "PENDING" ? C.blue : "#94A3B8" }}
                        >
                          <ReceiptText size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">No bills match your filter.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {viewBill && (
        <ViewBillModal
          bill={viewBill}
          onClose={() => setViewBill(null)}
          onSettle={(b) => { setViewBill(null); setSettleBill(b); }}
        />
      )}
      {settleBill && (
        <BillSettlementModal
          bill={settleBill}
          onClose={() => setSettleBill(null)}
          onConfirm={confirmSettlement}
          onHold={holdBill}
        />
      )}
    </div>
  );
}

/* ---------------------------------- STORE REQUEST ---------------------------------- */
// Touching "Inventory" (Quick Action or sidebar nav) opens this module instead of a
// generic placeholder. It has two parts, toggled with the eye / pencil icons in the
// header — mirroring how the rest of Upcoming POS treats view vs. edit modes:
//   view mode   -> StoreRequestListPage  (browse existing requisitions)
//   insert mode -> StoreRequestFormPage  (raise a new requisition + add items)
const SUB_STORE_OPTIONS = ["AEON OMURA STORE", "MAIN STORE-HYAKUNEN PARK", "SUB STORE - KURUME"];
const REQUESTED_BY_OPTIONS = ["SUB STORE", "MAIN KITCHEN", "BAR", "HOUSEKEEPING"];

const STORE_REQUEST_ITEM_CATALOG = [
  { name: "PASTA PENNE (DIVELLA)", uom: "PACKET", group: "GROCERY", stock: 0 },
  { name: "BASMATI RICE", uom: "KG", group: "GROCERY", stock: 45 },
  { name: "OLIVE OIL (BERTOLLI)", uom: "BOTTLE", group: "GROCERY", stock: 12 },
  { name: "CHICKEN BREAST", uom: "KG", group: "MEAT & POULTRY", stock: 8 },
  { name: "MOZZARELLA CHEESE", uom: "KG", group: "DAIRY", stock: 3 },
  { name: "TOMATO KETCHUP (HEINZ)", uom: "BOTTLE", group: "GROCERY", stock: 20 },
];

const STORE_REQUESTS = [
  {
    id: 1, fiscalYear: "2082-2083", requisitionNo: 1, requisitionDate: "21/06/2026",
    reqByCostCenter: "MAIN KITCHEN", reqBySubStore: "—", storeSubStore: "MAIN STORE-HYAKUNEN PARK",
    approvalLevel: "N/A", approvedBy: "—", approvedOn: "—", isUsed: "NOT USED",
    issueIndentNo: "—", isPurged: "NO", updatedBy: "ADMIN", updatedOn: "30/07/2026 | 13:41:16",
    createdBy: "ADMIN", createdOn: "30/07/2026 | 13:39:26",
  },
  {
    id: 2, fiscalYear: "2082-2083", requisitionNo: 2, requisitionDate: "22/06/2026",
    reqByCostCenter: "BAR", reqBySubStore: "—", storeSubStore: "AEON OMURA STORE",
    approvalLevel: "LEVEL 1", approvedBy: "RANJAN", approvedOn: "22/06/2026 | 09:12:04", isUsed: "PARTIALLY USED",
    issueIndentNo: "IND-1042", isPurged: "NO", updatedBy: "RANJAN", updatedOn: "22/06/2026 | 09:12:04",
    createdBy: "ADMIN", createdOn: "21/06/2026 | 18:02:51",
  },
];

const STORE_REQUEST_LIST_COLS = [
  "Fiscal Year", "Requisition #", "Requisition Date", "Req By Cost Center", "Req By Sub Store",
  "Store/Sub Store", "Approval Level", "Approved By", "Approved On", "Is Used",
  "Issue Indent #", "Is Purged", "Updated By", "Updated On", "Created By", "Created On",
];

const STORE_REQUEST_USED_TINT = { "NOT USED": "#B45309", "PARTIALLY USED": C.blue, "USED": "#15803D" };

function StoreRequestListPage({ requests, onOpenNew }) {
  const [search, setSearch] = useState("");
  const [fiscalYear, setFiscalYear] = useState("2082-2083");
  const [isUsedFilter, setIsUsedFilter] = useState("All");

  const filtered = requests.filter((r) => {
    if (fiscalYear !== "All" && r.fiscalYear !== fiscalYear) return false;
    if (isUsedFilter !== "All" && r.isUsed !== isUsedFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !String(r.requisitionNo).includes(q) &&
        !r.reqByCostCenter.toLowerCase().includes(q) &&
        !r.storeSubStore.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Button size="sm"><Search size={14} /> Search</Button>
          <Button variant="secondary" size="sm" onClick={() => { setSearch(""); setFiscalYear("2082-2083"); setIsUsedFilter("All"); }}>
            <RotateCw size={14} className="rotate-45" /> Clear
          </Button>
          <Button variant="secondary" size="sm"><RotateCw size={14} /> Sync</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search requisition, store..."
              className="border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
            />
          </div>
          <Button size="sm" onClick={onOpenNew}><Plus size={14} /> New Request</Button>
        </div>
      </div>

      {/* Compact column filter bar — mirrors the highlighted filter row in the source report */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <select value={fiscalYear} onChange={(e) => setFiscalYear(e.target.value)} className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
          <option>All</option>
          <option>2082-2083</option>
          <option>2081-2082</option>
        </select>
        <select value={isUsedFilter} onChange={(e) => setIsUsedFilter(e.target.value)} className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
          <option>All</option>
          <option>NOT USED</option>
          <option>PARTIALLY USED</option>
          <option>USED</option>
        </select>
      </div>

      <Card padded={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                {STORE_REQUEST_LIST_COLS.map((h) => (
                  <th key={h} className="text-left text-slate-500 font-semibold text-xs uppercase tracking-wide px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{r.fiscalYear}</td>
                  <td className="px-4 py-3 font-semibold whitespace-nowrap" style={{ color: C.blue }}>{r.requisitionNo}</td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{r.requisitionDate}</td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{r.reqByCostCenter}</td>
                  <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{r.reqBySubStore}</td>
                  <td className="px-4 py-3 font-medium whitespace-nowrap" style={{ color: C.green }}>{r.storeSubStore}</td>
                  <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{r.approvalLevel}</td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{r.approvedBy}</td>
                  <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{r.approvedOn}</td>
                  <td className="px-4 py-3 font-semibold whitespace-nowrap" style={{ color: STORE_REQUEST_USED_TINT[r.isUsed] || "#64748B" }}>{r.isUsed}</td>
                  <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{r.issueIndentNo}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">{r.isPurged}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{r.updatedBy}</td>
                  <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{r.updatedOn}</td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{r.createdBy}</td>
                  <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{r.createdOn}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={STORE_REQUEST_LIST_COLS.length} className="px-4 py-10 text-center text-sm text-slate-400">No store requests match your filter.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-slate-100 text-xs text-slate-400">
          <span>Total Rows: <span className="font-semibold text-slate-600">{filtered.length}</span> &nbsp;&nbsp; Page Number: <span className="font-semibold text-slate-600">1</span></span>
          <div className="flex items-center gap-2">
            <span>Total {filtered.length} Rows</span>
            <button className="px-3 py-1.5 rounded-lg border border-slate-200 flex items-center gap-1 text-slate-400 cursor-not-allowed">
              <ChevronLeft size={13} /> Prev
            </button>
            <button className="px-3 py-1.5 rounded-lg text-white flex items-center gap-1" style={{ background: C.blue }}>
              Next <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function StoreRequestFormPage({ onSubmit }) {
  const [requestedBy, setRequestedBy] = useState(REQUESTED_BY_OPTIONS[0]);
  const [subStore, setSubStore] = useState(SUB_STORE_OPTIONS[0]);
  const [remarks, setRemarks] = useState("");

  const [form, setForm] = useState({
    storeType: "STORE",
    storeSubStore: SUB_STORE_OPTIONS[1],
    itemName: "",
    uom: "",
    itemGroup: "",
    currentStock: "",
    quantity: "",
    requiredDate: "",
  });
  const [qtyError, setQtyError] = useState(false);
  const [items, setItems] = useState([]);
  const [listSearch, setListSearch] = useState("");

  const selectItem = (name) => {
    const found = STORE_REQUEST_ITEM_CATALOG.find((i) => i.name === name);
    setForm((f) => ({
      ...f,
      itemName: name,
      uom: found?.uom || "",
      itemGroup: found?.group || "",
      currentStock: found ? String(found.stock) : "",
    }));
  };

  const handleAddItem = () => {
    if (!form.quantity) { setQtyError(true); return; }
    if (!form.itemName) return;
    setQtyError(false);
    setItems((prev) => [...prev, { ...form, sno: prev.length + 1, requestedBy }]);
    setForm((f) => ({ ...f, itemName: "", uom: "", itemGroup: "", currentStock: "", quantity: "", requiredDate: "" }));
  };

  const handleClear = () => {
    setForm((f) => ({ ...f, itemName: "", uom: "", itemGroup: "", currentStock: "", quantity: "", requiredDate: "" }));
    setQtyError(false);
  };

  const removeItem = (sno) =>
    setItems((prev) => prev.filter((i) => i.sno !== sno).map((i, idx) => ({ ...i, sno: idx + 1 })));

  const handleSubmitRequest = () => {
    onSubmit && onSubmit({
      id: Date.now(),
      fiscalYear: "2082-2083",
      requisitionNo: Math.floor(Math.random() * 900) + 100,
      requisitionDate: "23/06/2026",
      reqByCostCenter: requestedBy,
      reqBySubStore: "—",
      storeSubStore: subStore,
      approvalLevel: "N/A",
      approvedBy: "—",
      approvedOn: "—",
      isUsed: "NOT USED",
      issueIndentNo: "—",
      isPurged: "NO",
      updatedBy: "ADMIN",
      updatedOn: "23/06/2026 | 10:00:00",
      createdBy: "ADMIN",
      createdOn: "23/06/2026 | 10:00:00",
    });
    setItems([]);
  };

  const filteredItems = items.filter((it) => !listSearch || it.itemName.toLowerCase().includes(listSearch.toLowerCase()));

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-start gap-2.5 mb-4">
          <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: C.blueLight }}>
            <Check size={13} color={C.blue} />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Primary Information</h3>
            <p className="text-xs text-slate-400">All the fields marked with an asterisk (*) are mandatory.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Field label={<>Requisition # <span className="text-red-500">*</span></>}>
            <input disabled placeholder="Auto Generated" className={`${inputCls} bg-slate-100 text-slate-400 cursor-not-allowed placeholder:text-slate-400`} />
          </Field>
          <Field label={<>Requisition Date <span className="text-red-500">*</span></>}>
            <input disabled value="23/06/2026" className={`${inputCls} bg-slate-100 text-slate-500 cursor-not-allowed`} readOnly />
          </Field>
          <Field label={<>Fiscal Year <span className="text-red-500">*</span></>}>
            <input disabled value="2082-2083" className={`${inputCls} bg-slate-100 text-slate-500 cursor-not-allowed`} readOnly />
          </Field>
          <Field label={<>Requested By <span className="text-red-500">*</span></>}>
            <select className={inputCls} value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)}>
              {REQUESTED_BY_OPTIONS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <Field label={<>Sub-Store/Cost Center <span className="text-red-500">*</span></>}>
            <select className={inputCls} value={subStore} onChange={(e) => setSubStore(e.target.value)}>
              {SUB_STORE_OPTIONS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Remarks">
            <input className={inputCls} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional remarks..." />
          </Field>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <div className="flex items-start gap-2.5 mb-4">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: C.blue }}>
              <Plus size={14} color="white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Add Items</h3>
              <p className="text-xs text-slate-400">All the fields marked with an asterisk (*) are mandatory.</p>
            </div>
          </div>
          <div className="space-y-4">
            <Field label={<>Store Type <span className="text-red-500">*</span></>}>
              <select className={inputCls} value={form.storeType} onChange={(e) => setForm((f) => ({ ...f, storeType: e.target.value }))}>
                <option>STORE</option>
                <option>SUB STORE</option>
              </select>
            </Field>
            <Field label={<>Store/Sub Store <span className="text-red-500">*</span></>}>
              <select className={inputCls} value={form.storeSubStore} onChange={(e) => setForm((f) => ({ ...f, storeSubStore: e.target.value }))}>
                {SUB_STORE_OPTIONS.map((o) => <option key={o}>{o}</option>)}
              </select>
            </Field>
            <Field
              label={
                <span className="inline-flex items-center gap-1.5">
                  Item Name <span className="text-red-500">*</span>
                  <span className="w-4 h-4 rounded-full flex items-center justify-center text-white" style={{ background: C.blue }} title="Quick add new item">
                    <Plus size={10} />
                  </span>
                </span>
              }
            >
              <select className={inputCls} value={form.itemName} onChange={(e) => selectItem(e.target.value)}>
                <option value="">Select item...</option>
                {STORE_REQUEST_ITEM_CATALOG.map((i) => <option key={i.name} value={i.name}>{i.name}</option>)}
              </select>
            </Field>
            <Field label={<>UOM <span className="text-red-500">*</span></>}>
              <input value={form.uom} readOnly placeholder="—" className={`${inputCls} bg-slate-100 text-slate-500 cursor-not-allowed`} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={<>Item Group <span className="text-red-500">*</span></>}>
                <input readOnly value={form.itemGroup} placeholder="—" className={`${inputCls} bg-slate-100 text-slate-500 cursor-not-allowed`} />
              </Field>
              <Field label={<>Current Stock <span className="text-red-500">*</span></>}>
                <input readOnly value={form.currentStock} placeholder="—" className={`${inputCls} bg-slate-100 text-slate-500 cursor-not-allowed`} />
              </Field>
            </div>
            <Field label={<>Quantity <span className="text-red-500">*</span></>}>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  value={form.quantity}
                  onChange={(e) => { setForm((f) => ({ ...f, quantity: e.target.value })); if (e.target.value) setQtyError(false); }}
                  className={`${inputCls} pr-9 ${qtyError ? "border-red-400 focus:ring-red-500/30 focus:border-red-400" : ""}`}
                />
                {qtyError && (
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center">
                    <AlertCircle size={13} />
                  </span>
                )}
              </div>
              {qtyError && <p className="text-xs text-red-500 mt-1">Please enter quantity.</p>}
            </Field>
            <Field label="Required Date">
              <input
                type="date"
                className={inputCls}
                value={form.requiredDate}
                onChange={(e) => setForm((f) => ({ ...f, requiredDate: e.target.value }))}
              />
            </Field>
          </div>
          <div className="flex gap-3 mt-5">
            <Button variant="secondary" className="flex-1" onClick={handleClear}>Clear</Button>
            <Button className="flex-1" onClick={handleAddItem}>Add Item</Button>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <List size={17} color={C.blue} />
              <h3 className="font-bold text-slate-800">Item Details List</h3>
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                placeholder="Search:"
                className="border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {["S.No", "Required Date", "Item Name", "UOM", "Requested Qty", "Current Stock", "Requested By", "Item Group", "Store/Sub Store", "Action"].map((h) => (
                    <th key={h} className="text-left text-slate-500 font-semibold text-xs uppercase tracking-wide px-3 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((it) => (
                  <tr key={it.sno} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-3 py-2.5 text-slate-500">{it.sno}</td>
                    <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{it.requiredDate || "—"}</td>
                    <td className="px-3 py-2.5 text-slate-700 font-medium whitespace-nowrap">{it.itemName}</td>
                    <td className="px-3 py-2.5 text-slate-500">{it.uom}</td>
                    <td className="px-3 py-2.5 text-slate-700 font-semibold">{it.quantity}</td>
                    <td className="px-3 py-2.5 text-slate-500">{it.currentStock}</td>
                    <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{it.requestedBy}</td>
                    <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{it.itemGroup}</td>
                    <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{it.storeSubStore}</td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => removeItem(it.sno)} className="w-7 h-7 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-3 py-10 text-center text-sm text-slate-400">
                      No items added yet — fill in the form on the left and click "Add Item".
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {items.length > 0 && (
            <div className="flex justify-end mt-4 pt-4 border-t border-slate-100">
              <Button onClick={handleSubmitRequest}><Send size={15} /> Submit Request</Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function StoreRequestPage() {
  const [mode, setMode] = useState("view"); // "view" -> list, "insert" -> new request form
  const [requests, setRequests] = useState(STORE_REQUESTS);

  const handleSubmitNew = (newReq) => {
    setRequests((prev) => [newReq, ...prev]);
    setMode("view");
  };

  return (
    <div className="pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.tealLight }}>
            <ClipboardList size={20} color={C.teal} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Store Request</h1>
            <p className="text-sm text-slate-400">
              {mode === "view" ? "Browse and track store requisitions." : "Raise a new store requisition and add items to it."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode("view")}
            title="View Store Requests"
            className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
            style={mode === "view" ? { background: C.blueLight, color: C.blue } : { background: "#F1F5F9", color: "#94A3B8" }}
          >
            <Eye size={16} />
          </button>
          <button
            onClick={() => setMode("insert")}
            title="New Store Request"
            className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
            style={mode === "insert" ? { background: C.blue, color: "white" } : { background: "#F1F5F9", color: "#94A3B8" }}
          >
            <Pencil size={16} />
          </button>
        </div>
      </div>

      {mode === "view" ? (
        <StoreRequestListPage requests={requests} onOpenNew={() => setMode("insert")} />
      ) : (
        <StoreRequestFormPage onSubmit={handleSubmitNew} />
      )}
    </div>
  );
}

/* ---------------------------------- STORE REQUEST REPORT ---------------------------------- */
const STORE_REQUEST_REPORT_ROWS = [
  { requester: "ADMIN", storeSubStore: "MAIN STORE-HYAKUNEN PARK", requisitionNo: 1, requisitionDate: "21/06/2026", itemName: "Pasta Penne (Divella)", itemGroup: "Grocery", uom: "Packet", requestedQty: 5, issuedQty: 5, balanceQty: 0 },
  { requester: "ADMIN", storeSubStore: "MAIN STORE-HYAKUNEN PARK", requisitionNo: 1, requisitionDate: "21/06/2026", itemName: "Basmati Rice", itemGroup: "Grocery", uom: "Kg", requestedQty: 10, issuedQty: 8, balanceQty: 2 },
  { requester: "RANJAN", storeSubStore: "AEON OMURA STORE", requisitionNo: 2, requisitionDate: "22/06/2026", itemName: "Chicken Breast", itemGroup: "Meat & Poultry", uom: "Kg", requestedQty: 6, issuedQty: 6, balanceQty: 0 },
];

const STORE_REQUEST_REPORT_COLS = ["Store/Sub Store", "Requisition #", "Requisition Date", "Item Name", "Item Group", "UOM", "Requested Qty", "Issued Qty", "Balance Qty"];

function StoreRequestReportFilterDrawer({ open, onClose, onLoad }) {
  const [fiscalYear, setFiscalYear] = useState("2082-2083");
  const [searchBy, setSearchBy] = useState("TRANSACTION DATE");
  const [from, setFrom] = useState("17/07/2025");
  const [to, setTo] = useState("23/06/2026");
  const [requestedBy, setRequestedBy] = useState("All");
  const [reportBy, setReportBy] = useState("ALL");
  const [filterBy, setFilterBy] = useState("REQUISITION #");
  const [reqFilterValue, setReqFilterValue] = useState("All");
  const [groupBy, setGroupBy] = useState("REQUESTED BY");
  const [pendingOnly, setPendingOnly] = useState("YES");
  const [include, setInclude] = useState("ALL");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="w-full sm:w-[360px] bg-white h-full shadow-2xl overflow-y-auto p-5 animate-[slideUp_.2s_ease-out]">
        <h3 className="font-bold text-slate-800 text-lg mb-1">Filter - Store Request Report</h3>
        <p className="text-xs text-red-500 mb-4">All the fields marked with an asterisk (*) are mandatory.</p>
        <div className="space-y-4">
          <Field label={<>Fiscal Year <span className="text-red-500">*</span></>}>
            <select className={inputCls} value={fiscalYear} onChange={(e) => setFiscalYear(e.target.value)}>
              <option>2082-2083</option>
              <option>2081-2082</option>
            </select>
          </Field>
          <Field label={<>Search By <span className="text-red-500">*</span></>}>
            <select className={inputCls} value={searchBy} onChange={(e) => setSearchBy(e.target.value)}>
              <option>TRANSACTION DATE</option>
              <option>APPROVED DATE</option>
            </select>
          </Field>
          <Field label={<>From <span className="text-red-500">*</span></>}>
            <input className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label={<>To <span className="text-red-500">*</span></>}>
            <input className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label="Requested By">
            <select className={inputCls} value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)}>
              <option>All</option>
              {REQUESTED_BY_OPTIONS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Report By">
            <select className={inputCls} value={reportBy} onChange={(e) => setReportBy(e.target.value)}>
              <option>ALL</option>
              <option>OUTLET</option>
            </select>
          </Field>
          <Field label={<>Filter By <span className="text-red-500">*</span></>}>
            <select className={inputCls} value={filterBy} onChange={(e) => setFilterBy(e.target.value)}>
              <option>REQUISITION #</option>
              <option>ITEM NAME</option>
            </select>
          </Field>
          <Field label="Requisition #/Requested By">
            <select className={inputCls} value={reqFilterValue} onChange={(e) => setReqFilterValue(e.target.value)}>
              <option>All</option>
            </select>
          </Field>
          <Field label={<>Group By <span className="text-red-500">*</span></>}>
            <select className={inputCls} value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
              <option>REQUESTED BY</option>
              <option>STORE/SUB STORE</option>
              <option>ITEM GROUP</option>
            </select>
          </Field>
          <Field label={<>Pending Only <span className="text-red-500">*</span></>}>
            <select className={inputCls} value={pendingOnly} onChange={(e) => setPendingOnly(e.target.value)}>
              <option>YES</option>
              <option>NO</option>
            </select>
          </Field>
          <Field label="Include">
            <select className={inputCls} value={include} onChange={(e) => setInclude(e.target.value)}>
              <option>ALL</option>
              <option>PURGED</option>
            </select>
          </Field>
        </div>
        <div className="flex gap-3 mt-6">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Exit</Button>
          <Button className="flex-1" onClick={() => onLoad({ groupBy })}>Load Report</Button>
        </div>
      </div>
      <div className="flex-1 bg-slate-900/30 backdrop-blur-[1px]" onClick={onClose} />
    </div>
  );
}

function StoreRequestReportPage() {
  const [filterOpen, setFilterOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [groupBy, setGroupBy] = useState("REQUESTED BY");

  const groups = useMemo(() => {
    const map = new Map();
    STORE_REQUEST_REPORT_ROWS.forEach((r) => {
      if (!map.has(r.requester)) map.set(r.requester, []);
      map.get(r.requester).push(r);
    });
    return Array.from(map.entries());
  }, []);

  const grandTotal = STORE_REQUEST_REPORT_ROWS.reduce(
    (acc, r) => ({
      requestedQty: acc.requestedQty + r.requestedQty,
      issuedQty: acc.issuedQty + r.issuedQty,
      balanceQty: acc.balanceQty + r.balanceQty,
    }),
    { requestedQty: 0, issuedQty: 0, balanceQty: 0 }
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <p className="text-sm text-slate-400">Store requisition activity{loaded ? ` grouped by ${groupBy.toLowerCase()}` : ""}.</p>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setFilterOpen(true)}><Filter size={14} /> Filters</Button>
          <Button variant="secondary" size="sm"><Printer size={14} /> Print</Button>
          <Button size="sm"><FileSpreadsheet size={14} /> Export Excel</Button>
        </div>
      </div>

      {!loaded ? (
        <Card className="text-center py-16">
          <Filter size={28} className="mx-auto mb-3 text-slate-300" />
          <h3 className="font-bold text-slate-700">No report loaded yet</h3>
          <p className="text-sm text-slate-400 mt-1 mb-4">Set your filters and load the Store Request report.</p>
          <Button onClick={() => setFilterOpen(true)}><Filter size={15} /> Open Filters</Button>
        </Card>
      ) : (
        <Card padded={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: C.tableHead }}>
                  {STORE_REQUEST_REPORT_COLS.map((h) => (
                    <th key={h} className="text-left text-white font-semibold px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map(([requester, rows]) => (
                  <React.Fragment key={requester}>
                    <tr className="bg-slate-50">
                      <td colSpan={STORE_REQUEST_REPORT_COLS.length} className="px-4 py-2 font-bold text-slate-600 text-xs uppercase tracking-wide">{requester}</td>
                    </tr>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-medium" style={{ color: C.green }}>{r.storeSubStore}</td>
                        <td className="px-4 py-2.5 font-semibold" style={{ color: C.blue }}>{r.requisitionNo}</td>
                        <td className="px-4 py-2.5 text-slate-500">{r.requisitionDate}</td>
                        <td className="px-4 py-2.5 text-slate-700">{r.itemName}</td>
                        <td className="px-4 py-2.5 text-slate-500">{r.itemGroup}</td>
                        <td className="px-4 py-2.5 text-slate-500">{r.uom}</td>
                        <td className="px-4 py-2.5 text-right text-slate-700">{r.requestedQty.toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-right text-slate-700">{r.issuedQty.toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-slate-800">{r.balanceQty.toFixed(2)}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
                <tr className="border-t-2 border-slate-200">
                  <td colSpan={6} className="px-4 py-3 font-bold text-slate-700 text-right">TOTAL</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">{grandTotal.requestedQty.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">{grandTotal.issuedQty.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">{grandTotal.balanceQty.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <StoreRequestReportFilterDrawer
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        onLoad={({ groupBy: g }) => { setGroupBy(g); setLoaded(true); setFilterOpen(false); }}
      />
    </div>
  );
}

const REPORT_TABS = [
  { id: "shift-close", label: "Shift Close Report", icon: FileText },
  { id: "store-request", label: "Store Request Report", icon: ClipboardList },
  { id: "event-reservation", label: "Event Reservation Report", icon: PartyPopper },
];

function ReportsPage() {
  const [tab, setTab] = useState("shift-close");
  return (
    <div className="pb-8">
      <div className="flex bg-slate-100 rounded-xl p-1 text-sm font-semibold mb-5 w-fit">
        {REPORT_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg transition-colors"
            style={tab === t.id ? { background: "#0F172A", color: "white" } : { color: "#64748B" }}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>
      {tab === "shift-close" && <ShiftCloseReportPage />}
      {tab === "store-request" && <StoreRequestReportPage />}
      {tab === "event-reservation" && <EventReservationReport />}
    </div>
  );
}

/* ---------------------------------- EMPTY STATE / PLACEHOLDER PAGES ---------------------------------- */
// Shared empty-state layout so every "not built yet" page (generic modules, Takeaway,
// Delivery) looks and feels consistent with the rest of Upcoming POS.
function EmptyStatePage({ icon: Icon, iconColor = C.green, iconBg = C.greenLight, title, description, actionLabel, onAction }) {
  return (
    <div className="h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: iconBg }}>
        <Icon size={28} color={iconColor} />
      </div>
      <h2 className="text-lg font-bold text-slate-800">{title}</h2>
      <p className="text-sm text-slate-400 mt-1 max-w-xs">{description}</p>
      {actionLabel && (
        <Button className="mt-5" onClick={onAction}>
          <Plus size={16} /> {actionLabel}
        </Button>
      )}
    </div>
  );
}

function Placeholder({ id }) {
  const item = NAV_ITEMS.find((n) => n.id === id) || { label: "Module", icon: Grid3x3 };
  return (
    <EmptyStatePage
      icon={item.icon}
      title={item.label}
      description="This module follows the same design system — cards, tables, and forms consistent with Dashboard and Shift Management."
    />
  );
}

/* ---------------------------------- OFF-PREMISE ORDER LISTS (Takeaway / Delivery / Event) ----------------------------------
   Takeaway, Delivery & Event all skip table assignment entirely, so instead of the Table List they
   land here first: a running list of orders of that type. "New Order" (or tapping an existing card)
   hands off to the very same Touch Order Screen used for dine-in tables — just pre-set to that
   Order Type, which is also what drives the dual tax-rate resolution (see TAX_RULES above). */
const TAKEAWAY_ORDERS = [
  { id: "IRVEK-TA-0000002", guest: null, company: null, time: "3 hrs ago" },
];

const DELIVERY_ORDERS = [
  { id: "IRVEK-DL-0000001", guest: "Uber Eats", company: null, time: "45 mins ago" },
];

const EVENT_ORDERS = [
  { id: "IRVEK-EV-0000001", guest: "Sato Wedding Party", company: "Sato Events Co.", time: "1 day ago" },
];

function OffPremiseOrderCard({ order, accentColor, onOpen, isMenuOpen, onToggleMenu }) {
  return (
    <div className="relative">
      <Card
        padded={false}
        onClick={() => onOpen(order)}
        className="flex items-center gap-3 sm:gap-4 pl-5 pr-3 sm:pr-4 py-4 cursor-pointer border-l-4 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-150"
        style={{ borderLeftColor: accentColor }}
      >
        <div className="min-w-0 flex-1">
          <div className="font-bold text-slate-800 text-[15px] truncate">{order.id}</div>
          <div className="text-sm text-slate-400 italic truncate">Guest Name: {order.guest || "N/A"}</div>
          <div className="text-sm text-slate-400 italic truncate">Company Name: {order.company || "N/A"}</div>
        </div>
        <div className="hidden sm:block text-sm text-slate-500 shrink-0">Time: {order.time}</div>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleMenu(order.id); }}
          className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 shrink-0"
        >
          <MoreVertical size={16} />
        </button>
      </Card>

      {isMenuOpen && (
        <div
          className="absolute z-20 top-14 right-3 sm:right-4 w-52 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={() => onOpen(order)} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 text-left">
            <Eye size={16} className="text-slate-400 shrink-0" /> View / Continue Order
          </button>
          <button className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 text-left">
            <Printer size={16} className="text-slate-400 shrink-0" /> Print Bill
          </button>
        </div>
      )}
    </div>
  );
}

function OffPremiseOrdersPage({ icon: Icon, iconColor, iconBg, accentColor, title, description, orders, onNewOrder, onOpenOrder }) {
  const [search, setSearch] = useState("");
  const [openMenu, setOpenMenu] = useState(null);

  const filtered = orders.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return o.id.toLowerCase().includes(q) || (o.guest || "").toLowerCase().includes(q) || (o.company || "").toLowerCase().includes(q);
  });

  return (
    <div className="pb-8" onClick={() => openMenu && setOpenMenu(null)}>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: iconBg }}>
            <Icon size={20} color={iconColor} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">{title}</h1>
            <p className="text-sm text-slate-400">{description}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 bg-white">
            <Search size={15} className="text-slate-400 shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Orders..."
              className="text-sm outline-none w-40 sm:w-56 placeholder:text-slate-400"
            />
          </div>
          <Button onClick={onNewOrder}>
            <Plus size={16} /> New Order
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center text-slate-400 text-sm py-16">
          {orders.length === 0 ? "No orders yet — tap \"New Order\" to create the first one." : "No orders match your search."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => (
            <OffPremiseOrderCard
              key={o.id}
              order={o}
              accentColor={accentColor}
              onOpen={onOpenOrder}
              isMenuOpen={openMenu === o.id}
              onToggleMenu={(id) => setOpenMenu((cur) => (cur === id ? null : id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TakeawayOrderPage({ onNewOrder, onOpenOrder }) {
  return (
    <OffPremiseOrdersPage
      icon={Truck}
      iconColor={C.red}
      iconBg={C.redLight}
      accentColor={C.red}
      title="Take Away Orders"
      description="Orders for take away are displayed here."
      orders={TAKEAWAY_ORDERS}
      onNewOrder={onNewOrder}
      onOpenOrder={onOpenOrder}
    />
  );
}

function DeliveryOrderPage({ onNewOrder, onOpenOrder }) {
  return (
    <OffPremiseOrdersPage
      icon={Truck}
      iconColor={C.indigo}
      iconBg={C.indigoLight}
      accentColor={C.indigo}
      title="Delivery Orders"
      description="Orders for delivery — Uber Eats, Demaecan, and others — are displayed here."
      orders={DELIVERY_ORDERS}
      onNewOrder={onNewOrder}
      onOpenOrder={onOpenOrder}
    />
  );
}

function EventOrderPage({ onNewOrder, onOpenOrder }) {
  return (
    <OffPremiseOrdersPage
      icon={PartyPopper}
      iconColor={C.pink}
      iconBg={C.pinkLight}
      accentColor={C.pink}
      title="Event Orders"
      description="Orders for banquets, functions, and catered events are displayed here."
      orders={EVENT_ORDERS}
      onNewOrder={onNewOrder}
      onOpenOrder={onOpenOrder}
    />
  );
}

/* ------------------------- KITCHEN DISPLAY SYSTEM ------------------------- */
// Full-screen KDS board modelled on the reference kitchen terminal: a grid of
// order tickets (table no. + time + item lines with their selected options),
// a "Completed" action on the focused ticket, and a strip of table chips at the
// bottom for jumping between tickets. Touching a ticket redirects into that
// table's Take Order screen.
const KDS_TICKETS = [
  {
    table: "13", time: "12:51", status: "new", covers: 2,
    items: [
      { name: "Ladies' set", opts: ["Medium spice", "Herb butter naan", "Lassi", "Serve together"] },
    ],
  },
  {
    table: "02", time: "12:51", status: "cooking", covers: 3,
    items: [{ name: "A Lunch", opts: ["Medium spice", "Herb butter naan", "Lassi"] }],
  },
  {
    table: "01", time: "12:51", status: "cooking", covers: 1,
    items: [{ name: "A Lunch", opts: ["Medium spice", "Plain naan"] }],
  },
  {
    table: "14", time: "12:51", status: "new", covers: 4,
    items: [{ name: "A Lunch", opts: ["Medium spice", "Herb butter naan", "Lassi", "Serve together"] }],
  },
  {
    table: "17", time: "12:52", status: "cooking", covers: 2,
    items: [{ name: "A Lunch", opts: ["Medium spice", "Plain naan", "House original dressing"] }],
  },
  {
    table: "18", time: "12:53", status: "new", covers: 2,
    items: [{ name: "A Lunch", opts: ["Medium spice", "Plain naan", "House original dressing"] }],
  },
  {
    table: "05", time: "12:55", status: "cooking", covers: 5,
    items: [{ name: "Chicken Tikka", opts: ["Extra spicy", "No onion"] }, { name: "Momo", opts: ["Steamed"] }],
  },
  {
    table: "09", time: "12:58", status: "new", covers: 2,
    items: [{ name: "Butter Chicken", opts: ["Mild", "Garlic naan"] }],
  },
];

const KDS_CHIPS = ["01", "02", "13", "14", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "15", "16", "17", "18"];

function KitchenDisplayPage({ onExit, onOpenTable }) {
  const [tickets, setTickets] = useState(KDS_TICKETS);
  const [focus, setFocus] = useState(KDS_TICKETS[0].table);
  const [outlet, setOutlet] = useState("Not set");

  const activeTables = tickets.map((t) => t.table);
  const complete = (table) => setTickets((list) => list.filter((t) => t.table !== table));

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F1F5F9" }}>
      {/* Terminal header */}
      <header className="h-14 shrink-0 bg-white border-b border-slate-200 flex items-center gap-3 px-3 sm:px-4">
        <button onClick={onExit} className="p-2 rounded-lg hover:bg-slate-100" title="Exit Kitchen Display">
          <Menu size={20} className="text-slate-700" />
        </button>
        <select
          value={outlet}
          onChange={(e) => setOutlet(e.target.value)}
          className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none"
        >
          <option>Not set</option>
          <option>Main Outlet</option>
          <option>Rooftop</option>
        </select>
        <div className="ml-auto flex items-center gap-1">
          <span className="hidden sm:inline text-[11px] text-slate-400 mr-2">
            {tickets.length} live tickets
          </span>
          <button className="p-2 rounded-lg hover:bg-slate-100" title="Settings"><Settings size={18} className="text-slate-600" /></button>
          <button className="p-2 rounded-lg hover:bg-slate-100" title="Print"><Printer size={18} className="text-slate-600" /></button>
          <button onClick={() => setTickets(KDS_TICKETS)} className="p-2 rounded-lg hover:bg-slate-100" title="Refresh">
            <RotateCw size={18} className="text-slate-600" />
          </button>
        </div>
      </header>

      {/* Ticket board */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-4">
        {tickets.length === 0 ? (
          <div className="h-full min-h-[50vh] flex flex-col items-center justify-center text-slate-400 gap-2">
            <CheckCircle2 size={40} />
            <div className="text-sm font-medium">All tickets completed</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {tickets.map((t) => {
              const isFocus = focus === t.table;
              return (
                <div
                  key={t.table}
                  onClick={() => {
                    setFocus(t.table);
                    onOpenTable && onOpenTable(t);
                  }}
                  className={`cursor-pointer select-none rounded-xl border bg-white overflow-hidden transition-all active:scale-[0.98] ${
                    isFocus ? "shadow-md" : "shadow-sm hover:shadow-md"
                  }`}
                  style={{ borderColor: isFocus ? C.green : "#E2E8F0" }}
                >
                  {/* Ticket head */}
                  <div
                    className="flex items-center justify-between px-2.5 py-1.5"
                    style={{ background: t.status === "new" ? C.green : "#F8FAFC" }}
                  >
                    <span
                      className="text-[13px] font-black tracking-tight"
                      style={{ color: t.status === "new" ? "#fff" : "#0F172A" }}
                    >
                      {t.table}
                    </span>
                    <span
                      className="text-[11px] font-semibold"
                      style={{ color: t.status === "new" ? "rgba(255,255,255,.85)" : "#94A3B8" }}
                    >
                      {t.time}
                    </span>
                  </div>

                  {/* Ticket body */}
                  <div className="p-2.5 space-y-2">
                    {t.items.map((it, i) => (
                      <div key={i}>
                        <div className="text-[13px] font-bold text-slate-800 leading-tight">{it.name}</div>
                        <ul className="mt-1 space-y-0.5">
                          {it.opts.map((o) => (
                            <li key={o} className="text-[11px] leading-tight" style={{ color: C.orange }}>
                              {o}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                    <div className="pt-1 text-[10px] text-slate-400">{t.covers} covers</div>
                  </div>

                  {/* Completed */}
                  {isFocus && (
                    <div className="px-2.5 pb-2.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); complete(t.table); }}
                        className="w-full h-9 rounded-lg text-white text-[12px] font-bold active:scale-[0.98] transition"
                        style={{ background: C.green }}
                      >
                        Completed
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Table chip strip */}
      <footer className="shrink-0 bg-white border-t border-slate-200 px-3 sm:px-4 py-2.5">
        <div className="flex flex-wrap gap-2">
          {KDS_CHIPS.map((n) => {
            const live = activeTables.includes(n);
            return (
              <button
                key={n}
                onClick={() => {
                  setFocus(n);
                  const t = tickets.find((x) => x.table === n);
                  if (t) onOpenTable && onOpenTable(t);
                }}
                className="w-10 h-10 rounded-full text-[12px] font-bold flex items-center justify-center border transition"
                style={
                  live
                    ? { background: C.green, color: "#fff", borderColor: C.green }
                    : { background: "#fff", color: "#94A3B8", borderColor: "#E2E8F0" }
                }
              >
                {n}
              </button>
            );
          })}
        </div>
      </footer>
    </div>
  );
}

/* ---------------------------------- BILL REPRINT ---------------------------------- */
const REPRINT_RANGES = ["Today", "Yesterday", "Last 7 Days", "Last 30 Days", "Custom Range"];
const REPRINT_OF_OPTIONS = ["BILL", "Invoice", "Order Ticket", "Settlement Receipt"];
const REPRINT_OUTLETS = [
  "INDIAN RESTAURANT VISHNU EXPRESS KURUME",
  "UPCOMING Restaurant — Main Outlet",
  "UPCOMING Restaurant — Station Branch",
];

const REPRINT_BILLS = [
  { id: "8283-32", amount: 550.0, date: "26/06/2026", ref: "IRVEK8283-11", terminal: "T1", mode: "Takeaway", subTotal: 500.0, discount: 0.0, taxable: 384.62, vat: 50.0, printed: true },
  { id: "8283-31", amount: 550.0, date: "26/06/2026", ref: "IRVEK8283-11", terminal: "T1", mode: "Takeaway", subTotal: 500.0, discount: 0.0, taxable: 384.62, vat: 50.0, printed: true },
  { id: "8283-30", amount: 550.0, date: "26/06/2026", ref: "IRVEK8283-10", terminal: "T1", mode: "Dine-in", subTotal: 500.0, discount: 0.0, taxable: 384.62, vat: 50.0, printed: true },
  { id: "8283-29", amount: 1280.0, date: "25/06/2026", ref: "IRVEK8283-09", terminal: "T2", mode: "Dine-in", subTotal: 1163.64, discount: 20.0, taxable: 896.31, vat: 116.36, printed: false },
  { id: "8283-28", amount: 430.0, date: "25/06/2026", ref: "IRVEK8283-08", terminal: "T1", mode: "Delivery", subTotal: 390.91, discount: 0.0, taxable: 300.7, vat: 39.09, printed: true },
  { id: "8283-27", amount: 2650.0, date: "25/06/2026", ref: "IRVEK8283-07", terminal: "T3", mode: "Event", subTotal: 2409.09, discount: 100.0, taxable: 1853.15, vat: 240.91, printed: true },
];

function PrintedTag({ printed }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide"
      style={printed ? { background: C.greenLight, color: C.green } : { background: C.orangeLight, color: C.orange }}
    >
      <CircleDot size={10} /> {printed ? "PRINTED" : "NOT PRINTED"}
    </span>
  );
}

function ReprintRow({ label, value, strong }) {
  return (
    <div className="flex items-center justify-between gap-3 py-[3px]">
      <span className="text-[11px] text-slate-400">{label}</span>
      <span className={`text-[11px] text-right ${strong ? "font-bold text-slate-800" : "text-slate-600"}`}>{value}</span>
    </div>
  );
}

function BillReprintCard({ bill, onView, onReprint }) {
  return (
    <Card padded={false} className="overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-100 bg-slate-50/70">
        <span className="font-bold text-slate-800 text-[13px]">Bill #{bill.id}</span>
        <span className="font-extrabold text-[13px]" style={{ color: C.green }}>¥{bill.amount.toFixed(2)}</span>
      </div>
      <div className="px-4 py-3">
        <ReprintRow label="Date" value={bill.date} />
        <ReprintRow label="Ref" value={bill.ref} />
        <ReprintRow label={bill.terminal} value={bill.mode} />
        <ReprintRow label="Taxable Amt" value={bill.taxable.toFixed(2)} strong />
        <div className="flex items-center justify-between gap-3 pt-1.5">
          <span className="text-[11px] text-slate-400">Printed Status</span>
          <PrintedTag printed={bill.printed} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 px-3 pb-3">
        <Button variant="secondary" size="sm" onClick={() => onView(bill)}>
          <Eye size={13} /> View Bill
        </Button>
        <Button size="sm" onClick={() => onReprint(bill)}>
          <Printer size={13} /> RePrint Bill
        </Button>
      </div>
    </Card>
  );
}

function BillPreviewModal({ bill, outlet, onClose, onReprint }) {
  if (!bill) return null;
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={onClose}>
      <Card padded={false} className="w-full max-w-sm max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <span className="font-bold text-slate-800">Bill #{bill.id}</span>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4">
          <div className="text-center pb-3 border-b border-dashed border-slate-200">
            <div className="font-extrabold text-slate-800 text-sm">{outlet}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Tax Invoice · {bill.mode}</div>
          </div>
          <div className="py-3 border-b border-dashed border-slate-200">
            <ReprintRow label="Date" value={bill.date} />
            <ReprintRow label="Ref" value={bill.ref} />
            <ReprintRow label="Terminal" value={bill.terminal} />
          </div>
          <div className="py-3 border-b border-dashed border-slate-200">
            <ReprintRow label="Sub Total" value={bill.subTotal.toFixed(2)} />
            <ReprintRow label="Discount" value={bill.discount.toFixed(2)} />
            <ReprintRow label="Taxable Amt" value={bill.taxable.toFixed(2)} />
            <ReprintRow label="Vat Amt" value={bill.vat.toFixed(2)} />
          </div>
          <div className="flex items-center justify-between pt-3">
            <span className="font-bold text-slate-800 text-sm">Grand Total</span>
            <span className="font-extrabold text-lg" style={{ color: C.green }}>¥{bill.amount.toFixed(2)}</span>
          </div>
        </div>
        <div className="px-4 pb-4">
          <Button className="w-full" onClick={() => onReprint(bill)}>
            <Printer size={16} /> RePrint Bill
          </Button>
        </div>
      </Card>
    </div>
  );
}

function BillReprintPage() {
  const [outlet, setOutlet] = useState(REPRINT_OUTLETS[0]);
  const [reprintOf, setReprintOf] = useState(REPRINT_OF_OPTIONS[0]);
  const [range, setRange] = useState("Today");
  const [from, setFrom] = useState("2026-06-25");
  const [to, setTo] = useState("2026-06-26");
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState(null);
  const [toast, setToast] = useState("");

  const bills = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return REPRINT_BILLS;
    return REPRINT_BILLS.filter(
      (b) => b.id.toLowerCase().includes(q) || b.ref.toLowerCase().includes(q) || b.mode.toLowerCase().includes(q)
    );
  }, [search]);

  const handleReprint = (bill) => {
    setPreview(null);
    setToast(`Bill #${bill.id} sent to printer`);
    setTimeout(() => setToast(""), 2200);
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-start gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.greenLight }}>
            <ReceiptText size={17} color={C.green} />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Search For Bill RePrint</h3>
            <p className="text-xs text-slate-400 mt-0.5">All the fields marked with an asterisk (*) are mandatory.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          <div className="lg:col-span-2">
            <Field label="Outlet *">
              <select className={inputCls} value={outlet} onChange={(e) => setOutlet(e.target.value)}>
                {REPRINT_OUTLETS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Reprint Of *">
            <select className={inputCls} value={reprintOf} onChange={(e) => setReprintOf(e.target.value)}>
              {REPRINT_OF_OPTIONS.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </Field>
          <div className="flex items-end">
            <Button className="w-full">
              <Search size={15} /> Search
            </Button>
          </div>
        </div>

        {range === "Custom Range" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <Field label="From Date *">
              <input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="To Date *">
              <input type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mt-4">
          {REPRINT_RANGES.map((r) => {
            const isActive = range === r;
            return (
              <button
                key={r}
                onClick={() => setRange(r)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                style={
                  isActive
                    ? { background: C.greenLight, borderColor: C.green, color: C.green }
                    : { borderColor: "#E2E8F0", color: "#64748B" }
                }
              >
                <CalendarDays size={12} /> {r}
                {r === "Custom Range" && <ChevronDown size={12} />}
              </button>
            );
          })}
        </div>
      </Card>

      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Receipt size={16} color={C.green} />
            <h3 className="font-bold text-slate-800">Bill List</h3>
            <span className="text-xs text-slate-400">({bills.length})</span>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search bill or ref"
              className={`${inputCls} pl-9 w-full sm:w-64`}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 p-4">
          {bills.map((b) => (
            <BillReprintCard key={b.id} bill={b} onView={setPreview} onReprint={handleReprint} />
          ))}
        </div>

        <div className="hidden lg:block px-4 pb-4">
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: C.tableHead }} className="text-white text-left">
                  {["Outlet Name", "Order On", "Sub Total", "Discount", "Taxable Amt", "Vat Amt", "Grand Total", "Action"].map((h) => (
                    <th key={h} className="px-3 py-2.5 font-semibold text-xs whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bills.map((b) => (
                  <tr key={b.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2.5 text-slate-700 text-xs max-w-[220px] truncate">{outlet}</td>
                    <td className="px-3 py-2.5 text-slate-500 text-xs whitespace-nowrap">{b.terminal} · {b.date}</td>
                    <td className="px-3 py-2.5 text-slate-600 text-xs">{b.subTotal.toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-slate-600 text-xs">{b.discount.toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-slate-600 text-xs">{b.taxable.toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-slate-600 text-xs">{b.vat.toFixed(2)}</td>
                    <td className="px-3 py-2.5 font-bold text-slate-800 text-xs">{b.amount.toFixed(2)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1.5">
                        <Button variant="secondary" size="sm" onClick={() => setPreview(b)}>
                          <Eye size={12} /> View
                        </Button>
                        <Button size="sm" onClick={() => handleReprint(b)}>
                          <Printer size={12} /> RePrint
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-400 text-center mt-2">
            License Info · Mora M is rounded by <span style={{ color: C.blue }}>License Info</span>
          </p>
        </div>
      </Card>

      <BillPreviewModal bill={preview} outlet={outlet} onClose={() => setPreview(null)} onReprint={handleReprint} />

      {toast && (
        <div
          className="fixed bottom-24 lg:bottom-8 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-white text-sm font-medium shadow-lg flex items-center gap-2"
          style={{ background: C.green }}
        >
          <CheckCircle2 size={16} /> {toast}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- APP ---------------------------------- */
const HANDLED_PAGES = [
  "dashboard", "shift", "reports", "tables", "take-order", "orders", "settlement",
  "takeaway-order", "delivery-order", "event-order", "inventory", "kitchen", "bill-reprint", "customer-ordering",
  "promotions", "settings", "more",
];

// Order types that skip table assignment and hand off straight into the Touch Order screen.
const OFF_PREMISE_ACTIVE_BY_TYPE = { Takeaway: "takeaway-order", Delivery: "delivery-order", Event: "event-order" };
const OFF_PREMISE_ID_PREFIX = { Takeaway: "TA", Delivery: "DL", Event: "EV" };
// Every screen that can drop into the full-screen Touch Order view once an order/table is selected.
const TOUCH_ORDER_ACTIVES = ["take-order", "takeaway-order", "delivery-order", "event-order"];

export default function App() {
  return (
    <LanguageProvider>
      <NotificationProvider>
        <OrderStoreProvider>
          <PosDataProvider>
            <AppShell />
          </PosDataProvider>
        </OrderStoreProvider>
      </NotificationProvider>
    </LanguageProvider>
  );
}

function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [active, setActive] = useState("dashboard");
  const [selectedTable, setSelectedTable] = useState(null);
  const [outlet, setOutlet] = useState(OUTLETS[0]);
  const promo = usePromotions();

  const titleMap = {
    dashboard: "Dashboard",
    shift: "Shift Management",
    reports: "Reports",
    tables: "Table List",
    "take-order": "Self Service / Fastfood",
    orders: "Orders",
    settlement: "Bill Settlement",
    "takeaway-order": "Takeaway Order",
    "delivery-order": "Delivery Order",
    "event-order": "Event Order",
    inventory: "Store Request",
    kitchen: "Kitchen Display",
    "bill-reprint": "Bill RePrint",
    "customer-ordering": "Setup & Customer Ordering",
    promotions: "Discount & Loyalty",
    settings: "Settings",
  };

  // Picking a table from the Table List (or from an Order row) jumps straight into Take Order for that table.
  const goToTable = (table) => {
    setSelectedTable(table);
    setActive("take-order");
  };

  // Takeaway / Delivery / Event never assign a table — "New Order" (no `order` arg) mints a fresh
  // order number, and tapping an existing card on the list page reopens that same order. Either way
  // it lands in the same Touch Order screen, pre-set to the right Order Type for tax resolution.
  const goToOffPremiseOrder = (orderType, order) => {
    const chosen =
      order ||
      {
        id: `IRVEK-${OFF_PREMISE_ID_PREFIX[orderType]}-${String(Date.now()).slice(-7)}`,
        guest: null,
        company: null,
        time: "Just now",
      };
    setSelectedTable({ id: chosen.id, status: "Vacant", covers: "—", since: chosen.time, orderType });
    setActive(OFF_PREMISE_ACTIVE_BY_TYPE[orderType]);
  };

  // Once a table (or an off-premise order) is chosen, the Touch Order screen takes over the whole
  // viewport (kiosk-style, no sidebar/topnav) — matching the dedicated POS ordering UI. "DASHBOARD"
  // in its header exits back to the normal admin layout.
  if (active === "kitchen") {
    return (
      <KitchenDisplayPage
        onExit={() => setActive("dashboard")}
        onOpenTable={(ticket) =>
          goToTable({ id: `T${ticket.table}`, status: "Occupied", covers: ticket.covers, since: ticket.time })
        }
      />
    );
  }

  if (TOUCH_ORDER_ACTIVES.includes(active) && selectedTable) {
    return (
      <TouchOrderScreen
        table={selectedTable}
        initialOrderType={selectedTable.orderType || "Dine-in"}
        requireGeneralInfo={!selectedTable.orderType || selectedTable.orderType === "Dine-in"}
        onExit={(target) => {
          setSelectedTable(null);
          setActive(typeof target === "string" ? target : "dashboard");
        }}
      />
    );
  }

  return (
    <div className="flex min-h-screen" style={{ background: C.bg }}>
      <style>{`
        @keyframes slideUp { from { transform: translateY(24px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        * { font-family: 'Inter', system-ui, -apple-system, sans-serif; }
      `}</style>

      <Sidebar collapsed={collapsed} active={active} setActive={setActive} promotionsEnabled={promo.enabled} />
      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        active={active}
        setActive={setActive}
        outlet={outlet}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopNav
          onToggleSidebar={() => setCollapsed((c) => !c)}
          onOpenDrawer={() => setDrawerOpen(true)}
          outlet={outlet}
          setOutlet={setOutlet}
        />
        <main className="flex-1 px-4 sm:px-6 py-6 pb-24 lg:pb-6">
          {active === "dashboard" && <Dashboard setActive={setActive} />}
          {active === "shift" && <ShiftManagement />}
          {active === "reports" && <ReportsPage />}
          {active === "tables" && <TableListPage onSelectTable={goToTable} />}
          {active === "take-order" && <TableListPage onSelectTable={goToTable} />}
          {active === "orders" && <OrdersPage onOpenTable={goToTable} />}
          {active === "settlement" && <SettlementPage />}
          {active === "takeaway-order" && (
            <TakeawayOrderPage
              onNewOrder={() => goToOffPremiseOrder("Takeaway")}
              onOpenOrder={(o) => goToOffPremiseOrder("Takeaway", o)}
            />
          )}
          {active === "delivery-order" && (
            <DeliveryOrderPage
              onNewOrder={() => goToOffPremiseOrder("Delivery")}
              onOpenOrder={(o) => goToOffPremiseOrder("Delivery", o)}
            />
          )}
          {active === "event-order" && (
            <EventReservationPage
              onTakeOrder={(reservation) =>
                goToOffPremiseOrder("Event", {
                  id: `IRVEK-EV-${reservation.reservationNo}`,
                  guest: reservation.guest,
                  company: reservation.company,
                  time: reservation.eventFrom,
                  reservation,
                })
              }
            />
          )}
          {active === "customer-ordering" && <CustomerOrderingPage />}
          {active === "promotions" && <PromotionsPage />}
          {active === "settings" && <SettingsPage onOpenPromotions={() => setActive("promotions")} />}
          {active === "inventory" && <StoreRequestPage />}
          {active === "bill-reprint" && <BillReprintPage />}
          {!HANDLED_PAGES.includes(active) && <Placeholder id={active} />}
          {active === "more" && (
            <div className="grid grid-cols-3 gap-3">
              {NAV_ITEMS.filter(n => !["dashboard","orders","tables","shift"].includes(n.id) && (promo.enabled || n.id !== "promotions")).map((n) => {
                const Icon = n.icon;
                return (
                  <button key={n.id} onClick={() => setActive(n.id)} className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col items-center gap-2">
                    <Icon size={20} color={C.green} />
                    <span className="text-xs font-medium text-slate-600 text-center">{n.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </main>
      </div>

      <MobileBottomNav active={active} setActive={setActive} />
    </div>
  );
}

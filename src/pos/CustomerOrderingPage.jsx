import React, { useMemo, useState } from "react";
import {
  QrCode, Languages, Smartphone, Settings2, Printer, RefreshCw, Copy, Check,
  Plus, Search, AlertTriangle, ShoppingCart, Store,
} from "lucide-react";
import { EC } from "./eventData";

/* ------------------------------------------------------------------
   Setup → Customer Ordering module
   Guest-facing QR ordering: multi-language menu matrix with allergen
   badges, per-table QR token generation, and a live mobile theme preview.
------------------------------------------------------------------- */

export const LANGS = [
  { code: "JP", label: "日本語", flag: "🇯🇵" },
  { code: "EN", label: "English", flag: "🇬🇧" },
  { code: "CN", label: "中文", flag: "🇨🇳" },
  { code: "KR", label: "한국어", flag: "🇰🇷" },
];

const ALLERGENS = [
  { id: "egg", label: "Egg", emoji: "🥚" },
  { id: "milk", label: "Milk", emoji: "🥛" },
  { id: "wheat", label: "Wheat", emoji: "🌾" },
  { id: "shrimp", label: "Shrimp", emoji: "🦐" },
  { id: "soy", label: "Soy", emoji: "🫘" },
  { id: "fish", label: "Fish", emoji: "🐟" },
];

const SEED_ITEMS = [
  { id: 1, barcode: "4901000010013", emoji: "🍣", price: 850, cat: "Sushi", allergens: ["fish", "soy"], names: { JP: "サーモン寿司", EN: "Salmon Sushi", CN: "三文鱼寿司", KR: "연어 초밥" } },
  { id: 2, barcode: "4901000020020", emoji: "🍜", price: 1200, cat: "Ramen", allergens: ["egg", "wheat", "soy"], names: { JP: "醤油ラーメン", EN: "Shoyu Ramen", CN: "酱油拉面", KR: "쇼유 라멘" } },
  { id: 3, barcode: "4901000030037", emoji: "🍲", price: 250, cat: "Soup", allergens: ["soy"], names: { JP: "味噌汁", EN: "Miso Soup", CN: "味噌汤", KR: "미소 된장국" } },
  { id: 4, barcode: "4901000040044", emoji: "🍵", price: 300, cat: "Drink", allergens: [], names: { JP: "緑茶", EN: "Green Tea", CN: "绿茶", KR: "녹차" } },
  { id: 5, barcode: "4901000050051", emoji: "🍤", price: 980, cat: "Sushi", allergens: ["shrimp", "wheat"], names: { JP: "海老天ぷら", EN: "Ebi Tempura", CN: "炸虾天妇罗", KR: "새우 튀김" } },
  { id: 6, barcode: "4901000060068", emoji: "🍰", price: 620, cat: "Dessert", allergens: ["egg", "milk", "wheat"], names: { JP: "抹茶ケーキ", EN: "Matcha Cake", CN: "抹茶蛋糕", KR: "말차 케이크" } },
];

const TABLES = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"];

const TABS = [
  { id: "general", label: "General", icon: Settings2 },
  { id: "menu", label: "Menu (Multi-lang Matrix)", icon: Languages },
  { id: "qr", label: "QR Generator", icon: QrCode },
  { id: "theme", label: "Mobile Theme", icon: Smartphone },
];

const inputCls = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-slate-400 bg-white";
const cardCls = "bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5";

const token = (t) => `T1AbD${t.replace(/\D/g, "").padStart(2, "0")}${(t.charCodeAt(1) * 7919).toString(36).slice(0, 5)}`;
const orderUrl = (base, t) => `${base.replace(/\/$/, "")}/T${t}?token=${token(t)}`;
const qrSrc = (data, size = 150) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=0&data=${encodeURIComponent(data)}`;

function Chip({ active, children, onClick, color = EC.blue }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-xs font-bold border transition-colors"
      style={active ? { background: color, borderColor: color, color: "white" } : { borderColor: "#E2E8F0", color: "#64748B", background: "white" }}
    >
      {children}
    </button>
  );
}

function SectionTitle({ icon: Icon, title, sub, color = EC.blue, bg = EC.blueLight, right }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: bg }}>
        <Icon size={18} color={color} />
      </div>
      <div className="min-w-0">
        <h3 className="font-bold text-slate-800 leading-tight">{title}</h3>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </div>
      {right && <div className="ml-auto shrink-0">{right}</div>}
    </div>
  );
}

/* --------------------------------- GENERAL --------------------------------- */
function GeneralTab({ cfg, setCfg }) {
  const set = (k, v) => setCfg((c) => ({ ...c, [k]: v }));
  const toggles = [
    ["qrOrdering", "Show in QR ordering", "Publish the live menu to guest phones"],
    ["allergenBadges", "Large touch allergen badges", "Big icons for allergens on guest menu"],
    ["requireConfirm", "Require staff confirmation", "Guest orders wait for approval before KOT"],
    ["showPrices", "Show prices with tax", "Display tax-inclusive prices to guests"],
    ["callWaiter", "Enable Call Waiter button", "Guest can ping the floor from their phone"],
  ];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className={cardCls}>
        <SectionTitle icon={Store} title="Restaurant Identity" sub="Shown on the guest ordering page" color={EC.orange} bg={EC.orangeLight} />
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-500">Outlet Name</label>
            <input className={inputCls} value={cfg.outlet} onChange={(e) => set("outlet", e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Ordering Base URL</label>
            <input className={inputCls} value={cfg.baseUrl} onChange={(e) => set("baseUrl", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500">Currency Symbol</label>
              <input className={inputCls} value={cfg.currency} onChange={(e) => set("currency", e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500">Default Language</label>
              <select className={inputCls} value={cfg.defaultLang} onChange={(e) => set("defaultLang", e.target.value)}>
                {LANGS.map((l) => <option key={l.code} value={l.code}>{l.flag} {l.label}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className={cardCls}>
        <SectionTitle icon={Settings2} title="Ordering Rules" sub="How guest orders reach the kitchen" />
        <div className="divide-y divide-slate-100">
          {toggles.map(([key, label, sub]) => (
            <button key={key} onClick={() => set(key, !cfg[key])} className="w-full flex items-center gap-3 py-3 text-left">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-700">{label}</div>
                <div className="text-xs text-slate-400">{sub}</div>
              </div>
              <div className="w-11 h-6 rounded-full p-0.5 transition-colors shrink-0" style={{ background: cfg[key] ? EC.green : "#CBD5E1" }}>
                <div className="w-5 h-5 rounded-full bg-white shadow transition-transform" style={{ transform: cfg[key] ? "translateX(20px)" : "none" }} />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ MENU MATRIX ------------------------------ */
function MenuTab({ items, setItems, cfg }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const cats = ["All", ...Array.from(new Set(items.map((i) => i.cat)))];
  const rows = items.filter(
    (i) =>
      (cat === "All" || i.cat === cat) &&
      `${Object.values(i.names).join(" ")} ${i.barcode || ""}`.toLowerCase().includes(q.trim().toLowerCase())
  );

  const edit = (id, patch) => setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const toggleAllergen = (id, a) =>
    setItems((list) =>
      list.map((i) =>
        i.id === id ? { ...i, allergens: i.allergens.includes(a) ? i.allergens.filter((x) => x !== a) : [...i.allergens, a] } : i
      )
    );

  return (
    <div className={cardCls}>
      <SectionTitle
        icon={Languages}
        title="Menu Setup — Multi-language Matrix"
        sub="One row per item, one column per guest language. Allergen badges show on the guest menu."
        color={EC.purple}
        bg={EC.purpleLight}
        right={
          <div className="flex gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className={`${inputCls} pl-8 w-44`} placeholder="Search item / barcode…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        {cats.map((c) => <Chip key={c} active={cat === c} onClick={() => setCat(c)} color={EC.purple}>{c}</Chip>)}
      </div>

      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="text-white text-xs uppercase tracking-wide" style={{ background: "#0F5C7A" }}>
              <th className="text-left px-3 py-3 rounded-l-lg">Item</th>
              {LANGS.map((l) => <th key={l.code} className="text-left px-3 py-3">{l.flag} {l.code}</th>)}
              <th className="text-left px-3 py-3">Barcode</th>
              <th className="text-right px-3 py-3">Price</th>
              <th className="text-left px-3 py-3 rounded-r-lg">Allergens</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((it) => (
              <tr key={it.id} className="border-b border-slate-100 align-top">
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-lg">{it.emoji}</div>
                    <div className="text-xs font-bold text-slate-500">{it.cat}</div>
                  </div>
                </td>
                {LANGS.map((l) => (
                  <td key={l.code} className="px-2 py-3">
                    <input
                      className="w-36 border border-slate-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-slate-400"
                      value={it.names[l.code]}
                      onChange={(e) => edit(it.id, { names: { ...it.names, [l.code]: e.target.value } })}
                    />
                  </td>
                ))}
                <td className="px-3 py-3">
                  <input
                    className="w-36 border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-mono outline-none focus:border-slate-400"
                    value={it.barcode || ""}
                    placeholder="Barcode"
                    onChange={(e) => edit(it.id, { barcode: e.target.value.replace(/[^0-9]/g, "") })}
                  />
                </td>
                <td className="px-3 py-3 text-right">
                  <div className="inline-flex items-center gap-1">
                    <span className="text-slate-400 text-xs">{cfg.currency}</span>
                    <input
                      inputMode="numeric"
                      className="w-20 border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-right outline-none focus:border-slate-400"
                      value={it.price}
                      onChange={(e) => edit(it.id, { price: Number(e.target.value.replace(/\D/g, "")) || 0 })}
                    />
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1.5 max-w-[220px]">
                    {ALLERGENS.map((a) => {
                      const on = it.allergens.includes(a.id);
                      return (
                        <button
                          key={a.id}
                          onClick={() => toggleAllergen(it.id, a.id)}
                          title={a.label}
                          className="w-8 h-8 rounded-lg border text-sm flex items-center justify-center"
                          style={on ? { background: EC.redLight, borderColor: EC.red } : { borderColor: "#E2E8F0", opacity: 0.45 }}
                        >
                          {a.emoji}
                        </button>
                      );
                    })}
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={7} className="text-center text-sm text-slate-400 py-8">No items match this filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 mt-4 text-xs text-slate-400">
        <AlertTriangle size={14} color={EC.orange} /> Allergen data is printed on the KOT and shown as large badges on the guest phone.
      </div>
    </div>
  );
}

/* ------------------------------ QR GENERATOR ------------------------------ */
function QrTab({ cfg }) {
  const [selected, setSelected] = useState("T5");
  const [copied, setCopied] = useState(false);
  const [seed, setSeed] = useState(0);
  const url = useMemo(() => orderUrl(cfg.baseUrl, selected) + (seed ? `&r=${seed}` : ""), [cfg.baseUrl, selected, seed]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* noop */ }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">
      <div className={cardCls}>
        <SectionTitle
          icon={QrCode}
          title="QR Code Generator"
          sub="Every table gets a signed dynamic token. Regenerate to invalidate old codes."
          right={
            <div className="flex gap-2">
              <button onClick={() => setSeed(Date.now())} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white" style={{ background: EC.green }}>
                <RefreshCw size={14} /> Regenerate All
              </button>
              <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold border border-slate-300 text-slate-700">
                <Printer size={14} /> Print All Table QRs
              </button>
            </div>
          }
        />

        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          {TABLES.map((t) => {
            const on = selected === t;
            return (
              <button
                key={t}
                onClick={() => setSelected(t)}
                className="rounded-2xl border p-3 flex flex-col items-center gap-2 transition-all"
                style={on ? { borderColor: EC.blue, background: EC.blueLight } : { borderColor: "#E2E8F0", background: "white" }}
              >
                <img src={qrSrc(orderUrl(cfg.baseUrl, t) + (seed ? `&r=${seed}` : ""), 110)} alt={`QR code for table ${t}`} width={88} height={88} className="rounded-lg bg-white" loading="lazy" />
                <div className="text-xs font-bold text-slate-700">TABLE {t.replace("T", "")}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className={cardCls}>
        <SectionTitle icon={QrCode} title={`Table ${selected.replace("T", "")}`} sub="Tent card preview" color={EC.orange} bg={EC.orangeLight} />
        <div className="rounded-2xl border-2 border-slate-200 p-5 flex flex-col items-center text-center">
          <div className="text-[11px] tracking-[0.3em] text-slate-400 font-bold mb-3">{cfg.outlet.toUpperCase()}</div>
          <img src={qrSrc(url, 180)} alt={`Large QR code for table ${selected}`} width={168} height={168} className="rounded-xl" />
          <div className="mt-3 text-lg font-extrabold text-slate-800">TABLE {selected.replace("T", "")}</div>
          <div className="text-xs text-slate-400">Scan to view menu &amp; order</div>
        </div>

        <div className="mt-4">
          <div className="text-xs font-semibold text-slate-500 mb-1">Token Preview</div>
          <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-[11px] font-mono break-all text-slate-600">{token(selected)}</div>
          <button onClick={copy} className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold border border-slate-300 text-slate-700">
            {copied ? <><Check size={14} color={EC.green} /> Link copied</> : <><Copy size={14} /> Copy ordering link</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ MOBILE THEME ------------------------------ */
const THEMES = [
  { id: "sakura", label: "Sakura", accent: "#DB2777", bg: "#FFF1F5" },
  { id: "matcha", label: "Matcha", accent: "#16A34A", bg: "#F0FDF4" },
  { id: "indigo", label: "Indigo", accent: "#4F46E5", bg: "#EEF2FF" },
  { id: "charcoal", label: "Charcoal", accent: "#0F172A", bg: "#F1F5F9" },
];

function ThemeTab({ cfg, setCfg, items }) {
  const [lang, setLang] = useState(cfg.defaultLang);
  const [cart, setCart] = useState({});
  const theme = THEMES.find((t) => t.id === cfg.theme) || THEMES[0];
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  const total = items.reduce((s, i) => s + (cart[i.id] || 0) * i.price, 0);
  const add = (id) => setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
      <div className={cardCls}>
        <SectionTitle icon={Smartphone} title="Mobile Theme" sub="Applied to the guest ordering page on every table QR" color={EC.pink} bg={EC.pinkLight} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => setCfg((c) => ({ ...c, theme: t.id }))}
              className="rounded-2xl border p-3 text-left"
              style={cfg.theme === t.id ? { borderColor: t.accent, background: t.bg } : { borderColor: "#E2E8F0" }}
            >
              <div className="h-10 rounded-lg mb-2" style={{ background: `linear-gradient(135deg, ${t.accent}, ${t.bg})` }} />
              <div className="text-xs font-bold text-slate-700">{t.label}</div>
            </button>
          ))}
        </div>

        <div className="text-xs font-semibold text-slate-500 mb-2">Guest language switcher</div>
        <div className="flex flex-wrap gap-2">
          {LANGS.map((l) => <Chip key={l.code} active={lang === l.code} onClick={() => setLang(l.code)} color={theme.accent}>{l.flag} {l.code}</Chip>)}
        </div>
      </div>

      {/* phone preview */}
      <div className={cardCls}>
        <div className="mx-auto w-[300px] rounded-[2rem] border-8 border-slate-900 overflow-hidden shadow-xl" style={{ background: theme.bg }}>
          <div className="px-4 py-3 bg-white flex items-center gap-2 border-b border-slate-100">
            <span className="text-lg">🌸</span>
            <span className="font-extrabold text-slate-800 text-sm">{cfg.outlet}</span>
            <span className="ml-auto text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: theme.bg, color: theme.accent }}>TABLE 5</span>
          </div>
          <div className="px-3 py-2 flex gap-1.5 overflow-x-auto bg-white">
            {LANGS.map((l) => (
              <button key={l.code} onClick={() => setLang(l.code)} className="px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0"
                style={lang === l.code ? { background: theme.accent, color: "white" } : { background: "#F1F5F9", color: "#64748B" }}>
                {l.code}
              </button>
            ))}
          </div>
          <div className="p-3 grid grid-cols-2 gap-2.5 max-h-[360px] overflow-y-auto">
            {items.map((it) => (
              <div key={it.id} className="bg-white rounded-xl p-2 shadow-sm">
                <div className="h-16 rounded-lg bg-slate-100 flex items-center justify-center text-3xl">{it.emoji}</div>
                <div className="text-[11px] font-bold text-slate-800 mt-1.5 leading-tight line-clamp-2">{it.names[lang]}</div>
                <div className="text-[11px] font-extrabold" style={{ color: theme.accent }}>{cfg.currency}{it.price.toLocaleString()}</div>
                {cfg.allergenBadges && !!it.allergens.length && (
                  <div className="flex gap-0.5 mt-1">
                    {it.allergens.map((a) => (
                      <span key={a} className="text-[10px]">{ALLERGENS.find((x) => x.id === a)?.emoji}</span>
                    ))}
                  </div>
                )}
                <button onClick={() => add(it.id)} className="mt-1.5 w-7 h-7 rounded-full text-white flex items-center justify-center ml-auto" style={{ background: theme.accent }}>
                  <Plus size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="p-3 bg-white border-t border-slate-100">
            <button className="w-full rounded-xl py-2.5 text-xs font-bold text-white flex items-center justify-center gap-2" style={{ background: theme.accent }}>
              <ShoppingCart size={14} /> Cart: {count} items | {cfg.currency}{total.toLocaleString()} Checkout →
            </button>
            {cfg.requireConfirm && <div className="text-[10px] text-slate-400 text-center mt-1.5">Orders are confirmed by staff before cooking</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- PAGE --------------------------------- */
export default function CustomerOrderingPage() {
  const [tab, setTab] = useState("qr");
  const [items, setItems] = useState(SEED_ITEMS);
  const [cfg, setCfg] = useState({
    outlet: "Sakura Sushi",
    baseUrl: "https://order.aegispos.jp",
    currency: "¥",
    defaultLang: "EN",
    theme: "sakura",
    qrOrdering: true,
    allergenBadges: true,
    requireConfirm: true,
    showPrices: true,
    callWaiter: true,
  });

  return (
    <div className="pb-8">
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 text-sm font-semibold mb-5 w-fit max-w-full overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
            style={tab === t.id ? { background: "#0F172A", color: "white" } : { color: "#64748B" }}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "general" && <GeneralTab cfg={cfg} setCfg={setCfg} />}
      {tab === "menu" && <MenuTab items={items} setItems={setItems} cfg={cfg} />}
      {tab === "qr" && <QrTab cfg={cfg} />}
      {tab === "theme" && <ThemeTab cfg={cfg} setCfg={setCfg} items={items} />}
    </div>
  );
}

import React, { useMemo, useState } from "react";
import {
  Tag, Plus, X, Ticket, Award, Search, Trash2, Pencil, Check, Sparkles,
} from "lucide-react";
import { usePromotions, OUTLETS, PROGRAM_TYPES, REWARD_TYPES, APPLIES_TO } from "./posStore";

const C = {
  green: "#16A34A", greenLight: "#DCFCE7", blue: "#2563EB", blueLight: "#DBEAFE",
  orange: "#F59E0B", orangeLight: "#FEF3C7", purple: "#9333EA", purpleLight: "#F3E8FF",
  red: "#EF4444", redLight: "#FEE2E2",
};

const input = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-slate-400 bg-white min-h-[44px]";
const label = "block text-xs font-semibold text-slate-500 mb-1.5";

function Field({ title, children }) {
  return (
    <div>
      <span className={label}>{title}</span>
      {children}
    </div>
  );
}

function Pill({ tone, children }) {
  const map = {
    Active: { bg: C.greenLight, fg: "#166534" },
    Inactive: { bg: "#F1F5F9", fg: "#475569" },
    Unused: { bg: C.blueLight, fg: "#1D4ED8" },
    Used: { bg: "#F1F5F9", fg: "#475569" },
    Expired: { bg: C.redLight, fg: "#991B1B" },
  };
  const s = map[tone] || map.Inactive;
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold" style={{ background: s.bg, color: s.fg }}>
      {children ?? tone}
    </span>
  );
}

/* Full-screen sheet on phones, centered dialog on tablets/desktop. */
function Modal({ open, title, onClose, children, footer, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-slate-900/40 p-0 sm:p-4">
      <div
        className={`bg-white w-full ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"} h-full sm:h-auto sm:max-h-[88vh] sm:rounded-2xl flex flex-col shadow-2xl`}
        style={{ animation: "promoIn .22s ease-out" }}
      >
        <style>{`@keyframes promoIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-slate-100 shrink-0">
          <h3 className="font-bold text-slate-800 text-base truncate">{title}</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 min-w-[44px] min-h-[44px] flex items-center justify-center">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-slate-100 px-4 sm:px-5 py-3 bg-white sticky bottom-0 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

function Btn({ variant = "primary", className = "", children, ...props }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold px-4 min-h-[44px] transition-colors disabled:opacity-40";
  const styles = {
    primary: { background: C.green, color: "white" },
    dark: { background: "#0F172A", color: "white" },
    secondary: {},
  };
  const cls = variant === "secondary" ? "bg-slate-100 text-slate-600 hover:bg-slate-200" : "";
  return (
    <button className={`${base} ${cls} ${className}`} style={styles[variant]} {...props}>
      {children}
    </button>
  );
}

const emptyProgram = () => ({
  id: `PG-${String(Date.now()).slice(-6)}`,
  name: "",
  type: "Discount",
  currency: "JPY",
  availableOn: ["POS"],
  limitUsage: false,
  startDate: new Date().toISOString().slice(0, 10),
  endDate: "2026-12-31",
  outlets: [OUTLETS[0]],
  status: "Active",
  rules: [],
  rewards: [],
});

/* --------------------------------- RULE POPUP --------------------------------- */
function RuleDialog({ open, onClose, onSave }) {
  const [r, setR] = useState({ minQty: 1, minPurchase: 0, tax: "Tax Included", among: "Products", target: "", outlet: OUTLETS[0] });
  const save = (again) => {
    onSave({ ...r, id: `R-${Date.now()}` });
    if (again) setR({ minQty: 1, minPurchase: 0, tax: "Tax Included", among: "Products", target: "", outlet: OUTLETS[0] });
    else onClose();
  };
  return (
    <Modal
      open={open}
      title="Conditional Rule"
      onClose={onClose}
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>Discard</Btn>
          <Btn variant="dark" onClick={() => save(true)}>Save &amp; New</Btn>
          <Btn onClick={() => save(false)}>Save</Btn>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field title="Minimum Quantity">
          <input className={input} type="number" min="0" value={r.minQty} onChange={(e) => setR({ ...r, minQty: e.target.value })} />
        </Field>
        <Field title="Minimum Purchase">
          <input className={input} type="number" min="0" value={r.minPurchase} onChange={(e) => setR({ ...r, minPurchase: e.target.value })} />
        </Field>
        <Field title="Tax">
          <select className={input} value={r.tax} onChange={(e) => setR({ ...r, tax: e.target.value })}>
            <option>Tax Included</option>
            <option>Tax Excluded</option>
          </select>
        </Field>
        <Field title="Among">
          <select className={input} value={r.among} onChange={(e) => setR({ ...r, among: e.target.value })}>
            {["Products", "Categories", "Product Tags", "Customer Groups"].map((x) => <option key={x}>{x}</option>)}
          </select>
        </Field>
        <Field title={`Select ${r.among}`}>
          <input className={input} placeholder={`e.g. ${r.among === "Categories" ? "Drinks" : "Salmon Bento"}`} value={r.target} onChange={(e) => setR({ ...r, target: e.target.value })} />
        </Field>
        <Field title="Outlet">
          <select className={input} value={r.outlet} onChange={(e) => setR({ ...r, outlet: e.target.value })}>
            {OUTLETS.map((o) => <option key={o}>{o}</option>)}
          </select>
        </Field>
      </div>
    </Modal>
  );
}

/* -------------------------------- REWARD POPUP -------------------------------- */
function RewardDialog({ open, onClose, onSave }) {
  const [r, setR] = useState({ type: "Discount", percent: 10, appliesTo: "Order", description: "", maxDiscount: 0, product: "", points: 0 });
  const save = (again) => {
    onSave({ ...r, id: `RW-${Date.now()}` });
    if (again) setR({ type: "Discount", percent: 10, appliesTo: "Order", description: "", maxDiscount: 0, product: "", points: 0 });
    else onClose();
  };
  return (
    <Modal
      open={open}
      title="Reward"
      onClose={onClose}
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>Discard</Btn>
          <Btn variant="dark" onClick={() => save(true)}>Save &amp; New</Btn>
          <Btn onClick={() => save(false)}>Save &amp; Close</Btn>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field title="Reward Type">
          <select className={input} value={r.type} onChange={(e) => setR({ ...r, type: e.target.value })}>
            {REWARD_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        {r.type === "Discount" && (
          <>
            <Field title="Discount %">
              <input className={input} type="number" min="0" max="100" value={r.percent} onChange={(e) => setR({ ...r, percent: e.target.value })} />
            </Field>
            <Field title="Applies To">
              <select className={input} value={r.appliesTo} onChange={(e) => setR({ ...r, appliesTo: e.target.value })}>
                {APPLIES_TO.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field title="Maximum Discount">
              <input className={input} type="number" min="0" value={r.maxDiscount} onChange={(e) => setR({ ...r, maxDiscount: e.target.value })} />
            </Field>
          </>
        )}
        {(r.type === "Free Product" || r.type === "Gift") && (
          <Field title="Product">
            <input className={input} value={r.product} onChange={(e) => setR({ ...r, product: e.target.value })} placeholder="e.g. Green Tea" />
          </Field>
        )}
        {r.type === "Points" && (
          <Field title="Points">
            <input className={input} type="number" min="0" value={r.points} onChange={(e) => setR({ ...r, points: e.target.value })} />
          </Field>
        )}
        {r.type === "Cashback" && (
          <Field title="Cashback Amount">
            <input className={input} type="number" min="0" value={r.maxDiscount} onChange={(e) => setR({ ...r, maxDiscount: e.target.value })} />
          </Field>
        )}
        <div className="sm:col-span-2">
          <Field title="Description">
            <input className={input} value={r.description} onChange={(e) => setR({ ...r, description: e.target.value })} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

/* -------------------------------- COUPON POPUP -------------------------------- */
function CouponDialog({ open, onClose, onGenerate }) {
  const [mode, setMode] = useState("Anonymous Customers");
  const [customer, setCustomer] = useState("");
  const [quantity, setQuantity] = useState(5);
  const [description, setDescription] = useState("");
  const [validUntil, setValidUntil] = useState("2026-12-31");
  return (
    <Modal
      open={open}
      title="Generate Coupons"
      onClose={onClose}
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>Discard</Btn>
          <Btn onClick={() => { onGenerate({ quantity, customer: mode === "Anonymous Customers" ? "Anonymous" : customer, description, validUntil }); onClose(); }}>
            <Sparkles size={16} /> Generate
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2 inline-flex bg-slate-100 rounded-xl p-1 text-sm font-semibold w-full">
          {["Anonymous Customers", "Selected Customers"].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="flex-1 rounded-lg px-3 py-2.5 min-h-[44px]"
              style={mode === m ? { background: "#0F172A", color: "white" } : { color: "#64748B" }}
            >
              {m}
            </button>
          ))}
        </div>
        {mode === "Selected Customers" && (
          <Field title="Customer">
            <input className={input} value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Search customer…" />
          </Field>
        )}
        <Field title="Quantity">
          <input className={input} type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </Field>
        <Field title="Valid Until">
          <input className={input} type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Field title="Description">
            <input className={input} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------ PROGRAM EDITOR ------------------------------ */
function ProgramEditor({ open, initial, onClose, onSave }) {
  const promo = usePromotions();
  const [tab, setTab] = useState("General");
  const [p, setP] = useState(initial || emptyProgram());
  const [ruleOpen, setRuleOpen] = useState(false);
  const [rewardOpen, setRewardOpen] = useState(false);
  const [couponOpen, setCouponOpen] = useState(false);

  React.useEffect(() => {
    if (open) { setP(initial || emptyProgram()); setTab("General"); }
  }, [open, initial]);

  const coupons = promo.coupons.filter((c) => c.promotionId === p.id);
  const toggleAvail = (v) =>
    setP((x) => ({ ...x, availableOn: x.availableOn.includes(v) ? x.availableOn.filter((a) => a !== v) : [...x.availableOn, v] }));

  return (
    <Modal
      open={open}
      wide
      title={initial ? p.name || "Edit Program" : "New Program"}
      onClose={onClose}
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>Discard</Btn>
          <Btn disabled={!p.name} onClick={() => { onSave(p); onClose(); }}><Check size={16} /> Save</Btn>
        </>
      }
    >
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-4 overflow-x-auto">
        {["General", "Rules & Rewards", "Coupons"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-semibold min-h-[44px]"
            style={tab === t ? { background: "white", color: "#0F172A", boxShadow: "0 1px 2px rgba(15,23,42,.12)" } : { color: "#64748B" }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "General" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          <div className="sm:col-span-2 xl:col-span-3">
            <Field title="Program Name *">
              <input className={input} value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} placeholder="e.g. 10% Discount" />
            </Field>
          </div>
          <Field title="Program Type">
            <select className={input} value={p.type} onChange={(e) => setP({ ...p, type: e.target.value })}>
              {PROGRAM_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field title="Currency">
            <select className={input} value={p.currency} onChange={(e) => setP({ ...p, currency: e.target.value })}>
              {["JPY", "USD", "EUR"].map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field title="Status">
            <select className={input} value={p.status} onChange={(e) => setP({ ...p, status: e.target.value })}>
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </Field>
          <Field title="Start Date">
            <input className={input} type="date" value={p.startDate} onChange={(e) => setP({ ...p, startDate: e.target.value })} />
          </Field>
          <Field title="End Date">
            <input className={input} type="date" value={p.endDate} onChange={(e) => setP({ ...p, endDate: e.target.value })} />
          </Field>
          <Field title="Outlet">
            <select className={input} value={p.outlets[0]} onChange={(e) => setP({ ...p, outlets: [e.target.value] })}>
              {OUTLETS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <div className="sm:col-span-2 xl:col-span-3 flex flex-wrap items-center gap-4">
            <span className="text-xs font-semibold text-slate-500">Available On</span>
            {["POS", "Sales"].map((v) => (
              <label key={v} className="inline-flex items-center gap-2 text-sm text-slate-700 min-h-[44px]">
                <input type="checkbox" className="w-4 h-4" checked={p.availableOn.includes(v)} onChange={() => toggleAvail(v)} />
                {v}
              </label>
            ))}
            <label className="inline-flex items-center gap-2 text-sm text-slate-700 min-h-[44px]">
              <input type="checkbox" className="w-4 h-4" checked={p.limitUsage} onChange={(e) => setP({ ...p, limitUsage: e.target.checked })} />
              Limit Usage
            </label>
          </div>
        </div>
      )}

      {tab === "Rules & Rewards" && (
        <div className="space-y-5">
          <section>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-slate-700 text-sm">Conditional Rules</h4>
              <Btn variant="secondary" onClick={() => setRuleOpen(true)}><Plus size={15} /> Add Rule</Btn>
            </div>
            {p.rules.length === 0 && <p className="text-sm text-slate-400">No rules yet — the program applies to every order.</p>}
            <div className="space-y-2">
              {p.rules.map((r) => (
                <div key={r.id} className="border border-slate-200 rounded-xl p-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 text-sm text-slate-600">
                    <div className="font-semibold text-slate-800">Min qty {r.minQty} · Min ¥{Number(r.minPurchase).toLocaleString()}</div>
                    <div className="text-xs text-slate-400 truncate">{r.tax} · {r.among}{r.target ? `: ${r.target}` : ""} · {r.outlet}</div>
                  </div>
                  <button onClick={() => setP({ ...p, rules: p.rules.filter((x) => x.id !== r.id) })} className="p-2 rounded-lg hover:bg-red-50" style={{ color: C.red }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-slate-700 text-sm">Rewards</h4>
              <Btn variant="secondary" onClick={() => setRewardOpen(true)}><Plus size={15} /> Add Reward</Btn>
            </div>
            {p.rewards.length === 0 && <p className="text-sm text-slate-400">No rewards configured yet.</p>}
            <div className="space-y-2">
              {p.rewards.map((r) => (
                <div key={r.id} className="border border-slate-200 rounded-xl p-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 text-sm text-slate-600">
                    <div className="font-semibold text-slate-800">
                      {r.type}{r.type === "Discount" ? ` · ${r.percent}% on ${r.appliesTo}` : ""}
                    </div>
                    <div className="text-xs text-slate-400 truncate">
                      {r.description || "—"}{Number(r.maxDiscount) > 0 ? ` · max ¥${Number(r.maxDiscount).toLocaleString()}` : ""}
                    </div>
                  </div>
                  <button onClick={() => setP({ ...p, rewards: p.rewards.filter((x) => x.id !== r.id) })} className="p-2 rounded-lg hover:bg-red-50" style={{ color: C.red }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {tab === "Coupons" && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-bold text-slate-700 text-sm">Coupons ({coupons.length})</h4>
            <Btn onClick={() => setCouponOpen(true)}><Ticket size={15} /> Generate Coupons</Btn>
          </div>
          {coupons.length === 0 && <p className="text-sm text-slate-400">No coupons generated for this program yet.</p>}
          <div className="space-y-2">
            {coupons.map((c) => (
              <div key={c.id} className="border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-mono font-bold text-slate-800 text-sm">{c.code}</div>
                  <div className="text-xs text-slate-400 truncate">{c.customer} · exp {c.expiry}</div>
                </div>
                <Pill tone={c.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      <RuleDialog open={ruleOpen} onClose={() => setRuleOpen(false)} onSave={(r) => setP((x) => ({ ...x, rules: [...x.rules, r] }))} />
      <RewardDialog open={rewardOpen} onClose={() => setRewardOpen(false)} onSave={(r) => setP((x) => ({ ...x, rewards: [...x.rewards, r] }))} />
      <CouponDialog
        open={couponOpen}
        onClose={() => setCouponOpen(false)}
        onGenerate={(data) => promo.generateCoupons({ ...data, promotionId: p.id, outlet: p.outlets[0] })}
      />
    </Modal>
  );
}

/* --------------------------------- MAIN PAGE --------------------------------- */
export default function PromotionsPage() {
  const promo = usePromotions();
  const [tab, setTab] = useState("Programs");
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState({ open: false, program: null });

  const programs = useMemo(
    () => promo.programs.filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase())),
    [promo.programs, search]
  );

  if (!promo.enabled) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-4" style={{ background: C.orangeLight }}>
          <Tag size={24} color={C.orange} />
        </div>
        <h1 className="text-lg font-bold text-slate-800">Discount &amp; Loyalty is disabled</h1>
        <p className="text-sm text-slate-500 mt-1">Turn it on under Settings → Promotions to manage discounts, coupons and loyalty points.</p>
      </div>
    );
  }

  return (
    <div className="pb-8">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 mb-5 sm:flex sm:flex-wrap sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center" style={{ background: C.purpleLight }}>
            <Tag size={20} color={C.purple} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-800 truncate">Discount &amp; Loyalty</h1>
            <p className="text-sm text-slate-400">Promotions, coupons and the loyalty points program.</p>
          </div>
        </div>
        <Btn onClick={() => setEditor({ open: true, program: null })}><Plus size={16} /> <span className="hidden sm:inline">New Program</span></Btn>
      </div>

      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-4 overflow-x-auto">
        {["Programs", "Coupons", "Loyalty"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-semibold min-h-[44px]"
            style={tab === t ? { background: "white", color: "#0F172A", boxShadow: "0 1px 2px rgba(15,23,42,.12)" } : { color: "#64748B" }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Programs" && (
        <>
          <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 bg-white mb-4 max-w-sm">
            <Search size={15} className="text-slate-400 shrink-0" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search program…" className="text-sm outline-none w-full min-h-[36px]" />
          </div>

          {/* Cards on phones */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:hidden">
            {programs.map((p) => (
              <div key={p.id} className="bg-white border border-slate-200 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-800 truncate">{p.name}</div>
                    <div className="text-xs text-slate-400">{p.type} · {p.availableOn.join(", ")}</div>
                  </div>
                  <Pill tone={p.status} />
                </div>
                <div className="text-xs text-slate-500 mt-2">{p.startDate} → {p.endDate}</div>
                <div className="flex gap-2 mt-3">
                  <Btn variant="secondary" className="flex-1" onClick={() => setEditor({ open: true, program: p })}><Pencil size={14} /> Edit</Btn>
                  <Btn variant="secondary" onClick={() => promo.toggleProgramStatus(p.id)}>{p.status === "Active" ? "Disable" : "Enable"}</Btn>
                </div>
              </div>
            ))}
          </div>

          {/* Table on large screens */}
          <div className="hidden lg:block bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  {["Program Name", "Type", "Status", "Start Date", "End Date", "Available On", "Active", "Actions"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {programs.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-800">{p.name}</td>
                    <td className="px-4 py-3 text-slate-600">{p.type}</td>
                    <td className="px-4 py-3"><Pill tone={p.status} /></td>
                    <td className="px-4 py-3 text-slate-600">{p.startDate}</td>
                    <td className="px-4 py-3 text-slate-600">{p.endDate}</td>
                    <td className="px-4 py-3 text-slate-600">{p.availableOn.join(", ")}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => promo.toggleProgramStatus(p.id)}
                        className="w-11 h-6 rounded-full relative transition-colors"
                        style={{ background: p.status === "Active" ? C.green : "#CBD5E1" }}
                      >
                        <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ left: p.status === "Active" ? 22 : 2 }} />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => setEditor({ open: true, program: p })} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"><Pencil size={15} /></button>
                        <button onClick={() => promo.deleteProgram(p.id)} className="p-2 rounded-lg hover:bg-red-50" style={{ color: C.red }}><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "Coupons" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {["Unused", "Used", "Expired"].map((s) => (
              <div key={s} className="bg-white border border-slate-200 rounded-2xl p-4">
                <div className="text-xs text-slate-400">{s}</div>
                <div className="text-xl font-bold text-slate-800">{promo.coupons.filter((c) => c.status === s).length}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {promo.coupons.map((c) => {
              const program = promo.programs.find((p) => p.id === c.promotionId);
              return (
                <div key={c.id} className="bg-white border border-slate-200 rounded-2xl p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-mono font-bold text-slate-800">{c.code}</div>
                    <Pill tone={c.status} />
                  </div>
                  <div className="text-xs text-slate-400 mt-1.5">{program?.name || "—"} · {c.customer}</div>
                  <div className="text-xs text-slate-400">{c.outlet} · issued {c.generatedAt} · exp {c.expiry}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "Loyalty" && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <Award size={18} color={C.orange} />
              <h3 className="font-bold text-slate-800">Loyalty Program Settings</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              <Field title="1 Point per (¥ spent)">
                <input className={input} type="number" min="1" value={promo.loyaltyConfig.pointsPer} onChange={(e) => promo.setLoyaltyConfig({ pointsPer: Number(e.target.value) || 1 })} />
              </Field>
              <Field title="1 Point value (¥)">
                <input className={input} type="number" min="1" value={promo.loyaltyConfig.pointValue} onChange={(e) => promo.setLoyaltyConfig({ pointValue: Number(e.target.value) || 1 })} />
              </Field>
              <Field title="Minimum Redemption (points)">
                <input className={input} type="number" min="0" value={promo.loyaltyConfig.minRedemption} onChange={(e) => promo.setLoyaltyConfig({ minRedemption: Number(e.target.value) || 0 })} />
              </Field>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {promo.loyalty.map((l) => {
              const used = promo.coupons.filter((c) => c.customer === l.customer && c.status === "Used");
              const active = promo.coupons.filter((c) => c.customer === l.customer && c.status === "Unused");
              const expired = promo.coupons.filter((c) => c.customer === l.customer && c.status === "Expired");
              return (
                <div key={l.customerId} className="bg-white border border-slate-200 rounded-2xl p-4">
                  <div className="font-bold text-slate-800">{l.customer}</div>
                  <div className="text-3xl font-black mt-1" style={{ color: C.green }}>{l.balance}</div>
                  <div className="text-xs text-slate-400">points available · worth ¥{(l.balance * promo.loyaltyConfig.pointValue).toLocaleString()}</div>
                  <div className="grid grid-cols-3 gap-2 mt-3 text-center text-xs">
                    <div className="rounded-xl bg-slate-50 py-2"><div className="font-bold text-slate-700">{l.earned}</div>Earned</div>
                    <div className="rounded-xl bg-slate-50 py-2"><div className="font-bold text-slate-700">{l.redeemed}</div>Redeemed</div>
                    <div className="rounded-xl bg-slate-50 py-2"><div className="font-bold text-slate-700">{active.length}</div>Coupons</div>
                  </div>
                  <div className="text-xs text-slate-400 mt-2">Active {active.length} · Used {used.length} · Expired {expired.length}</div>
                </div>
              );
            })}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <h3 className="font-bold text-slate-800 mb-2 text-sm">Promotion Usage History</h3>
            {promo.usage.length === 0 ? (
              <p className="text-sm text-slate-400">No promotions used yet.</p>
            ) : (
              <div className="space-y-2">
                {promo.usage.slice(0, 12).map((u, i) => (
                  <div key={i} className="flex items-center justify-between text-sm border-b border-slate-100 pb-2 last:border-0">
                    <span className="text-slate-600 truncate">{u.orderId} {u.coupon ? `· ${u.coupon}` : ""}</span>
                    <span className="font-semibold text-slate-800">−¥{Number(u.discount).toLocaleString()} · +{u.pointsEarned}p</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <ProgramEditor
        open={editor.open}
        initial={editor.program}
        onClose={() => setEditor({ open: false, program: null })}
        onSave={(p) => promo.saveProgram(p)}
      />
    </div>
  );
}

/* ------------------------- POS PROMOTION PICKER MODAL ------------------------- */
/* Used inside the Touch Order / payment flow: pick a promotion, punch in a coupon
   code, or redeem loyalty points. Returns the resolved discount to the caller. */
export function PromotionPickerModal({ open, subtotal, onClose, onApply }) {
  const promo = usePromotions();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [points, setPoints] = useState(0);
  const [customerId, setCustomerId] = useState(promo.loyalty[0]?.customerId || null);
  const customer = promo.loyalty.find((l) => l.customerId === customerId);

  if (!open || !promo.enabled) return null;

  const active = promo.programs.filter((p) => p.status === "Active" && p.type !== "Loyalty" && p.availableOn.includes("POS"));
  const calc = (program) => {
    const reward = (program.rewards || []).find((r) => r.type === "Discount");
    if (!reward) return 0;
    const raw = Math.round((subtotal * Number(reward.percent || 0)) / 100);
    const cap = Number(reward.maxDiscount || 0);
    return cap > 0 ? Math.min(raw, cap) : raw;
  };

  const applyProgram = (program, coupon = null) => {
    const amount = calc(program);
    const pointsValue = points * promo.loyaltyConfig.pointValue;
    onApply({
      amount: Math.min(subtotal, amount + pointsValue),
      label: program.name,
      promotionId: program.id,
      coupon,
      pointsUsed: points,
      customerId,
    });
    onClose();
  };

  const applyCode = () => {
    const res = promo.validateCoupon(code);
    if (!res.ok) { setError(res.reason); return; }
    setError("");
    applyProgram(res.program, res.coupon.code);
  };

  const applyPointsOnly = () => {
    const pointsValue = points * promo.loyaltyConfig.pointValue;
    onApply({ amount: Math.min(subtotal, pointsValue), label: `${points} loyalty points`, promotionId: null, coupon: null, pointsUsed: points, customerId });
    onClose();
  };

  return (
    <Modal
      open={open}
      title="Discounts & Loyalty"
      onClose={onClose}
      footer={<Btn variant="secondary" onClick={onClose}>Cancel</Btn>}
    >
      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Available Promotions</h4>
      <div className="space-y-2 mb-5">
        {active.length === 0 && <p className="text-sm text-slate-400">No active promotions.</p>}
        {active.map((p) => (
          <button
            key={p.id}
            onClick={() => applyProgram(p)}
            className="w-full flex items-center justify-between gap-3 border border-slate-200 rounded-xl px-4 py-3 min-h-[44px] text-left hover:border-slate-300"
          >
            <span className="min-w-0">
              <span className="block font-semibold text-slate-800 truncate">{p.name}</span>
              <span className="block text-xs text-slate-400">{p.type}</span>
            </span>
            <span className="font-bold shrink-0" style={{ color: C.green }}>−¥{calc(p).toLocaleString()}</span>
          </button>
        ))}
      </div>

      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Coupon Code</h4>
      <div className="flex flex-col sm:flex-row gap-2 mb-1">
        <input
          className={input}
          value={code}
          onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(""); }}
          placeholder="e.g. SAVE10"
        />
        <Btn onClick={applyCode} disabled={!code}><Ticket size={16} /> Apply</Btn>
      </div>
      {error && <p className="text-sm font-semibold mb-4" style={{ color: C.red }}>{error}</p>}

      <div className="mt-5 border-t border-slate-100 pt-4">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Loyalty</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field title="Customer">
            <select className={input} value={customerId || ""} onChange={(e) => setCustomerId(e.target.value)}>
              {promo.loyalty.map((l) => <option key={l.customerId} value={l.customerId}>{l.customer}</option>)}
            </select>
          </Field>
          <Field title={`Redeem points (available ${customer?.balance || 0})`}>
            <input
              className={input}
              type="number"
              min="0"
              max={customer?.balance || 0}
              value={points}
              onChange={(e) => setPoints(Math.max(0, Math.min(Number(e.target.value) || 0, customer?.balance || 0)))}
            />
          </Field>
        </div>
        <div className="flex items-center justify-between mt-3 text-sm">
          <span className="text-slate-500">
            Discount ¥{(points * promo.loyaltyConfig.pointValue).toLocaleString()} · Remaining {(customer?.balance || 0) - points} pts
          </span>
          <Btn
            variant="dark"
            disabled={!points || points < promo.loyaltyConfig.minRedemption}
            onClick={applyPointsOnly}
          >
            <Award size={16} /> Redeem
          </Btn>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Minimum redemption {promo.loyaltyConfig.minRedemption} points · earns 1 point per ¥{promo.loyaltyConfig.pointsPer} spent.
        </p>
      </div>
    </Modal>
  );
}

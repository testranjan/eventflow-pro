import React, { useMemo, useState } from "react";
import {
  PartyPopper, Plus, Search, CalendarDays, Users, Building2, Phone, Mail,
  ChevronLeft, Save, X, Eye, ShoppingCart, Clock, Landmark, CheckCircle2,
} from "lucide-react";
import {
  EC, HALLS, FUNCTION_TYPES, BOOKING_STATUS, PAYMENT_MODES, SALES_EXECUTIVES,
  EVENT_RESERVATIONS, emptyReservation, money,
} from "./eventData";

const inputCls =
  "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400 bg-white";

function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
        {label} {required && <span style={{ color: EC.red }}>*</span>}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function StatusPill({ status }) {
  const map = {
    Confirmed: { bg: EC.greenLight, color: EC.green },
    Tentative: { bg: EC.orangeLight, color: EC.orange },
    Cancelled: { bg: EC.redLight, color: EC.red },
  };
  const s = map[status] || map.Tentative;
  return (
    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.color }}>
      {status}
    </span>
  );
}

/* --------------------------- Booking form --------------------------- */
function EventBookingForm({ initial, onCancel, onSave, onSaveAndOrder }) {
  const [f, setF] = useState(initial);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const setNum = (k) => (e) => setF((p) => ({ ...p, [k]: Number(e.target.value || 0) }));

  const estimated = useMemo(
    () => Number(f.pax || 0) * Number(f.ratePerPax || 0) + Number(f.hallCharge || 0),
    [f.pax, f.ratePerPax, f.hallCharge]
  );
  const balance = Math.max(0, (Number(f.totalCharge) || estimated) - Number(f.advance || 0));
  const valid = f.eventFrom && f.guest && Number(f.pax) > 0;

  const commit = (then) => {
    const record = {
      ...f,
      id: f.id || `EV-${String(Date.now()).slice(-7)}`,
      eventTo: f.eventTo || f.eventFrom,
      totalCharge: Number(f.totalCharge) || estimated,
    };
    then(record);
  };

  return (
    <div className="pb-8">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onCancel} className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500">
          <ChevronLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Event Booking</h1>
          <p className="text-sm text-slate-400">Reservation # {f.reservationNo} · all fields marked with an asterisk (*) are mandatory.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <section className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <CalendarDays size={16} color={EC.blue} />
              <h3 className="font-bold text-slate-800 text-sm">Booking Details</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Field label="Event From" required><input type="date" className={inputCls} value={f.eventFrom} onChange={set("eventFrom")} /></Field>
              <Field label="Event To"><input type="date" className={inputCls} value={f.eventTo} onChange={set("eventTo")} /></Field>
              <Field label="Hall / Venue" required>
                <select className={inputCls} value={f.hall} onChange={set("hall")}>{HALLS.map((h) => <option key={h}>{h}</option>)}</select>
              </Field>
              <Field label="Start Time"><input type="time" className={inputCls} value={f.startTime} onChange={set("startTime")} /></Field>
              <Field label="End Time"><input type="time" className={inputCls} value={f.endTime} onChange={set("endTime")} /></Field>
              <Field label="No of Halls"><input type="number" min="1" className={inputCls} value={f.halls} onChange={setNum("halls")} /></Field>
              <Field label="Function Type">
                <select className={inputCls} value={f.functionType} onChange={set("functionType")}>{FUNCTION_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
              </Field>
              <Field label="Booking Status">
                <select className={inputCls} value={f.status} onChange={set("status")}>{BOOKING_STATUS.map((t) => <option key={t}>{t}</option>)}</select>
              </Field>
              <Field label="Sales Executive">
                <select className={inputCls} value={f.salesExecutive} onChange={set("salesExecutive")}>{SALES_EXECUTIVES.map((t) => <option key={t}>{t}</option>)}</select>
              </Field>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users size={16} color={EC.green} />
              <h3 className="font-bold text-slate-800 text-sm">Guest / Company Details</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Field label="Guest Name" required><input className={inputCls} placeholder="Enter guest name" value={f.guest} onChange={set("guest")} /></Field>
              <Field label="Company"><input className={inputCls} placeholder="Enter company" value={f.company} onChange={set("company")} /></Field>
              <Field label="Contact Number"><input className={inputCls} placeholder="0000000000" value={f.contact} onChange={set("contact")} /></Field>
              <Field label="Email"><input className={inputCls} placeholder="guest@email.com" value={f.email} onChange={set("email")} /></Field>
              <Field label="Expected Pax" required><input type="number" min="0" className={inputCls} value={f.pax} onChange={setNum("pax")} /></Field>
              <Field label="Guaranteed Pax"><input type="number" min="0" className={inputCls} value={f.guaranteedPax} onChange={setNum("guaranteedPax")} /></Field>
            </div>
            <div className="mt-3">
              <Field label="Remarks"><textarea rows={2} className={inputCls} value={f.notes} onChange={set("notes")} placeholder="Setup, menu or seating notes" /></Field>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Landmark size={16} color={EC.pink} />
              <h3 className="font-bold text-slate-800 text-sm">Charges & Advance</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Field label="Rate / Pax"><input type="number" className={inputCls} value={f.ratePerPax} onChange={setNum("ratePerPax")} /></Field>
              <Field label="Hall Charge"><input type="number" className={inputCls} value={f.hallCharge} onChange={setNum("hallCharge")} /></Field>
              <Field label="Total Charge"><input type="number" className={inputCls} value={f.totalCharge || estimated} onChange={setNum("totalCharge")} /></Field>
              <Field label="Advance"><input type="number" className={inputCls} value={f.advance} onChange={setNum("advance")} /></Field>
              <Field label="Payment Mode">
                <select className={inputCls} value={f.paymentMode} onChange={set("paymentMode")}>{PAYMENT_MODES.map((t) => <option key={t}>{t}</option>)}</select>
              </Field>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h3 className="font-bold text-slate-800 text-sm mb-3">Summary</h3>
            {[
              ["Estimated Charge", money(estimated)],
              ["Total Charge", money(f.totalCharge || estimated)],
              ["Advance Received", money(f.advance)],
              ["Balance Due", money(balance)],
            ].map(([k, v], i) => (
              <div key={k} className={`flex justify-between text-sm py-2 ${i ? "border-t border-slate-100" : ""}`}>
                <span className="text-slate-500">{k}</span>
                <span className="font-bold text-slate-800">{v}</span>
              </div>
            ))}
            <div className="mt-4 space-y-2">
              <button
                disabled={!valid}
                onClick={() => commit(onSaveAndOrder)}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white disabled:opacity-40"
                style={{ background: EC.green }}
              >
                <ShoppingCart size={16} /> Save & Take Order
              </button>
              <button
                disabled={!valid}
                onClick={() => commit(onSave)}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold border border-slate-200 text-slate-700 disabled:opacity-40"
              >
                <Save size={16} /> Save Reservation
              </button>
              <button onClick={onCancel} className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500">
                <X size={15} /> Cancel
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h3 className="font-bold text-slate-800 text-sm mb-3">Hall / Table Availability</h3>
            <div className="space-y-2">
              {HALLS.map((h) => {
                const busy = h === f.hall;
                return (
                  <div key={h} className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 w-24 shrink-0 truncate">{h}</span>
                    <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: busy ? "62%" : "22%", background: busy ? EC.green : "#CBD5E1" }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-400 mt-3">Green blocks show the slot held by this booking.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* --------------------------- List page --------------------------- */
export default function EventReservationPage({ onTakeOrder }) {
  const [rows, setRows] = useState(EVENT_RESERVATIONS);
  const [mode, setMode] = useState("list");
  const [draft, setDraft] = useState(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [toast, setToast] = useState("");

  const flash = (m) => { setToast(m); setTimeout(() => setToast(""), 2200); };

  const filtered = rows.filter((r) => {
    if (status !== "All" && r.status !== status) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return [r.guest, r.company, r.hall, r.reservationNo, r.barcode].some((v) => (v || "").toLowerCase().includes(q));
  });

  const upsert = (rec) => setRows((p) => (p.some((r) => r.id === rec.id) ? p.map((r) => (r.id === rec.id ? rec : r)) : [rec, ...p]));

  if (mode === "form") {
    return (
      <EventBookingForm
        initial={draft}
        onCancel={() => setMode("list")}
        onSave={(rec) => { upsert(rec); setMode("list"); flash("Event reservation saved"); }}
        onSaveAndOrder={(rec) => { upsert(rec); setMode("list"); onTakeOrder?.(rec); }}
      />
    );
  }

  const totals = filtered.reduce(
    (a, r) => ({ pax: a.pax + r.pax, charge: a.charge + r.totalCharge, advance: a.advance + r.advance }),
    { pax: 0, charge: 0, advance: 0 }
  );

  return (
    <div className="pb-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: EC.pinkLight }}>
            <PartyPopper size={20} color={EC.pink} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Event Order &amp; Reservation</h1>
            <p className="text-sm text-slate-400">Banquets, halls and functions — book, confirm and push straight into an order.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 bg-white">
            <Search size={15} className="text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search guest, hall, company, barcode…" className="text-sm outline-none w-40 sm:w-56 placeholder:text-slate-400" />
          </div>
          <select className={`${inputCls} w-auto`} value={status} onChange={(e) => setStatus(e.target.value)}>
            {["All", ...BOOKING_STATUS].map((s) => <option key={s}>{s}</option>)}
          </select>
          <button
            onClick={() => { setDraft(emptyReservation()); setMode("form"); }}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white"
            style={{ background: EC.green }}
          >
            <Plus size={16} /> New Event Order
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: "Reservations", value: filtered.length, icon: CalendarDays, color: EC.blue, bg: EC.blueLight },
          { label: "Expected Pax", value: totals.pax, icon: Users, color: EC.green, bg: EC.greenLight },
          { label: "Total Charge", value: money(totals.charge), icon: Landmark, color: EC.pink, bg: EC.pinkLight },
          { label: "Advance Held", value: money(totals.advance), icon: CheckCircle2, color: EC.orange, bg: EC.orangeLight },
        ].map((k) => (
          <div key={k.label} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: k.bg }}>
              <k.icon size={18} color={k.color} />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-slate-400">{k.label}</div>
              <div className="font-bold text-slate-800 truncate">{k.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3 lg:hidden">
        {filtered.map((r) => (
          <div key={r.id} className="bg-white border border-slate-200 rounded-2xl p-4 border-l-4" style={{ borderLeftColor: EC.pink }}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-bold text-slate-800 truncate">{r.guest}</div>
                <div className="text-xs text-slate-400 truncate">{r.company || "—"} · {r.hall}</div>
              </div>
              <StatusPill status={r.status} />
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-slate-500">
              <div><CalendarDays size={12} className="inline mr-1" />{r.eventFrom}</div>
              <div><Clock size={12} className="inline mr-1" />{r.startTime}–{r.endTime}</div>
              <div><Users size={12} className="inline mr-1" />{r.pax} pax</div>
              <div><Phone size={12} className="inline mr-1" />{r.contact}</div>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => { setDraft(r); setMode("form"); }} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600">
                <Eye size={13} /> View / Edit
              </button>
              <button onClick={() => onTakeOrder?.(r)} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold text-white" style={{ background: EC.green }}>
                <ShoppingCart size={13} /> Take Order
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden lg:block bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: EC.slate }} className="text-white text-left">
                {["Reservation #", "Event Date", "Hall", "Guest", "Company", "Function", "Pax", "Total Charge", "Advance", "Status", "Action"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-xs font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2.5 text-xs font-semibold text-slate-700">{r.reservationNo}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">{r.eventFrom}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-600">{r.hall}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-800 font-medium">{r.guest}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{r.company || "—"}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{r.functionType}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-600">{r.pax}</td>
                  <td className="px-3 py-2.5 text-xs font-bold text-slate-800">{money(r.totalCharge)}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-600">{money(r.advance)}</td>
                  <td className="px-3 py-2.5"><StatusPill status={r.status} /></td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1.5">
                      <button onClick={() => { setDraft(r); setMode("form"); }} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600">
                        <Eye size={12} /> View
                      </button>
                      <button onClick={() => onTakeOrder?.(r)} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-white" style={{ background: EC.green }}>
                        <ShoppingCart size={12} /> Order
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={11} className="px-3 py-10 text-center text-sm text-slate-400">No reservations match your filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-24 lg:bottom-8 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-white text-sm font-medium shadow-lg flex items-center gap-2" style={{ background: EC.green }}>
          <CheckCircle2 size={16} /> {toast}
        </div>
      )}
    </div>
  );
}

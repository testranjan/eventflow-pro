import React, { useMemo, useState } from "react";
import { Printer, FileSpreadsheet, Filter, CalendarDays, Search, BarChart3 } from "lucide-react";
import { EC, HALLS, BOOKING_STATUS, FUNCTION_TYPES, SALES_EXECUTIVES, OUTLETS, EVENT_RESERVATIONS, money } from "./eventData";

const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400 bg-white";

const COLUMN_GROUPS = {
  "Basic Info": ["Event From", "Event To", "No of Halls", "Hall"],
  "Guest Info": ["Reservation #", "Company", "Guest Name", "Contact Number", "Email"],
  Staff: ["Sales Executive", "Booking Status", "Function Type"],
  Financials: ["Expected Pax", "Hall Charge", "Total Charge", "Total Billed", "Advance", "Payment Mode"],
};

const CELL = {
  "Event From": (r) => r.eventFrom,
  "Event To": (r) => r.eventTo,
  "No of Halls": (r) => r.halls,
  Hall: (r) => r.hall,
  "Reservation #": (r) => r.reservationNo,
  Company: (r) => r.company || "—",
  "Guest Name": (r) => r.guest,
  "Contact Number": (r) => r.contact || "—",
  Email: (r) => r.email || "—",
  "Sales Executive": (r) => r.salesExecutive,
  "Booking Status": (r) => r.status,
  "Function Type": (r) => r.functionType,
  "Expected Pax": (r) => r.pax,
  "Hall Charge": (r) => money(r.hallCharge),
  "Total Charge": (r) => money(r.totalCharge),
  "Total Billed": (r) => money(r.totalBilled),
  Advance: (r) => money(r.advance),
  "Payment Mode": (r) => r.paymentMode,
};

const PRESETS = {
  "Basic Info-Group": ["Basic Info"],
  "Guest Info": ["Guest Info"],
  Financials: ["Financials"],
  All: Object.keys(COLUMN_GROUPS),
};

export default function EventReservationReport() {
  const [showFilter, setShowFilter] = useState(true);
  const [from, setFrom] = useState("2026-06-01");
  const [to, setTo] = useState("2026-07-31");
  const [hall, setHall] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [fn, setFn] = useState("ALL");
  const [exec, setExec] = useState("ALL");
  const [outlet, setOutlet] = useState(OUTLETS[0]);
  const [groupBy, setGroupBy] = useState("None");
  const [search, setSearch] = useState("");
  const [active, setActive] = useState(["Basic Info", "Guest Info", "Financials"]);

  const columns = useMemo(() => active.flatMap((g) => COLUMN_GROUPS[g] || []), [active]);

  const rows = useMemo(
    () =>
      EVENT_RESERVATIONS.filter((r) => {
        if (from && r.eventFrom < from) return false;
        if (to && r.eventFrom > to) return false;
        if (hall !== "ALL" && r.hall !== hall) return false;
        if (status !== "ALL" && r.status !== status) return false;
        if (fn !== "ALL" && r.functionType !== fn) return false;
        if (exec !== "ALL" && r.salesExecutive !== exec) return false;
        if (search && ![r.guest, r.company, r.reservationNo, r.barcode].some((v) => (v || "").toLowerCase().includes(search.toLowerCase()))) return false;
        return true;
      }),
    [from, to, hall, status, fn, exec, search]
  );

  const grouped = useMemo(() => {
    if (groupBy === "None") return [["All Reservations", rows]];
    const key = groupBy === "Hall" ? "hall" : groupBy === "Status" ? "status" : "functionType";
    const map = new Map();
    rows.forEach((r) => map.set(r[key], [...(map.get(r[key]) || []), r]));
    return [...map.entries()];
  }, [rows, groupBy]);

  const totals = rows.reduce(
    (a, r) => ({ pax: a.pax + r.pax, charge: a.charge + r.totalCharge, billed: a.billed + r.totalBilled, advance: a.advance + r.advance }),
    { pax: 0, charge: 0, billed: 0, advance: 0 }
  );

  const exportCsv = () => {
    const head = columns.join(",");
    const body = rows.map((r) => columns.map((c) => `"${CELL[c](r)}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([`${head}\n${body}`], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "event-reservation-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleGroup = (g) => setActive((p) => (p.includes(g) ? p.filter((x) => x !== g) : [...p, g]));

  return (
    <div className="pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 size={18} color={EC.blue} />
          <div>
            <h2 className="font-bold text-slate-800">Event Reservation Report</h2>
            <p className="text-xs text-slate-400">Event materialized &amp; forecast — {outlet}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowFilter((s) => !s)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
            <Filter size={14} /> {showFilter ? "Hide" : "Modify"} Filter
          </button>
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
            <Printer size={14} /> Print
          </button>
          <button onClick={exportCsv} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-white" style={{ background: EC.green }}>
            <FileSpreadsheet size={14} /> Export to Excel
          </button>
        </div>
      </div>

      {showFilter && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays size={15} color={EC.blue} />
            <h3 className="text-sm font-bold text-slate-800">Filter — Event Reservation Report</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="block"><span className="text-[11px] font-semibold text-slate-500 uppercase">From Date</span><input type="date" className={`${inputCls} mt-1`} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
            <label className="block"><span className="text-[11px] font-semibold text-slate-500 uppercase">To Date</span><input type="date" className={`${inputCls} mt-1`} value={to} onChange={(e) => setTo(e.target.value)} /></label>
            <label className="block"><span className="text-[11px] font-semibold text-slate-500 uppercase">Outlet</span><select className={`${inputCls} mt-1`} value={outlet} onChange={(e) => setOutlet(e.target.value)}>{OUTLETS.map((o) => <option key={o}>{o}</option>)}</select></label>
            <label className="block"><span className="text-[11px] font-semibold text-slate-500 uppercase">Hall</span><select className={`${inputCls} mt-1`} value={hall} onChange={(e) => setHall(e.target.value)}>{["ALL", ...HALLS].map((o) => <option key={o}>{o}</option>)}</select></label>
            <label className="block"><span className="text-[11px] font-semibold text-slate-500 uppercase">Booking Status</span><select className={`${inputCls} mt-1`} value={status} onChange={(e) => setStatus(e.target.value)}>{["ALL", ...BOOKING_STATUS].map((o) => <option key={o}>{o}</option>)}</select></label>
            <label className="block"><span className="text-[11px] font-semibold text-slate-500 uppercase">Function Type</span><select className={`${inputCls} mt-1`} value={fn} onChange={(e) => setFn(e.target.value)}>{["ALL", ...FUNCTION_TYPES].map((o) => <option key={o}>{o}</option>)}</select></label>
            <label className="block"><span className="text-[11px] font-semibold text-slate-500 uppercase">Sales Executive</span><select className={`${inputCls} mt-1`} value={exec} onChange={(e) => setExec(e.target.value)}>{["ALL", ...SALES_EXECUTIVES].map((o) => <option key={o}>{o}</option>)}</select></label>
            <label className="block"><span className="text-[11px] font-semibold text-slate-500 uppercase">Group By</span><select className={`${inputCls} mt-1`} value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>{["None", "Hall", "Status", "Function Type"].map((o) => <option key={o}>{o}</option>)}</select></label>
          </div>

          <div className="mt-4">
            <div className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: EC.green }}>✔ Report Columns</div>
            <div className="flex flex-wrap gap-2">
              {Object.keys(COLUMN_GROUPS).map((g) => {
                const on = active.includes(g);
                return (
                  <button key={g} onClick={() => toggleGroup(g)} className="px-3 py-1.5 rounded-full text-xs font-semibold border"
                    style={on ? { background: EC.blue, borderColor: EC.blue, color: "white" } : { borderColor: "#E2E8F0", color: "#64748B" }}>
                    {g}
                  </button>
                );
              })}
            </div>
            <div className="text-[11px] text-slate-400 mt-3 mb-1">Presets</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(PRESETS).map(([name, groups]) => (
                <button key={name} onClick={() => setActive(groups)} className="px-3 py-1.5 rounded-full text-xs font-semibold border border-slate-200 text-slate-600">{name}</button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 mt-4">
            <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2">
              <Search size={14} className="text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search guest / company / reservation # / barcode" className="text-sm outline-none w-56" />
            </div>
            <span className="text-xs text-slate-400">{rows.length} record(s)</span>
          </div>
        </div>
      )}

      {grouped.map(([label, list]) => (
        <div key={label} className="bg-white border border-slate-200 rounded-2xl overflow-hidden mb-4">
          {groupBy !== "None" && <div className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-50 border-b border-slate-100">{label} ({list.length})</div>}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: EC.slate }} className="text-white text-left">
                  {columns.map((c) => <th key={c} className="px-3 py-2.5 text-[11px] font-semibold whitespace-nowrap uppercase">{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                    {columns.map((c) => <td key={c} className="px-3 py-2.5 text-xs text-slate-600 whitespace-nowrap">{CELL[c](r)}</td>)}
                  </tr>
                ))}
                {list.length === 0 && <tr><td colSpan={columns.length || 1} className="px-3 py-10 text-center text-sm text-slate-400">No records for the selected filter.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[["Total Pax", totals.pax], ["Total Charge", money(totals.charge)], ["Total Billed", money(totals.billed)], ["Advance", money(totals.advance)]].map(([k, v]) => (
          <div key={k} className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="text-xs text-slate-400">{k}</div>
            <div className="font-bold text-slate-800">{v}</div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-slate-400 text-center mt-3">Aegis Software · License — Higashiomi, Shiga, Japan</p>
    </div>
  );
}

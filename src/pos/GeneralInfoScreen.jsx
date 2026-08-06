import React, { useState } from "react";
import { Info, Users, UserCircle2, Gift, Search, ChevronDown, Check, X } from "lucide-react";
import { EC } from "./eventData";

const ATTENDANTS = [
  { name: "Annam Names", role: "Guest server" },
  { name: "Dorner Namer", role: "Recent servers" },
  { name: "Aannia Lata", role: "Guest Viss" },
  { name: "Yant Nepely", role: "Recent partners" },
  { name: "Rerhard Name", role: "Guest Kitha" },
];

const COMPANIES = ["Walk-in Guest", "Sato Events Co.", "Aegis Software", "Family Gathering", "Confinay Party"];

const inputCls = "w-full border border-slate-200 rounded-xl px-3 py-3 text-sm outline-none focus:border-slate-400 bg-white";

function Toggle({ options, value, onChange, activeBg = "#0F172A", activeColor = "white" }) {
  return (
    <div className="inline-flex bg-slate-100 rounded-full p-1 text-sm font-semibold">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className="px-5 py-2 rounded-full transition-colors"
          style={value === o ? { background: activeBg, color: activeColor, boxShadow: "0 1px 2px rgba(15,23,42,.12)" } : { color: "#64748B" }}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

/**
 * "Other Info" / General Information step — shown right after a table is picked
 * (and reachable from the Touch Order screen) before the menu appears.
 */
export default function GeneralInfoScreen({ table, initial, onCancel, onSave }) {
  const [charge, setCharge] = useState(initial?.charge || "Standard");
  const [service, setService] = useState(initial?.service || "Dine In");
  const [cover, setCover] = useState(initial?.cover || "");
  const [attendant, setAttendant] = useState(initial?.attendant || "");
  const [company, setCompany] = useState(initial?.company || COMPANIES[0]);
  const [guest, setGuest] = useState(initial?.guest || "");
  const [remarks, setRemarks] = useState(initial?.remarks || "");
  const kot = initial?.kot || `KOT-${String(Date.now()).slice(-5)}`;

  const save = () => onSave({ charge, service, cover, attendant, company, guest, remarks, kot });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-start gap-3 mb-6">
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: EC.blueLight }}>
              <Info size={20} color={EC.blue} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">General Information</h1>
              <p className="text-sm text-slate-400">All the fields marked with an asterisk (*) are mandatory.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-5">
            <Toggle options={["Standard", "Non-Chargeable"]} value={charge} onChange={setCharge} activeBg="#FFFFFF" activeColor="#0F172A" />
            <Toggle options={["Dine In", "Take Away"]} value={service} onChange={setService} />
          </div>

          <div className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 mb-5">
            KOT # {kot}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 flex items-center gap-2">
              <Search size={18} color={EC.orange} />
              <span className="text-lg font-bold text-slate-800">Table: {table?.id || "—"}</span>
              <ChevronDown size={18} className="ml-auto text-slate-400" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 flex items-center gap-2">
              <UserCircle2 size={18} color={EC.blue} />
              <span className="text-lg font-bold text-slate-800 truncate">{attendant || "Choose Attendant…"}</span>
              <ChevronDown size={18} className="ml-auto text-slate-400" />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Gift size={18} color={EC.pink} />
                <h3 className="font-bold text-slate-700">Cover: Enter Total <span style={{ color: EC.red }}>*</span></h3>
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {["1", "2", "4", "5+"].map((c) => (
                  <button
                    key={c}
                    onClick={() => setCover(c === "5+" ? cover : c)}
                    className="px-5 py-3 rounded-xl border text-sm font-bold"
                    style={cover === c ? { borderColor: EC.green, background: EC.greenLight, color: EC.green } : { borderColor: "#E2E8F0", color: "#475569", background: "white" }}
                  >
                    [ {c} ]
                  </button>
                ))}
              </div>
              <input className={inputCls} inputMode="numeric" placeholder="Enter Total Cover" value={cover} onChange={(e) => setCover(e.target.value)} />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <Users size={18} color={EC.blue} />
                <h3 className="font-bold text-slate-700">Attendant: Choose</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ATTENDANTS.map((a) => {
                  const on = attendant === a.name;
                  return (
                    <button
                      key={a.name}
                      onClick={() => setAttendant(a.name)}
                      className="rounded-xl border px-3 py-2.5 text-left"
                      style={on ? { borderColor: EC.blue, background: EC.blueLight } : { borderColor: "#E2E8F0", background: "white" }}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{ background: on ? EC.blue : "#94A3B8" }}>
                          {a.name.slice(0, 1)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-700 truncate">{a.name}</div>
                          <div className="text-[10px] text-slate-400 truncate">{a.role}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: EC.green }}>+</div>
              <h3 className="font-bold text-slate-700">Company / Guest: Search</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select className={inputCls} value={company} onChange={(e) => setCompany(e.target.value)}>
                {COMPANIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <input className={inputCls} placeholder="Enter Guest Name" value={guest} onChange={(e) => setGuest(e.target.value)} />
            </div>
            <textarea rows={2} className={`${inputCls} mt-3`} placeholder="Remarks (allergies, seating, occasion…)" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 border-t border-slate-200 bg-white px-4 sm:px-8 py-4">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row gap-3">
          <button
            onClick={save}
            disabled={!cover}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-4 text-base font-bold text-white disabled:opacity-40"
            style={{ background: EC.green }}
          >
            <Check size={18} /> [ Save &amp; Continue ]
          </button>
          <button onClick={onCancel} className="sm:w-48 inline-flex items-center justify-center gap-2 rounded-xl py-4 text-base font-bold bg-slate-200 text-slate-600">
            <X size={18} /> [ Cancel ]
          </button>
        </div>
      </div>
    </div>
  );
}

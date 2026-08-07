import React from "react";
import { Settings as SettingsIcon, Tag, Award, Ticket } from "lucide-react";
import { usePromotions } from "./posStore";

const C = { green: "#16A34A", greenLight: "#DCFCE7", purple: "#9333EA", purpleLight: "#F3E8FF", orange: "#F59E0B", orangeLight: "#FEF3C7" };

function Toggle({ on, onChange }) {
  return (
    <button
      onClick={() => onChange(!on)}
      aria-pressed={on}
      className="w-14 h-8 rounded-full relative transition-colors shrink-0"
      style={{ background: on ? C.green : "#CBD5E1" }}
    >
      <span className="absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-all" style={{ left: on ? 30 : 4 }} />
    </button>
  );
}

export default function SettingsPage({ onOpenPromotions }) {
  const promo = usePromotions();

  return (
    <div className="pb-8 max-w-4xl">
      <div className="flex items-start gap-3 mb-6">
        <div className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center" style={{ background: "#F1F5F9" }}>
          <SettingsIcon size={20} className="text-slate-600" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-800">Settings</h1>
          <p className="text-sm text-slate-400">Outlet-wide configuration for this POS terminal.</p>
        </div>
      </div>

      <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <Tag size={18} color={C.purple} />
          <h2 className="font-bold text-slate-800">Promotions</h2>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border border-slate-200 rounded-xl p-4">
          <div className="min-w-0">
            <div className="font-semibold text-slate-800">Enable Discount &amp; Loyalty</div>
            <p className="text-sm text-slate-400">
              Shows the Promotions menu, applies discounts and coupons at the register, and tracks loyalty points.
            </p>
          </div>
          <Toggle on={promo.enabled} onChange={promo.setEnabled} />
        </div>

        {promo.enabled && (
          <button
            onClick={onOpenPromotions}
            className="mt-3 w-full flex items-center justify-between gap-3 rounded-xl px-4 py-3.5 min-h-[44px] text-left"
            style={{ background: C.purpleLight }}
          >
            <span className="flex items-center gap-2 font-semibold text-slate-800">
              <Ticket size={16} color={C.purple} /> Open Discount &amp; Loyalty
            </span>
            <span className="text-xs font-semibold" style={{ color: C.purple }}>
              {promo.programs.length} programs · {promo.coupons.length} coupons
            </span>
          </button>
        )}
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <Award size={18} color={C.orange} />
          <h2 className="font-bold text-slate-800">Loyalty Earning</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-xs text-slate-400">1 point per</div>
            <div className="font-bold text-slate-800">¥{promo.loyaltyConfig.pointsPer}</div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-xs text-slate-400">Point value</div>
            <div className="font-bold text-slate-800">¥{promo.loyaltyConfig.pointValue}</div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-xs text-slate-400">Min. redemption</div>
            <div className="font-bold text-slate-800">{promo.loyaltyConfig.minRedemption} pts</div>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-3">Adjust these values under Promotions → Loyalty.</p>
      </section>
    </div>
  );
}

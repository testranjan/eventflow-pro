import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/* ------------------------------------------------------------------
   Demo-grade persistence layer for the POS.

   Two independent stores live here, both mirrored into localStorage so
   everything survives a refresh:

   1. Table orders  — what "Place Order" writes and "Pay Now" clears.
   2. Promotions    — the Discount & Loyalty module (settings toggle,
                      programs, coupons, loyalty balances, usage log).
------------------------------------------------------------------- */

export const CURRENT_USER = { name: "Ranjan", role: "Admin" };
export const OUTLETS = ["Main Outlet", "Shibuya Branch", "Umeda Branch"];

const LS_TABLES = "needpos.tableOrders.v1";
const LS_PROMO = "needpos.promotions.v1";

function readLS(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function writeLS(key, value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode — demo data is disposable */
  }
}

/* ------------------------------- TABLE ORDERS ------------------------------- */

const TableOrderCtx = createContext(null);
export function useTableOrders() {
  return (
    useContext(TableOrderCtx) || {
      orders: {},
      getOrder: () => null,
      placeOrder: () => null,
      payOrder: () => {},
      clearOrder: () => {},
    }
  );
}

/* --------------------------------- PROMOTIONS -------------------------------- */

export const PROGRAM_TYPES = ["Discount", "Coupon", "Loyalty"];
export const REWARD_TYPES = ["Discount", "Free Product", "Points", "Gift", "Cashback"];
export const APPLIES_TO = ["Order", "Cheapest Product", "Specific Products"];

const DEFAULT_PROMO_STATE = {
  enabled: true,
  loyaltyConfig: { pointsPer: 100, pointValue: 1, minRedemption: 100 },
  programs: [
    {
      id: "PG-1001",
      name: "10% Discount",
      type: "Discount",
      currency: "JPY",
      availableOn: ["POS"],
      limitUsage: false,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      outlets: ["Main Outlet"],
      status: "Active",
      rules: [{ id: "R1", minQty: 1, minPurchase: 0, tax: "Tax Included", among: "Products", target: "All items", outlet: "Main Outlet" }],
      rewards: [{ id: "RW1", type: "Discount", percent: 10, appliesTo: "Order", description: "10% off the order", maxDiscount: 2000 }],
    },
    {
      id: "PG-1002",
      name: "20% Weekend Discount",
      type: "Discount",
      currency: "JPY",
      availableOn: ["POS", "Sales"],
      limitUsage: false,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      outlets: ["Main Outlet"],
      status: "Active",
      rules: [{ id: "R1", minQty: 1, minPurchase: 3000, tax: "Tax Included", among: "Products", target: "All items", outlet: "Main Outlet" }],
      rewards: [{ id: "RW1", type: "Discount", percent: 20, appliesTo: "Order", description: "Weekend special", maxDiscount: 5000 }],
    },
    {
      id: "PG-1003",
      name: "Student Discount",
      type: "Discount",
      currency: "JPY",
      availableOn: ["POS"],
      limitUsage: true,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      outlets: ["Main Outlet"],
      status: "Active",
      rules: [{ id: "R1", minQty: 1, minPurchase: 0, tax: "Tax Included", among: "Customer Groups", target: "Students", outlet: "Main Outlet" }],
      rewards: [{ id: "RW1", type: "Discount", percent: 15, appliesTo: "Order", description: "Student ID required", maxDiscount: 1500 }],
    },
    {
      id: "PG-1004",
      name: "Birthday Coupon",
      type: "Coupon",
      currency: "JPY",
      availableOn: ["POS"],
      limitUsage: true,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      outlets: ["Main Outlet"],
      status: "Active",
      rules: [],
      rewards: [{ id: "RW1", type: "Discount", percent: 25, appliesTo: "Order", description: "Birthday treat", maxDiscount: 3000 }],
    },
    {
      id: "PG-1005",
      name: "Happy Hour",
      type: "Discount",
      currency: "JPY",
      availableOn: ["POS"],
      limitUsage: false,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      outlets: ["Main Outlet"],
      status: "Inactive",
      rules: [{ id: "R1", minQty: 1, minPurchase: 0, tax: "Tax Excluded", among: "Categories", target: "Drinks", outlet: "Main Outlet" }],
      rewards: [{ id: "RW1", type: "Discount", percent: 30, appliesTo: "Cheapest Product", description: "17:00 – 19:00 drinks", maxDiscount: 1000 }],
    },
    {
      id: "PG-1006",
      name: "Loyalty Program",
      type: "Loyalty",
      currency: "JPY",
      availableOn: ["POS", "Sales"],
      limitUsage: false,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      outlets: ["Main Outlet"],
      status: "Active",
      rules: [],
      rewards: [{ id: "RW1", type: "Points", percent: 0, appliesTo: "Order", description: "1 point per ¥100 spent", maxDiscount: 0 }],
    },
  ],
  coupons: [
    { id: "CP-1", promotionId: "PG-1004", code: "SAVE10", customer: "Anonymous", status: "Unused", outlet: "Main Outlet", generatedAt: "2026-01-04", expiry: "2026-12-31", usedDate: null },
    { id: "CP-2", promotionId: "PG-1004", code: "WELCOME20", customer: "Anonymous", status: "Unused", outlet: "Main Outlet", generatedAt: "2026-01-04", expiry: "2026-12-31", usedDate: null },
    { id: "CP-3", promotionId: "PG-1004", code: "HAPPY50", customer: "Yuki Tanaka", status: "Used", outlet: "Main Outlet", generatedAt: "2026-01-04", expiry: "2026-06-30", usedDate: "2026-03-11" },
    { id: "CP-4", promotionId: "PG-1004", code: "LOYAL15", customer: "Anonymous", status: "Expired", outlet: "Main Outlet", generatedAt: "2025-06-01", expiry: "2025-12-31", usedDate: null },
  ],
  loyalty: [
    { customerId: "C-1", customer: "Yuki Tanaka", earned: 480, redeemed: 100, balance: 380 },
    { customerId: "C-2", customer: "Walk-in Guest", earned: 0, redeemed: 0, balance: 0 },
  ],
  usage: [],
};

const PromoCtx = createContext(null);
export function usePromotions() {
  return useContext(PromoCtx) || { ...DEFAULT_PROMO_STATE, setEnabled: () => {} };
}

/** Percentage discount a program grants on a given subtotal (capped by maxDiscount). */
export function programDiscount(program, subtotal) {
  if (!program) return 0;
  const reward = (program.rewards || []).find((r) => r.type === "Discount");
  if (!reward) return 0;
  const raw = Math.round((subtotal * Number(reward.percent || 0)) / 100);
  const cap = Number(reward.maxDiscount || 0);
  return cap > 0 ? Math.min(raw, cap) : raw;
}

function randomCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export function PosDataProvider({ children }) {
  /* --- table orders --- */
  const [orders, setOrders] = useState({});
  const [promo, setPromo] = useState(DEFAULT_PROMO_STATE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setOrders(readLS(LS_TABLES, {}));
    setPromo({ ...DEFAULT_PROMO_STATE, ...readLS(LS_PROMO, {}) });
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) writeLS(LS_TABLES, orders);
  }, [orders, hydrated]);
  useEffect(() => {
    if (hydrated) writeLS(LS_PROMO, promo);
  }, [promo, hydrated]);

  const getOrder = useCallback((tableId) => orders[tableId] || null, [orders]);

  const placeOrder = useCallback((tableId, payload) => {
    const now = new Date();
    let saved;
    setOrders((prev) => {
      const existing = prev[tableId];
      saved = {
        id: existing?.id || `ORD-${String(Date.now()).slice(-6)}`,
        tableId,
        orderType: payload.orderType,
        items: payload.items || [],
        notes: payload.notes || "",
        attendant: payload.attendant || CURRENT_USER.name,
        cover: payload.cover || 1,
        subtotal: payload.subtotal || 0,
        tax: payload.tax || 0,
        total: payload.total || 0,
        status: "Ordered",
        createdAt: existing?.createdAt || now.toISOString(),
        createdTime: existing?.createdTime || now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      return { ...prev, [tableId]: saved };
    });
    return saved;
  }, []);

  const clearOrder = useCallback((tableId) => {
    setOrders((prev) => {
      const next = { ...prev };
      delete next[tableId];
      return next;
    });
  }, []);

  /* --- promotions --- */
  const setEnabled = useCallback((enabled) => setPromo((p) => ({ ...p, enabled })), []);
  const setLoyaltyConfig = useCallback((cfg) => setPromo((p) => ({ ...p, loyaltyConfig: { ...p.loyaltyConfig, ...cfg } })), []);
  const saveProgram = useCallback((program) => {
    setPromo((p) => {
      const exists = p.programs.some((x) => x.id === program.id);
      return {
        ...p,
        programs: exists ? p.programs.map((x) => (x.id === program.id ? program : x)) : [...p.programs, program],
      };
    });
  }, []);
  const deleteProgram = useCallback((id) => {
    setPromo((p) => ({ ...p, programs: p.programs.filter((x) => x.id !== id), coupons: p.coupons.filter((c) => c.promotionId !== id) }));
  }, []);
  const toggleProgramStatus = useCallback((id) => {
    setPromo((p) => ({
      ...p,
      programs: p.programs.map((x) => (x.id === id ? { ...x, status: x.status === "Active" ? "Inactive" : "Active" } : x)),
    }));
  }, []);

  const generateCoupons = useCallback(({ promotionId, quantity, customer, description, validUntil, outlet }) => {
    const created = Array.from({ length: Math.max(1, Number(quantity) || 1) }, (_, i) => ({
      id: `CP-${Date.now()}-${i}`,
      promotionId,
      code: randomCode(),
      customer: customer || "Anonymous",
      description: description || "",
      status: "Unused",
      outlet: outlet || OUTLETS[0],
      generatedAt: new Date().toISOString().slice(0, 10),
      expiry: validUntil || "2026-12-31",
      usedDate: null,
    }));
    setPromo((p) => ({ ...p, coupons: [...created, ...p.coupons] }));
    return created;
  }, []);

  /** Validate a coupon code. Returns { ok, reason, coupon, program }. */
  const validateCoupon = useCallback(
    (code) => {
      const coupon = promo.coupons.find((c) => c.code.toUpperCase() === String(code || "").trim().toUpperCase());
      if (!coupon) return { ok: false, reason: "Invalid Coupon" };
      if (coupon.status === "Used") return { ok: false, reason: "Coupon Already Used" };
      const expired = coupon.status === "Expired" || (coupon.expiry && new Date(coupon.expiry) < new Date());
      if (expired) return { ok: false, reason: "Coupon Expired" };
      const program = promo.programs.find((p) => p.id === coupon.promotionId);
      if (!program || program.status !== "Active") return { ok: false, reason: "Invalid Coupon" };
      return { ok: true, coupon, program };
    },
    [promo.coupons, promo.programs]
  );

  const consumeCoupon = useCallback((code) => {
    setPromo((p) => ({
      ...p,
      coupons: p.coupons.map((c) =>
        c.code.toUpperCase() === String(code).toUpperCase()
          ? { ...c, status: "Used", usedDate: new Date().toISOString().slice(0, 10) }
          : c
      ),
    }));
  }, []);

  /** Called on successful payment: consumes coupon, moves points, logs usage. */
  const commitPromotionUsage = useCallback(
    ({ orderId, promotionId, discount = 0, coupon = null, pointsUsed = 0, customerId = null, total = 0 }) => {
      setPromo((p) => {
        const cfg = p.loyaltyConfig;
        const pointsEarned = Math.floor(Number(total || 0) / Math.max(1, cfg.pointsPer));
        return {
          ...p,
          coupons: coupon
            ? p.coupons.map((c) =>
                c.code.toUpperCase() === String(coupon).toUpperCase()
                  ? { ...c, status: "Used", usedDate: new Date().toISOString().slice(0, 10) }
                  : c
              )
            : p.coupons,
          loyalty: customerId
            ? p.loyalty.map((l) =>
                l.customerId === customerId
                  ? {
                      ...l,
                      earned: l.earned + pointsEarned,
                      redeemed: l.redeemed + pointsUsed,
                      balance: l.balance + pointsEarned - pointsUsed,
                    }
                  : l
              )
            : p.loyalty,
          usage: [
            { orderId, promotionId, discount, coupon, pointsUsed, pointsEarned, at: new Date().toISOString() },
            ...p.usage,
          ],
        };
      });
    },
    []
  );

  const payOrder = useCallback(
    (tableId, meta = {}) => {
      const order = orders[tableId];
      commitPromotionUsage({
        orderId: order?.id || tableId,
        promotionId: meta.promotionId || null,
        discount: meta.discount || 0,
        coupon: meta.coupon || null,
        pointsUsed: meta.pointsUsed || 0,
        customerId: meta.customerId || null,
        total: meta.total ?? order?.total ?? 0,
      });
      clearOrder(tableId);
    },
    [orders, clearOrder, commitPromotionUsage]
  );

  const tableValue = useMemo(
    () => ({ orders, getOrder, placeOrder, payOrder, clearOrder }),
    [orders, getOrder, placeOrder, payOrder, clearOrder]
  );
  const promoValue = useMemo(
    () => ({
      ...promo,
      setEnabled,
      setLoyaltyConfig,
      saveProgram,
      deleteProgram,
      toggleProgramStatus,
      generateCoupons,
      validateCoupon,
      consumeCoupon,
      commitPromotionUsage,
    }),
    [promo, setEnabled, setLoyaltyConfig, saveProgram, deleteProgram, toggleProgramStatus, generateCoupons, validateCoupon, consumeCoupon, commitPromotionUsage]
  );

  return (
    <TableOrderCtx.Provider value={tableValue}>
      <PromoCtx.Provider value={promoValue}>{children}</PromoCtx.Provider>
    </TableOrderCtx.Provider>
  );
}

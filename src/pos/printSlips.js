/* ------------------------------------------------------------------
   Thermal-printer slips (80mm roll) rendered as HTML and sent to the
   browser print dialog through a hidden iframe.

   Two slips:
     • printKot(...)  — kitchen ticket, no prices, options listed under
       each item exactly like the paper KOT (">" prefixed modifiers).
     • printBill(...) — guest bill in the Japanese receipt layout:
       日付 / 客数 / 伝票番号 / 担当者 → items → 小計 / 合計(税込み)
       → tax breakdown → お預かり / おつり.
------------------------------------------------------------------- */

const PAD = 32; // characters per line at 80mm / 12px monospace

const esc = (s) =>
  String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

const yen = (n) => `¥${Number(n || 0).toLocaleString("ja-JP")}`;

function stamp(d = new Date()) {
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Split "Salmon Bento Box (Rice (M), Lassi)" into a name + option list. */
function splitOptions(name) {
  const m = String(name || "").match(/^(.*?)\s*\(([^]*)\)\s*$/);
  if (!m) return { base: String(name || ""), options: [] };
  return {
    base: m[1],
    options: m[2]
      .split(/\s*[,、]\s*/)
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

function docShell(title, body) {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: "SFMono-Regular", "Menlo", "Consolas", "Noto Sans Mono CJK JP", monospace;
         font-size: 12px; line-height: 1.5; color:#000; width: 72mm; }
  .c { text-align:center; }
  .b { font-weight: 700; }
  .lg { font-size: 15px; }
  .xl { font-size: 19px; }
  .hr { border-top: 1px dashed #000; margin: 6px 0; }
  .row { display:flex; justify-content:space-between; gap:8px; }
  .row > span:last-child { white-space: nowrap; }
  .opt { padding-left: 10px; }
  .sp { height: 8px; }
  table { width:100%; border-collapse: collapse; }
</style></head><body>${body}</body></html>`;
}

function sendToPrinter(html) {
  if (typeof document === "undefined") return;
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  doc.open();
  doc.write(html);
  doc.close();
  const run = () => {
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch {
      /* printing blocked — slip preview simply closes */
    }
    setTimeout(() => frame.remove(), 1500);
  };
  if (frame.contentWindow.document.readyState === "complete") setTimeout(run, 120);
  else frame.onload = () => setTimeout(run, 120);
}

/* --------------------------------- KOT --------------------------------- */

export function printKot({
  outlet = "UPCOMING RESTRO — SHIBUYA MAIN",
  kot = "",
  table = "",
  orderType = "Dine-in",
  cover = 1,
  attendant = "",
  items = [],
  notes = "",
  at = new Date(),
} = {}) {
  const lines = items
    .map((i) => {
      const { base, options } = splitOptions(i.name);
      const opts = [...options, ...(i.desc ? String(i.desc).split(/\s*[,、]\s*/) : [])].filter(
        Boolean,
      );
      return (
        `<div class="row b lg"><span>${esc(base)}</span><span>×${i.qty || 1}</span></div>` +
        opts.map((o) => `<div class="opt">&gt;${esc(o)}</div>`).join("")
      );
    })
    .join('<div class="sp"></div>');

  const body = `
    <div class="c b xl">KOT / 厨房伝票</div>
    <div class="c">${esc(outlet)}</div>
    <div class="hr"></div>
    <div class="row"><span>${esc(stamp(at))}</span><span>${esc(orderType)}</span></div>
    <div class="row b lg"><span>卓 / TABLE: ${esc(table)}</span><span>客数 ${esc(cover)}</span></div>
    <div class="row"><span>伝票 / KOT#</span><span>${esc(kot)}</span></div>
    <div class="row"><span>担当者</span><span>${esc(attendant)}</span></div>
    <div class="hr"></div>
    ${lines || '<div class="c">(no items)</div>'}
    ${notes ? `<div class="hr"></div><div>備考: ${esc(notes)}</div>` : ""}
    <div class="hr"></div>
    <div class="c">合計点数 ${items.reduce((s, i) => s + (i.qty || 1), 0)} 点</div>
  `;
  sendToPrinter(docShell(`KOT ${kot}`, body));
}

/* --------------------------------- BILL -------------------------------- */

export function printBill({
  outlet = "UPCOMING RESTRO — SHIBUYA MAIN",
  branch = "",
  slipNo = "",
  table = "",
  cover = 1,
  attendant = "",
  items = [],
  subtotal = 0,
  tax = 0,
  taxByRate = {},
  discount = 0,
  total = 0,
  paid = 0,
  change = 0,
  method = "",
  at = new Date(),
} = {}) {
  const lines = items
    .map((i) => {
      const { base, options } = splitOptions(i.name);
      const amount = (i.price || 0) * (i.qty || 1);
      return (
        `<div class="row b"><span>${esc(base)}</span><span>*${i.qty || 1}&nbsp;&nbsp;${yen(amount)}</span></div>` +
        options.map((o) => `<div class="opt">&gt;${esc(o)}</div>`).join("")
      );
    })
    .join("");

  const rateRows = Object.entries(taxByRate)
    .map(
      ([rate, amt]) =>
        `<div class="row"><span>（${esc(rate)}対象 消費税）</span><span>${yen(amt)}</span></div>`,
    )
    .join("");

  const body = `
    <div class="c b lg">${esc(outlet)}</div>
    ${branch ? `<div class="c">${esc(branch)}</div>` : ""}
    <div class="c">領　収　書</div>
    <div class="hr"></div>
    <div class="row"><span>${esc(stamp(at))}</span><span>${esc(table ? `卓 ${table}` : "")}</span></div>
    <div class="row"><span>客数</span><span>${esc(cover)} 名</span></div>
    <div class="row"><span>伝票番号</span><span>${esc(slipNo)}</span></div>
    <div class="row"><span>担当者</span><span>${esc(attendant)}</span></div>
    <div class="hr"></div>
    ${lines || '<div class="c">(no items)</div>'}
    <div class="hr"></div>
    <div class="row"><span>小計（税抜）</span><span>${yen(subtotal)}</span></div>
    ${discount ? `<div class="row"><span>値引き</span><span>-${yen(discount)}</span></div>` : ""}
    <div class="row"><span>消費税</span><span>${yen(tax)}</span></div>
    ${rateRows}
    <div class="hr"></div>
    <div class="row b lg"><span>合計（税込み）</span><span>${yen(total)}</span></div>
    <div class="hr"></div>
    <div class="row"><span>お預かり${method ? `（${esc(method)}）` : ""}</span><span>${yen(paid || total)}</span></div>
    <div class="row"><span>おつり</span><span>${yen(change)}</span></div>
    <div class="hr"></div>
    <div class="c">ありがとうございました</div>
    <div class="c">Thank you — please come again</div>
  `;
  sendToPrinter(docShell(`BILL ${slipNo}`, body));
}

export default { printKot, printBill };

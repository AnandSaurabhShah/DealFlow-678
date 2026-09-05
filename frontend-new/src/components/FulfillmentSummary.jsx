export default function FulfillmentSummary({ ordered, fulfilled, backordered, warehouseCount }) {
  const facts = [
    ['Ordered', ordered, 'units', 'text-slate-900'],
    ['Fulfilled', fulfilled, 'units', 'text-emerald-700'],
    ['Backordered', backordered, 'units', Number(backordered) > 0 ? 'text-amber-700' : 'text-slate-900'],
    ['Warehouses', warehouseCount, 'locations', 'text-violet-700'],
  ]
  return <section aria-label="Fulfillment summary" className="grid overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sm:grid-cols-2 xl:grid-cols-4">
    {facts.map(([label, value, unit, style]) => <div key={label} className="border-b border-slate-100 p-5 last:border-b-0 sm:odd:border-r xl:border-b-0 xl:border-r xl:last:border-r-0">
      <p className="text-[9px] font-semibold tracking-widest text-slate-400">{label.toUpperCase()}</p>
      <p className={`mt-2 font-display text-2xl font-bold ${style}`}>{value}</p>
      <p className="mt-0.5 text-[9px] text-slate-400">{value === '—' ? 'awaiting plan' : unit}</p>
    </div>)}
  </section>
}

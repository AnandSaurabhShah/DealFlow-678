import { formatMoney } from '../lib/format'
import Icon from './Icon'
import StatusBadge from './StatusBadge'

export default function OneTimeBillingSection({ lines, invoices, payment }) {
  return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    <div className="flex items-start gap-3 border-b border-slate-100 p-5">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700"><Icon name="receipt" /></span>
      <div><p className="text-[9px] font-semibold tracking-widest text-violet-600">ONE-TIME CHARGES</p><h3 className="mt-1 font-display text-base font-bold">Products and services</h3><p className="mt-1 text-xs text-slate-500">Charged once through a single invoice for this quotation.</p></div>
    </div>

    {lines.length ? <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-xs">
        <thead><tr className="border-b border-slate-100 bg-slate-50/70 text-[9px] tracking-wide text-slate-400"><th className="px-5 py-3">ITEM</th><th className="px-5 py-3">QTY</th><th className="px-5 py-3">UNIT PRICE</th><th className="px-5 py-3 text-right">TOTAL</th></tr></thead>
        <tbody>{lines.map(line => <tr key={line.id} className="border-b border-slate-100 last:border-b-0"><td className="px-5 py-4"><strong>{line.product?.name || 'Product'}</strong><p className="mt-1 text-[10px] text-slate-400">{line.product?.category}</p></td><td className="px-5 py-4">{line.qty}</td><td className="px-5 py-4">{formatMoney(Number(line.unitPrice))}</td><td className="px-5 py-4 text-right font-semibold">{formatMoney(Number(line.lineTotal))}</td></tr>)}</tbody>
      </table>
    </div> : <EmptyMessage>No one-time products are included in this quotation.</EmptyMessage>}

    <div className="border-t border-slate-100 bg-slate-50/50 p-5">
      <p className="mb-3 text-[9px] font-semibold tracking-widest text-slate-400">INVOICES</p>
      {invoices.length ? <div className="space-y-2">{invoices.map(invoice => <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4"><div><div className="flex items-center gap-2"><strong className="font-display text-lg">{formatMoney(Number(invoice.amount))}</strong><StatusBadge value={invoice.paid ? 'PAID' : 'UNPAID'} /></div><p className="mt-1 text-[10px] text-slate-400">One-time invoice</p></div>{!invoice.paid && <button disabled={payment.isPending} onClick={() => payment.onPay(invoice.id)} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"><Icon name="card" size={15} />{payment.isPending && payment.invoiceId === invoice.id ? 'Recording…' : 'Record Payment'}</button>}</div>)}</div> : <p className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-xs text-slate-500">No invoice has been generated yet.</p>}
    </div>
  </section>
}

function EmptyMessage({ children }) {
  return <p className="p-5 text-xs text-slate-500">{children}</p>
}

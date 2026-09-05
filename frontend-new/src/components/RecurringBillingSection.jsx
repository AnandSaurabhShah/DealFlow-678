import { useState } from 'react'
import { formatDateOnly, formatMoney } from '../lib/format'
import { configEnumLabel } from '../lib/configEnums'
import Icon from './Icon'
import StatusBadge from './StatusBadge'

export default function RecurringBillingSection({ lines, quantityChange, cancellation }) {
  return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    <div className="flex items-start gap-3 border-b border-slate-100 p-5">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-50 text-cyan-700"><Icon name="calendar" /></span>
      <div><p className="text-[9px] font-semibold tracking-widest text-cyan-700">RECURRING CHARGES</p><h3 className="mt-1 font-display text-base font-bold">Monthly subscriptions</h3><p className="mt-1 text-xs text-slate-500">Upcoming cycles, subscription adjustments, and credits.</p></div>
    </div>

    {lines.length ? <div className="space-y-4 p-5">{lines.map(line => <RecurringLineCard
      key={`${line.id}:${line.qty}`}
      line={line}
      quantityChange={quantityChange}
      cancellation={cancellation}
    />)}</div> : <p className="p-5 text-xs text-slate-500">No recurring subscriptions are included in this quotation.</p>}
  </section>
}

function RecurringLineCard({ line, quantityChange, cancellation }) {
  const [quantity, setQuantity] = useState(String(line.qty))
  const cancelled = line.qty === 0
  const quantityPending = quantityChange.isPending && quantityChange.lineId === line.id
  const cancellationPending = cancellation.isPending && cancellation.lineId === line.id
  const busy = quantityPending || cancellationPending

  const saveQuantity = event => {
    event.preventDefault()
    const value = Number(quantity)
    if (!Number.isInteger(value) || value < 1 || value === line.qty) return
    quantityChange.onChange(line.id, value)
  }

  const requestCancellation = () => {
    if (window.confirm(`Cancel ${line.product?.name || 'this subscription'} and credit the unused cycle?`)) {
      cancellation.onCancel(line.id)
    }
  }

  return <article className="overflow-hidden rounded-xl border border-slate-200">
    <div className="flex flex-wrap items-start justify-between gap-4 p-4 sm:p-5">
      <div><div className="flex flex-wrap items-center gap-2"><h4 className="font-display text-sm font-bold">{line.product?.name || 'Subscription'}</h4><span className="rounded-full bg-cyan-50 px-2 py-1 text-[9px] font-semibold text-cyan-700">{line.billingCycle || 'MONTHLY'}</span>{cancelled && <StatusBadge value="CANCELLED" />}</div><p className="mt-1 text-[10px] text-slate-400">{formatMoney(Number(line.unitPrice))} per {configEnumLabel(line.product?.unit)} · Current cycle {formatMoney(Number(line.lineTotal))}</p></div>
      {!cancelled && <form onSubmit={saveQuantity} className="flex items-end gap-2"><label className="text-[9px] font-semibold text-slate-500">QUANTITY<input aria-label={`${line.product?.name || 'Subscription'} quantity`} disabled={busy} className="mt-1 block w-20 rounded-lg border border-slate-200 px-2.5 py-2 text-xs outline-none focus:border-violet-500 disabled:bg-slate-50" type="number" min="1" step="1" value={quantity} onChange={event => setQuantity(event.target.value)} /></label><button disabled={busy || Number(quantity) === line.qty || !Number.isInteger(Number(quantity)) || Number(quantity) < 1} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50 disabled:opacity-40">{quantityPending ? 'Saving…' : 'Update'}</button><button type="button" disabled={busy} onClick={requestCancellation} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40">{cancellationPending ? 'Cancelling…' : 'Cancel'}</button></form>}
    </div>

    <div className="grid border-t border-slate-100 lg:grid-cols-[minmax(0,1fr)_280px] lg:divide-x lg:divide-slate-100">
      <div className="overflow-x-auto"><table className="w-full min-w-[440px] text-left text-[11px]"><thead><tr className="bg-slate-50/70 text-[8px] tracking-wide text-slate-400"><th className="px-4 py-2.5">BILLING DATE</th><th className="px-4 py-2.5">AMOUNT</th><th className="px-4 py-2.5">STATUS</th></tr></thead><tbody>{line.billingScheduleEntries.length ? line.billingScheduleEntries.map(entry => <tr key={entry.id} className="border-t border-slate-100"><td className="px-4 py-3">{formatDateOnly(entry.billingDate)}</td><td className="px-4 py-3 font-semibold">{formatMoney(Number(entry.amount))}</td><td className="px-4 py-3"><StatusBadge value={entry.status} /></td></tr>) : <tr><td colSpan="3" className="px-4 py-5 text-slate-400">No billing schedule generated yet.</td></tr>}</tbody></table></div>
      <div className="p-4"><p className="text-[8px] font-semibold tracking-widest text-slate-400">CREDIT NOTES</p>{line.creditNotes.length ? <div className="mt-3 space-y-2">{line.creditNotes.map(note => <div key={note.id} className="rounded-lg bg-emerald-50 p-3"><strong className="text-sm text-emerald-800">{formatMoney(Number(note.amount))}</strong><p className="mt-1 text-[9px] leading-relaxed text-emerald-700">{note.reason}</p></div>)}</div> : <p className="mt-3 text-[10px] text-slate-400">No credits issued.</p>}</div>
    </div>
  </article>
}

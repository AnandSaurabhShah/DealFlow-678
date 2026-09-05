import { formatDate, formatMoney, shortId } from '../lib/format'
import Icon from './Icon'
import StatusBadge from './StatusBadge'

export default function QuoteTable({ quotes, onSelect }) {
  if (!quotes.length) return <div className="grid min-h-72 place-items-center px-6 text-center">
    <div>
      <span className="mx-auto grid size-11 place-items-center rounded-xl bg-violet-50 text-violet-600"><Icon name="file" /></span>
      <h2 className="mt-3 text-sm font-bold">No quotations yet</h2>
      <p className="mt-1 text-xs text-slate-400">Create a quotation to begin the approval workflow.</p>
    </div>
  </div>

  return <div className="overflow-x-auto">
    <table className="w-full border-collapse text-left text-[11px]">
      <thead><tr className="border-y border-slate-100 bg-slate-50/70 text-[9px] tracking-wide text-slate-400">
        <th className="px-5 py-3 font-semibold">QUOTATION</th>
        <th className="px-5 py-3 font-semibold">CUSTOMER</th>
        <th className="px-5 py-3 font-semibold">STATUS</th>
        <th className="px-5 py-3 font-semibold">TOTAL</th>
        <th className="px-5 py-3 font-semibold">OWNER</th>
        <th className="px-5 py-3 font-semibold">UPDATED</th>
        <th />
      </tr></thead>
      <tbody>{quotes.map(quote => {
        const selectable = Boolean(onSelect)
        return <tr key={quote.id} onClick={selectable ? () => onSelect(quote) : undefined} className={`${selectable ? 'cursor-pointer hover:bg-violet-50/30' : ''} border-b border-slate-100 transition`}>
          <td className="px-5 py-3 font-bold">{shortId(quote.id)}</td>
          <td className="px-5 py-3"><div className="flex items-center gap-2.5"><span className="grid size-8 place-items-center rounded-lg bg-violet-50 text-[9px] font-bold text-violet-600">{quote.customerName.slice(0, 2).toUpperCase()}</span><strong>{quote.customerName}</strong></div></td>
          <td className="px-5 py-3"><StatusBadge value={quote.status} /></td>
          <td className="px-5 py-3 font-bold">{formatMoney(Number(quote.grandTotal))}</td>
          <td className="px-5 py-3">{quote.rep?.name || '—'}</td>
          <td className="px-5 py-3 text-slate-400">{formatDate(quote.updatedAt)}</td>
          <td className="px-5 py-3 text-right">{selectable && <Icon name="arrow" size={16} />}</td>
        </tr>
      })}</tbody>
    </table>
  </div>
}

import Icon from './Icon'
import StatusBadge from './StatusBadge'
import { formatMoney } from '../lib/format'

export default function QuoteTable({ quotes, onSelect, onDelete, compact = false }) {
  return <div className="overflow-x-auto">
    <table className="w-full border-collapse text-left text-[11px]">
      <thead><tr className="border-y border-slate-100 bg-slate-50/70 text-[9px] tracking-wide text-slate-400">
        <th className="px-5 py-3 font-semibold">QUOTATION</th><th className="px-5 py-3 font-semibold">CUSTOMER</th><th className="px-5 py-3 font-semibold">STATUS</th><th className="px-5 py-3 font-semibold">VALUE</th>{!compact && <th className="px-5 py-3 font-semibold">OWNER</th>}<th className="px-5 py-3 font-semibold">UPDATED</th><th />
      </tr></thead>
      <tbody>{quotes.map(quote => <tr key={quote.id} onClick={() => onSelect(quote)} className="cursor-pointer border-b border-slate-100 transition hover:bg-violet-50/30">
        <td className="px-5 py-3 font-bold">{quote.id}</td>
        <td className="px-5 py-3"><div className="flex items-center gap-2.5"><span className="grid size-8 place-items-center rounded-lg bg-violet-50 text-[9px] font-bold text-violet-600">{quote.customer.slice(0, 2).toUpperCase()}</span><div className="flex flex-col"><strong>{quote.customer}</strong><small className="text-[9px] text-slate-400">{quote.contact}</small></div></div></td>
        <td className="px-5 py-3"><StatusBadge value={quote.status} /></td><td className="px-5 py-3 font-bold">{formatMoney(quote.value)}</td>{!compact && <td className="px-5 py-3">{quote.owner}</td>}<td className="px-5 py-3 text-slate-400">{quote.updated}</td><td className="px-5 py-3"><div className="flex items-center justify-end gap-3">{!compact && onDelete && <button type="button" aria-label={`Delete ${quote.id}`} title={`Delete ${quote.id}`} onClick={event => { event.stopPropagation(); if (window.confirm(`Delete quotation ${quote.id}?`)) onDelete(quote.id) }} className="text-slate-300 transition hover:text-red-500"><Icon name="trash" size={15} /></button>}<Icon name="arrow" size={16} /></div></td>
      </tr>)}</tbody>
    </table>
  </div>
}

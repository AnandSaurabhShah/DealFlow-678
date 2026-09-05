const styles = {
  Draft: 'bg-slate-100 text-slate-500',
  Negotiation: 'bg-amber-50 text-amber-700',
  Approval: 'bg-red-50 text-red-600',
  Confirmed: 'bg-emerald-50 text-emerald-700',
}

export default function StatusBadge({ value }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[9px] font-semibold ${styles[value]}`}>
    <span className="size-1.5 rounded-full bg-current" />{value}
  </span>
}

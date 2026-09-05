const styles = {
  DRAFT: 'bg-slate-100 text-slate-500',
  CONFIRMED: 'bg-emerald-50 text-emerald-700',
}

export default function StatusBadge({ value }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[9px] font-semibold ${styles[value] || styles.DRAFT}`}>
    <span className="size-1.5 rounded-full bg-current" />{value?.toLowerCase()}
  </span>
}

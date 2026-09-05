import { useEffect, useRef, useState } from 'react'

export default function ApprovalDecisionDialog({ action, isSubmitting, onClose, onSubmit }) {
  const [reason, setReason] = useState('')
  const reasonRef = useRef(null)
  const dialogRef = useRef(null)
  const title = action === 'reject' ? 'Reject quotation' : 'Return for revision'

  useEffect(() => {
    reasonRef.current?.focus()
    const closeOnEscape = event => {
      if (event.key === 'Escape' && !isSubmitting) onClose()
      if (event.key !== 'Tab') return
      const focusable = dialogRef.current?.querySelectorAll('textarea, button:not(:disabled)')
      if (!focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [isSubmitting, onClose])

  const submit = event => {
    event.preventDefault()
    const cleanReason = reason.trim()
    if (cleanReason) onSubmit(cleanReason)
  }

  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" onMouseDown={event => event.target === event.currentTarget && !isSubmitting && onClose()}>
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="decision-title" className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
      <h2 id="decision-title" className="font-display text-lg font-bold text-slate-900">{title}</h2>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">Give the sales rep a clear reason for this decision.</p>
      <form className="mt-5" onSubmit={submit}>
        <label htmlFor="decision-reason" className="text-[11px] font-semibold text-slate-700">Reason</label>
        <textarea ref={reasonRef} id="decision-reason" required rows="4" value={reason} onChange={event => setReason(event.target.value)} className="mt-1.5 block w-full resize-y rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10" placeholder={action === 'reject' ? 'Why should this quotation be rejected?' : 'What needs to be revised?'} />
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" disabled={isSubmitting} onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-semibold disabled:opacity-50">Cancel</button>
          <button disabled={isSubmitting || !reason.trim()} className={`rounded-lg px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50 ${action === 'reject' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'}`}>{isSubmitting ? 'Submitting…' : title}</button>
        </div>
      </form>
    </section>
  </div>
}

import { useState } from 'react'
import { formatDate } from '../lib/format'

export default function NegotiationThread({ comments = [], lines = [], onSubmit, isSubmitting, currentAuthorType, disabled = false }) {
  const [content, setContent] = useState('')
  const [quotationLineId, setQuotationLineId] = useState('')
  const productByLine = new Map(lines.map(line => [line.id, line.product?.name]))
  const submit = event => {
    event.preventDefault()
    const value = content.trim()
    if (!value) return
    onSubmit({ content: value, ...(quotationLineId ? { quotationLineId } : {}) }, () => setContent(''))
  }

  return <div className="space-y-4">
    <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
      {!comments.length && <p className="rounded-lg bg-slate-50 p-4 text-xs text-slate-500">No messages yet. Start the conversation below.</p>}
      {comments.map(comment => {
        const mine = comment.authorType === currentAuthorType
        const product = comment.quotationLine?.product?.name || productByLine.get(comment.quotationLineId)
        return <article key={comment.id} className={`max-w-[88%] rounded-xl p-3 ${mine ? 'ml-auto bg-violet-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
          <div className={`mb-1 flex flex-wrap items-center gap-x-2 text-[9px] ${mine ? 'text-violet-100' : 'text-slate-400'}`}><strong>{comment.authorDisplayName}</strong>{product && <span>About {product}</span>}<time>{formatDate(comment.createdAt)}</time></div>
          <p className="whitespace-pre-wrap text-xs leading-relaxed">{comment.content}</p>
        </article>
      })}
    </div>
    <form onSubmit={submit} className="space-y-2 border-t border-slate-100 pt-4">
      <label className="block text-[10px] font-semibold text-slate-500">COMMENT ABOUT
        <select value={quotationLineId} onChange={event => setQuotationLineId(event.target.value)} disabled={disabled} className="mt-1.5 block w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-violet-500 disabled:bg-slate-50">
          <option value="">Entire quotation</option>
          {lines.map(line => <option key={line.id} value={line.id}>{line.product?.name}</option>)}
        </select>
      </label>
      <textarea aria-label="Comment" value={content} onChange={event => setContent(event.target.value)} disabled={disabled} maxLength={2000} rows="3" placeholder="Write a message…" className="block w-full resize-none rounded-lg border border-slate-200 p-3 text-xs outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 disabled:bg-slate-50" />
      <button disabled={disabled || isSubmitting || !content.trim()} className="rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">{isSubmitting ? 'Sending…' : 'Send comment'}</button>
    </form>
  </div>
}

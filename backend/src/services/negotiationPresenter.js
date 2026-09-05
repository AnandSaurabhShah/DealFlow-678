function shapeComment(comment, displayNames) {
  return {
    id: comment.id,
    quotationLineId: comment.quotationLineId,
    authorType: comment.authorType,
    content: comment.content,
    createdAt: comment.createdAt,
    authorDisplayName: displayNames.get(`${comment.authorType}:${comment.authorId}`) || "Unknown",
  };
}

function shapePortalQuotation(quotation, comments, displayNames) {
  return {
    id: quotation.id,
    customerName: quotation.customerName,
    status: quotation.status,
    subtotal: quotation.subtotal,
    totalDiscount: quotation.totalDiscount,
    grandTotal: quotation.grandTotal,
    createdAt: quotation.createdAt,
    updatedAt: quotation.updatedAt,
    lines: quotation.lines.map((line) => ({
      id: line.id,
      product: {
        id: line.product.id,
        name: line.product.name,
        category: line.product.category,
        unit: line.product.unit,
      },
      qty: line.qty,
      unitPrice: line.unitPrice,
      discountPercent: line.discountPercent,
      lineTotal: line.lineTotal,
    })),
    comments: comments.map((comment) => shapeComment(comment, displayNames)),
  };
}

function shapeInternalEvent(event, displayNames) {
  return {
    id: event.id,
    quotationLineId: event.quotationLineId,
    actorType: event.actorType,
    actorDisplayName: displayNames.get(`${event.actorType}:${event.actorId}`) || "Unknown",
    action: event.action,
    details: event.details,
    createdAt: event.createdAt,
  };
}

module.exports = { shapeComment, shapePortalQuotation, shapeInternalEvent };

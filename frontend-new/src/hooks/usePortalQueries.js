import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { portalApi } from '../api/portal'

export function usePortalQuotations({ page = 1, pageSize = 20 } = {}) {
  return useQuery({
    queryKey: ['portalQuotations', page, pageSize],
    queryFn: () => portalApi.listQuotations({ page, pageSize }),
    placeholderData: previousData => previousData,
  })
}

export function usePortalQuotation(id) {
  return useQuery({
    queryKey: ['portalQuotation', id],
    queryFn: () => portalApi.getQuotation(id),
    enabled: Boolean(id),
    staleTime: 0,
  })
}

function usePortalQuotationMutation(mutationFn) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: quotation => {
      queryClient.setQueryData(['portalQuotation', quotation.id], quotation)
      queryClient.invalidateQueries({ queryKey: ['portalQuotations'] })
    },
  })
}

export function usePortalComment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }) => portalApi.addComment(id, body),
    onSuccess: (_comment, variables) => queryClient.invalidateQueries({ queryKey: ['portalQuotation', variables.id] }),
  })
}

export function usePortalDiscount() {
  return usePortalQuotationMutation(({ id, lineId, discountPercent }) => portalApi.updateDiscount(id, lineId, discountPercent))
}

export function usePortalConfirm() {
  return usePortalQuotationMutation(portalApi.confirm)
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { configApi } from '../api/config'
import { billingApi } from '../api/billing'
import { quotationApi } from '../api/quotations'
import { useAuthStore } from '../store/authStore'

export function useProducts({ page = 1, pageSize = 20 } = {}) {
  return useQuery({
    queryKey: ['products', page, pageSize],
    queryFn: () => configApi.listProducts({ page, pageSize }),
    placeholderData: previousData => previousData,
  })
}

export function useConfigOptions() {
  return useQuery({
    queryKey: ['configOptions'],
    queryFn: configApi.getOptions,
    staleTime: Infinity,
  })
}

export function useQuotations({ page = 1, pageSize = 20, status } = {}) {
  const userId = useAuthStore(state => state.user?.id)
  return useQuery({
    queryKey: ['quotations', userId, page, pageSize, status || 'ALL'],
    queryFn: () => quotationApi.list({ page, pageSize, ...(status ? { status } : {}) }),
    enabled: Boolean(userId),
    placeholderData: previousData => previousData,
  })
}

export function useQuotation(id) {
  return useQuery({
    queryKey: ['quotation', id],
    queryFn: () => quotationApi.get(id),
    enabled: Boolean(id),
  })
}

export function usePendingApprovals({ page = 1, pageSize = 20, quotationId } = {}) {
  const user = useAuthStore(state => state.user)
  return useQuery({
    queryKey: ['pendingApprovals', user?.id, page, pageSize, quotationId || 'ALL'],
    queryFn: () => quotationApi.pending({ page, pageSize, ...(quotationId ? { quotationId } : {}) }),
    enabled: Boolean(user?.id && ['MANAGER', 'FINANCE'].includes(user.role)),
    placeholderData: previousData => previousData,
  })
}

export function useApprovalHistory(id) {
  return useQuery({
    queryKey: ['quotationHistory', id],
    queryFn: () => quotationApi.history(id),
    enabled: Boolean(id),
  })
}

function useApprovalMutation(mutationFn) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: quotation => {
      queryClient.setQueryData(['quotation', quotation.id], quotation)
      queryClient.invalidateQueries({ queryKey: ['quotations'] })
      queryClient.invalidateQueries({ queryKey: ['pendingApprovals'] })
      queryClient.invalidateQueries({ queryKey: ['quotationHistory', quotation.id] })
    },
    onError: (error, variables) => {
      if (error.response?.status !== 409) return
      const id = typeof variables === 'string' ? variables : variables.id
      queryClient.invalidateQueries({ queryKey: ['quotation', id] })
      queryClient.invalidateQueries({ queryKey: ['quotationHistory', id] })
      queryClient.invalidateQueries({ queryKey: ['pendingApprovals'] })
      queryClient.invalidateQueries({ queryKey: ['quotations'] })
    },
  })
}

export function useApproveQuotation() {
  return useApprovalMutation(quotationApi.approve)
}

export function useRejectQuotation() {
  return useApprovalMutation(({ id, reason }) => quotationApi.reject(id, reason))
}

export function useReturnQuotation() {
  return useApprovalMutation(({ id, reason }) => quotationApi.returnForRevision(id, reason))
}

export function useNegotiationThread(id, enabled = true) {
  return useQuery({
    queryKey: ['negotiationThread', id],
    queryFn: () => quotationApi.negotiationThread(id),
    enabled: Boolean(id && enabled),
    staleTime: 0,
  })
}

export function useSendToCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, customerId, customerEmail }) => quotationApi.sendToCustomer(id, { customerId, customerEmail }),
    onSuccess: ({ quotation }) => {
      queryClient.setQueryData(['quotation', quotation.id], quotation)
      queryClient.invalidateQueries({ queryKey: ['quotations'] })
      queryClient.invalidateQueries({ queryKey: ['negotiationThread', quotation.id] })
    },
  })
}

export function useInternalNegotiationComment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }) => quotationApi.addNegotiationComment(id, body),
    onSuccess: (_comment, variables) => queryClient.invalidateQueries({ queryKey: ['negotiationThread', variables.id] }),
  })
}

export function useFulfillmentSuggestion(id, enabled = true) {
  return useQuery({
    queryKey: ['fulfillmentSuggestion', id],
    queryFn: () => quotationApi.suggestFulfillment(id),
    enabled: Boolean(id && enabled),
    staleTime: 0,
  })
}

export function useFulfillmentBackorder(id, enabled = false) {
  return useQuery({
    queryKey: ['fulfillmentBackorder', id],
    queryFn: () => quotationApi.checkFulfillmentBackorder(id),
    enabled: Boolean(id && enabled),
    staleTime: 0,
  })
}

export function useConfirmFulfillment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, allocations }) => quotationApi.confirmFulfillment(id, allocations),
    onSuccess: quotation => {
      queryClient.setQueryData(['quotation', quotation.id], quotation)
      queryClient.removeQueries({ queryKey: ['fulfillmentSuggestion', quotation.id] })
      queryClient.invalidateQueries({ queryKey: ['fulfillmentBackorder', quotation.id] })
      queryClient.invalidateQueries({ queryKey: ['quotations'] })
    },
    onError: (error, variables) => {
      if (error.response?.data?.error?.code !== 'INVALID_QUOTATION_STATUS') return
      queryClient.invalidateQueries({ queryKey: ['quotation', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['quotations'] })
    },
  })
}

export function useBilling(id) {
  return useQuery({
    queryKey: ['billing', id],
    queryFn: () => billingApi.get(id),
    enabled: Boolean(id),
    staleTime: 0,
  })
}

function useBillingMutation(mutationFn) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: (result, variables) => {
      const quotationId = typeof variables === 'string' ? variables : variables.quotationId
      if (result?.oneTimeLines && result?.recurringLines) {
        queryClient.setQueryData(['billing', quotationId], result)
      } else {
        queryClient.invalidateQueries({ queryKey: ['billing', quotationId] })
      }
      queryClient.invalidateQueries({ queryKey: ['quotation', quotationId] })
      queryClient.invalidateQueries({ queryKey: ['quotations'] })
    },
    onError: (_error, variables) => {
      const quotationId = typeof variables === 'string' ? variables : variables.quotationId
      queryClient.invalidateQueries({ queryKey: ['billing', quotationId] })
    },
  })
}

export function useGenerateBilling() {
  return useBillingMutation(billingApi.generate)
}

export function useUpdateRecurringQuantity() {
  return useBillingMutation(({ quotationId, lineId, qty }) => (
    billingApi.updateQuantity(quotationId, lineId, qty)
  ))
}

export function useCancelRecurringLine() {
  return useBillingMutation(({ quotationId, lineId }) => billingApi.cancel(quotationId, lineId))
}

export function usePayInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ invoiceId }) => billingApi.payInvoice(invoiceId),
    onSuccess: (_invoice, variables) => {
      queryClient.invalidateQueries({ queryKey: ['billing', variables.quotationId] })
    },
  })
}

export function useAdminConfig(active = 'products', page = 1, pageSize = 20) {
  const isAdmin = useAuthStore(state => state.user?.role === 'ADMIN')
  return {
    products: useQuery({ queryKey: ['products', page, pageSize], queryFn: () => configApi.listProducts({ page, pageSize }), enabled: isAdmin && active === 'products', placeholderData: previousData => previousData }),
    priceLists: useQuery({ queryKey: ['priceLists', page, pageSize], queryFn: () => configApi.listPriceLists({ page, pageSize }), enabled: isAdmin && active === 'priceLists', placeholderData: previousData => previousData }),
    warehouses: useQuery({ queryKey: ['warehouses', page, pageSize], queryFn: () => configApi.listWarehouses({ page, pageSize }), enabled: isAdmin && active === 'warehouses', placeholderData: previousData => previousData }),
    discountTiers: useQuery({ queryKey: ['discountTiers', page, pageSize], queryFn: () => configApi.listDiscountTiers({ page, pageSize }), enabled: isAdmin && active === 'discountTiers', placeholderData: previousData => previousData }),
  }
}

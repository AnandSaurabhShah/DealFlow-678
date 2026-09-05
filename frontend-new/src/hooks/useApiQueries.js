import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { configApi } from '../api/config'
import { quotationApi } from '../api/quotations'
import { useAuthStore } from '../store/authStore'

export function useProducts() {
  return useQuery({ queryKey: ['products'], queryFn: configApi.listProducts })
}

export function useQuotations() {
  const userId = useAuthStore(state => state.user?.id)
  return useQuery({
    queryKey: ['quotations', userId],
    queryFn: quotationApi.list,
    enabled: Boolean(userId),
  })
}

export function useQuotation(id) {
  return useQuery({
    queryKey: ['quotation', id],
    queryFn: () => quotationApi.get(id),
    enabled: Boolean(id),
  })
}

export function usePendingApprovals() {
  const user = useAuthStore(state => state.user)
  return useQuery({
    queryKey: ['pendingApprovals', user?.id],
    queryFn: quotationApi.pending,
    enabled: Boolean(user?.id && ['MANAGER', 'FINANCE'].includes(user.role)),
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

export function useAdminConfig() {
  const isAdmin = useAuthStore(state => state.user?.role === 'ADMIN')
  return {
    products: useQuery({ queryKey: ['products'], queryFn: configApi.listProducts, enabled: isAdmin }),
    priceLists: useQuery({ queryKey: ['priceLists'], queryFn: configApi.listPriceLists, enabled: isAdmin }),
    warehouses: useQuery({ queryKey: ['warehouses'], queryFn: configApi.listWarehouses, enabled: isAdmin }),
    discountTiers: useQuery({ queryKey: ['discountTiers'], queryFn: configApi.listDiscountTiers, enabled: isAdmin }),
  }
}

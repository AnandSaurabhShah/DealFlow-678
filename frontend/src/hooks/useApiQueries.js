import { useQuery } from '@tanstack/react-query'
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

export function useAdminConfig() {
  const isAdmin = useAuthStore(state => state.user?.role === 'ADMIN')
  return {
    products: useQuery({ queryKey: ['products'], queryFn: configApi.listProducts, enabled: isAdmin }),
    priceLists: useQuery({ queryKey: ['priceLists'], queryFn: configApi.listPriceLists, enabled: isAdmin }),
    warehouses: useQuery({ queryKey: ['warehouses'], queryFn: configApi.listWarehouses, enabled: isAdmin }),
    discountTiers: useQuery({ queryKey: ['discountTiers'], queryFn: configApi.listDiscountTiers, enabled: isAdmin }),
  }
}

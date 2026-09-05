import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export const useCustomerAuthStore = create(
  persist(
    set => ({
      token: null,
      customer: null,
      setSession: ({ token, customer }) => set({ token, customer }),
      logout: () => set({ token: null, customer: null }),
    }),
    {
      name: 'dealflow-customer-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({ token: state.token, customer: state.customer }),
    },
  ),
)

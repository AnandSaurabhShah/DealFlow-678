import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export const useAuthStore = create(
  persist(
    set => ({
      token: null,
      user: null,
      setSession: ({ token, user }) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
    }),
    {
      name: 'dealflow-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({ token: state.token, user: state.user }),
    },
  ),
)

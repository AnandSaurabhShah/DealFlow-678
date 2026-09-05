import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000',
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use(config => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

apiClient.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401 && useAuthStore.getState().token) {
      useAuthStore.getState().logout()
    }
    return Promise.reject(error)
  },
)

export function getApiError(error, fallback = 'Something went wrong') {
  return error.response?.data?.error?.message || error.message || fallback
}

export default apiClient

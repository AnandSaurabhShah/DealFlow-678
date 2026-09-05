import axios from 'axios'
import { useCustomerAuthStore } from '../store/customerAuthStore'

const portalClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000',
  headers: { 'Content-Type': 'application/json' },
})

portalClient.interceptors.request.use(config => {
  const token = useCustomerAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

portalClient.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401 && useCustomerAuthStore.getState().token) {
      useCustomerAuthStore.getState().logout()
    }
    return Promise.reject(error)
  },
)

export default portalClient

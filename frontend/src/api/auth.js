import apiClient from './client'

export async function login(credentials) {
  const { data } = await apiClient.post('/api/auth/login', credentials)
  return data
}

export async function signup(details) {
  const { data } = await apiClient.post('/api/auth/signup', details)
  return data
}

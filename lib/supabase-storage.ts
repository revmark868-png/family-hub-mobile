import * as SecureStore from 'expo-secure-store'

const memoryFallback = new Map<string, string>()

const SupabaseSecureStorage = {
  getItem: async (key: string) => {
    try {
      return await SecureStore.getItemAsync(key)
    } catch {
      return memoryFallback.get(key) ?? null
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      await SecureStore.setItemAsync(key, value)
    } catch {
      memoryFallback.set(key, value)
    }
  },
  removeItem: async (key: string) => {
    try {
      await SecureStore.deleteItemAsync(key)
    } catch {
      memoryFallback.delete(key)
    }
  },
}

export default SupabaseSecureStorage

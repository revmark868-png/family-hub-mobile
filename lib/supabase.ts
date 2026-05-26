import 'react-native-url-polyfill/auto'
import * as SecureStore from 'expo-secure-store'
import { createClient } from '@supabase/supabase-js'

// ── 启动时校验环境变量 ─────────────────────────────────────────────────────
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''

if (!SUPABASE_URL || SUPABASE_URL === 'https://your-project.supabase.co') {
  throw new Error(
    '[Family Hub] EXPO_PUBLIC_SUPABASE_URL 未配置。\n' +
    '请复制 .env.example → .env 并填写真实的 Supabase 项目 URL。'
  )
}
if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY === 'your-public-anon-or-publishable-key') {
  throw new Error(
    '[Family Hub] EXPO_PUBLIC_SUPABASE_ANON_KEY 未配置。\n' +
    '请复制 .env.example → .env 并填写真实的 anon/publishable key。'
  )
}

// ── SecureStore adapter（Expo SDK 48+）────────────────────────────────────
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
}

// ── Supabase client ───────────────────────────────────────────────────────
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

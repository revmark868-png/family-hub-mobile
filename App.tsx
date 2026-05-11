import { StatusBar } from 'expo-status-bar'
import type { Session } from '@supabase/supabase-js'
import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { loadFamilyStatus, type FamilyStatus } from './lib/family'
import { supabase } from './lib/supabase'

type TabKey = 'home' | 'upload' | 'family' | 'notifications' | 'menu'
type Locale = 'zh' | 'en'

type AuthMode = 'signIn' | 'signUp'

const tabs: Array<{ key: TabKey; icon: string }> = [
  { key: 'home', icon: '⌂' },
  { key: 'upload', icon: '＋' },
  { key: 'family', icon: '♡' },
  { key: 'notifications', icon: '•' },
  { key: 'menu', icon: '☰' },
]

const copy = {
  zh: {
    appName: 'Family Hub',
    tagline: '把家人的日常，送到家里的记忆墙。',
    storeReady: 'Android 优先测试版 · 独立 APP 工程',
    languageSwitch: 'EN',
    auth: {
      title: '登录 Family Hub',
      subtitle: '先接入账号和家庭状态，下一步加入上传照片/视频。',
      email: '邮箱',
      password: '密码',
      signIn: '登录',
      signUp: '注册',
      useSignIn: '已有账号？登录',
      useSignUp: '没有账号？注册',
      loading: '处理中...',
    },
    common: {
      loading: '加载中...',
      retry: '重试',
      signOut: '退出登录',
      notReady: '这个功能下一步接入真实数据。',
    },
    tabs: {
      home: '首页',
      upload: '上传',
      family: '家庭',
      notifications: '通知',
      menu: '菜单',
    },
    home: {
      title: '今天的家庭记忆',
      subtitle: '已接入 Supabase 会话，正在读取你的家庭状态。',
      primary: '刷新状态',
      secondary: '邀请家人',
      noFamily: '还没有加入家庭',
      family: '当前家庭',
      role: '角色',
      members: '成员',
      uploads: '回忆',
    },
    upload: {
      title: '发送到家庭记忆墙',
      subtitle: '下一阶段接入 Android 相册选择、预览、标题备注和上传进度。',
      steps: ['选择照片 / 视频', '预览与裁剪', '填写标题 / 备注', '显示上传进度'],
      primary: '选择媒体',
    },
    family: {
      title: '家庭成员与邀请',
      subtitle: '下一阶段接入成员列表、邀请码、分享链接和二维码。',
      actions: ['复制邀请码', '分享邀请链接', '生成二维码', '显示设备入口'],
    },
    notifications: {
      title: '通知中心',
      subtitle: '集中查看新回忆、成员加入、审核提醒和显示设备状态。',
      items: ['新回忆提醒', '家人加入提醒', '上传审核提醒', '显示设备异常提醒'],
    },
    menu: {
      title: '目录菜单',
      subtitle: '低频功能集中在最后一个菜单 Tab。',
      items: ['个人资料', '头像编辑', '语言与主题', '通知设置', '记忆墙设置', '设备管理', '管理工具', '退出登录'],
    },
  },
  en: {
    appName: 'Family Hub',
    tagline: 'Send everyday family moments to the home memory wall.',
    storeReady: 'Android-first test build · Standalone APP project',
    languageSwitch: '中',
    auth: {
      title: 'Sign in to Family Hub',
      subtitle: 'Auth and family status first; media upload comes next.',
      email: 'Email',
      password: 'Password',
      signIn: 'Sign in',
      signUp: 'Create account',
      useSignIn: 'Already have an account? Sign in',
      useSignUp: 'No account? Create one',
      loading: 'Working...',
    },
    common: {
      loading: 'Loading...',
      retry: 'Retry',
      signOut: 'Sign out',
      notReady: 'This feature will connect to real data next.',
    },
    tabs: {
      home: 'Home',
      upload: 'Upload',
      family: 'Family',
      notifications: 'Notifications',
      menu: 'Menu',
    },
    home: {
      title: 'Today in your family',
      subtitle: 'Supabase session is connected; reading your family status.',
      primary: 'Refresh status',
      secondary: 'Invite family',
      noFamily: 'No family joined yet',
      family: 'Current family',
      role: 'Role',
      members: 'Members',
      uploads: 'Memories',
    },
    upload: {
      title: 'Send to family wall',
      subtitle: 'Next phase adds Android gallery picker, preview, title/note, and progress.',
      steps: ['Pick photo / video', 'Preview and crop', 'Add title / note', 'Show upload progress'],
      primary: 'Choose media',
    },
    family: {
      title: 'Family and invites',
      subtitle: 'Next phase connects members, invite code, share link, and QR code.',
      actions: ['Copy invite code', 'Share invite link', 'Generate QR code', 'Display device entry'],
    },
    notifications: {
      title: 'Notification center',
      subtitle: 'See new memories, joins, review reminders, and display device alerts.',
      items: ['New memory alert', 'Family joined alert', 'Upload review alert', 'Display device alert'],
    },
    menu: {
      title: 'Menu directory',
      subtitle: 'Keep lower-frequency tools in the final Menu tab.',
      items: ['Profile', 'Avatar editor', 'Language and theme', 'Notification settings', 'Wall settings', 'Device management', 'Admin tools', 'Sign out'],
    },
  },
} as const

function BulletList({ items }: { items: readonly string[] }) {
  return (
    <View style={styles.list}>
      {items.map((item) => (
        <View key={item} style={styles.listRow}>
          <Text style={styles.dot}>•</Text>
          <Text style={styles.listText}>{item}</Text>
        </View>
      ))}
    </View>
  )
}

function AuthScreen({ locale, setLocale, onAuthed }: { locale: Locale; setLocale: (locale: Locale) => void; onAuthed: (session: Session) => void }) {
  const [mode, setMode] = useState<AuthMode>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const t = copy[locale]

  async function submit() {
    if (!email.trim() || password.length < 6) {
      Alert.alert(t.auth.title, locale === 'zh' ? '请输入邮箱和至少 6 位密码。' : 'Enter an email and password with at least 6 characters.')
      return
    }

    setIsSubmitting(true)
    const result = mode === 'signIn'
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({ email: email.trim(), password })
    setIsSubmitting(false)

    if (result.error) {
      Alert.alert(t.auth.title, result.error.message)
      return
    }

    if (result.data.session) onAuthed(result.data.session)
    else Alert.alert(t.auth.title, locale === 'zh' ? '请检查邮箱完成验证。' : 'Check your email to finish verification.')
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.authShell}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>{t.storeReady}</Text>
            <Text style={styles.title}>{t.appName}</Text>
            <Text style={styles.tagline}>{t.tagline}</Text>
          </View>
          <TouchableOpacity onPress={() => setLocale(locale === 'zh' ? 'en' : 'zh')} style={styles.languageButton}>
            <Text style={styles.languageText}>{t.languageSwitch}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.authCard}>
          <Text style={styles.screenTitle}>{t.auth.title}</Text>
          <Text style={styles.screenSubtitle}>{t.auth.subtitle}</Text>
          <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder={t.auth.email} placeholderTextColor="#9a3412" style={styles.input} />
          <TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder={t.auth.password} placeholderTextColor="#9a3412" style={styles.input} />
          <TouchableOpacity onPress={submit} disabled={isSubmitting} style={styles.primaryButtonFull}>
            <Text style={styles.primaryButtonText}>{isSubmitting ? t.auth.loading : mode === 'signIn' ? t.auth.signIn : t.auth.signUp}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}>
            <Text style={styles.switchText}>{mode === 'signIn' ? t.auth.useSignUp : t.auth.useSignIn}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  )
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('home')
  const [locale, setLocale] = useState<Locale>('zh')
  const [session, setSession] = useState<Session | null>(null)
  const [isBooting, setIsBooting] = useState(true)
  const [familyStatus, setFamilyStatus] = useState<FamilyStatus | null>(null)
  const [familyError, setFamilyError] = useState<string | null>(null)
  const [isFamilyLoading, setIsFamilyLoading] = useState(false)
  const t = copy[locale]
  const active = useMemo(() => t[activeTab], [activeTab, t])

  async function refreshFamilyStatus(userId = session?.user.id) {
    if (!userId) return
    setIsFamilyLoading(true)
    setFamilyError(null)
    try {
      setFamilyStatus(await loadFamilyStatus(userId))
    } catch (error) {
      setFamilyError(error instanceof Error ? error.message : 'Failed to load family status')
    } finally {
      setIsFamilyLoading(false)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setIsBooting(false)
      if (data.session?.user.id) refreshFamilyStatus(data.session.user.id)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (nextSession?.user.id) refreshFamilyStatus(nextSession.user.id)
      else setFamilyStatus(null)
    })

    return () => listener.subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    setSession(null)
    setFamilyStatus(null)
  }

  if (isBooting) {
    return (
      <SafeAreaView style={styles.safeAreaCenter}>
        <ActivityIndicator color="#ea580c" />
      </SafeAreaView>
    )
  }

  if (!session) {
    return <AuthScreen locale={locale} setLocale={setLocale} onAuthed={setSession} />
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.shell}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>{t.storeReady}</Text>
            <Text style={styles.title}>{t.appName}</Text>
            <Text style={styles.tagline}>{session.user.email}</Text>
          </View>
          <TouchableOpacity onPress={() => setLocale(locale === 'zh' ? 'en' : 'zh')} style={styles.languageButton}>
            <Text style={styles.languageText}>{t.languageSwitch}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.heroCard}>
            <Text style={styles.screenTitle}>{active.title}</Text>
            <Text style={styles.screenSubtitle}>{active.subtitle}</Text>

            {activeTab === 'home' ? (
              <View style={styles.actionsRow}>
                <TouchableOpacity onPress={() => refreshFamilyStatus()} style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>{isFamilyLoading ? t.common.loading : t.home.primary}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => Alert.alert(t.tabs.family, t.common.notReady)} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>{t.home.secondary}</Text>
                </TouchableOpacity>
              </View>
            ) : 'primary' in active ? (
              <View style={styles.actionsRow}>
                <TouchableOpacity onPress={() => Alert.alert(active.title, t.common.notReady)} style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>{active.primary}</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          {activeTab === 'home' ? (
            <View style={styles.cardGrid}>
              {familyError ? (
                <View style={styles.smallCard}><Text style={styles.cardText}>{familyError}</Text></View>
              ) : familyStatus?.familyName ? (
                <>
                  <View style={styles.smallCard}><Text style={styles.cardNumber}>{t.home.family}</Text><Text style={styles.cardText}>{familyStatus.familyName}</Text></View>
                  <View style={styles.smallCard}><Text style={styles.cardNumber}>{t.home.role}</Text><Text style={styles.cardText}>{familyStatus.role ?? '-'}</Text></View>
                  <View style={styles.smallCard}><Text style={styles.cardNumber}>{t.home.members} / {t.home.uploads}</Text><Text style={styles.cardText}>{familyStatus.memberCount} / {familyStatus.recentUploads}</Text></View>
                </>
              ) : (
                <View style={styles.smallCard}><Text style={styles.cardText}>{t.home.noFamily}</Text></View>
              )}
            </View>
          ) : null}

          {activeTab === 'upload' && 'steps' in active ? <BulletList items={active.steps} /> : null}
          {activeTab === 'family' && 'actions' in active ? <BulletList items={active.actions} /> : null}
          {activeTab === 'notifications' && 'items' in active ? <BulletList items={active.items} /> : null}
          {activeTab === 'menu' && 'items' in active ? (
            <View style={styles.list}>
              {active.items.map((item) => (
                <TouchableOpacity key={item} onPress={item === t.menu.items[t.menu.items.length - 1] ? signOut : () => Alert.alert(item, t.common.notReady)} style={styles.menuRow}>
                  <Text style={styles.listText}>{item}</Text>
                  <Text style={styles.dot}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.tabBar}>
          {tabs.map((tab) => {
            const selected = tab.key === activeTab
            return (
              <TouchableOpacity key={tab.key} onPress={() => setActiveTab(tab.key)} style={[styles.tabItem, selected && styles.tabItemActive]}>
                <Text style={[styles.tabIcon, selected && styles.tabIconActive]}>{tab.icon}</Text>
                <Text style={[styles.tabLabel, selected && styles.tabLabelActive]}>{t.tabs[tab.key]}</Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff7ed' },
  safeAreaCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff7ed' },
  shell: { flex: 1, backgroundColor: '#fff7ed' },
  authShell: { flex: 1, justifyContent: 'center', backgroundColor: '#fff7ed' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  eyebrow: { color: '#9a3412', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  title: { marginTop: 8, color: '#431407', fontSize: 30, fontWeight: '800' },
  tagline: { marginTop: 6, maxWidth: 290, color: '#7c2d12', fontSize: 14, lineHeight: 20 },
  languageButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: '#fed7aa', borderWidth: 1, borderColor: '#fdba74' },
  languageText: { color: '#7c2d12', fontWeight: '800' },
  authCard: { margin: 20, borderRadius: 32, padding: 22, backgroundColor: '#431407', gap: 14 },
  input: { borderRadius: 18, backgroundColor: '#fff7ed', paddingHorizontal: 16, paddingVertical: 13, color: '#431407', fontSize: 15 },
  switchText: { color: '#fed7aa', textAlign: 'center', fontWeight: '700', marginTop: 4 },
  content: { padding: 20, paddingBottom: 120, gap: 16 },
  heroCard: { borderRadius: 32, padding: 22, backgroundColor: '#431407', shadowColor: '#7c2d12', shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.18, shadowRadius: 24, elevation: 8 },
  screenTitle: { color: '#ffedd5', fontSize: 25, fontWeight: '800', lineHeight: 32 },
  screenSubtitle: { marginTop: 10, color: '#fed7aa', fontSize: 15, lineHeight: 23 },
  actionsRow: { marginTop: 22, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  primaryButton: { borderRadius: 999, backgroundColor: '#f59e0b', paddingHorizontal: 18, paddingVertical: 12 },
  primaryButtonFull: { borderRadius: 999, backgroundColor: '#f59e0b', paddingHorizontal: 18, paddingVertical: 14, alignItems: 'center' },
  primaryButtonText: { color: '#431407', fontWeight: '800' },
  secondaryButton: { borderRadius: 999, borderWidth: 1, borderColor: '#fed7aa', paddingHorizontal: 18, paddingVertical: 12 },
  secondaryButtonText: { color: '#ffedd5', fontWeight: '700' },
  cardGrid: { gap: 12 },
  smallCard: { borderRadius: 24, padding: 18, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#fed7aa' },
  cardNumber: { color: '#ea580c', fontSize: 12, fontWeight: '800' },
  cardText: { marginTop: 6, color: '#431407', fontSize: 16, fontWeight: '700' },
  list: { borderRadius: 28, padding: 18, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#fed7aa', gap: 12 },
  listRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  menuRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  dot: { color: '#f97316', fontSize: 18, lineHeight: 22 },
  listText: { flex: 1, color: '#431407', fontSize: 15, lineHeight: 22, fontWeight: '600' },
  tabBar: { position: 'absolute', left: 14, right: 14, bottom: 16, flexDirection: 'row', borderRadius: 30, padding: 8, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#fed7aa', shadowColor: '#7c2d12', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.16, shadowRadius: 18, elevation: 10 },
  tabItem: { flex: 1, minHeight: 58, borderRadius: 22, alignItems: 'center', justifyContent: 'center', gap: 3 },
  tabItemActive: { backgroundColor: '#ffedd5' },
  tabIcon: { color: '#9a3412', fontSize: 20, fontWeight: '900' },
  tabIconActive: { color: '#ea580c' },
  tabLabel: { color: '#9a3412', fontSize: 10, fontWeight: '700' },
  tabLabelActive: { color: '#7c2d12' },
})

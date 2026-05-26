import { StatusBar } from 'expo-status-bar'
import type { Session } from '@supabase/supabase-js'
import QRCode from 'react-native-qrcode-svg'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { joinFamilyByCode, loadFamilyStatus, type FamilyStatus } from './lib/family'
import { supabase } from './lib/supabase'
import { createMobileUpload, pickSingleMemory, type PickedAsset } from './lib/upload'

// ── Types ─────────────────────────────────────────────────────────────────
type TabKey = 'home' | 'upload' | 'family' | 'notifications' | 'menu'
type Locale = 'zh' | 'en'
type AuthMode = 'signIn' | 'signUp'

const tabs: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: 'home',          label: '首页', icon: '⌂' },
  { key: 'upload',        label: '上传', icon: '＋' },
  { key: 'family',        label: '家庭', icon: '♡' },
  { key: 'notifications', label: '通知', icon: '●' },
  { key: 'menu',          label: '菜单', icon: '☰' },
]

// ── i18n ──────────────────────────────────────────────────────────────────
const copy = {
  zh: {
    appName: 'Family Hub',
    tagline: '把家人的日常，送到家里的记忆墙。',
    storeReady: 'Android 优先测试版',
    languageSwitch: 'EN',
    auth: {
      title: '登录 Family Hub',
      subtitle: '请填写账号和密码，然后点击登录。',
      email: '邮箱',
      password: '密码（至少6位）',
      signIn: '登录',
      signUp: '注册',
      useSignIn: '已有账号？登录',
      useSignUp: '没有账号？注册',
      loading: '处理中…',
      emailError: '请输入有效的邮箱地址。',
      passwordError: '密码至少需要 6 位。',
      verifyEmail: '请检查邮箱，完成验证后再登录。',
    },
    common: {
      loading: '加载中…',
      retry: '重试',
      signOut: '退出登录',
      notReady: '这个功能下一步接入真实数据。',
      error: '出错了',
    },
    tabs: { home: '首页', upload: '上传', family: '家庭', notifications: '通知', menu: '菜单' },
    home: {
      title: '今天的家庭记忆',
      subtitle: '已接入 Supabase，正在读取家庭状态。',
      refresh: '刷新状态',
      invite: '邀请家人',
      noFamily: '还没有加入家庭',
      family: '当前家庭',
      role: '角色',
      members: '成员',
      uploads: '回忆',
      latest: '最近回忆',
    },
    upload: {
      title: '发送到家庭记忆墙',
      subtitle: '选择照片或视频，填写标题后上传。',
      choose: '选择照片 / 视频',
      titleInput: '标题（必填）',
      noteInput: '备注（可选）',
      send: '上传到家庭墙',
      picked: '已选择',
      success: '上传成功！等待家庭墙同步。',
      noMedia: '请先选择照片或视频。',
      noTitle: '请填写标题。',
    },
    family: {
      title: '家庭成员与邀请',
      noInvite: '暂无可用邀请码',
      members: '家庭成员',
      incomingInvite: '检测到邀请链接',
      joinInvite: '加入这个家庭',
      joining: '正在加入…',
      shareInvite: '分享邀请',
      shareMessage: '加入我的 Family Hub 家庭，邀请码：{code}\n{link}',
      qrTitle: '扫码加入',
      qrHint: '家人可用 Family Hub APP 扫码加入。',
      joined: '已加入家庭：{name}',
    },
    notifications: {
      title: '通知中心',
      subtitle: '最近上传的记忆',
      empty: '暂无通知',
    },
    menu: {
      title: '目录菜单',
      items: ['个人资料', '头像编辑', '语言与主题', '通知设置', '记忆墙设置', '设备管理', '管理工具', '退出登录'],
    },
  },
  en: {
    appName: 'Family Hub',
    tagline: 'Send everyday moments to the home memory wall.',
    storeReady: 'Android-first test build',
    languageSwitch: '中',
    auth: {
      title: 'Sign in to Family Hub',
      subtitle: 'Enter your email and password to continue.',
      email: 'Email',
      password: 'Password (min 6 chars)',
      signIn: 'Sign in',
      signUp: 'Create account',
      useSignIn: 'Already have an account? Sign in',
      useSignUp: "No account? Create one",
      loading: 'Working…',
      emailError: 'Please enter a valid email address.',
      passwordError: 'Password must be at least 6 characters.',
      verifyEmail: 'Check your email to finish verification, then sign in.',
    },
    common: {
      loading: 'Loading…',
      retry: 'Retry',
      signOut: 'Sign out',
      notReady: 'This feature will connect to real data next.',
      error: 'Something went wrong',
    },
    tabs: { home: 'Home', upload: 'Upload', family: 'Family', notifications: 'Alerts', menu: 'Menu' },
    home: {
      title: 'Today in your family',
      subtitle: 'Connected to Supabase, loading family status.',
      refresh: 'Refresh',
      invite: 'Invite family',
      noFamily: 'No family joined yet',
      family: 'Family',
      role: 'Role',
      members: 'Members',
      uploads: 'Memories',
      latest: 'Latest memories',
    },
    upload: {
      title: 'Send to family wall',
      subtitle: 'Pick a photo or video, add a title, then upload.',
      choose: 'Choose photo / video',
      titleInput: 'Title (required)',
      noteInput: 'Note (optional)',
      send: 'Upload to family wall',
      picked: 'Selected',
      success: 'Upload complete! Waiting for family wall sync.',
      noMedia: 'Please select a photo or video first.',
      noTitle: 'Please enter a title.',
    },
    family: {
      title: 'Family and invites',
      noInvite: 'No invite code yet',
      members: 'Family members',
      incomingInvite: 'Invite link detected',
      joinInvite: 'Join this family',
      joining: 'Joining…',
      shareInvite: 'Share invite',
      shareMessage: 'Join my Family Hub family. Code: {code}\n{link}',
      qrTitle: 'Scan to join',
      qrHint: 'Family members can scan this QR code with the Family Hub app.',
      joined: 'Joined family: {name}',
    },
    notifications: {
      title: 'Notification center',
      subtitle: 'Recent uploads',
      empty: 'No notifications yet',
    },
    menu: {
      title: 'Menu',
      items: ['Profile', 'Avatar editor', 'Language & theme', 'Notification settings', 'Wall settings', 'Device management', 'Admin tools', 'Sign out'],
    },
  },
} as const

// ── Helpers ───────────────────────────────────────────────────────────────
function buildInviteLink(code: string) {
  return `familyhub://family?code=${encodeURIComponent(code)}`
}

function extractInviteCode(url: string | null): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    const raw = parsed.searchParams.get('code') || parsed.searchParams.get('invite')
    return raw?.trim().toUpperCase() || null
  } catch {
    const match = url.match(/[?&](?:code|invite)=([^&#]+)/i)
    return match?.[1] ? decodeURIComponent(match[1]).trim().toUpperCase() : null
  }
}

// ── Sub-components ────────────────────────────────────────────────────────
function EmptyCard({ text }: { text: string }) {
  return (
    <View style={styles.smallCard}>
      <Text style={styles.cardText}>{text}</Text>
    </View>
  )
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  )
}

// ── Upload progress bar ───────────────────────────────────────────────────
function ProgressBar({ phase, percent }: { phase: string; percent: number }) {
  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${percent}%` as any }]} />
      </View>
      <Text style={styles.progressLabel}>{phase} {percent}%</Text>
    </View>
  )
}

// ── Auth Screen ───────────────────────────────────────────────────────────
function AuthScreen({
  locale,
  setLocale,
  onAuthed,
}: {
  locale: Locale
  setLocale: (l: Locale) => void
  onAuthed: (session: Session) => void
}) {
  const [mode, setMode] = useState<AuthMode>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const t = copy[locale]

  const emailRef = useRef<TextInput>(null)
  const passwordRef = useRef<TextInput>(null)

  async function submit() {
    const trimmedEmail = email.trim()
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      Alert.alert(t.auth.title, t.auth.emailError)
      return
    }
    if (password.length < 6) {
      Alert.alert(t.auth.title, t.auth.passwordError)
      return
    }

    setIsSubmitting(true)
    try {
      const result = mode === 'signIn'
        ? await supabase.auth.signInWithPassword({ email: trimmedEmail, password })
        : await supabase.auth.signUp({ email: trimmedEmail, password })

      if (result.error) {
        Alert.alert(t.auth.title, result.error.message)
        return
      }
      if (result.data.session) {
        onAuthed(result.data.session)
      } else {
        Alert.alert(t.auth.title, t.auth.verifyEmail)
      }
    } catch (err) {
      Alert.alert(t.common.error, err instanceof Error ? err.message : String(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <ScrollView
          contentContainerStyle={styles.authShell}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>{t.storeReady}</Text>
              <Text style={styles.title}>{t.appName}</Text>
              <Text style={styles.tagline}>{t.tagline}</Text>
            </View>
            <TouchableOpacity
              onPress={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
              style={styles.languageButton}
            >
              <Text style={styles.languageText}>{t.languageSwitch}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.authCard}>
            <Text style={styles.screenTitle}>{t.auth.title}</Text>
            <Text style={styles.screenSubtitle}>{t.auth.subtitle}</Text>

            <TextInput
              ref={emailRef}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              placeholder={t.auth.email}
              placeholderTextColor="#9a3412"
              style={styles.input}
            />
            <TextInput
              ref={passwordRef}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={submit}
              placeholder={t.auth.password}
              placeholderTextColor="#9a3412"
              style={styles.input}
            />

            <TouchableOpacity
              onPress={submit}
              disabled={isSubmitting}
              style={[styles.primaryButtonFull, isSubmitting && styles.disabledButton]}
            >
              <Text style={styles.primaryButtonText}>
                {isSubmitting ? t.auth.loading : mode === 'signIn' ? t.auth.signIn : t.auth.signUp}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}>
              <Text style={styles.switchText}>
                {mode === 'signIn' ? t.auth.useSignUp : t.auth.useSignIn}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('home')
  const [locale, setLocale] = useState<Locale>('zh')
  const [session, setSession] = useState<Session | null>(null)
  const [isBooting, setIsBooting] = useState(true)

  // Family state
  const [familyStatus, setFamilyStatus] = useState<FamilyStatus | null>(null)
  const [familyError, setFamilyError] = useState<string | null>(null)
  const [isFamilyLoading, setIsFamilyLoading] = useState(false)

  // Upload state
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadNote, setUploadNote] = useState('')
  const [pickedAsset, setPickedAsset] = useState<Awaited<ReturnType<typeof pickSingleMemory>>>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ phase: string; percent: number } | null>(null)
  const [uploadMessage, setUploadMessage] = useState<string | null>(null)

  // Invite state
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(null)
  const [inviteMessage, setInviteMessage] = useState<string | null>(null)
  const [isJoiningInvite, setIsJoiningInvite] = useState(false)

  const t = copy[locale]

  // ── Family loader (stable reference) ─────────────────────────────────
  const refreshFamilyStatus = useCallback(async (userId: string) => {
    setIsFamilyLoading(true)
    setFamilyError(null)
    try {
      setFamilyStatus(await loadFamilyStatus(userId))
    } catch (err) {
      setFamilyError(err instanceof Error ? err.message : '加载家庭状态失败')
    } finally {
      setIsFamilyLoading(false)
    }
  }, [])

  // ── Invite capture ────────────────────────────────────────────────────
  const captureInviteFromUrl = useCallback((url: string | null) => {
    const code = extractInviteCode(url)
    if (!code) return
    setPendingInviteCode(code)
    setInviteMessage(null)
    setActiveTab('family')
  }, [])

  // ── Boot: session + initial URL ───────────────────────────────────────
  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setIsBooting(false)
      if (data.session?.user.id) {
        refreshFamilyStatus(data.session.user.id)
      }
    })

    Linking.getInitialURL().then(captureInviteFromUrl).catch(() => undefined)

    const urlListener = Linking.addEventListener('url', ({ url }) => captureInviteFromUrl(url))

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return
      setSession(nextSession)
      if (nextSession?.user.id) {
        refreshFamilyStatus(nextSession.user.id)
      } else {
        setFamilyStatus(null)
      }
    })

    return () => {
      mounted = false
      authListener.subscription.unsubscribe()
      urlListener.remove()
    }
  }, [refreshFamilyStatus, captureInviteFromUrl])

  // ── Auto-join when session + pending invite both ready ────────────────
  useEffect(() => {
    if (!session?.user.id || !pendingInviteCode || isJoiningInvite) return
    acceptPendingInvite(pendingInviteCode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id, pendingInviteCode])

  // ── Accept invite ─────────────────────────────────────────────────────
  async function acceptPendingInvite(code: string) {
    if (!session?.user.id) { setActiveTab('family'); return }
    setIsJoiningInvite(true)
    setInviteMessage(null)
    try {
      const result = await joinFamilyByCode(code)
      if (result.ok) {
        setInviteMessage(t.family.joined.replace('{name}', result.familyName))
        setPendingInviteCode(null)
        await refreshFamilyStatus(session.user.id)
      } else {
        setInviteMessage(result.message)
      }
    } catch (err) {
      setInviteMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setIsJoiningInvite(false)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setSession(null)
    setFamilyStatus(null)
  }

  async function shareInvite(code?: string | null) {
    if (!code) { Alert.alert(t.family.title, t.family.noInvite); return }
    const link = buildInviteLink(code)
    await Share.share({
      message: t.family.shareMessage.replace('{code}', code).replace('{link}', link),
      url: link,
    })
  }

  // ── Pick media ────────────────────────────────────────────────────────
  async function chooseMedia() {
    try {
      const asset = await pickSingleMemory()
      if (!asset) return
      setPickedAsset(asset)
      setUploadMessage(null)
      setUploadProgress(null)
      if (!uploadTitle.trim()) {
        setUploadTitle(asset.fileName?.replace(/\.[^.]+$/, '') || '')
      }
    } catch (err) {
      Alert.alert(t.tabs.upload, err instanceof Error ? err.message : String(err))
    }
  }

  // ── Upload ────────────────────────────────────────────────────────────
  async function uploadMemory() {
    if (!pickedAsset) { Alert.alert(t.tabs.upload, t.upload.noMedia); return }
    if (!uploadTitle.trim()) { Alert.alert(t.tabs.upload, t.upload.noTitle); return }
    if (!session?.user.id) return

    setIsUploading(true)
    setUploadMessage(null)
    setUploadProgress({ phase: '准备中…', percent: 0 })

    try {
      await createMobileUpload({
        userId: session.user.id,
        title: uploadTitle.trim(),
        note: uploadNote,
        asset: pickedAsset,
        onProgress: (phase, percent) => setUploadProgress({ phase, percent }),
      })
      setUploadMessage(t.upload.success)
      setPickedAsset(null)
      setUploadTitle('')
      setUploadNote('')
      refreshFamilyStatus(session.user.id)
    } catch (err) {
      setUploadMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setIsUploading(false)
      setUploadProgress(null)
    }
  }

  // ── Tab labels (locale-aware) ─────────────────────────────────────────
  const tabLabels = useMemo(() => t.tabs, [t])

  // ── Booting ───────────────────────────────────────────────────────────
  if (isBooting) {
    return (
      <SafeAreaView style={styles.safeAreaCenter}>
        <ActivityIndicator size="large" color="#ea580c" />
        <Text style={[styles.sectionSubtitle, { marginTop: 16 }]}>
          {locale === 'zh' ? '启动中…' : 'Starting…'}
        </Text>
      </SafeAreaView>
    )
  }

  // ── Not signed in ─────────────────────────────────────────────────────
  if (!session) {
    return <AuthScreen locale={locale} setLocale={setLocale} onAuthed={setSession} />
  }

  // ── Main UI ───────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.shell}>

        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>{t.storeReady}</Text>
            <Text style={styles.title}>{t.appName}</Text>
            <Text style={styles.tagline} numberOfLines={1}>{session.user.email}</Text>
          </View>
          <TouchableOpacity
            onPress={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
            style={styles.languageButton}
          >
            <Text style={styles.languageText}>{t.languageSwitch}</Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Hero card */}
            <View style={styles.heroCard}>
              <Text style={styles.screenTitle}>
                {activeTab === 'home' ? t.home.title
                  : activeTab === 'upload' ? t.upload.title
                  : activeTab === 'family' ? t.family.title
                  : activeTab === 'notifications' ? t.notifications.title
                  : t.menu.title}
              </Text>
              <Text style={styles.screenSubtitle}>
                {activeTab === 'home' ? t.home.subtitle
                  : activeTab === 'upload' ? t.upload.subtitle
                  : activeTab === 'notifications' ? t.notifications.subtitle
                  : null}
              </Text>

              {/* Hero actions */}
              {activeTab === 'home' && (
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    onPress={() => session?.user.id && refreshFamilyStatus(session.user.id)}
                    style={styles.primaryButton}
                  >
                    <Text style={styles.primaryButtonText}>
                      {isFamilyLoading ? t.common.loading : t.home.refresh}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { setActiveTab('family') }}
                    style={styles.secondaryButton}
                  >
                    <Text style={styles.secondaryButtonText}>{t.home.invite}</Text>
                  </TouchableOpacity>
                </View>
              )}
              {activeTab === 'upload' && (
                <View style={styles.actionsRow}>
                  <TouchableOpacity onPress={chooseMedia} style={styles.primaryButton}>
                    <Text style={styles.primaryButtonText}>{t.upload.choose}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* ── HOME tab ─────────────────────────────────────────── */}
            {activeTab === 'home' && (
              <View style={styles.cardGrid}>
                {familyError ? (
                  <EmptyCard text={familyError} />
                ) : familyStatus?.familyName ? (
                  <>
                    <View style={styles.smallCard}>
                      <Text style={styles.cardNumber}>{t.home.family}</Text>
                      <Text style={styles.cardText}>{familyStatus.familyName}</Text>
                    </View>
                    <View style={styles.smallCard}>
                      <Text style={styles.cardNumber}>{t.home.role}</Text>
                      <Text style={styles.cardText}>{familyStatus.role ?? '-'}</Text>
                    </View>
                    <View style={styles.smallCard}>
                      <Text style={styles.cardNumber}>{t.home.members} / {t.home.uploads}</Text>
                      <Text style={styles.cardText}>{familyStatus.memberCount} / {familyStatus.recentUploads}</Text>
                    </View>
                  </>
                ) : (
                  <EmptyCard text={t.home.noFamily} />
                )}

                {(familyStatus?.uploads.length ?? 0) > 0 && (
                  <View style={styles.list}>
                    <SectionTitle title={t.home.latest} />
                    {familyStatus!.uploads.slice(0, 4).map((item) => (
                      <View key={item.id} style={styles.mediaRow}>
                        <View style={styles.mediaThumb}>
                          {item.thumbnailUrl
                            ? <Image source={{ uri: item.thumbnailUrl }} style={styles.mediaImage} />
                            : <Text style={styles.mediaEmoji}>{item.mediaType === 'videos' ? '🎬' : '🖼️'}</Text>}
                        </View>
                        <View style={styles.mediaTextWrap}>
                          <Text style={styles.mediaTitle} numberOfLines={1}>{item.title}</Text>
                          <Text style={styles.mediaMeta}>
                            {item.displayScope ?? 'pending'} · {new Date(item.createdAt).toLocaleDateString()}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* ── UPLOAD tab ────────────────────────────────────────── */}
            {activeTab === 'upload' && (
              <View style={styles.list}>
                <TextInput
                  value={uploadTitle}
                  onChangeText={setUploadTitle}
                  placeholder={t.upload.titleInput}
                  placeholderTextColor="#9a3412"
                  style={styles.inputLight}
                  returnKeyType="next"
                />
                <TextInput
                  value={uploadNote}
                  onChangeText={setUploadNote}
                  placeholder={t.upload.noteInput}
                  placeholderTextColor="#9a3412"
                  style={[styles.inputLight, styles.noteInput]}
                  multiline
                />

                {pickedAsset ? (
                  <View style={styles.pickedCard}>
                    {pickedAsset.mimeType?.startsWith('video/') ? (
                      <View style={[styles.pickedPreview, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#431407' }]}>
                        <Text style={{ fontSize: 48 }}>🎬</Text>
                      </View>
                    ) : (
                      <Image source={{ uri: pickedAsset.uri }} style={styles.pickedPreview} />
                    )}
                    <Text style={[styles.listText, { padding: 10 }]} numberOfLines={1}>
                      {t.upload.picked}: {pickedAsset.fileName ?? pickedAsset.uri.split('/').pop()}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.uploadHint}>
                    <Text style={styles.uploadHintText}>
                      {locale === 'zh' ? '还没有选择媒体文件' : 'No media selected yet'}
                    </Text>
                  </View>
                )}

                {uploadProgress && (
                  <ProgressBar phase={uploadProgress.phase} percent={uploadProgress.percent} />
                )}

                <TouchableOpacity
                  onPress={uploadMemory}
                  disabled={isUploading || !pickedAsset}
                  style={[styles.primaryButtonFull, (!pickedAsset || isUploading) && styles.disabledButton]}
                >
                  <Text style={styles.primaryButtonText}>
                    {isUploading ? t.common.loading : t.upload.send}
                  </Text>
                </TouchableOpacity>

                {uploadMessage ? (
                  <Text style={[styles.listText, { textAlign: 'center' }]}>{uploadMessage}</Text>
                ) : null}
              </View>
            )}

            {/* ── FAMILY tab ────────────────────────────────────────── */}
            {activeTab === 'family' && (
              <View style={styles.list}>
                {pendingInviteCode && (
                  <View style={styles.pendingInviteCard}>
                    <Text style={styles.cardNumber}>{t.family.incomingInvite}</Text>
                    <Text style={[styles.inviteCode, { color: '#431407' }]}>{pendingInviteCode}</Text>
                    <TouchableOpacity
                      onPress={() => acceptPendingInvite(pendingInviteCode)}
                      disabled={isJoiningInvite || !session?.user.id}
                      style={[styles.primaryButtonFull, isJoiningInvite && styles.disabledButton]}
                    >
                      <Text style={styles.primaryButtonText}>
                        {isJoiningInvite ? t.family.joining : t.family.joinInvite}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {inviteMessage ? <EmptyCard text={inviteMessage} /> : null}

                <SectionTitle
                  title={familyStatus?.familyName ?? t.family.title}
                  subtitle={familyStatus?.inviteCode
                    ? `${locale === 'zh' ? '邀请码' : 'Invite code'}: ${familyStatus.inviteCode}`
                    : t.family.noInvite}
                />

                <TouchableOpacity
                  onPress={() => shareInvite(familyStatus?.inviteCode)}
                  style={styles.inviteCard}
                >
                  <Text style={styles.inviteCode}>{familyStatus?.inviteCode ?? '— — — —'}</Text>
                  <Text style={styles.inviteHint}>
                    {familyStatus?.inviteCode ? t.family.shareInvite : t.family.noInvite}
                  </Text>
                </TouchableOpacity>

                {familyStatus?.inviteCode ? (
                  <View style={styles.qrCard}>
                    <Text style={styles.cardNumber}>{t.family.qrTitle}</Text>
                    <View style={styles.qrBox}>
                      <QRCode
                        value={buildInviteLink(familyStatus.inviteCode)}
                        size={178}
                        backgroundColor="#fff7ed"
                        color="#431407"
                      />
                    </View>
                    <Text style={styles.cardText}>{t.family.qrHint}</Text>
                  </View>
                ) : null}

                <SectionTitle title={t.family.members} />
                {familyStatus?.members.length ? (
                  familyStatus.members.map((member) => (
                    <View key={member.userId} style={styles.memberRow}>
                      <View style={styles.avatarCircle}>
                        {member.avatarUrl
                          ? <Image source={{ uri: member.avatarUrl }} style={styles.avatarImage} />
                          : <Text style={styles.avatarText}>
                              {(member.name || member.role || '?').slice(0, 1).toUpperCase()}
                            </Text>}
                      </View>
                      <View style={styles.mediaTextWrap}>
                        <Text style={styles.mediaTitle}>{member.name ?? member.userId.slice(0, 8)}</Text>
                        <Text style={styles.mediaMeta}>{member.role ?? 'member'} · {member.status ?? 'active'}</Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <EmptyCard text={t.home.noFamily} />
                )}
              </View>
            )}

            {/* ── NOTIFICATIONS tab ─────────────────────────────────── */}
            {activeTab === 'notifications' && (
              <View style={styles.list}>
                {(familyStatus?.uploads ?? []).length > 0 ? (
                  familyStatus!.uploads.slice(0, 8).map((item) => (
                    <View key={item.id} style={styles.noticeRow}>
                      <Text style={styles.noticeIcon}>
                        {item.mediaType === 'videos' ? '🎬' : '✨'}
                      </Text>
                      <View style={styles.mediaTextWrap}>
                        <Text style={styles.mediaTitle} numberOfLines={1}>{item.title}</Text>
                        <Text style={styles.mediaMeta}>
                          {item.displayScope ?? 'pending'} · {new Date(item.createdAt).toLocaleString()}
                        </Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <EmptyCard text={t.notifications.empty} />
                )}
              </View>
            )}

            {/* ── MENU tab ──────────────────────────────────────────── */}
            {activeTab === 'menu' && (
              <View style={styles.list}>
                {t.menu.items.map((item, idx) => {
                  const isSignOut = idx === t.menu.items.length - 1
                  return (
                    <TouchableOpacity
                      key={item}
                      onPress={isSignOut ? signOut : () => Alert.alert(item, t.common.notReady)}
                      style={styles.menuRow}
                    >
                      <Text style={[styles.listText, isSignOut && { color: '#dc2626' }]}>{item}</Text>
                      <Text style={styles.dot}>›</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Bottom Tab Bar */}
        <View style={styles.tabBar}>
          {tabs.map((tab) => {
            const selected = tab.key === activeTab
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[styles.tabItem, selected && styles.tabItemActive]}
              >
                <Text style={[styles.tabIcon, selected && styles.tabIconActive]}>{tab.icon}</Text>
                <Text style={[styles.tabLabel, selected && styles.tabLabelActive]}>
                  {t.tabs[tab.key]}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>
    </SafeAreaView>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea:        { flex: 1, backgroundColor: '#fff7ed' },
  safeAreaCenter:  { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff7ed' },
  shell:           { flex: 1, backgroundColor: '#fff7ed' },
  authShell:       { flexGrow: 1, justifyContent: 'center', padding: 20 },

  header:          { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  eyebrow:         { color: '#9a3412', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  title:           { marginTop: 6, color: '#431407', fontSize: 28, fontWeight: '800' },
  tagline:         { marginTop: 4, color: '#7c2d12', fontSize: 13, lineHeight: 18 },
  languageButton:  { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: '#fed7aa', borderWidth: 1, borderColor: '#fdba74' },
  languageText:    { color: '#7c2d12', fontWeight: '800', fontSize: 13 },

  authCard:        { borderRadius: 32, padding: 22, backgroundColor: '#431407', gap: 14, marginTop: 24 },
  input:           { borderRadius: 18, backgroundColor: '#fff7ed', paddingHorizontal: 16, paddingVertical: 13, color: '#431407', fontSize: 15 },
  inputLight:      { borderRadius: 18, backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa', paddingHorizontal: 16, paddingVertical: 13, color: '#431407', fontSize: 15 },
  noteInput:       { minHeight: 80, textAlignVertical: 'top' },
  switchText:      { color: '#fed7aa', textAlign: 'center', fontWeight: '700', marginTop: 4 },

  content:         { padding: 20, paddingBottom: 130, gap: 16 },
  heroCard:        { borderRadius: 32, padding: 22, backgroundColor: '#431407', elevation: 6, shadowColor: '#7c2d12', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 16 },
  screenTitle:     { color: '#ffedd5', fontSize: 22, fontWeight: '800', lineHeight: 30 },
  screenSubtitle:  { marginTop: 8, color: '#fed7aa', fontSize: 14, lineHeight: 21 },
  actionsRow:      { marginTop: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  primaryButton:     { borderRadius: 999, backgroundColor: '#f59e0b', paddingHorizontal: 18, paddingVertical: 12 },
  primaryButtonFull: { borderRadius: 999, backgroundColor: '#f59e0b', paddingHorizontal: 18, paddingVertical: 14, alignItems: 'center' },
  disabledButton:    { opacity: 0.5 },
  primaryButtonText: { color: '#431407', fontWeight: '800', fontSize: 15 },
  secondaryButton:   { borderRadius: 999, borderWidth: 1, borderColor: '#fed7aa', paddingHorizontal: 18, paddingVertical: 12 },
  secondaryButtonText: { color: '#ffedd5', fontWeight: '700' },

  cardGrid:   { gap: 12 },
  smallCard:  { borderRadius: 24, padding: 18, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#fed7aa' },
  cardNumber: { color: '#ea580c', fontSize: 12, fontWeight: '800' },
  cardText:   { marginTop: 4, color: '#431407', fontSize: 16, fontWeight: '700' },

  list:          { borderRadius: 28, padding: 18, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#fed7aa', gap: 12 },
  sectionHeader: { gap: 3 },
  sectionTitle:  { color: '#431407', fontSize: 17, fontWeight: '900' },
  sectionSubtitle: { color: '#9a3412', fontSize: 13, lineHeight: 18, fontWeight: '600' },
  menuRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  dot:           { color: '#f97316', fontSize: 18, lineHeight: 22 },
  listText:      { flex: 1, color: '#431407', fontSize: 15, lineHeight: 22, fontWeight: '600' },

  mediaRow:      { flexDirection: 'row', gap: 12, alignItems: 'center', borderRadius: 20, backgroundColor: '#fff7ed', padding: 10 },
  mediaThumb:    { width: 60, height: 60, borderRadius: 16, overflow: 'hidden', backgroundColor: '#431407', alignItems: 'center', justifyContent: 'center' },
  mediaImage:    { width: '100%', height: '100%' },
  mediaEmoji:    { fontSize: 22 },
  mediaTextWrap: { flex: 1, minWidth: 0 },
  mediaTitle:    { color: '#431407', fontSize: 15, fontWeight: '900' },
  mediaMeta:     { marginTop: 3, color: '#9a3412', fontSize: 12, fontWeight: '700' },

  pickedCard:    { borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: '#fed7aa', backgroundColor: '#fff7ed' },
  pickedPreview: { width: '100%', height: 200, backgroundColor: '#431407' },

  uploadHint:     { borderRadius: 20, backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa', padding: 20, alignItems: 'center' },
  uploadHintText: { color: '#9a3412', fontSize: 14, fontWeight: '600' },

  progressWrap:  { gap: 6 },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: '#fed7aa', overflow: 'hidden' },
  progressFill:  { height: '100%', backgroundColor: '#f59e0b', borderRadius: 3 },
  progressLabel: { color: '#7c2d12', fontSize: 12, fontWeight: '700', textAlign: 'right' },

  inviteCard:        { borderRadius: 24, padding: 18, backgroundColor: '#431407', gap: 6 },
  pendingInviteCard: { borderRadius: 24, padding: 18, backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fdba74', gap: 12 },
  inviteCode:        { color: '#ffedd5', fontSize: 26, fontWeight: '900', letterSpacing: 2 },
  inviteHint:        { color: '#fed7aa', fontSize: 13, fontWeight: '700' },

  qrCard: { borderRadius: 24, padding: 18, backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa', gap: 12, alignItems: 'center' },
  qrBox:  { borderRadius: 20, padding: 12, backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fdba74' },

  memberRow:    { flexDirection: 'row', gap: 12, alignItems: 'center', borderRadius: 20, backgroundColor: '#fff7ed', padding: 12 },
  avatarCircle: { width: 48, height: 48, borderRadius: 24, overflow: 'hidden', backgroundColor: '#fed7aa', alignItems: 'center', justifyContent: 'center' },
  avatarImage:  { width: '100%', height: '100%' },
  avatarText:   { color: '#7c2d12', fontWeight: '900', fontSize: 18 },

  noticeRow:  { flexDirection: 'row', gap: 12, alignItems: 'center', borderRadius: 20, backgroundColor: '#fff7ed', padding: 12 },
  noticeIcon: { width: 32, fontSize: 20 },

  tabBar:        { position: 'absolute', left: 12, right: 12, bottom: 14, flexDirection: 'row', borderRadius: 28, padding: 6, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#fed7aa', elevation: 10, shadowColor: '#7c2d12', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.14, shadowRadius: 16 },
  tabItem:       { flex: 1, minHeight: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabItemActive: { backgroundColor: '#ffedd5' },
  tabIcon:       { color: '#9a3412', fontSize: 18, fontWeight: '900' },
  tabIconActive: { color: '#ea580c' },
  tabLabel:      { color: '#9a3412', fontSize: 10, fontWeight: '700' },
  tabLabelActive: { color: '#7c2d12' },
})

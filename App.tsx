import { StatusBar } from 'expo-status-bar'
import type { Session } from '@supabase/supabase-js'
import QRCode from 'react-native-qrcode-svg'
import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { createMobileUpload, pickSingleMemory } from './lib/upload'

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
      latest: '最近回忆',
    },
    upload: {
      title: '发送到家庭记忆墙',
      subtitle: '选择 Android 相册里的照片或视频，填写标题和备注后发送。',
      steps: ['选择照片 / 视频', '预览与裁剪', '填写标题 / 备注', '显示上传进度'],
      primary: '选择媒体',
      titleInput: '标题',
      noteInput: '备注（可选）',
      send: '上传到家庭墙',
      picked: '已选择媒体',
      success: '上传成功，等待家庭墙同步。',
    },
    family: {
      title: '家庭成员与邀请',
      subtitle: '下一阶段接入成员列表、邀请码、分享链接和二维码。',
      actions: ['复制邀请码', '分享邀请链接', '生成二维码', '显示设备入口'],
      noInvite: '暂无可用邀请码',
      members: '家庭成员',
      incomingInvite: '检测到邀请链接',
      joinInvite: '加入这个家庭',
      joining: '正在加入...',
      shareInvite: '分享邀请',
      shareMessage: '加入我的 Family Hub 家庭，邀请码：{code}\n{link}',
      qrTitle: '扫码加入',
      qrHint: '家人可用 Family Hub APP 打开这个邀请链接。',
      joined: '已加入家庭：{name}',
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
      latest: 'Latest memories',
    },
    upload: {
      title: 'Send to family wall',
      subtitle: 'Choose a photo or video from Android, add a title/note, then send it.',
      steps: ['Pick photo / video', 'Preview and crop', 'Add title / note', 'Show upload progress'],
      primary: 'Choose media',
      titleInput: 'Title',
      noteInput: 'Note (optional)',
      send: 'Upload to family wall',
      picked: 'Media selected',
      success: 'Upload complete. Waiting for family wall sync.',
    },
    family: {
      title: 'Family and invites',
      subtitle: 'Next phase connects members, invite code, share link, and QR code.',
      actions: ['Copy invite code', 'Share invite link', 'Generate QR code', 'Display device entry'],
      noInvite: 'No invite code yet',
      members: 'Family members',
      incomingInvite: 'Invite link detected',
      joinInvite: 'Join this family',
      joining: 'Joining...',
      shareInvite: 'Share invite',
      shareMessage: 'Join my Family Hub family. Invite code: {code}\n{link}',
      qrTitle: 'Scan to join',
      qrHint: 'Family members can open this invite link with the Family Hub app.',
      joined: 'Joined family: {name}',
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

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  )
}

function EmptyCard({ text }: { text: string }) {
  return <View style={styles.smallCard}><Text style={styles.cardText}>{text}</Text></View>
}

function buildInviteLink(code: string) {
  return `familyhub://family?code=${encodeURIComponent(code)}`
}

function extractInviteCode(url: string | null) {
  if (!url) return null
  try {
    const parsed = new URL(url)
    const rawCode = parsed.searchParams.get('code') || parsed.searchParams.get('invite')
    return rawCode?.trim().toUpperCase() || null
  } catch {
    const match = url.match(/[?&](?:code|invite)=([^&#]+)/i)
    return match?.[1] ? decodeURIComponent(match[1]).trim().toUpperCase() : null
  }
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
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadNote, setUploadNote] = useState('')
  const [selectedAsset, setSelectedAsset] = useState<{ uri: string; fileName?: string | null } | null>(null)
  const [pickedAsset, setPickedAsset] = useState<Awaited<ReturnType<typeof pickSingleMemory>>>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadMessage, setUploadMessage] = useState<string | null>(null)
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(null)
  const [inviteMessage, setInviteMessage] = useState<string | null>(null)
  const [isJoiningInvite, setIsJoiningInvite] = useState(false)
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

  function captureInviteFromUrl(url: string | null) {
    const code = extractInviteCode(url)
    if (!code) return
    setPendingInviteCode(code)
    setInviteMessage(null)
    setActiveTab('family')
  }

  async function acceptPendingInvite(code = pendingInviteCode) {
    if (!code) return
    if (!session?.user.id) {
      setActiveTab('family')
      return
    }

    setIsJoiningInvite(true)
    setInviteMessage(null)
    try {
      const result = await joinFamilyByCode(code)
      if (result.ok) {
        const familyName = result.familyName ?? (locale === 'zh' ? '你的家庭' : 'your family')
        setInviteMessage(t.family.joined.replace('{name}', familyName))
        setPendingInviteCode(null)
        await refreshFamilyStatus(session.user.id)
      } else {
        setInviteMessage(result.message ?? (locale === 'zh' ? '无法加入这个家庭。' : 'Could not join this family.'))
      }
    } catch (error) {
      setInviteMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setIsJoiningInvite(false)
    }
  }

  async function shareInvite(code?: string | null) {
    if (!code) {
      Alert.alert(t.tabs.family, t.family.noInvite)
      return
    }
    const link = buildInviteLink(code)
    await Share.share({ message: t.family.shareMessage.replace('{code}', code).replace('{link}', link), url: link })
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setIsBooting(false)
      if (data.session?.user.id) refreshFamilyStatus(data.session.user.id)
    })

    Linking.getInitialURL().then(captureInviteFromUrl).catch(() => undefined)
    const urlListener = Linking.addEventListener('url', ({ url }) => captureInviteFromUrl(url))

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (nextSession?.user.id) refreshFamilyStatus(nextSession.user.id)
      else setFamilyStatus(null)
    })

    return () => {
      listener.subscription.unsubscribe()
      urlListener.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (session?.user.id && pendingInviteCode && !isJoiningInvite) {
      acceptPendingInvite(pendingInviteCode)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id, pendingInviteCode])

  async function signOut() {
    await supabase.auth.signOut()
    setSession(null)
    setFamilyStatus(null)
  }

  async function chooseMedia() {
    try {
      const asset = await pickSingleMemory()
      if (!asset) return
      setPickedAsset(asset)
      setSelectedAsset({ uri: asset.uri, fileName: asset.fileName })
      if (!uploadTitle.trim()) setUploadTitle(asset.fileName?.replace(/\.[^.]+$/, '') || 'Family memory')
      setUploadMessage(null)
    } catch (error) {
      Alert.alert(t.tabs.upload, error instanceof Error ? error.message : String(error))
    }
  }

  async function uploadMemory() {
    if (!pickedAsset || !session?.user.id) {
      Alert.alert(t.tabs.upload, t.common.notReady)
      return
    }
    if (!uploadTitle.trim()) {
      Alert.alert(t.tabs.upload, locale === 'zh' ? '请填写标题。' : 'Enter a title first.')
      return
    }

    setIsUploading(true)
    setUploadMessage(null)
    try {
      await createMobileUpload({
        userId: session.user.id,
        title: uploadTitle.trim(),
        note: uploadNote,
        asset: pickedAsset,
      })
      setUploadMessage(t.upload.success)
      setSelectedAsset(null)
      setPickedAsset(null)
      setUploadTitle('')
      setUploadNote('')
      refreshFamilyStatus()
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setIsUploading(false)
    }
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
          <View style={styles.deviceFrameHint}>
            <Text style={styles.deviceFrameText}>{Platform.OS === 'android' ? 'Android' : Platform.OS} · {locale === 'zh' ? '独立原生 APP 开发版' : 'Standalone native app build'}</Text>
          </View>

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
            ) : activeTab === 'upload' ? (
              <View style={styles.actionsRow}>
                <TouchableOpacity onPress={chooseMedia} style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>{t.upload.primary}</Text>
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
                <EmptyCard text={familyError} />
              ) : familyStatus?.familyName ? (
                <>
                  <View style={styles.smallCard}><Text style={styles.cardNumber}>{t.home.family}</Text><Text style={styles.cardText}>{familyStatus.familyName}</Text></View>
                  <View style={styles.smallCard}><Text style={styles.cardNumber}>{t.home.role}</Text><Text style={styles.cardText}>{familyStatus.role ?? '-'}</Text></View>
                  <View style={styles.smallCard}><Text style={styles.cardNumber}>{t.home.members} / {t.home.uploads}</Text><Text style={styles.cardText}>{familyStatus.memberCount} / {familyStatus.recentUploads}</Text></View>
                </>
              ) : (
                <EmptyCard text={t.home.noFamily} />
              )}
              {familyStatus?.uploads.length ? (
                <View style={styles.list}>
                  <SectionTitle title={t.home.latest} subtitle={locale === 'zh' ? '使用缩略图加载，降低 Supabase 流量。' : 'Loads thumbnails to reduce Supabase traffic.'} />
                  {familyStatus.uploads.slice(0, 4).map((item) => (
                    <View key={item.id} style={styles.mediaRow}>
                      <View style={styles.mediaThumb}>
                        {item.thumbnailUrl ? <Image source={{ uri: item.thumbnailUrl }} style={styles.mediaImage} /> : <Text style={styles.mediaEmoji}>{item.mediaType === 'videos' ? '🎬' : '🖼️'}</Text>}
                      </View>
                      <View style={styles.mediaTextWrap}>
                        <Text style={styles.mediaTitle}>{item.title}</Text>
                        <Text style={styles.mediaMeta}>{item.displayScope ?? 'pending'} · {new Date(item.createdAt).toLocaleDateString()}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          {activeTab === 'upload' ? (
            <View style={styles.list}>
              <TextInput value={uploadTitle} onChangeText={setUploadTitle} placeholder={t.upload.titleInput} placeholderTextColor="#9a3412" style={styles.inputLight} />
              <TextInput value={uploadNote} onChangeText={setUploadNote} placeholder={t.upload.noteInput} placeholderTextColor="#9a3412" style={[styles.inputLight, styles.noteInput]} multiline />
              {selectedAsset ? (
                <View style={styles.pickedCard}>
                  <Image source={{ uri: selectedAsset.uri }} style={styles.pickedPreview} />
                  <Text style={styles.listText}>{t.upload.picked}: {selectedAsset.fileName ?? selectedAsset.uri}</Text>
                </View>
              ) : <BulletList items={t.upload.steps} />}
              <TouchableOpacity onPress={uploadMemory} disabled={isUploading || !pickedAsset} style={[styles.primaryButtonFull, (!pickedAsset || isUploading) && styles.disabledButton]}>
                <Text style={styles.primaryButtonText}>{isUploading ? t.common.loading : t.upload.send}</Text>
              </TouchableOpacity>
              {uploadMessage ? <Text style={styles.listText}>{uploadMessage}</Text> : null}
            </View>
          ) : null}
          {activeTab === 'family' && 'actions' in active ? (
            <View style={styles.list}>
              {pendingInviteCode ? (
                <View style={styles.pendingInviteCard}>
                  <Text style={styles.cardNumber}>{t.family.incomingInvite}</Text>
                  <Text style={[styles.inviteCode, styles.pendingInviteCodeText]}>{pendingInviteCode}</Text>
                  <TouchableOpacity onPress={() => acceptPendingInvite()} disabled={isJoiningInvite || !session?.user.id} style={[styles.primaryButtonFull, isJoiningInvite && styles.disabledButton]}>
                    <Text style={styles.primaryButtonText}>{isJoiningInvite ? t.family.joining : t.family.joinInvite}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              {inviteMessage ? <EmptyCard text={inviteMessage} /> : null}
              <SectionTitle title={familyStatus?.familyName ?? t.family.title} subtitle={familyStatus?.inviteCode ? `${locale === 'zh' ? '邀请码' : 'Invite code'}: ${familyStatus.inviteCode}` : t.family.noInvite} />
              <TouchableOpacity onPress={() => shareInvite(familyStatus?.inviteCode)} style={styles.inviteCard}>
                <Text style={styles.inviteCode}>{familyStatus?.inviteCode ?? '— — — —'}</Text>
                <Text style={styles.inviteHint}>{familyStatus?.inviteCode ? t.family.shareInvite : t.family.noInvite}</Text>
              </TouchableOpacity>
              {familyStatus?.inviteCode ? (
                <View style={styles.qrCard}>
                  <Text style={styles.cardNumber}>{t.family.qrTitle}</Text>
                  <View style={styles.qrBox}>
                    <QRCode value={buildInviteLink(familyStatus.inviteCode)} size={178} backgroundColor="#fff7ed" color="#431407" />
                  </View>
                  <Text style={styles.cardText}>{t.family.qrHint}</Text>
                </View>
              ) : null}
              <SectionTitle title={t.family.members} />
              {familyStatus?.members.length ? familyStatus.members.map((member) => (
                <View key={member.userId} style={styles.memberRow}>
                  <View style={styles.avatarCircle}>{member.avatarUrl ? <Image source={{ uri: member.avatarUrl }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{(member.name || member.role || '?').slice(0, 1).toUpperCase()}</Text>}</View>
                  <View style={styles.mediaTextWrap}>
                    <Text style={styles.mediaTitle}>{member.name ?? member.userId.slice(0, 8)}</Text>
                    <Text style={styles.mediaMeta}>{member.role ?? 'member'} · {member.status ?? 'active'}</Text>
                  </View>
                </View>
              )) : <EmptyCard text={t.home.noFamily} />}
            </View>
          ) : null}
          {activeTab === 'notifications' && 'items' in active ? (
            <View style={styles.list}>
              <SectionTitle title={t.notifications.title} subtitle={locale === 'zh' ? '先用真实家庭数据生成轻量通知流。' : 'A lightweight feed from real family data first.'} />
              {(familyStatus?.uploads ?? []).slice(0, 5).map((item) => (
                <View key={item.id} style={styles.noticeRow}>
                  <Text style={styles.noticeIcon}>{item.mediaType === 'videos' ? '🎬' : '✨'}</Text>
                  <View style={styles.mediaTextWrap}>
                    <Text style={styles.mediaTitle}>{item.title}</Text>
                    <Text style={styles.mediaMeta}>{item.displayScope ?? 'pending'} · {new Date(item.createdAt).toLocaleString()}</Text>
                  </View>
                </View>
              ))}
              {!familyStatus?.uploads.length ? <BulletList items={active.items} /> : null}
            </View>
          ) : null}
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
  inputLight: { borderRadius: 18, backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa', paddingHorizontal: 16, paddingVertical: 13, color: '#431407', fontSize: 15 },
  noteInput: { minHeight: 86, textAlignVertical: 'top' },
  switchText: { color: '#fed7aa', textAlign: 'center', fontWeight: '700', marginTop: 4 },
  content: { padding: 20, paddingBottom: 120, gap: 16 },
  deviceFrameHint: { alignSelf: 'flex-start', borderRadius: 999, borderWidth: 1, borderColor: '#fed7aa', backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 7 },
  deviceFrameText: { color: '#9a3412', fontSize: 11, fontWeight: '800' },
  heroCard: { borderRadius: 32, padding: 22, backgroundColor: '#431407', shadowColor: '#7c2d12', shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.18, shadowRadius: 24, elevation: 8 },
  screenTitle: { color: '#ffedd5', fontSize: 25, fontWeight: '800', lineHeight: 32 },
  screenSubtitle: { marginTop: 10, color: '#fed7aa', fontSize: 15, lineHeight: 23 },
  actionsRow: { marginTop: 22, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  primaryButton: { borderRadius: 999, backgroundColor: '#f59e0b', paddingHorizontal: 18, paddingVertical: 12 },
  primaryButtonFull: { borderRadius: 999, backgroundColor: '#f59e0b', paddingHorizontal: 18, paddingVertical: 14, alignItems: 'center' },
  disabledButton: { opacity: 0.55 },
  primaryButtonText: { color: '#431407', fontWeight: '800' },
  secondaryButton: { borderRadius: 999, borderWidth: 1, borderColor: '#fed7aa', paddingHorizontal: 18, paddingVertical: 12 },
  secondaryButtonText: { color: '#ffedd5', fontWeight: '700' },
  cardGrid: { gap: 12 },
  smallCard: { borderRadius: 24, padding: 18, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#fed7aa' },
  cardNumber: { color: '#ea580c', fontSize: 12, fontWeight: '800' },
  cardText: { marginTop: 6, color: '#431407', fontSize: 16, fontWeight: '700' },
  list: { borderRadius: 28, padding: 18, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#fed7aa', gap: 12 },
  sectionHeader: { gap: 4 },
  sectionTitle: { color: '#431407', fontSize: 18, fontWeight: '900' },
  sectionSubtitle: { color: '#9a3412', fontSize: 13, lineHeight: 19, fontWeight: '600' },
  listRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  menuRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  dot: { color: '#f97316', fontSize: 18, lineHeight: 22 },
  listText: { flex: 1, color: '#431407', fontSize: 15, lineHeight: 22, fontWeight: '600' },
  mediaRow: { flexDirection: 'row', gap: 12, alignItems: 'center', borderRadius: 20, backgroundColor: '#fff7ed', padding: 10 },
  mediaThumb: { width: 62, height: 62, borderRadius: 18, overflow: 'hidden', backgroundColor: '#431407', alignItems: 'center', justifyContent: 'center' },
  mediaImage: { width: '100%', height: '100%' },
  mediaEmoji: { fontSize: 24 },
  mediaTextWrap: { flex: 1, minWidth: 0 },
  mediaTitle: { color: '#431407', fontSize: 15, fontWeight: '900' },
  mediaMeta: { marginTop: 3, color: '#9a3412', fontSize: 12, fontWeight: '700' },
  pickedCard: { borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: '#fed7aa', backgroundColor: '#fff7ed' },
  pickedPreview: { width: '100%', height: 210, backgroundColor: '#431407' },
  inviteCard: { borderRadius: 24, padding: 18, backgroundColor: '#431407', gap: 6 },
  pendingInviteCard: { borderRadius: 24, padding: 18, backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fdba74', gap: 12 },
  inviteCode: { color: '#ffedd5', fontSize: 28, fontWeight: '900', letterSpacing: 2 },
  pendingInviteCodeText: { color: '#431407' },
  inviteHint: { color: '#fed7aa', fontSize: 13, fontWeight: '700' },
  qrCard: { borderRadius: 24, padding: 18, backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa', gap: 12, alignItems: 'center' },
  qrBox: { borderRadius: 22, padding: 14, backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fdba74' },
  memberRow: { flexDirection: 'row', gap: 12, alignItems: 'center', borderRadius: 20, backgroundColor: '#fff7ed', padding: 12 },
  avatarCircle: { width: 48, height: 48, borderRadius: 24, overflow: 'hidden', backgroundColor: '#fed7aa', alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: '#7c2d12', fontWeight: '900', fontSize: 18 },
  noticeRow: { flexDirection: 'row', gap: 12, alignItems: 'center', borderRadius: 20, backgroundColor: '#fff7ed', padding: 12 },
  noticeIcon: { width: 34, fontSize: 22 },
  tabBar: { position: 'absolute', left: 14, right: 14, bottom: 16, flexDirection: 'row', borderRadius: 30, padding: 8, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#fed7aa', shadowColor: '#7c2d12', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.16, shadowRadius: 18, elevation: 10 },
  tabItem: { flex: 1, minHeight: 58, borderRadius: 22, alignItems: 'center', justifyContent: 'center', gap: 3 },
  tabItemActive: { backgroundColor: '#ffedd5' },
  tabIcon: { color: '#9a3412', fontSize: 20, fontWeight: '900' },
  tabIconActive: { color: '#ea580c' },
  tabLabel: { color: '#9a3412', fontSize: 10, fontWeight: '700' },
  tabLabelActive: { color: '#7c2d12' },
})

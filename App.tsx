import { StatusBar } from 'expo-status-bar'
import type { Session } from '@supabase/supabase-js'
import QRCode from 'react-native-qrcode-svg'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  FlatList,
} from 'react-native'
import { supabase } from './lib/supabase'
import { createMobileUpload, pickSingleMemory } from './lib/upload'
import { loadFamilyStatus, joinFamilyByCode } from './lib/family'
import type { FamilyStatus, FamilyMember, UploadItem } from './lib/family'

// ── Constants ─────────────────────────────────────────────────────────────
const { width: SW } = Dimensions.get('window')

type TabKey = 'home' | 'memories' | 'upload' | 'family' | 'menu'
type AuthMode = 'signIn' | 'signUp'

const TABS: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: 'home',     label: '首页',   icon: '⌂' },
  { key: 'memories', label: '记忆',   icon: '🖼' },
  { key: 'upload',   label: '上传',   icon: '＋' },
  { key: 'family',   label: '家庭',   icon: '♡' },
  { key: 'menu',     label: '我的',   icon: '☰' },
]

const AVATAR_COLORS = ['#f97316','#ec4899','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#6366f1']
const DEVICE_TYPES = ['iPad','平板','电视','智能屏','手机','电脑']
const DEVICE_ICONS: Record<string, string> = {
  'iPad':'📱','平板':'📱','电视':'📺','智能屏':'🖥','手机':'📱','电脑':'💻',
}

// ── Helpers ───────────────────────────────────────────────────────────────
function buildInviteLink(code: string) {
  return `familyhub://family?code=${encodeURIComponent(code)}`
}
function extractCode(url: string | null): string | null {
  if (!url) return null
  try {
    return new URL(url).searchParams.get('code')?.trim().toUpperCase() || null
  } catch {
    const m = url.match(/[?&](?:code|invite)=([^&#]+)/i)
    return m ? decodeURIComponent(m[1]).trim().toUpperCase() : null
  }
}
function initials(name: string | null, fallback: string) {
  return (name || fallback).slice(0, 1).toUpperCase()
}
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}分钟前`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}小时前`
  return `${Math.floor(hrs / 24)}天前`
}

// ── Micro components ──────────────────────────────────────────────────────
function Pill({ text, color = '#fff7ed' }: { text: string; color?: string }) {
  return (
    <View style={[s.pill, { backgroundColor: color }]}>
      <Text style={s.pillText}>{text}</Text>
    </View>
  )
}
function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[s.card, style]}>{children}</View>
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {children}
    </View>
  )
}
function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={s.emptyState}>
      <Text style={s.emptyIcon}>{icon}</Text>
      <Text style={s.emptyText}>{text}</Text>
    </View>
  )
}
function Avatar({
  name, color, uri, size = 44,
}: { name: string | null; color?: string | null; uri?: string | null; size?: number }) {
  const bg = color || AVATAR_COLORS[0]
  return (
    <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      {uri
        ? <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
        : <Text style={[s.avatarText, { fontSize: size * 0.4 }]}>{initials(name, '?')}</Text>}
    </View>
  )
}

// ── Auth Screen ───────────────────────────────────────────────────────────
function AuthScreen({ onAuthed }: { onAuthed: (s: Session) => void }) {
  const [mode, setMode] = useState<AuthMode>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const pwRef = useRef<TextInput>(null)

  async function submit() {
    const e = email.trim()
    if (!e.includes('@')) { Alert.alert('', '请输入有效的邮箱地址'); return }
    if (password.length < 6) { Alert.alert('', '密码至少6位'); return }
    setLoading(true)
    try {
      const res = mode === 'signIn'
        ? await supabase.auth.signInWithPassword({ email: e, password })
        : await supabase.auth.signUp({ email: e, password })
      if (res.error) { Alert.alert('', res.error.message); return }
      if (res.data.session) onAuthed(res.data.session)
      else Alert.alert('', '请检查邮箱完成验证后再登录。')
    } catch (err) {
      Alert.alert('', err instanceof Error ? err.message : '发生错误')
    } finally { setLoading(false) }
  }

  return (
    <SafeAreaView style={s.authSafe}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={s.authScroll} keyboardShouldPersistTaps="handled">
          {/* Hero */}
          <View style={s.authHero}>
            <Text style={s.authLogo}>Family Hub</Text>
            <Text style={s.authTagline}>把家人的日常，送到家里的记忆墙。</Text>
          </View>

          {/* Card */}
          <View style={s.authCard}>
            <Text style={s.authTitle}>{mode === 'signIn' ? '欢迎回来' : '创建账号'}</Text>
            <TextInput
              style={s.authInput}
              value={email}
              onChangeText={setEmail}
              placeholder="邮箱地址"
              placeholderTextColor="#fdba74"
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
              onSubmitEditing={() => pwRef.current?.focus()}
            />
            <TextInput
              ref={pwRef}
              style={s.authInput}
              value={password}
              onChangeText={setPassword}
              placeholder="密码（至少6位）"
              placeholderTextColor="#fdba74"
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={submit}
            />
            <TouchableOpacity
              style={[s.authBtn, loading && s.btnDisabled]}
              onPress={submit}
              disabled={loading}
            >
              <Text style={s.authBtnText}>
                {loading ? '处理中…' : mode === 'signIn' ? '登录' : '注册'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}>
              <Text style={s.authSwitch}>
                {mode === 'signIn' ? '没有账号？注册' : '已有账号？登录'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

// ── Device Modal ──────────────────────────────────────────────────────────
type Device = {
  id: string; name: string; type: string; owner_name: string
  location: string; battery: number; status: string; created_at: string
}
function DeviceModal({
  visible, device, familyId, userId, onClose, onSaved,
}: {
  visible: boolean; device: Device | null; familyId: string
  userId: string; onClose: () => void; onSaved: () => void
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState(DEVICE_TYPES[0])
  const [owner, setOwner] = useState('')
  const [location, setLocation] = useState('')
  const [battery, setBattery] = useState('100')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (device) {
      setName(device.name); setType(device.type); setOwner(device.owner_name)
      setLocation(device.location); setBattery(String(device.battery))
    } else {
      setName(''); setType(DEVICE_TYPES[0]); setOwner(''); setLocation(''); setBattery('100')
    }
  }, [device, visible])

  async function save() {
    if (!name.trim()) { Alert.alert('', '请填写设备名称'); return }
    setLoading(true)
    try {
      const payload = {
        name: name.trim(), type, owner_name: owner.trim() || '未知',
        location: location.trim() || '家', battery: parseInt(battery) || 100,
        status: 'Online', family_id: familyId, created_by: userId,
      }
      if (device) {
        const { error } = await supabase.from('devices').update(payload).eq('id', device.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('devices').insert(payload)
        if (error) throw error
      }
      onSaved()
    } catch (err) {
      Alert.alert('', err instanceof Error ? err.message : '保存失败')
    } finally { setLoading(false) }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.modalSafe}>
        <View style={s.modalHeader}>
          <TouchableOpacity onPress={onClose}><Text style={s.modalCancel}>取消</Text></TouchableOpacity>
          <Text style={s.modalTitle}>{device ? '编辑设备' : '添加设备'}</Text>
          <TouchableOpacity onPress={save} disabled={loading}>
            <Text style={[s.modalSave, loading && { opacity: 0.5 }]}>保存</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">
          <Text style={s.fieldLabel}>设备名称</Text>
          <TextInput style={s.fieldInput} value={name} onChangeText={setName} placeholder="如：客厅大屏" placeholderTextColor="#9ca3af" />

          <Text style={s.fieldLabel}>设备类型</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {DEVICE_TYPES.map(t => (
              <TouchableOpacity key={t} onPress={() => setType(t)}
                style={[s.typeChip, type === t && s.typeChipActive]}>
                <Text style={[s.typeChipText, type === t && s.typeChipTextActive]}>
                  {DEVICE_ICONS[t]} {t}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={s.fieldLabel}>使用者</Text>
          <TextInput style={s.fieldInput} value={owner} onChangeText={setOwner} placeholder="如：爷爷奶奶" placeholderTextColor="#9ca3af" />

          <Text style={s.fieldLabel}>位置</Text>
          <TextInput style={s.fieldInput} value={location} onChangeText={setLocation} placeholder="如：客厅" placeholderTextColor="#9ca3af" />

          <Text style={s.fieldLabel}>电量 (%)</Text>
          <TextInput style={s.fieldInput} value={battery} onChangeText={setBattery}
            keyboardType="number-pad" placeholder="100" placeholderTextColor="#9ca3af" />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

// ── Profile Modal ─────────────────────────────────────────────────────────
function ProfileModal({
  visible, userId, currentName, currentColor, onClose, onSaved,
}: {
  visible: boolean; userId: string; currentName: string | null
  currentColor: string | null; onClose: () => void; onSaved: (name: string, color: string) => void
}) {
  const [name, setName] = useState(currentName || '')
  const [color, setColor] = useState(currentColor || AVATAR_COLORS[0])
  const [loading, setLoading] = useState(false)

  useEffect(() => { setName(currentName || ''); setColor(currentColor || AVATAR_COLORS[0]) }, [visible])

  async function save() {
    setLoading(true)
    try {
      const { error } = await supabase.from('profiles').upsert({
        id: userId, display_name: name.trim() || null, avatar_color: color,
        updated_at: new Date().toISOString(),
      })
      if (error) throw error
      onSaved(name.trim(), color)
    } catch (err) {
      Alert.alert('', err instanceof Error ? err.message : '保存失败')
    } finally { setLoading(false) }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.modalSafe}>
        <View style={s.modalHeader}>
          <TouchableOpacity onPress={onClose}><Text style={s.modalCancel}>取消</Text></TouchableOpacity>
          <Text style={s.modalTitle}>编辑资料</Text>
          <TouchableOpacity onPress={save} disabled={loading}>
            <Text style={[s.modalSave, loading && { opacity: 0.5 }]}>保存</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={s.modalBody}>
          {/* Avatar preview */}
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <Avatar name={name || userId} color={color} size={80} />
          </View>

          <Text style={s.fieldLabel}>显示名称</Text>
          <TextInput style={s.fieldInput} value={name} onChangeText={setName}
            placeholder="你的名字" placeholderTextColor="#9ca3af" />

          <Text style={s.fieldLabel}>头像颜色</Text>
          <View style={s.colorGrid}>
            {AVATAR_COLORS.map(c => (
              <TouchableOpacity key={c} onPress={() => setColor(c)}
                style={[s.colorDot, { backgroundColor: c }, color === c && s.colorDotActive]} />
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

// ── Memory Viewer Modal ───────────────────────────────────────────────────
function MemoryViewer({
  visible, item, onClose,
}: { visible: boolean; item: UploadItem | null; onClose: () => void }) {
  if (!item) return null
  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={s.viewerBg}>
        <TouchableOpacity style={s.viewerClose} onPress={onClose}>
          <Text style={s.viewerCloseText}>✕</Text>
        </TouchableOpacity>
        {item.thumbnailUrl
          ? <Image source={{ uri: item.thumbnailUrl }} style={s.viewerImage} resizeMode="contain" />
          : <Text style={s.viewerEmoji}>{item.mediaType === 'videos' ? '🎬' : '🖼️'}</Text>}
        <View style={s.viewerMeta}>
          <Text style={s.viewerTitle}>{item.title}</Text>
          <Text style={s.viewerTime}>{timeAgo(item.createdAt)}</Text>
        </View>
      </View>
    </Modal>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState<TabKey>('home')
  const [session, setSession] = useState<Session | null>(null)
  const [booting, setBooting] = useState(true)

  // Family state
  const [family, setFamily] = useState<FamilyStatus | null>(null)
  const [familyLoading, setFamilyLoading] = useState(false)
  const [familyError, setFamilyError] = useState<string | null>(null)

  // Profile state
  const [profileName, setProfileName] = useState<string | null>(null)
  const [profileColor, setProfileColor] = useState<string | null>(null)
  const [showProfile, setShowProfile] = useState(false)

  // Upload state
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadNote, setUploadNote] = useState('')
  const [pickedAsset, setPickedAsset] = useState<Awaited<ReturnType<typeof pickSingleMemory>>>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ phase: string; pct: number } | null>(null)
  const [uploadMsg, setUploadMsg] = useState<string | null>(null)

  // Invite state
  const [pendingCode, setPendingCode] = useState<string | null>(null)
  const [joiningInvite, setJoiningInvite] = useState(false)
  const [inviteMsg, setInviteMsg] = useState<string | null>(null)
  const [manualCode, setManualCode] = useState('')

  // Devices state
  const [devices, setDevices] = useState<Device[]>([])
  const [devicesLoading, setDevicesLoading] = useState(false)
  const [showDeviceModal, setShowDeviceModal] = useState(false)
  const [editingDevice, setEditingDevice] = useState<Device | null>(null)

  // Memory viewer
  const [viewingMemory, setViewingMemory] = useState<UploadItem | null>(null)

  // Family create
  const [newFamilyName, setNewFamilyName] = useState('')
  const [creatingFamily, setCreatingFamily] = useState(false)

  // ── Load family ────────────────────────────────────────────────────────
  const loadFamily = useCallback(async (uid: string) => {
    setFamilyLoading(true)
    setFamilyError(null)
    try {
      setFamily(await loadFamilyStatus(uid))
    } catch (err) {
      setFamilyError(err instanceof Error ? err.message : '加载失败')
    } finally { setFamilyLoading(false) }
  }, [])

  // ── Load devices ────────────────────────────────────────────────────────
  const loadDevices = useCallback(async (familyId: string) => {
    setDevicesLoading(true)
    try {
      const { data, error } = await supabase
        .from('devices').select('*').eq('family_id', familyId).order('created_at', { ascending: false })
      if (error) throw error
      setDevices((data as Device[]) || [])
    } catch { /* silent */ } finally { setDevicesLoading(false) }
  }, [])

  // ── Load profile ────────────────────────────────────────────────────────
  const loadProfile = useCallback(async (uid: string) => {
    const { data } = await supabase.from('profiles').select('display_name,avatar_color').eq('id', uid).maybeSingle()
    if (data) { setProfileName(data.display_name); setProfileColor(data.avatar_color) }
  }, [])

  // ── Invite capture ─────────────────────────────────────────────────────
  const captureInvite = useCallback((url: string | null) => {
    const code = extractCode(url)
    if (code) { setPendingCode(code); setTab('family') }
  }, [])

  // ── Boot ───────────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return
      setSession(data.session)
      setBooting(false)
      if (data.session?.user.id) {
        loadFamily(data.session.user.id)
        loadProfile(data.session.user.id)
      }
    })
    Linking.getInitialURL().then(captureInvite).catch(() => {})
    const urlSub = Linking.addEventListener('url', ({ url }) => captureInvite(url))
    const { data: authSub } = supabase.auth.onAuthStateChange((_e, sess) => {
      if (!alive) return
      setSession(sess)
      if (sess?.user.id) { loadFamily(sess.user.id); loadProfile(sess.user.id) }
      else { setFamily(null) }
    })
    return () => { alive = false; authSub.subscription.unsubscribe(); urlSub.remove() }
  }, [loadFamily, loadProfile, captureInvite])

  // ── Load devices when family loads ─────────────────────────────────────
  useEffect(() => {
    if (family?.familyId) loadDevices(family.familyId)
  }, [family?.familyId, loadDevices])

  // ── Auto-join on pending invite ─────────────────────────────────────────
  useEffect(() => {
    if (session?.user.id && pendingCode && !joiningInvite) joinInvite(pendingCode)
  }, [session?.user.id, pendingCode])

  // ── Join family by code ────────────────────────────────────────────────
  async function joinInvite(code: string) {
    if (!session?.user.id) return
    setJoiningInvite(true)
    setInviteMsg(null)
    try {
      const res = await joinFamilyByCode(code)
      if (res.ok) {
        setInviteMsg(`✓ 已加入家庭：${res.familyName}`)
        setPendingCode(null)
        setManualCode('')
        await loadFamily(session.user.id)
      } else {
        setInviteMsg(res.message)
      }
    } catch (err) {
      setInviteMsg(err instanceof Error ? err.message : '加入失败')
    } finally { setJoiningInvite(false) }
  }

  // ── Create family ──────────────────────────────────────────────────────
  async function createFamily() {
    if (!session?.user.id || !newFamilyName.trim()) {
      Alert.alert('', '请填写家庭名称'); return
    }
    setCreatingFamily(true)
    try {
      const code = Math.random().toString(36).slice(2, 8).toUpperCase()
      const { data: fam, error: famErr } = await supabase
        .from('families').insert({ name: newFamilyName.trim(), owner_id: session.user.id, invite_code: code })
        .select('id').single()
      if (famErr) throw famErr
      const { error: memErr } = await supabase.from('family_members').insert({
        family_id: fam.id, user_id: session.user.id, role: 'admin', status: 'active',
      })
      if (memErr) throw memErr
      setNewFamilyName('')
      await loadFamily(session.user.id)
    } catch (err) {
      Alert.alert('', err instanceof Error ? err.message : '创建失败')
    } finally { setCreatingFamily(false) }
  }

  // ── Pick & upload ──────────────────────────────────────────────────────
  async function pickMedia() {
    try {
      const asset = await pickSingleMemory()
      if (!asset) return
      setPickedAsset(asset)
      setUploadMsg(null)
      if (!uploadTitle.trim())
        setUploadTitle(asset.fileName?.replace(/\.[^.]+$/, '') || '')
    } catch (err) { Alert.alert('', err instanceof Error ? err.message : '选择失败') }
  }

  async function doUpload() {
    if (!pickedAsset) { Alert.alert('', '请先选择照片或视频'); return }
    if (!uploadTitle.trim()) { Alert.alert('', '请填写标题'); return }
    if (!session?.user.id) return
    setUploading(true)
    setUploadMsg(null)
    setUploadProgress({ phase: '准备中…', pct: 0 })
    try {
      await createMobileUpload({
        userId: session.user.id,
        title: uploadTitle.trim(),
        note: uploadNote,
        asset: pickedAsset,
        onProgress: (phase, percent) => setUploadProgress({ phase, pct: percent }),
      })
      setUploadMsg('✓ 上传成功！已发送到家庭记忆墙。')
      setPickedAsset(null); setUploadTitle(''); setUploadNote('')
      if (session.user.id) loadFamily(session.user.id)
    } catch (err) {
      setUploadMsg(err instanceof Error ? err.message : '上传失败')
    } finally { setUploading(false); setUploadProgress(null) }
  }

  // ── Share invite ───────────────────────────────────────────────────────
  async function shareInvite() {
    if (!family?.inviteCode) return
    const link = buildInviteLink(family.inviteCode)
    await Share.share({ message: `加入我的 Family Hub 家庭！\n邀请码：${family.inviteCode}\n${link}` })
  }

  // ── Delete device ──────────────────────────────────────────────────────
  async function deleteDevice(id: string) {
    Alert.alert('删除设备', '确定要删除这台设备吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除', style: 'destructive',
        onPress: async () => {
          await supabase.from('devices').delete().eq('id', id)
          if (family?.familyId) loadDevices(family.familyId)
        },
      },
    ])
  }

  // ── Render guards ──────────────────────────────────────────────────────
  if (booting) return (
    <SafeAreaView style={s.center}>
      <ActivityIndicator size="large" color="#ea580c" />
    </SafeAreaView>
  )
  if (!session) return <AuthScreen onAuthed={setSession} />

  const userId = session.user.id

  // ── Tab content ────────────────────────────────────────────────────────
  function renderHome() {
    const uploads = family?.uploads || []
    const members = family?.members || []
    return (
      <ScrollView contentContainerStyle={s.tabContent} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={s.heroCard}>
          <Text style={s.heroGreet}>
            你好，{profileName || session!.user.email?.split('@')[0] || '朋友'} 👋
          </Text>
          <Text style={s.heroFamily}>
            {family?.familyName ? `「${family.familyName}」` : '还没有加入家庭'}
          </Text>
          {family && (
            <View style={s.heroStats}>
              <View style={s.heroStat}>
                <Text style={s.heroStatNum}>{family.memberCount}</Text>
                <Text style={s.heroStatLabel}>成员</Text>
              </View>
              <View style={s.heroStatDivider} />
              <View style={s.heroStat}>
                <Text style={s.heroStatNum}>{family.recentUploads}</Text>
                <Text style={s.heroStatLabel}>回忆</Text>
              </View>
              <View style={s.heroStatDivider} />
              <View style={s.heroStat}>
                <Text style={s.heroStatNum}>{devices.length}</Text>
                <Text style={s.heroStatLabel}>设备</Text>
              </View>
            </View>
          )}
        </View>

        {/* Quick actions */}
        <View style={s.quickRow}>
          <TouchableOpacity style={s.quickBtn} onPress={() => setTab('upload')}>
            <Text style={s.quickIcon}>📷</Text>
            <Text style={s.quickLabel}>上传记忆</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.quickBtn} onPress={() => setTab('family')}>
            <Text style={s.quickIcon}>👨‍👩‍👧</Text>
            <Text style={s.quickLabel}>邀请家人</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.quickBtn} onPress={() => { setTab('menu') }}>
            <Text style={s.quickIcon}>📱</Text>
            <Text style={s.quickLabel}>管理设备</Text>
          </TouchableOpacity>
        </View>

        {/* Recent memories */}
        {uploads.length > 0 && (
          <Section title="最近回忆">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {uploads.slice(0, 6).map(item => (
                <TouchableOpacity key={item.id} style={s.memoryThumbWrap} onPress={() => setViewingMemory(item)}>
                  {item.thumbnailUrl
                    ? <Image source={{ uri: item.thumbnailUrl }} style={s.memoryThumb} />
                    : <View style={[s.memoryThumb, s.memoryThumbEmpty]}>
                        <Text style={{ fontSize: 24 }}>{item.mediaType === 'videos' ? '🎬' : '🖼️'}</Text>
                      </View>}
                  <Text style={s.memoryThumbTitle} numberOfLines={1}>{item.title}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Section>
        )}

        {/* Members */}
        {members.length > 0 && (
          <Section title="家庭成员">
            <View style={s.memberRow}>
              {members.slice(0, 5).map(m => (
                <View key={m.userId} style={s.memberItem}>
                  <Avatar name={m.name} color={null} size={44} />
                  <Text style={s.memberName} numberOfLines={1}>{m.name || '成员'}</Text>
                </View>
              ))}
              {members.length > 5 && (
                <View style={s.memberItem}>
                  <View style={[s.avatar, { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fed7aa' }]}>
                    <Text style={[s.avatarText, { fontSize: 14 }]}>+{members.length - 5}</Text>
                  </View>
                  <Text style={s.memberName}>更多</Text>
                </View>
              )}
            </View>
          </Section>
        )}

        {/* Refresh */}
        <TouchableOpacity
          style={s.refreshBtn}
          onPress={() => loadFamily(userId)}
          disabled={familyLoading}
        >
          <Text style={s.refreshBtnText}>{familyLoading ? '加载中…' : '刷新状态'}</Text>
        </TouchableOpacity>
      </ScrollView>
    )
  }

  function renderMemories() {
    const uploads = family?.uploads || []
    return (
      <View style={{ flex: 1 }}>
        {uploads.length === 0
          ? <EmptyState icon="🖼️" text="还没有上传任何回忆" />
          : (
            <FlatList
              data={uploads}
              keyExtractor={i => i.id}
              numColumns={2}
              contentContainerStyle={s.gridContent}
              columnWrapperStyle={{ gap: 10 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={s.gridItem} onPress={() => setViewingMemory(item)}>
                  {item.thumbnailUrl
                    ? <Image source={{ uri: item.thumbnailUrl }} style={s.gridImage} />
                    : <View style={[s.gridImage, s.gridImageEmpty]}>
                        <Text style={{ fontSize: 32 }}>{item.mediaType === 'videos' ? '🎬' : '🖼️'}</Text>
                      </View>}
                  <View style={s.gridMeta}>
                    <Text style={s.gridTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={s.gridTime}>{timeAgo(item.createdAt)}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
      </View>
    )
  }

  function renderUpload() {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.tabContent} keyboardShouldPersistTaps="handled">
          <Card style={s.heroCard}>
            <Text style={s.sectionTitle}>发送到家庭记忆墙</Text>
            <Text style={s.mutedText}>选择一张照片或视频，写上标题，发送给家人。</Text>
          </Card>

          {/* Media picker */}
          <TouchableOpacity style={s.mediaPicker} onPress={pickMedia}>
            {pickedAsset ? (
              pickedAsset.mimeType?.startsWith('video/')
                ? <View style={s.mediaPickerPreviewEmpty}><Text style={{ fontSize: 48 }}>🎬</Text></View>
                : <Image source={{ uri: pickedAsset.uri }} style={s.mediaPickerPreview} />
            ) : (
              <View style={s.mediaPickerEmpty}>
                <Text style={s.mediaPickerIcon}>📷</Text>
                <Text style={s.mediaPickerText}>点击选择照片或视频</Text>
              </View>
            )}
          </TouchableOpacity>

          <TextInput
            style={s.uploadInput}
            value={uploadTitle}
            onChangeText={setUploadTitle}
            placeholder="标题（必填）"
            placeholderTextColor="#9ca3af"
          />
          <TextInput
            style={[s.uploadInput, s.uploadNote]}
            value={uploadNote}
            onChangeText={setUploadNote}
            placeholder="备注（可选）"
            placeholderTextColor="#9ca3af"
            multiline
          />

          {uploadProgress && (
            <View style={s.progressWrap}>
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: `${uploadProgress.pct}%` as any }]} />
              </View>
              <Text style={s.progressLabel}>{uploadProgress.phase} {uploadProgress.pct}%</Text>
            </View>
          )}

          <TouchableOpacity
            style={[s.uploadBtn, (!pickedAsset || uploading) && s.btnDisabled]}
            onPress={doUpload}
            disabled={!pickedAsset || uploading}
          >
            <Text style={s.uploadBtnText}>{uploading ? '上传中…' : '上传到家庭墙 ✦'}</Text>
          </TouchableOpacity>

          {uploadMsg && (
            <Text style={[s.uploadMsg, uploadMsg.startsWith('✓') && s.uploadMsgSuccess]}>
              {uploadMsg}
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    )
  }

  function renderFamily() {
    const members = family?.members || []
    return (
      <ScrollView contentContainerStyle={s.tabContent} keyboardShouldPersistTaps="handled">

        {/* Pending invite banner */}
        {pendingCode && (
          <Card style={s.inviteBanner}>
            <Text style={s.inviteBannerLabel}>检测到邀请链接</Text>
            <Text style={s.inviteBannerCode}>{pendingCode}</Text>
            <TouchableOpacity
              style={[s.inviteAcceptBtn, joiningInvite && s.btnDisabled]}
              onPress={() => joinInvite(pendingCode)}
              disabled={joiningInvite}
            >
              <Text style={s.inviteAcceptBtnText}>{joiningInvite ? '加入中…' : '加入这个家庭'}</Text>
            </TouchableOpacity>
          </Card>
        )}

        {inviteMsg && (
          <View style={[s.msgBox, inviteMsg.startsWith('✓') && s.msgBoxSuccess]}>
            <Text style={s.msgBoxText}>{inviteMsg}</Text>
          </View>
        )}

        {/* No family: create or join */}
        {!family && (
          <>
            <Card>
              <Text style={s.sectionTitle}>创建家庭</Text>
              <TextInput
                style={s.fieldInput}
                value={newFamilyName}
                onChangeText={setNewFamilyName}
                placeholder="家庭名称（如：王家大院）"
                placeholderTextColor="#9ca3af"
              />
              <TouchableOpacity
                style={[s.uploadBtn, creatingFamily && s.btnDisabled]}
                onPress={createFamily}
                disabled={creatingFamily}
              >
                <Text style={s.uploadBtnText}>{creatingFamily ? '创建中…' : '创建家庭'}</Text>
              </TouchableOpacity>
            </Card>

            <Card style={{ marginTop: 12 }}>
              <Text style={s.sectionTitle}>通过邀请码加入</Text>
              <TextInput
                style={s.fieldInput}
                value={manualCode}
                onChangeText={v => setManualCode(v.toUpperCase())}
                placeholder="输入6位邀请码"
                placeholderTextColor="#9ca3af"
                autoCapitalize="characters"
                maxLength={8}
              />
              <TouchableOpacity
                style={[s.uploadBtn, (!manualCode.trim() || joiningInvite) && s.btnDisabled]}
                onPress={() => joinInvite(manualCode)}
                disabled={!manualCode.trim() || joiningInvite}
              >
                <Text style={s.uploadBtnText}>{joiningInvite ? '加入中…' : '加入家庭'}</Text>
              </TouchableOpacity>
            </Card>
          </>
        )}

        {/* Has family */}
        {family && (
          <>
            {/* Invite card */}
            <Card style={s.inviteCard}>
              <Text style={s.inviteCardLabel}>邀请码</Text>
              <Text style={s.inviteCardCode}>{family.inviteCode || '—'}</Text>
              <Text style={s.inviteCardHint}>分享给家人，让他们扫码或输入邀请码加入</Text>
              <TouchableOpacity style={s.shareBtn} onPress={shareInvite}>
                <Text style={s.shareBtnText}>分享邀请 ↗</Text>
              </TouchableOpacity>
            </Card>

            {/* QR code */}
            {family.inviteCode && (
              <Card style={s.qrCard}>
                <Text style={s.sectionTitle}>扫码加入</Text>
                <View style={s.qrBox}>
                  <QRCode
                    value={buildInviteLink(family.inviteCode)}
                    size={Math.min(SW - 100, 200)}
                    backgroundColor="#fff7ed"
                    color="#431407"
                  />
                </View>
                <Text style={s.mutedText}>家人可用 Family Hub APP 扫码加入</Text>
              </Card>
            )}

            {/* Join by code */}
            <Card>
              <Text style={s.sectionTitle}>加入另一个家庭</Text>
              <TextInput
                style={s.fieldInput}
                value={manualCode}
                onChangeText={v => setManualCode(v.toUpperCase())}
                placeholder="输入邀请码"
                placeholderTextColor="#9ca3af"
                autoCapitalize="characters"
                maxLength={8}
              />
              <TouchableOpacity
                style={[s.inviteAcceptBtn, (!manualCode.trim() || joiningInvite) && s.btnDisabled]}
                onPress={() => joinInvite(manualCode)}
                disabled={!manualCode.trim() || joiningInvite}
              >
                <Text style={s.inviteAcceptBtnText}>加入</Text>
              </TouchableOpacity>
            </Card>

            {/* Members */}
            <Section title={`家庭成员 (${members.length})`}>
              {members.map(m => (
                <View key={m.userId} style={s.memberListRow}>
                  <Avatar name={m.name} color={null} size={44} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={s.memberListName}>{m.name || '成员'}</Text>
                    <Text style={s.memberListRole}>{m.role || 'member'} · {m.status || 'active'}</Text>
                  </View>
                  {m.userId === userId && <Pill text="我" color="#fef3c7" />}
                </View>
              ))}
              {members.length === 0 && <EmptyState icon="👥" text="暂无成员" />}
            </Section>
          </>
        )}
      </ScrollView>
    )
  }

  function renderMenu() {
    return (
      <ScrollView contentContainerStyle={s.tabContent}>
        {/* Profile */}
        <Card style={s.profileCard}>
          <View style={s.profileRow}>
            <Avatar name={profileName} color={profileColor} size={64} />
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={s.profileName}>{profileName || '未设置名称'}</Text>
              <Text style={s.profileEmail}>{session!.user.email}</Text>
            </View>
            <TouchableOpacity onPress={() => setShowProfile(true)} style={s.editBtn}>
              <Text style={s.editBtnText}>编辑</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Devices section */}
        <View style={s.section}>
          <View style={s.sectionRow}>
            <Text style={s.sectionTitle}>家庭设备</Text>
            {family && (
              <TouchableOpacity onPress={() => { setEditingDevice(null); setShowDeviceModal(true) }}>
                <Text style={s.addText}>＋ 添加</Text>
              </TouchableOpacity>
            )}
          </View>
          {devicesLoading
            ? <ActivityIndicator color="#ea580c" style={{ marginVertical: 16 }} />
            : devices.length === 0
              ? <EmptyState icon="📱" text={family ? '还没有添加设备' : '加入家庭后可管理设备'} />
              : devices.map(d => (
                <Card key={d.id} style={s.deviceCard}>
                  <View style={s.deviceRow}>
                    <Text style={s.deviceIcon}>{DEVICE_ICONS[d.type] || '📱'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.deviceName}>{d.name}</Text>
                      <Text style={s.deviceMeta}>{d.owner_name} · {d.location}</Text>
                    </View>
                    <View style={s.deviceRight}>
                      <Text style={s.deviceBattery}>🔋 {d.battery}%</Text>
                      <Text style={[s.deviceStatus, d.status === 'Online' && s.deviceStatusOnline]}>
                        {d.status}
                      </Text>
                    </View>
                  </View>
                  <View style={s.deviceActions}>
                    <TouchableOpacity onPress={() => { setEditingDevice(d); setShowDeviceModal(true) }}>
                      <Text style={s.deviceActionText}>编辑</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteDevice(d.id)}>
                      <Text style={[s.deviceActionText, { color: '#ef4444' }]}>删除</Text>
                    </TouchableOpacity>
                  </View>
                </Card>
              ))}
        </View>

        {/* Settings */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>设置</Text>
          {[
            { label: '通知设置', icon: '🔔' },
            { label: '语言与主题', icon: '🌐' },
            { label: '隐私政策', icon: '🔒' },
            { label: '关于 Family Hub', icon: 'ℹ️' },
          ].map(item => (
            <TouchableOpacity
              key={item.label}
              style={s.menuRow}
              onPress={() => Alert.alert(item.label, '即将开放')}
            >
              <Text style={s.menuRowIcon}>{item.icon}</Text>
              <Text style={s.menuRowLabel}>{item.label}</Text>
              <Text style={s.menuRowArrow}>›</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={s.menuRow}
            onPress={() => Alert.alert('退出登录', '确定要退出吗？', [
              { text: '取消', style: 'cancel' },
              { text: '退出', style: 'destructive', onPress: () => supabase.auth.signOut() },
            ])}
          >
            <Text style={s.menuRowIcon}>🚪</Text>
            <Text style={[s.menuRowLabel, { color: '#ef4444' }]}>退出登录</Text>
            <Text style={s.menuRowArrow}>›</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    )
  }

  // ── Full render ────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="dark" />

      {/* Top bar */}
      <View style={s.topBar}>
        <Text style={s.topBarTitle}>Family Hub</Text>
        {familyLoading && <ActivityIndicator size="small" color="#ea580c" />}
        {familyError && <Text style={s.topBarError}>⚠ {familyError}</Text>}
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {tab === 'home'     && renderHome()}
        {tab === 'memories' && renderMemories()}
        {tab === 'upload'   && renderUpload()}
        {tab === 'family'   && renderFamily()}
        {tab === 'menu'     && renderMenu()}
      </View>

      {/* Tab bar */}
      <View style={s.tabBar}>
        {TABS.map(t => {
          const active = t.key === tab
          return (
            <TouchableOpacity key={t.key} style={s.tabItem} onPress={() => setTab(t.key)}>
              <Text style={[s.tabIcon, active && s.tabIconActive]}>{t.icon}</Text>
              <Text style={[s.tabLabel, active && s.tabLabelActive]}>{t.label}</Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* Modals */}
      <MemoryViewer
        visible={!!viewingMemory}
        item={viewingMemory}
        onClose={() => setViewingMemory(null)}
      />
      {family && (
        <DeviceModal
          visible={showDeviceModal}
          device={editingDevice}
          familyId={family.familyId}
          userId={userId}
          onClose={() => { setShowDeviceModal(false); setEditingDevice(null) }}
          onSaved={() => { setShowDeviceModal(false); setEditingDevice(null); loadDevices(family.familyId) }}
        />
      )}
      <ProfileModal
        visible={showProfile}
        userId={userId}
        currentName={profileName}
        currentColor={profileColor}
        onClose={() => setShowProfile(false)}
        onSaved={(name, color) => { setProfileName(name); setProfileColor(color); setShowProfile(false) }}
      />
    </SafeAreaView>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────
const ORANGE = '#ea580c'
const DARK   = '#431407'
const LIGHT  = '#fff7ed'
const BORDER = '#fed7aa'
const MUTED  = '#9a3412'

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: LIGHT },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: LIGHT },

  // Auth
  authSafe:     { flex: 1, backgroundColor: DARK },
  authScroll:   { flexGrow: 1, justifyContent: 'center', padding: 24 },
  authHero:     { marginBottom: 32, alignItems: 'center' },
  authLogo:     { color: '#ffedd5', fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  authTagline:  { color: '#fdba74', fontSize: 15, marginTop: 8, textAlign: 'center' },
  authCard:     { backgroundColor: '#5c1e0a', borderRadius: 28, padding: 24, gap: 14 },
  authTitle:    { color: '#ffedd5', fontSize: 22, fontWeight: '800' },
  authInput:    { backgroundColor: LIGHT, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, color: DARK },
  authBtn:      { backgroundColor: ORANGE, borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  authBtnText:  { color: 'white', fontWeight: '800', fontSize: 16 },
  authSwitch:   { color: '#fdba74', textAlign: 'center', fontWeight: '700' },

  // Top bar
  topBar:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: BORDER, backgroundColor: 'white', gap: 10 },
  topBarTitle:  { flex: 1, fontSize: 20, fontWeight: '900', color: DARK },
  topBarError:  { color: '#ef4444', fontSize: 12, fontWeight: '700' },

  // Tab bar
  tabBar:        { flexDirection: 'row', backgroundColor: 'white', borderTopWidth: 1, borderTopColor: BORDER, paddingBottom: Platform.OS === 'ios' ? 16 : 6, paddingTop: 6 },
  tabItem:       { flex: 1, alignItems: 'center', gap: 2 },
  tabIcon:       { fontSize: 20, color: '#9a3412' },
  tabIconActive: { color: ORANGE },
  tabLabel:      { fontSize: 10, fontWeight: '700', color: '#9a3412' },
  tabLabelActive:{ color: ORANGE },

  // Content
  tabContent:   { padding: 16, gap: 12, paddingBottom: 24 },

  // Cards
  card:         { backgroundColor: 'white', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: BORDER },
  section:      { gap: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '900', color: DARK },
  sectionRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addText:      { color: ORANGE, fontWeight: '800', fontSize: 14 },
  mutedText:    { color: MUTED, fontSize: 13, lineHeight: 19 },

  // Hero
  heroCard:     { backgroundColor: DARK, borderRadius: 24, padding: 20 },
  heroGreet:    { color: '#fdba74', fontSize: 14, fontWeight: '700' },
  heroFamily:   { color: '#ffedd5', fontSize: 22, fontWeight: '900', marginTop: 4 },
  heroStats:    { flexDirection: 'row', marginTop: 16, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 12 },
  heroStat:     { flex: 1, alignItems: 'center' },
  heroStatNum:  { color: '#ffedd5', fontSize: 22, fontWeight: '900' },
  heroStatLabel:{ color: '#fdba74', fontSize: 11, fontWeight: '700', marginTop: 2 },
  heroStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },

  // Quick actions
  quickRow:     { flexDirection: 'row', gap: 10 },
  quickBtn:     { flex: 1, backgroundColor: 'white', borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: BORDER, gap: 6 },
  quickIcon:    { fontSize: 24 },
  quickLabel:   { fontSize: 11, fontWeight: '800', color: DARK },

  // Memory thumbnails (horizontal)
  memoryThumbWrap: { width: 100, marginRight: 10 },
  memoryThumb:  { width: 100, height: 100, borderRadius: 14, backgroundColor: DARK },
  memoryThumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  memoryThumbTitle: { fontSize: 11, fontWeight: '700', color: DARK, marginTop: 5 },

  // Memory grid
  gridContent:  { padding: 12, gap: 10, paddingBottom: 24 },
  gridItem:     { flex: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: 'white', borderWidth: 1, borderColor: BORDER },
  gridImage:    { width: '100%', aspectRatio: 1 },
  gridImageEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: DARK },
  gridMeta:     { padding: 8 },
  gridTitle:    { fontSize: 13, fontWeight: '800', color: DARK },
  gridTime:     { fontSize: 11, color: MUTED, marginTop: 2 },

  // Memory viewer
  viewerBg:     { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  viewerClose:  { position: 'absolute', top: 56, right: 20, zIndex: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  viewerCloseText: { color: 'white', fontSize: 16, fontWeight: '800' },
  viewerImage:  { width: SW, height: SW },
  viewerEmoji:  { fontSize: 64 },
  viewerMeta:   { position: 'absolute', bottom: 48, left: 20, right: 20 },
  viewerTitle:  { color: 'white', fontSize: 18, fontWeight: '900' },
  viewerTime:   { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 },

  // Upload
  mediaPicker:  { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: BORDER, backgroundColor: 'white' },
  mediaPickerPreview: { width: '100%', height: 200 },
  mediaPickerPreviewEmpty: { height: 200, backgroundColor: DARK, alignItems: 'center', justifyContent: 'center' },
  mediaPickerEmpty: { height: 160, alignItems: 'center', justifyContent: 'center', gap: 8 },
  mediaPickerIcon:  { fontSize: 40 },
  mediaPickerText:  { color: MUTED, fontWeight: '700', fontSize: 14 },
  uploadInput:  { backgroundColor: 'white', borderRadius: 14, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: DARK },
  uploadNote:   { minHeight: 80, textAlignVertical: 'top' },
  uploadBtn:    { backgroundColor: ORANGE, borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  uploadBtnText:{ color: 'white', fontWeight: '900', fontSize: 16 },
  uploadMsg:    { textAlign: 'center', fontSize: 14, color: '#ef4444', fontWeight: '700' },
  uploadMsgSuccess: { color: '#10b981' },
  progressWrap: { gap: 5 },
  progressTrack:{ height: 6, borderRadius: 3, backgroundColor: BORDER, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: ORANGE, borderRadius: 3 },
  progressLabel:{ color: MUTED, fontSize: 11, fontWeight: '700', textAlign: 'right' },

  // Family
  inviteBanner:     { backgroundColor: '#fef3c7', borderColor: '#fbbf24' },
  inviteBannerLabel:{ fontSize: 12, fontWeight: '800', color: '#92400e' },
  inviteBannerCode: { fontSize: 28, fontWeight: '900', color: DARK, letterSpacing: 3, marginVertical: 6 },
  inviteAcceptBtn:  { backgroundColor: ORANGE, borderRadius: 999, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  inviteAcceptBtnText: { color: 'white', fontWeight: '800' },
  inviteCard:   { backgroundColor: DARK, borderColor: DARK },
  inviteCardLabel:  { color: '#fdba74', fontSize: 12, fontWeight: '800' },
  inviteCardCode:   { color: '#ffedd5', fontSize: 32, fontWeight: '900', letterSpacing: 4, marginVertical: 8 },
  inviteCardHint:   { color: '#fdba74', fontSize: 12 },
  shareBtn:     { marginTop: 12, borderRadius: 999, borderWidth: 1, borderColor: '#fdba74', paddingVertical: 10, alignItems: 'center' },
  shareBtnText: { color: '#ffedd5', fontWeight: '800' },
  qrCard:       { alignItems: 'center', gap: 10 },
  qrBox:        { backgroundColor: LIGHT, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: BORDER },
  msgBox:       { backgroundColor: '#fee2e2', borderRadius: 12, padding: 12 },
  msgBoxSuccess:{ backgroundColor: '#d1fae5' },
  msgBoxText:   { fontSize: 13, fontWeight: '700', color: DARK },

  // Members
  memberRow:    { flexDirection: 'row', gap: 12 },
  memberItem:   { alignItems: 'center', gap: 4 },
  memberName:   { fontSize: 11, fontWeight: '700', color: DARK, maxWidth: 60, textAlign: 'center' },
  memberListRow:{ flexDirection: 'row', alignItems: 'center', backgroundColor: LIGHT, borderRadius: 14, padding: 12 },
  memberListName: { fontSize: 15, fontWeight: '800', color: DARK },
  memberListRole: { fontSize: 12, color: MUTED, marginTop: 2 },

  // Avatar
  avatar:       { alignItems: 'center', justifyContent: 'center' },
  avatarText:   { color: 'white', fontWeight: '900' },
  pill:         { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  pillText:     { fontSize: 11, fontWeight: '800', color: DARK },

  // Refresh
  refreshBtn:   { borderRadius: 999, borderWidth: 1, borderColor: BORDER, paddingVertical: 12, alignItems: 'center', backgroundColor: 'white' },
  refreshBtnText: { color: ORANGE, fontWeight: '800' },

  // Profile
  profileCard:  { gap: 0 },
  profileRow:   { flexDirection: 'row', alignItems: 'center' },
  profileName:  { fontSize: 18, fontWeight: '900', color: DARK },
  profileEmail: { fontSize: 13, color: MUTED, marginTop: 2 },
  editBtn:      { borderRadius: 999, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 14, paddingVertical: 7 },
  editBtnText:  { color: ORANGE, fontWeight: '800', fontSize: 13 },

  // Devices
  deviceCard:   { gap: 8 },
  deviceRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  deviceIcon:   { fontSize: 28 },
  deviceName:   { fontSize: 15, fontWeight: '800', color: DARK },
  deviceMeta:   { fontSize: 12, color: MUTED, marginTop: 2 },
  deviceRight:  { alignItems: 'flex-end', gap: 4 },
  deviceBattery:{ fontSize: 12, fontWeight: '700', color: DARK },
  deviceStatus: { fontSize: 11, fontWeight: '800', color: MUTED },
  deviceStatusOnline: { color: '#10b981' },
  deviceActions:{ flexDirection: 'row', gap: 16, justifyContent: 'flex-end' },
  deviceActionText: { color: ORANGE, fontWeight: '800', fontSize: 13 },

  // Menu
  menuRow:      { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 14, padding: 14, gap: 12, borderWidth: 1, borderColor: BORDER },
  menuRowIcon:  { fontSize: 20, width: 28 },
  menuRowLabel: { flex: 1, fontSize: 15, fontWeight: '700', color: DARK },
  menuRowArrow: { color: MUTED, fontSize: 18 },

  // Modal
  modalSafe:    { flex: 1, backgroundColor: 'white' },
  modalHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: BORDER },
  modalTitle:   { fontSize: 17, fontWeight: '900', color: DARK },
  modalCancel:  { color: MUTED, fontWeight: '700', fontSize: 15 },
  modalSave:    { color: ORANGE, fontWeight: '900', fontSize: 15 },
  modalBody:    { padding: 20, gap: 4, paddingBottom: 40 },
  fieldLabel:   { fontSize: 13, fontWeight: '800', color: DARK, marginBottom: 6, marginTop: 10 },
  fieldInput:   { backgroundColor: LIGHT, borderRadius: 14, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: DARK },
  typeChip:     { borderRadius: 999, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, backgroundColor: 'white' },
  typeChipActive: { backgroundColor: ORANGE, borderColor: ORANGE },
  typeChipText: { fontWeight: '700', color: DARK, fontSize: 13 },
  typeChipTextActive: { color: 'white' },
  colorGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  colorDot:     { width: 36, height: 36, borderRadius: 18 },
  colorDotActive: { borderWidth: 3, borderColor: DARK },

  // Empty state
  emptyState:   { alignItems: 'center', padding: 32, gap: 8 },
  emptyIcon:    { fontSize: 40 },
  emptyText:    { color: MUTED, fontWeight: '700', fontSize: 14, textAlign: 'center' },

  // Shared
  btnDisabled:  { opacity: 0.45 },
})

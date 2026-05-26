import { supabase } from './supabase'

// ── 类型定义 ──────────────────────────────────────────────────────────────
export type FamilyMember = {
  userId: string
  name: string | null
  role: string | null
  status: string | null
  avatarUrl: string | null
}

export type UploadItem = {
  id: string
  title: string
  mediaType: string
  displayScope: string | null
  createdAt: string
  thumbnailUrl: string | null
}

export type FamilyStatus = {
  familyId: string
  familyName: string
  role: string | null
  inviteCode: string | null
  memberCount: number
  recentUploads: number
  members: FamilyMember[]
  uploads: UploadItem[]
}

// ── 加载家庭状态 ──────────────────────────────────────────────────────────
export async function loadFamilyStatus(userId: string): Promise<FamilyStatus | null> {
  // 1. 查找用户所在家庭
  const { data: memberRow, error: memberErr } = await supabase
    .from('family_members')
    .select('family_id, role, status')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  if (memberErr) throw new Error(`查询家庭成员失败: ${memberErr.message}`)
  if (!memberRow) return null

  const familyId = memberRow.family_id as string

  // 2. 查家庭基本信息
  const { data: family, error: familyErr } = await supabase
    .from('families')
    .select('name, invite_code')
    .eq('id', familyId)
    .single()

  if (familyErr) throw new Error(`查询家庭信息失败: ${familyErr.message}`)

  // 3. 查成员列表
  const { data: membersRaw, error: membersErr } = await supabase
    .from('family_members')
    .select('user_id, role, status, profiles(display_name, avatar_url)')
    .eq('family_id', familyId)
    .eq('status', 'active')
    .limit(20)

  if (membersErr) throw new Error(`查询成员列表失败: ${membersErr.message}`)

  const members: FamilyMember[] = (membersRaw ?? []).map((m: any) => ({
    userId: m.user_id,
    name: m.profiles?.display_name ?? null,
    role: m.role ?? null,
    status: m.status ?? null,
    avatarUrl: m.profiles?.avatar_url ?? null,
  }))

  // 4. 查最近上传
  const { data: uploadsRaw, error: uploadsErr } = await supabase
    .from('uploads')
    .select('id, title, media_type, display_scope, created_at, thumbnail_url')
    .eq('family_id', familyId)
    .order('created_at', { ascending: false })
    .limit(10)

  if (uploadsErr) throw new Error(`查询上传记录失败: ${uploadsErr.message}`)

  const uploads: UploadItem[] = (uploadsRaw ?? []).map((u: any) => ({
    id: u.id,
    title: u.title,
    mediaType: u.media_type,
    displayScope: u.display_scope ?? null,
    createdAt: u.created_at,
    thumbnailUrl: u.thumbnail_url ?? null,
  }))

  return {
    familyId,
    familyName: family.name,
    role: memberRow.role ?? null,
    inviteCode: family.invite_code ?? null,
    memberCount: members.length,
    recentUploads: uploads.length,
    members,
    uploads,
  }
}

// ── 通过邀请码加入家庭 ────────────────────────────────────────────────────
export type JoinResult =
  | { ok: true; familyName: string }
  | { ok: false; message: string }

export async function joinFamilyByCode(code: string): Promise<JoinResult> {
  const { data, error } = await supabase.rpc('join_family_by_code', {
    p_code: code.trim().toUpperCase(),
  })

  if (error) {
    // 常见错误给友好提示
    if (error.message.includes('not found') || error.message.includes('invalid')) {
      return { ok: false, message: '邀请码无效或已过期，请确认后重试。' }
    }
    if (error.message.includes('already')) {
      return { ok: false, message: '你已经是这个家庭的成员了。' }
    }
    return { ok: false, message: error.message }
  }

  return {
    ok: true,
    familyName: (data as any)?.family_name ?? '你的家庭',
  }
}

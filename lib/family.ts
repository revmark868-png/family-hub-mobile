import { supabase } from './supabase'

export type FamilyMember = {
  userId: string
  role: string | null
  status: string | null
  name: string | null
  avatarUrl: string | null
}

export type RecentUpload = {
  id: string
  title: string
  note: string | null
  createdAt: string
  displayScope: 'pending' | 'family' | 'personal' | null
  previewUrl: string | null
  thumbnailUrl: string | null
  mediaType: string | null
}

export type FamilyStatus = {
  familyId: string | null
  familyName: string | null
  role: string | null
  memberCount: number
  recentUploads: number
  members: FamilyMember[]
  uploads: RecentUpload[]
  inviteCode: string | null
}

type UploadRow = {
  id: string
  title: string
  note: string | null
  media_type: string | null
  created_at: string
  display_scope: 'pending' | 'family' | 'personal' | null
  bucket: string | null
  file_path: string
  thumbnail_url?: string | null
  display_url?: string | null
}

const uploadSelect = 'id, title, note, media_type, created_at, display_scope, bucket, file_path, thumbnail_url, display_url'
const fallbackUploadSelect = 'id, title, note, media_type, created_at, display_scope, bucket, file_path'

function isMissingVariantColumn(error?: { message?: string; code?: string } | null) {
  return Boolean(error && (error.code === '42703' || /thumbnail_url|display_url/i.test(error.message ?? '')))
}

async function signUpload(bucket: string, path?: string | null) {
  if (!path) return null
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24)
  return data?.signedUrl ?? null
}

export async function loadFamilyStatus(userId: string): Promise<FamilyStatus> {
  const { data: membership, error: membershipError } = await supabase
    .from('family_members')
    .select('family_id, role, status')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (membershipError) throw membershipError
  if (!membership?.family_id) {
    return { familyId: null, familyName: null, role: null, memberCount: 0, recentUploads: 0, members: [], uploads: [], inviteCode: null }
  }

  const familyId = membership.family_id
  const [{ data: family }, membersResult, uploadsCountResult, uploadsResult, inviteResult] = await Promise.all([
    supabase.from('families').select('name, invite_code').eq('id', familyId).maybeSingle(),
    supabase.from('family_members').select('user_id, role, status').eq('family_id', familyId).eq('status', 'active').limit(20),
    supabase.from('uploads').select('id', { count: 'exact', head: true }).eq('family_id', familyId),
    supabase.from('uploads').select(uploadSelect).eq('family_id', familyId).order('created_at', { ascending: false }).limit(10),
    supabase.from('family_invites').select('code, status, expires_at').eq('family_id', familyId).eq('status', 'pending').order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  let uploadRows: UploadRow[] | null = (uploadsResult.data ?? null) as UploadRow[] | null
  if (isMissingVariantColumn(uploadsResult.error)) {
    const fallback = await supabase.from('uploads').select(fallbackUploadSelect).eq('family_id', familyId).order('created_at', { ascending: false }).limit(10)
    uploadRows = (fallback.data ?? null) as UploadRow[] | null
  }

  const members = membersResult.data ?? []
  const userIds = members.map((member) => member.user_id).filter(Boolean)
  const { data: profiles } = userIds.length > 0
    ? await supabase.from('profiles').select('id, full_name, avatar_url').in('id', userIds)
    : { data: [] as Array<{ id: string; full_name: string | null; avatar_url: string | null }> }
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]))

  const uploads = await Promise.all((uploadRows ?? []).map(async (item) => {
    const bucket = item.bucket ?? 'family-uploads'
    const thumbnailPath = item.thumbnail_url || item.file_path
    const displayPath = item.display_url || item.file_path
    return {
      id: item.id,
      title: item.title,
      note: item.note ?? null,
      createdAt: item.created_at,
      displayScope: item.display_scope ?? null,
      mediaType: item.media_type ?? null,
      thumbnailUrl: await signUpload(bucket, thumbnailPath),
      previewUrl: await signUpload(bucket, displayPath),
    }
  }))

  return {
    familyId,
    familyName: family?.name ?? null,
    role: membership.role ?? null,
    memberCount: membersResult.data?.length ?? 0,
    recentUploads: uploadsCountResult.count ?? 0,
    inviteCode: inviteResult.data?.code ?? family?.invite_code ?? null,
    members: members.map((member) => {
      const profile = profileMap.get(member.user_id)
      return {
        userId: member.user_id,
        role: member.role ?? null,
        status: member.status ?? null,
        name: profile?.full_name ?? null,
        avatarUrl: profile?.avatar_url ?? null,
      }
    }),
    uploads,
  }
}

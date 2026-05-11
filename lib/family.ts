import { supabase } from './supabase'

export type FamilyStatus = {
  familyName: string | null
  role: string | null
  memberCount: number
  recentUploads: number
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
    return { familyName: null, role: null, memberCount: 0, recentUploads: 0 }
  }

  const [{ data: family }, membersResult, uploadsResult] = await Promise.all([
    supabase.from('families').select('name').eq('id', membership.family_id).maybeSingle(),
    supabase.from('family_members').select('user_id', { count: 'exact', head: true }).eq('family_id', membership.family_id),
    supabase.from('uploads').select('id', { count: 'exact', head: true }).eq('family_id', membership.family_id),
  ])

  return {
    familyName: family?.name ?? null,
    role: membership.role ?? null,
    memberCount: membersResult.count ?? 0,
    recentUploads: uploadsResult.count ?? 0,
  }
}

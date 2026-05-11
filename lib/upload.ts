import * as ImagePicker from 'expo-image-picker'
import { supabase } from './supabase'

const uploadsBucket = process.env.EXPO_PUBLIC_SUPABASE_UPLOADS_BUCKET ?? 'family-uploads'

function extFromUri(uri: string, mimeType?: string | null) {
  const fromUri = uri.split('?')[0]?.split('.').pop()?.toLowerCase()
  if (fromUri && fromUri.length <= 5) return fromUri
  if (mimeType?.includes('png')) return 'png'
  if (mimeType?.includes('webp')) return 'webp'
  if (mimeType?.includes('gif')) return 'gif'
  if (mimeType?.includes('video')) return 'mp4'
  return 'jpg'
}

function mediaTypeFromAsset(asset: ImagePicker.ImagePickerAsset) {
  return asset.type === 'video' ? 'videos' : 'photos'
}

export async function pickSingleMemory() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!permission.granted) {
    throw new Error('Photo library permission is required.')
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.All,
    allowsEditing: false,
    quality: 0.92,
    videoQuality: ImagePicker.UIImagePickerControllerQualityType.High,
  })

  if (result.canceled || !result.assets[0]) return null
  return result.assets[0]
}

export async function createMobileUpload({
  userId,
  title,
  note,
  asset,
}: {
  userId: string
  title: string
  note?: string
  asset: ImagePicker.ImagePickerAsset
}) {
  const { data: membership, error: membershipError } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (membershipError) throw membershipError
  if (!membership?.family_id) throw new Error('Join or create a family before uploading memories.')

  const response = await fetch(asset.uri)
  const blob = await response.blob()
  const mimeType = asset.mimeType ?? blob.type ?? (asset.type === 'video' ? 'video/mp4' : 'image/jpeg')
  const extension = extFromUri(asset.uri, mimeType)
  const filePath = `${membership.family_id}/${userId}/${Date.now()}-${Math.random().toString(16).slice(2)}.${extension}`

  const { error: storageError } = await supabase.storage
    .from(uploadsBucket)
    .upload(filePath, blob, {
      cacheControl: '3600',
      upsert: false,
      contentType: mimeType,
    })

  if (storageError) throw storageError

  const { data: lastOrdered } = await supabase
    .from('uploads')
    .select('display_order')
    .eq('family_id', membership.family_id)
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error: rpcError } = await supabase.rpc('insert_upload', {
    p_family_id: membership.family_id,
    p_created_by: userId,
    p_title: title,
    p_note: note?.trim() || null,
    p_media_type: mediaTypeFromAsset(asset),
    p_bucket: uploadsBucket,
    p_file_path: filePath,
    p_original_filename: asset.fileName ?? `mobile-upload.${extension}`,
    p_file_size: asset.fileSize ?? blob.size,
    p_mime_type: mimeType,
    p_display_order: (lastOrdered?.display_order ?? -1) + 1,
    p_display_scope: 'pending',
  })

  if (rpcError) {
    await supabase.storage.from(uploadsBucket).remove([filePath]).catch(() => undefined)
    throw rpcError
  }

  return { filePath }
}

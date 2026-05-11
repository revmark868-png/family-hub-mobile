import * as ImageManipulator from 'expo-image-manipulator'
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

function isImageAsset(asset: ImagePicker.ImagePickerAsset) {
  return asset.type !== 'video' && !asset.mimeType?.includes('gif')
}

async function uriToBlob(uri: string) {
  const response = await fetch(uri)
  return response.blob()
}

async function makeImageVariant(asset: ImagePicker.ImagePickerAsset, width: number, compress: number) {
  const result = await ImageManipulator.manipulateAsync(
    asset.uri,
    [{ resize: { width } }],
    { compress, format: ImageManipulator.SaveFormat.JPEG },
  )
  const blob = await uriToBlob(result.uri)
  return { uri: result.uri, blob, mimeType: 'image/jpeg' }
}

export async function pickSingleMemory() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!permission.granted) {
    throw new Error('Photo library permission is required.')
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.All,
    allowsEditing: false,
    quality: 1,
    videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
  })

  if (result.canceled || !result.assets[0]) return null
  return result.assets[0]
}

async function uploadBlob(path: string, blob: Blob, mimeType: string) {
  const { error } = await supabase.storage
    .from(uploadsBucket)
    .upload(path, blob, {
      cacheControl: '31536000',
      upsert: false,
      contentType: mimeType,
    })
  if (error) throw error
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

  const originalBlob = await uriToBlob(asset.uri)
  const mimeType = asset.mimeType ?? originalBlob.type ?? (asset.type === 'video' ? 'video/mp4' : 'image/jpeg')
  const extension = extFromUri(asset.uri, mimeType)
  const uploadId = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const originalPath = `${membership.family_id}/${userId}/original/${uploadId}.${extension}`
  let displayPath = originalPath
  let thumbnailPath = originalPath
  const uploadedPaths: string[] = []

  try {
    await uploadBlob(originalPath, originalBlob, mimeType)
    uploadedPaths.push(originalPath)

    if (isImageAsset(asset)) {
      const display = await makeImageVariant(asset, 1600, 0.75)
      const thumb = await makeImageVariant(asset, 360, 0.7)
      displayPath = `${membership.family_id}/${userId}/display/${uploadId}.jpg`
      thumbnailPath = `${membership.family_id}/${userId}/thumb/${uploadId}.jpg`
      await uploadBlob(displayPath, display.blob, display.mimeType)
      uploadedPaths.push(displayPath)
      await uploadBlob(thumbnailPath, thumb.blob, thumb.mimeType)
      uploadedPaths.push(thumbnailPath)
    }

    const { data: lastOrdered } = await supabase
      .from('uploads')
      .select('display_order')
      .eq('family_id', membership.family_id)
      .order('display_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    const uploadRecord = {
      p_family_id: membership.family_id,
      p_created_by: userId,
      p_title: title,
      p_note: note?.trim() || null,
      p_media_type: mediaTypeFromAsset(asset),
      p_bucket: uploadsBucket,
      p_file_path: displayPath,
      p_original_filename: asset.fileName ?? `mobile-upload.${extension}`,
      p_file_size: asset.fileSize ?? originalBlob.size,
      p_mime_type: mimeType,
      p_display_order: (lastOrdered?.display_order ?? -1) + 1,
      p_display_scope: 'pending',
    }

    let { error: rpcError } = await supabase.rpc('insert_upload', {
      ...uploadRecord,
      p_original_url: originalPath,
      p_display_url: displayPath,
      p_thumbnail_url: thumbnailPath,
    })

    if (rpcError && /p_original_url|p_display_url|p_thumbnail_url|function .* does not exist/i.test(rpcError.message)) {
      ;({ error: rpcError } = await supabase.rpc('insert_upload', uploadRecord))
    }

    if (rpcError) throw rpcError

    return { originalPath, displayPath, thumbnailPath }
  } catch (error) {
    if (uploadedPaths.length > 0) {
      await supabase.storage.from(uploadsBucket).remove(uploadedPaths).catch(() => undefined)
    }
    throw error
  }
}

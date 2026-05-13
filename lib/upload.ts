import * as ImageManipulator from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from './supabase'

const uploadsBucket = process.env.EXPO_PUBLIC_SUPABASE_UPLOADS_BUCKET ?? 'family-uploads'
const r2SignUrl = process.env.EXPO_PUBLIC_R2_SIGN_URL ?? 'https://hima.ccwu.cc/upload/r2-sign'
const DISPLAY_IMAGE_WIDTH = 2560
const DISPLAY_IMAGE_COMPRESS = 0.88
const THUMBNAIL_IMAGE_WIDTH = 360
const THUMBNAIL_IMAGE_COMPRESS = 0.7

type R2SignedObject = {
  key: string
  uploadUrl: string
  publicUrl: string
}

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

async function signR2Objects(objects: Array<{ key: string; contentType: string }>, accessToken: string) {
  if (!r2SignUrl) return null

  const response = await fetch(r2SignUrl, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ objects }),
  })

  if (!response.ok) return null
  const result = await response.json().catch(() => null) as { ok?: boolean; objects?: R2SignedObject[] } | null
  return result?.ok ? result.objects ?? null : null
}

async function uploadR2Blob(blob: Blob, signed: R2SignedObject, mimeType: string) {
  const response = await fetch(signed.uploadUrl, {
    method: 'PUT',
    headers: {
      'content-type': mimeType || 'application/octet-stream',
      'cache-control': 'public, max-age=31536000, immutable',
    },
    body: blob,
  })

  if (!response.ok) throw new Error(`R2 upload failed: ${response.status}`)
}

async function uploadVariants({
  familyId,
  userId,
  uploadId,
  extension,
  originalBlob,
  originalMimeType,
  display,
  thumb,
  accessToken,
}: {
  familyId: string
  userId: string
  uploadId: string
  extension: string
  originalBlob: Blob
  originalMimeType: string
  display: { blob: Blob; mimeType: string } | null
  thumb: { blob: Blob; mimeType: string } | null
  accessToken: string
}) {
  const originalSupabasePath = `${familyId}/${userId}/original/${uploadId}.${extension}`
  const displaySupabasePath = display ? `${familyId}/${userId}/display/${uploadId}.jpg` : originalSupabasePath
  const thumbnailSupabasePath = thumb ? `${familyId}/${userId}/thumb/${uploadId}.jpg` : displaySupabasePath
  const uploadedSupabasePaths: string[] = []

  const r2Objects = [
    { key: `uploads/${familyId}/${userId}/original/${uploadId}.${extension}`, contentType: originalMimeType },
    ...(display ? [{ key: `uploads/${familyId}/${userId}/display/${uploadId}.jpg`, contentType: display.mimeType }] : []),
    ...(thumb ? [{ key: `uploads/${familyId}/${userId}/thumb/${uploadId}.jpg`, contentType: thumb.mimeType }] : []),
  ]

  const signed = await signR2Objects(r2Objects, accessToken)
  if (signed?.length === r2Objects.length) {
    try {
      const [originalSigned, displaySigned, thumbSigned] = signed
      await uploadR2Blob(originalBlob, originalSigned!, originalMimeType)
      if (display && displaySigned) await uploadR2Blob(display.blob, displaySigned, display.mimeType)
      if (thumb && thumbSigned) await uploadR2Blob(thumb.blob, thumbSigned, thumb.mimeType)

      return {
        bucket: 'r2',
        originalPath: originalSigned!.publicUrl,
        displayPath: display && displaySigned ? displaySigned.publicUrl : originalSigned!.publicUrl,
        thumbnailPath: thumb && thumbSigned ? thumbSigned.publicUrl : (display && displaySigned ? displaySigned.publicUrl : originalSigned!.publicUrl),
        uploadedSupabasePaths,
      }
    } catch (error) {
      console.warn('[MobileUpload] R2 upload failed; falling back to Supabase Storage.', error)
    }
  }

  await uploadBlob(originalSupabasePath, originalBlob, originalMimeType)
  uploadedSupabasePaths.push(originalSupabasePath)

  if (display) {
    await uploadBlob(displaySupabasePath, display.blob, display.mimeType)
    uploadedSupabasePaths.push(displaySupabasePath)
  }

  if (thumb) {
    await uploadBlob(thumbnailSupabasePath, thumb.blob, thumb.mimeType)
    uploadedSupabasePaths.push(thumbnailSupabasePath)
  }

  return {
    bucket: uploadsBucket,
    originalPath: originalSupabasePath,
    displayPath: displaySupabasePath,
    thumbnailPath: thumbnailSupabasePath,
    uploadedSupabasePaths,
  }
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

  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token
  if (!accessToken) throw new Error('Sign in again before uploading memories.')

  const originalBlob = await uriToBlob(asset.uri)
  const mimeType = asset.mimeType ?? originalBlob.type ?? (asset.type === 'video' ? 'video/mp4' : 'image/jpeg')
  const extension = extFromUri(asset.uri, mimeType)
  const uploadId = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const uploadedPaths: string[] = []

  try {
    let display: { blob: Blob; mimeType: string } | null = null
    let thumb: { blob: Blob; mimeType: string } | null = null

    if (isImageAsset(asset)) {
      display = await makeImageVariant(asset, DISPLAY_IMAGE_WIDTH, DISPLAY_IMAGE_COMPRESS)
      thumb = await makeImageVariant(asset, THUMBNAIL_IMAGE_WIDTH, THUMBNAIL_IMAGE_COMPRESS)
    }

    const uploadLocation = await uploadVariants({
      familyId: membership.family_id,
      userId,
      uploadId,
      extension,
      originalBlob,
      originalMimeType: mimeType,
      display,
      thumb,
      accessToken,
    })
    uploadedPaths.push(...uploadLocation.uploadedSupabasePaths)

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
      p_bucket: uploadLocation.bucket,
      p_file_path: uploadLocation.displayPath,
      p_original_filename: asset.fileName ?? `mobile-upload.${extension}`,
      p_file_size: asset.fileSize ?? originalBlob.size,
      p_mime_type: mimeType,
      p_display_order: (lastOrdered?.display_order ?? -1) + 1,
      p_display_scope: 'pending',
    }

    let { error: rpcError } = await supabase.rpc('insert_upload', {
      ...uploadRecord,
      p_original_url: uploadLocation.originalPath,
      p_display_url: uploadLocation.displayPath,
      p_thumbnail_url: uploadLocation.thumbnailPath,
    })

    if (rpcError && /p_original_url|p_display_url|p_thumbnail_url|function .* does not exist/i.test(rpcError.message)) {
      ;({ error: rpcError } = await supabase.rpc('insert_upload', uploadRecord))
    }

    if (rpcError) throw rpcError

    return {
      originalPath: uploadLocation.originalPath,
      displayPath: uploadLocation.displayPath,
      thumbnailPath: uploadLocation.thumbnailPath,
    }
  } catch (error) {
    if (uploadedPaths.length > 0) {
      await supabase.storage.from(uploadsBucket).remove(uploadedPaths).catch(() => undefined)
    }
    throw error
  }
}

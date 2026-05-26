import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import { supabase } from './supabase'

// ── 类型 ──────────────────────────────────────────────────────────────────
export type PickedAsset = {
  uri: string
  fileName: string | null
  mimeType: string | null
  fileSize: number | null
}

export type UploadProgressCallback = (phase: string, percent: number) => void

// ── 媒体选择（请求权限 → 打开相册）──────────────────────────────────────
export async function pickSingleMemory(): Promise<PickedAsset | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (status !== 'granted') {
    throw new Error('需要相册权限才能选择照片或视频。请在系统设置中开启。')
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.All,
    quality: 1,
    allowsEditing: false,
  })

  if (result.canceled || !result.assets?.[0]) return null

  const asset = result.assets[0]
  return {
    uri: asset.uri,
    fileName: asset.fileName ?? null,
    mimeType: asset.mimeType ?? null,
    fileSize: asset.fileSize ?? null,
  }
}

// ── 辅助：URI → Blob（React Native fetch 支持 file:// URI）────────────────
async function uriToBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri)
  return response.blob()
}

// ── 辅助：压缩图片 ────────────────────────────────────────────────────────
async function compressImage(uri: string, maxWidth: number, quality: number): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: maxWidth } }],
    { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
  )
  return result.uri
}

// ── 上传主函数 ────────────────────────────────────────────────────────────
export async function createMobileUpload(params: {
  userId: string
  title: string
  note: string
  asset: PickedAsset
  onProgress?: UploadProgressCallback
}): Promise<void> {
  const { userId, title, note, asset, onProgress } = params
  const bucket = process.env.EXPO_PUBLIC_SUPABASE_UPLOADS_BUCKET ?? 'family-uploads'
  const isVideo = asset.mimeType?.startsWith('video/') ?? false
  const ext = isVideo ? 'mp4' : 'jpg'
  const timestamp = Date.now()
  const basePath = `${userId}/${timestamp}`

  let originalUrl = ''
  let displayUrl = ''
  let thumbnailUrl = ''

  // ── Phase 1: 上传原图 ──────────────────────────────────────────────────
  onProgress?.('上传原文件…', 10)
  const originalBlob = await uriToBlob(asset.uri)
  const { error: origErr } = await supabase.storage
    .from(bucket)
    .upload(`original/${basePath}.${ext}`, originalBlob, {
      contentType: asset.mimeType ?? 'application/octet-stream',
      upsert: false,
    })
  if (origErr) throw new Error(`原文件上传失败: ${origErr.message}`)

  const { data: origData } = supabase.storage
    .from(bucket)
    .getPublicUrl(`original/${basePath}.${ext}`)
  originalUrl = origData.publicUrl

  // ── Phase 2: 压缩 display 图（图片才压缩）────────────────────────────
  onProgress?.('生成展示图…', 45)
  if (!isVideo) {
    const displayUri = await compressImage(asset.uri, 1600, 0.75)
    const displayBlob = await uriToBlob(displayUri)
    const { error: dispErr } = await supabase.storage
      .from(bucket)
      .upload(`display/${basePath}.jpg`, displayBlob, {
        contentType: 'image/jpeg',
        upsert: false,
      })
    if (dispErr) throw new Error(`展示图上传失败: ${dispErr.message}`)
    const { data: dispData } = supabase.storage
      .from(bucket)
      .getPublicUrl(`display/${basePath}.jpg`)
    displayUrl = dispData.publicUrl
  } else {
    displayUrl = originalUrl
  }

  // ── Phase 3: 压缩缩略图 ────────────────────────────────────────────────
  onProgress?.('生成缩略图…', 70)
  if (!isVideo) {
    const thumbUri = await compressImage(asset.uri, 360, 0.7)
    const thumbBlob = await uriToBlob(thumbUri)
    const { error: thumbErr } = await supabase.storage
      .from(bucket)
      .upload(`thumb/${basePath}.jpg`, thumbBlob, {
        contentType: 'image/jpeg',
        upsert: false,
      })
    if (thumbErr) throw new Error(`缩略图上传失败: ${thumbErr.message}`)
    const { data: thumbData } = supabase.storage
      .from(bucket)
      .getPublicUrl(`thumb/${basePath}.jpg`)
    thumbnailUrl = thumbData.publicUrl
  } else {
    thumbnailUrl = originalUrl
  }

  // ── Phase 4: 写入数据库 ────────────────────────────────────────────────
  onProgress?.('保存记录…', 90)

  // 优先用新版 insert_upload（三 URL），fallback 到旧版
  const { error: rpcErr } = await supabase.rpc('insert_upload', {
    p_user_id: userId,
    p_title: title,
    p_note: note,
    p_media_type: isVideo ? 'videos' : 'photos',
    p_original_url: originalUrl,
    p_display_url: displayUrl,
    p_thumbnail_url: thumbnailUrl,
  })

  if (rpcErr) {
    // fallback：旧版只传 original_url
    const { error: fallbackErr } = await supabase.rpc('insert_upload_legacy', {
      p_user_id: userId,
      p_title: title,
      p_note: note,
      p_media_type: isVideo ? 'videos' : 'photos',
      p_original_url: originalUrl,
    })
    if (fallbackErr) throw new Error(`写入记录失败: ${fallbackErr.message}`)
  }

  onProgress?.('完成', 100)
}

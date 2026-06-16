/**
 * src/services/photoUploadService.js
 *
 * Upload a pupil passport photo to Supabase Storage.
 *
 * Pipeline:
 *   1. Accept a File from <input type="file" accept="image/*">
 *   2. Client-side compress to max 600x600px JPEG, ~80KB target — phone
 *      cameras produce 5MB+ files, which are wasteful and slow to upload
 *      on Lagos 3G. Passport-style photos are small at display time anyway.
 *   3. Upload to the pupil-photos bucket at path `{school_id}/{pupil_id}.jpg`
 *   4. Return the storage path; caller writes it onto the pupil row
 *
 * STORAGE POLICY NOTE: the pupil-photos bucket needs RLS policies set
 * via Supabase Studio. The two policies needed:
 *   - INSERT/UPDATE: school staff for objects whose path starts with their school_id
 *   - SELECT:        school staff (any school's pupils visible) + parents of that pupil
 * For v1 we keep the bucket non-public and use signed URLs when serving.
 */

import { supabase } from '@/lib/supabase';

const BUCKET = 'pupil-photos';
const MAX_DIM = 600;
const JPEG_QUALITY = 0.78;

/**
 * Compress an image File to a JPEG Blob using canvas. Server doesn't
 * touch it; everything runs in the browser.
 */
async function compressToJpeg(file) {
  if (!file.type.startsWith('image/')) {
    throw new Error('File must be an image.');
  }

  const dataUrl = await fileToDataUrl(file);
  const img = await loadImage(dataUrl);

  // Cover-crop to a square (passport convention) at MAX_DIM × MAX_DIM
  const size = MAX_DIM;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Cover-fit: scale so the shorter side fills the canvas, center-crop the rest
  const scale = size / Math.min(img.width, img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const dx = (size - drawW) / 2;
  const dy = (size - drawH) / 2;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(img, dx, dy, drawW, drawH);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('canvas.toBlob returned null')),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode image'));
    img.src = src;
  });
}

/**
 * Compress + upload a passport photo. Returns the storage path
 * (e.g. "00000000-0000-0000.../adaeze-okafor-id.jpg").
 */
export async function uploadPupilPhoto({ file, schoolId, pupilId }) {
  if (!file) throw new Error('No file selected.');
  if (!schoolId || !pupilId) throw new Error('Missing schoolId or pupilId.');

  const blob = await compressToJpeg(file);
  const path = `${schoolId}/${pupilId}.jpg`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, {
      contentType: 'image/jpeg',
      cacheControl: '3600',
      upsert: true, // overwrite if re-uploading
    });
  if (error) throw new Error(`Photo upload failed: ${error.message}`);

  return path;
}

/**
 * Get a fresh signed URL for displaying a pupil photo.
 * Bucket is private; we don't expose raw object paths.
 */
export async function getPupilPhotoUrl(storagePath, { expiresIn = 60 * 60 } = {}) {
  if (!storagePath) return null;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresIn);
  if (error) {
    console.warn('[photoUpload] signed URL failed:', error.message);
    return null;
  }
  return data.signedUrl;
}

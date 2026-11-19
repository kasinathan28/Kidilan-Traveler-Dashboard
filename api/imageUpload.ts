// Uploads an image straight to Cloudflare R2 using a presigned URL from the backend, and returns its public URL.
// Falls back to a base64 data URL (the old behaviour) if the presign/PUT step fails for any reason
// (R2 not configured on the backend yet, CORS not set on the bucket, offline...), so saving never breaks.

const BASE_URL = import.meta.env.VITE_API_URL;

export type UploadFolder = 'products' | 'categories' | 'portfolio';

const toDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

/** Direct upload to R2. Returns the public URL, or null if it could not be done. */
export async function uploadImageToR2(file: File, folder: UploadFolder): Promise<string | null> {
  try {
    const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
    const presign = await fetch(`${BASE_URL}/upload/presign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ folder, contentType: file.type, size: file.size }),
    });
    if (!presign.ok) throw new Error(`presign failed (${presign.status})`);
    const { uploadUrl, publicUrl } = await presign.json();

    const put = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type, 'Cache-Control': 'public, max-age=31536000, immutable' },
      body: file,
    });
    if (!put.ok) throw new Error(`upload failed (${put.status})`);
    return publicUrl as string;
  } catch (err) {
    console.warn('Direct upload unavailable:', err);
    return null;
  }
}

/** Direct upload, falling back to an inline base64 image (old behaviour) so saving never breaks. */
export async function uploadImage(file: File, folder: UploadFolder): Promise<string> {
  return (await uploadImageToR2(file, folder)) ?? toDataUrl(file);
}

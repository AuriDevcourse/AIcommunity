// Client-side image compression. Downscales to maxDim and re-encodes as JPEG so
// uploads stay light on the server (and fast for everyone). Animated GIFs and
// non-images pass through untouched — a canvas would flatten a GIF to one frame.
const MAX_DIM = 1600;
const QUALITY = 0.82;

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

// Returns { data, dataUrl, contentType, bytes, originalBytes, skipped }.
// `data` is base64 without the data: prefix (what the upload endpoints expect).
export async function compressImage(file, { maxDim = MAX_DIM, quality = QUALITY } = {}) {
  const originalBytes = file.size;

  if (file.type === 'image/gif' || !file.type.startsWith('image/')) {
    const dataUrl = await readAsDataURL(file);
    return { data: dataUrl.split(',')[1], dataUrl, contentType: file.type, bytes: originalBytes, originalBytes, skipped: true };
  }

  const dataUrl = await new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image (HEIC is not supported, use JPG or PNG).')); };
    img.src = url;
  });

  const base64 = dataUrl.split(',')[1];
  const bytes = Math.round((base64.length * 3) / 4); // base64 → byte size
  return { data: base64, dataUrl, contentType: 'image/jpeg', bytes, originalBytes, skipped: false };
}

export const formatBytes = (n) =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;

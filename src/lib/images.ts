import { MessageImage } from './storage';

export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
export const MAX_IMAGES_PER_MESSAGE = 5;

export function isSupportedImageType(file: File): boolean {
  if (ACCEPTED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
    return true;
  }
  // Check extension if type is empty or generic
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext || '');
}

export async function processImageFile(file: File): Promise<MessageImage> {
  if (!isSupportedImageType(file)) {
    throw new Error(`${file.name} isn't supported. Use PNG, JPEG, WEBP or GIF.`);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error(`Failed to decode ${file.name}`));
      img.onload = () => {
        try {
          const maxDim = 1568;
          let width = img.naturalWidth || img.width;
          let height = img.naturalHeight || img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return reject(new Error('Canvas context unavailable'));
          }

          ctx.drawImage(img, 0, 0, width, height);

          // Check if original is PNG with transparency and small size
          const isPng = file.type.toLowerCase() === 'image/png';
          let outputMime = 'image/jpeg';
          let quality = 0.85;

          if (isPng && file.size < 1.5 * 1024 * 1024) {
            // Check for transparency
            const imgData = ctx.getImageData(0, 0, width, height).data;
            let hasAlpha = false;
            for (let i = 3; i < imgData.length; i += 4) {
              if (imgData[i] < 255) {
                hasAlpha = true;
                break;
              }
            }
            if (hasAlpha) {
              outputMime = 'image/png';
              quality = 1.0;
            }
          }

          const dataUrl = canvas.toDataURL(outputMime, quality);
          const base64 = dataUrl.split(',')[1] || '';

          // Approx size in bytes: base64 length * 0.75
          const byteLength = base64.length * 0.75;
          if (byteLength > 4 * 1024 * 1024) {
            return reject(new Error(`${file.name} is too large (over 4 MB after compression).`));
          }

          resolve({
            mime: outputMime,
            base64,
          });
        } catch (err: any) {
          reject(err);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

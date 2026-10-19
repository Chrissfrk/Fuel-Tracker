/** Resize a photo so its longest side is ≤ 1600 px and re-encode (WebP if supported, else JPEG). */
export async function compressImage(file: Blob, maxSide = 1600, quality = 0.8): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(
    () => null,
  );
  let width: number, height: number, source: CanvasImageSource;
  if (bitmap) {
    ({ width, height } = bitmap);
    source = bitmap;
  } else {
    const img = await loadImage(file);
    width = img.naturalWidth;
    height = img.naturalHeight;
    source = img;
  }
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process the image');
  ctx.drawImage(source, 0, 0, w, h);
  bitmap?.close();
  const webp = await toBlob(canvas, 'image/webp', quality);
  if (webp && webp.type === 'image/webp') return webp;
  const jpeg = await toBlob(canvas, 'image/jpeg', quality);
  if (!jpeg) throw new Error('Could not compress the image');
  return jpeg;
}

const toBlob = (c: HTMLCanvasElement, type: string, q: number) =>
  new Promise<Blob | null>((r) => c.toBlob(r, type, q));

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file is not an image we can read'));
    };
    img.src = url;
  });
}

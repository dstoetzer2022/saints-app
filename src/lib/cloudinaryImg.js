// Cloudinary delivery optimization (Phase 4.5). Inserts f_auto,q_auto and a
// width cap into an existing Cloudinary URL so logos/thumbnails stop shipping
// full-size PNGs to phones. Non-Cloudinary URLs pass through untouched.
export function cldImg(url, width) {
  if (!url || typeof url !== 'string' || !url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
  if (url.includes('f_auto')) return url; // already transformed
  const t = width ? `f_auto,q_auto,w_${width}` : 'f_auto,q_auto';
  return url.replace('/upload/', `/upload/${t}/`);
}

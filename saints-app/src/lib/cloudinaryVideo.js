// Reframes a Cloudinary-hosted clip to fill the dugout video panel edge-to-edge
// in either orientation, using g_auto (saliency detection) to keep the pitcher
// in frame instead of letterboxing a 16:9 source inside a portrait box.
// Works on-the-fly via URL transformation — no re-upload needed.
export function dugoutVideoUrl(videoUrl, orientation) {
  if (!videoUrl) return null;
  const transform = orientation === 'vertical'
    ? 'ar_9:16,c_fill,g_auto,q_auto,f_auto'
    : 'ar_16:9,c_fill,g_auto,q_auto,f_auto';
  return videoUrl.replace('/upload/', `/upload/${transform}/`);
}

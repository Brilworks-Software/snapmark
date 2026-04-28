// offscreen/offscreen.js

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === 'stitch-images') {
    const { images, totalWidth, totalHeight } = message.data;
    console.log(`Offscreen: Stitching ${images.length} images into ${totalWidth}x${totalHeight}`);
    
    try {
      // Safe cap for browser canvas limits
      const MAX_CANVAS_HEIGHT = 16000; 
      const finalHeight = Math.min(totalHeight, MAX_CANVAS_HEIGHT);
      
      const canvas = document.createElement('canvas');
      canvas.width = totalWidth;
      canvas.height = finalHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) throw new Error('Canvas context not available');

      // Default white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, totalWidth, finalHeight);

      for (const segment of images) {
        if (segment.y >= finalHeight) continue;

        try {
          const img = await loadImage(segment.dataUrl);
          ctx.drawImage(img, 0, 0, img.width, img.height, 0, segment.y, img.width, img.height);
        } catch (e) {
          console.warn('Offscreen: Failed to draw segment', e);
        }
      }

      console.log('Offscreen: Generating final JPEG...');
      const finalDataUrl = canvas.toDataURL('image/jpeg', 0.8);
      
      if (!finalDataUrl || finalDataUrl.length < 1000) {
        throw new Error('Final image export failed');
      }

      sendResponse({ success: true, dataUrl: finalDataUrl });
    } catch (error) {
      console.error('Offscreen: Stitching failed:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true; 
  }
});

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image decode failed'));
    img.src = url;
  });
}

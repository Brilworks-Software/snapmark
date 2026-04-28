// offscreen/offscreen.js

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === 'stitch-images-from-storage') {
    const { count, totalWidth, totalHeight } = message.data;
    console.log(`Offscreen: Stitching ${count} segments from storage into ${totalWidth}x${totalHeight}`);
    
    try {
      const MAX_CANVAS_HEIGHT = 16000; 
      const finalHeight = Math.min(totalHeight, MAX_CANVAS_HEIGHT);
      
      const canvas = document.createElement('canvas');
      canvas.width = totalWidth;
      canvas.height = finalHeight;
      const ctx = canvas.getContext('2d');

      // White background fallback
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, totalWidth, finalHeight);

      for (let i = 0; i < count; i++) {
        const key = `sm_seg_${i}`;
        const result = await chrome.storage.local.get(key);
        const segment = result[key];

        if (!segment) {
          console.warn(`Offscreen: Missing segment ${i}`);
          continue;
        }

        if (segment.y >= finalHeight) continue;

        const img = await loadImage(segment.dataUrl);
        ctx.drawImage(img, 0, 0, img.width, img.height, 0, segment.y, img.width, img.height);
      }

      console.log('Offscreen: Exporting final image...');
      const finalDataUrl = canvas.toDataURL('image/jpeg', 0.8);
      
      if (!finalDataUrl || finalDataUrl.length < 1000) {
        throw new Error('Canvas export produced invalid result');
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
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = url;
  });
}

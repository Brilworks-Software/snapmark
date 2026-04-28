// offscreen/offscreen.js

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === 'stitch-images') {
    const { images, totalWidth, totalHeight } = message.data;
    console.log(`Offscreen: Stitching ${images.length} images into ${totalWidth}x${totalHeight} canvas`);
    
    try {
      // Chrome Max Canvas Size is typically 16,384px or 32,767px
      // We cap it at 16k to be safe across all systems
      const MAX_HEIGHT = 16000;
      const finalHeight = Math.min(totalHeight, MAX_HEIGHT);
      
      const canvas = document.createElement('canvas');
      canvas.width = totalWidth;
      canvas.height = finalHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Could not create 2D context for stitching');
      }

      for (const imgData of images) {
        // Skip images beyond the max height
        if (imgData.y >= finalHeight) continue;
        
        const img = await loadImage(imgData.dataUrl);
        ctx.drawImage(img, imgData.x, imgData.y);
      }

      console.log('Offscreen: Exporting DataURL...');
      const finalDataUrl = canvas.toDataURL('image/jpeg', 0.9);
      
      if (!finalDataUrl || finalDataUrl === 'data:,') {
        throw new Error('DataURL export failed (canvas might be too large)');
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
    img.onerror = (e) => reject(new Error('Failed to load segment image'));
    img.src = url;
  });
}

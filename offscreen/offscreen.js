// offscreen/offscreen.js

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === 'stitch-images') {
    const { images, totalWidth, totalHeight } = message.data;
    console.log(`Offscreen: Stitching ${images.length} segments into ${totalWidth}x${totalHeight}`);
    
    try {
      const MAX_CANVAS_HEIGHT = 16000; 
      const finalHeight = Math.min(totalHeight, MAX_CANVAS_HEIGHT);
      
      const canvas = document.createElement('canvas');
      canvas.width = totalWidth;
      canvas.height = finalHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) throw new Error('Failed to get 2D context');

      // Fill with white background initially
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, totalWidth, finalHeight);

      for (let i = 0; i < images.length; i++) {
        const imgData = images[i];
        if (imgData.y >= finalHeight) {
          console.log(`Offscreen: Skipping segment ${i} (out of bounds)`);
          continue;
        }

        console.log(`Offscreen: Loading segment ${i}...`);
        const img = await loadImage(imgData.dataUrl);
        
        console.log(`Offscreen: Drawing segment ${i} at y=${imgData.y} (size: ${img.width}x${img.height})`);
        // Draw with explicit source and destination to ensure no scaling issues
        ctx.drawImage(img, 0, 0, img.width, img.height, imgData.x, imgData.y, img.width, img.height);
      }

      console.log('Offscreen: Finalizing canvas to JPEG...');
      const finalDataUrl = canvas.toDataURL('image/jpeg', 0.9);
      
      if (!finalDataUrl || finalDataUrl.length < 100) {
        throw new Error('Canvas export failed or result too small');
      }

      console.log(`Offscreen: Stitching complete. DataURL length: ${finalDataUrl.length}`);
      sendResponse({ success: true, dataUrl: finalDataUrl });
    } catch (error) {
      console.error('Offscreen: Error:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true; 
  }
});

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Segment image failed to load'));
    img.src = url;
  });
}

// offscreen/offscreen.js

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === 'stitch-images') {
    const { images, totalWidth, totalHeight } = message.data;
    
    try {
      const canvas = document.createElement('canvas');
      canvas.width = totalWidth;
      canvas.height = totalHeight;
      const ctx = canvas.getContext('2d');

      for (const imgData of images) {
        const img = await loadImage(imgData.dataUrl);
        ctx.drawImage(img, imgData.x, imgData.y);
      }

      const finalDataUrl = canvas.toDataURL('image/png');
      sendResponse({ success: true, dataUrl: finalDataUrl });
    } catch (error) {
      console.error('Stitching failed:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true; // Keep channel open for async
  }
});

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

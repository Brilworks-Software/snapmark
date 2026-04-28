// content/fullpage.js

(async function() {
  console.log('SnapMark: Full-page capture started');
  
  const progress = document.createElement('div');
  progress.style.cssText = 'position:fixed;top:20px;right:20px;padding:15px 25px;background:#3B82F6;color:white;border-radius:10px;z-index:9999999;font-family:sans-serif;box-shadow:0 10px 25px rgba(0,0,0,0.2);font-weight:bold;transition:all 0.3s;';
  progress.textContent = '📸 Capturing: 0%';
  document.body.appendChild(progress);

  const vh = window.innerHeight;
  const totalHeight = Math.max(
    document.body.scrollHeight, 
    document.documentElement.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.offsetHeight
  );
  const dpr = window.devicePixelRatio;
  
  window.scrollTo(0, 0);
  await new Promise(r => setTimeout(r, 500));

  let currentY = 0;
  try {
    while (currentY < totalHeight) {
      const scrollY = Math.min(currentY, totalHeight - vh);
      window.scrollTo(0, scrollY);
      
      const percent = Math.round((currentY / totalHeight) * 100);
      progress.textContent = `📸 Capturing: ${percent}%`;
      
      await new Promise(r => setTimeout(r, 700)); 
      
      const response = await chrome.runtime.sendMessage({ type: 'CAPTURE_PART_REQUEST' });
      
      if (response && response.dataUrl) {
        // Send segment to background immediately to save memory in content script
        await chrome.runtime.sendMessage({
          type: 'PUSH_SEGMENT',
          segment: {
            dataUrl: response.dataUrl,
            x: 0,
            y: scrollY * dpr
          }
        });
      }

      if (currentY + vh >= totalHeight) break;
      currentY += vh;
    }

    progress.textContent = '🎨 Stitching...';
    await chrome.runtime.sendMessage({
      type: 'FINISH_FULL_PAGE_CAPTURE',
      data: {
        width: window.innerWidth * dpr,
        height: totalHeight * dpr
      }
    });
    
    progress.remove();
  } catch (err) {
    progress.style.background = '#EF4444';
    progress.textContent = '❌ Capture Failed';
    setTimeout(() => progress.remove(), 4000);
  }
})();

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'CAPTURE_ERROR') {
    alert('Capture Failed: ' + msg.error);
    window.location.reload();
  }
});

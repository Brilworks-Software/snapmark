// content/fullpage.js

(async function() {
  console.log('SnapMark: Full-page capture started');
  
  // Create a progress indicator
  const progress = document.createElement('div');
  progress.style.cssText = 'position:fixed;top:20px;right:20px;padding:15px 25px;background:#3B82F6;color:white;border-radius:10px;z-index:9999999;font-family:sans-serif;box-shadow:0 10px 25px rgba(0,0,0,0.2);font-weight:bold;';
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
  const segments = [];
  
  window.scrollTo(0, 0);
  await new Promise(r => setTimeout(r, 500));

  let currentY = 0;
  try {
    while (currentY < totalHeight) {
      const scrollY = Math.min(currentY, totalHeight - vh);
      window.scrollTo(0, scrollY);
      
      // Update progress
      const percent = Math.round((currentY / totalHeight) * 100);
      progress.textContent = `📸 Capturing: ${percent}%`;
      
      await new Promise(r => setTimeout(r, 600)); // Increased delay for stability
      
      console.log('SnapMark: Requesting capture at', scrollY);
      const response = await chrome.runtime.sendMessage({ type: 'CAPTURE_PART_REQUEST' });
      
      if (response && response.dataUrl) {
        segments.push({
          dataUrl: response.dataUrl,
          x: 0,
          y: scrollY * dpr
        });
        console.log('SnapMark: Captured segment', segments.length);
      } else {
        console.error('SnapMark: Failed to capture segment at', scrollY);
      }

      if (currentY + vh >= totalHeight) break;
      currentY += vh;
    }

    progress.textContent = '🎨 Stitching...';
    console.log('SnapMark: Finishing capture, segments:', segments.length);

    await chrome.runtime.sendMessage({
      type: 'FINISH_FULL_PAGE_CAPTURE',
      data: {
        segments,
        width: window.innerWidth * dpr,
        height: totalHeight * dpr
      }
    });
    
    progress.remove();
  } catch (err) {
    console.error('SnapMark: Full-page error:', err);
    progress.style.background = '#EF4444';
    progress.textContent = '❌ Capture Failed';
    setTimeout(() => progress.remove(), 3000);
  }
})();

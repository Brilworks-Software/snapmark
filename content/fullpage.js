// content/fullpage.js

(async function() {
  const vh = window.innerHeight;
  const totalHeight = Math.max(
    document.body.scrollHeight, 
    document.documentElement.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.offsetHeight
  );
  const dpr = window.devicePixelRatio;
  const segments = [];
  
  // 1. Scroll to top
  window.scrollTo(0, 0);
  await new Promise(r => setTimeout(r, 300));

  let currentY = 0;
  while (currentY < totalHeight) {
    const scrollY = Math.min(currentY, totalHeight - vh);
    window.scrollTo(0, scrollY);
    
    // Wait for repaint/lazy load
    await new Promise(r => setTimeout(r, 400));
    
    // Request capture from background
    const response = await chrome.runtime.sendMessage({
      type: 'CAPTURE_PART_REQUEST'
    });
    
    if (response && response.dataUrl) {
      segments.push({
        dataUrl: response.dataUrl,
        x: 0,
        y: scrollY * dpr
      });
    }

    if (currentY + vh >= totalHeight) break;
    currentY += vh;
  }

  // 2. Stitch and open
  await chrome.runtime.sendMessage({
    type: 'FINISH_FULL_PAGE_CAPTURE',
    data: {
      segments,
      width: window.innerWidth * dpr,
      height: totalHeight * dpr
    }
  });
})();

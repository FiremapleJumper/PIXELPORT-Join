/* A standards-based isolation fallback for static hosts without custom headers. */
window.pixelPortIsolation=(async()=>{
 if(crossOriginIsolated||!('serviceWorker' in navigator))return;
 try{
  const registration=await navigator.serviceWorker.register('./isolation-sw.js',{scope:'./'});
  await navigator.serviceWorker.ready;
  if(!navigator.serviceWorker.controller){
    await Promise.race([new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true})),new Promise(resolve=>setTimeout(resolve,2500))]);
  }
  if(navigator.serviceWorker.controller&&!sessionStorage.getItem('pixelport-isolation-reloaded')){
   sessionStorage.setItem('pixelport-isolation-reloaded','1');location.reload();
  }
 }catch{/* Single-threaded cores still work; disc launch displays an actionable error. */}
})();

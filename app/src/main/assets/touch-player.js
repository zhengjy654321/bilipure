// Tablet controls: real media element remains owned by Bilibili.
(()=>{
 if(window.__orangeTouchPlayer)return;window.__orangeTouchPlayer=true;
 const style=document.createElement('style');style.textContent=`
 .orange-touch-player{position:absolute;inset:0;z-index:10000;color:white;font:14px system-ui;pointer-events:none}
 .orange-touch-player *{box-sizing:border-box}.orange-touch-player [hidden]{display:none!important}
 .orange-touch-surface{position:absolute;inset:0;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;pointer-events:auto;background:transparent}
 .orange-touch-bar{position:absolute;left:12px;right:82px;bottom:12px;padding:12px;border-radius:16px;background:#102b25e8;display:flex;align-items:center;gap:10px;flex-wrap:wrap;pointer-events:auto;touch-action:manipulation}
 .orange-touch-bar button,.orange-touch-bar select{min-height:44px;min-width:44px;border:1px solid #ffffff55;border-radius:10px;background:#264b40;color:white;padding:6px 10px;font:14px system-ui}
 .orange-touch-bar input{flex:1;min-width:100px;accent-color:#f7b34b;height:36px;touch-action:none}
 .orange-touch-time{font:12px monospace;white-space:nowrap}.orange-touch-hint{position:absolute;left:50%;top:35%;transform:translate(-50%,-50%);padding:14px 20px;border-radius:14px;background:#102b25eb;text-align:center;white-space:pre-line;pointer-events:none}
 .orange-native-controls .orange-touch-bar,.orange-native-controls .orange-touch-surface,.orange-native-controls .orange-touch-hint{display:none!important}
 .orange-native-controls .bpx-player-control-wrap,.orange-native-controls .bilibili-player-video-control{visibility:visible!important;opacity:1!important;pointer-events:auto!important;transform:none!important}
 .orange-touch-managed:not(.orange-native-controls) .bpx-player-control-wrap,.orange-touch-managed:not(.orange-native-controls) .bilibili-player-video-control{visibility:hidden!important;pointer-events:none!important}
 `;document.head.append(style);
 let current=null,nativeControls=false;
 const time=n=>{n=Math.max(0,Math.floor(n||0));return (n>=3600?Math.floor(n/3600)+':':'')+String(Math.floor(n/60)%60).padStart(2,'0')+':'+String(n%60).padStart(2,'0');};
 function attach(video,parent){
  const oldPosition=parent.style.position;if(getComputedStyle(parent).position==='static')parent.style.position='relative';
  parent.classList.add('orange-touch-managed');
  const el=document.createElement('div');el.className='orange-touch-player';
  el.innerHTML=`<div class="orange-touch-surface" aria-label="单击显示控制栏，横滑定位，左侧竖滑调亮度，右侧竖滑调音量，长按临时倍速"></div><div class="orange-touch-hint" hidden></div><div class="orange-touch-bar" hidden><button data-action="play" aria-label="播放或暂停">播放</button><span class="orange-touch-time"></span><input type="range" min="0" max="10000" value="0" aria-label="视频进度"><select aria-label="播放倍速">${[.5,.75,1,1.25,1.5,1.75,2,2.5,3].map(x=>`<option value="${x}">${x}×</option>`).join('')}</select><button data-action="danmaku">弹幕</button><button data-action="settings">画质／设置</button><button data-action="full">全屏</button></div>`;
  const returnButton=document.createElement('button');returnButton.textContent='返回触摸操作';returnButton.hidden=true;returnButton.style.cssText='position:absolute;left:12px;top:12px;min-height:44px;padding:10px;background:#183d32;color:white;border:1px solid white;border-radius:12px;pointer-events:auto';el.append(returnButton);
  parent.append(el);const surface=el.querySelector('.orange-touch-surface'),bar=el.querySelector('.orange-touch-bar'),hint=el.querySelector('.orange-touch-hint'),range=el.querySelector('input'),speed=el.querySelector('select');
  let gesture=null,holdTimer=0,hideTimer=0,tapTimer=0,lastTap=0,scrubbing=false,oldRate=null,disposed=false,nativeMode=nativeControls;
  if(nativeMode){parent.classList.add('orange-native-controls');surface.hidden=true;returnButton.hidden=false;}
  const ready=()=>Number.isFinite(video.duration)&&video.duration>0;
  const clamp=n=>Math.max(0,Math.min(video.duration,n));
  const stop=e=>{e.stopPropagation();if(e.cancelable)e.preventDefault();};
  function restoreRate(){if(oldRate!==null){video.playbackRate=oldRate;oldRate=null;}}
  function autoHide(){clearTimeout(hideTimer);if(nativeMode)return;if(!bar.hidden&&!video.paused&&!scrubbing)hideTimer=setTimeout(()=>{if(document.activeElement!==speed)bar.hidden=true;},3200);}
  function show(){if(nativeMode||disposed)return;bar.hidden=false;render();autoHide();}
  function togglePlay(){if(video.paused)video.play().catch(()=>{hint.textContent='暂时无法播放，请重试';hint.hidden=false;});else video.pause();show();}
  const dmSelector='.bpx-player-dm-switch,.bilibili-player-video-danmaku-switch';
  const dmButton=el.querySelector('[data-action=danmaku]');let dmPending=false,dmTimer=0;
  function dmControl(){
   // The send bar can be outside the fullscreen player container.
   const roots=[parent,parent.closest('#bilibili-player')||parent.parentElement,document].filter(Boolean);
   for(const root of roots){for(const wrap of root.querySelectorAll(dmSelector)){
    const input=wrap.querySelector('input[type="checkbox"],input.bui-danmaku-switch-input,input.bui-switch-input');
    if(input)return {target:input,state:input.checked,disabled:input.disabled};
    const target=wrap.matches('[role="switch"],[aria-checked]')?wrap:wrap.querySelector('[role="switch"],[aria-checked]');
    if(target&&['true','false'].includes(target.getAttribute('aria-checked')))return {target,state:target.getAttribute('aria-checked')==='true',disabled:target.getAttribute('aria-disabled')==='true'};
   }}return null;
  }
  function renderDanmaku(){const control=dmControl();dmButton.textContent=control?'弹幕：'+(control.state?'开':'关'):'弹幕：未就绪';if(control)dmButton.setAttribute('aria-pressed',String(control.state));else dmButton.removeAttribute('aria-pressed');dmButton.disabled=dmPending||!!control?.disabled;}
  function toggleDanmaku(){const control=dmControl();if(dmPending)return;if(!control||control.disabled){hint.textContent='弹幕开关尚未就绪，请稍后重试';hint.hidden=false;return;}
   dmPending=true;const before=control.state;control.target.click();renderDanmaku();
   dmTimer=setTimeout(()=>{if(disposed)return;dmPending=false;const after=dmControl();renderDanmaku();if(!after||after.state===before){hint.textContent='弹幕切换未生效，请在画质／设置中检查官方开关';hint.hidden=false;}},180);
  }
  const dmPoll=setInterval(renderDanmaku,400);
  function render(){if(disposed)return;renderDanmaku();el.querySelector('[data-action=play]').textContent=video.paused?'播放':'暂停';el.querySelector('.orange-touch-time').textContent=time(video.currentTime)+' / '+time(video.duration);if(!scrubbing)range.value=ready()?video.currentTime/video.duration*10000:0;range.disabled=!ready();if(oldRate===null)speed.value=String(video.playbackRate);}
  function cancel(){clearTimeout(holdTimer);gesture=null;restoreRate();hint.hidden=true;}
  function down(e){if(nativeMode)return;stop(e);if(gesture){cancel();return;}if(e.button!==0)return;const rect=surface.getBoundingClientRect();
   gesture={levelId:Math.random().toString(36).slice(2),side:e.clientX<rect.left+rect.width/2?'brightness':'volume',height:Math.max(1,rect.height),id:e.pointerId,x:e.clientX,y:e.clientY,start:video.currentTime,width:Math.max(1,surface.getBoundingClientRect().width),kind:'tap',target:video.currentTime};surface.setPointerCapture?.(e.pointerId);
   holdTimer=setTimeout(()=>{if(!gesture||gesture.kind!=='tap'||video.paused)return;gesture.kind='hold';oldRate=video.playbackRate;video.playbackRate=Math.max(2,oldRate);hint.textContent=`临时 ${video.playbackRate}×\n松手恢复 ${oldRate}×`;hint.hidden=false;},450);
  }
  function move(e){if(!gesture||gesture.id!==e.pointerId)return;stop(e);const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;
   if(gesture.kind==='hold')return;
   if(gesture.kind==='tap'&&Math.hypot(dx,dy)>10){
    clearTimeout(holdTimer);clearTimeout(tapTimer);lastTap=0;
    if(Math.abs(dx)>Math.abs(dy)*1.2)gesture.kind=ready()?'seek':'cancel';
    else if(Math.abs(dy)>Math.abs(dx)*1.2)gesture.kind=gesture.side;
    else return;
   }
   if(gesture.kind==='volume'||gesture.kind==='brightness'){
    const g=gesture;
    const delta=Math.round(-100*dy/g.height)/100;
    if(g.delta===delta)return;
    g.delta=delta;
    if(typeof orangeCall==='function')orangeCall('level',{kind:g.kind,gesture:g.levelId,delta}).then(level=>{
     if(gesture===g&&g.delta===delta){hint.textContent=(g.kind==='volume'?'音量 ':'亮度 ')+Math.round(level*100)+'%';hint.hidden=false;}
    }).catch(()=>{if(gesture===g){hint.textContent='当前设备不允许调节';hint.hidden=false;}});
    return;
   }
   if(gesture.kind==='seek'){gesture.target=clamp(gesture.start+dx/gesture.width*60);const delta=gesture.target-gesture.start;hint.textContent=`${delta>=0?'+':''}${delta.toFixed(1)} 秒\n${time(gesture.target)} / ${time(video.duration)}\n松手跳转`;hint.hidden=false;}
  }
  function up(e){if(!gesture||gesture.id!==e.pointerId)return;stop(e);const g=gesture;cancel();
   if(g.kind==='seek'){video.currentTime=g.target;show();return;}
   if(g.kind!=='tap')return;
   const now=Date.now();if(lastTap&&now-lastTap<280){clearTimeout(tapTimer);lastTap=0;togglePlay();}else{lastTap=now;tapTimer=setTimeout(()=>{lastTap=0;if(bar.hidden)show();else bar.hidden=true;},280);}
  }
  surface.addEventListener('pointerdown',down);surface.addEventListener('pointermove',move);surface.addEventListener('pointerup',up);
  surface.addEventListener('pointercancel',cancel);surface.addEventListener('lostpointercapture',cancel);
  // Consume synthetic clicks and long-press menus before Bilibili handlers.
  for(const name of ['click','dblclick','contextmenu','touchstart','touchmove','touchend'])surface.addEventListener(name,stop,{passive:false});
  for(const name of ['click','dblclick','pointerdown','pointerup','contextmenu'])el.addEventListener(name,e=>e.stopPropagation());
  bar.addEventListener('pointerdown',()=>{clearTimeout(hideTimer);});bar.addEventListener('pointerup',autoHide);
  returnButton.onclick=()=>{nativeControls=false;nativeMode=false;parent.classList.remove('orange-native-controls');surface.hidden=false;returnButton.hidden=true;show();};
  bar.addEventListener('click',e=>{const action=e.target.closest('[data-action]')?.dataset.action;if(!action)return;
   if(action==='settings'){nativeControls=true;nativeMode=true;clearTimeout(tapTimer);lastTap=0;clearTimeout(hideTimer);scrubbing=false;cancel();bar.hidden=true;surface.hidden=true;returnButton.hidden=false;parent.classList.add('orange-native-controls');}
   if(action==='play')togglePlay();
   if(action==='full'){const full=document.fullscreenElement||document.webkitFullscreenElement;if(full){(document.exitFullscreen||document.webkitExitFullscreen)?.call(document);}else{const request=parent.requestFullscreen||parent.webkitRequestFullscreen;const result=request?.call(parent);result?.catch(()=>{hint.textContent='无法进入全屏，请重试';hint.hidden=false;});}}
   if(action==='danmaku')toggleDanmaku();
  });
  range.addEventListener('input',()=>{scrubbing=true;clearTimeout(hideTimer);if(ready())el.querySelector('.orange-touch-time').textContent=time(Number(range.value)/10000*video.duration)+' / '+time(video.duration);});
  range.addEventListener('change',()=>{if(ready())video.currentTime=Number(range.value)/10000*video.duration;scrubbing=false;render();autoHide();});
  range.addEventListener('pointercancel',()=>{scrubbing=false;render();autoHide();});
  speed.addEventListener('change',()=>{restoreRate();video.playbackRate=Number(speed.value);speed.blur();autoHide();});
  const events=['timeupdate','durationchange','loadedmetadata','ratechange','play','pause','ended'];for(const name of events)video.addEventListener(name,render);
  const pause=()=>{cancel();show();};video.addEventListener('pause',pause);video.addEventListener('play',autoHide);
  const visibility=()=>{if(document.hidden){cancel();clearTimeout(tapTimer);lastTap=0;}};document.addEventListener('visibilitychange',visibility);window.addEventListener('blur',cancel);document.addEventListener('fullscreenchange',cancel);
  render();
  return {video,parent,dispose(){disposed=true;clearInterval(dmPoll);clearTimeout(dmTimer);cancel();clearTimeout(hideTimer);clearTimeout(tapTimer);for(const name of events)video.removeEventListener(name,render);video.removeEventListener('pause',pause);video.removeEventListener('play',autoHide);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('blur',cancel);document.removeEventListener('fullscreenchange',cancel);el.remove();parent.classList.remove('orange-touch-managed','orange-native-controls');parent.style.position=oldPosition;}};
 }
 function refresh(){const videos=[...document.querySelectorAll('video')].filter(v=>v.getBoundingClientRect().width>100);const video=videos.sort((a,b)=>b.getBoundingClientRect().width-a.getBoundingClientRect().width)[0];const parent=video?.closest('.bpx-player-container,.bilibili-player,#bilibili-player')||video?.parentElement;
  if(current?.video===video&&current?.parent===parent&&video?.isConnected)return;
  current?.dispose();current=null;if(video&&parent)current=attach(video,parent);
 }
 refresh();setInterval(refresh,750);
})();

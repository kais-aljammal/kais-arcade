/* First-party sponsorship only: no ad network, pixels or remote scripts. */
(() => {
  'use strict';
  const site = document.body.dataset.adSite;
  if (!site) return;
  const page = location.pathname.replace(/\/index\.html$/, '/');
  const memoryDismissed = new Set();
  const week = 7 * 86400000;
  const slots = [...document.querySelectorAll('[data-ad-placement]')];
  const keyFor = placement => `house_ad_v1:${site}:${placement === 'sticky' ? 'site' : page}:${placement}`;
  function dismissed(placement) {
    if (memoryDismissed.has(placement)) return true;
    const until = Number(GameStorage.getItem(keyFor(placement)));
    return Number.isFinite(until) && until > Date.now() && until <= Date.now() + week;
  }
  function element(tag, className, text) {
    const el = document.createElement(tag); el.className = className;
    if (text) el.textContent = text;
    return el;
  }
  function link(placement, className, text) {
    const a = element('a', className, text);
    const url = new URL('https://interviewlary.com/');
    Object.entries({ utm_source:site, utm_medium:'house_ad', utm_campaign:'interviewlary', utm_content:`${page}:${placement}` }).forEach(([k,v]) => url.searchParams.set(k,v));
    a.href = url.href; a.target = '_blank'; a.rel = 'noopener noreferrer sponsored';
    return a;
  }
  let sticky;
  function render(container, placement) {
    if (dismissed(placement)) { container.hidden = true; return null; }
    const ad = element('aside', `house-ad${placement === 'sticky' ? ' house-ad--sticky' : ''}`);
    ad.setAttribute('aria-label', 'Advertisement — Interviewlary');
    const header = element('div','house-ad__header');
    const label = element('div','house-ad__label');
    label.append(element('span','house-ad__badge','Ad'),element('span','','Interviewlary.com'));
    const close = element('button','house-ad__close','×'); close.type = 'button'; close.setAttribute('aria-label','Close Interviewlary ad');
    close.addEventListener('click', () => {
      memoryDismissed.add(placement); GameStorage.setItem(keyFor(placement), String(Date.now()+week));
      ad.hidden = true; if (placement !== 'sticky') container.hidden = true; update();
    });
    header.append(label, link(placement,'house-ad__sticky-cta','Start Free →'), close);
    const imageLink = link(placement,'house-ad__image-link');
    imageLink.setAttribute('aria-label','Interviewlary: Practice job interviews with AI. Start free (opens in a new tab)');
    const img = element('img','house-ad__image'); img.src = '/assets/interviewlary-banner.png';
    img.alt = 'Interviewlary.com — Practice job interviews with AI. Get instant feedback in minutes.';
    img.width=1024; img.height=112; img.loading=placement === 'intro' ? 'eager':'lazy'; img.decoding='async'; imageLink.append(img);
    const copy=element('div','house-ad__mobile-copy'); copy.append(element('span','','Practice job interviews with AI.'),link(placement,'','Start Free →'));
    ad.append(header,imageLink,copy); container.append(ad); return ad;
  }
  slots.forEach(slot=>render(slot,slot.dataset.adPlacement));
  const stickyContainer = document.createElement('div'); document.body.append(stickyContainer);
  sticky = render(stickyContainer,'sticky'); if (sticky) sticky.hidden=true;
  const mobile=matchMedia('(max-width:767px)'); let ready=false;
  const basePadding=getComputedStyle(document.body).paddingBottom;
  document.body.style.setProperty('--house-ad-base-padding',basePadding);
  function visible(el) {
    const r=el.getBoundingClientRect(); return !!(r.width && r.height && r.bottom>0 && r.top<innerHeight && getComputedStyle(el).visibility!=='hidden');
  }
  function modalOpen() {
    return [...document.querySelectorAll('[aria-modal="true"],dialog[open],.modal.open,.overlay.open,.modal-overlay.open,[id$="Modal"].open')].some(visible);
  }
  function update() {
    const focused=document.activeElement;
    const input=focused && (focused.matches('input,textarea,select') || focused.isContentEditable);
    const inlineVisible=slots.some(s=>!s.hidden && s.querySelector('.house-ad:not([hidden])') && visible(s));
    if(sticky) { const hide=Boolean(!ready || !mobile.matches || dismissed('sticky') || input || inlineVisible || document.fullscreenElement || modalOpen()); if(sticky.hidden!==hide) sticky.hidden=hide; }
    const height=sticky && !sticky.hidden ? Math.ceil(sticky.getBoundingClientRect().height):0;
    const value=`${height}px`;
    if(document.documentElement.style.getPropertyValue('--house-ad-space')!==value) document.documentElement.style.setProperty('--house-ad-space',value);
  }
  const grid=document.querySelector('#gameGrid');
  const library=slots.find(s=>s.dataset.adPlacement==='library');
  function positionLibrary(){
    if(!grid || !library) return;
    const cards=[...grid.querySelectorAll('.card')].filter(c=>!c.classList.contains('hidden'));
    library.hidden=cards.length<4 || dismissed('library');
    if(cards.length>=4 && cards[3].nextElementSibling!==library) cards[3].after(library);
    update();
  }
  if(grid) new MutationObserver(positionLibrary).observe(grid,{subtree:true,attributes:true,attributeFilter:['class']});
  positionLibrary();
  let queued=false;
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;update();});}
  new IntersectionObserver(schedule,{threshold:[0,0.01]}).observe(document.body);
  const inlineObserver=new IntersectionObserver(schedule,{threshold:[0,0.01]}); slots.forEach(s=>inlineObserver.observe(s));
  new MutationObserver(schedule).observe(document.body,{subtree:true,attributes:true,attributeFilter:['class','hidden','open','aria-hidden'],childList:true});
  if(sticky) new ResizeObserver(schedule).observe(sticky);
  ['scroll','resize','focusin','focusout','fullscreenchange'].forEach(event=>window.addEventListener(event,schedule,{passive:true}));
  if(window.visualViewport) window.visualViewport.addEventListener('resize',schedule);
  mobile.addEventListener('change',schedule);
  window.addEventListener('storage',schedule);
  setTimeout(()=>{ready=true;update();},8000); update();
})();


const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {JSDOM,VirtualConsole}=require('jsdom');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
function pages(dir=root){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.name.startsWith('.')||['node_modules','dist','tests','scripts'].includes(e.name)?[]:e.isDirectory()?pages(path.join(dir,e.name)):e.name.endsWith('.html')?[path.join(dir,e.name)]:[]);}
function storage(initial={},blocked=false){const values=new Map(Object.entries(initial));const context={window:{},localStorage:{getItem(k){if(blocked)throw Error('blocked');return values.get(k)??null;},setItem(k,v){if(blocked)throw Error('blocked');values.set(k,v);}}};vm.runInNewContext(read('assets/game-storage.js'),context);return{api:context.window.GameStorage,values};}
test('valid saved progress survives and malformed fields recover independently',()=>{
 const initial={xp:225,coins:91,level:3,plays:7,streak:2,lastDaily:'2026-10-20',lastVisit:'2026-10-20',achievements:['first_game']};
 const {api}=storage({ka_state:JSON.stringify(initial),greed_dice_state:JSON.stringify({stack:0,debt:40,stats:{rounds:5,wins:2,streak:1,startingStack:100000}})});
 assert.deepEqual(JSON.parse(api.getItem('ka_state')),initial);
 assert.equal(JSON.parse(api.getItem('greed_dice_state')).stack,0);
 const bad=storage({ka_state:JSON.stringify({xp:73,coins:'<img onerror=alert(1)>',achievements:{},streak:-1}),dc_stats:'{broken'}).api;
 const normalized=JSON.parse(bad.getItem('ka_state'));assert.equal(normalized.xp,73);assert.equal(normalized.coins,0);assert.deepEqual(normalized.achievements,[]);
 assert.deepEqual(JSON.parse(bad.getItem('dc_stats')).history,[]);
 for(const value of ['null','[]','"string"','{bad'])for(const key of ['ka_state','dc_stats','greed_dice_state','the_button_state','oracle_stats'])assert.doesNotThrow(()=>JSON.parse(storage({[key]:value}).api.getItem(key)));
});
test('blocked storage does not prevent saving, ads or loading games',()=>{const {api}=storage({},true);assert.doesNotThrow(()=>api.setItem('ka_state','{}'));assert.equal(JSON.parse(api.getItem('ka_state')).xp,0);assert.equal(api.getItem('ka_sound'),null);});
function environment(file,{saved={},blocked=false,phone=true}={}){
 const errors=[];const timers=[];const dom=new JSDOM(fs.readFileSync(file,'utf8'),{url:'https://example.test/'+path.relative(root,file).replaceAll('\\','/'),runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:new VirtualConsole().on('jsdomError',e=>errors.push(e.message))});
 const w=dom.window;w.setInterval=()=>0;w.setTimeout=(f,ms)=>{timers.push({f,ms});return 1;};w.requestAnimationFrame=()=>0;
 w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:()=>()=>{}});
 const audioNode=()=>({connect(){return this;},start(){},stop(){},frequency:{value:0},gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}}});
 w.AudioContext=class{constructor(){this.state='running';this.currentTime=0;this.destination={};}resume(){}createOscillator(){return audioNode();}createGain(){return audioNode();}};
 w.matchMedia=()=>({matches:phone,addEventListener(){},removeEventListener(){}});
 w.IntersectionObserver=class{observe(){} disconnect(){}};w.ResizeObserver=class{observe(){} disconnect(){}};
 if(blocked)Object.defineProperty(w,'localStorage',{get(){throw Error('blocked');}});
 else for(const[k,v]of Object.entries(saved))w.localStorage.setItem(k,v);
 w.eval(read('assets/game-storage.js'));
 const game=path.join(path.dirname(file),'game.js');if(fs.existsSync(game))w.eval(fs.readFileSync(game,'utf8'));
 return{dom,w,errors,timers};
}
for(const file of pages())test('boots with blocked and malformed storage: '+path.relative(root,file),()=>{
 for(const blocked of [false,true]){
 const env=environment(file,{blocked,saved:{ka_state:'{"xp":"bad","achievements":null}',dc_stats:'bad',greed_dice_state:'{"stack":"bad","stats":[]}',the_button_state:'{"maxCombo":"bad"}',oracle_stats:'{"queries":{}}'}});
 try{env.w.eval(read('assets/house-ads.js'));assert.deepEqual(env.errors,[]);}finally{env.dom.window.close();}
 }
});
test('every page has safe script sources, ad slots and intact image',()=>{
 const csp=JSON.parse(read('vercel.json')).headers[0].headers.find(h=>h.key==='Content-Security-Policy').value;
 assert.match(csp,/script-src 'self';/);assert.match(csp,/script-src-attr 'none'/);assert.match(csp,/frame-ancestors 'none'/);assert.match(csp,/connect-src 'none'/);
 assert.doesNotMatch(csp,/unsafe-eval/);
 for(const file of pages()){
 const html=fs.readFileSync(file,'utf8');const dom=new JSDOM(html);const d=dom.window.document;
 for(const script of d.scripts){assert.ok(script.src);assert.equal(script.textContent.trim(),'');assert.ok(!script.src.startsWith('https:'));const src=script.getAttribute('src');assert.ok(fs.existsSync(src.startsWith('/')?path.join(root,src):path.join(path.dirname(file),src)));}
 assert.equal(d.querySelectorAll('[data-ad-placement]').length,file===path.join(root,'index.html')?2:1);
 assert.doesNotMatch(html,/\son\w+\s*=\s*["']/i);dom.window.close();
 }
 const png=fs.readFileSync(path.join(root,'assets/interviewlary-banner.png'));assert.equal(png.readUInt32BE(16),1024);assert.equal(png.readUInt32BE(20),112);
});
test('ad links, sticky delay, focus suppression and storage-failure dismissal',()=>{
 const {dom,w,timers}=environment(path.join(root,'index.html'),{blocked:true});
 try{
 w.requestAnimationFrame=f=>{f(0);return 0;};w.eval(read('assets/house-ads.js'));
 for(const a of w.document.querySelectorAll('.house-ad a')){assert.equal(a.origin,'https://interviewlary.com');for(const rel of ['noopener','noreferrer','sponsored'])assert.ok(a.rel.split(' ').includes(rel));assert.equal(a.target,'_blank');assert.ok(a.search.includes('utm_content='));}
 const sticky=w.document.querySelector('.house-ad--sticky');assert.ok(sticky.hidden);
 timers.find(t=>t.ms===8000).f();assert.equal(sticky.hidden,false);
 const input=w.document.createElement('input');w.document.body.append(input);input.focus();assert.ok(sticky.hidden);input.blur();assert.equal(sticky.hidden,false);
 sticky.querySelector('button').click();assert.ok(sticky.hidden);assert.equal(w.document.documentElement.style.getPropertyValue('--house-ad-space'),'0px');
 }finally{dom.window.close();}
});
test('seven-day sticky dismissal persists across site routes',()=>{
 const site=path.basename(root)==='memes'?'memes':'kais-arcade';
 const key=`house_ad_v1:${site}:site:sticky`;
 const {dom,w}=environment(path.join(root,'index.html'),{saved:{[key]:String(Date.now()+86400000)}});
 try{w.eval(read('assets/house-ads.js'));assert.equal(w.document.querySelector('.house-ad--sticky'),null);}finally{dom.window.close();}
});
if(fs.existsSync(path.join(root,'decision-casino/game.js')))test('saved decision history renders injection as literal text',()=>{
 const payload='<img src=x onerror=alert(1)>';
 const {dom,w}=environment(path.join(root,'decision-casino/index.html'),{saved:{dc_stats:JSON.stringify({total:1,history:[{a:payload,b:'safe',result:payload,time:1}]})}});
 try{const panel=w.document.getElementById('histPanel');assert.equal(panel.querySelector('img'),null);assert.ok(panel.textContent.includes(payload));}finally{dom.window.close();}
});
if(fs.existsSync(path.join(root,'index.html')) && read('index.html').includes('id="gameGrid"'))test('Arcade library ad follows fourth visible card and hides below four',()=>{
 const{dom,w}=environment(path.join(root,'index.html'));
 try{w.eval(read('assets/house-ads.js'));const grid=w.document.getElementById('gameGrid');const slot=grid.querySelector('[data-ad-placement="library"]');assert.equal([...grid.children].indexOf(slot),4);const cards=[...grid.querySelectorAll('.card')];cards.slice(2).forEach(c=>c.classList.add('hidden'));return new Promise(resolve=>w.queueMicrotask(()=>{assert.equal(slot.hidden,true);dom.window.close();resolve();}));}catch(e){dom.window.close();throw e;}
});

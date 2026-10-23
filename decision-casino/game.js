(() => {
    // ─── AUDIO ENGINE ───
    const AC = window.AudioContext || window.webkitAudioContext;
    let actx = null, soundOn = false;
    function ea(){ if(!actx) actx = new AC(); if(actx.state==='suspended') actx.resume(); }
    function tone(f,t,d,v=.12){ if(!soundOn||!actx)return; const o=actx.createOscillator(),g=actx.createGain(); o.type=t;o.frequency.value=f; g.gain.setValueAtTime(v,actx.currentTime);g.gain.exponentialRampToValueAtTime(.001,actx.currentTime+d); o.connect(g).connect(actx.destination);o.start();o.stop(actx.currentTime+d); }
    const sfx = {
      tick(){ tone(1800,'sine',.03,.08); },
      beep(){ tone(880,'square',.08,.1); },
      countdown(n){ tone(440+n*200,'sine',.15,.1); },
      spin(){ [600,700,800,900].forEach((f,i)=>setTimeout(()=>tone(f,'triangle',.06,.06),i*50)); },
      win(){ [523,659,784,1047].forEach((f,i)=>setTimeout(()=>tone(f,'sine',.2,.12),i*90)); },
      neither(){ tone(180,'sawtooth',.3,.1); setTimeout(()=>tone(140,'sawtooth',.4,.08),150); },
      click(){ tone(800,'sine',.04,.08); },
    };

    soundOn = GameStorage.getItem('dc_sound') !== 'off';
    const soundBtn = document.getElementById('soundBtn');
    function updSound(){ soundBtn.textContent = soundOn ? '🔊':'🔇'; }
    updSound();
    soundBtn.addEventListener('click',()=>{ ea(); soundOn=!soundOn; GameStorage.setItem('dc_sound',soundOn?'on':'off'); updSound(); if(soundOn) sfx.click(); });

    // ─── DOM ───
    const $=id=>document.getElementById(id);
    const screens = [$('entryScreen'),$('gameScreen'),$('resultScreen')];
    const reduceMotion = matchMedia('(prefers-reduced-motion:reduce)').matches;
    const sleep = ms => new Promise(r=>setTimeout(r,ms));

    let busy=false, currentOpts=[], gameMode='2', bo3state=null;

    // ─── ARCADE META INTEGRATION ───
    function getArcadeState() { try { return JSON.parse(GameStorage.getItem('ka_state')) || {}; } catch { return {}; } }
    function saveArcadeState(s) { GameStorage.setItem('ka_state', JSON.stringify(s)); }
    function awardArcadeXP(xp, coins = 0) {
      const s = { xp: 0, coins: 0, plays: 0, achievements: [], ...getArcadeState() };
      s.xp += xp; s.coins += coins; s.plays += 1;
      saveArcadeState(s); updateArcadeBadge();
    }
    function unlockArcadeAchievement(id, title) {
      const s = { xp: 0, coins: 0, achievements: [], ...getArcadeState() };
      if (!s.achievements.includes(id)) {
        s.achievements.push(id); s.coins += 50; s.xp += 30;
        saveArcadeState(s); updateArcadeBadge();
      }
    }
    function updateArcadeBadge() {
      const s = getArcadeState();
      const el = document.getElementById('dcArcadeBadge');
      if (el) el.textContent = '🪙 ' + (s.coins || 0).toLocaleString();
    }
    updateArcadeBadge();

    // ─── PERSISTENCE ───
    let stats = { total:0, wins:{A:0,B:0,C:0,X:0}, history:[], ...JSON.parse(GameStorage.getItem('dc_stats')||'{}') };
    function saveStats(){ GameStorage.setItem('dc_stats',JSON.stringify(stats)); }

    function renderStats(){
      $('statTotal').textContent = stats.total;
      $('statA').textContent = stats.wins.A||0;
      $('statB').textContent = stats.wins.B||0;
      $('statNeither').textContent = stats.wins.X||0;
    }

    function renderHistory() {
      const panel = $('histPanel'); panel.replaceChildren();
      if (!stats.history.length) {
        const empty = document.createElement('div'); empty.className='history-empty';
        empty.textContent='No decisions yet. Your future awaits.'; panel.append(empty); return;
      }
      stats.history.slice(-20).reverse().forEach(h => {
        const row=document.createElement('div'); row.className='history-item';
        [['choice',h.a],['vs','vs'],['choice',h.b],['winner','→ '+h.result]].forEach(([cls,text]) => {
          const span=document.createElement('span'); span.className=cls; span.textContent=text; row.append(span);
        });
        panel.append(row);
      });
    }

    $('histToggle').addEventListener('click',()=>{
      sfx.click();
      $('histPanel').classList.toggle('hidden');
    });

    // ─── MODE SELECTION ───
    document.querySelectorAll('.mode-pill').forEach(btn=>{
      btn.addEventListener('click',()=>{
        sfx.click();
        document.querySelectorAll('.mode-pill').forEach(x=>x.classList.remove('active'));
        btn.classList.add('active');
        gameMode = btn.dataset.mode;
        $('optionCWrap').classList.toggle('hidden', gameMode !== '3');
      });
    });

    // ─── HELPERS ───
    function secureRandom(){ if(window.crypto?.getRandomValues){ const a=new Uint32Array(1); crypto.getRandomValues(a); return a[0]/4294967296; } return Math.random(); }
    function fakeOdds(){ return (1.12+secureRandom()*3.75).toFixed(2)+'x'; }
    function normalize(s){ return s.trim().replace(/\s+/g,' ').toLowerCase(); }

    function showOnly(screen){ screens.forEach(s=>s.classList.add('hidden')); screen.classList.remove('hidden'); window.scrollTo({top:0,behavior:'smooth'}); }

    function chooseOutcome(numOpts){
      const r = secureRandom();
      if(numOpts === 3){
        if(r < .32) return 'A';
        if(r < .64) return 'B';
        if(r < .92) return 'C';
        return 'X';
      }
      if(r < .48) return 'A';
      if(r < .96) return 'B';
      return 'X';
    }

    const dealerQuips = [
      "Professional advice was not involved.",
      "Financial markets remain unaffected.",
      "Your therapist has been notified.",
      "This decision is legally binding (it's not).",
      "The universe remains indifferent.",
      "This result has zero scientific backing.",
      "Certified irresponsible since 2024.",
      "Results may vary. Actually, they won't.",
      "No refunds on poor life choices.",
    ];

    const neitherQuips = [
      "The casino has rejected the premise of your question.",
      "Both options were terrible. You're welcome.",
      "The universe suggests touching grass instead.",
      "Neither. Go take a nap.",
      "The wheel has spoken. It said no.",
      "Plot twist: do something completely different.",
    ];

    // ─── GAME FLOW ───
    async function animateOdds(ids){
      for(let i=0;i<8;i++){
        ids.forEach(id=>{ $(id).textContent = fakeOdds(); });
        if(i%2===0) sfx.tick();
        await sleep(reduceMotion?20:110);
      }
    }

    async function statusSequence(){
      const msgs=["Opening decision table...","Calculating completely fictional odds...","Evaluating life consequences...","Consulting absolutely nobody...","Choices locked."];
      for(const m of msgs){ $('statusText').textContent=m; await sleep(reduceMotion?100:430); }
    }

    async function runCountdown(){
      for(const n of ['3','2','1']){
        $('countdown').textContent=n;
        $('countdown').classList.remove('show');
        void $('countdown').offsetWidth;
        $('countdown').classList.add('show');
        sfx.countdown(parseInt(n));
        await sleep(reduceMotion?80:650);
      }
    }

    function targetRotation(outcome, numOpts){
      let angle;
      if(numOpts === 3){
        if(outcome==='A') angle=60; else if(outcome==='B') angle=180; else if(outcome==='C') angle=300; else angle=350;
      } else {
        if(outcome==='A') angle=86.4; else if(outcome==='X') angle=180; else angle=273.6;
      }
      const spins = reduceMotion?1:7+Math.floor(secureRandom()*3);
      return spins*360 - angle;
    }

    async function spinWheel(outcome, numOpts){
      const w=$('wheel');
      const rot = targetRotation(outcome, numOpts);
      w.style.transition='none'; w.style.transform='rotate(0deg)'; void w.offsetWidth;
      sfx.spin();
      w.style.transition = reduceMotion?'transform .25s ease-out':'transform 3.9s cubic-bezier(.12,.72,.08,1)';
      w.style.transform = `rotate(${rot}deg)`;

      // Tick sounds during spin
      if(!reduceMotion && soundOn){
        for(let i=0;i<15;i++){ setTimeout(()=>sfx.tick(), 200+i*200); }
      }

      await sleep(reduceMotion?280:4050);
    }

    function updateWheelGradient(numOpts){
      const w=$('wheel');
      if(numOpts===3){
        w.style.background='conic-gradient(from -90deg, #6f2d2b 0deg 115deg, #c7a45f 115deg 125deg, #1a3f2a 125deg 245deg, #c7a45f 245deg 255deg, #121614 255deg 360deg)';
      } else {
        w.style.background='conic-gradient(from -90deg, #6f2d2b 0deg 172.8deg, #c7a45f 172.8deg 187.2deg, #121614 187.2deg 360deg)';
      }
    }

    async function runGame(){
      if(busy) return; busy=true;
      $('placeBtn').disabled=true;

      const numOpts = currentOpts.length;
      $('marketA').textContent=currentOpts[0]; $('wheelA').textContent=currentOpts[0];
      $('marketB').textContent=currentOpts[1]; $('wheelB').textContent=currentOpts[1];
      if(numOpts===3){ $('marketC').textContent=currentOpts[2]; $('marketCCard').classList.remove('hidden'); }
      else { $('marketCCard').classList.add('hidden'); }

      updateWheelGradient(numOpts);

      // Best of 3 info
      if(bo3state){
        $('roundInfo').textContent = `ROUND ${bo3state.round}/3 — A: ${bo3state.winsA} | B: ${bo3state.winsB}`;
      } else { $('roundInfo').textContent=''; }

      showOnly($('gameScreen'));
      $('oddsA').textContent='1.00x'; $('oddsB').textContent='1.00x';
      if(numOpts===3) $('oddsC').textContent='1.00x';
      $('dealerLine').textContent = dealerQuips[Math.floor(secureRandom()*dealerQuips.length)];
      $('statusText').textContent='Opening decision table...';

      const outcome = chooseOutcome(numOpts);
      const oddsIds = numOpts===3 ? ['oddsA','oddsB','oddsC'] : ['oddsA','oddsB'];
      await Promise.all([animateOdds(oddsIds), statusSequence()]);
      await runCountdown();

      $('statusText').textContent='Decision wheel in motion...';
      await spinWheel(outcome, numOpts);
      $('statusText').textContent='Result confirmed.';
      await sleep(reduceMotion?80:450);

      const labels = {A:currentOpts[0], B:currentOpts[1], C:currentOpts[2]};
      let winnerText, copyText;

      if(outcome === 'X'){
        winnerText = 'DO NEITHER.';
        copyText = neitherQuips[Math.floor(secureRandom()*neitherQuips.length)];
        sfx.neither();
        stats.wins.X = (stats.wins.X||0)+1;
      } else {
        winnerText = labels[outcome].toUpperCase();
        copyText = outcome==='A' ? 'Your future has been irresponsibly determined.' :
                   outcome==='B' ? 'Decision quality not guaranteed.' :
                   'The third option wins. Nobody saw that coming.';
        sfx.win();
        stats.wins[outcome] = (stats.wins[outcome]||0)+1;
      }

      // Best of 3 logic
      if(bo3state){
        if(outcome==='A') bo3state.winsA++;
        else if(outcome==='B') bo3state.winsB++;

        if(outcome === 'X'){
          // Neither in BO3 is a push, re-spin the round without burning points
          $('resultKicker').textContent = `ROUND ${bo3state.round} PUSH (NEITHER) — RE-ROLL!`;
          copyText = "The wheel landed on Neither. Re-spin to determine who claims the point for round " + bo3state.round + "!";
        } else {
          bo3state.round++;
          if(bo3state.winsA>=2 || bo3state.winsB>=2 || bo3state.round>3){
            const champ = bo3state.winsA>=2 ? currentOpts[0] : bo3state.winsB>=2 ? currentOpts[1] : (bo3state.winsA > bo3state.winsB ? currentOpts[0] : currentOpts[1]);
            winnerText = champ.toUpperCase();
            $('resultKicker').textContent = `BEST OF 3 CHAMPION (${bo3state.winsA}-${bo3state.winsB})`;
            copyText = `After grueling rounds of calculation, ${champ} is officially crowned!`;
            bo3state = null;
          } else {
            $('resultKicker').textContent = `ROUND ${bo3state.round-1} OF 3 — Score: A (${bo3state.winsA}) - B (${bo3state.winsB})`;
          }
        }
      } else {
        $('resultKicker').textContent = 'Final decision';
      }

      $('resultTitle').textContent = winnerText;
      $('resultCopy').textContent = copyText;

      // Shake on "neither"
      if(outcome==='X'){
        $('resultCard').style.animation='none';
        void $('resultCard').offsetWidth;
        $('resultCard').style.animation='shake .4s ease';
      }

      stats.total++;
      stats.history.push({a:currentOpts[0],b:currentOpts[1],c:currentOpts[2]||'',result:winnerText,time:Date.now()});
      if(stats.history.length>50) stats.history=stats.history.slice(-50);
      saveStats(); renderStats(); renderHistory();

      // Award Arcade Progression
      awardArcadeXP(25, 10);
      unlockArcadeAchievement('dc_first_decision', '🎲 Fateful Spin — Made a choice in Decision Casino!');
      if(stats.total >= 5) unlockArcadeAchievement('dc_frequent_spinner', '🎡 High Roller Decision Maker — Spun the wheel 5 times!');

      showOnly($('resultScreen'));
      busy=false; $('placeBtn').disabled=false;
    }

    // ─── VALIDATION ───
    function validateAndStart(){
      if(busy) return; ea();
      const a=$('optionA').value.trim(), b=$('optionB').value.trim();
      const c = gameMode==='3' ? $('optionC').value.trim() : '';

      if(!a||!b||(gameMode==='3'&&!c)){ $('error').textContent='The table requires all choices filled.'; sfx.click(); return; }
      if(normalize(a)===normalize(b)||(c&&(normalize(c)===normalize(a)||normalize(c)===normalize(b)))){
        $('error').textContent="bro that's the same option."; return;
      }

      $('error').textContent='';
      currentOpts = gameMode==='3' ? [a,b,c] : [a,b];

      if(gameMode==='best3'){
        bo3state = {round:1, winsA:0, winsB:0};
      } else { bo3state=null; }

      sfx.click();
      runGame();
    }

    $('placeBtn').addEventListener('click',validateAndStart);
    [$('optionA'),$('optionB'),$('optionC')].forEach(inp=>{
      inp.addEventListener('keydown',e=>{ if(e.key==='Enter') validateAndStart(); });
      inp.addEventListener('input',()=>{ if($('error').textContent) $('error').textContent=''; });
    });

    $('againBtn').addEventListener('click',()=>{
      ea();
      if(!busy){
        if(gameMode === 'best3' && !bo3state){
          bo3state = { round: 1, winsA: 0, winsB: 0 };
        }
        runGame();
      }
    });
    $('changeBtn').addEventListener('click',()=>{
      if(busy) return;
      $('wheel').style.transition='none'; $('wheel').style.transform='rotate(0deg)';
      bo3state=null;
      showOnly($('entryScreen'));
      setTimeout(()=>$('optionA').focus(),50);
    });

    // Share
    $('shareBtn').addEventListener('click',()=>{
      const text = `🎲 Decision Casino Result:\n${$('resultTitle').textContent}\n${$('resultCopy').textContent}`;
      navigator.clipboard.writeText(text).then(()=>{
        $('shareMsg').textContent='Copied! Share your questionable decision.';
        setTimeout(()=>$('shareMsg').textContent='',2500);
      }).catch(()=>$('shareMsg').textContent='Copy failed');
    });

    // Shake keyframe
    const style=document.createElement('style');
    style.textContent='@keyframes shake{0%,100%{transform:translateX(0)}15%{transform:translateX(-8px) rotate(-1deg)}30%{transform:translateX(6px) rotate(1deg)}45%{transform:translateX(-4px)}60%{transform:translateX(3px)}75%{transform:translateX(-1px)}}';
    document.head.appendChild(style);

    renderStats(); renderHistory();
  })();

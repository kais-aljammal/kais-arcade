(() => {
    // ─── WEB AUDIO SFX ENGINE ───
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    let actx = null, soundOn = false;

    function ensureAudio() {
      if (!actx) actx = new AudioCtx();
      if (actx.state === 'suspended') actx.resume();
    }

    function playTone(freq, type, dur, vol = 0.15) {
      if (!soundOn || !actx) return;
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, actx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + dur);
      osc.connect(gain).connect(actx.destination);
      osc.start(); osc.stop(actx.currentTime + dur);
    }

    const SFX = {
      click() { playTone(800, 'sine', 0.06, 0.1); },
      coin() { playTone(1200, 'sine', 0.08, 0.12); setTimeout(() => playTone(1600, 'sine', 0.1, 0.1), 60); },
      levelUp() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playTone(f, 'sine', 0.18, 0.12), i * 80)); },
      achievement() { playTone(880, 'square', 0.06, 0.08); setTimeout(() => playTone(1100, 'square', 0.06, 0.08), 70); setTimeout(() => playTone(1320, 'sine', 0.2, 0.1), 140); },
      daily() { [440, 554, 659, 880].forEach((f, i) => setTimeout(() => playTone(f, 'triangle', 0.15, 0.1), i * 100)); },
    };

    // ─── SOUND TOGGLE ───
    const soundToggle = document.getElementById('soundToggle');
    soundOn = GameStorage.getItem('ka_sound') !== 'off';
    function updateSoundUI() { soundToggle.textContent = soundOn ? '🔊' : '🔇'; soundToggle.classList.toggle('on', soundOn); }
    updateSoundUI();
    soundToggle.addEventListener('click', () => { ensureAudio(); soundOn = !soundOn; GameStorage.setItem('ka_sound', soundOn ? 'on' : 'off'); updateSoundUI(); if (soundOn) SFX.click(); });

    // ─── PROGRESSION ───
    const LEVELS = [
      { name: 'Casual Guest', xp: 0 }, { name: 'Button Masher', xp: 100 }, { name: 'Dice Roller', xp: 300 },
      { name: 'Risk Taker', xp: 600 }, { name: 'Drama Queen', xp: 1000 }, { name: 'Arcade Regular', xp: 1600 },
      { name: 'High Roller', xp: 2500 }, { name: 'Degen Lord', xp: 4000 }, { name: 'Keyboard Destroyer', xp: 6000 },
      { name: 'Arcade Overlord', xp: 10000 },
    ];

    function loadState() { try { return JSON.parse(GameStorage.getItem('ka_state')) || {}; } catch { return {}; } }
    function saveState(s) { GameStorage.setItem('ka_state', JSON.stringify(s)); }

    let state = { xp: 0, coins: 0, level: 1, plays: 0, streak: 0, lastDaily: null, lastVisit: null, achievements: [], ...loadState() };

    function getLevelInfo(xp) {
      let lvl = 1;
      for (let i = LEVELS.length - 1; i >= 0; i--) { if (xp >= LEVELS[i].xp) { lvl = i + 1; break; } }
      const cur = LEVELS[lvl - 1], nxt = LEVELS[lvl] || { xp: cur.xp + 5000 };
      return { lvl, name: cur.name, progress: Math.min(1, Math.max(0, (xp - cur.xp) / (nxt.xp - cur.xp))), nextXp: nxt.xp };
    }

    function render() {
      const info = getLevelInfo(state.xp); state.level = info.lvl;
      document.getElementById('levelLabel').textContent = 'LEVEL ' + info.lvl + ' \u00b7 ' + info.name.toUpperCase();
      document.getElementById('xpFill').style.width = (info.progress * 100).toFixed(1) + '%';
      document.getElementById('xpText').textContent = state.xp + ' / ' + info.nextXp + ' XP';
      document.getElementById('coinCount').textContent = state.coins.toLocaleString();
      document.getElementById('streakDays').textContent = state.streak;
      document.getElementById('totalPlays').textContent = state.plays;
      document.getElementById('totalXp').textContent = state.xp;
      document.getElementById('totalCoins').textContent = state.coins;
      const icons = ['K','K','\u{1F3B2}','\u{1F3AF}','\u{1F451}','\u{1F525}','\u{1F48E}','\u{1F3C6}','\u26A1','\u{1F31F}'];
      document.getElementById('avatar').textContent = icons[Math.min(info.lvl - 1, icons.length - 1)];
      saveState(state);
    }

    function addXP(amount) {
      const oldLvl = getLevelInfo(state.xp).lvl;
      state.xp += amount;
      const newLvl = getLevelInfo(state.xp).lvl;
      if (newLvl > oldLvl) { SFX.levelUp(); showToast('\u{1F389}', 'Level ' + newLvl + '! ' + LEVELS[newLvl - 1].name); }
      render();
    }

    function addCoins(n) { state.coins += n; SFX.coin(); render(); }

    // ─── DAILY & STREAKS ───
    const dailyBtn = document.getElementById('dailyBtn');
    function todayStr() { return new Date().toISOString().slice(0, 10); }
    function checkStreak() {
      const today = todayStr();
      if (state.lastVisit) { const diff = Math.floor((new Date(today) - new Date(state.lastVisit)) / 86400000); if (diff > 1) state.streak = 0; }
      state.lastVisit = today; saveState(state);
    }
    function canClaim() { return state.lastDaily !== todayStr(); }
    function updateDaily() { dailyBtn.disabled = !canClaim(); dailyBtn.textContent = canClaim() ? 'Claim Daily +50 \u{1FA99}' : '\u2713 Claimed today'; }

    dailyBtn.addEventListener('click', () => {
      ensureAudio(); if (!canClaim()) return;
      state.lastDaily = todayStr(); state.streak += 1;
      const bonus = Math.min(state.streak * 10, 100), total = 50 + bonus;
      addCoins(total); addXP(20); SFX.daily();
      showToast('\u{1F381}', '+' + total + ' coins! Streak: ' + state.streak + ' days');
      if (state.streak >= 7 && !state.achievements.includes('streak_7')) unlock('streak_7', '\u{1F525} Week Warrior \u2014 7-day streak!');
      updateDaily(); render();
    });

    // ─── ACHIEVEMENTS ───
    function unlock(id, text) {
      if (state.achievements.includes(id)) return;
      state.achievements.push(id); SFX.achievement(); showToast('\u{1F3C6}', text); addCoins(25); saveState(state);
    }

    // ─── TOASTS ───
    function showToast(icon, text) {
      const c = document.getElementById('toasts'), el = document.createElement('div');
      el.className = 'toast'; const iconEl=document.createElement('span'); iconEl.className='toast-icon'; iconEl.textContent=icon; const message=document.createElement('span'); message.textContent=text; el.append(iconEl,message);
      c.appendChild(el); setTimeout(() => el.classList.add('out'), 3000); setTimeout(() => el.remove(), 3400);
    }

    // ─── PARTICLES ───
    const canvas = document.getElementById('particles'), ctx = canvas.getContext('2d');
    let particles = [];
    function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    resizeCanvas(); window.addEventListener('resize', resizeCanvas);

    function burst(x, y, count) {
      const colors = ['#b9ff66','#ffcf66','#65a8ff','#b38aff','#ff5c66','#fff'];
      for (let i = 0; i < (count||20); i++) {
        const a = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5, s = 2 + Math.random() * 4;
        particles.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s - 2, life: 1, decay: 0.015 + Math.random()*0.015, size: 3 + Math.random()*4, color: colors[Math.floor(Math.random()*colors.length)] });
      }
    }

    function animP() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life -= p.decay;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        ctx.globalAlpha = p.life; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1; requestAnimationFrame(animP);
    }
    animP();

    // ─── GAME CARD TRACKING ───
    document.querySelectorAll('[data-game]').forEach(link => {
      link.addEventListener('click', (e) => {
        ensureAudio(); SFX.click(); state.plays += 1; addXP(10);
        if (state.plays === 1) unlock('first_game', '\u{1F3AE} First Launch \u2014 played your first game!');
        if (state.plays >= 10) unlock('ten_plays', '\u{1F51F} Dedicated \u2014 launched 10 games!');
        if (state.plays >= 50) unlock('fifty_plays', '\u{1F3C5} Addicted \u2014 50 game launches!');
        const rect = e.currentTarget.getBoundingClientRect();
        burst(rect.left + rect.width / 2, rect.top + rect.height / 2, 15);
        render();
      });
    });

    // ─── FILTERS ───
    const filterBtns = [...document.querySelectorAll('.filter')];
    const cards = [...document.querySelectorAll('.card')];
    const feat = document.querySelector('.featured');

    filterBtns.forEach(btn => btn.addEventListener('click', () => {
      ensureAudio(); SFX.click();
      filterBtns.forEach(x => x.classList.remove('active')); btn.classList.add('active');
      const f = btn.dataset.filter;
      cards.forEach(c => { const cats = (c.dataset.category||'').split(' '); c.classList.toggle('hidden', f !== 'all' && !cats.includes(f)); });
      if (feat) { const cats = (feat.dataset.category||'').split(' '); feat.style.display = (f === 'all' || cats.includes(f)) ? '' : 'none'; }
    }));

    // ─── RANDOM ───
    document.getElementById('randomGame').addEventListener('click', () => {
      ensureAudio(); SFX.click();
      const vis = cards.filter(c => !c.classList.contains('hidden'));
      if (!vis.length) return;
      const pick = vis[Math.floor(Math.random() * vis.length)];
      const link = pick.querySelector('a[data-game]');
      if (link) { pick.style.transform = 'scale(1.03)'; setTimeout(() => { pick.style.transform = ''; link.click(); }, 200); }
    });

    // ─── AGE TICKER ───
    let secs = 674956800;
    setInterval(() => { secs++; const el = document.getElementById('ageTicker'); if (el) el.textContent = secs.toLocaleString('en-US'); }, 1000);

    // ─── INIT ───
    checkStreak(); updateDaily(); render();
    if (!loadState().xp) setTimeout(() => showToast('\u{1F579}\uFE0F', 'Welcome to Kais Arcade!'), 600);
  })();

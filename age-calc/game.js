(() => {
    // ─── AUDIO ENGINE ───
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    let actx = null, soundOn = GameStorage.getItem('ka_sound') !== 'off';

    function ensureAudio() {
      if (!actx) actx = new AudioCtx();
      if (actx.state === 'suspended') actx.resume();
    }

    function playTone(freq, type, dur, vol = 0.1) {
      if (!soundOn || !actx) return;
      try {
        const osc = actx.createOscillator();
        const gain = actx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, actx.currentTime);
        gain.gain.setValueAtTime(vol, actx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
        osc.connect(gain).connect(actx.destination);
        osc.start();
        osc.stop(actx.currentTime + dur);
      } catch(e){}
    }

    const soundBtn = document.getElementById('soundBtn');
    soundBtn.textContent = soundOn ? '🔊' : '🔇';
    soundBtn.addEventListener('click', () => {
      ensureAudio();
      soundOn = !soundOn;
      GameStorage.setItem('ka_sound', soundOn ? 'on' : 'off');
      soundBtn.textContent = soundOn ? '🔊' : '🔇';
      if (soundOn) playTone(900, 'sine', 0.05, 0.08);
    });

    // ─── ARCADE META INTEGRATION ───
    function getArcadeState() {
      try { return JSON.parse(GameStorage.getItem('ka_state')) || {}; } catch { return {}; }
    }
    function saveArcadeState(s) {
      GameStorage.setItem('ka_state', JSON.stringify(s));
    }
    function awardArcadeXP(xp, coins = 0) {
      const s = { xp: 0, coins: 0, plays: 0, achievements: [], ...getArcadeState() };
      s.xp += xp;
      s.coins += coins;
      s.plays += 1;
      saveArcadeState(s);
      updateArcadeBadge();
    }
    function unlockArcadeAchievement(id, title) {
      const s = { xp: 0, coins: 0, achievements: [], ...getArcadeState() };
      if (!s.achievements.includes(id)) {
        s.achievements.push(id);
        s.coins += 50;
        s.xp += 30;
        saveArcadeState(s);
        updateArcadeBadge();
      }
    }
    function updateArcadeBadge() {
      const s = getArcadeState();
      document.getElementById('arcadeCoinsBadge').textContent = '🪙 ' + (s.coins || 0).toLocaleString();
    }
    updateArcadeBadge();

    // ─── DATE CALCULATIONS ───
    const inputDate = document.getElementById('birthDateInput');
    let birthTime = new Date(inputDate.value).getTime();

    // Historical accomplishments database
    const PEERS = [
      { age: 8, person: "Wolfgang Amadeus Mozart", deed: "composed his very first symphony (Symphony No. 1 in E-flat major)." },
      { age: 16, person: "Joan of Arc", deed: "led the French army to miraculous victory against England." },
      { age: 20, person: "Alexander the Great", deed: "ascended the throne of Macedonia and began conquering the known world." },
      { age: 23, person: "Isaac Newton", deed: "invented calculus while quarantined during the Great Plague of London." },
      { age: 26, person: "Albert Einstein", deed: "published four groundbreaking papers including Special Relativity in his 'Miracle Year'." },
      { age: 31, person: "Ada Lovelace", deed: "wrote the world's very first computer algorithm." },
      { age: 40, person: "Marie Curie", deed: "discovered radium and polonium, winning two Nobel Prizes." },
      { age: 52, person: "William Shakespeare", deed: "had already written King Lear, Hamlet, and 37 timeless plays." },
      { age: 62, person: "J.R.R. Tolkien", deed: "finally published The Fellowship of the Ring." }
    ];

    function updatePeer(years) {
      let closest = PEERS[0];
      let minDiff = 999;
      PEERS.forEach(p => {
        const diff = Math.abs(p.age - years);
        if (diff < minDiff) {
          minDiff = diff;
          closest = p;
        }
      });
      document.getElementById('peerText').innerHTML = `At age <strong>${closest.age}</strong>, <strong>${closest.person}</strong> ${closest.deed} Meanwhile, you are testing a browser arcade game.`;
    }

    function renderFrame() {
      const now = Date.now();
      const elapsedMs = Math.max(0, now - birthTime);

      const totalSeconds = Math.floor(elapsedMs / 1000);
      const msRemainder = elapsedMs % 1000;
      const years = elapsedMs / (1000 * 60 * 60 * 24 * 365.25);

      document.getElementById('liveSeconds').textContent = totalSeconds.toLocaleString();
      document.getElementById('liveMs').textContent = String(msRemainder).padStart(3, '0');

      // Lifespan %
      const lifePct = Math.min(100, (years / 80) * 100);
      document.getElementById('lifespanPctText').textContent = lifePct.toFixed(2) + '%';
      document.getElementById('lifespanFill').style.width = lifePct + '%';

      // Telemetry
      const minutes = elapsedMs / (1000 * 60);
      const hours = minutes / 60;
      const days = hours / 24;

      document.getElementById('teleHeartbeats').textContent = Math.floor(minutes * 72).toLocaleString();
      document.getElementById('teleBreaths').textContent = Math.floor(minutes * 16 * 0.5).toLocaleString() + ' L';
      
      const milkyKm = hours * 828000;
      if (milkyKm >= 1e9) {
        document.getElementById('teleMilkyWay').textContent = (milkyKm / 1e9).toFixed(2) + 'B km';
      } else {
        document.getElementById('teleMilkyWay').textContent = (milkyKm / 1e6).toFixed(1) + 'M km';
      }

      document.getElementById('teleMoon').textContent = Math.floor(days / 29.53).toLocaleString();
      document.getElementById('telePizza').textContent = Math.floor(years * 46).toLocaleString() + ' slices';
      document.getElementById('teleSleep').textContent = Math.floor(hours * 0.33).toLocaleString() + ' hrs';

      requestAnimationFrame(renderFrame);
    }
    requestAnimationFrame(renderFrame);

    function applyDate() {
      ensureAudio();
      const parsed = new Date(inputDate.value).getTime();
      if (isNaN(parsed) || parsed > Date.now()) {
        inputDate.value = '2000-01-01';
        birthTime = new Date('2000-01-01').getTime();
      } else {
        birthTime = parsed;
      }
      playTone(900, 'sine', 0.05, 0.08);
      const years = Math.max(0, (Date.now() - birthTime) / (1000 * 60 * 60 * 24 * 365.25));
      updatePeer(Math.round(years));
      awardArcadeXP(15, 10);
      unlockArcadeAchievement('age_crisis', '💀 Existentialist — Faced your chronological mortality!');
    }

    document.getElementById('btnUpdateClock').addEventListener('click', applyDate);

    document.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        inputDate.value = chip.dataset.preset;
        applyDate();
      });
    });

    applyDate();
  })();

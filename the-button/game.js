(() => {
    // ─── AUDIO ENGINE ───
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    let actx = null, soundOn = GameStorage.getItem('ka_sound') !== 'off';

    function ensureAudio() {
      if (!actx) actx = new AudioCtx();
      if (actx.state === 'suspended') actx.resume();
    }

    function playTone(freq, type, dur, vol = 0.15) {
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

    const SFX = {
      click(pitchMod = 1) {
        playTone(180 * pitchMod, 'triangle', 0.08, 0.2);
        setTimeout(() => playTone(120 * pitchMod, 'sine', 0.12, 0.15), 30);
      },
      alarm() {
        playTone(660, 'sawtooth', 0.15, 0.15);
        setTimeout(() => playTone(880, 'sawtooth', 0.2, 0.18), 120);
      },
      glitch() {
        [880, 1100, 1400, 1760].forEach((f, i) => {
          setTimeout(() => playTone(f, 'sine', 0.1, 0.15), i * 50);
        });
      },
      vent() {
        if (!soundOn || !actx) return;
        const node = actx.createBufferSource();
        const buffer = actx.createBuffer(1, actx.sampleRate * 0.4, actx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < buffer.length; i++) data[i] = Math.random() * 2 - 1;
        node.buffer = buffer;
        const gain = actx.createGain();
        gain.gain.setValueAtTime(0.08, actx.currentTime);
        gain.gain.linearRampToValueAtTime(0.001, actx.currentTime + 0.4);
        node.connect(gain).connect(actx.destination);
        node.start();
      },
      fanfare() {
        [523, 659, 784, 1046, 1318].forEach((f, i) => {
          setTimeout(() => playTone(f, 'sine', 0.18, 0.12), i * 80);
        });
      }
    };

    const soundBtn = document.getElementById('soundBtn');
    soundBtn.textContent = soundOn ? '🔊' : '🔇';
    soundBtn.addEventListener('click', () => {
      ensureAudio();
      soundOn = !soundOn;
      GameStorage.setItem('ka_sound', soundOn ? 'on' : 'off');
      soundBtn.textContent = soundOn ? '🔊' : '🔇';
      if (soundOn) SFX.click(1);
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

    // ─── GAME STATE ───
    let clicks = 0;
    let lifetimeClicks = 0;
    let quantumCores = 0;
    let glitchesCaught = 0;
    let combo = 1.0;
    let maxCombo = 1.0;
    let lastClickTime = 0;
    let comboDecayTimer = null;

    // Load saved button state
    try {
      const saved = JSON.parse(GameStorage.getItem('the_button_state'));
      if (saved) {
        clicks = saved.clicks || 0;
        lifetimeClicks = saved.lifetimeClicks || 0;
        quantumCores = saved.quantumCores || 0;
        maxCombo = saved.maxCombo || 1.0;
        glitchesCaught = saved.glitchesCaught || 0;
      }
    } catch(e){}

    const TIERS = [
      { min: 0, name: "TIER 1: CALIBRATION", text: "Button integrity holding. No hazards detected." },
      { min: 10, name: "TIER 2: POWER GRID FLICKER", text: "Neighborhood streetlights reported dimming slightly." },
      { min: 25, name: "TIER 3: SQUIRREL SURVEILLANCE", text: "Local wildlife is staring at your window with suspicion." },
      { min: 50, name: "TIER 4: QUANTUM ENTANGLEMENT", text: "Your keys are now in three places simultaneously." },
      { min: 100, name: "TIER 5: DECOMPILING REALITY", text: "Matrix code leaking into peripheral vision." },
      { min: 250, name: "TIER 6: APOCALYPSE PROTOCOL", text: "UNIVERSAL COLLAPSE IMMINENT. DO NOT STOP PRESSING." }
    ];

    const QUOTES = [
      "Why did you click it again? Nothing is going to happen.",
      "Warning: A minor disturbance was detected in the space-time continuum.",
      "Your IP address has been flagged by the Squirrel Intelligence Agency.",
      "You have voided the universe's manufacturer warranty.",
      "Someone in Ohio just sneezed because of you.",
      "The button enjoyed that. Please maintain personal boundaries.",
      "Simulation CPU utilization: 94.2%. Cooling fans engaged.",
      "An extraterrestrial civilization just received an unintelligible ping.",
      "Congratulations, you discovered the secret of wasting infinite time."
    ];

    function updateUI() {
      document.getElementById('clickCounter').textContent = clicks.toLocaleString();
      document.getElementById('statAllTimeClicks').textContent = lifetimeClicks.toLocaleString();
      document.getElementById('statQuantumCores').textContent = quantumCores;
      document.getElementById('statMaxCombo').textContent = maxCombo.toFixed(1) + 'x';
      document.getElementById('statGlitchesCaught').textContent = glitchesCaught;
      document.getElementById('comboMultiplierText').textContent = combo.toFixed(1) + 'x';
      document.getElementById('comboFill').style.width = Math.min(100, (combo - 1) * 25) + '%';

      // Current Tier
      let currentTier = TIERS[0];
      for (let i = TIERS.length - 1; i >= 0; i--) {
        if (clicks >= TIERS[i].min) {
          currentTier = TIERS[i];
          break;
        }
      }
      document.getElementById('threatTier').textContent = currentTier.name;
      document.getElementById('threatText').textContent = currentTier.text;

      // Save state
      GameStorage.setItem('the_button_state', JSON.stringify({
        clicks,
        lifetimeClicks,
        quantumCores,
        maxCombo,
        glitchesCaught
      }));
    }

    // ─── FLOATING TOAST NOTIFICATION ───
    function showButtonToast(msg, isGold = false) {
      const toast = document.createElement('div');
      toast.style.cssText = `
        position: fixed;
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: ${isGold ? 'linear-gradient(135deg, #ffd700, #ff9900)' : 'rgba(23, 16, 3, 0.95)'};
        color: ${isGold ? '#171003' : '#ffcf66'};
        border: 1px solid ${isGold ? '#fff' : 'rgba(255, 207, 102, 0.4)'};
        padding: 12px 24px;
        border-radius: 999px;
        font-size: 13px;
        font-weight: 900;
        box-shadow: 0 10px 30px rgba(0,0,0,0.6);
        z-index: 9999;
        pointer-events: none;
        transition: opacity 0.3s ease, transform 0.3s ease;
      `;
      toast.textContent = msg;
      document.body.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(-8px)';
        setTimeout(() => toast.remove(), 350);
      }, 3000);
    }

    // ─── MAIN BUTTON CLICK ───
    const mainButton = document.getElementById('mainButton');
    mainButton.addEventListener('click', () => {
      ensureAudio();

      const now = performance.now();
      const delta = now - lastClickTime;
      lastClickTime = now;

      // Calculate Combo smoothly without punishing regular clicks
      if (delta < 700) {
        combo = Math.min(5.0, combo + 0.15);
      } else {
        combo = 1.15;
      }
      if (combo > maxCombo) maxCombo = combo;

      const increment = Math.round((1 + quantumCores * 2) * combo);
      clicks += increment;
      lifetimeClicks += increment;

      // Audio pitch escalates with combo
      SFX.click(1 + (combo - 1) * 0.25);

      // Consequence Quote Update every few clicks
      if (Math.random() > 0.6) {
        const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
        document.getElementById('consequenceBox').textContent = '"' + q + '"';
      }

      // Progression XP & Coins
      awardArcadeXP(2, Math.floor(combo));

      // Achievements
      if (lifetimeClicks >= 100) unlockArcadeAchievement('button_100', '🔴 Masher — Clicked The Button 100 times!');
      if (lifetimeClicks >= 1000) unlockArcadeAchievement('button_1000', '⚠️ Existential Menace — 1,000 Button Presses!');
      if (combo >= 4.0) unlockArcadeAchievement('button_combo', '⚡ Speed Demon — Reached 4.0x Combo Speed!');

      // Random Glitch Button Spawn (3% chance)
      if (Math.random() < 0.03) {
        spawnGoldenGlitch();
      }

      updateUI();
    });

    // Smooth combo decay on idle
    setInterval(() => {
      const now = performance.now();
      if (now - lastClickTime > 900 && combo > 1.0) {
        combo = Math.max(1.0, combo - 0.15);
        updateUI();
      }
    }, 200);

    // ─── GOLDEN GLITCH BUTTON ───
    const goldenGlitch = document.getElementById('goldenGlitch');
    function spawnGoldenGlitch() {
      goldenGlitch.style.display = 'grid';
      const chamber = document.getElementById('chamber');
      const rect = chamber.getBoundingClientRect();
      const x = Math.random() * (rect.width - 80) + 10;
      const y = Math.random() * (rect.height - 80) + 10;
      goldenGlitch.style.left = x + 'px';
      goldenGlitch.style.top = y + 'px';
      SFX.glitch();

      setTimeout(() => {
        goldenGlitch.style.display = 'none';
      }, 4000);
    }

    goldenGlitch.addEventListener('click', (e) => {
      e.stopPropagation();
      ensureAudio();
      glitchesCaught++;
      goldenGlitch.style.display = 'none';
      SFX.fanfare();

      const bonusClicks = 100 * (1 + quantumCores);
      clicks += bonusClicks;
      lifetimeClicks += bonusClicks;
      awardArcadeXP(40, 20);
      unlockArcadeAchievement('button_glitch', '🌟 Glitch Hunter — Caught a flying golden glitch!');
      showButtonToast("💥 GOLDEN GLITCH CAUGHT! +" + bonusClicks + " clicks awarded!", true);
      document.getElementById('consequenceBox').textContent = '"Quantum anomaly captured. Spatial-temporal reality temporarily stabilized."';
      updateUI();
    });

    // ─── COOLANT VENT ───
    document.getElementById('btnCoolant').addEventListener('click', () => {
      ensureAudio();
      SFX.vent();
      document.getElementById('consequenceBox').textContent = '"Emergency steam released from the reaction chamber. Safe for now."';
    });

    // ─── PRESTIGE (REBOOT REALITY) ───
    document.getElementById('btnReboot').addEventListener('click', () => {
      ensureAudio();
      if (clicks < 250) {
        showButtonToast("⚠️ Need at least 250 clicks to reboot reality! (Currently: " + clicks + ")", false);
        return;
      }
      const earned = Math.floor(clicks / 250);
      quantumCores += earned;
      clicks = 0;
      combo = 1.0;
      SFX.fanfare();
      awardArcadeXP(100, 50);
      unlockArcadeAchievement('button_prestige', '⚛️ Multiverse Architect — Prestiged reality in The Button!');
      showButtonToast("⚛️ REALITY REBOOTED! +" + earned + " Quantum Cores harvested (Permanent click power boost)!", true);
      document.getElementById('consequenceBox').textContent = '"Universal reboot sequence executed. Reality has been factory reset."';
      updateUI();
    });

    updateUI();
  })();

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
      click() { playTone(800, 'sine', 0.05, 0.08); },
      chomp() {
        playTone(350, 'triangle', 0.08, 0.1);
        setTimeout(() => playTone(240, 'triangle', 0.1, 0.12), 60);
      },
      swoosh() {
        if (!soundOn || !actx) return;
        const osc = actx.createOscillator();
        const gain = actx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, actx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1400, actx.currentTime + 0.18);
        gain.gain.setValueAtTime(0.12, actx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.18);
        osc.connect(gain).connect(actx.destination);
        osc.start(); osc.stop(actx.currentTime + 0.18);
      },
      ding() {
        playTone(1760, 'sine', 0.25, 0.15);
      },
      alarm() {
        playTone(880, 'sawtooth', 0.15, 0.15);
        setTimeout(() => playTone(700, 'sawtooth', 0.15, 0.15), 120);
      }
    };

    const soundBtn = document.getElementById('soundBtn');
    soundBtn.textContent = soundOn ? '🔊' : '🔇';
    soundBtn.addEventListener('click', () => {
      ensureAudio();
      soundOn = !soundOn;
      GameStorage.setItem('ka_sound', soundOn ? 'on' : 'off');
      soundBtn.textContent = soundOn ? '🔊' : '🔇';
      if (soundOn) SFX.click();
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

    // ─── EX PROFILES & DIALOGUES ───
    // ─── FLOATING TOAST NOTIFICATION ───
    function showNotification(msg, isSuccess = false) {
      const toast = document.createElement('div');
      toast.style.cssText = `
        position: fixed;
        bottom: calc(24px + var(--house-ad-space, 0px));
        left: 50%;
        transform: translateX(-50%);
        background: ${isSuccess ? 'rgba(34, 197, 94, 0.95)' : 'rgba(23, 16, 3, 0.95)'};
        color: ${isSuccess ? '#031407' : '#ffcf66'};
        border: 1px solid ${isSuccess ? '#22c55e' : 'rgba(255, 207, 102, 0.4)'};
        padding: 12px 24px;
        border-radius: 999px;
        font-size: 13px;
        font-weight: 800;
        box-shadow: 0 10px 30px rgba(0,0,0,0.6);
        z-index: 9999;
        pointer-events: none;
        transition: opacity 0.3s ease, transform 0.3s ease;
      `;
      toast.textContent = msg;
      document.body.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(8px)';
        setTimeout(() => toast.remove(), 350);
      }, 3000);
    }

    // ─── EX PROFILES & DIALOGUES ───
    const EX_DATA = {
      tyler: {
        name: 'Toxic Tyler',
        avatar: '🏋️',
        history: [
          { type: 'sys', text: 'Today · Threat Level Low' },
          { type: 'received', text: 'Hey, can you return my favorite gym hoodie or did you burn it?', time: 'Yesterday 11:22 PM' },
          { type: 'sent', text: "I don't even know what hoodie you're talking about. Don't text me.", time: 'Yesterday 11:25 PM' }
        ],
        texts: [
          "hey... I saw someone wearing gym shorts like yours today and almost cried on the squat rack.",
          "are you still listening to that indie band we used to pretend to like?",
          "u up? my fitness app made me send this but honestly do you still think about me?",
          "i hit a new PR on deadlift today. thought you should know."
        ],
        replies: [
          "k.",
          "bro it is literally 9pm why are you texting me about deadlifts",
          "delete my number fr",
          "who is this again?"
        ]
      },
      emma: {
        name: 'Emma',
        avatar: '☕',
        history: [
          { type: 'sys', text: 'Boundaries established Tuesday at 4:15 PM' },
          { type: 'received', text: 'I am journaling about our dynamic right now and feel a lot of unresolved trauma.', time: '2 days ago' },
          { type: 'sent', text: 'Please discuss that with your therapist, not me.', time: '2 days ago' }
        ],
        texts: [
          "I know we said no contact, but I feel like our unhealed inner children deserve closure.",
          "I just ate a whole pizza and the guilt made me realize I never truly forgave you.",
          "Remember that trip to Portland? You still owe me $14 for the gluten-free waffle."
        ],
        replies: [
          "I have been discussing this exact pattern with my therapist. It's fascinating how your avoidant attachment flares up after carbs.",
          "I hope you find peace, but please respect my emotional boundaries.",
          "It was actually $16 with tip. Sending Venmo request now."
        ]
      },
      chad: {
        name: 'Crypto Chad',
        avatar: '🚀',
        history: [
          { type: 'sys', text: 'Smart contract session initialized' },
          { type: 'received', text: 'Did you check the crypto chart today? We are down bad but I am holding.', time: 'Sunday' },
          { type: 'sent', text: 'Do not text me financial advice or anything else.', time: 'Sunday' }
        ],
        texts: [
          "Hey... remember when we talked about buying an apartment in Miami? I miss you.",
          "I just went 400 calories over my macros and realized nothing matters except you and Bitcoin.",
          "Do you think we could have worked out if I didn't invest our vacation fund into DogeNFTs?"
        ],
        replies: [
          "Bro I am literally at a Web3 networking mixer in Dubai right now. Also buy $SOL.",
          "WAGMI without you honestly, but respect the hustle.",
          "I told you to hold the floor price! Whatever, hope you're good."
        ]
      },
      greg: {
        name: 'Ghost Greg',
        avatar: '👻',
        history: [
          { type: 'sys', text: 'Last active: 247 days ago' },
          { type: 'received', text: 'hey', time: '8 months ago' },
          { type: 'sent', text: '?', time: '8 months ago' }
        ],
        texts: [
          "Are you alive? It's been 8 months and NutriBot is exposing me.",
          "I know you won't reply, but I miss how you used to ignore my memes in real time.",
          "Hey. Just checking if you vanished into a parallel dimension."
        ],
        replies: [
          "...",
          "[Message not delivered: Recipient has blocked all existential drama]",
          "sorry was taking a nap (8 months later)"
        ]
      }
    };

    let currentEx = 'tyler';
    let currentCalories = 0;
    const LIMIT = 1800;
    let dayOver = false;
    let textSentTriggered = false;
    let dcCountdown = null;

    let stats = {
      daysSurvived: 0,
      textsSent: 0,
      excusesLanded: 0,
      caloriesLogged: 0
    };

    function renderChatStream(exKey) {
      const stream = document.getElementById('chatStream');
      const ex = EX_DATA[exKey];
      stream.innerHTML = '';
      ex.history.forEach(item => {
        const row = document.createElement('div');
        if (item.type === 'sys') {
          row.className = 'chat-date-stamp';
          row.textContent = item.text;
        } else {
          row.className = 'bubble-row ' + item.type;
          const bubble=document.createElement('div');
          bubble.className='bubble bubble-' + (item.type === 'sent' ? 'sent' : 'received');
          bubble.textContent=item.text;
          const meta=document.createElement('div'); meta.className='bubble-meta'; meta.textContent=item.time || 'Just now';
          row.append(bubble,meta);
        }
        stream.appendChild(row);
      });
      stream.scrollTop = stream.scrollHeight;
    }

    function updateDashboard() {
      document.getElementById('calCurrent').textContent = currentCalories.toLocaleString();
      document.getElementById('statCaloriesLogged').textContent = stats.caloriesLogged.toLocaleString();
      document.getElementById('statDaysSurvived').textContent = stats.daysSurvived;
      document.getElementById('statTextsSent').textContent = stats.textsSent;
      document.getElementById('statExcusesLanded').textContent = stats.excusesLanded;

      // Update ring
      const pct = Math.min(200, Math.round((currentCalories / LIMIT) * 100));
      document.getElementById('ringPct').textContent = pct + '%';

      const strokeOffset = Math.max(0, 264 - (264 * Math.min(1, currentCalories / LIMIT)));
      const fillEl = document.getElementById('ringFill');
      fillEl.style.strokeDashoffset = strokeOffset;

      const threatEl = document.getElementById('threatTag');
      if (currentCalories < 1200) {
        fillEl.style.stroke = 'var(--green)';
        threatEl.textContent = 'Dignity Intact';
        threatEl.className = 'threat-tag';
      } else if (currentCalories < LIMIT) {
        fillEl.style.stroke = 'var(--orange)';
        threatEl.textContent = 'Danger Zone';
        threatEl.className = 'threat-tag';
      } else {
        fillEl.style.stroke = 'var(--red)';
        threatEl.textContent = '🚨 OVER LIMIT';
        threatEl.className = 'threat-tag danger';
      }
    }

    // ─── FOOD LOGGING ───
    document.querySelectorAll('.btn-food').forEach(btn => {
      btn.addEventListener('click', (e) => {
        ensureAudio();
        const cal = parseInt(btn.dataset.cal);
        const name = btn.dataset.name;
        currentCalories += cal;
        stats.caloriesLogged += cal;
        SFX.chomp();
        updateDashboard();

        if (currentCalories >= LIMIT && !textSentTriggered) {
          triggerOverLimitText();
        }
      });
    });

    document.getElementById('btnCustomFood').addEventListener('click', () => {
      ensureAudio();
      const funnyFoods = [
        { name: "3-day-old takeout dumplings", cal: 520 },
        { name: "Entire box of Pop-Tarts while dissociating", cal: 760 },
        { name: "Spicy ramen with 3 extra cheese slices", cal: 890 },
        { name: "Guilt-free air (actually sugar cookies)", cal: 410 }
      ];
      const pick = funnyFoods[Math.floor(Math.random() * funnyFoods.length)];
      currentCalories += pick.cal;
      stats.caloriesLogged += pick.cal;
      SFX.chomp();
      showNotification("🍕 Logged: " + pick.name + " (+" + pick.cal + " kcal)!", true);
      updateDashboard();

      if (currentCalories >= LIMIT && !textSentTriggered) {
        triggerOverLimitText();
      }
    });

    // ─── EX PICKER ───
    document.querySelectorAll('.ex-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        ensureAudio();
        document.querySelectorAll('.ex-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        currentEx = btn.dataset.ex;
        const ex = EX_DATA[currentEx];
        document.getElementById('contactName').textContent = ex.name + " (Ex)";
        document.getElementById('contactAvatar').textContent = ex.avatar;
        renderChatStream(currentEx);
        SFX.click();
      });
    });

    // ─── TRIGGER EX TEXT MECHANIC ───
    function triggerOverLimitText() {
      textSentTriggered = true;
      SFX.alarm();

      const ex = EX_DATA[currentEx];
      const randomText = ex.texts[Math.floor(Math.random() * ex.texts.length)];
      const botMessage = `🤖 [MyFitnessEx Bot]: User exceeded 1,800 kcal limit. Auto-sending penalty confession: "${randomText}"`;

      ex.history.push({ type: 'sent', text: botMessage, time: 'Just now' });
      renderChatStream(currentEx);
      SFX.swoosh();

      stats.textsSent++;
      awardArcadeXP(15, 5);

      // Start 5-second Damage Control countdown
      startDamageControl();
    }

    function startDamageControl() {
      const dcBar = document.getElementById('damageControlBar');
      const timerEl = document.getElementById('dcTimer');
      dcBar.style.display = 'flex';
      let timeLeft = 5;
      timerEl.textContent = timeLeft;

      if (dcCountdown) clearInterval(dcCountdown);
      dcCountdown = setInterval(() => {
        timeLeft--;
        timerEl.textContent = timeLeft;
        if (timeLeft <= 0) {
          clearInterval(dcCountdown);
          dcBar.style.display = 'none';
          triggerExReply("no_excuse");
        }
      }, 1000);
    }

    // Damage Control Button Handlers
    document.querySelectorAll('.btn-dc').forEach(btn => {
      btn.addEventListener('click', () => {
        ensureAudio();
        clearInterval(dcCountdown);
        document.getElementById('damageControlBar').style.display = 'none';
        const excuse = btn.dataset.excuse;
        const text = btn.textContent.replace(/"/g, '');

        EX_DATA[currentEx].history.push({ type: 'sent', text: text, time: 'Just now' });
        renderChatStream(currentEx);
        SFX.swoosh();

        stats.excusesLanded++;
        awardArcadeXP(25, 10);
        unlockArcadeAchievement('ex_damage_control', '🛡️ Damage Control — Rapidly salvaged your dignity!');

        triggerExReply(excuse);
      });
    });

    function triggerExReply(excuseType) {
      const typingBubble = document.getElementById('typingBubble');
      typingBubble.style.display = 'flex';
      const stream = document.getElementById('chatStream');
      stream.appendChild(typingBubble);
      stream.scrollTop = stream.scrollHeight;

      setTimeout(() => {
        typingBubble.style.display = 'none';
        const ex = EX_DATA[currentEx];
        const reply = ex.replies[Math.floor(Math.random() * ex.replies.length)];

        ex.history.push({ type: 'received', text: reply, time: 'Just now' });
        renderChatStream(currentEx);
        SFX.ding();
      }, 2000);
    }

    // ─── FAST-FORWARD TO 9:00 PM ───
    document.getElementById('btnFastForward').addEventListener('click', () => {
      ensureAudio();
      document.getElementById('clockDisplay').textContent = "9:00 PM (EVALUATION)";
      if (currentCalories <= LIMIT) {
        // You survived!
        stats.daysSurvived++;
        awardArcadeXP(40, 25);
        unlockArcadeAchievement('ex_survived_day', '🥗 Calorie King — Stayed under limit and avoided texting your ex!');
        showNotification("🎉 9:00 PM Reached! Survived with " + currentCalories + " kcal. Dignity intact!", true);
      } else {
        if (!textSentTriggered) triggerOverLimitText();
      }
      updateDashboard();
    });

    // ─── RESET DAY ───
    document.getElementById('btnResetDay').addEventListener('click', () => {
      ensureAudio();
      currentCalories = 0;
      textSentTriggered = false;
      document.getElementById('clockDisplay').textContent = "9:00 AM (Safe)";
      SFX.click();
      EX_DATA[currentEx].history.push({ type: 'sys', text: '☀️ New Day Started — Dignity Reset to 100%' });
      renderChatStream(currentEx);
      showNotification("☀️ Day reset. 1,800 kcal budget restored!", true);
      updateDashboard();
    });

    renderChatStream(currentEx);
    updateDashboard();
  })();

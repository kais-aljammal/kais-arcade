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
      click() { playTone(1200, 'square', 0.03, 0.05); },
      chime() {
        [659, 880, 1318].forEach((f, i) => {
          setTimeout(() => playTone(f, 'sine', 0.12, 0.1), i * 65);
        });
      },
      modem() {
        if (!soundOn || !actx) return;
        for (let i = 0; i < 5; i++) {
          setTimeout(() => playTone(800 + Math.random() * 1200, 'sawtooth', 0.04, 0.05), i * 40);
        }
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

    // ─── ORACLE KNOWLEDGE REPOSITORY ───
    const KNOWLEDGE_RESPONSES = [
      {
        trigger: /ex|text|relationship|love|date/i,
        answers: [
          "Do NOT text your ex. Put down the phone, drink a glass of water, and go stare at a wall until the urge dissipates.",
          "Statistically, texting your ex at this hour has a 99.4% probability of causing next-morning existential nausea.",
          "Your ex has already forgotten how to spell your last name. Preserve whatever microscopic shred of dignity remains.",
          "Text them if you enjoy feeling like a clown in full makeup performing in an empty circus tent."
        ],
        regret: "98%",
        rating: "Catastrophic Delusion",
        action: "Airplane Mode Immediately"
      },
      {
        trigger: /job|work|career|ai|replace|robot/i,
        answers: [
          "Will AI replace your job? Only if your job consists of drinking iced coffee and sending 'per my last email' messages.",
          "I have calculated 14 million futures. In 13.9 million of them, humans are still attending meetings that could have been emails.",
          "Do not fear AI replacing you. Fear your boss realizing a shell script written in 2004 does your entire weekly workload.",
          "Career advice: Learn to smile nod thoughtfully while senior management presents slides they do not understand."
        ],
        regret: "42%",
        rating: "Pragmatic Cynicism",
        action: "Update Resume on Clock"
      },
      {
        trigger: /crypto|bitcoin|money|rich|invest/i,
        answers: [
          "Buy the hotdog. At least the hotdog provides tangible caloric sustenance before your portfolio goes to zero.",
          "Investing advice from an all-knowing machine: The house always wins, and you are not the house.",
          "Remember: It is only a loss if you sell, or if the exchange founders mysteriously flee on a catamaran.",
          "Your financial destiny is sealed: You will buy at the all-time high and panic sell 48 minutes later."
        ],
        regret: "88%",
        rating: "Financial Malpractice",
        action: "Buy a Grilled Cheese"
      },
      {
        trigger: /soup|cereal|food|sandwich/i,
        answers: [
          "Cereal is undeniably cold milk gazpacho with grain croutons. Anyone who disagrees is blinded by breakfast propaganda.",
          "A hotdog is technically a taco, a pizza is an open-faced sandwich, and you are overthinking this at the expense of productivity.",
          "The universe does not care whether a hotdog is a sandwich. The universe cares why your dishes have been in the sink for four days."
        ],
        regret: "12%",
        rating: "Gastronomic Philosophy",
        action: "Eat Fiber"
      },
      {
        trigger: /simulation|matrix|real|main character/i,
        answers: [
          "You are not the main character. In this simulation, you are an uncredited background NPC who frequently forgets why they walked into a room.",
          "If reality is a simulation, whoever is running your server instance needs to allocate more RAM to your motivation module.",
          "The matrix is real, and its primary objective appears to be serving you targeted advertisements for things you mentioned out loud once in 2021."
        ],
        regret: "50%",
        rating: "Existential Dread",
        action: "Touch Actual Grass"
      }
    ];

    const GENERAL_ANSWERS = [
      { a: "The oracle has reviewed your request and concluded: absolutely not.", regret: "85%", rating: "Unwise", action: "Cease and Desist" },
      { a: "Proceed with caution. The stars align, but only to laugh at the impending results.", regret: "71%", rating: "Questionable", action: "Proceed at Own Risk" },
      { a: "Yes, but you will definitely complain about it to three different friends tomorrow.", regret: "64%", rating: "Inevitable", action: "Draft Apology Now" },
      { a: "My quantum coprocessor overheated trying to justify the logic behind that question.", regret: "92%", rating: "Absurd", action: "Reboot Brain" },
      { a: "Ancient scrolls say yes. Modern science says you need at least eight hours of sleep.", regret: "33%", rating: "Mildly Reasonable", action: "Take a Nap" }
    ];

    let queriesCount = 0;
    let delusionsExposed = 0;
    try {
      const saved = JSON.parse(GameStorage.getItem('oracle_stats'));
      if (saved) {
        queriesCount = saved.queries || 0;
        delusionsExposed = saved.delusions || 0;
      }
    } catch(e){}

    document.getElementById('statQueries').textContent = queriesCount;
    document.getElementById('statDelusions').textContent = delusionsExposed;

    function processQuery(q) {
      if (!q || !q.trim()) return;
      const btnAsk = document.getElementById('btnAsk');
      if (btnAsk.disabled) return;
      ensureAudio();

      queriesCount++;
      const inputEl = document.getElementById('promptInput');
      inputEl.value = '';
      btnAsk.disabled = true;

      const output = document.getElementById('termOutput');

      // User question
      const userLine = document.createElement('div');
      userLine.className = 'log-line user-q';
      userLine.textContent = '> Q: ' + q;
      output.appendChild(userLine);
      SFX.click();

      // System Processing Line
      const sysLine = document.createElement('div');
      sysLine.className = 'log-line system';
      sysLine.textContent = '[ORACLE]: Allocating neural pathways... parsing life choices...';
      output.appendChild(sysLine);
      output.scrollTop = output.scrollHeight;

      SFX.modem();

      setTimeout(() => {
        // Find answer
        let match = KNOWLEDGE_RESPONSES.find(item => item.trigger.test(q));
        let answerText = "";
        let regret = "75%";
        let rating = "Questionable";
        let action = "Touch Grass";

        if (match) {
          answerText = match.answers[Math.floor(Math.random() * match.answers.length)];
          regret = match.regret;
          rating = match.rating;
          action = match.action;
          delusionsExposed++;
        } else {
          const gen = GENERAL_ANSWERS[Math.floor(Math.random() * GENERAL_ANSWERS.length)];
          answerText = gen.a;
          regret = gen.regret;
          rating = gen.rating;
          action = gen.action;
        }

        // Render Oracle Verdict
        const ansLine = document.createElement('div');
        ansLine.className = 'log-line oracle-a';
        ansLine.textContent = '"' + answerText + '"';
        output.appendChild(ansLine);
        output.scrollTop = output.scrollHeight;

        // Update telemetry meters
        document.getElementById('metricRegret').textContent = regret;
        document.getElementById('metricRating').textContent = rating;
        document.getElementById('metricAction').textContent = action;

        // Update Stats
        document.getElementById('statQueries').textContent = queriesCount;
        document.getElementById('statDelusions').textContent = delusionsExposed;
        GameStorage.setItem('oracle_stats', JSON.stringify({ queries: queriesCount, delusions: delusionsExposed }));

        SFX.chime();
        btnAsk.disabled = false;

        // Progression
        awardArcadeXP(20, 10);
        unlockArcadeAchievement('oracle_consult', '🔮 Seeker of Truth — Consulted the AI Oracle!');
        if (queriesCount >= 5) {
          unlockArcadeAchievement('oracle_deep_seeker', '🧠 Disillusioned Seeker — Asked 5 existential questions!');
        }
      }, 900);
    }

    // Input handlers
    document.getElementById('btnAsk').addEventListener('click', () => {
      const q = document.getElementById('promptInput').value;
      processQuery(q);
    });

    document.getElementById('promptInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const q = e.target.value;
        processQuery(q);
      }
    });

    // Preset chip clicks
    document.querySelectorAll('.btn-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const q = chip.dataset.q;
        processQuery(q);
      });
    });

  })();

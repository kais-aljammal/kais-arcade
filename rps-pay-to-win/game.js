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
      click() { playTone(850, 'sine', 0.05, 0.08); },
      slam() {
        playTone(120, 'triangle', 0.25, 0.25);
        setTimeout(() => playTone(80, 'sine', 0.35, 0.2), 60);
      },
      cash() {
        playTone(1320, 'sine', 0.08, 0.15);
        setTimeout(() => playTone(1760, 'sine', 0.12, 0.18), 70);
      },
      loss() {
        playTone(320, 'sawtooth', 0.2, 0.12);
        setTimeout(() => playTone(280, 'sawtooth', 0.25, 0.14), 180);
        setTimeout(() => playTone(220, 'sawtooth', 0.4, 0.18), 380);
      },
      fanfare() {
        [523, 659, 784, 1046, 1318].forEach((f, i) => {
          setTimeout(() => playTone(f, 'sine', 0.16, 0.12), i * 75);
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

    // ─── GAME STATE ───
    const MOVES = {
      rock: { emoji: '✊', beats: 'scissors', losesTo: 'paper' },
      paper: { emoji: '✋', beats: 'rock', losesTo: 'scissors' },
      scissors: { emoji: '✌️', beats: 'paper', losesTo: 'rock' }
    };

    let totalInvested = 0;
    let matchesCount = 0;
    let legitWins = 0;
    let boughtWins = 0;
    let playerWinCount = 0;
    let cpuWinCount = 0;
    let selectedTierPrice = 99;
    let selectedTierName = "Fairness Recalibration";
    let lastPlayerMove = 'rock';
    let lastCpuMove = 'paper';
    let isRoundInProgress = false;

    // Coping quotes
    const SHAME_QUOTES = [
      "Accept Skill Issue & Remain Defeated",
      "Blame 200ms Network Latency",
      "Cry into Pillow (Free of charge)",
      "Admit Chad_Algorithm is Superior",
      "Close Laptop & Touch Grass"
    ];

    function updateStatsUI() {
      document.getElementById('totalInvestedText').textContent = '$' + totalInvested.toLocaleString();
      document.getElementById('statMatches').textContent = matchesCount;
      document.getElementById('statOverturns').textContent = boughtWins;
      document.getElementById('statLegitWins').textContent = legitWins;
      document.getElementById('playerWins').textContent = 'Wins: ' + playerWinCount;
      document.getElementById('cpuWins').textContent = 'Wins: ' + cpuWinCount;

      const roi = totalInvested === 0 ? '0%' : (boughtWins > 0 ? ('-' + Math.min(999, Math.floor(totalInvested / 20)) + '%') : '-100%');
      document.getElementById('statROI').textContent = roi;

      // Cycle shame quote
      const shameBtn = document.getElementById('btnAcceptShame');
      shameBtn.textContent = SHAME_QUOTES[Math.floor(Math.random() * SHAME_QUOTES.length)];
    }

    function setMoveButtonsDisabled(disabled) {
      document.querySelectorAll('.btn-move').forEach(b => {
        b.disabled = disabled;
        b.style.opacity = disabled ? '0.5' : '1';
        b.style.pointerEvents = disabled ? 'none' : 'auto';
      });
    }

    // ─── PLAY ROUND ───
    function playRound(playerMove) {
      if (isRoundInProgress) return;
      if (document.getElementById('overturnModal').classList.contains('open')) return;
      ensureAudio();

      isRoundInProgress = true;
      setMoveButtonsDisabled(true);
      matchesCount++;
      lastPlayerMove = playerMove;

      const playerHandEl = document.getElementById('playerHand');
      const cpuHandEl = document.getElementById('cpuHand');
      const resultMainEl = document.getElementById('resultMain');
      const resultSubEl = document.getElementById('resultSub');

      // AI Logic: Subtle Rigging (65% chance of countering player)
      let cpuMove;
      const roll = Math.random();
      if (roll < 0.65) {
        // AI chooses winning move
        cpuMove = MOVES[playerMove].losesTo;
      } else if (roll < 0.85) {
        // Tie
        cpuMove = playerMove;
      } else {
        // Fair player win
        cpuMove = MOVES[playerMove].beats;
      }
      lastCpuMove = cpuMove;

      // Animation
      playerHandEl.textContent = '✊';
      cpuHandEl.textContent = '✊';
      playerHandEl.classList.remove('slam');
      cpuHandEl.classList.remove('slam');

      resultMainEl.textContent = 'Rock... Paper... Scissors...';
      resultSubEl.textContent = 'Shooting!';

      // 3-beat countdown
      let count = 0;
      const interval = setInterval(() => {
        count++;
        playTone(600 + count * 150, 'sine', 0.06, 0.1);
        if (count >= 3) {
          clearInterval(interval);
          revealResult(playerMove, cpuMove);
        }
      }, 200);
    }

    function revealResult(playerMove, cpuMove) {
      const playerHandEl = document.getElementById('playerHand');
      const cpuHandEl = document.getElementById('cpuHand');
      const resultMainEl = document.getElementById('resultMain');
      const resultSubEl = document.getElementById('resultSub');

      playerHandEl.textContent = MOVES[playerMove].emoji;
      cpuHandEl.textContent = MOVES[cpuMove].emoji;
      playerHandEl.classList.add('slam');
      cpuHandEl.classList.add('slam');
      SFX.slam();

      if (playerMove === cpuMove) {
        // Tie
        resultMainEl.textContent = "STALEMATE (TIE)";
        resultMainEl.style.color = "var(--gold)";
        resultSubEl.textContent = "Neither paid enough to secure victory. Try again.";
        awardArcadeXP(5, 1);
        setTimeout(() => {
          isRoundInProgress = false;
          setMoveButtonsDisabled(false);
        }, 500);
      } else if (MOVES[playerMove].beats === cpuMove) {
        // Player wins legitimately!
        legitWins++;
        playerWinCount++;
        SFX.fanfare();
        resultMainEl.textContent = "VICTORY! (ORGANIC)";
        resultMainEl.style.color = "var(--green)";
        resultSubEl.textContent = "You beat the algorithm without spending a dime! A miracle!";
        awardArcadeXP(25, 15);
        unlockArcadeAchievement('rps_legit_win', '🏆 Skill Based — Won RPS without paying $99!');
        setTimeout(() => {
          isRoundInProgress = false;
          setMoveButtonsDisabled(false);
        }, 500);
      } else {
        // Player Lost! Trigger Pay-to-Win modal!
        cpuWinCount++;
        SFX.loss();
        resultMainEl.textContent = "CRUSHING DEFEAT";
        resultMainEl.style.color = "var(--red)";
        resultSubEl.textContent = "Chad_Algorithm_v9 outmaneuvered you with ruthless corporate precision.";
        awardArcadeXP(5, 0);

        // Prompt emergency pay-to-win modal after short pause
        setTimeout(() => {
          openOverturnModal();
        }, 600);
      }

      updateStatsUI();
    }

    // Move button event listeners
    document.querySelectorAll('.btn-move').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const move = e.currentTarget.dataset.move;
        playRound(move);
      });
    });

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (isRoundInProgress) return;
      if (document.getElementById('overturnModal').classList.contains('open')) return;
      const k = e.key.toLowerCase();
      if (k === 'r') playRound('rock');
      if (k === 'p') playRound('paper');
      if (k === 's') playRound('scissors');
    });

    // ─── MODAL & TIER SELECTION ───
    const overturnModal = document.getElementById('overturnModal');
    function openOverturnModal() {
      overturnModal.classList.add('open');
      document.getElementById('checkoutFlow').style.display = 'none';
      document.getElementById('modalActions').style.display = 'flex';
      updateStatsUI();
    }

    document.querySelectorAll('.tier-option').forEach(tier => {
      tier.addEventListener('click', (e) => {
        ensureAudio();
        document.querySelectorAll('.tier-option').forEach(t => t.classList.remove('selected'));
        tier.classList.add('selected');
        selectedTierPrice = parseInt(tier.dataset.price);
        selectedTierName = tier.dataset.name;
        document.getElementById('tierBuyPrice').textContent = '$' + selectedTierPrice.toLocaleString();
        SFX.click();
      });
    });

    document.getElementById('btnAcceptShame').addEventListener('click', () => {
      ensureAudio();
      overturnModal.classList.remove('open');
      SFX.click();
      isRoundInProgress = false;
      setMoveButtonsDisabled(false);
    });

    // Process Pay-to-Win purchase
    document.getElementById('btnBuyWin').addEventListener('click', () => {
      ensureAudio();
      const checkoutFlow = document.getElementById('checkoutFlow');
      const modalActions = document.getElementById('modalActions');

      modalActions.style.display = 'none';
      checkoutFlow.style.display = 'flex';
      SFX.cash();

      const steps = ['step1', 'step2', 'step3', 'step4'];
      let cur = 0;

      function nextStep() {
        if (cur < steps.length) {
          const el = document.getElementById(steps[cur]);
          el.className = 'flow-step active';
          el.innerHTML = '<span class="flow-spinner"></span> <span>' + el.querySelector('span:last-child').textContent + '</span>';
          SFX.click();

          setTimeout(() => {
            el.className = 'flow-step done';
            el.innerHTML = '<span>✓</span> <span>' + el.querySelector('span:last-child').textContent + '</span>';
            cur++;
            nextStep();
          }, 450);
        } else {
          // Finished checkout!
          finalizeOverturn();
        }
      }
      nextStep();
    });

    function finalizeOverturn() {
      totalInvested += selectedTierPrice;
      boughtWins++;
      playerWinCount++;
      cpuWinCount = Math.max(0, cpuWinCount - 1);

      overturnModal.classList.remove('open');
      SFX.fanfare();

      // Recalibrate UI
      const playerHandEl = document.getElementById('playerHand');
      const cpuHandEl = document.getElementById('cpuHand');
      const resultMainEl = document.getElementById('resultMain');
      const resultSubEl = document.getElementById('resultSub');

      // Force change CPU's hand so you win!
      const winningMoveForPlayer = MOVES[lastPlayerMove].beats;
      cpuHandEl.textContent = MOVES[winningMoveForPlayer].emoji;
      cpuHandEl.classList.add('slam');

      resultMainEl.textContent = "RESULT OVERTURNED: VICTORY!";
      resultMainEl.style.color = "var(--gold)";
      resultSubEl.textContent = "Processed $" + selectedTierPrice.toLocaleString() + " payment. Fairness successfully restored.";

      awardArcadeXP(50, 100);
      unlockArcadeAchievement('rps_whale', '💸 Pay to Win Champion — Overturned defeat with cold hard cash!');
      if (totalInvested >= 1000) {
        unlockArcadeAchievement('rps_billionaire', '💎 Supreme Investor — Spent $1,000+ fixing RPS matches!');
      }

      updateStatsUI();
      isRoundInProgress = false;
      setMoveButtonsDisabled(false);
    }

    updateStatsUI();
  })();

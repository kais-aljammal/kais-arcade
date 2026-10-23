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
      click() { playTone(900, 'sine', 0.05, 0.08); },
      chip() {
        playTone(1400, 'sine', 0.04, 0.12);
        setTimeout(() => playTone(1800, 'sine', 0.05, 0.1), 35);
      },
      diceRattle() {
        if (!soundOn || !actx) return;
        for (let i = 0; i < 6; i++) {
          setTimeout(() => playTone(400 + Math.random() * 800, 'triangle', 0.03, 0.07), i * 50);
        }
      },
      win() {
        [523, 659, 784, 1047, 1318].forEach((f, i) => {
          setTimeout(() => playTone(f, 'sine', 0.18, 0.12), i * 75);
        });
      },
      bust() {
        playTone(280, 'sawtooth', 0.25, 0.12);
        setTimeout(() => playTone(210, 'sawtooth', 0.35, 0.15), 180);
      },
      raise() {
        playTone(600, 'triangle', 0.08, 0.1);
        setTimeout(() => playTone(880, 'triangle', 0.1, 0.12), 60);
      }
    };

    const soundBtn = document.getElementById('soundBtn');
    function updateSoundUI() {
      soundBtn.textContent = soundOn ? '🔊' : '🔇';
    }
    updateSoundUI();
    soundBtn.addEventListener('click', () => {
      ensureAudio();
      soundOn = !soundOn;
      GameStorage.setItem('ka_sound', soundOn ? 'on' : 'off');
      updateSoundUI();
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

    // ─── GAME STATE & MODES ───
    const MODES = [
      { id: 'high', name: 'High Roll', desc: 'Highest total wins the pot' },
      { id: 'low', name: 'Low Roll', desc: 'Lowest total takes the pot' },
      { id: 'doubles', name: 'Double Trouble', desc: 'Any double beats all non-doubles!' },
      { id: 'lucky7', name: 'Lucky 7', desc: 'Closest sum to 7 takes the whole pot' },
      { id: 'exact6', name: 'Exact 6', desc: 'Exactly 6 wins instantly, else high roll' },
      { id: 'chaos', name: 'Chaos Shift', desc: 'Mode rules invert after the dice land!' }
    ];

    const PLAYERS = [
      { id: 0, name: 'You', isAI: false, stack: 100000, bet: 0, folded: false, dice: [1, 1], score: 0 },
      { id: 1, name: 'Maya', isAI: true, style: 'aggressive', stack: 100000, bet: 0, folded: false, dice: [1, 1], score: 0 },
      { id: 2, name: 'Leo', isAI: true, style: 'conservative', stack: 100000, bet: 0, folded: false, dice: [1, 1], score: 0 },
      { id: 3, name: 'Nova', isAI: true, style: 'chaos', stack: 100000, bet: 0, folded: false, dice: [1, 1], score: 0 }
    ];

    let currentMode = MODES[0];
    let pot = 0;
    let minBet = 1000;
    let currentHighBet = 1000;
    let roundNumber = 1;
    let turnIndex = 0; // 0=You, 1=Maya, 2=Leo, 3=Nova
    let bettingPhase = 'pre-roll'; // 'pre-roll', 'post-roll', 'ready-to-roll', 'showdown'
    let loanDebt = 0;
    let activeSideBet = null; // { playerId, playerName, amount }
    let stats = { rounds: 0, wins: 0, streak: 0, startingStack: 100000 };

    // Load saved bankroll if available
    try {
      const saved = JSON.parse(GameStorage.getItem('greed_dice_state'));
      if (saved) {
        if (saved.stack !== undefined) PLAYERS[0].stack = saved.stack;
        if (saved.debt) loanDebt = saved.debt;
        if (saved.stats) stats = saved.stats;
      }
    } catch(e){}

    // Dice dot rendering matrix
    const DOT_PATTERNS = {
      1: [4],
      2: [0, 8],
      3: [0, 4, 8],
      4: [0, 2, 6, 8],
      5: [0, 2, 4, 6, 8],
      6: [0, 2, 3, 5, 6, 8]
    };

    function renderDice(diceCubeEl, val) {
      const dotsContainer = diceCubeEl.querySelector('.dice-dots');
      dotsContainer.dataset.val = val;
      dotsContainer.innerHTML = '';
      const onIndices = DOT_PATTERNS[val] || [4];
      for (let i = 0; i < 9; i++) {
        const span = document.createElement('span');
        span.className = 'dot' + (onIndices.includes(i) ? ' on' : '') + (val === 1 && i === 4 ? ' red' : '');
        dotsContainer.appendChild(span);
      }
    }

    function updateUI() {
      // Pot & Round
      document.getElementById('potText').textContent = '$' + pot.toLocaleString();
      document.getElementById('roundNum').textContent = roundNumber;
      document.getElementById('minBetText').textContent = '$' + minBet.toLocaleString();
      document.getElementById('modeName').textContent = currentMode.name;
      document.getElementById('modeDesc').textContent = '— ' + currentMode.desc;

      // Player Seats
      PLAYERS.forEach((p, idx) => {
        const seat = document.getElementById('seat-' + idx);
        document.getElementById('bankroll-' + idx).textContent = '$' + Math.max(0, p.stack).toLocaleString();
        document.getElementById('bet-' + idx).textContent = p.folded ? 'FOLDED' : ('Bet: $' + p.bet.toLocaleString());
        seat.classList.toggle('folded', p.folded);
        seat.classList.toggle('active-turn', turnIndex === idx && bettingPhase === 'pre-roll' && !p.folded);
      });

      // Side bet button status
      const sideBetBtn = document.getElementById('sideBetBtn');
      if (activeSideBet) {
        sideBetBtn.textContent = '🎯 Pick: ' + activeSideBet.playerName + ' (3x)';
        sideBetBtn.style.borderColor = 'var(--gold)';
        sideBetBtn.style.color = 'var(--gold)';
      } else {
        sideBetBtn.textContent = '🎯 Side Bet CPU ($1,000)';
        sideBetBtn.style.borderColor = '';
        sideBetBtn.style.color = '';
      }

      // Controls
      const isYourTurn = (turnIndex === 0) && (bettingPhase === 'pre-roll') && !PLAYERS[0].folded;
      const toCall = currentHighBet - PLAYERS[0].bet;

      const btnCall = document.getElementById('btnCall');
      const btnRaise = document.getElementById('btnRaise');
      const btnFold = document.getElementById('btnFold');
      const btnRollNow = document.getElementById('btnRollNow');

      btnCall.disabled = !isYourTurn || PLAYERS[0].stack < toCall;
      document.getElementById('callLabel').textContent = toCall === 0 ? 'CHECK ($0)' : ('MATCH ($' + toCall.toLocaleString() + ')');

      const raiseAmount = toCall + (minBet * 2);
      btnRaise.disabled = !isYourTurn || PLAYERS[0].stack < raiseAmount;
      document.getElementById('raiseLabel').textContent = 'RAISE (+$' + (minBet * 2).toLocaleString() + ')';

      btnFold.disabled = !isYourTurn;
      btnRollNow.disabled = bettingPhase !== 'ready-to-roll' || PLAYERS[0].folded;

      // Stats
      document.getElementById('statRounds').textContent = stats.rounds;
      document.getElementById('statWins').textContent = stats.wins;
      document.getElementById('statStreak').textContent = stats.streak;
      const profit = PLAYERS[0].stack - stats.startingStack;
      document.getElementById('statNetGain').textContent = (profit >= 0 ? '+$' : '-$') + Math.abs(profit).toLocaleString();
      document.getElementById('statNetGain').style.color = profit >= 0 ? 'var(--green)' : 'var(--red)';

      // Save state
      GameStorage.setItem('greed_dice_state', JSON.stringify({
        stack: PLAYERS[0].stack,
        debt: loanDebt,
        stats: stats
      }));
    }

    // AI Taunts / Dialogue
    const DIALOGUES = {
      aggressive: {
        raise: ["Raising the stakes! Anyone sweating?", "You can't afford this table.", "I smell weakness!"],
        call: ["I'll see that bet.", "Easy money.", "Still in."],
        fold: ["Tch, not worth my chips.", "Take the crumbs.", "You got lucky."],
        win: ["Cleaned you out!", "Like taking candy from an infant.", "Who's the apex predator now?"]
      },
      conservative: {
        raise: ["Variance is in my favor. Raising.", "Statistical advantage detected."],
        call: ["Expected value is positive. Matching.", "Within calculated tolerance."],
        fold: ["Risk profile unacceptable. Folding.", "Preserving bankroll."],
        win: ["As predicted by probability theory.", "Math always triumphs."]
      },
      chaos: {
        raise: ["YOLO! ALL GAS NO BRAKES!", "Double it! TRIPLE IT!", "Chaos reigns supreme!"],
        call: ["Roll the bones baby!", "Let's ride this rollercoaster!"],
        fold: ["Boring hand, going to grab a drink.", "Folding just to watch the world burn."],
        win: ["BWHAHAHA! TOTAL ANARCHY WINS!", "Did anyone see that coming?!"]
      }
    };

    function setSpeech(playerIdx, text) {
      const el = document.getElementById('speech-' + playerIdx);
      if (el) el.textContent = '"' + text + '"';
    }

    // ─── START HAND ───
    function startNewHand() {
      roundNumber++;
      currentMode = MODES[Math.floor(Math.random() * MODES.length)];
      pot = 0;
      minBet = Math.min(5000, 1000 + Math.floor(roundNumber / 2) * 500);
      currentHighBet = minBet;
      bettingPhase = 'pre-roll';
      turnIndex = 0;
      activeSideBet = null;

      document.querySelectorAll('.seat-card').forEach(s => s.classList.remove('winner'));
      document.getElementById('btnNextRound').style.display = 'none';
      document.getElementById('controlsDock').style.display = 'grid';

      // Reset players & Collect Ante
      PLAYERS.forEach((p, idx) => {
        p.folded = p.stack < minBet;
        p.hasActed = false;
        p.bet = 0;
        p.score = 0;
        document.getElementById('score-' + idx).textContent = 'Score: —';
        if (!p.folded) {
          p.stack -= minBet;
          p.bet = minBet;
          pot += minBet;
        } else if (idx === 0) {
          // You are bankrupt
          document.getElementById('arenaStatus').textContent = "You're busted! Visit Loan Shark Vinny for a stake!";
        }
      });

      SFX.chip();
      document.getElementById('arenaStatus').textContent = "Ante posted: $" + minBet.toLocaleString() + ". Mode: " + currentMode.name;
      document.getElementById('arenaSub').textContent = "Make your move: Match, Raise, or Pull Out.";

      setSpeech(0, "Game mode is " + currentMode.name + ". Let's do this.");
      setSpeech(1, "Don't blink or your stack disappears.");
      setSpeech(2, "Analyzing Mode: " + currentMode.name + ".");
      setSpeech(3, "Roll the bones!");

      updateUI();

      // If player cannot afford ante
      if (PLAYERS[0].folded) {
        advanceTurn();
      }
    }

    // ─── PLAYER ACTION HANDLERS ───
    document.getElementById('btnCall').addEventListener('click', () => {
      ensureAudio();
      const toCall = currentHighBet - PLAYERS[0].bet;
      PLAYERS[0].stack -= toCall;
      PLAYERS[0].bet += toCall;
      PLAYERS[0].hasActed = true;
      pot += toCall;
      SFX.chip();
      setSpeech(0, toCall === 0 ? "Checking." : "Matching $" + toCall.toLocaleString() + ".");
      advanceTurn();
    });

    document.getElementById('btnRaise').addEventListener('click', () => {
      ensureAudio();
      const toCall = currentHighBet - PLAYERS[0].bet;
      const raiseAmt = minBet * 2;
      const total = toCall + raiseAmt;
      PLAYERS[0].stack -= total;
      PLAYERS[0].bet += total;
      pot += total;
      currentHighBet = PLAYERS[0].bet;
      // Mark others as needing to respond to the raise
      PLAYERS.forEach(p => {
        if (!p.folded && p.id !== 0) p.hasActed = false;
      });
      PLAYERS[0].hasActed = true;
      SFX.raise();
      setSpeech(0, "Raising to $" + currentHighBet.toLocaleString() + "!");
      advanceTurn();
    });

    document.getElementById('btnFold').addEventListener('click', () => {
      ensureAudio();
      PLAYERS[0].folded = true;
      PLAYERS[0].hasActed = true;
      SFX.click();
      setSpeech(0, "I fold this hand.");
      advanceTurn();
    });

    // ─── TURN & BETTING RESOLUTION ───
    function isBettingSettled() {
      const active = PLAYERS.filter(p => !p.folded);
      if (active.length <= 1) return true;
      return active.every(p => p.hasActed && (p.bet === currentHighBet || p.stack === 0));
    }

    function getNextTurnIndex(startIdx) {
      for (let i = 1; i <= PLAYERS.length; i++) {
        const next = (startIdx + i) % PLAYERS.length;
        const p = PLAYERS[next];
        if (!p.folded && (!p.hasActed || (p.bet < currentHighBet && p.stack > 0))) {
          return next;
        }
      }
      return -1;
    }

    function advanceTurn() {
      updateUI();
      // Check if only one player remaining
      const active = PLAYERS.filter(p => !p.folded);
      if (active.length <= 1) {
        showdown(active);
        return;
      }

      // Check if all active players settled their bets
      if (isBettingSettled()) {
        bettingPhase = 'ready-to-roll';
        updateUI();

        if (PLAYERS[0].folded) {
          // You folded! Auto-simulate the roll for remaining players
          document.getElementById('arenaStatus').textContent = "You folded. Simulating table showdown...";
          document.getElementById('arenaSub').textContent = "Watch the remaining contenders roll.";
          document.getElementById('btnRollNow').disabled = true;
          setTimeout(() => executeDiceRoll(), 800);
        } else {
          document.getElementById('arenaStatus').textContent = "All bets matched! Hit ROLL DICE to showdown.";
          document.getElementById('arenaSub').textContent = "High stakes on the table ($" + pot.toLocaleString() + ")";
          document.getElementById('btnRollNow').disabled = false;
        }
        return;
      }

      // Advance to next unsettled player
      const nextIdx = getNextTurnIndex(turnIndex);
      if (nextIdx === -1) {
        // Fallback to ready
        bettingPhase = 'ready-to-roll';
        updateUI();
        if (PLAYERS[0].folded) setTimeout(() => executeDiceRoll(), 800);
        return;
      }

      turnIndex = nextIdx;
      const cur = PLAYERS[turnIndex];

      if (cur.id === 0) {
        // Player's turn
        updateUI();
        document.getElementById('arenaStatus').textContent = "Your turn! Action on you.";
        document.getElementById('arenaSub').textContent = "Current high bet: $" + currentHighBet.toLocaleString();
        return;
      }

      // AI turn
      updateUI();
      document.getElementById('arenaStatus').textContent = cur.name + " is deciding...";
      setTimeout(() => processAITurn(cur), 750);
    }

    function processAITurn(ai) {
      const toCall = currentHighBet - ai.bet;
      const style = ai.style;
      const quotes = DIALOGUES[style];

      if (ai.stack < toCall) {
        // AI forced fold
        ai.folded = true;
        ai.hasActed = true;
        setSpeech(ai.id, quotes.fold[0]);
      } else if (style === 'aggressive') {
        const rnd = Math.random();
        if (rnd > 0.5 && ai.stack >= toCall + minBet * 2) {
          // Raise
          const raise = toCall + minBet * 2;
          ai.stack -= raise;
          ai.bet += raise;
          pot += raise;
          currentHighBet = ai.bet;
          PLAYERS.forEach(p => { if (!p.folded && p.id !== ai.id) p.hasActed = false; });
          ai.hasActed = true;
          SFX.raise();
          setSpeech(ai.id, quotes.raise[Math.floor(Math.random() * quotes.raise.length)]);
        } else if (rnd > 0.12) {
          ai.stack -= toCall;
          ai.bet += toCall;
          pot += toCall;
          ai.hasActed = true;
          SFX.chip();
          setSpeech(ai.id, quotes.call[Math.floor(Math.random() * quotes.call.length)]);
        } else {
          ai.folded = true;
          ai.hasActed = true;
          setSpeech(ai.id, quotes.fold[Math.floor(Math.random() * quotes.fold.length)]);
        }
      } else if (style === 'conservative') {
        // Leo only raises on low stakes
        if (toCall > minBet * 3) {
          if (Math.random() > 0.45) {
            ai.folded = true;
            ai.hasActed = true;
            setSpeech(ai.id, quotes.fold[0]);
          } else {
            ai.stack -= toCall;
            ai.bet += toCall;
            pot += toCall;
            ai.hasActed = true;
            SFX.chip();
            setSpeech(ai.id, quotes.call[0]);
          }
        } else {
          ai.stack -= toCall;
          ai.bet += toCall;
          pot += toCall;
          ai.hasActed = true;
          SFX.chip();
          setSpeech(ai.id, quotes.call[0]);
        }
      } else {
        // Chaos Nova
        const rnd = Math.random();
        if (rnd > 0.55 && ai.stack >= toCall + minBet * 2) {
          const raise = toCall + minBet * 2;
          ai.stack -= raise;
          ai.bet += raise;
          pot += raise;
          currentHighBet = ai.bet;
          PLAYERS.forEach(p => { if (!p.folded && p.id !== ai.id) p.hasActed = false; });
          ai.hasActed = true;
          SFX.raise();
          setSpeech(ai.id, quotes.raise[Math.floor(Math.random() * quotes.raise.length)]);
        } else {
          ai.stack -= toCall;
          ai.bet += toCall;
          pot += toCall;
          ai.hasActed = true;
          SFX.chip();
          setSpeech(ai.id, quotes.call[Math.floor(Math.random() * quotes.call.length)]);
        }
      }

      advanceTurn();
    }

    // ─── ROLL DICE ───
    function executeDiceRoll() {
      ensureAudio();
      document.getElementById('btnRollNow').disabled = true;
      document.getElementById('arenaStatus').textContent = "Rolling dice across the felt...";
      SFX.diceRattle();

      // Trigger roll animation on all cubes
      document.querySelectorAll('.dice-cube').forEach(cube => cube.classList.add('rolling'));

      setTimeout(() => {
        document.querySelectorAll('.dice-cube').forEach(cube => cube.classList.remove('rolling'));

        // Generate values
        PLAYERS.forEach((p, idx) => {
          if (!p.folded) {
            p.dice = [
              Math.floor(Math.random() * 6) + 1,
              Math.floor(Math.random() * 6) + 1
            ];
            renderDice(document.getElementById('d-' + idx + '-0'), p.dice[0]);
            renderDice(document.getElementById('d-' + idx + '-1'), p.dice[1]);

            // Calculate score based on mode
            p.score = calculateScore(p.dice, currentMode.id);
            document.getElementById('score-' + idx).textContent = 'Score: ' + p.score + ' (' + p.dice[0] + '+' + p.dice[1] + ')';
          }
        });

        evaluateWinner();
      }, 900);
    }

    document.getElementById('btnRollNow').addEventListener('click', executeDiceRoll);

    function calculateScore(dice, modeId) {
      const sum = dice[0] + dice[1];
      const isDoubles = dice[0] === dice[1];
      if (modeId === 'high') return sum;
      if (modeId === 'low') return 100 - sum; // higher is better for ranking
      if (modeId === 'doubles') return isDoubles ? (100 + sum) : sum;
      if (modeId === 'lucky7') return 100 - Math.abs(7 - sum);
      if (modeId === 'exact6') return sum === 6 ? 999 : sum;
      if (modeId === 'chaos') {
        // random invert!
        return Math.random() > 0.5 ? sum : (100 - sum);
      }
      return sum;
    }

    function evaluateWinner() {
      const contenders = PLAYERS.filter(p => !p.folded);
      if (!contenders.length) return;

      const maxScore = Math.max(...contenders.map(c => c.score));
      const winners = contenders.filter(c => c.score === maxScore);
      showdown(winners);
    }

    function showdown(winners) {
      bettingPhase = 'showdown';
      const initialPot = pot;
      const splitPot = Math.floor(initialPot / winners.length);

      winners.forEach(w => {
        w.stack += splitPot;
        document.getElementById('seat-' + w.id).classList.add('winner');
      });

      stats.rounds++;

      // Check Side Bet Payout
      let sideBetMsg = "";
      if (activeSideBet) {
        if (winners.some(w => w.id === activeSideBet.playerId)) {
          const sidePayout = activeSideBet.amount * 3;
          PLAYERS[0].stack += sidePayout;
          SFX.win();
          awardArcadeXP(25, 15);
          unlockArcadeAchievement('greed_side_bet', '🎯 Inside Trader — Won a CPU side bet!');
          sideBetMsg = " 🎯 SIDE BET WON: +$" + sidePayout.toLocaleString() + " (" + activeSideBet.playerName + ")!";
        }
        activeSideBet = null;
      }

      const playerWon = winners.some(w => w.id === 0);

      if (playerWon) {
        // You won or split!
        stats.wins++;
        stats.streak++;
        SFX.win();

        if (winners.length > 1) {
          const others = winners.filter(w => w.id !== 0).map(w => w.name).join(' & ');
          document.getElementById('arenaStatus').textContent = "🤝 TIEBREAKER! Split pot with " + others + ": +$" + splitPot.toLocaleString() + " each!" + sideBetMsg;
          setSpeech(0, "A tie is still profit! Let's split it.");
        } else {
          document.getElementById('arenaStatus').textContent = "🎉 YOU WON THE POT OF $" + initialPot.toLocaleString() + "!" + sideBetMsg;
          setSpeech(0, "Read 'em and weep! My pot!");
        }

        // Handle loan shark payback if any
        if (loanDebt > 0) {
          const cut = Math.min(loanDebt, Math.floor(splitPot * 0.3));
          loanDebt -= cut;
          PLAYERS[0].stack -= cut;
          document.getElementById('arenaSub').textContent = "Loan Shark Vinny skimmed $" + cut.toLocaleString() + " for debt repayment!";
        } else {
          document.getElementById('arenaSub').textContent = "Pure profit added to your bankroll.";
        }

        // Award Arcade progression
        awardArcadeXP(35, Math.floor(splitPot / 1000));
        unlockArcadeAchievement('greed_first_win', '🎲 High Roller — Won a hand of Greed Dice!');
        if (stats.streak >= 3) {
          unlockArcadeAchievement('greed_streak_3', '🔥 Hot Hand — 3 win streak in Greed Dice!');
        }
        if (PLAYERS[0].stack >= 200000) {
          unlockArcadeAchievement('greed_200k', '💰 Greed Incarnate — Stack exceeded $200,000!');
        }
      } else {
        // AI won
        stats.streak = 0;
        SFX.bust();
        if (winners.length > 1) {
          const names = winners.map(w => w.name).join(' and ');
          document.getElementById('arenaStatus').textContent = "Tie between " + names + "! Split pot of $" + initialPot.toLocaleString() + "." + sideBetMsg;
        } else {
          const winner = winners[0];
          document.getElementById('arenaStatus').textContent = winner.name + " won the pot of $" + initialPot.toLocaleString() + "!" + sideBetMsg;
          const style = winner.style;
          setSpeech(winner.id, DIALOGUES[style].win[Math.floor(Math.random() * DIALOGUES[style].win.length)]);
        }
        awardArcadeXP(10, 5); // Consolation XP
      }

      pot = 0;
      updateUI();

      // Show Next Hand button
      document.getElementById('btnNextRound').style.display = 'block';
    }

    document.getElementById('btnNextRound').addEventListener('click', () => {
      ensureAudio();
      startNewHand();
    });

    // ─── LOAN SHARK MODAL ───
    const loanModal = document.getElementById('loanModal');
    document.getElementById('loanSharkBtn').addEventListener('click', () => {
      ensureAudio();
      document.getElementById('sharkDebt').textContent = '$' + loanDebt.toLocaleString();
      loanModal.classList.add('open');
    });
    document.getElementById('closeLoanBtn').addEventListener('click', () => {
      loanModal.classList.remove('open');
    });
    document.getElementById('takeLoanBtn').addEventListener('click', () => {
      ensureAudio();
      const loan = 25000;
      const juice = 31250;
      PLAYERS[0].stack += loan;
      loanDebt += juice;
      SFX.raise();
      loanModal.classList.remove('open');
      setSpeech(0, "Took out $25K from Vinny... I better win this back.");
      updateUI();
    });

    // ─── SIDE BETTING ───
    document.getElementById('sideBetBtn').addEventListener('click', () => {
      ensureAudio();
      if (activeSideBet) {
        document.getElementById('arenaSub').textContent = "Side bet already placed on " + activeSideBet.playerName + " ($1,000 for 3x return)!";
        return;
      }
      if (PLAYERS[0].stack < 1000) {
        document.getElementById('arenaSub').textContent = "Not enough stack for side bet ($1,000 required)!";
        return;
      }
      PLAYERS[0].stack -= 1000;
      const pickPlayer = PLAYERS[1 + Math.floor(Math.random() * 3)];
      activeSideBet = { playerId: pickPlayer.id, playerName: pickPlayer.name, amount: 1000 };
      SFX.chip();
      document.getElementById('arenaSub').textContent = "🎯 Side bet placed: $1,000 on " + pickPlayer.name + " to win this round (3x payout)!";
      updateUI();
    });

    // Initialize initial hand
    startNewHand();
  })();

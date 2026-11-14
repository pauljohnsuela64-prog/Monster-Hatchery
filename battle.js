
"use strict";

// ========================================
// MONSTER HATCHERY - PHASE 3A
// Turn-based Monster Battle Arena
// ========================================

// Reward for winning a battle.
const BATTLE_REWARD = 40;

// Each fighter can heal twice per battle.
const MAX_BATTLE_HEALS = 2;

// Find the battle elements in index.html.
const battleUI = {
  select: document.getElementById("battleMonsterSelect"),
  startBtn: document.getElementById("battleStartBtn"),
  attackBtn: document.getElementById("battleAttackBtn"),
  defendBtn: document.getElementById("battleDefendBtn"),
  healBtn: document.getElementById("battleHealBtn"),

  playerName: document.getElementById("battlePlayerName"),
  enemyName: document.getElementById("battleEnemyName"),
  playerHp: document.getElementById("battlePlayerHp"),
  enemyHp: document.getElementById("battleEnemyHp"),
  playerHpText: document.getElementById("battlePlayerHpText"),
  enemyHpText: document.getElementById("battleEnemyHpText"),

  status: document.getElementById("battleStatus"),
  log: document.getElementById("battleLog"),
  wins: document.getElementById("battleWins"),
  losses: document.getElementById("battleLosses")
};

// The current battle exists in memory only.
// Wins, losses and coin rewards are saved separately.
let activeBattle = null;

// ========================================
// BATTLE CALCULATIONS
// ========================================

/**
 * Returns a random whole number between min and max,
 * including both endpoints.
 *
 * Example: randomWhole(1, 3) returns 1, 2 or 3.
 */
function randomWhole(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Calculates maximum health from level and rarity.
 *
 * Higher-level and rarer monsters have more HP.
 */
function calculateBattleHp(monster, level) {
  return 40 + level * 10 + RARITY_RANK[monster.rarity] * 6;
}

/**
 * Calculates damage based on attack power.
 *
 * Random variation makes battles less predictable.
 * Every attack causes at least 4 damage.
 */
function calculateBattleDamage(power) {
  return Math.max(4, Math.floor(power * 0.8) + randomWhole(0, 4));
}

/**
 * Creates a computer-controlled enemy.
 *
 * The enemy has the player's level or slightly lower.
 * Its rarity is limited to prevent extreme matchups.
 *
 * Enemy evolution is calculated from its level,
 * without changing the player's saved collection.
 */
function createBattleEnemy(player) {
  const playerRank = RARITY_RANK[player.rarity];

  const candidates = MONSTERS.filter(monster =>
    monster.id !== player.id &&
    RARITY_RANK[monster.rarity] <= playerRank + 1
  );

  const enemy = candidates[
    randomWhole(0, candidates.length - 1)
  ];

  const playerLevel = getTraining(player.id).level;

  const level = Math.max(
    1,
    playerLevel - randomWhole(0, 2)
  );

  const stage = level >= 10 ? 2 : level >= 5 ? 1 : 0;

  const appearance = stage === 0
    ? enemy
    : EVOLUTION_FORMS[enemy.id][stage - 1];

  const power =
    BASE_POWER[enemy.rarity] +
    (level - 1) * 3 +
    EVOLUTION_POWER_BONUS[stage];

  return {
    id: enemy.id,
    name: appearance.name,
    emoji: appearance.emoji,
    level,
    power,
    maxHp: calculateBattleHp(enemy, level)
  };
}

// ========================================
// BATTLE SELECTION
// ========================================

/**
 * Loads discovered monsters into the selection menu.
 *
 * Monsters the player hasn't discovered are excluded.
 * The current selection is preserved when possible.
 */
function refreshBattleRoster() {
  const previousSelection = battleUI.select.value;

  const ownedMonsters = MONSTERS.filter(
    monster => (state.collection[monster.id] || 0) > 0
  );

  battleUI.select.replaceChildren();

  for (const monster of ownedMonsters) {
    const form = getMonsterAppearance(monster);

    const option = document.createElement("option");
    option.value = monster.id;

    option.textContent =
      `${form.emoji} ${form.name} · ` +
      `Level ${getTraining(monster.id).level}`;

    battleUI.select.append(option);
  }

  // Restore the previous selection after rebuilding.
  if (ownedMonsters.some(m => m.id === previousSelection)) {
    battleUI.select.value = previousSelection;
  }

  updateBattleControls();
}

/**
 * Enables or disables the battle controls.
 *
 * A battle cannot start during hatching or evolution.
 * Players cannot begin another battle before finishing.
 */
function updateBattleControls() {
  const busy = isHatching || isEvolving || isBattling;
  const hasMonsters = battleUI.select.options.length > 0;

  battleUI.select.disabled = isBattling;
  battleUI.startBtn.disabled = busy || !hasMonsters;

  battleUI.startBtn.textContent = isBattling
    ? "Battle in Progress"
    : activeBattle
      ? "⚔️ Battle Again"
      : "⚔️ Start Battle";

  battleUI.attackBtn.disabled = !isBattling;
  battleUI.defendBtn.disabled = !isBattling;

  battleUI.healBtn.disabled =
    !isBattling ||
    !activeBattle ||
    activeBattle.healsLeft <= 0 ||
    activeBattle.playerHp >= activeBattle.playerMaxHp;

  battleUI.healBtn.textContent = activeBattle
    ? `💚 Heal (${activeBattle.healsLeft} left)`
    : "💚 Heal";
}

// ========================================
// START A BATTLE
// ========================================

/**
 * Starts a new 1v1 battle.
 *
 * Copies the player's current stats into a battle.
 * This prevents damage from changing permanent
 * monster training or collection records.
 */
function startBattle() {
  if (isBattling || isHatching || isEvolving) return;

  const monster = MONSTERS.find(
    item => item.id === battleUI.select.value
  );

  if (!monster || !state.collection[monster.id]) return;

  const form = getMonsterAppearance(monster);
  const level = getTraining(monster.id).level;
  const enemy = createBattleEnemy(monster);

  const playerMaxHp = calculateBattleHp(monster, level);

  activeBattle = {
    active: true,
    playerId: monster.id,
    playerName: form.name,
    playerEmoji: form.emoji,
    playerLevel: level,
    playerPower: getMonsterPower(monster),

    playerMaxHp,
    playerHp: playerMaxHp,

    enemyName: enemy.name,
    enemyEmoji: enemy.emoji,
    enemyLevel: enemy.level,
    enemyPower: enemy.power,

    enemyMaxHp: enemy.maxHp,
    enemyHp: enemy.maxHp,

    healsLeft: MAX_BATTLE_HEALS,
    log: [],
    status: "Choose your move!"
  };

  isBattling = true;

  addBattleLog(
    `${form.name} challenges wild ${enemy.name}!`
  );

  renderBattle();
  updateButtons();
}

// ========================================
// TURN-BASED COMBAT
// ========================================

/**
 * Processes one player turn.
 *
 * Attack: Damage the enemy.
 * Defend: Reduce the enemy's next attack by 60%.
 * Heal: Restore up to 20 HP, twice per battle.
 *
 * The enemy automatically attacks after every
 * successful player action if it is still alive.
 */
function playBattleTurn(action) {
  if (!isBattling || !activeBattle?.active) return;

  let defending = false;

  if (action === "attack") {
    const damage = calculateBattleDamage(
      activeBattle.playerPower
    );

    activeBattle.enemyHp = Math.max(
      0,
      activeBattle.enemyHp - damage
    );

    addBattleLog(
      `⚔️ You dealt ${damage} damage!`
    );
  } else if (action === "defend") {
    defending = true;

    addBattleLog(
      "🛡️ You prepared to block the enemy attack!"
    );
  } else if (action === "heal") {
    if (
      activeBattle.healsLeft <= 0 ||
      activeBattle.playerHp >= activeBattle.playerMaxHp
    ) {
      return;
    }

    const restored = Math.min(
      20,
      activeBattle.playerMaxHp - activeBattle.playerHp
    );

    activeBattle.playerHp += restored;
    activeBattle.healsLeft--;

    addBattleLog(
      `💚 You restored ${restored} HP!`
    );
  } else {
    return;
  }

  // End immediately if the enemy has been defeated.
  // A defeated enemy must not get another attack.
  if (activeBattle.enemyHp === 0) {
    finishBattle(true);
    return;
  }

  // The computer opponent takes its turn.
  const enemyDamage = calculateBattleDamage(
    activeBattle.enemyPower
  );

  const actualDamage = defending
    ? Math.max(1, Math.ceil(enemyDamage * 0.4))
    : enemyDamage;

  activeBattle.playerHp = Math.max(
    0,
    activeBattle.playerHp - actualDamage
  );

  addBattleLog(
    `👾 Enemy dealt ${actualDamage} damage!`
  );

  // Check whether the player lost.
  if (activeBattle.playerHp === 0) {
    finishBattle(false);
    return;
  }

  activeBattle.status = "Your turn! Choose another move.";
  renderBattle();
}

// ========================================
// FINISH A BATTLE
// ========================================

/**
 * Ends the current battle and updates win/loss records.
 *
 * The active flag prevents duplicate rewards.
 * Battle records and coin rewards are saved together.
 */
function finishBattle(won) {
  if (!activeBattle?.active) return;

  activeBattle.active = false;
  isBattling = false;

  if (won) {
    state.battleStats.wins++;
    state.coins += BATTLE_REWARD;

    activeBattle.status =
      `🏆 Victory! You earned ${BATTLE_REWARD} coins.`;

    addBattleLog(
      `🏆 Victory! +${BATTLE_REWARD} coins.`
    );
  } else {
    state.battleStats.losses++;

    activeBattle.status =
      "💀 Defeat! Train your monster and try again.";

    addBattleLog("💀 Your monster was defeated.");
  }

  // Save permanent progress, not temporary HP.
  saveGame();

  // Refresh existing game systems.
  renderStats();
  renderCollection();
  renderAchievements();

  refreshBattleRoster();
  renderBattle();
  updateButtons();
}

// ========================================
// BATTLE DISPLAY
// ========================================

/**
 * Adds a message to the battle log.
 *
 * Keeps only the six most recent events,
 * preventing the log from growing indefinitely.
 */
function addBattleLog(message) {
  if (!activeBattle) return;

  activeBattle.log.unshift(message);
  activeBattle.log = activeBattle.log.slice(0, 6);
}

/**
 * Updates health bars, fighter information,
 * battle history, records and action buttons.
 */
function renderBattle() {
  battleUI.wins.textContent = state.battleStats.wins;
  battleUI.losses.textContent = state.battleStats.losses;

  if (!activeBattle) {
    battleUI.playerName.textContent = "—";
    battleUI.enemyName.textContent = "—";

    battleUI.playerHp.value = 0;
    battleUI.enemyHp.value = 0;

    battleUI.playerHpText.textContent = "HP: —";
    battleUI.enemyHpText.textContent = "HP: —";

    battleUI.status.textContent =
      "Select a discovered monster to begin.";

    battleUI.log.textContent =
      "Your battle events will appear here.";

    updateBattleControls();
    return;
  }

  battleUI.playerName.textContent =
    `${activeBattle.playerEmoji} ${activeBattle.playerName} ` +
    `(Lv. ${activeBattle.playerLevel})`;

  battleUI.enemyName.textContent =
    `${activeBattle.enemyEmoji} ${activeBattle.enemyName} ` +
    `(Lv. ${activeBattle.enemyLevel})`;

  battleUI.playerHp.max = activeBattle.playerMaxHp;
  battleUI.playerHp.value = activeBattle.playerHp;

  battleUI.enemyHp.max = activeBattle.enemyMaxHp;
  battleUI.enemyHp.value = activeBattle.enemyHp;

  battleUI.playerHpText.textContent =
    `HP: ${activeBattle.playerHp} / ${activeBattle.playerMaxHp}`;

  battleUI.enemyHpText.textContent =
    `HP: ${activeBattle.enemyHp} / ${activeBattle.enemyMaxHp}`;

  battleUI.status.textContent = activeBattle.status;

  // Rebuild the log using safe text elements.
  battleUI.log.replaceChildren();

  for (const message of activeBattle.log) {
    const entry = document.createElement("p");
    entry.textContent = message;
    battleUI.log.append(entry);
  }

  updateBattleControls();
}

// ========================================
// BUTTON EVENTS
// ========================================

// Each button starts a different player action.
battleUI.startBtn.addEventListener("click", startBattle);

battleUI.attackBtn.addEventListener("click", () => {
  playBattleTurn("attack");
});

battleUI.defendBtn.addEventListener("click", () => {
  playBattleTurn("defend");
});

battleUI.healBtn.addEventListener("click", () => {
  playBattleTurn("heal");
});

// ========================================
// INITIALIZE THE BATTLE ARENA
// ========================================

// Populate the roster and show saved win/loss records.
refreshBattleRoster();
renderBattle();

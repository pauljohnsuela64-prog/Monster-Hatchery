
"use strict";

// ========================================
// MONSTER HATCHERY - PHASE 3B
// Advanced Combat System
// ========================================

// 1. BATTLE SETTINGS

const BATTLE_REWARD = 40;
const MAX_BATTLE_HEALS = 2;
const SPECIAL_COOLDOWN = 2;
const CRITICAL_CHANCE = 0.15;
const CRITICAL_MULTIPLIER = 1.5;
const POISON_DAMAGE = 4;
const POISON_TURNS = 2;

// Each species has a permanent elemental type.
// Evolution changes appearance, not the element.
const MONSTER_ELEMENTS = {
  pebble: "Nature",
  puff: "Nature",
  moss: "Nature",
  shell: "Water",
  ember: "Fire",
  aqua: "Water",
  cloud: "Electric",
  storm: "Electric",
  crystal: "Nature",
  phantom: "Dark",
  solar: "Fire",
  phoenix: "Fire",
  star: "Dark"
};

const ELEMENT_ICONS = {
  Fire: "🔥",
  Water: "💧",
  Nature: "🌿",
  Electric: "⚡",
  Dark: "🌑"
};

// Each element is strong against two others.
// Remaining different elements are its weaknesses.
const STRONG_AGAINST = {
  Fire: ["Nature", "Electric"],
  Water: ["Fire", "Dark"],
  Nature: ["Water", "Dark"],
  Electric: ["Water", "Nature"],
  Dark: ["Fire", "Electric"]
};

// Special abilities available to each element.
const SPECIAL_ABILITIES = {
  Fire: {
    name: "Fireball",
    icon: "🔥",
    multiplier: 1.5
  },
  Water: {
    name: "Water Blast",
    icon: "💧",
    multiplier: 1.2
  },
  Nature: {
    name: "Poison Bite",
    icon: "🌿",
    multiplier: 1.15
  },
  Electric: {
    name: "Thunder Strike",
    icon: "⚡",
    multiplier: 1.3
  },
  Dark: {
    name: "Shadow Drain",
    icon: "🌑",
    multiplier: 1.2
  }
};

// 2. CONNECT THE BATTLE HTML ELEMENTS

const battleUI = {
  select: document.getElementById("battleMonsterSelect"),
  startBtn: document.getElementById("battleStartBtn"),
  attackBtn: document.getElementById("battleAttackBtn"),
  defendBtn: document.getElementById("battleDefendBtn"),
  healBtn: document.getElementById("battleHealBtn"),
  specialBtn: document.getElementById("battleSpecialBtn"),

  playerCard: document.getElementById("battlePlayerCard"),
  enemyCard: document.getElementById("battleEnemyCard"),

  playerName: document.getElementById("battlePlayerName"),
  enemyName: document.getElementById("battleEnemyName"),
  playerType: document.getElementById("battlePlayerType"),
  enemyType: document.getElementById("battleEnemyType"),

  playerHp: document.getElementById("battlePlayerHp"),
  enemyHp: document.getElementById("battleEnemyHp"),
  playerHpText: document.getElementById("battlePlayerHpText"),
  enemyHpText: document.getElementById("battleEnemyHpText"),

  status: document.getElementById("battleStatus"),
  log: document.getElementById("battleLog"),
  wins: document.getElementById("battleWins"),
  losses: document.getElementById("battleLosses")
};

// Only temporary battle information goes here.
// Permanent records stay inside the main game's state.
let activeBattle = null;

// ========================================
// 3. HELPER FUNCTIONS
// ========================================

/**
 * Returns a random integer including min and max.
 *
 * Example: randomWhole(1, 3) returns 1, 2 or 3.
 */
function randomWhole(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Gets the elemental type of a monster.
 *
 * All 13 original monsters have a type assigned.
 */
function getMonsterElement(monster) {
  return MONSTER_ELEMENTS[monster.id];
}

/**
 * Determines elemental effectiveness.
 *
 * Strong attacks receive x1.25 damage.
 * Weak attacks receive x0.8 damage.
 * Identical elements receive x1 damage.
 */
function getElementMatchup(attackerType, defenderType) {
  if (attackerType === defenderType) {
    return { multiplier: 1, message: "" };
  }

  if (STRONG_AGAINST[attackerType].includes(defenderType)) {
    return {
      multiplier: 1.25,
      message: "Super effective!"
    };
  }

  return {
    multiplier: 0.8,
    message: "Not very effective."
  };
}

/**
 * Calculates the fighter's maximum HP.
 *
 * Higher rarity and level increase maximum health.
 * This is the same formula used in Phase 3A.
 */
function calculateBattleHp(monster, level) {
  return 40 + level * 10 + RARITY_RANK[monster.rarity] * 6;
}

/**
 * Calculates attack damage and critical hits.
 *
 * Damage depends on:
 * - Monster power
 * - Random variation
 * - Elemental effectiveness
 * - Special attack multiplier
 * - Critical hit chance
 *
 * Returning an object lets us display extra details
 * about the attack in the battle log.
 */
function calculateBattleDamage(
  power,
  attackerType,
  defenderType,
  options = {}
) {
  const baseDamage = Math.max(
    4,
    Math.floor(power * 0.8) + randomWhole(0, 4)
  );

  const matchup = getElementMatchup(
    attackerType,
    defenderType
  );

  const specialMultiplier = options.multiplier ?? 1;
  const critChance = options.critChance ?? CRITICAL_CHANCE;

  const critical = Math.random() < critChance;

  const criticalMultiplier = critical
    ? CRITICAL_MULTIPLIER
    : 1;

  const damage = Math.max(
    1,
    Math.round(
      baseDamage *
      matchup.multiplier *
      specialMultiplier *
      criticalMultiplier
    )
  );

  return {
    damage,
    critical,
    effectiveness: matchup.message
  };
}

// ========================================
// 4. CREATE BATTLE FIGHTERS
// ========================================

/**
 * Builds the player's battle fighter.
 *
 * The player's level, power and evolved appearance
 * come from the existing saved game.
 *
 * HP and status effects are temporary and do not
 * permanently change the monster.
 */
function createPlayerFighter(monster) {
  const form = getMonsterAppearance(monster);
  const level = getTraining(monster.id).level;
  const maxHp = calculateBattleHp(monster, level);

  return {
    side: "player",
    id: monster.id,
    name: form.name,
    emoji: form.emoji,
    element: getMonsterElement(monster),
    level,
    power: getMonsterPower(monster),

    maxHp,
    hp: maxHp,

    healsLeft: MAX_BATTLE_HEALS,
    specialCooldown: 0,
    guard: false,
    poisonTurns: 0
  };
}

/**
 * Creates a computer-controlled opponent.
 *
 * The enemy is selected randomly from available
 * species and receives level-appropriate stats.
 *
 * Its appearance can be evolved without modifying
 * the player's collection or evolution records.
 */
function createBattleEnemy(playerMonster) {
  const playerRank = RARITY_RANK[playerMonster.rarity];

  const candidates = MONSTERS.filter(monster =>
    monster.id !== playerMonster.id &&
    RARITY_RANK[monster.rarity] <= playerRank + 1
  );

  const enemy = candidates[
    randomWhole(0, candidates.length - 1)
  ];

  const playerLevel = getTraining(playerMonster.id).level;

  const level = Math.max(
    1,
    playerLevel - randomWhole(0, 2)
  );

  const stage =
    level >= 10 ? 2 :
    level >= 5 ? 1 : 0;

  const form = stage === 0
    ? enemy
    : EVOLUTION_FORMS[enemy.id][stage - 1];

  const power =
    BASE_POWER[enemy.rarity] +
    (level - 1) * 3 +
    EVOLUTION_POWER_BONUS[stage];

  const maxHp = calculateBattleHp(enemy, level);

  return {
    side: "enemy",
    id: enemy.id,
    name: form.name,
    emoji: form.emoji,
    element: getMonsterElement(enemy),
    level,
    power,

    maxHp,
    hp: maxHp,

    healsLeft: MAX_BATTLE_HEALS,
    specialCooldown: 0,
    guard: false,
    poisonTurns: 0
  };
}

// ========================================
// 5. MONSTER SELECTION
// ========================================

/**
 * Rebuilds the fighter selection dropdown.
 *
 * Only monsters owned by the player are available.
 * The previously selected monster stays selected
 * when the roster refreshes, if still owned.
 */
function refreshBattleRoster() {
  const selectedId = battleUI.select.value;

  const owned = MONSTERS.filter(
    monster => (state.collection[monster.id] || 0) > 0
  );

  battleUI.select.replaceChildren();

  for (const monster of owned) {
    const form = getMonsterAppearance(monster);
    const element = getMonsterElement(monster);

    const option = document.createElement("option");
    option.value = monster.id;

    option.textContent =
      `${form.emoji} ${form.name} ` +
      `${ELEMENT_ICONS[element]} ` +
      `Lv.${getTraining(monster.id).level}`;

    battleUI.select.append(option);
  }

  if (owned.some(monster => monster.id === selectedId)) {
    battleUI.select.value = selectedId;
  }

  updateBattleControls();
}

/**
 * Updates the availability of all battle buttons.
 *
 * Special abilities become unavailable while
 * their cooldown is greater than zero.
 */
function updateBattleControls() {
  const inBattle = isBattling && activeBattle?.active;
  const busy = isHatching || isEvolving || isBattling;

  const hasMonsters = battleUI.select.options.length > 0;

  battleUI.select.disabled = !!inBattle;

  battleUI.startBtn.disabled = busy || !hasMonsters;

  battleUI.startBtn.textContent = inBattle
    ? "Battle in Progress"
    : activeBattle
      ? "⚔️ Battle Again"
      : "⚔️ Start Battle";

  battleUI.attackBtn.disabled = !inBattle;
  battleUI.defendBtn.disabled = !inBattle;

  const player = activeBattle?.player;

  battleUI.healBtn.disabled =
    !inBattle ||
    !player ||
    player.healsLeft <= 0 ||
    player.hp >= player.maxHp;

  battleUI.healBtn.textContent = player
    ? `💚 Heal (${player.healsLeft} left)`
    : "💚 Heal";

  if (player) {
    const special = SPECIAL_ABILITIES[player.element];

    battleUI.specialBtn.textContent =
      `${special.icon} ${special.name}` +
      (
        player.specialCooldown > 0
          ? ` (${player.specialCooldown} turns)`
          : ""
      );
  } else {
    battleUI.specialBtn.textContent = "✨ Special";
  }

  battleUI.specialBtn.disabled =
    !inBattle ||
    !player ||
    player.specialCooldown > 0;
}

// ========================================
// 6. START A BATTLE
// ========================================

/**
 * Starts a new battle using the selected monster.
 *
 * All combat stats are copied into activeBattle.
 * Damage taken in combat does not change the
 * permanent collection or training records.
 */
function startBattle() {
  if (isBattling || isHatching || isEvolving) return;

  const monster = MONSTERS.find(
    item => item.id === battleUI.select.value
  );

  if (!monster || !state.collection[monster.id]) return;

  activeBattle = {
    active: true,
    player: createPlayerFighter(monster),
    enemy: createBattleEnemy(monster),
    log: [],
    status: "Choose your first move!"
  };

  isBattling = true;

  addBattleLog(
    `${activeBattle.player.name} challenges ` +
    `wild ${activeBattle.enemy.name}!`
  );

  renderBattle();
  updateButtons();
}

// ========================================
// 7. BATTLE LOG AND VISUAL EFFECTS
// ========================================

/**
 * Adds an event to the top of the battle log.
 *
 * We keep the eight most recent messages.
 */
function addBattleLog(message) {
  if (!activeBattle) return;

  activeBattle.log.unshift(message);
  activeBattle.log = activeBattle.log.slice(0, 8);
}

/**
 * Plays a brief animation when a fighter is hit.
 *
 * The animation class determines whether to show
 * a normal damage shake or a magical glow.
 */
function animateBattleHit(side, isSpecial = false) {
  const card = side === "player"
    ? battleUI.playerCard
    : battleUI.enemyCard;

  card.classList.remove("battle-hit", "battle-special-hit");

  // Restart the CSS animation if repeatedly hit.
  void card.offsetWidth;

  card.classList.add(
    isSpecial ? "battle-special-hit" : "battle-hit"
  );
}

// ========================================
// 8. ATTACKS AND SPECIAL ABILITIES
// ========================================

/**
 * Performs a normal or special attack.
 *
 * Defense blocks 60% of the next incoming hit.
 * Critical hits and elemental strengths are
 * calculated before applying defense.
 *
 * Special attacks also activate unique effects.
 */
function performAttack(attacker, target, special = false) {
  const ability = SPECIAL_ABILITIES[attacker.element];

  const multiplier = special ? ability.multiplier : 1;

  // Electric specials have an increased crit chance.
  const critChance =
    special && attacker.element === "Electric"
      ? 0.4
      : CRITICAL_CHANCE;

  const result = calculateBattleDamage(
    attacker.power,
    attacker.element,
    target.element,
    { multiplier, critChance }
  );

  let damage = result.damage;

  // A guard absorbs 60% of one incoming attack.
  if (target.guard) {
    damage = Math.max(1, Math.ceil(damage * 0.4));
    target.guard = false;
    addBattleLog(`🛡️ ${target.name} blocked part of the attack!`);
  }

  target.hp = Math.max(0, target.hp - damage);

  const moveName = special ? ability.name : "Attack";

  addBattleLog(
    `${attacker.name} used ${moveName}: ${damage} damage!` +
    (result.critical ? " 💥 CRITICAL HIT!" : "") +
    (result.effectiveness
      ? ` ${result.effectiveness}`
      : "")
  );

  animateBattleHit(target.side, special);

  if (!special) return;

  // The cooldown starts after using the ability.
  // It will be reduced at the end of battle rounds.
  attacker.specialCooldown = SPECIAL_COOLDOWN + 1;

  // WATER: Restore some HP to the attacker.
  if (attacker.element === "Water") {
    const healed = Math.min(8, attacker.maxHp - attacker.hp);
    attacker.hp += healed;

    if (healed > 0) {
      addBattleLog(
        `💧 ${attacker.name} recovered ${healed} HP!`
      );
    }
  }

  // NATURE: Apply poison for two target turns.
  if (attacker.element === "Nature" && target.hp > 0) {
    target.poisonTurns = POISON_TURNS;

    addBattleLog(
      `🌿 ${target.name} was poisoned!`
    );
  }

  // DARK: Restore HP based on damage dealt.
  if (attacker.element === "Dark") {
    const healed = Math.min(
      Math.ceil(damage * 0.25),
      10,
      attacker.maxHp - attacker.hp
    );

    attacker.hp += healed;

    if (healed > 0) {
      addBattleLog(
        `🌑 ${attacker.name} drained ${healed} HP!`
      );
    }
  }
}

/**
 * Heals a fighter using one of its two healing uses.
 *
 * Returns false if healing is unavailable.
 * This prevents invalid actions consuming a turn.
 */
function performHeal(fighter) {
  if (
    fighter.healsLeft <= 0 ||
    fighter.hp >= fighter.maxHp
  ) {
    return false;
  }

  const healed = Math.min(
    20,
    fighter.maxHp - fighter.hp
  );

  fighter.hp += healed;
  fighter.healsLeft--;

  addBattleLog(
    `💚 ${fighter.name} restored ${healed} HP!`
  );

  return true;
}

/**
 * Executes one action from either player or enemy.
 *
 * Returns true if the action was valid and used
 * a turn; otherwise returns false.
 */
function performBattleAction(actor, target, action) {
  if (action === "attack") {
    performAttack(actor, target, false);
    return true;
  }

  if (action === "special") {
    if (actor.specialCooldown > 0) return false;

    performAttack(actor, target, true);
    return true;
  }

  if (action === "defend") {
    actor.guard = true;

    addBattleLog(
      `🛡️ ${actor.name} prepared a defensive stance!`
    );

    return true;
  }

  if (action === "heal") {
    return performHeal(actor);
  }

  return false;
}

// ========================================
// 9. POISON AND COOLDOWNS
// ========================================

/**
 * Deals poison damage at the beginning of
 * an affected fighter's turn.
 *
 * Each poison lasts two turns and deals 4 HP
 * each time. Poison can defeat a monster.
 */
function applyPoisonTick(fighter) {
  if (fighter.poisonTurns <= 0) return;

  const damage = Math.min(POISON_DAMAGE, fighter.hp);

  fighter.hp -= damage;
  fighter.poisonTurns--;

  addBattleLog(
    `☠️ ${fighter.name} took ${damage} poison damage!`
  );
}

/**
 * Reduces special cooldowns after a full round.
 *
 * Setting cooldown to 3 when used, then reducing
 * after the round, produces two future locked
 * turns before the move becomes available again.
 */
function advanceBattleCooldowns() {
  for (const fighter of [
    activeBattle.player,
    activeBattle.enemy
  ]) {
    if (fighter.specialCooldown > 0) {
      fighter.specialCooldown--;
    }
  }
}

// ========================================
// 10. SMARTER ENEMY AI
// ========================================

/**
 * Chooses the computer opponent's next action.
 *
 * The enemy:
 * - Tries healing when critically injured.
 * - Sometimes chooses a special attack.
 * - Sometimes defends when health is low.
 * - Otherwise performs a normal attack.
 *
 * It uses simple conditions and randomness,
 * not external AI or a paid API.
 */
function chooseEnemyAction(enemy) {
  const hpRatio = enemy.hp / enemy.maxHp;

  if (
    hpRatio < 0.4 &&
    enemy.healsLeft > 0 &&
    Math.random() < 0.65
  ) {
    return "heal";
  }

  if (
    enemy.specialCooldown === 0 &&
    Math.random() < 0.4
  ) {
    return "special";
  }

  if (hpRatio < 0.6 && Math.random() < 0.2) {
    return "defend";
  }

  return "attack";
}

// ========================================
// 11. PROCESS A COMPLETE BATTLE TURN
// ========================================

/**
 * Handles the player and enemy actions.
 *
 * Turn order:
 * 1. Player acts.
 * 2. Check for enemy defeat.
 * 3. Enemy takes poison damage.
 * 4. Enemy AI acts.
 * 5. Check for player defeat.
 * 6. Player takes poison damage.
 * 7. Reduce cooldowns and update the screen.
 *
 * Invalid actions never consume a turn.
 */
function playBattleTurn(action) {
  if (!isBattling || !activeBattle?.active) return;

  const player = activeBattle.player;
  const enemy = activeBattle.enemy;

  const valid = performBattleAction(player, enemy, action);

  if (!valid) return;

  // If the player's attack defeated the enemy,
  // the enemy cannot take another turn.
  if (enemy.hp <= 0) {
    finishBattle(true);
    return;
  }

  // Poison triggers at the beginning of enemy turn.
  applyPoisonTick(enemy);

  if (enemy.hp <= 0) {
    finishBattle(true);
    return;
  }

  // Computer chooses its own move.
  const enemyAction = chooseEnemyAction(enemy);

  performBattleAction(enemy, player, enemyAction);

  if (player.hp <= 0) {
    finishBattle(false);
    return;
  }

  // Poison triggers before the next player turn.
  applyPoisonTick(player);

  if (player.hp <= 0) {
    finishBattle(false);
    return;
  }

  advanceBattleCooldowns();

  activeBattle.status = "Your turn! Choose another move.";

  renderBattle();
}

// ========================================
// 12. END THE BATTLE
// ========================================

/**
 * Ends combat and records the outcome.
 *
 * Wins award 40 coins.
 * Losses have no coin penalty.
 *
 * The active flag prevents awarding a victory
 * more than once for the same battle.
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
      "💀 Defeat! Train and try again.";

    addBattleLog("💀 Your monster was defeated.");
  }

  // Persist permanent records and rewards.
  saveGame();

  // Update all existing game sections.
  renderStats();
  renderCollection();
  renderAchievements();

  refreshBattleRoster();
  renderBattle();
  updateButtons();
}

// ========================================
// 13. RENDER THE BATTLE ARENA
// ========================================

/**
 * Refreshes both fighters, HP bars, elements,
 * win/loss records, battle status, and history.
 *
 * We use textContent rather than inserting
 * untrusted HTML into the battle log.
 */
function renderBattle() {
  battleUI.wins.textContent = state.battleStats.wins;
  battleUI.losses.textContent = state.battleStats.losses;

  if (!activeBattle) {
    battleUI.playerName.textContent = "—";
    battleUI.enemyName.textContent = "—";

    battleUI.playerType.textContent = "Element: —";
    battleUI.enemyType.textContent = "Element: —";

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

  const player = activeBattle.player;
  const enemy = activeBattle.enemy;

  battleUI.playerName.textContent =
    `${player.emoji} ${player.name} (Lv.${player.level})`;

  battleUI.enemyName.textContent =
    `${enemy.emoji} ${enemy.name} (Lv.${enemy.level})`;

  battleUI.playerType.textContent =
    `${ELEMENT_ICONS[player.element]} ${player.element}`;

  battleUI.enemyType.textContent =
    `${ELEMENT_ICONS[enemy.element]} ${enemy.element}`;

  battleUI.playerHp.max = player.maxHp;
  battleUI.playerHp.value = player.hp;

  battleUI.enemyHp.max = enemy.maxHp;
  battleUI.enemyHp.value = enemy.hp;

  battleUI.playerHpText.textContent =
    `HP: ${player.hp} / ${player.maxHp}`;

  battleUI.enemyHpText.textContent =
    `HP: ${enemy.hp} / ${enemy.maxHp}`;

  battleUI.status.textContent = activeBattle.status;

  battleUI.log.replaceChildren();

  for (const message of activeBattle.log) {
    const entry = document.createElement("p");
    entry.textContent = message;
    battleUI.log.append(entry);
  }

  updateBattleControls();
}

// ========================================
// 14. BATTLE BUTTON EVENT LISTENERS
// ========================================

// Each event listener runs when its button is clicked.

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

battleUI.specialBtn.addEventListener("click", () => {
  playBattleTurn("special");
});

// ========================================
// 15. INITIALIZE THE BATTLE ARENA
// ========================================

// Load discovered monsters into the fighter dropdown.
refreshBattleRoster();

// Display saved wins and losses.
renderBattle();

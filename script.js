
"use strict";

// ========================================
// MONSTER HATCHERY - PHASE 2A
// Monster leveling, feeding, XP and power
// ========================================

// 1. MONSTER DATABASE
// Each object represents one collectible monster.
const MONSTERS = [
  { id: "pebble", name: "Pebblepup", emoji: "🐶", rarity: "Common" },
  { id: "puff", name: "Puffbun", emoji: "🐰", rarity: "Common" },
  { id: "moss", name: "Mosslet", emoji: "🌱", rarity: "Common" },
  { id: "shell", name: "Shellby", emoji: "🐢", rarity: "Common" },

  { id: "ember", name: "Emberfox", emoji: "🦊", rarity: "Rare" },
  { id: "aqua", name: "Aquafin", emoji: "🐟", rarity: "Rare" },
  { id: "cloud", name: "Cloudkit", emoji: "🐱", rarity: "Rare" },

  { id: "storm", name: "Stormowl", emoji: "🦉", rarity: "Epic" },
  { id: "crystal", name: "Crystalstag", emoji: "🦌", rarity: "Epic" },
  { id: "phantom", name: "Phantombat", emoji: "🦇", rarity: "Epic" },

  { id: "solar", name: "Solar Dragon", emoji: "🐉", rarity: "Legendary" },
  { id: "phoenix", name: "Moon Phoenix", emoji: "🔥", rarity: "Legendary" },

  { id: "star", name: "Star Serpent", emoji: "🌌", rarity: "Mythic" }
];

// 2. EGG TYPES
// Odds are percentages and must total 100 per egg.
const EGGS = {
  meadow: {
    name: "Meadow Egg",
    cost: 40,
    odds: {
      Common: 55,
      Rare: 27,
      Epic: 13,
      Legendary: 4,
      Mythic: 1
    }
  },
  moon: {
    name: "Moon Egg",
    cost: 100,
    odds: {
      Common: 15,
      Rare: 35,
      Epic: 30,
      Legendary: 15,
      Mythic: 5
    }
  }
};

// 3. REWARDS AND TRAINING SETTINGS
const DUPLICATE_REWARDS = {
  Common: 10,
  Rare: 20,
  Epic: 40,
  Legendary: 80,
  Mythic: 150
};

const BASE_POWER = {
  Common: 5,
  Rare: 9,
  Epic: 14,
  Legendary: 20,
  Mythic: 30
};

const FEED_COST = 15;
const FEED_XP = 20;
const MAX_LEVEL = 10;
const COOLDOWN_MS = 12000;

// IMPORTANT: Keep the v1 save key unchanged.
// This allows us to load the original v1 collection.
const STORAGE_KEY = "monster-hatchery-save-v1";

// 4. HTML ELEMENT REFERENCES
// These let JavaScript interact with our webpage.
const ui = {
  coins: document.getElementById("coins"),
  discovered: document.getElementById("discovered"),
  hatches: document.getElementById("hatches"),
  egg: document.getElementById("egg"),
  status: document.getElementById("status"),
  meadowBtn: document.getElementById("meadowBtn"),
  moonBtn: document.getElementById("moonBtn"),
  claimBtn: document.getElementById("claimBtn"),
  claimHint: document.getElementById("claimHint"),
  result: document.getElementById("result"),
  collection: document.getElementById("collection"),
  resetBtn: document.getElementById("resetBtn")
};

// Load existing progress before displaying the game.
let state = loadGame();
let isHatching = false;

// ========================================
// SAVE SYSTEM
// ========================================

/**
 * Creates a brand-new game.
 *
 * NEW: training stores monster levels and XP.
 */
function createFreshGame() {
  return {
    coins: 200,
    hatches: 0,
    collection: {},
    training: {},
    lastClaim: 0
  };
}

/**
 * Calculates how much XP a monster needs to
 * advance from its current level.
 *
 * Level 1 requires 30 XP.
 * Level 2 requires 60 XP.
 * Level 3 requires 90 XP, and so on.
 */
function xpToNextLevel(level) {
  return level * 30;
}

/**
 * Checks and cleans saved training information.
 *
 * Old v1 saves have no training property.
 * We accept that and give existing monsters
 * Level 1 and 0 XP automatically.
 *
 * This also prevents invalid levels and XP
 * values from breaking the interface.
 */
function sanitizeTraining(savedTraining, collection) {
  const cleanTraining = {};

  if (!savedTraining || typeof savedTraining !== "object") {
    return cleanTraining;
  }

  for (const monster of MONSTERS) {
    // A player cannot train an unowned monster.
    if (!collection[monster.id]) continue;

    const progress = savedTraining[monster.id];

    if (!progress || typeof progress !== "object") {
      continue;
    }

    const level = progress.level;
    const xp = progress.xp;

    if (
      !Number.isSafeInteger(level) ||
      level < 1 ||
      level > MAX_LEVEL ||
      !Number.isSafeInteger(xp) ||
      xp < 0
    ) {
      continue;
    }

    // XP is always below the next-level threshold.
    // Max-level monsters no longer accumulate XP.
    cleanTraining[monster.id] = {
      level,
      xp: level === MAX_LEVEL
        ? 0
        : Math.min(xp, xpToNextLevel(level) - 1)
    };
  }

  return cleanTraining;
}

/**
 * Loads the saved game from the browser.
 *
 * The old coins, hatch count, collection,
 * and free-coin cooldown remain compatible.
 */
function loadGame() {
  try {
    const savedText = localStorage.getItem(STORAGE_KEY);

    if (!savedText) {
      return createFreshGame();
    }

    const saved = JSON.parse(savedText);

    if (!saved || typeof saved !== "object") {
      return createFreshGame();
    }

    const collection = {};
    const savedCollection = saved.collection || {};

    for (const monster of MONSTERS) {
      const count = savedCollection[monster.id];

      if (Number.isSafeInteger(count) && count > 0) {
        collection[monster.id] = count;
      }
    }

    return {
      coins:
        Number.isSafeInteger(saved.coins) && saved.coins >= 0
          ? saved.coins
          : 200,

      hatches:
        Number.isSafeInteger(saved.hatches) && saved.hatches >= 0
          ? saved.hatches
          : 0,

      collection,

      // NEW: loads levels, or initializes them from v1.
      training: sanitizeTraining(saved.training, collection),

      lastClaim:
        Number.isFinite(saved.lastClaim) && saved.lastClaim >= 0
          ? saved.lastClaim
          : 0
    };
  } catch (error) {
    console.warn("Could not load saved game:", error);
    return createFreshGame();
  }
}

/**
 * Saves the entire game, including training,
 * as JSON inside localStorage.
 */
function saveGame() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("Could not save game:", error);
  }
}

// ========================================
// MONSTER TRAINING - NEW IN PHASE 2A
// ========================================

/**
 * Returns one monster's training data.
 *
 * If an existing v1 monster has never been
 * trained, it starts at Level 1 with 0 XP.
 */
function getTraining(monsterId) {
  return state.training[monsterId] || {
    level: 1,
    xp: 0
  };
}

/**
 * Calculates a monster's attack power.
 *
 * Rarer monsters have higher starting power.
 * Each additional level adds 3 power.
 */
function getMonsterPower(monster) {
  const progress = getTraining(monster.id);

  return BASE_POWER[monster.rarity] +
    (progress.level - 1) * 3;
}

/**
 * Feeds an owned monster.
 *
 * Each feeding costs 15 coins and grants 20 XP.
 * A loop checks whether enough XP has been
 * earned for one or more level increases.
 */
function feedMonster(monsterId) {
  // Prevent feeding during a hatch animation.
  if (isHatching) return;

  const monster = MONSTERS.find(
    item => item.id === monsterId
  );

  // Do not allow training an unknown monster.
  if (!monster || !state.collection[monsterId]) {
    return;
  }

  const current = getTraining(monsterId);

  if (current.level >= MAX_LEVEL) {
    setStatus(`${monster.name} is already at max level!`);
    return;
  }

  if (state.coins < FEED_COST) {
    setStatus("❌ Not enough coins to feed this monster.");
    return;
  }

  // Deduct coins and add XP.
  state.coins -= FEED_COST;

  let level = current.level;
  let xp = current.xp + FEED_XP;

  // A while loop handles XP crossing a level threshold.
  while (level < MAX_LEVEL && xp >= xpToNextLevel(level)) {
    xp -= xpToNextLevel(level);
    level += 1;
  }

  // Stop earning XP after reaching Level 10.
  if (level === MAX_LEVEL) {
    xp = 0;
  }

  state.training[monsterId] = { level, xp };

  // Save the upgrade immediately.
  saveGame();

  if (level > current.level) {
    setStatus(
      `🎉 ${monster.name} reached Level ${level}!`
    );
  } else {
    setStatus(
      `🍖 ${monster.name} gained ${FEED_XP} XP!`
    );
  }

  // Refresh the statistics and monster cards.
  renderStats();
  renderCollection();
  updateButtons();
}

/**
 * Builds the new training area beneath an owned
 * monster card.
 *
 * We create HTML elements using JavaScript.
 * This provides levels, XP bars, power and buttons.
 */
function createTrainingControls(monster) {
  const progress = getTraining(monster.id);
  const isMaxLevel = progress.level >= MAX_LEVEL;

  const container = document.createElement("div");
  container.className = "training";

  const levelText = document.createElement("p");
  levelText.className = "training-level";
  levelText.textContent =
    `⭐ Level ${progress.level} / ${MAX_LEVEL}`;

  const powerText = document.createElement("p");
  powerText.className = "training-power";
  powerText.textContent =
    `⚔️ Power ${getMonsterPower(monster)}`;

  // The built-in progress element displays an XP bar.
  const xpBar = document.createElement("progress");
  xpBar.className = "xp-bar";
  xpBar.max = isMaxLevel
    ? 1
    : xpToNextLevel(progress.level);
  xpBar.value = isMaxLevel ? 1 : progress.xp;

  xpBar.setAttribute(
    "aria-label",
    `${monster.name} experience progress`
  );

  const xpText = document.createElement("small");
  xpText.className = "xp-label";
  xpText.textContent = isMaxLevel
    ? "MAX LEVEL"
    : `${progress.xp} / ${xpToNextLevel(progress.level)} XP`;

  const feedButton = document.createElement("button");
  feedButton.type = "button";
  feedButton.className = "feed-button";
  feedButton.dataset.monsterId = monster.id;

  feedButton.textContent = isMaxLevel
    ? "⭐ Max Level"
    : `🍖 Feed · ${FEED_COST} Coins`;

  feedButton.disabled =
    isHatching ||
    isMaxLevel ||
    state.coins < FEED_COST;

  // Clicking this specific card trains its monster.
  feedButton.addEventListener("click", () => {
    feedMonster(monster.id);
  });

  container.append(
    levelText,
    powerText,
    xpBar,
    xpText,
    feedButton
  );

  return container;
}

// ========================================
// RANDOM HATCHING
// ========================================

/**
 * Selects a rarity using the egg's percentages.
 */
function rollRarity(odds) {
  let roll = Math.random() * 100;

  for (const [rarity, chance] of Object.entries(odds)) {
    roll -= chance;

    if (roll < 0) {
      return rarity;
    }
  }

  return "Common";
}

/**
 * Randomly selects a monster from a rarity group.
 */
function pickMonster(rarity) {
  const possibleMonsters = MONSTERS.filter(
    monster => monster.rarity === rarity
  );

  const index = Math.floor(
    Math.random() * possibleMonsters.length
  );

  return possibleMonsters[index];
}

// ========================================
// USER INTERFACE
// ========================================

/**
 * Changes the text beneath the hatching egg.
 */
function setStatus(message) {
  ui.status.textContent = message;
}

/**
 * Builds a basic monster card.
 * This is also used in the latest hatch panel.
 */
function createMonsterCard(monster, count) {
  const card = document.createElement("article");

  card.className =
    `monster-card rarity-${monster.rarity.toLowerCase()}`;

  const emoji = document.createElement("div");
  emoji.className = "monster-emoji";
  emoji.textContent = monster.emoji;

  const name = document.createElement("h3");
  name.textContent = monster.name;

  const rarity = document.createElement("p");
  rarity.textContent = monster.rarity;

  const owned = document.createElement("small");
  owned.textContent = `Owned: ${count}`;

  card.append(emoji, name, rarity, owned);

  return card;
}

/**
 * Builds a question-mark card for a monster
 * the player has not yet discovered.
 */
function createLockedCard() {
  const card = document.createElement("article");
  card.className = "monster-card locked";

  const emoji = document.createElement("div");
  emoji.className = "monster-emoji";
  emoji.textContent = "❔";

  const name = document.createElement("h3");
  name.textContent = "Unknown Monster";

  const description = document.createElement("p");
  description.textContent = "Not discovered yet";

  card.append(emoji, name, description);

  return card;
}

/**
 * Updates coins, hatch count and discoveries.
 */
function renderStats() {
  ui.coins.textContent = state.coins;
  ui.hatches.textContent = state.hatches;

  const discovered = MONSTERS.filter(
    monster => (state.collection[monster.id] || 0) > 0
  ).length;

  ui.discovered.textContent =
    `${discovered} / ${MONSTERS.length}`;
}

/**
 * Rebuilds the encyclopedia.
 *
 * NEW: Owned monsters now receive leveling
 * controls directly beneath their cards.
 */
function renderCollection() {
  ui.collection.replaceChildren();

  for (const monster of MONSTERS) {
    const count = state.collection[monster.id] || 0;

    if (count > 0) {
      const card = createMonsterCard(monster, count);

      // Add leveling controls only to discovered monsters.
      card.append(createTrainingControls(monster));

      ui.collection.append(card);
    } else {
      ui.collection.append(createLockedCard());
    }
  }
}

/**
 * Updates the free-coin timer and all buttons.
 *
 * NEW: Feeding buttons become disabled when
 * coins are insufficient or hatching is active.
 */
function updateButtons() {
  const elapsed = Date.now() - state.lastClaim;

  const remaining = Math.max(
    0,
    Math.ceil((COOLDOWN_MS - elapsed) / 1000)
  );

  ui.claimBtn.disabled = remaining > 0;

  ui.claimBtn.textContent = remaining > 0
    ? `⏳ Gather again in ${remaining}s`
    : "🪙 Gather 25 Coins";

  ui.claimHint.textContent = remaining > 0
    ? `Next free coins in ${remaining} seconds.`
    : "Gather free coins every 12 seconds.";

  ui.meadowBtn.disabled = isHatching;
  ui.moonBtn.disabled = isHatching;
  ui.resetBtn.disabled = isHatching;

  // Check the existing feed buttons.
  const feedButtons =
    ui.collection.querySelectorAll(".feed-button");

  for (const button of feedButtons) {
    const monsterId = button.dataset.monsterId;
    const progress = getTraining(monsterId);

    button.disabled =
      isHatching ||
      progress.level >= MAX_LEVEL ||
      state.coins < FEED_COST;
  }
}

// ========================================
// EGG HATCHING
// ========================================

/**
 * Purchases an egg, chooses a monster,
 * updates collection data and plays the animation.
 */
function startHatch(egg) {
  if (isHatching) return;

  if (state.coins < egg.cost) {
    setStatus("❌ Not enough coins! Gather more coins first.");
    return;
  }

  state.coins -= egg.cost;

  const rarity = rollRarity(egg.odds);
  const monster = pickMonster(rarity);

  const previousCount =
    state.collection[monster.id] || 0;

  const isDuplicate = previousCount > 0;

  state.collection[monster.id] = previousCount + 1;
  state.hatches += 1;

  const bonus = isDuplicate
    ? DUPLICATE_REWARDS[rarity]
    : 0;

  state.coins += bonus;

  // NEW: Fresh monsters begin at Level 1.
  // Duplicates keep the species' existing level.
  if (!state.training[monster.id]) {
    state.training[monster.id] = {
      level: 1,
      xp: 0
    };
  }

  // Save before the animation to protect progress.
  saveGame();

  isHatching = true;

  ui.egg.textContent = "🥚";
  ui.egg.classList.remove("revealed");
  ui.egg.classList.add("is-hatching");

  ui.result.textContent = "The egg is cracking...";

  setStatus(`✨ Your ${egg.name} is hatching!`);

  renderStats();
  updateButtons();

  window.setTimeout(() => {
    finishHatch(monster, isDuplicate, bonus);
  }, 1400);
}

/**
 * Reveals the monster after the egg animation.
 */
function finishHatch(monster, isDuplicate, bonus) {
  isHatching = false;

  ui.egg.classList.remove("is-hatching");
  ui.egg.classList.add("revealed");
  ui.egg.textContent = monster.emoji;

  const card = createMonsterCard(
    monster,
    state.collection[monster.id]
  );

  const message = document.createElement("p");

  if (isDuplicate) {
    message.textContent =
      `Duplicate monster! You earned ${bonus} bonus coins.`;

    setStatus(`🎁 Duplicate ${monster.name}!`);
  } else {
    message.textContent =
      "New monster discovered! Added to your encyclopedia.";

    setStatus(`🎉 You discovered ${monster.name}!`);
  }

  ui.result.replaceChildren(card, message);

  renderStats();
  renderCollection();
  updateButtons();
}

// ========================================
// FREE COINS
// ========================================

/**
 * Gives the player 25 coins if the
 * 12-second cooldown has finished.
 */
function claimCoins() {
  const now = Date.now();

  if (now - state.lastClaim < COOLDOWN_MS) {
    return;
  }

  state.coins += 25;
  state.lastClaim = now;

  saveGame();
  renderStats();
  updateButtons();

  setStatus("🪙 You gathered 25 free coins!");
}

// ========================================
// RESET PROGRESS
// ========================================

/**
 * Resets coins, collection and training.
 * The player must confirm the reset first.
 */
function resetProgress() {
  if (isHatching) return;

  const confirmed = window.confirm(
    "Reset your coins, monsters, levels and XP?"
  );

  if (!confirmed) return;

  state = createFreshGame();
  saveGame();

  ui.egg.textContent = "🥚";
  ui.egg.classList.remove("revealed");

  ui.result.textContent =
    "Your next monster will appear here.";

  setStatus("New adventure started!");

  renderStats();
  renderCollection();
  updateButtons();
}

// ========================================
// EVENT LISTENERS
// ========================================

// These connect the existing HTML buttons
// to the corresponding JavaScript functions.

ui.meadowBtn.addEventListener("click", () => {
  startHatch(EGGS.meadow);
});

ui.moonBtn.addEventListener("click", () => {
  startHatch(EGGS.moon);
});

ui.claimBtn.addEventListener("click", claimCoins);
ui.resetBtn.addEventListener("click", resetProgress);

// ========================================
// START THE GAME
// ========================================

// Load and display player progress.
renderStats();
renderCollection();
updateButtons();

// Update the free-coin cooldown once per second.
window.setInterval(updateButtons, 1000);

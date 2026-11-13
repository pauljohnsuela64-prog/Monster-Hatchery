
"use strict";

// ========================================
// MONSTER HATCHERY - PHASE 2B
// Collection improvements + existing gameplay
// ========================================

// 1. MONSTER DATABASE
// Every monster has a unique ID, name, emoji and rarity.
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

// 2. EGG TYPES AND PROBABILITIES
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

// 3. GAME CONFIGURATION
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

// Used to sort monsters from highest to lowest rarity.
const RARITY_RANK = {
  Common: 0,
  Rare: 1,
  Epic: 2,
  Legendary: 3,
  Mythic: 4
};

const FEED_COST = 15;
const FEED_XP = 20;
const MAX_LEVEL = 10;
const COOLDOWN_MS = 12000;

// Keep the exact same save key as v1 and Phase 2A.
// Changing this key would create a separate save.
const STORAGE_KEY = "monster-hatchery-save-v1";

// 4. FIND THE HTML ELEMENTS
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
  resetBtn: document.getElementById("resetBtn"),

  // NEW: Collection controls.
  collectionProgress: document.getElementById("collectionProgress"),
  collectionProgressLabel: document.getElementById("collectionProgressLabel"),
  rarityFilter: document.getElementById("rarityFilter"),
  sortBy: document.getElementById("sortBy"),
  favoritesOnly: document.getElementById("favoritesOnly"),
  collectionEmpty: document.getElementById("collectionEmpty"),

  // NEW: Monster details dialog.
  detailsDialog: document.getElementById("monsterDetails"),
  detailsTitle: document.getElementById("detailsTitle"),
  detailsBody: document.getElementById("detailsBody"),
  detailsClose: document.getElementById("detailsClose")
};

// Load existing saved progress.
let state = loadGame();

// Prevent overlapping hatch animations.
let isHatching = false;

// Tracks which monster is being viewed in the dialog.
let selectedMonsterId = null;

// ========================================
// SAVE AND LOAD SYSTEM
// ========================================

/**
 * Creates starting data for a new game.
 *
 * Phase 2B adds a favorites array.
 * An array is useful because a player may have
 * multiple favorite monster IDs.
 */
function createFreshGame() {
  return {
    coins: 200,
    hatches: 0,
    collection: {},
    training: {},
    favorites: [],
    lastClaim: 0
  };
}

/**
 * Returns the XP needed to reach the next level.
 */
function xpToNextLevel(level) {
  return level * 30;
}

/**
 * Cleans saved training information.
 *
 * Existing Phase 1 monsters without training
 * automatically use Level 1 and 0 XP.
 */
function sanitizeTraining(savedTraining, collection) {
  const cleanTraining = {};

  if (!savedTraining || typeof savedTraining !== "object") {
    return cleanTraining;
  }

  for (const monster of MONSTERS) {
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
 * NEW: Validates the favorites array.
 *
 * Only discovered monster IDs are accepted.
 * A Set removes duplicate entries automatically.
 *
 * Old saves have no favorites, so they return [].
 */
function sanitizeFavorites(savedFavorites, collection) {
  if (!Array.isArray(savedFavorites)) {
    return [];
  }

  const validIds = new Set(
    MONSTERS
      .filter(monster => collection[monster.id] > 0)
      .map(monster => monster.id)
  );

  return [...new Set(
    savedFavorites.filter(id => validIds.has(id))
  )];
}

/**
 * Loads a saved game from localStorage.
 *
 * This supports v1, Phase 2A and Phase 2B saves
 * without erasing existing collection progress.
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
    const savedCollection =
      saved.collection && typeof saved.collection === "object"
        ? saved.collection
        : {};

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

      training: sanitizeTraining(saved.training, collection),

      // NEW: Load favorites without affecting old data.
      favorites: sanitizeFavorites(saved.favorites, collection),

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
 * Saves coins, collection, training and favorites.
 */
function saveGame() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("Could not save game:", error);
  }
}

// ========================================
// MONSTER TRAINING (PHASE 2A)
// ========================================

/**
 * Gets the level and XP of a monster.
 * Monsters without training start at Level 1.
 */
function getTraining(monsterId) {
  return state.training[monsterId] || {
    level: 1,
    xp: 0
  };
}

/**
 * Calculates monster power from its rarity
 * and current training level.
 */
function getMonsterPower(monster) {
  const progress = getTraining(monster.id);

  return BASE_POWER[monster.rarity] +
    (progress.level - 1) * 3;
}

/**
 * Feeds an owned monster for 15 coins.
 * Grants 20 XP and processes level increases.
 */
function feedMonster(monsterId) {
  if (isHatching) return;

  const monster = MONSTERS.find(
    item => item.id === monsterId
  );

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

  state.coins -= FEED_COST;

  let level = current.level;
  let xp = current.xp + FEED_XP;

  while (level < MAX_LEVEL && xp >= xpToNextLevel(level)) {
    xp -= xpToNextLevel(level);
    level++;
  }

  if (level === MAX_LEVEL) {
    xp = 0;
  }

  state.training[monsterId] = { level, xp };
  saveGame();

  if (level > current.level) {
    setStatus(`🎉 ${monster.name} reached Level ${level}!`);
  } else {
    setStatus(`🍖 ${monster.name} gained ${FEED_XP} XP!`);
  }

  renderStats();
  renderCollection();
  updateButtons();

  // If the details popup shows this monster,
  // update its level and XP information too.
  if (
    ui.detailsDialog.open &&
    selectedMonsterId === monsterId
  ) {
    renderMonsterDetails(monster);
  }
}

/**
 * Creates the feed button, XP bar and power
 * display for a discovered monster.
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

  const xpBar = document.createElement("progress");
  xpBar.className = "xp-bar";
  xpBar.max = isMaxLevel ? 1 : xpToNextLevel(progress.level);
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

  // This button feeds the monster associated
  // with its particular encyclopedia card.
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
// RANDOM EGG HATCHING
// ========================================

/**
 * Uses weighted probability to select rarity.
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
 * Randomly selects a monster with the given rarity.
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
// PHASE 2B - FAVORITES
// ========================================

/**
 * Adds or removes a monster from favorites.
 *
 * includes() checks whether an ID is present.
 * filter() creates an array without that ID.
 * push() adds a new ID to the favorites array.
 */
function toggleFavorite(monsterId) {
  if (!state.collection[monsterId]) return;

  if (state.favorites.includes(monsterId)) {
    state.favorites = state.favorites.filter(
      id => id !== monsterId
    );
  } else {
    state.favorites.push(monsterId);
  }

  saveGame();
  renderCollection();

  const monster = MONSTERS.find(
    item => item.id === monsterId
  );

  if (monster && ui.detailsDialog.open) {
    if (selectedMonsterId === monsterId) {
      renderMonsterDetails(monster);
    }
  }
}

/**
 * Creates a Favorite button for one monster.
 *
 * aria-pressed tells assistive technology
 * whether the toggle is selected.
 */
function createFavoriteButton(monster) {
  const button = document.createElement("button");
  button.type = "button";

  const isFavorite = state.favorites.includes(monster.id);

  button.className = isFavorite
    ? "favorite-button is-favorite"
    : "favorite-button";

  button.textContent = isFavorite
    ? "★ Favorited"
    : "☆ Favorite";

  button.setAttribute("aria-pressed", String(isFavorite));
  button.setAttribute(
    "aria-label",
    `${isFavorite ? "Remove" : "Add"} ${monster.name} ${isFavorite ? "from" : "to"} favorites`
  );

  // Clicking the button toggles its saved state.
  button.addEventListener("click", () => {
    toggleFavorite(monster.id);
  });

  return button;
}

// ========================================
// PHASE 2B - MONSTER DETAILS
// ========================================

/**
 * Creates a label and value row.
 *
 * We use textContent rather than inserting
 * HTML strings, which keeps values as plain text.
 */
function createDetailRow(label, value) {
  const row = document.createElement("div");
  row.className = "details-row";

  const labelElement = document.createElement("span");
  labelElement.textContent = label;

  const valueElement = document.createElement("strong");
  valueElement.textContent = String(value);

  row.append(labelElement, valueElement);
  return row;
}

/**
 * Builds the contents of the monster details popup.
 */
function renderMonsterDetails(monster) {
  const progress = getTraining(monster.id);
  const isMaxLevel = progress.level >= MAX_LEVEL;
  const isFavorite = state.favorites.includes(monster.id);

  ui.detailsTitle.textContent = monster.name;
  ui.detailsBody.replaceChildren();

  const hero = document.createElement("div");
  hero.className = "details-hero";
  hero.textContent = monster.emoji;

  const stats = document.createElement("div");
  stats.className = "details-stats";

  stats.append(
    createDetailRow("Rarity", monster.rarity),
    createDetailRow("Owned", state.collection[monster.id] || 0),
    createDetailRow("Level", `${progress.level} / ${MAX_LEVEL}`),
    createDetailRow("Power", getMonsterPower(monster)),
    createDetailRow("Favorite", isFavorite ? "★ Yes" : "No")
  );

  const xpBar = document.createElement("progress");
  xpBar.className = "xp-bar details-xp";
  xpBar.max = isMaxLevel ? 1 : xpToNextLevel(progress.level);
  xpBar.value = isMaxLevel ? 1 : progress.xp;

  xpBar.setAttribute(
    "aria-label",
    `${monster.name} experience`
  );

  const xpLabel = document.createElement("p");
  xpLabel.className = "hint";
  xpLabel.textContent = isMaxLevel
    ? "⭐ Maximum level reached"
    : `Experience: ${progress.xp} / ${xpToNextLevel(progress.level)} XP`;

  ui.detailsBody.append(hero, stats, xpBar, xpLabel);
}

/**
 * Opens a popup with information about
 * a discovered monster.
 *
 * showModal() is part of the HTML dialog API.
 */
function openMonsterDetails(monsterId) {
  if (!state.collection[monsterId]) return;

  const monster = MONSTERS.find(
    item => item.id === monsterId
  );

  if (!monster) return;

  selectedMonsterId = monsterId;
  renderMonsterDetails(monster);

  if (!ui.detailsDialog.open) {
    ui.detailsDialog.showModal();
  }
}

/**
 * Creates the Details button for a monster card.
 */
function createDetailsButton(monster) {
  const button = document.createElement("button");

  button.type = "button";
  button.className = "details-button";
  button.textContent = "Details";

  button.setAttribute(
    "aria-label",
    `View details for ${monster.name}`
  );

  button.addEventListener("click", () => {
    openMonsterDetails(monster.id);
  });

  return button;
}

// ========================================
// PHASE 2B - FILTERING AND SORTING
// ========================================

/**
 * Gets monsters matching the selected filters,
 * then sorts them in the requested order.
 *
 * Undiscovered monsters remain visible in
 * the default All Monsters view, but their
 * rarities remain hidden until discovered.
 */
function getFilteredMonsters() {
  const rarity = ui.rarityFilter.value;
  const sortBy = ui.sortBy.value;
  const favoritesOnly = ui.favoritesOnly.checked;

  const filtered = MONSTERS.filter(monster => {
    const owned = (state.collection[monster.id] || 0) > 0;

    // A rarity filter shows discovered matches only.
    if (rarity !== "all") {
      if (!owned || monster.rarity !== rarity) {
        return false;
      }
    }

    // Favorites filter shows owned favorites only.
    if (
      favoritesOnly &&
      (!owned || !state.favorites.includes(monster.id))
    ) {
      return false;
    }

    return true;
  });

  // sort() compares two monsters at a time.
  filtered.sort((a, b) => {
    const originalOrder =
      MONSTERS.indexOf(a) - MONSTERS.indexOf(b);

    if (sortBy === "original") {
      return originalOrder;
    }

    const ownedA = (state.collection[a.id] || 0) > 0;
    const ownedB = (state.collection[b.id] || 0) > 0;

    // Put locked monsters after discovered monsters.
    if (ownedA !== ownedB) {
      return ownedA ? -1 : 1;
    }

    // Keep locked monster identities hidden.
    if (!ownedA && !ownedB) {
      return originalOrder;
    }

    if (sortBy === "name") {
      return a.name.localeCompare(b.name);
    }

    if (sortBy === "rarity") {
      return (
        RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity] ||
        a.name.localeCompare(b.name)
      );
    }

    if (sortBy === "level") {
      return (
        getTraining(b.id).level - getTraining(a.id).level ||
        a.name.localeCompare(b.name)
      );
    }

    if (sortBy === "power") {
      return (
        getMonsterPower(b) - getMonsterPower(a) ||
        a.name.localeCompare(b.name)
      );
    }

    return originalOrder;
  });

  return filtered;
}

// ========================================
// USER INTERFACE
// ========================================

/**
 * Updates the message below the hatching station.
 */
function setStatus(message) {
  ui.status.textContent = message;
}

/**
 * Creates the standard monster card.
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
 * Creates a hidden card for an undiscovered monster.
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
 * Updates player statistics and the new
 * collection completion progress bar.
 */
function renderStats() {
  ui.coins.textContent = state.coins;
  ui.hatches.textContent = state.hatches;

  const discovered = MONSTERS.filter(
    monster => (state.collection[monster.id] || 0) > 0
  ).length;

  const total = MONSTERS.length;
  const percent = Math.round((discovered / total) * 100);

  ui.discovered.textContent = `${discovered} / ${total}`;

  // NEW: Update collection progress.
  ui.collectionProgress.max = total;
  ui.collectionProgress.value = discovered;

  ui.collectionProgressLabel.textContent =
    `${discovered} / ${total} · ${percent}%`;
}

/**
 * Builds the encyclopedia using the selected
 * filters and sorting options.
 *
 * Owned monsters receive Favorite, Details
 * and Feeding controls.
 */
function renderCollection() {
  ui.collection.replaceChildren();

  const visibleMonsters = getFilteredMonsters();

  // NEW: Show an empty message when nothing matches.
  ui.collectionEmpty.hidden = visibleMonsters.length > 0;

  for (const monster of visibleMonsters) {
    const count = state.collection[monster.id] || 0;

    if (count === 0) {
      ui.collection.append(createLockedCard());
      continue;
    }

    const card = createMonsterCard(monster, count);

    const actions = document.createElement("div");
    actions.className = "card-actions";

    actions.append(
      createFavoriteButton(monster),
      createDetailsButton(monster)
    );

    card.append(
      actions,
      createTrainingControls(monster)
    );

    ui.collection.append(card);
  }
}

/**
 * Refreshes the free-coin countdown and
 * feeding button availability.
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

  // Recheck the currently displayed feeding buttons.
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
// EGG HATCHING - EXISTING GAMEPLAY
// ========================================

/**
 * Spends coins, selects a monster, awards
 * duplicate bonuses and begins the animation.
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
  state.hatches++;

  const bonus = isDuplicate
    ? DUPLICATE_REWARDS[rarity]
    : 0;

  state.coins += bonus;

  // New species start at Level 1.
  // Duplicates keep their existing training data.
  if (!state.training[monster.id]) {
    state.training[monster.id] = {
      level: 1,
      xp: 0
    };
  }

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
 * Finishes the egg animation and displays
 * the newly hatched monster.
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

  // Refresh an open details popup after hatching.
  if (ui.detailsDialog.open && selectedMonsterId) {
    const selected = MONSTERS.find(
      item => item.id === selectedMonsterId
    );

    if (selected) {
      renderMonsterDetails(selected);
    }
  }
}

// ========================================
// COIN COLLECTION
// ========================================

/**
 * Awards 25 coins if the 12-second
 * collection cooldown has finished.
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
// RESET GAME
// ========================================

/**
 * Asks for confirmation before resetting
 * coins, collection, training and favorites.
 */
function resetProgress() {
  if (isHatching) return;

  const confirmed = window.confirm(
    "Reset coins, monsters, levels and favorites?"
  );

  if (!confirmed) return;

  state = createFreshGame();
  saveGame();

  // Reset all the collection view controls too.
  ui.rarityFilter.value = "all";
  ui.sortBy.value = "original";
  ui.favoritesOnly.checked = false;

  if (ui.detailsDialog.open) {
    ui.detailsDialog.close();
  }

  selectedMonsterId = null;

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
// BUTTON AND INPUT EVENT LISTENERS
// ========================================

// Existing egg purchase buttons.
ui.meadowBtn.addEventListener("click", () => {
  startHatch(EGGS.meadow);
});

ui.moonBtn.addEventListener("click", () => {
  startHatch(EGGS.moon);
});

// Existing coin collection and reset buttons.
ui.claimBtn.addEventListener("click", claimCoins);
ui.resetBtn.addEventListener("click", resetProgress);

// NEW: Filter and sorting dropdowns.
// The change event runs after the player picks
// a different option.
ui.rarityFilter.addEventListener("change", renderCollection);
ui.sortBy.addEventListener("change", renderCollection);

// NEW: Toggle between all monsters and favorites.
ui.favoritesOnly.addEventListener("change", renderCollection);

// NEW: Close the monster information popup.
ui.detailsClose.addEventListener("click", () => {
  ui.detailsDialog.close();
});

// Clear the selected monster when the popup closes.
ui.detailsDialog.addEventListener("close", () => {
  selectedMonsterId = null;
});

// ========================================
// INITIALIZE THE GAME
// ========================================

// Display saved coins, collection and levels.
renderStats();
renderCollection();
updateButtons();

// Refresh the coin cooldown once per second.
window.setInterval(updateButtons, 1000);

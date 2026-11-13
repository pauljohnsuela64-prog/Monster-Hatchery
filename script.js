
"use strict";

// ========================================
// MONSTER HATCHERY - PHASE 2C
// Complete game with achievements & rewards
// ========================================

// MONSTER DATABASE
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

// EGG PRICES AND DROP CHANCES
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

// GAME SETTINGS
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

// IMPORTANT: Preserve the old save key.
const STORAGE_KEY = "monster-hatchery-save-v1";

// ========================================
// NEW: ACHIEVEMENT DATABASE
// ========================================

// Each achievement describes:
// id: unique identifier used for saving
// name: title displayed to the player
// icon: decorative emoji
// description: requirement
// metric: which statistic we must check
// target: required amount
// reward: coins earned when claimed

const ACHIEVEMENTS = [
  {
    id: "first-hatch",
    name: "First Hatch",
    icon: "🥚",
    description: "Hatch your first egg.",
    metric: "hatches",
    target: 1,
    reward: 50
  },
  {
    id: "egg-collector",
    name: "Egg Collector",
    icon: "🐣",
    description: "Hatch 10 eggs.",
    metric: "hatches",
    target: 10,
    reward: 100
  },
  {
    id: "hatch-master",
    name: "Hatch Master",
    icon: "🏆",
    description: "Hatch 50 eggs.",
    metric: "hatches",
    target: 50,
    reward: 500
  },
  {
    id: "monster-hunter",
    name: "Monster Hunter",
    icon: "📖",
    description: "Discover 5 different monsters.",
    metric: "discovered",
    target: 5,
    reward: 150
  },
  {
    id: "legendary-hunter",
    name: "Legendary Hunter",
    icon: "🐉",
    description: "Discover a Legendary monster.",
    metric: "legendary",
    target: 1,
    reward: 200
  },
  {
    id: "mythic-discovery",
    name: "Mythic Discovery",
    icon: "🌌",
    description: "Discover a Mythic monster.",
    metric: "mythic",
    target: 1,
    reward: 500
  },
  {
    id: "first-level-up",
    name: "First Level Up",
    icon: "🍖",
    description: "Train a monster to Level 2.",
    metric: "level2",
    target: 1,
    reward: 75
  },
  {
    id: "master-trainer",
    name: "Master Trainer",
    icon: "⭐",
    description: "Train a monster to Level 10.",
    metric: "level10",
    target: 1,
    reward: 300
  },
  {
    id: "collection-master",
    name: "Collection Master",
    icon: "👑",
    description: "Discover all 13 monsters.",
    metric: "discovered",
    target: 13,
    reward: 1000
  }
];

// ========================================
// HTML ELEMENT REFERENCES
// ========================================

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

  collectionProgress: document.getElementById("collectionProgress"),
  collectionProgressLabel: document.getElementById("collectionProgressLabel"),
  rarityFilter: document.getElementById("rarityFilter"),
  sortBy: document.getElementById("sortBy"),
  favoritesOnly: document.getElementById("favoritesOnly"),
  collectionEmpty: document.getElementById("collectionEmpty"),

  detailsDialog: document.getElementById("monsterDetails"),
  detailsTitle: document.getElementById("detailsTitle"),
  detailsBody: document.getElementById("detailsBody"),
  detailsClose: document.getElementById("detailsClose"),

  // NEW: Phase 2C elements
  achievementsList: document.getElementById("achievementsList"),
  achievementCount: document.getElementById("achievementCount"),
  achievementReady: document.getElementById("achievementReady"),
  achievementToast: document.getElementById("achievementToast")
};

let state = loadGame();
let isHatching = false;
let selectedMonsterId = null;

// Stores the achievements already recognized as unlocked.
// This prevents repeated notifications.
let previouslyUnlocked = new Set();

// Used to control how long notifications appear.
let toastTimer = null;

// ========================================
// SAVE AND LOAD SYSTEM
// ========================================

/**
 * Creates the default state for new players.
 * NEW: claimedAchievements records collected rewards.
 */
function createFreshGame() {
  return {
    coins: 200,
    hatches: 0,
    collection: {},
    training: {},
    favorites: [],
    claimedAchievements: [],
    lastClaim: 0
  };
}

/**
 * Calculates the XP needed to reach the next level.
 */
function xpToNextLevel(level) {
  return level * 30;
}

/**
 * Validates saved monster levels and XP.
 */
function sanitizeTraining(savedTraining, collection) {
  const cleaned = {};

  if (!savedTraining || typeof savedTraining !== "object") {
    return cleaned;
  }

  for (const monster of MONSTERS) {
    if (!collection[monster.id]) continue;

    const progress = savedTraining[monster.id];

    if (!progress || typeof progress !== "object") {
      continue;
    }

    const { level, xp } = progress;

    if (
      !Number.isSafeInteger(level) ||
      level < 1 ||
      level > MAX_LEVEL ||
      !Number.isSafeInteger(xp) ||
      xp < 0
    ) {
      continue;
    }

    cleaned[monster.id] = {
      level,
      xp: level === MAX_LEVEL
        ? 0
        : Math.min(xp, xpToNextLevel(level) - 1)
    };
  }

  return cleaned;
}

/**
 * Accepts only valid, discovered favorite monster IDs.
 */
function sanitizeFavorites(savedFavorites, collection) {
  if (!Array.isArray(savedFavorites)) return [];

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
 * NEW: Validates saved achievement claims.
 *
 * Only real achievement IDs are accepted.
 * Set removes duplicate IDs.
 *
 * Old v1 and Phase 2A/2B saves simply return [].
 */
function sanitizeClaimedAchievements(savedClaims) {
  if (!Array.isArray(savedClaims)) {
    return [];
  }

  const validIds = new Set(
    ACHIEVEMENTS.map(achievement => achievement.id)
  );

  return [...new Set(
    savedClaims.filter(id => validIds.has(id))
  )];
}

/**
 * Loads existing game progress.
 *
 * The additional claimedAchievements property
 * is optional for older saved games.
 */
function loadGame() {
  try {
    const savedText = localStorage.getItem(STORAGE_KEY);

    if (!savedText) return createFreshGame();

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

      favorites: sanitizeFavorites(saved.favorites, collection),

      // NEW: Automatically handles old saves.
      claimedAchievements:
        sanitizeClaimedAchievements(saved.claimedAchievements),

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
 * Saves every part of the game in browser storage.
 */
function saveGame() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(state)
    );
  } catch (error) {
    console.warn("Could not save game:", error);
  }
}

// ========================================
// MONSTER TRAINING
// ========================================

/**
 * Gets an owned monster's training progress.
 * Untrained species start at Level 1, 0 XP.
 */
function getTraining(monsterId) {
  return state.training[monsterId] || {
    level: 1,
    xp: 0
  };
}

/**
 * Calculates monster power using rarity and level.
 */
function getMonsterPower(monster) {
  const progress = getTraining(monster.id);

  return BASE_POWER[monster.rarity] +
    (progress.level - 1) * 3;
}

/**
 * Feeds one species for 15 coins and grants 20 XP.
 * NEW: Checks whether training unlocks achievements.
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

  if (level === MAX_LEVEL) xp = 0;

  state.training[monsterId] = { level, xp };
  saveGame();

  if (level > current.level) {
    setStatus(`🎉 ${monster.name} reached Level ${level}!`);
  } else {
    setStatus(`🍖 ${monster.name} gained ${FEED_XP} XP!`);
  }

  renderStats();
  renderCollection();

  // NEW: Check First Level Up and Master Trainer.
  renderAchievements(true);

  updateButtons();

  if (
    ui.detailsDialog.open &&
    selectedMonsterId === monsterId
  ) {
    renderMonsterDetails(monster);
  }
}

/**
 * Creates the monster's level, power, XP bar,
 * and feeding button inside its collection card.
 */
function createTrainingControls(monster) {
  const progress = getTraining(monster.id);
  const maxed = progress.level >= MAX_LEVEL;

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
  xpBar.max = maxed ? 1 : xpToNextLevel(progress.level);
  xpBar.value = maxed ? 1 : progress.xp;

  xpBar.setAttribute(
    "aria-label",
    `${monster.name} experience progress`
  );

  const xpText = document.createElement("small");
  xpText.className = "xp-label";
  xpText.textContent = maxed
    ? "MAX LEVEL"
    : `${progress.xp} / ${xpToNextLevel(progress.level)} XP`;

  const feedButton = document.createElement("button");
  feedButton.type = "button";
  feedButton.className = "feed-button";
  feedButton.dataset.monsterId = monster.id;

  feedButton.textContent = maxed
    ? "⭐ Max Level"
    : `🍖 Feed · ${FEED_COST} Coins`;

  feedButton.disabled =
    isHatching || maxed || state.coins < FEED_COST;

  feedButton.addEventListener("click", () => {
    feedMonster(monster.id);
  });

  container.append(
    levelText, powerText, xpBar, xpText, feedButton
  );

  return container;
}

// ========================================
// EGG RANDOMIZATION
// ========================================

/**
 * Chooses a rarity using its probability percentage.
 */
function rollRarity(odds) {
  let roll = Math.random() * 100;

  for (const [rarity, chance] of Object.entries(odds)) {
    roll -= chance;

    if (roll < 0) return rarity;
  }

  return "Common";
}

/**
 * Randomly chooses one monster from the selected rarity.
 */
function pickMonster(rarity) {
  const possible = MONSTERS.filter(
    monster => monster.rarity === rarity
  );

  const index = Math.floor(Math.random() * possible.length);

  return possible[index];
}

// ========================================
// COLLECTION FAVORITES
// ========================================

/**
 * Adds or removes a discovered monster's favorite ID.
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

  if (
    ui.detailsDialog.open &&
    selectedMonsterId === monsterId
  ) {
    const monster = MONSTERS.find(
      item => item.id === monsterId
    );

    if (monster) renderMonsterDetails(monster);
  }
}

/**
 * Creates a star button for favoriting a monster.
 */
function createFavoriteButton(monster) {
  const button = document.createElement("button");
  button.type = "button";

  const favorite = state.favorites.includes(monster.id);

  button.className = favorite
    ? "favorite-button is-favorite"
    : "favorite-button";

  button.textContent = favorite
    ? "★ Favorited"
    : "☆ Favorite";

  button.setAttribute("aria-pressed", String(favorite));

  button.setAttribute(
    "aria-label",
    `${favorite ? "Remove" : "Add"} ${monster.name} ${favorite ? "from" : "to"} favorites`
  );

  button.addEventListener("click", () => {
    toggleFavorite(monster.id);
  });

  return button;
}

// ========================================
// COLLECTION MONSTER DETAILS
// ========================================

/**
 * Creates one label/value pair in the details dialog.
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
 * Fills the popup with monster stats and XP progress.
 */
function renderMonsterDetails(monster) {
  const progress = getTraining(monster.id);
  const maxed = progress.level >= MAX_LEVEL;

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
    createDetailRow(
      "Favorite",
      state.favorites.includes(monster.id) ? "★ Yes" : "No"
    )
  );

  const xpBar = document.createElement("progress");
  xpBar.className = "xp-bar details-xp";
  xpBar.max = maxed ? 1 : xpToNextLevel(progress.level);
  xpBar.value = maxed ? 1 : progress.xp;

  xpBar.setAttribute(
    "aria-label",
    `${monster.name} experience`
  );

  const xpText = document.createElement("p");
  xpText.className = "hint";
  xpText.textContent = maxed
    ? "⭐ Maximum level reached"
    : `Experience: ${progress.xp} / ${xpToNextLevel(progress.level)} XP`;

  ui.detailsBody.append(hero, stats, xpBar, xpText);
}

/**
 * Opens the details modal for a discovered monster.
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
// COLLECTION FILTERING AND SORTING
// ========================================

/**
 * Filters the collection by rarity and favorites.
 * Sorts owned monsters while hiding locked identities.
 */
function getFilteredMonsters() {
  const rarity = ui.rarityFilter.value;
  const sortBy = ui.sortBy.value;
  const favoritesOnly = ui.favoritesOnly.checked;

  const filtered = MONSTERS.filter(monster => {
    const owned = (state.collection[monster.id] || 0) > 0;

    if (rarity !== "all") {
      if (!owned || monster.rarity !== rarity) return false;
    }

    if (
      favoritesOnly &&
      (!owned || !state.favorites.includes(monster.id))
    ) {
      return false;
    }

    return true;
  });

  filtered.sort((a, b) => {
    const original =
      MONSTERS.indexOf(a) - MONSTERS.indexOf(b);

    if (sortBy === "original") return original;

    const ownedA = (state.collection[a.id] || 0) > 0;
    const ownedB = (state.collection[b.id] || 0) > 0;

    if (ownedA !== ownedB) return ownedA ? -1 : 1;

    if (!ownedA && !ownedB) return original;

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

    return original;
  });

  return filtered;
}

// ========================================
// NEW: ACHIEVEMENT PROGRESS
// ========================================

/**
 * Calculates the player's current progress
 * toward one particular achievement.
 *
 * This reads existing game statistics,
 * so old progress automatically counts.
 *
 * For example:
 * metric "hatches" reads state.hatches.
 * metric "legendary" counts unique
 * discovered Legendary species.
 */
function getAchievementProgress(achievement) {
  const discoveredMonsters = MONSTERS.filter(
    monster => (state.collection[monster.id] || 0) > 0
  );

  switch (achievement.metric) {
    case "hatches":
      return state.hatches;

    case "discovered":
      return discoveredMonsters.length;

    case "legendary":
      return discoveredMonsters.filter(
        monster => monster.rarity === "Legendary"
      ).length;

    case "mythic":
      return discoveredMonsters.filter(
        monster => monster.rarity === "Mythic"
      ).length;

    case "level2":
      return discoveredMonsters.filter(
        monster => getTraining(monster.id).level >= 2
      ).length;

    case "level10":
      return discoveredMonsters.filter(
        monster => getTraining(monster.id).level >= 10
      ).length;

    default:
      return 0;
  }
}

/**
 * Checks whether an achievement's requirement
 * has already been completed.
 */
function isAchievementUnlocked(achievement) {
  return getAchievementProgress(achievement) >=
    achievement.target;
}

// ========================================
// NEW: CLAIM ACHIEVEMENT REWARDS
// ========================================

/**
 * Awards an achievement's coins exactly once.
 *
 * Important checks:
 * 1. The achievement must exist.
 * 2. Its requirement must be complete.
 * 3. It must not have been claimed before.
 *
 * We save the coins and claim record together.
 */
function claimAchievement(achievementId) {
  if (isHatching) return;

  const achievement = ACHIEVEMENTS.find(
    item => item.id === achievementId
  );

  if (!achievement) return;

  if (!isAchievementUnlocked(achievement)) return;

  if (state.claimedAchievements.includes(achievementId)) {
    return;
  }

  // Both changes happen in the same game state.
  state.coins += achievement.reward;
  state.claimedAchievements.push(achievementId);

  saveGame();

  renderStats();
  renderCollection();
  renderAchievements();
  updateButtons();

  setStatus(
    `🏆 ${achievement.name} claimed! +${achievement.reward} coins!`
  );
}

// ========================================
// NEW: ACHIEVEMENT CARDS
// ========================================

/**
 * Creates one achievement card with:
 * - Icon and requirement
 * - Progress bar
 * - Reward amount
 * - Claim button
 *
 * We use document.createElement so the
 * content is safely inserted as text.
 */
function createAchievementCard(achievement) {
  const progress = getAchievementProgress(achievement);
  const unlocked = progress >= achievement.target;

  const claimed = state.claimedAchievements.includes(
    achievement.id
  );

  const card = document.createElement("article");

  card.className = "achievement-card";

  if (unlocked) card.classList.add("unlocked");
  if (claimed) card.classList.add("claimed");

  const top = document.createElement("div");
  top.className = "achievement-top";

  const icon = document.createElement("span");
  icon.className = "achievement-icon";
  icon.textContent = achievement.icon;

  const info = document.createElement("div");
  info.className = "achievement-info";

  const title = document.createElement("h3");
  title.textContent = achievement.name;

  const description = document.createElement("p");
  description.textContent = achievement.description;

  info.append(title, description);
  top.append(icon, info);

  const status = document.createElement("div");
  status.className = "achievement-status";

  status.textContent = claimed
    ? "✅ Reward Claimed"
    : unlocked
      ? "✨ Ready to Claim"
      : "🔒 In Progress";

  const progressBar = document.createElement("progress");
  progressBar.className = "achievement-progress";

  progressBar.max = achievement.target;
  progressBar.value = Math.min(
    progress,
    achievement.target
  );

  progressBar.setAttribute(
    "aria-label",
    `${achievement.name} achievement progress`
  );

  const progressText = document.createElement("div");
  progressText.className = "achievement-progress-text";

  progressText.textContent =
    `${Math.min(progress, achievement.target)} / ${achievement.target}`;

  const reward = document.createElement("div");
  reward.className = "achievement-reward";
  reward.textContent = `🪙 Reward: ${achievement.reward} Coins`;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "achievement-claim";
  button.dataset.achievementId = achievement.id;

  button.textContent = claimed
    ? "✅ Claimed"
    : unlocked
      ? "🎁 Claim Reward"
      : "🔒 Locked";

  button.disabled =
    claimed || !unlocked || isHatching;

  // This listener claims only this card's reward.
  button.addEventListener("click", () => {
    claimAchievement(achievement.id);
  });

  card.append(
    top,
    status,
    progressBar,
    progressText,
    reward,
    button
  );

  return card;
}

// ========================================
// NEW: ACHIEVEMENT NOTIFICATIONS
// ========================================

/**
 * Shows a temporary message near the
 * bottom of the player's screen.
 *
 * clearTimeout prevents an older timer
 * from hiding a newer notification.
 */
function showAchievementToast(message) {
  if (toastTimer !== null) {
    window.clearTimeout(toastTimer);
  }

  ui.achievementToast.textContent = message;
  ui.achievementToast.hidden = false;

  toastTimer = window.setTimeout(() => {
    ui.achievementToast.hidden = true;
    toastTimer = null;
  }, 4000);
}

/**
 * Rebuilds the achievement section.
 *
 * announceNew controls whether to display
 * notifications for newly completed goals.
 *
 * On game startup, announceNew is false:
 * old progress becomes claimable without
 * flooding the screen with notifications.
 */
function renderAchievements(announceNew = false) {
  ui.achievementsList.replaceChildren();

  const unlockedAchievements = ACHIEVEMENTS.filter(
    isAchievementUnlocked
  );

  const unlockedIds = new Set(
    unlockedAchievements.map(item => item.id)
  );

  const newlyUnlocked = unlockedAchievements.filter(
    item => !previouslyUnlocked.has(item.id)
  );

  // Build every achievement card.
  for (const achievement of ACHIEVEMENTS) {
    ui.achievementsList.append(
      createAchievementCard(achievement)
    );
  }

  const readyCount = unlockedAchievements.filter(
    item => !state.claimedAchievements.includes(item.id)
  ).length;

  ui.achievementCount.textContent =
    `${unlockedAchievements.length} / ${ACHIEVEMENTS.length} Unlocked`;

  ui.achievementReady.textContent =
    readyCount === 0
      ? "No rewards waiting"
      : `${readyCount} reward${readyCount === 1 ? "" : "s"} ready to claim`;

  // Save the unlocked IDs for the next comparison.
  previouslyUnlocked = unlockedIds;

  if (announceNew && newlyUnlocked.length > 0) {
    const message = newlyUnlocked.length === 1
      ? `🏆 Achievement Unlocked: ${newlyUnlocked[0].name}!`
      : `🏆 ${newlyUnlocked.length} achievements unlocked!`;

    showAchievementToast(message);
  }
}

// ========================================
// GENERAL USER INTERFACE
// ========================================

/**
 * Displays a message below the egg.
 */
function setStatus(message) {
  ui.status.textContent = message;
}

/**
 * Creates a card for a discovered monster.
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

  const countText = document.createElement("small");
  countText.textContent = `Owned: ${count}`;

  card.append(emoji, name, rarity, countText);
  return card;
}

/**
 * Creates a hidden card for an unknown monster.
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
 * Updates the coin balance, hatches,
 * discovery count and collection progress.
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

  ui.collectionProgress.max = total;
  ui.collectionProgress.value = discovered;

  ui.collectionProgressLabel.textContent =
    `${discovered} / ${total} · ${percent}%`;
}

/**
 * Rebuilds the filtered encyclopedia.
 */
function renderCollection() {
  ui.collection.replaceChildren();

  const monsters = getFilteredMonsters();

  ui.collectionEmpty.hidden = monsters.length > 0;

  for (const monster of monsters) {
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
 * Updates free-coin cooldown and buttons.
 *
 * NEW: Achievement claim buttons are also
 * disabled during egg hatching.
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

  // Refresh all monster feeding buttons.
  const feedButtons =
    ui.collection.querySelectorAll(".feed-button");

  for (const button of feedButtons) {
    const progress = getTraining(button.dataset.monsterId);

    button.disabled =
      isHatching ||
      progress.level >= MAX_LEVEL ||
      state.coins < FEED_COST;
  }

  // NEW: Refresh all achievement claim buttons.
  const claimButtons =
    ui.achievementsList.querySelectorAll(".achievement-claim");

  for (const button of claimButtons) {
    const achievement = ACHIEVEMENTS.find(
      item => item.id === button.dataset.achievementId
    );

    button.disabled =
      isHatching ||
      !achievement ||
      !isAchievementUnlocked(achievement) ||
      state.claimedAchievements.includes(achievement.id);
  }
}

// ========================================
// EGG HATCHING
// ========================================

/**
 * Purchases an egg, selects a monster,
 * awards duplicates and starts the animation.
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

  const previousCount = state.collection[monster.id] || 0;
  const duplicate = previousCount > 0;

  state.collection[monster.id] = previousCount + 1;
  state.hatches++;

  const bonus = duplicate
    ? DUPLICATE_REWARDS[rarity]
    : 0;

  state.coins += bonus;

  if (!state.training[monster.id]) {
    state.training[monster.id] = {
      level: 1,
      xp: 0
    };
  }

  // Persist the outcome before animation begins.
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
    finishHatch(monster, duplicate, bonus);
  }, 1400);
}

/**
 * Reveals a hatched monster.
 *
 * NEW: Checks achievement progress after
 * the hatching animation finishes.
 */
function finishHatch(monster, duplicate, bonus) {
  isHatching = false;

  ui.egg.classList.remove("is-hatching");
  ui.egg.classList.add("revealed");
  ui.egg.textContent = monster.emoji;

  const card = createMonsterCard(
    monster,
    state.collection[monster.id]
  );

  const message = document.createElement("p");

  if (duplicate) {
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

  // NEW: Unlock achievements caused by this hatch.
  renderAchievements(true);

  updateButtons();

  if (ui.detailsDialog.open && selectedMonsterId) {
    const selected = MONSTERS.find(
      item => item.id === selectedMonsterId
    );

    if (selected) renderMonsterDetails(selected);
  }
}

// ========================================
// FREE COINS
// ========================================

/**
 * Awards 25 coins after the cooldown expires.
 */
function claimCoins() {
  const now = Date.now();

  if (now - state.lastClaim < COOLDOWN_MS) return;

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
 * Resets all progress after player confirmation.
 *
 * NEW: Achievement claims reset as well.
 */
function resetProgress() {
  if (isHatching) return;

  const confirmed = window.confirm(
    "Reset coins, monsters, levels, favorites and achievements?"
  );

  if (!confirmed) return;

  state = createFreshGame();
  saveGame();

  ui.rarityFilter.value = "all";
  ui.sortBy.value = "original";
  ui.favoritesOnly.checked = false;

  if (ui.detailsDialog.open) {
    ui.detailsDialog.close();
  }

  selectedMonsterId = null;

  if (toastTimer !== null) {
    window.clearTimeout(toastTimer);
    toastTimer = null;
  }

  ui.achievementToast.hidden = true;

  ui.egg.textContent = "🥚";
  ui.egg.classList.remove("revealed");

  ui.result.textContent =
    "Your next monster will appear here.";

  setStatus("New adventure started!");

  renderStats();
  renderCollection();
  renderAchievements();
  updateButtons();
}

// ========================================
// EVENT LISTENERS
// ========================================

// Purchase Meadow Egg.
ui.meadowBtn.addEventListener("click", () => {
  startHatch(EGGS.meadow);
});

// Purchase Moon Egg.
ui.moonBtn.addEventListener("click", () => {
  startHatch(EGGS.moon);
});

// Gather coins and reset game.
ui.claimBtn.addEventListener("click", claimCoins);
ui.resetBtn.addEventListener("click", resetProgress);

// Collection filters and sorting.
ui.rarityFilter.addEventListener("change", renderCollection);
ui.sortBy.addEventListener("change", renderCollection);
ui.favoritesOnly.addEventListener("change", renderCollection);

// Monster details popup controls.
ui.detailsClose.addEventListener("click", () => {
  ui.detailsDialog.close();
});

ui.detailsDialog.addEventListener("close", () => {
  selectedMonsterId = null;
});

// ========================================
// START THE GAME
// ========================================

// Render the saved game.
renderStats();
renderCollection();

// NEW: Recognize existing achievements silently.
renderAchievements();

// Enable controls and start the cooldown timer.
updateButtons();
window.setInterval(updateButtons, 1000);


// ========================================
// 1. GAME SETTINGS
// ========================================

// These are the 13 monsters players can discover.
// Each monster is stored as a JavaScript object.
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

// Egg prices and rarity probabilities.
// The five percentages for each egg add up to 100.
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

// Coins rewarded for duplicate monsters.
const DUPLICATE_REWARDS = {
  Common: 10,
  Rare: 20,
  Epic: 40,
  Legendary: 80,
  Mythic: 150
};

const STORAGE_KEY = "monster-hatchery-save-v1";
const COOLDOWN_MS = 12000;

// ========================================
// 2. CONNECT HTML TO JAVASCRIPT
// ========================================

// document.getElementById finds an HTML element.
// We store references so we can update them later.
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

// Load saved progress, or start a new game.
let state = loadGame();

// This prevents two eggs from hatching simultaneously.
let isHatching = false;

// ========================================
// 3. SAVING AND LOADING
// ========================================

/**
 * Creates the starting data for a new player.
 * The player receives 200 coins and no monsters.
 */
function createFreshGame() {
  return {
    coins: 200,
    hatches: 0,
    collection: {},
    lastClaim: 0
  };
}

/**
 * Reads previously saved data from localStorage.
 * If no valid save exists, it creates a fresh game.
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

    // Only accept positive, whole-number monster counts.
    const collection = {};
    const savedCollection = saved.collection || {};

    for (const monster of MONSTERS) {
      const count = Number(savedCollection[monster.id]);

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

      lastClaim:
        Number.isFinite(saved.lastClaim) && saved.lastClaim >= 0
          ? saved.lastClaim
          : 0
    };
  } catch (error) {
    console.warn("Could not load game:", error);
    return createFreshGame();
  }
}

/**
 * Converts the current game data to JSON and saves it.
 * This lets progress survive page refreshes.
 */
function saveGame() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("Could not save game:", error);
  }
}

// ========================================
// 4. RANDOM MONSTER GENERATION
// ========================================

/**
 * Chooses a rarity using the egg's probabilities.
 *
 * Example:
 * A 55% Common chance means that roughly 55 out
 * of every 100 rolls will be Common over many rolls.
 */
function rollRarity(odds) {
  let roll = Math.random() * 100;

  for (const [rarity, chance] of Object.entries(odds)) {
    roll -= chance;

    if (roll < 0) {
      return rarity;
    }
  }

  // Safety fallback in case the percentages are wrong.
  return "Common";
}

/**
 * Finds all monsters belonging to a particular rarity.
 * Then randomly selects one from that group.
 */
function pickMonster(rarity) {
  const possibleMonsters = MONSTERS.filter(
    monster => monster.rarity === rarity
  );

  const randomIndex = Math.floor(
    Math.random() * possibleMonsters.length
  );

  return possibleMonsters[randomIndex];
}

// ========================================
// 5. USER INTERFACE
// ========================================

/**
 * Changes the message underneath the egg.
 */
function setStatus(message) {
  ui.status.textContent = message;
}

/**
 * Creates one monster card.
 * The card contains an emoji, name, rarity and count.
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
 * Creates a mystery card for a monster not yet found.
 * This hides the monster until the player discovers it.
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
 * Updates the coin counter and player statistics.
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
 * Rebuilds the encyclopedia based on saved collection data.
 * Unlocked monsters show their cards.
 * Undiscovered monsters show question marks.
 */
function renderCollection() {
  ui.collection.replaceChildren();

  for (const monster of MONSTERS) {
    const count = state.collection[monster.id] || 0;

    if (count > 0) {
      ui.collection.append(
        createMonsterCard(monster, count)
      );
    } else {
      ui.collection.append(createLockedCard());
    }
  }
}

/**
 * Updates button states and the free-coin countdown.
 * Date.now() provides the current time in milliseconds.
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

  // Stop extra hatches and resets during the animation.
  ui.meadowBtn.disabled = isHatching;
  ui.moonBtn.disabled = isHatching;
  ui.resetBtn.disabled = isHatching;
}

// ========================================
// 6. EGG HATCHING
// ========================================

/**
 * Starts a hatch when the player purchases an egg.
 *
 * 1. Check whether the player has enough coins.
 * 2. Deduct the egg price.
 * 3. Select a random monster.
 * 4. Give duplicate rewards when appropriate.
 * 5. Save the result.
 * 6. Play the egg animation.
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
  const isDuplicate = previousCount > 0;

  state.collection[monster.id] = previousCount + 1;
  state.hatches += 1;

  const bonus = isDuplicate
    ? DUPLICATE_REWARDS[rarity]
    : 0;

  state.coins += bonus;

  // Save immediately, so refreshing mid-animation
  // will not erase the monster the player received.
  saveGame();

  isHatching = true;

  ui.egg.textContent = "🥚";
  ui.egg.classList.remove("revealed");
  ui.egg.classList.add("is-hatching");

  ui.result.textContent = "The egg is cracking...";

  setStatus(`✨ Your ${egg.name} is hatching!`);

  renderStats();
  updateButtons();

  // The callback runs after 1.4 seconds.
  window.setTimeout(() => {
    finishHatch(monster, isDuplicate, bonus);
  }, 1400);
}

/**
 * Finishes the hatching animation.
 * Reveals the creature and refreshes the encyclopedia.
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
// 7. FREE COIN SYSTEM
// ========================================

/**
 * Awards 25 coins when the cooldown has finished.
 * The last collection time is saved to prevent
 * refreshing the page from skipping the cooldown.
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
// 8. RESET GAME
// ========================================

/**
 * Asks for confirmation before deleting progress.
 * A new game begins only if the player confirms.
 */
function resetProgress() {
  if (isHatching) return;

  const confirmed = window.confirm(
    "Reset all your coins, monsters and hatches?"
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
// 9. BUTTON EVENTS
// ========================================

// An event listener runs a function when a button is clicked.
// These arrow functions pass the appropriate egg settings.

ui.meadowBtn.addEventListener("click", () => {
  startHatch(EGGS.meadow);
});

ui.moonBtn.addEventListener("click", () => {
  startHatch(EGGS.moon);
});

ui.claimBtn.addEventListener("click", claimCoins);
ui.resetBtn.addEventListener("click", resetProgress);

// ========================================
// 10. START THE GAME
// ========================================

// Display saved information as soon as the page opens.
renderStats();
renderCollection();
updateButtons();

// Refresh the free-coin countdown every second.
window.setInterval(updateButtons, 1000);

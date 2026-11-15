const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Run the real scripts with disposable storage, never a browser profile.
function boot(raw = null, options = {}) {
  const elements = new Map();
  function element() {
    return {
      value: '', checked: false, children: [], dataset: {}, style: {},
      classList: { add() {}, remove() {} },
      append(...items) { this.children.push(...items); },
      replaceChildren(...items) { this.children = items; },
      get options() { return this.children; },
      setAttribute() {}, addEventListener() {},
      querySelectorAll(selector) {
        return this.children.flatMap(child => typeof child === 'object'
          ? [(child.className || '').split(' ').includes(selector.slice(1)) ? child : null,
            ...child.querySelectorAll(selector)].filter(Boolean) : []);
      },
      showModal() { this.open = true; }, close() { this.open = false; }
    };
  }
  const storage = { raw, writes: 0 };
  const timers = [];
  const context = vm.createContext({
    console: { warn() {} },
    document: {
      getElementById(id) {
        if (!elements.has(id)) {
          const item = element();
          if (id === 'rarityFilter') item.value = 'all';
          if (id === 'sortBy') item.value = 'original';
          elements.set(id, item);
        }
        return elements.get(id);
      },
      createElement: element,
      querySelector() { return this.getElementById('main'); }
    },
    window: { confirm: () => options.confirm ?? false,
      setTimeout(fn) { timers.push(fn); return timers.length; },
      clearTimeout() {}, setInterval() {} },
    localStorage: {
      getItem() { if (options.readError) throw Error('Storage denied'); return storage.raw; },
      setItem(key, text) {
        assert.equal(key, 'monster-hatchery-save-v1');
        if (options.writeError) throw Error('Quota exceeded');
        storage.raw = text; storage.writes++;
      }
    }
  });
  const run = code => vm.runInContext(code, context);
  run(fs.readFileSync('script.js', 'utf8'));
  run(fs.readFileSync('battle.js', 'utf8'));
  run("ui.rarityFilter.value = 'all'; ui.sortBy.value = 'original';");
  return { run, storage, elements, timers,
    state: () => JSON.parse(run('JSON.stringify(state)')) };
}

const oldSave = { coins: 900, hatches: 5, collection: { pebble: 3, star: 2 }, lastClaim: 0 };

test('fresh game, hatch result and coins survive reopening before animation', () => {
  const game = boot();
  game.run('startHatch(EGGS.meadow)');
  assert.equal(game.state().coins, 160);
  assert.equal(game.state().hatches, 1);
  assert.deepEqual(boot(game.storage.raw).state(), game.state());
});

test('original v1 save keeps progress and receives optional defaults', () => {
  const game = boot(JSON.stringify(oldSave));
  assert.equal(game.state().coins, 900);
  assert.deepEqual(game.state().collection, oldSave.collection);
  assert.deepEqual(game.state().battleStats, { wins: 0, losses: 0 });
  assert.equal(game.storage.writes, 0);
});

test('each earlier progression save loads without losing existing fields', () => {
  let save = { ...oldSave };
  for (const addition of [
    { training: { pebble: { level: 10, xp: 0 } } },
    { favorites: ['pebble'] },
    { claimedAchievements: [] },
    { evolutions: { pebble: 2 } },
    { battleStats: { wins: 12, losses: 3 } }
  ]) {
    save = { ...save, ...addition };
    const game = boot(JSON.stringify(save));
    for (const key of Object.keys(save)) assert.deepEqual(game.state()[key], save[key]);
    game.run('saveGame()');
    assert.deepEqual(boot(game.storage.raw).state(), game.state());
  }
});

test('zero coins remain zero and unavailable actions spend nothing', () => {
  const game = boot(JSON.stringify({ ...oldSave, coins: 0 }));
  game.run("startHatch(EGGS.moon); feedMonster('pebble'); evolveMonster('pebble');");
  assert.equal(game.state().coins, 0);
  assert.equal(game.state().hatches, 5);
  assert.deepEqual(game.state().training, {});
  assert.deepEqual(game.state().evolutions, {});
});

test('defense, healing limits and defeat preserve permanent monster progress', () => {
  const game = boot(JSON.stringify(oldSave));
  game.run("battleUI.select.value = 'pebble'; startBattle(); playBattleTurn('defend');");
  assert.equal(game.run('activeBattle.enemyHp === activeBattle.enemyMaxHp'), true);
  game.run("playBattleTurn('heal'); playBattleTurn('heal');");
  assert.equal(game.run('activeBattle.healsLeft'), 0);
  const hp = game.run('activeBattle.playerHp');
  game.run("playBattleTurn('heal')");
  assert.equal(game.run('activeBattle.playerHp'), hp);
  game.run("activeBattle.playerHp = 1; playBattleTurn('defend');");
  assert.equal(game.state().battleStats.losses, 1);
  assert.equal(game.state().coins, 900);
  assert.deepEqual(game.state().collection, oldSave.collection);
  assert.deepEqual(boot(game.storage.raw).state(), game.state());
});

for (const raw of ['{broken', '', 'null', '[]', '{}', JSON.stringify({ ...oldSave, coins: -1 }),
  JSON.stringify({ ...oldSave, training: { pebble: { level: 99, xp: 0 } } })]) {
  test(`unreadable/invalid save is preserved and gameplay paused: ${raw}`, () => {
    const game = boot(raw);
    assert.equal(game.state(), null);
    game.run('saveGame()');
    assert.equal(game.storage.raw, raw);
    assert.equal(game.storage.writes, 0);
    assert.equal(game.elements.get('main').inert, true);
    assert.match(game.elements.get('saveStatus').textContent, /could not|cannot/i);
  });
}

test('inaccessible storage pauses play without writes', () => {
  const game = boot(JSON.stringify(oldSave), { readError: true });
  assert.equal(game.state(), null);
  assert.equal(game.storage.writes, 0);
});

test('write failure is visible and leaves the previous save untouched', () => {
  const raw = JSON.stringify(oldSave);
  const game = boot(raw, { writeError: true });
  game.run('claimCoins()');
  assert.equal(game.storage.raw, raw);
  assert.match(game.elements.get('saveStatus').textContent, /could not|cannot/i);
  assert.equal(game.elements.get('saveStatus').hidden, false);
});

test('an older tab cannot overwrite a newer save or a deleted save', () => {
  for (const next of [JSON.stringify({ ...oldSave, coins: 999 }), null]) {
    const game = boot(JSON.stringify(oldSave));
    game.storage.raw = next;
    game.run('claimCoins()');
    assert.equal(game.storage.raw, next);
    assert.equal(game.storage.writes, 0);
  }
});

test('favorites, feeding, evolution, achievements and battle rewards persist', () => {
  const game = boot(JSON.stringify(oldSave));
  game.run("toggleFavorite('pebble'); feedMonster('pebble'); feedMonster('pebble');");
  assert.equal(game.state().training.pebble.level, 2);
  game.run("state.training.pebble = {level: 5, xp: 0}; evolveMonster('pebble');");
  assert.equal(game.state().evolutions.pebble, 1);
  while (game.timers.length) game.timers.shift()();
  game.run("claimAchievement(ACHIEVEMENTS[0].id)");
  const coins = game.state().coins;
  game.run("claimAchievement(ACHIEVEMENTS[0].id)");
  assert.equal(game.state().coins, coins);
  game.run("battleUI.select.value = 'pebble'; startBattle(); activeBattle.enemyHp = 1; playBattleTurn('attack');");
  assert.equal(game.state().battleStats.wins, 1);
  assert.equal(game.state().coins, coins + 40);
  game.run('finishBattle(true)');
  assert.equal(game.state().coins, coins + 40);
  assert.deepEqual(boot(game.storage.raw).state(), game.state());
});

test('reset requires confirmation and resets battle records too', () => {
  const game = boot(JSON.stringify(oldSave));
  game.run('resetProgress()');
  assert.equal(game.state().coins, 900);
  const confirmed = boot(JSON.stringify(oldSave), { confirm: true });
  confirmed.run('resetProgress()');
  assert.deepEqual(confirmed.state(), boot().state());
  assert.deepEqual(boot(confirmed.storage.raw).state(), confirmed.state());
});

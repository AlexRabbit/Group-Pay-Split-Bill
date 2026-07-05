/**
 * Split engine unit tests — run: node tests/run-tests.js
 */
const SplitEngine = require('../js/split-engine.js');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error('FAIL:', msg);
  }
}

function assertEq(a, b, msg) {
  assert(a === b, msg + ' (got ' + a + ', expected ' + b + ')');
}

// U01: cents conversion
assertEq(SplitEngine.toCents(45.5), 4550, 'toCents decimal');
assertEq(SplitEngine.toCents('130'), 13000, 'toCents string');
assert(Number.isNaN(SplitEngine.toCents(-5)), true, 'toCents negative');
assertEq(SplitEngine.fromCents(14500), 145, 'fromCents');

// U01: divideAmount remainder
const shares = SplitEngine.divideAmount(14000, 2);
assertEq(shares[0] + shares[1], 14000, 'split sum equals full');
assertEq(shares[0], 7000, 'even split first');
assertEq(shares[1], 7000, 'even split second');

const shares3 = SplitEngine.divideAmount(100, 3);
assertEq(shares3.reduce((a, b) => a + b, 0), 100, '3-way split sum');

// U01: parse names
assertEq(SplitEngine.parseNames('Alex, Carlos, Cesar').length, 3, 'parse 3 names');
assertEq(SplitEngine.parseNames('  Alex  ')[0], 'Alex', 'trim name');

// U01: full flow Alex + Manuel split fish sticks
let state = SplitEngine.emptyState();
state.billTotalCents = SplitEngine.toCents(500);
state.payers = SplitEngine.initPayers(['Alex', 'Manuel', 'Carlos']);

state = SplitEngine.addItem(state, 'p0', 'lemonade', 45, []);
state = SplitEngine.addItem(state, 'p0', 'cocktail', 130, []);
state = SplitEngine.addItem(state, 'p0', 'fish sticks', 140, ['p1']);

const alexTotal = SplitEngine.payerTotalCents(state.payers[0]);
assertEq(alexTotal, SplitEngine.toCents(45 + 130 + 70), 'Alex total with split');

const manuelItems = state.payers[1].items;
assertEq(manuelItems.length, 1, 'Manuel auto item');
assertEq(manuelItems[0].cents, 7000, 'Manuel split share');
assert(manuelItems[0].autoAdded === true, 'Manuel item auto-added');
assert(manuelItems[0].editable === false, 'Manuel item not editable');

// U03: remove split removes all portions
state = SplitEngine.removeItem(state, 'p0', state.payers[0].items.find((i) => i.name === 'fish sticks').id);
assertEq(state.payers[1].items.length, 0, 'split removed from partner');

// U01: totals
state = SplitEngine.addItem(state, 'p0', 'fish sticks', 140, ['p1']);
state = SplitEngine.addItem(state, 'p1', 'beer', 50, []);
state = SplitEngine.addItem(state, 'p2', 'salad', 80, []);

const totals = SplitEngine.computeTotals(state);
const expectedAssigned =
  SplitEngine.toCents(45 + 130 + 70) + SplitEngine.toCents(70 + 50) + SplitEngine.toCents(80);
assertEq(totals.assignedCents, expectedAssigned, 'assigned total');

// U01: backup roundtrip
const backup = SplitEngine.exportBackup(state);
const restored = SplitEngine.importBackup(backup);
assertEq(restored.payers.length, 3, 'backup restore payers');
assertEq(restored.billTotalCents, state.billTotalCents, 'backup restore total');

// U01: URL encode roundtrip
const encoded = SplitEngine.encodeStateUrl(state);
const decoded = SplitEngine.decodeStateUrl(encoded);
assertEq(decoded.payers.length, 3, 'URL state roundtrip');

console.log('\n--- Results ---');
console.log('Passed:', passed);
console.log('Failed:', failed);
process.exit(failed > 0 ? 1 : 0);

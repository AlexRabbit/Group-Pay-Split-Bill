/**
 * Split engine + URL state tests — run: node tests/run-tests.js
 */
const SplitEngine = require('../js/split-engine.js');
const GPSUrlState = require('../js/url-state.js');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) passed++;
  else {
    failed++;
    console.error('FAIL:', msg);
  }
}

function assertEq(a, b, msg) {
  assert(a === b, msg + ' (got ' + a + ', expected ' + b + ')');
}

// U01: cents
assertEq(SplitEngine.toCents(45.5), 4550, 'toCents decimal');
assertEq(SplitEngine.fromCents(14500), 145, 'fromCents');

// U01: split flow
let state = SplitEngine.emptyState();
state.billTotalCents = SplitEngine.toCents(500);
state.payers = SplitEngine.initPayers(['Alex', 'Manuel']);
state = SplitEngine.addItem(state, 'p0', 'lemonade', 45, []);
state = SplitEngine.addItem(state, 'p0', 'fish sticks', 140, ['p1']);
assertEq(SplitEngine.payerTotalCents(state.payers[0]), SplitEngine.toCents(45 + 70), 'Alex split total');
assertEq(state.payers[1].items.length, 1, 'Manuel auto item');

// U01: compact URL roundtrip (no LZ in node)
const token = GPSUrlState.encode(state, null);
const decoded = GPSUrlState.decode(token, null);
assertEq(decoded.payers.length, 2, 'compact URL decode payers');
assertEq(decoded.billTotalCents, state.billTotalCents, 'compact URL decode bill');

const url = GPSUrlState.buildUrl('/Group-Pay-Split-Bill/', 'es', token);
assert(url.includes('lang=es'), 'URL includes lang=es');
assert(url.includes('#d='), 'URL uses short hash prefix');

// U01: legacy full-state blob in hash
const legacy = 's:' + Buffer.from(JSON.stringify(state), 'utf8').toString('base64');
const legacyDecoded = GPSUrlState.decode(legacy, null);
assertEq(legacyDecoded.payers.length, 2, 'legacy URL decode');

// U01: expand compact
const compact = GPSUrlState.compact(state);
const expanded = GPSUrlState.expand(compact);
assertEq(expanded.payers[0].items[0].name, 'lemonade', 'expand item name');

console.log('\n--- Results ---');
console.log('Passed:', passed);
console.log('Failed:', failed);
process.exit(failed > 0 ? 1 : 0);

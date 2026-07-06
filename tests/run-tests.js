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

let state = SplitEngine.emptyState();
state.billTotalCents = SplitEngine.toCents(500);
state.payers = SplitEngine.initPayers(['Alex', 'Manuel']);
state = SplitEngine.addItem(state, 'p0', 'lemonade', 45, []);
state = SplitEngine.addItem(state, 'p0', 'fish sticks', 140, ['p1']);

assertEq(SplitEngine.payerTotalCents(state.payers[0]), SplitEngine.toCents(115), 'Alex total');

const token = GPSUrlState.encode(state, null);
const decoded = GPSUrlState.decode(token, null);
assertEq(decoded.payers.length, 2, 'v2 URL decode payers');
assertEq(decoded.payers[0].items[0].name, 'lemonade', 'v2 item name restored');
assert(decoded.payers[0].items[0].id, 'v2 regenerates ids');

const url = GPSUrlState.buildUrl('/Group-Pay-Split-Bill/', 'es', token);
assert(url.includes('lang=es'), 'URL lang=es');
assert(url.includes('#p='), 'URL short hash prefix p=');

const compact = GPSUrlState.compact(state);
assertEq(compact[0], 2, 'compact version 2');
assert(typeof compact[2][0][0] === 'string', 'v2 uses name not id');

console.log('\n--- Results ---');
console.log('Passed:', passed);
console.log('Failed:', failed);
console.log('Sample token length (uncompressed):', token.length);
process.exit(failed > 0 ? 1 : 0);

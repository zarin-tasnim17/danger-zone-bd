import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cleanIncidentTitle } from '../harness/contractValidator';
import {
  extractSignificantTokens,
  calculateStorySimilarity,
} from '../../../apps/api/src/services/incidentDeduplicationService';

describe('Tier 2: Boundary & Corner Cases - F07: Extreme Headlines & ReDoS Resilience', () => {
  it('T2-F07-01: 50 repeated Bengali Dari (॥ / ।) and dashes are collapsed cleanly without double spaces', () => {
    const rawHeadline = 'মিরপুরে সড়ক দুর্ঘটনা ' + '॥'.repeat(25) + ' ' + '।'.repeat(25) + ' ––—— নিহত ২';
    const cleaned = cleanIncidentTitle(rawHeadline);

    assert.ok(!cleaned.includes('॥'), 'Must strip all Double Dari');
    assert.ok(!cleaned.includes('।'), 'Must strip all Dari');
    assert.ok(!cleaned.includes('  '), 'Must not contain consecutive whitespace');
    assert.strictEqual(cleaned, 'মিরপুরে সড়ক দুর্ঘটনা নিহত ২');
  });

  it('T2-F07-02: Mixed script (Bangla, Latin, Arabic), emojis, and symbols tokenized safely', () => {
    const multiScript = '🚨 BREAKING: উত্তরায় ডাকাতি 🔫 Robbers raided store! إن شاء الله নিহত ১';
    const cleaned = cleanIncidentTitle(multiScript);
    assert.ok(cleaned.length > 0);

    const tokens = extractSignificantTokens(cleaned);
    assert.ok(Array.from(tokens).some((t) => t.includes('uttara')), 'Must extract location token Uttara');
    assert.ok(tokens.has('robbery') || tokens.has('ডাকাতি') || tokens.has('ডাকাত'), 'Must extract robbery concept token');
  });

  it('T2-F07-03: Punctuation-only and whitespace-only titles clean safely to empty string without crashing', () => {
    const punctuationOnlyTitles = [
      '॥ ॥ ॥ ॥ ॥',
      '– – — — – –',
      '   ',
      '॥–—॥',
      '॥।॥।॥',
    ];

    for (const title of punctuationOnlyTitles) {
      const cleaned = cleanIncidentTitle(title);
      assert.strictEqual(cleaned, '', `Title "${title}" must clean to empty string`);

      // Passing to tokenizer and deduplication must not throw
      assert.doesNotThrow(() => {
        const tokens = extractSignificantTokens(cleaned);
        assert.strictEqual(tokens.size, 0);

        const sim = calculateStorySimilarity(cleaned, 'সীতাকুণ্ডে দুর্ঘটনা');
        assert.strictEqual(sim.isDuplicate, false);
      });
    }
  });

  it('T2-F07-04: 5,000-character adversarial headline executes in <50ms without catastrophic regex backtracking (ReDoS)', () => {
    // Generate adversarial repeated pattern prone to catastrophic backtracking in flawed regexes
    const repeated = 'মিরপুরে '.repeat(600) + 'সড়ক দুর্ঘটনা - The Daily Star';
    assert.ok(repeated.length > 4000, `Headline length should be >4000 chars, got ${repeated.length}`);

    const startTime = performance.now();
    const cleaned = cleanIncidentTitle(repeated);
    const durationMs = performance.now() - startTime;

    assert.ok(durationMs < 50, `cleanIncidentTitle must complete under 50ms, took ${durationMs.toFixed(2)}ms`);
    assert.ok(cleaned.length > 0);
    assert.ok(!cleaned.includes('The Daily Star'), 'Publisher credit must be removed');
  });

  it('T2-F07-05: Zero-Width Non-Joiner (ZWNJ) and Zero-Width Joiner (ZWJ) do not break word tokenization', () => {
    // ZWNJ: \u200C, ZWJ: \u200D
    const titleWithZwnj = 'সড়ক\u200C দুর্ঘটনা\u200D এবং বাস চাপায় মৃত্যু';
    const cleaned = cleanIncidentTitle(titleWithZwnj);
    assert.ok(cleaned.length > 0);

    const tokens = extractSignificantTokens(titleWithZwnj);
    assert.ok(tokens.size > 0, 'Tokenizer must handle ZWNJ/ZWJ characters');
    assert.ok(tokens.has('collision') || tokens.has('accident') || tokens.has('বাস'));
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeCategoryKey,
  getCategoryVisual,
  formatCategoryLabel,
  getCategoryDescription,
} from '@/lib/incidentCategoryVisuals';
import { ReportCategory } from '@repo/shared';

describe('[Unit] Report Category Resolution & Combinations Parity', () => {
  // Test helper replicating the category resolution function in Report Page and Modal
  function resolveCategory(selectedTags: string[]): ReportCategory {
    const normalizedTags = selectedTags.map((t) => normalizeCategoryKey(t));
    const hasTheft = normalizedTags.includes('THEFT');
    const hasRobbery = normalizedTags.includes('ROBBERY');
    const hasSnatching = normalizedTags.includes('SNATCHING');
    const hasArmedAssault = normalizedTags.includes('ARMED_ASSAULT');
    const hasYouthGang = normalizedTags.includes('YOUTH_GANG_ACTIVITY');

    if (hasTheft && hasRobbery) return 'THEFT_ROBBERY';
    if (hasSnatching && hasArmedAssault) return 'SNATCHING_ARMED_ASSAULT';
    if (hasYouthGang && hasArmedAssault) return 'TEEN_GANG_ARMED_ASSAULT';

    const lastTag = selectedTags[selectedTags.length - 1];
    if (lastTag) {
      const canonical = normalizeCategoryKey(lastTag);
      if (canonical && canonical !== 'UNKNOWN') return canonical as ReportCategory;
      return lastTag as ReportCategory;
    }
    return 'SNATCHING';
  }

  // Test helper replicating handleToggleTag logic
  function toggleTag(currentSelected: string[], tagId: string): string[] {
    if (
      currentSelected.includes(tagId) ||
      currentSelected.some((t) => normalizeCategoryKey(t) === normalizeCategoryKey(tagId))
    ) {
      if (currentSelected.length > 1) {
        return currentSelected.filter(
          (id) => id !== tagId && normalizeCategoryKey(id) !== normalizeCategoryKey(tagId)
        );
      }
      return currentSelected;
    }

    const norm = normalizeCategoryKey(tagId);

    // 1. THEFT + ROBBERY
    if (norm === 'THEFT') {
      if (currentSelected.some((t) => normalizeCategoryKey(t) === 'ROBBERY')) {
        return ['ROBBERY', tagId];
      }
      return [tagId];
    }
    if (norm === 'ROBBERY') {
      if (currentSelected.some((t) => normalizeCategoryKey(t) === 'THEFT')) {
        return ['THEFT', tagId];
      }
      return [tagId];
    }

    // 2. SNATCHING + ARMED_ASSAULT
    if (norm === 'SNATCHING') {
      if (currentSelected.some((t) => normalizeCategoryKey(t) === 'ARMED_ASSAULT')) {
        return ['ARMED_ASSAULT', tagId];
      }
      return [tagId];
    }
    if (norm === 'ARMED_ASSAULT') {
      if (currentSelected.some((t) => normalizeCategoryKey(t) === 'SNATCHING')) {
        return ['SNATCHING', tagId];
      }
      if (currentSelected.some((t) => normalizeCategoryKey(t) === 'YOUTH_GANG_ACTIVITY')) {
        return ['YOUTH_GANG_ACTIVITY', tagId];
      }
      return [tagId];
    }

    // 3. YOUTH_GANG_ACTIVITY + ARMED_ASSAULT
    if (norm === 'YOUTH_GANG_ACTIVITY') {
      if (currentSelected.some((t) => normalizeCategoryKey(t) === 'ARMED_ASSAULT')) {
        return ['ARMED_ASSAULT', tagId];
      }
      return [tagId];
    }

    // Standalone
    return [tagId];
  }

  it('1. Standalone Robbery selection resolves to ROBBERY and never defaults to SNATCHING', () => {
    // Single Robbery tag
    const resolved = resolveCategory(['ROBBERY']);
    assert.equal(resolved, 'ROBBERY');

    const visual = getCategoryVisual(resolved);
    assert.equal(visual.canonicalCategory, 'ROBBERY');
    assert.equal(visual.labelEn, 'Robbery');
    assert.equal(formatCategoryLabel(resolved, 'en'), 'Robbery');
    assert.equal(formatCategoryLabel(resolved, 'bn'), 'ডাকাতি');
  });

  it('2. Legacy alias DACOITY resolves cleanly to canonical ROBBERY', () => {
    assert.equal(normalizeCategoryKey('DACOITY'), 'ROBBERY');
    const resolved = resolveCategory(['DACOITY']);
    assert.equal(resolved, 'ROBBERY');
    assert.equal(getCategoryVisual(resolved).labelEn, 'Robbery');
  });

  it('3. Legacy alias TEEN_GANG resolves to YOUTH_GANG_ACTIVITY', () => {
    assert.equal(normalizeCategoryKey('TEEN_GANG'), 'YOUTH_GANG_ACTIVITY');
    const resolved = resolveCategory(['TEEN_GANG']);
    assert.equal(resolved, 'YOUTH_GANG_ACTIVITY');
    assert.equal(getCategoryVisual(resolved).labelEn, 'Youth Gang Activity');
  });

  it('4. Legacy alias DRUG_ACTIVITY resolves to DRUG_RELATED_CRIME', () => {
    assert.equal(normalizeCategoryKey('DRUG_ACTIVITY'), 'DRUG_RELATED_CRIME');
    const resolved = resolveCategory(['DRUG_ACTIVITY']);
    assert.equal(resolved, 'DRUG_RELATED_CRIME');
    assert.equal(getCategoryVisual(resolved).labelEn, 'Drug-Related Crime');
  });

  it('5. Smart combine: THEFT + ROBBERY resolves to THEFT_ROBBERY in either selection order', () => {
    // Order 1: Theft then Robbery
    let tags = toggleTag(['THEFT'], 'ROBBERY');
    assert.deepEqual(tags, ['THEFT', 'ROBBERY']);
    assert.equal(resolveCategory(tags), 'THEFT_ROBBERY');

    // Order 2: Robbery then Theft
    tags = toggleTag(['ROBBERY'], 'THEFT');
    assert.deepEqual(tags, ['ROBBERY', 'THEFT']);
    assert.equal(resolveCategory(tags), 'THEFT_ROBBERY');

    // Check visuals & labels
    const visual = getCategoryVisual('THEFT_ROBBERY');
    assert.equal(visual.canonicalCategory, 'THEFT_ROBBERY');
    assert.equal(visual.labelEn, 'Theft & Robbery');
  });

  it('6. Smart combine: SNATCHING + ARMED_ASSAULT resolves to SNATCHING_ARMED_ASSAULT in either order', () => {
    let tags = toggleTag(['SNATCHING'], 'ARMED_ASSAULT');
    assert.deepEqual(tags, ['SNATCHING', 'ARMED_ASSAULT']);
    assert.equal(resolveCategory(tags), 'SNATCHING_ARMED_ASSAULT');

    tags = toggleTag(['ARMED_ASSAULT'], 'SNATCHING');
    assert.deepEqual(tags, ['ARMED_ASSAULT', 'SNATCHING']);
    assert.equal(resolveCategory(tags), 'SNATCHING_ARMED_ASSAULT');

    const visual = getCategoryVisual('SNATCHING_ARMED_ASSAULT');
    assert.equal(visual.canonicalCategory, 'SNATCHING_ARMED_ASSAULT');
  });

  it('7. Smart combine: YOUTH_GANG_ACTIVITY + ARMED_ASSAULT resolves to TEEN_GANG_ARMED_ASSAULT in either order', () => {
    let tags = toggleTag(['YOUTH_GANG_ACTIVITY'], 'ARMED_ASSAULT');
    assert.deepEqual(tags, ['YOUTH_GANG_ACTIVITY', 'ARMED_ASSAULT']);
    assert.equal(resolveCategory(tags), 'TEEN_GANG_ARMED_ASSAULT');

    tags = toggleTag(['ARMED_ASSAULT'], 'YOUTH_GANG_ACTIVITY');
    assert.deepEqual(tags, ['ARMED_ASSAULT', 'YOUTH_GANG_ACTIVITY']);
    assert.equal(resolveCategory(tags), 'TEEN_GANG_ARMED_ASSAULT');

    const visual = getCategoryVisual('TEEN_GANG_ARMED_ASSAULT');
    assert.equal(visual.canonicalCategory, 'TEEN_GANG_ARMED_ASSAULT');
    assert.equal(visual.labelEn, 'Gang Armed Clash');
  });

  it('8. Deselecting one tag from a pair gracefully reverts to the remaining single tag', () => {
    // Start with paired Theft + Robbery
    const paired = ['THEFT', 'ROBBERY'];
    assert.equal(resolveCategory(paired), 'THEFT_ROBBERY');

    // Deselect Robbery -> leaves Theft
    const revertedToTheft = toggleTag(paired, 'ROBBERY');
    assert.deepEqual(revertedToTheft, ['THEFT']);
    assert.equal(resolveCategory(revertedToTheft), 'THEFT');

    // Deselect Theft -> leaves Robbery
    const revertedToRobbery = toggleTag(paired, 'THEFT');
    assert.deepEqual(revertedToRobbery, ['ROBBERY']);
    assert.equal(resolveCategory(revertedToRobbery), 'ROBBERY');
  });

  it('9. Selecting an independent tag (e.g. EXTORTION) clears pairs and isolates category', () => {
    const paired = ['SNATCHING', 'ARMED_ASSAULT'];
    const switched = toggleTag(paired, 'EXTORTION');
    assert.deepEqual(switched, ['EXTORTION']);
    assert.equal(resolveCategory(switched), 'EXTORTION');
  });

  it('10. Every individual primary tag correctly maps to its distinct category without collision', () => {
    const PRIMARY_TAGS = [
      'SNATCHING',
      'ARMED_ASSAULT',
      'THEFT',
      'ROBBERY',
      'YOUTH_GANG_ACTIVITY',
      'EXTORTION',
      'DRUG_RELATED_CRIME',
      'ROAD_ACCIDENT',
      'UNLIT_ROAD',
    ];

    for (const tag of PRIMARY_TAGS) {
      const resolved = resolveCategory([tag]);
      assert.equal(resolved, tag, `Tag ${tag} should resolve to itself`);
      const visual = getCategoryVisual(resolved);
      assert.notEqual(visual.labelEn, 'Unknown', `${tag} must have a known visual label`);
    }
  });
});

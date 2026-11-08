import { IncidentCategory } from '@repo/shared';

/**
 * Checks if an incident category matches any of the user's selected multi-select categories.
 * Handles exact matches, smart combinational crimes (e.g. THEFT_ROBBERY matches THEFT or ROBBERY),
 * and legacy aliases.
 */
export function isIncidentCategoryMatch(
  incidentCategory: string,
  selectedCategories: IncidentCategory[]
): boolean {
  if (!selectedCategories || selectedCategories.length === 0) {
    return true;
  }

  // Exact match
  if (selectedCategories.includes(incidentCategory as IncidentCategory)) {
    return true;
  }

  // Smart combination matches:
  // If incident is THEFT_ROBBERY, matches if user selected THEFT or ROBBERY
  if (incidentCategory === 'THEFT_ROBBERY') {
    if (selectedCategories.includes('THEFT') || selectedCategories.includes('ROBBERY')) {
      return true;
    }
  }

  // If incident is SNATCHING_ARMED_ASSAULT, matches if user selected SNATCHING or ARMED_ASSAULT
  if (incidentCategory === 'SNATCHING_ARMED_ASSAULT') {
    if (selectedCategories.includes('SNATCHING') || selectedCategories.includes('ARMED_ASSAULT')) {
      return true;
    }
  }

  // If incident is TEEN_GANG_ARMED_ASSAULT
  if (incidentCategory === 'TEEN_GANG_ARMED_ASSAULT') {
    if (
      selectedCategories.includes('YOUTH_GANG_ACTIVITY') ||
      selectedCategories.includes('ARMED_ASSAULT')
    ) {
      return true;
    }
  }

  // Legacy aliases
  if (incidentCategory === 'MUGGING' && selectedCategories.includes('SNATCHING')) return true;
  if (incidentCategory === 'DACOITY' && selectedCategories.includes('ROBBERY')) return true;
  if (
    incidentCategory === 'THEFT_DACOITY' &&
    (selectedCategories.includes('THEFT') || selectedCategories.includes('ROBBERY'))
  ) {
    return true;
  }
  if (incidentCategory === 'TEEN_GANG' && selectedCategories.includes('YOUTH_GANG_ACTIVITY')) {
    return true;
  }
  if (incidentCategory === 'DRUG_ACTIVITY' && selectedCategories.includes('DRUG_RELATED_CRIME')) {
    return true;
  }

  return false;
}

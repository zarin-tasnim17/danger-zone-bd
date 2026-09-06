import { Language } from '@repo/shared';

export const translations = {
  en: {
    appName: 'Danger Zone ⚡',
    appTagline: 'Bangladesh Community Safety & Alert System',
    liveMonitoring: 'Live Monitoring',
    allIncidents: 'All Incidents',
    criticalAlerts: 'Critical Danger',
    roadblocks: 'Roadblocks',
    hazards: 'Hazards',
    reportIncident: 'Report Incident',
    searchPlaceholder: 'Search area, city or district...',
    activeAlerts: 'Active Incidents',
    severity: {
      critical: 'Critical',
      high: 'High',
      medium: 'Medium',
      low: 'Low Alert',
    },
    categories: {
      violence_riot: 'Riot / Unrest',
      robbery_crime: 'Robbery / Crime',
      roadblock: 'Roadblock',
      accident: 'Accident',
      fire: 'Fire Incident',
      natural_hazard: 'Natural Hazard',
      harassment: 'Harassment',
      general_alert: 'General Alert',
    },
    reportedBy: 'Reported by community member',
    verified: 'Community Confirmed',
    viewDetails: 'View Details',
    close: 'Close',
  },
  bn: {
    appName: 'বিপদ সংকেত ⚡',
    appTagline: 'বাংলাদেশ গণনিরাপত্তা ও সতর্কবার্তা ব্যবস্থা',
    liveMonitoring: 'সরাসরি নজরদারি',
    allIncidents: 'সকল তথ্য',
    criticalAlerts: 'উচ্চ বিপদ',
    roadblocks: 'পথ অবরোধ',
    hazards: 'দুর্যোগ',
    reportIncident: 'রিপোর্ট করুন',
    searchPlaceholder: 'এলাকা বা জেলা খুঁজুন...',
    activeAlerts: 'সক্রিয় ঘটনা',
    severity: {
      critical: 'মারাত্মক',
      high: 'উচ্চ ঝুঁকি',
      medium: 'মধ্যম সতর্কতা',
      low: 'সাধারণ সতর্কতা',
    },
    categories: {
      violence_riot: 'দাঙ্গা / সংঘর্ষ',
      robbery_crime: 'ছিনতাই / অপরাধ',
      roadblock: 'সড়ক অবরোধ',
      accident: 'দুর্ঘটনা',
      fire: 'অগ্নিকাণ্ড',
      natural_hazard: 'প্রাকৃতিক দুর্যোগ',
      harassment: 'নিপীড়ন / হয়রানি',
      general_alert: 'সাধারণ সতর্কতা',
    },
    reportedBy: 'নাগরিক দ্বারা রিপোর্টকৃত',
    verified: 'যাচাইকৃত',
    viewDetails: 'বিস্তারিত দেখুন',
    close: 'বন্ধ করুন',
  },
};

export function getTranslation(lang: Language) {
  return translations[lang] || translations.en;
}

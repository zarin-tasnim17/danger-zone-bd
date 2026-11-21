import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isHazardWithinTimeWindow,
  formatTimeTo12Hour,
  convert12HourTo24Hour,
  DangerIncident,
} from '@repo/shared';
import { isHazardEligible } from '@/lib/proximityEngine';

describe('[Unit] Custom Danger Time-Window and AM/PM Formatting', () => {
  it('1. formatTimeTo12Hour converts 24-hour HH:mm to 12-hour AM/PM strings accurately', () => {
    assert.equal(formatTimeTo12Hour('18:00'), '06:00 PM');
    assert.equal(formatTimeTo12Hour('06:00'), '06:00 AM');
    assert.equal(formatTimeTo12Hour('00:00'), '12:00 AM');
    assert.equal(formatTimeTo12Hour('12:00'), '12:00 PM');
    assert.equal(formatTimeTo12Hour('22:30'), '10:30 PM');
    assert.equal(formatTimeTo12Hour('09:15'), '09:15 AM');
    assert.equal(formatTimeTo12Hour('23:59'), '11:59 PM');
    assert.equal(formatTimeTo12Hour(null), '');
    assert.equal(formatTimeTo12Hour(undefined), '');
  });

  it('2. convert12HourTo24Hour converts 12-hour AM/PM components into canonical HH:mm format', () => {
    assert.equal(convert12HourTo24Hour(6, 0, 'PM'), '18:00');
    assert.equal(convert12HourTo24Hour(6, 0, 'AM'), '06:00');
    assert.equal(convert12HourTo24Hour(12, 0, 'AM'), '00:00');
    assert.equal(convert12HourTo24Hour(12, 0, 'PM'), '12:00');
    assert.equal(convert12HourTo24Hour(10, 30, 'PM'), '22:30');
    assert.equal(convert12HourTo24Hour(4, 15, 'AM'), '04:15');
  });

  it('3. Continuous hazard (null/undefined time window) is always active at any hour of day', () => {
    const dates = [
      new Date('2026-11-21T06:00:00Z'), // 12:00 BST
      new Date('2026-11-21T14:00:00Z'), // 20:00 BST
      new Date('2026-11-21T21:00:00Z'), // 03:00 BST
    ];
    for (const d of dates) {
      assert.equal(isHazardWithinTimeWindow(null, null, d), true);
      assert.equal(isHazardWithinTimeWindow(undefined, undefined, d), true);
      assert.equal(isHazardWithinTimeWindow('', '', d), true);
    }
  });

  it('4. Same-day time window (e.g. 06:00 PM to 10:00 PM BST / 18:00 - 22:00) behaves correctly', () => {
    // Bangladesh Time is UTC+6:
    // 12:00 UTC = 18:00 BST (Window Start)
    // 14:00 UTC = 20:00 BST (Mid Window)
    // 16:00 UTC = 22:00 BST (Window End)
    // 08:00 UTC = 14:00 BST (Outside Window - Afternoon)
    // 17:00 UTC = 23:00 BST (Outside Window - Night)

    const startAt = new Date('2026-11-21T12:00:00Z');
    const midAt = new Date('2026-11-21T14:00:00Z');
    const endAt = new Date('2026-11-21T16:00:00Z');
    const beforeWindow = new Date('2026-11-21T08:00:00Z');
    const afterWindow = new Date('2026-11-21T17:00:00Z');

    assert.equal(isHazardWithinTimeWindow('18:00', '22:00', startAt), true);
    assert.equal(isHazardWithinTimeWindow('18:00', '22:00', midAt), true);
    assert.equal(isHazardWithinTimeWindow('18:00', '22:00', endAt), true);
    assert.equal(isHazardWithinTimeWindow('18:00', '22:00', beforeWindow), false);
    assert.equal(isHazardWithinTimeWindow('18:00', '22:00', afterWindow), false);
  });

  it('5. Overnight time window crossing midnight (e.g. 06:00 PM to 06:00 AM BST / 18:00 - 06:00) behaves correctly', () => {
    // Bangladesh Time is UTC+6:
    // 15:00 UTC = 21:00 BST (Evening - Inside Window)
    // 21:00 UTC = 03:00 BST (Late Night - Inside Window)
    // 00:00 UTC = 06:00 BST (Boundary End - Inside Window)
    // 06:00 UTC = 12:00 BST (Broad Daylight - Outside Window)
    // 09:30 UTC = 15:30 BST (Afternoon - Outside Window)

    const evening = new Date('2026-11-21T15:00:00Z');
    const lateNight = new Date('2026-11-21T21:00:00Z');
    const morningEnd = new Date('2026-11-22T00:00:00Z');
    const noonDaylight = new Date('2026-11-21T06:00:00Z');
    const afternoon = new Date('2026-11-21T09:30:00Z');

    assert.equal(isHazardWithinTimeWindow('18:00', '06:00', evening), true);
    assert.equal(isHazardWithinTimeWindow('18:00', '06:00', lateNight), true);
    assert.equal(isHazardWithinTimeWindow('18:00', '06:00', morningEnd), true);
    assert.equal(isHazardWithinTimeWindow('18:00', '06:00', noonDaylight), false);
    assert.equal(isHazardWithinTimeWindow('18:00', '06:00', afternoon), false);
  });

  it('6. isHazardEligible in proximity engine respects active hazard schedule', () => {
    const unlitRoadHazard: DangerIncident = {
      id: 'hazard-unlit-1',
      title: 'Unlit Road Hazard Zone',
      description: 'Streetlights out every evening between 6 PM and 6 AM',
      category: 'UNLIT_ROAD',
      severity: 'HIGH',
      coordinates: { lat: 23.8103, lng: 90.4125 },
      locationName: 'Mirpur-10, Dhaka',
      status: 'unverified',
      reportedBy: 'Citizen Report',
      verifiedCount: 0,
      upvotes: 0,
      downvotes: 0,
      timestamp: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      activeTimeStart: '18:00',
      activeTimeEnd: '06:00',
    };

    // 21:00 BST (Evening) -> Inside Window -> Eligible
    const eveningTime = new Date('2026-11-21T15:00:00Z').getTime();
    assert.equal(
      isHazardEligible(unlitRoadHazard, { currentTime: eveningTime }),
      true,
      'Should be eligible for alerts during active 6 PM - 6 AM schedule'
    );

    // 12:00 BST (Noon) -> Outside Window -> Ineligible (No false alarms during daytime)
    const noonTime = new Date('2026-11-21T06:00:00Z').getTime();
    assert.equal(
      isHazardEligible(unlitRoadHazard, { currentTime: noonTime }),
      false,
      'Should be suppressed from alerts outside active scheduled window'
    );
  });

  it('7. Map filtering correctly includes scheduled pins inside window and excludes pins outside window', () => {
    const incidents: DangerIncident[] = [
      {
        id: 'inc-24h',
        title: 'Continuous 24h Snatching Spot',
        description: 'Active at all hours',
        category: 'SNATCHING',
        severity: 'HIGH',
        coordinates: { lat: 23.75, lng: 90.38 },
        locationName: 'Dhanmondi',
        status: 'unverified',
        reportedBy: 'Citizen',
        verifiedCount: 1,
        upvotes: 1,
        downvotes: 0,
        timestamp: new Date().toISOString(),
        activeTimeStart: null,
        activeTimeEnd: null,
      },
      {
        id: 'inc-night-only',
        title: 'Unlit Alleyway',
        description: 'Lights out at night',
        category: 'UNLIT_ROAD',
        severity: 'MEDIUM',
        coordinates: { lat: 23.76, lng: 90.39 },
        locationName: 'Farmgate',
        status: 'unverified',
        reportedBy: 'Citizen',
        verifiedCount: 1,
        upvotes: 1,
        downvotes: 0,
        timestamp: new Date().toISOString(),
        activeTimeStart: '18:00',
        activeTimeEnd: '06:00',
      },
    ];

    // Evaluate at Daytime (12:00 BST)
    const noonDate = new Date('2026-11-21T06:00:00Z');
    const noonVisible = incidents.filter((inc) =>
      isHazardWithinTimeWindow(inc.activeTimeStart, inc.activeTimeEnd, noonDate)
    );
    assert.equal(noonVisible.length, 1);
    assert.equal(noonVisible[0].id, 'inc-24h');

    // Evaluate at Nighttime (22:00 BST)
    const nightDate = new Date('2026-11-21T16:00:00Z');
    const nightVisible = incidents.filter((inc) =>
      isHazardWithinTimeWindow(inc.activeTimeStart, inc.activeTimeEnd, nightDate)
    );
    assert.equal(nightVisible.length, 2);
    assert.equal(nightVisible.map((i) => i.id).sort().join(','), 'inc-24h,inc-night-only');
  });
});

import { EventEmitter } from 'events';
import { findIntersectingAlertZones } from '../services/alertZoneService';
import { emitUserAlert } from '../sockets';

export const notificationEvents = new EventEmitter();

export interface ReportAlertInput {
  id: string;
  category: string;
  severity: string;
  latitude: number;
  longitude: number;
  description?: string | null;
}

export interface GeofenceAlertPayload {
  type: 'GEOFENCE_ALERT';
  title: string;
  body: string;
  data: {
    reportId: string;
    category: string;
    severity: string;
    latitude: number;
    longitude: number;
    zones: string[];
  };
  timestamp: string;
}

/**
 * Process geofenced notification matching for a newly created report.
 * Finds all active UserAlertZone polygons intersecting with the report's coordinates.
 */
export const processReportNotification = async (
  report: ReportAlertInput
): Promise<{ matchedUsers: number; alerts: Record<string, GeofenceAlertPayload> }> => {
  // 1. PostGIS ST_Intersects spatial check
  const matchingZones = await findIntersectingAlertZones(report.latitude, report.longitude);

  if (!matchingZones || matchingZones.length === 0) {
    return { matchedUsers: 0, alerts: {} };
  }

  // 2. Group intersecting zones by userId to avoid multiple alerts for overlapping zones
  const userZoneMap = new Map<string, string[]>();
  for (const match of matchingZones) {
    const zones = userZoneMap.get(match.userId) || [];
    zones.push(match.zoneName);
    userZoneMap.set(match.userId, zones);
  }

  const alerts: Record<string, GeofenceAlertPayload> = {};

  // 3. Dispatch targeted alerts
  for (const [userId, zoneNames] of userZoneMap.entries()) {
    const alertPayload: GeofenceAlertPayload = {
      type: 'GEOFENCE_ALERT',
      title: '🚨 Urgent Safety Alert: Hazard in Your Monitored Zone',
      body: `A ${report.severity} severity ${report.category} was reported inside "${zoneNames.join(', ')}". Stay vigilant.`,
      data: {
        reportId: report.id,
        category: report.category,
        severity: report.severity,
        latitude: report.latitude,
        longitude: report.longitude,
        zones: zoneNames,
      },
      timestamp: new Date().toISOString(),
    };

    alerts[userId] = alertPayload;

    // A. Targeted real-time WebSocket alert to user's room
    emitUserAlert(userId, alertPayload);

    // B. Mock Web Push Notification payload
    console.log(
      `[Notification Worker] 📲 Web Push dispatched to user ${userId} for zones: [${zoneNames.join(', ')}]`
    );

    // Emit internal event for test assertion hooks
    notificationEvents.emit('alert_dispatched', { userId, payload: alertPayload });
  }

  return { matchedUsers: userZoneMap.size, alerts };
};

/**
 * Enqueue an asynchronous notification check without blocking the calling HTTP request loop.
 */
export const enqueueReportNotification = (report: ReportAlertInput): void => {
  setImmediate(async () => {
    try {
      await processReportNotification(report);
    } catch (error) {
      console.error('[Notification Worker] Error executing asynchronous alert check:', error);
    }
  });
};

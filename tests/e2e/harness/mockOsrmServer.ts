import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { haversineDistance, polylineDistance } from './geoUtils';

export type MockFaultMode = 'none' | '503' | 'timeout' | 'empty' | 'island';

export interface MockOsrmOptions {
  port?: number;
}

export interface OsrmStep {
  instruction?: string;
  distance: number;
  duration: number;
  maneuver: {
    type: string;
    modifier?: string;
    location: [number, number]; // [lng, lat]
  };
  name?: string;
}

export interface OsrmRoute {
  distance: number;
  duration: number;
  geometry: {
    type: 'LineString';
    coordinates: [number, number][]; // [lng, lat][]
  };
  legs: Array<{
    distance: number;
    duration: number;
    steps: OsrmStep[];
  }>;
}

export class MockOsrmServer {
  private server: http.Server | null = null;
  private port = 0;
  private faultMode: MockFaultMode = 'none';
  private faultDelayMs = 0;

  public setFaultMode(mode: MockFaultMode, delayMs = 0): void {
    this.faultMode = mode;
    this.faultDelayMs = delayMs;
  }

  public getUrl(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  public async start(): Promise<string> {
    if (this.server) return this.getUrl();

    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });

    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject);
      this.server!.listen(0, '127.0.0.1', () => {
        const addr = this.server!.address() as AddressInfo;
        this.port = addr.port;
        resolve();
      });
    });

    return this.getUrl();
  }

  public async stop(): Promise<void> {
    if (!this.server) return;
    await new Promise<void>((resolve) => {
      this.server!.close(() => resolve());
    });
    this.server = null;
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    // Check fault injection
    if (this.faultMode === '503') {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Service Unavailable: OSRM routing engine overloaded' }));
      return;
    }

    if (this.faultMode === 'timeout') {
      const delay = this.faultDelayMs || 7000;
      setTimeout(() => {
        if (!res.writableEnded) {
          res.writeHead(504, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'Gateway Timeout' }));
        }
      }, delay);
      return;
    }

    if (this.faultMode === 'empty') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: 'NoRoute', routes: [] }));
      return;
    }

    const url = new URL(req.url || '/', `http://127.0.0.1:${this.port}`);
    const pathname = url.pathname;

    // Expected format: /route/v1/{profile}/{coordinates}
    // e.g. /route/v1/driving/90.3900,23.7500;90.4050,23.7650 or /route/v1/walking/...
    const routeMatch = pathname.match(/^\/route\/v1\/([^/]+)\/(.+)$/);
    if (!routeMatch) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: 'InvalidUrl', message: 'Not found' }));
      return;
    }

    const profile = routeMatch[1]; // 'driving', 'walking', 'foot'
    const coordString = decodeURIComponent(routeMatch[2]);
    const coordPairs = coordString.split(';');

    if (coordPairs.length < 2) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: 'InvalidCoordinates', message: 'Need at least 2 points' }));
      return;
    }

    const [startLngStr, startLatStr] = coordPairs[0].split(',');
    const [endLngStr, endLatStr] = coordPairs[coordPairs.length - 1].split(',');

    const startLng = parseFloat(startLngStr);
    const startLat = parseFloat(startLatStr);
    const endLng = parseFloat(endLngStr);
    const endLat = parseFloat(endLatStr);

    // Island check (e.g. Sandwip Island ~22.48, 91.45 without vehicular bridge)
    if (
      this.faultMode === 'island' ||
      (profile === 'driving' &&
        ((startLat > 22.4 && startLat < 22.6 && startLng > 91.35 && startLng < 91.55) ||
          (endLat > 22.4 && endLat < 22.6 && endLng > 91.35 && endLng < 91.55)))
    ) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          code: 'NoRoute',
          message: 'Impossible route between points: disconnected vehicular graph (island)',
          routes: [],
        })
      );
      return;
    }

    const isWalking = profile === 'walking' || profile === 'foot';
    const alternativesRequested = url.searchParams.get('alternatives') === 'true';

    // Generate routes
    const routes = this.generateRoutes(
      startLat,
      startLng,
      endLat,
      endLng,
      isWalking,
      alternativesRequested
    );

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ code: 'Ok', routes }));
  }

  private generateRoutes(
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number,
    isWalking: boolean,
    alternatives: boolean
  ): OsrmRoute[] {
    // 1. Zero distance check
    if (Math.abs(startLat - endLat) < 1e-7 && Math.abs(startLng - endLng) < 1e-7) {
      return [
        {
          distance: 0,
          duration: 0,
          geometry: {
            type: 'LineString',
            coordinates: [[startLng, startLat]],
          },
          legs: [
            {
              distance: 0,
              duration: 0,
              steps: [
                {
                  distance: 0,
                  duration: 0,
                  instruction: 'You have arrived at your destination.',
                  maneuver: { type: 'arrive', location: [startLng, startLat] },
                  name: 'Destination',
                },
              ],
            },
          ],
        },
      ];
    }

    // 2. Identify known corridor or generate realistic street geometry
    const primaryPolyline = this.getKnownPolyline(startLat, startLng, endLat, endLng);
    const speedMps = isWalking ? 1.25 : 11.1; // ~4.5 km/h walking vs ~40 km/h driving

    const primaryDistance = polylineDistance(primaryPolyline);
    const primaryDuration = Math.round(primaryDistance / speedMps);

    // OSRM coordinates format: [lng, lat]
    const primaryOsrmCoords: [number, number][] = primaryPolyline.map(([lat, lng]) => [lng, lat]);
    const primarySteps = this.generateSteps(primaryPolyline, isWalking);

    const mainRoute: OsrmRoute = {
      distance: Math.round(primaryDistance),
      duration: primaryDuration,
      geometry: {
        type: 'LineString',
        coordinates: primaryOsrmCoords,
      },
      legs: [
        {
          distance: Math.round(primaryDistance),
          duration: primaryDuration,
          steps: primarySteps,
        },
      ],
    };

    if (!alternatives) {
      return [mainRoute];
    }

    // Generate alternative route with slight detour/offset (e.g. bypass avenue)
    const altPolyline = this.generateAlternativePolyline(primaryPolyline);
    const altDistance = polylineDistance(altPolyline);
    const altDuration = Math.round(altDistance / speedMps);
    const altOsrmCoords: [number, number][] = altPolyline.map(([lat, lng]) => [lng, lat]);
    const altSteps = this.generateSteps(altPolyline, isWalking, 'Alternative Bypass');

    const altRoute: OsrmRoute = {
      distance: Math.round(altDistance),
      duration: altDuration,
      geometry: {
        type: 'LineString',
        coordinates: altOsrmCoords,
      },
      legs: [
        {
          distance: Math.round(altDistance),
          duration: altDuration,
          steps: altSteps,
        },
      ],
    };

    return [mainRoute, altRoute];
  }

  private getKnownPolyline(
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number
  ): [number, number][] {
    // Khulna Royal Square [22.811600, 89.561100] -> Khulna Railway Station [22.802473, 89.558654]
    if (
      Math.abs(startLat - 22.8116) < 0.002 &&
      Math.abs(startLng - 89.5611) < 0.002 &&
      Math.abs(endLat - 22.802473) < 0.002 &&
      Math.abs(endLng - 89.558654) < 0.002
    ) {
      return [
        [22.8116, 89.5611],
        [22.8112, 89.5613],
        [22.8105, 89.5617],
        [22.8098, 89.5621],
        [22.8091, 89.5622],
        [22.8082, 89.5619],
        [22.8075, 89.5614],
        [22.8068, 89.5608],
        [22.8061, 89.5602],
        [22.8055, 89.5597],
        [22.8048, 89.5594],
        [22.8041, 89.5591],
        [22.8035, 89.5589],
        [22.8029, 89.5587],
        [22.8026, 89.55868],
        [22.802473, 89.558654],
      ];
    }

    // Dhaka Mirpur 10 Circle [23.8070, 90.3685] -> Gulshan 2 Circle [23.7937, 90.4137]
    if (
      Math.abs(startLat - 23.807) < 0.005 &&
      Math.abs(startLng - 90.3685) < 0.005 &&
      Math.abs(endLat - 23.7937) < 0.005 &&
      Math.abs(endLng - 90.4137) < 0.005
    ) {
      const coords: [number, number][] = [];
      const stepsCount = 32;
      for (let i = 0; i <= stepsCount; i++) {
        const t = i / stepsCount;
        const lat = startLat + t * (endLat - startLat) + Math.sin(t * Math.PI) * 0.004;
        const lng = startLng + t * (endLng - startLng) - Math.sin(t * Math.PI) * 0.003;
        coords.push([parseFloat(lat.toFixed(6)), parseFloat(lng.toFixed(6))]);
      }
      return coords;
    }

    // Dhaka Farmgate [23.7500, 90.3900] -> Mohakhali [23.7650, 90.4050]
    if (
      Math.abs(startLat - 23.75) < 0.005 &&
      Math.abs(startLng - 90.39) < 0.005 &&
      Math.abs(endLat - 23.765) < 0.005 &&
      Math.abs(endLng - 90.405) < 0.005
    ) {
      const coords: [number, number][] = [];
      const stepsCount = 18;
      for (let i = 0; i <= stepsCount; i++) {
        const t = i / stepsCount;
        const lat = startLat + t * (endLat - startLat) + Math.sin(t * Math.PI * 2) * 0.0015;
        const lng = startLng + t * (endLng - startLng) + Math.sin(t * Math.PI) * 0.002;
        coords.push([parseFloat(lat.toFixed(6)), parseFloat(lng.toFixed(6))]);
      }
      return coords;
    }

    // Generic realistic street path generator: creates intermediate street nodes with bends
    const directDist = haversineDistance(startLat, startLng, endLat, endLng);
    const nodeCount = directDist < 100 ? 5 : directDist < 500 ? 10 : directDist < 5000 ? 18 : 30;

    const maxLatFactor = Math.min(0.001, (directDist / 111320) * 0.08);
    const coords: [number, number][] = [];
    for (let i = 0; i <= nodeCount; i++) {
      const t = i / nodeCount;
      // Add realistic street curve deviation proportional to corridor length
      const lateralFactor = Math.sin(t * Math.PI) * maxLatFactor;
      const lat = startLat + t * (endLat - startLat) + (i % 2 === 0 ? lateralFactor : -lateralFactor * 0.5);
      const lng = startLng + t * (endLng - startLng) + (i % 2 === 1 ? lateralFactor : -lateralFactor * 0.3);
      coords.push([parseFloat(lat.toFixed(6)), parseFloat(lng.toFixed(6))]);
    }

    return coords;
  }

  private generateAlternativePolyline(base: [number, number][]): [number, number][] {
    const alt: [number, number][] = [];
    const n = base.length;
    for (let i = 0; i < n; i++) {
      if (i === 0 || i === n - 1) {
        alt.push([...base[i]]);
      } else {
        const t = i / n;
        // Introduce an offset detour for alternative route
        const offsetLat = Math.sin(t * Math.PI) * 0.0025;
        const offsetLng = Math.sin(t * Math.PI) * 0.0025;
        alt.push([
          parseFloat((base[i][0] + offsetLat).toFixed(6)),
          parseFloat((base[i][1] + offsetLng).toFixed(6)),
        ]);
      }
    }
    return alt;
  }

  private generateSteps(
    polyline: [number, number][],
    isWalking: boolean,
    streetPrefix = 'Main Corridor'
  ): OsrmStep[] {
    const steps: OsrmStep[] = [];
    const n = polyline.length;

    // Step 1: Depart
    const departDist = haversineDistance(polyline[0][0], polyline[0][1], polyline[1][0], polyline[1][1]);
    const speed = isWalking ? 1.25 : 11.1;

    steps.push({
      distance: Math.round(departDist),
      duration: Math.round(departDist / speed),
      instruction: `Head on ${streetPrefix}`,
      maneuver: {
        type: 'depart',
        location: [polyline[0][1], polyline[0][0]], // [lng, lat]
      },
      name: streetPrefix,
    });

    // Intermediate turns
    const midIndex = Math.floor(n / 2);
    if (n >= 4) {
      const turnDist = haversineDistance(polyline[1][0], polyline[1][1], polyline[midIndex][0], polyline[midIndex][1]);
      steps.push({
        distance: Math.round(turnDist),
        duration: Math.round(turnDist / speed),
        instruction: 'Turn right onto Connector Road',
        maneuver: {
          type: 'turn',
          modifier: 'right',
          location: [polyline[midIndex][1], polyline[midIndex][0]],
        },
        name: 'Connector Road',
      });
    }

    // Step Final: Arrive
    const lastCoord = polyline[n - 1];
    const prevCoord = polyline[n - 2];
    const finalDist = haversineDistance(prevCoord[0], prevCoord[1], lastCoord[0], lastCoord[1]);

    steps.push({
      distance: Math.round(finalDist),
      duration: Math.round(finalDist / speed),
      instruction: 'You have arrived at your destination',
      maneuver: {
        type: 'arrive',
        location: [lastCoord[1], lastCoord[0]],
      },
      name: 'Destination',
    });

    return steps;
  }
}

import http from 'node:http';
import type { AddressInfo } from 'node:net';

export interface NominatimPlace {
  place_id: number;
  licence: string;
  osm_type: string;
  osm_id: number;
  boundingbox: [string, string, string, string];
  lat: string;
  lon: string;
  display_name: string;
  class: string;
  type: string;
  importance: number;
  address?: {
    police?: string;
    suburb?: string;
    city?: string;
    state_district?: string;
    state?: string;
    country: string;
    country_code: string;
  };
}

export type MockNominatimFault = 'none' | '500' | '429' | 'timeout' | 'empty';

export class MockNominatimServer {
  private server: http.Server | null = null;
  private port = 0;
  private faultMode: MockNominatimFault = 'none';
  private delayMs = 0;
  private rateLimitEnabled = false;
  private minIntervalMs = 1000; // 1 second OSM Nominatim standard
  private lastRequestTime = 0;
  private customLocations: Map<string, NominatimPlace[]> = new Map();
  private requestLog: Array<{ url: string; timestamp: number }> = [];

  constructor() {
    this.initDefaultLocations();
  }

  private initDefaultLocations(): void {
    this.customLocations.clear();
    this.faultMode = 'none';
    this.delayMs = 0;
    this.rateLimitEnabled = false;
    this.lastRequestTime = 0;
    this.requestLog = [];

    // Pre-populate core Bangladesh administrative hubs
    const defaults: Record<string, NominatimPlace[]> = {
      dhaka: [
        {
          place_id: 1001,
          licence: 'Data © OpenStreetMap contributors, ODbL 1.0.',
          osm_type: 'node',
          osm_id: 10001,
          boundingbox: ['23.70', '23.90', '90.35', '90.45'],
          lat: '23.810332',
          lon: '90.412518',
          display_name: 'Dhaka, Dhaka District, Dhaka Division, Bangladesh',
          class: 'place',
          type: 'city',
          importance: 0.85,
          address: {
            city: 'Dhaka',
            state_district: 'Dhaka',
            state: 'Dhaka',
            country: 'Bangladesh',
            country_code: 'bd',
          },
        },
      ],
      ramna: [
        {
          place_id: 1002,
          licence: 'Data © OpenStreetMap contributors, ODbL 1.0.',
          osm_type: 'node',
          osm_id: 10002,
          boundingbox: ['23.74', '23.75', '90.40', '90.41'],
          lat: '23.745713',
          lon: '90.404659',
          display_name: 'Ramna Model Thana, Dhaka, Dhaka Division, Bangladesh',
          class: 'amenity',
          type: 'police',
          importance: 0.75,
          address: {
            police: 'Ramna Model Thana',
            suburb: 'Ramna',
            city: 'Dhaka',
            state_district: 'Dhaka',
            state: 'Dhaka',
            country: 'Bangladesh',
            country_code: 'bd',
          },
        },
      ],
      teknaf: [
        {
          place_id: 1003,
          licence: 'Data © OpenStreetMap contributors, ODbL 1.0.',
          osm_type: 'node',
          osm_id: 10003,
          boundingbox: ['20.80', '20.90', '92.25', '92.35'],
          lat: '20.865200',
          lon: '92.298500',
          display_name: 'Teknaf, Cox\'s Bazar, Chattogram Division, Bangladesh',
          class: 'place',
          type: 'town',
          importance: 0.65,
          address: {
            suburb: 'Teknaf',
            state_district: 'Cox\'s Bazar',
            state: 'Chattogram',
            country: 'Bangladesh',
            country_code: 'bd',
          },
        },
      ],
      tetulia: [
        {
          place_id: 1004,
          licence: 'Data © OpenStreetMap contributors, ODbL 1.0.',
          osm_type: 'node',
          osm_id: 10004,
          boundingbox: ['26.60', '26.70', '88.30', '88.40'],
          lat: '26.650000',
          lon: '88.350000',
          display_name: 'Tetulia, Panchagarh, Rangpur Division, Bangladesh',
          class: 'place',
          type: 'town',
          importance: 0.65,
          address: {
            suburb: 'Tetulia',
            state_district: 'Panchagarh',
            state: 'Rangpur',
            country: 'Bangladesh',
            country_code: 'bd',
          },
        },
      ],
      sitakunda: [
        {
          place_id: 1005,
          licence: 'Data © OpenStreetMap contributors, ODbL 1.0.',
          osm_type: 'node',
          osm_id: 10005,
          boundingbox: ['22.60', '22.70', '91.60', '91.70'],
          lat: '22.620000',
          lon: '91.660000',
          display_name: 'Sitakunda, Chattogram, Chattogram Division, Bangladesh',
          class: 'place',
          type: 'town',
          importance: 0.65,
          address: {
            suburb: 'Sitakunda',
            state_district: 'Chattogram',
            state: 'Chattogram',
            country: 'Bangladesh',
            country_code: 'bd',
          },
        },
      ],
    };

    for (const [key, val] of Object.entries(defaults)) {
      this.customLocations.set(key.toLowerCase(), val);
    }
  }

  public async start(): Promise<string> {
    if (this.server) {
      return this.getUrl();
    }

    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        try {
          await this.handleRequest(req, res);
        } catch {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal Server Error' }));
        }
      });

      this.server.listen(0, '127.0.0.1', () => {
        const addr = this.server!.address() as AddressInfo;
        this.port = addr.port;
        resolve(this.getUrl());
      });

      this.server.on('error', reject);
    });
  }

  public async stop(): Promise<void> {
    if (!this.server) return;
    return new Promise((resolve) => {
      this.server!.close(() => {
        this.server = null;
        this.port = 0;
        resolve();
      });
    });
  }

  public getUrl(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  public getSearchUrl(query: string): string {
    return `${this.getUrl()}/search?q=${encodeURIComponent(query)}&format=json&countrycodes=bd`;
  }

  public setFaultMode(fault: MockNominatimFault, delayMs = 0): void {
    this.faultMode = fault;
    this.delayMs = delayMs;
  }

  public setRateLimitEnabled(enabled: boolean, minIntervalMs = 1000): void {
    this.rateLimitEnabled = enabled;
    this.minIntervalMs = minIntervalMs;
  }

  public registerLocation(query: string, results: NominatimPlace[]): void {
    this.customLocations.set(query.toLowerCase().trim(), results);
  }

  public getRequestLog(): Array<{ url: string; timestamp: number }> {
    return [...this.requestLog];
  }

  public reset(): void {
    this.initDefaultLocations();
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const now = Date.now();
    const urlStr = req.url || '/';
    this.requestLog.push({ url: urlStr, timestamp: now });

    // Rate limiting check
    if (this.rateLimitEnabled && this.lastRequestTime > 0) {
      const elapsed = now - this.lastRequestTime;
      if (elapsed < this.minIntervalMs) {
        this.lastRequestTime = now;
        res.writeHead(429, {
          'Content-Type': 'application/json',
          'Retry-After': '1',
        });
        res.end(JSON.stringify({ error: 'Too Many Requests', message: 'OSM Nominatim 1 req/sec policy exceeded' }));
        return;
      }
    }
    this.lastRequestTime = now;

    if (this.delayMs > 0) {
      await new Promise((r) => setTimeout(r, this.delayMs));
    }

    if (this.faultMode === '500') {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal Server Error (Mock Fault)' }));
      return;
    }

    if (this.faultMode === '429') {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Too Many Requests (Mock Fault)' }));
      return;
    }

    if (this.faultMode === 'empty') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([]));
      return;
    }

    // Parse query parameter q
    const parsedUrl = new URL(urlStr, `http://127.0.0.1:${this.port}`);
    const query = (parsedUrl.searchParams.get('q') || '').toLowerCase().trim();

    let matched: NominatimPlace[] = [];
    for (const [key, places] of this.customLocations.entries()) {
      if (query.includes(key) || key.includes(query)) {
        matched = places;
        break;
      }
    }

    // If no exact keyword match, synthesize a valid Bangladesh response or empty
    if (matched.length === 0 && query.length > 0) {
      matched = [
        {
          place_id: 9999,
          licence: 'Data © OpenStreetMap contributors, ODbL 1.0.',
          osm_type: 'node',
          osm_id: 99999,
          boundingbox: ['23.70', '23.85', '90.35', '90.45'],
          lat: '23.780000',
          lon: '90.400000',
          display_name: `${query}, Bangladesh`,
          class: 'place',
          type: 'locality',
          importance: 0.5,
          address: {
            suburb: query,
            state: 'Dhaka',
            country: 'Bangladesh',
            country_code: 'bd',
          },
        },
      ];
    }

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(matched));
  }
}

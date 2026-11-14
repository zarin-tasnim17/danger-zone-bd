import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { z } from 'zod';
import { MockOsrmServer, type MockFaultMode } from './mockOsrmServer';
import { calculateSafeRoute } from '../../../apps/api/src/services/safeRouteService';
import type {
  SafeRouteOutput,
  RouteAlternative,
  LocalizedHazard,
  NavigationStep,
  TransportMode,
  RouteSafetyRating,
} from '@repo/shared';

export interface TestHazard {
  id: string;
  category: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  latitude: number;
  longitude: number;
  status?: 'ACTIVE' | 'RESOLVED' | 'PURGED';
  expiresAt?: Date | string;
  createdAt?: Date | string;
  description?: string | null;
  approxStreetName?: string;
  isVerified?: boolean;
  upvotes?: number;
}

export interface ApiResponseWrapper {
  status: number;
  body: any;
  headers: Record<string, string>;
}

export class ApiAdapter {
  private mode: 'hermetic' | 'live' = 'hermetic';
  private mockOsrm: MockOsrmServer;
  private server: http.Server | null = null;
  private port = 0;
  private hazards: Map<string, TestHazard> = new Map();
  private liveApiBaseUrl = process.env.API_BASE_URL || 'http://127.0.0.1:5000/api/v1';

  constructor(mode?: 'hermetic' | 'live') {
    this.mode = mode || (process.env.TEST_MODE === 'live' ? 'live' : 'hermetic');
    this.mockOsrm = new MockOsrmServer();
  }

  public getMode(): 'hermetic' | 'live' {
    return this.mode;
  }

  public setMockOsrmFault(fault: MockFaultMode, delayMs = 0): void {
    this.mockOsrm.setFaultMode(fault, delayMs);
  }

  public seedHazard(hazard: TestHazard): void {
    this.hazards.set(hazard.id, {
      status: 'ACTIVE',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      isVerified: false,
      upvotes: 0,
      ...hazard,
    });
  }

  public seedHazards(hazards: TestHazard[]): void {
    for (const h of hazards) {
      this.seedHazard(h);
    }
  }

  public clearHazards(): void {
    this.hazards.clear();
  }

  public getHazards(): TestHazard[] {
    return Array.from(this.hazards.values());
  }

  public async start(): Promise<void> {
    if (this.mode === 'hermetic') {
      const osrmUrl = await this.mockOsrm.start();
      process.env.OSRM_BASE_URL = osrmUrl;

      if (!this.server) {
        this.server = http.createServer((req, res) => {
          this.handleHermeticRequest(req, res);
        });

        await new Promise<void>((resolve, reject) => {
          this.server!.once('error', reject);
          this.server!.listen(0, '127.0.0.1', () => {
            const addr = this.server!.address() as AddressInfo;
            this.port = addr.port;
            resolve();
          });
        });
      }
    }
  }

  public async stop(): Promise<void> {
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve());
      });
      this.server = null;
    }
    await this.mockOsrm.stop();
  }

  public getBaseUrl(): string {
    if (this.mode === 'live') {
      return this.liveApiBaseUrl;
    }
    return `http://127.0.0.1:${this.port}/api/v1`;
  }

  public async calculateSafeRoute(
    payload: any,
    options?: { headers?: Record<string, string>; timeoutMs?: number }
  ): Promise<ApiResponseWrapper> {
    const baseUrl = this.getBaseUrl();
    const url = `${baseUrl}/routes/safe-path`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options?.timeoutMs || 10000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        body: typeof payload === 'string' ? payload : JSON.stringify(payload),
        signal: controller.signal,
      });

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key.toLowerCase()] = value;
      });

      let body: any;
      const text = await response.text();
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }

      return {
        status: response.status,
        body,
        headers: responseHeaders,
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return {
          status: 504,
          body: { success: false, error: { code: 'GATEWAY_TIMEOUT', message: 'Request timeout' } },
          headers: {},
        };
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async handleHermeticRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    const url = new URL(req.url || '/', `http://127.0.0.1:${this.port}`);
    if (req.method !== 'POST' || !url.pathname.endsWith('/routes/safe-path')) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Not found' }));
      return;
    }

    // Read body
    let rawBody = '';
    for await (const chunk of req) {
      rawBody += chunk;
    }

    let parsedBody: any;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          error: { code: 'INVALID_JSON', message: 'Malformed JSON payload' },
        })
      );
      return;
    }

    // Strict schema check matching API controller
    const schema = z
      .object({
        startLat: z.number().min(-90).max(90),
        startLng: z.number().min(-180).max(180),
        endLat: z.number().min(-90).max(90),
        endLng: z.number().min(-180).max(180),
        mode: z.enum(['walking', 'driving']).optional(),
      })
      .strict();

    const validation = schema.safeParse(parsedBody);
    if (!validation.success) {
      const issues = validation.error.issues || (validation.error as any).errors || [];
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', '),
          },
        })
      );
      return;
    }

    const { startLat, startLng, endLat, endLng, mode = 'driving' } = validation.data;

    try {
      const output = await calculateSafeRoute(
        { latitude: startLat, longitude: startLng },
        { latitude: endLat, longitude: endLng },
        mode,
        {
          injectedHazards: this.getHazards(),
          osrmBaseUrl: this.mockOsrm.getUrl(),
        }
      );

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: output }));
    } catch (err: any) {
      const status = err.statusCode || 500;
      let code = 'INTERNAL_ERROR';
      if (status === 400) code = 'INVALID_COORDINATES';
      else if (status === 422) code = 'NO_ROUTE_FOUND';
      else if (status === 503) code = 'ROUTING_SERVICE_UNAVAILABLE';
      else if (status === 504) code = 'GATEWAY_TIMEOUT';

      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          error: {
            code,
            message: err.message || 'Routing calculation failed',
          },
        })
      );
    }
  }
}


import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { env } from '../../src/config/env';
import { ApiClient } from './apiClient';
import { prisma, TestDataTracker } from './dbTracker';
import { randomSuffix } from './fixtures';

export interface TestActor {
  id: string;
  email: string;
  anonymousId: string;
  role: Role;
  isVerified: boolean;
  accessToken: string;
  refreshToken: string;
  socketToken: string;
  client: ApiClient;
}

let ipCounter = 10;
export const nextTestIp = (): string => {
  ipCounter = (ipCounter % 240) + 10;
  const third = Math.floor(Math.random() * 200) + 10;
  return `10.99.${third}.${ipCounter}`;
};

export const createDeviceActor = async (
  baseUrl: string,
  tracker: TestDataTracker,
  opts: { anonymousId?: string; email?: string; ip?: string } = {}
): Promise<TestActor> => {
  const client = new ApiClient(baseUrl, opts.ip ?? nextTestIp());
  const anonymousId = opts.anonymousId ?? `test-dev-${randomSuffix()}`;
  const res = await client.post('/api/v1/auth/device', {
    anonymousId,
    ...(opts.email ? { email: opts.email } : {}),
  });

  if (res.status !== 201 || !res.body?.data?.user?.id) {
    throw new Error(
      `Failed to create device actor (${res.status}): ${JSON.stringify(res.body)}`
    );
  }

  const id: string = res.body.data.user.id;
  tracker.trackUser(id);

  const accessToken = client.getCookie('accessToken') || '';
  const refreshToken = client.getCookie('refreshToken') || '';
  const socketToken: string = res.body.data.socketToken || '';

  return {
    id,
    email: opts.email ?? `${anonymousId}@anonymous.local`,
    anonymousId,
    role: 'USER',
    isVerified: false,
    accessToken,
    refreshToken,
    socketToken,
    client,
  };
};

export const createPrivilegedActor = async (
  baseUrl: string,
  tracker: TestDataTracker,
  opts: {
    role?: Role;
    isVerified?: boolean;
    trustScore?: number;
    password?: string;
    ip?: string;
  } = {}
): Promise<TestActor> => {
  const suffix = randomSuffix();
  const role = opts.role ?? 'USER';
  const password = opts.password ?? `TestPass!_${suffix}`;
  const passwordHash = await bcrypt.hash(password, 10);
  const email = `audit-${role.toLowerCase()}-${suffix}@test.local`;
  const anonymousId = `audit-${role.toLowerCase()}-${suffix}`;

  const created = await prisma.user.create({
    data: {
      email,
      passwordHash,
      anonymousId,
      role,
      isVerified: opts.isVerified ?? role !== 'USER',
      trustScore: opts.trustScore ?? (role === 'ADMIN' ? 100 : 10),
    },
  });
  tracker.trackUser(created.id);

  const client = new ApiClient(baseUrl, opts.ip ?? nextTestIp());
  const loginRes = await client.post('/api/v1/auth/login', { email, password });

  const accessToken = client.getCookie('accessToken') || loginRes.body?.data?.accessToken || '';
  const refreshToken = client.getCookie('refreshToken') || loginRes.body?.data?.refreshToken || '';

  if (loginRes.status !== 200 || !accessToken) {
    throw new Error(
      `Failed to log in privileged actor (${loginRes.status}): ${JSON.stringify(loginRes.body)}`
    );
  }

  return {
    id: created.id,
    email,
    anonymousId,
    role: created.role,
    isVerified: created.isVerified,
    accessToken,
    refreshToken,
    socketToken: loginRes.body?.data?.socketToken || '',
    client,
  };
};

export const mintCustomAccessToken = (
  payload: Record<string, unknown>,
  options: { secret?: string; expiresIn?: string | number; algorithm?: jwt.Algorithm } = {}
): string => {
  if (options.algorithm === ('none' as any)) {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(
      JSON.stringify({
        ...payload,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 900,
      })
    ).toString('base64url');
    return `${header}.${body}.`;
  }
  return jwt.sign(payload, options.secret ?? env.JWT_SECRET, {
    expiresIn: (options.expiresIn ?? '15m') as any,
    ...(options.algorithm ? { algorithm: options.algorithm } : {}),
  });
};

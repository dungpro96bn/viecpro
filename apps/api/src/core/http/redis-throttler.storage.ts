import { Injectable, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { createClient } from 'redis';
import type { ThrottlerStorage } from '@nestjs/throttler';

const INCREMENT_SCRIPT = `
local blockedTtl = redis.call('PTTL', KEYS[2])
if blockedTtl > 0 then
  local remainingTtl = redis.call('PTTL', KEYS[1])
  if remainingTtl < 0 then remainingTtl = tonumber(ARGV[1]) end
  return { tonumber(ARGV[2]) + 1, remainingTtl, 1, blockedTtl }
end
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
local ttl = tonumber(ARGV[1])
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - ttl)
local count = redis.call('ZCARD', KEYS[1])
if count >= tonumber(ARGV[2]) then
  local block = tonumber(ARGV[3])
  redis.call('SET', KEYS[2], '1', 'PX', block)
  redis.call('DEL', KEYS[1])
  return { count + 1, ttl, 1, block }
end
redis.call('ZADD', KEYS[1], now, ARGV[4])
redis.call('PEXPIRE', KEYS[1], ttl)
local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
local expiration = ttl
if oldest[2] then expiration = ttl - (now - tonumber(oldest[2])) end
return { count + 1, expiration, 0, 0 }
`;

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage, OnModuleInit, OnApplicationShutdown {
  private readonly client;

  constructor(url: string) {
    this.client = createClient({ url });
    this.client.on('error', () => undefined);
  }

  async onModuleInit() {
    if (!this.client.isOpen) await this.client.connect();
  }

  async increment(key: string, ttl: number, limit: number, blockDuration: number, throttlerName: string) {
    if (!this.client.isOpen) await this.client.connect();
    const namespaced = `viecpro:throttle:${throttlerName}:${key}`;
    const now = Date.now();
    const values = await this.client.eval(INCREMENT_SCRIPT, {
      keys: [namespaced, `${namespaced}:blocked`],
      arguments: [String(ttl), String(limit), String(blockDuration), `${now}:${Math.random()}`],
    }) as number[];
    const [totalHits, timeToExpire, isBlocked, timeToBlockExpire] = values;
    return {
      totalHits: Number(totalHits),
      timeToExpire: Math.max(0, Math.ceil(Number(timeToExpire) / 1000)),
      isBlocked: Number(isBlocked) === 1,
      timeToBlockExpire: Math.max(0, Math.ceil(Number(timeToBlockExpire) / 1000)),
    };
  }

  async onApplicationShutdown() {
    if (this.client.isOpen) await this.client.quit();
  }
}

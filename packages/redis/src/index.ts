import { createClient, RedisClientType } from "redis";

let redisClient: RedisClientType | null = null;

export async function getRedisClient(): Promise<RedisClientType> {
  if (redisClient) {
    return redisClient;
  }

  redisClient = createClient({
    url: process.env.REDIS_URL,
  });

  redisClient.on("error", (err) => {
    console.error("Redis Client Error", err);
  });

  await redisClient.connect();
  return redisClient;
}

export async function healthCheckRedis(): Promise<boolean> {
  try {
    const client = await getRedisClient();
    const result = await client.ping();
    return result === "PONG";
  } catch (error) {
    console.error("Redis Health Check Failed:", error);
    return false;
  }
}

type RedisXReadMessage = { id: string; message: Record<string, string> };
type RedisXReadStream = { name: string; messages: RedisXReadMessage[] };

export async function redisXRead(
  streamKey: string,
  sinceId: string,
  count = 100
): Promise<RedisXReadStream[] | null> {
  const client = await getRedisClient();

  const result = (await client.xRead(
    [{ key: streamKey, id: sinceId }],
    { COUNT: count, BLOCK: 0 }
  )) as unknown as RedisXReadStream[] | null;

  if (!result || result.length === 0) return null;
  return result;
}
/** Redis key patterns — enforced at type level */
export type RedisKeyPattern =
  | `bw:queue:${string}`
  | `bw:job:${string}`
  | `bw:progress:${string}`
  | `bw:session:${string}`
  | `preview_data:${string}`
  | `login:attempts:${string}`;

/** Queue name literals */
export type QueueName = 'imports' | 'push_notifications';

/** Build queue key from queue name */
export type QueueKey = `bw:queue:${QueueName}`;

/** Build job key from job ID */
export type JobKey = `bw:job:${string}`;

export function createRateLimitService({
  model,
  clock = () => new Date(),
}) {
  return {
    async consume({ bucketKey, limit, windowMs }) {
      const now = clock();
      const cutoff = new Date(now.getTime() - windowMs);
      const expiredAt = new Date(now.getTime() + windowMs * 2);
      const withinWindow = {
        $gt: [
          { $ifNull: ['$windowStartedAt', new Date(0)] },
          cutoff,
        ],
      };
      const pipeline = [
        {
          $set: {
            windowStartedAt: {
              $cond: [
                withinWindow,
                '$windowStartedAt',
                now,
              ],
            },
            count: {
              $cond: [
                withinWindow,
                { $add: [{ $ifNull: ['$count', 0] }, 1] },
                1,
              ],
            },
            expiresAt: expiredAt,
          },
        },
      ];

      let bucket;

      try {
        bucket = await model.findOneAndUpdate(
          { bucketKey },
          pipeline,
          { new: true, upsert: true },
        );
      } catch (error) {
        if (error.code !== 11000) {
          throw error;
        }

        bucket = await model.findOneAndUpdate(
          { bucketKey },
          pipeline,
          { new: true, upsert: false },
        );
      }

      if (!bucket) {
        throw new Error('Unable to update authentication rate limit');
      }

      return {
        allowed: bucket.count <= limit,
        retryAfterMs: Math.max(
          0,
          new Date(bucket.windowStartedAt).getTime() + windowMs - now.getTime(),
        ),
      };
    },
  };
}

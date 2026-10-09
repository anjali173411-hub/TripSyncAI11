export function rateLimit({ max, windowMinutes, message }) {
  const windowMs = windowMinutes * 60 * 1000;
  const attempts = new Map();

  return function (req, res, next) {
    const now = Date.now();
    const key = req.ip;
    let entry = attempts.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      attempts.set(key, entry);
    }

    entry.count += 1;

    if (entry.count > max) {
      const minutesLeft = Math.ceil((entry.resetAt - now) / 60000);
      res.set("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({
        message: `${message} Try again in ${minutesLeft} minute(s).`,
      });
    }

    if (attempts.size > 10000) {
      for (const [ip, value] of attempts) {
        if (value.resetAt <= now) attempts.delete(ip);
      }
    }

    next();
  };
}

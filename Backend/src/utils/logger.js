function writeLog(sink, level, event, fields) {
  const entry = {
    ...fields,
    timestamp: new Date().toISOString(),
    level,
    event,
  };
  const serializedEntry = JSON.stringify(entry);

  if (level === 'error') {
    sink.error(serializedEntry);
    return;
  }

  if (level === 'warn') {
    sink.warn(serializedEntry);
    return;
  }

  sink.log(serializedEntry);
}

export function createLogger(sink = console) {
  return {
    info(event, fields = {}) {
      writeLog(sink, 'info', event, fields);
    },
    warn(event, fields = {}) {
      writeLog(sink, 'warn', event, fields);
    },
    error(event, fields = {}) {
      writeLog(sink, 'error', event, fields);
    },
  };
}

export const logger = createLogger();

import { useEffect, useState } from 'react';
import { apiGet } from '../lib/api.js';

export function useCatalog(path) {
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    setState({ data: null, loading: true, error: null });

    apiGet(path, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) {
          setState({ data, loading: false, error: null });
        }
      })
      .catch((error) => {
        if (error.name !== 'AbortError' && !controller.signal.aborted) {
          setState({ data: null, loading: false, error });
        }
      });

    return () => controller.abort();
  }, [path]);

  return state;
}

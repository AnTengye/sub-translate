import { useState } from 'react';

type AsyncActionStatus = 'idle' | 'pending' | 'success' | 'error';

export function useAsyncAction() {
  const [status, setStatus] = useState<AsyncActionStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  async function run<T>(task: () => Promise<T>) {
    setStatus('pending');
    setError(null);
    try {
      const result = await task();
      setStatus('success');
      return result;
    } catch (taskError) {
      setStatus('error');
      setError(taskError instanceof Error ? taskError.message : '操作失败');
      throw taskError;
    }
  }

  function reset() {
    setStatus('idle');
    setError(null);
  }

  return {
    status,
    error,
    isPending: status === 'pending',
    run,
    reset,
  };
}

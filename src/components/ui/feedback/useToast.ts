import { useToastContext } from './ToastProvider';

export function useToast() {
  const { pushToast } = useToastContext();

  return {
    success: (message: string) => pushToast(message, 'success'),
    error: (message: string) => pushToast(message, 'error'),
    info: (message: string) => pushToast(message, 'info'),
  };
}

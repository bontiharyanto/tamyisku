import { Platform } from 'react-native';

export type PaymentChannel = 'qris' | 'store';

/** Web checkout uses Midtrans or Xendit. Store builds must use the platform billing API. */
export function paymentChannel(): PaymentChannel {
  return Platform.OS === 'web' ? 'qris' : 'store';
}

export function paymentsMode() {
  return process.env.EXPO_PUBLIC_PAYMENTS_MODE === 'live' ? 'live' : 'sandbox';
}

export function webAppUrl() {
  return process.env.EXPO_PUBLIC_WEB_URL || '';
}

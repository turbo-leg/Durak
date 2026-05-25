import { useEffect, useState, useCallback } from 'react';
import { Purchases, LOG_LEVEL } from '@revenuecat/purchases-capacitor';
import type { PurchasesPackage } from '@revenuecat/purchases-typescript-internal-esm';
import { Capacitor } from '@capacitor/core';

export const COIN_PRODUCTS = {
  coins_small: { id: 'coins_small', coins: 500, label: '500 Coins' },
  coins_medium: { id: 'coins_medium', coins: 1200, label: '1,200 Coins' },
  coins_large: { id: 'coins_large', coins: 3000, label: '3,000 Coins' },
  coins_mega: { id: 'coins_mega', coins: 7500, label: '7,500 Coins' },
} as const;

export type CoinProductId = keyof typeof COIN_PRODUCTS;

export interface IAPProduct {
  id: CoinProductId;
  coins: number;
  label: string;
  price: string; // formatted price from store, e.g. "$0.99"
}

const RC_API_KEY_IOS = import.meta.env.VITE_RC_API_KEY_IOS ?? '';
const RC_API_KEY_ANDROID = import.meta.env.VITE_RC_API_KEY_ANDROID ?? '';

let initialized = false;

async function initRC() {
  if (initialized || !Capacitor.isNativePlatform()) return;
  const key = Capacitor.getPlatform() === 'ios' ? RC_API_KEY_IOS : RC_API_KEY_ANDROID;
  if (!key) return;
  await Purchases.setLogLevel({ level: LOG_LEVEL.ERROR });
  await Purchases.configure({ apiKey: key });
  initialized = true;
}

export function useIAP() {
  const [products, setProducts] = useState<IAPProduct[]>([]);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    initRC().then(async () => {
      try {
        const offerings = await Purchases.getOfferings();
        const current = offerings.current;
        if (!current) return;
        const mapped: IAPProduct[] = current.availablePackages
          .filter((pkg: PurchasesPackage) => pkg.identifier in COIN_PRODUCTS)
          .map((pkg: PurchasesPackage) => ({
            ...COIN_PRODUCTS[pkg.identifier as CoinProductId],
            price: pkg.product.priceString,
          }));
        setProducts(mapped);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }, []);

  const purchaseCoinPack = useCallback(async (productId: CoinProductId): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) {
      setError('IAP only available on native app');
      return false;
    }
    setPurchasing(true);
    setError(null);
    try {
      await initRC();
      const offerings = await Purchases.getOfferings();
      const pkg = offerings.current?.availablePackages.find(
        (p: PurchasesPackage) => p.identifier === productId,
      );
      if (!pkg) throw new Error('Product not found');

      const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });

      // Validate server-side and credit coins
      const res = await fetch('/api/iap/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, customerInfo }),
      });
      if (!res.ok) throw new Error('Server validation failed');
      return true;
    } catch (e: any) {
      if (e.code !== '1') setError(e.message); // code 1 = user cancelled
      return false;
    } finally {
      setPurchasing(false);
    }
  }, []);

  const restorePurchases = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await initRC();
      await Purchases.restorePurchases();
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  return { products, purchasing, error, purchaseCoinPack, restorePurchases };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { ensurePermission } from '@/lib/permissions';
import type { LatLng } from '@/lib/geo';

export interface Fix extends LatLng {
  accuracy: number | null;
  timestamp: number;
}

/**
 * Location capabilities used across the site-location screen, map and
 * geofenced attendance:
 * - one-shot current position
 * - continuous watch (watchPositionAsync) with guaranteed cleanup
 * - reverse geocoding (coords → address) via the device geocoder
 */
export function useLocation() {
  const [permission, setPermission] = useState<{ granted: boolean; canAskAgain: boolean } | null>(null);
  const [position, setPosition] = useState<Fix | null>(null);
  const [lastKnown, setLastKnown] = useState<Fix | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tracking, setTracking] = useState(false);
  const watchSubRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    let mounted = true;
    // Warm the permission state + last known fix without prompting.
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (!mounted) return;
      const granted = status === 'granted';
      setPermission({ granted, canAskAgain: true });
      if (granted) {
        try {
          const last = await Location.getLastKnownPositionAsync();
          if (mounted && last) {
            setLastKnown({
              latitude: last.coords.latitude,
              longitude: last.coords.longitude,
              accuracy: last.coords.accuracy ?? null,
              timestamp: last.timestamp,
            });
          }
        } catch {
          // last-known is best-effort only
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(
    () => () => {
      // Unsubscribe on unmount — no leaked GPS sessions.
      watchSubRef.current?.remove();
      watchSubRef.current = null;
    },
    [],
  );

  const requestPermission = useCallback(async (): Promise<boolean> => {
    const result = await ensurePermission('location');
    setPermission(result);
    return result.granted;
  }, []);

  const locateNow = useCallback(async (): Promise<Fix | null> => {
    setError(null);
    setLocating(true);
    try {
      if (!(await requestPermission())) return null;
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const fix: Fix = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? null,
        timestamp: pos.timestamp,
      };
      setPosition(fix);
      return fix;
    } catch {
      setError('Could not get your location. Try moving to an open area.');
      return null;
    } finally {
      setLocating(false);
    }
  }, [requestPermission]);

  /** coords → "SG Highway, Ahmedabad, Gujarat" style address. */
  const reverseGeocode = useCallback(async (lat: number, lng: number): Promise<string | null> => {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (!results.length) return null;
      const r = results[0];
      const parts = [
        r.street || r.district,
        r.city || r.subregion,
        r.region,
      ].filter(Boolean);
      return parts.length ? parts.join(', ') : r.formattedAddress ?? null;
    } catch {
      return null;
    }
  }, []);

  /** text → candidate places (used by the location search picker). */
  const geocodeSearch = useCallback(async (text: string): Promise<LatLng[]> => {
    if (text.trim().length < 3) return [];
    try {
      const results = await Location.geocodeAsync(text.trim());
      return results.map((r) => ({ latitude: r.latitude, longitude: r.longitude }));
    } catch {
      return [];
    }
  }, []);

  const startWatch = useCallback(
    async (onUpdate?: (fix: Fix) => void): Promise<boolean> => {
      if (!(await requestPermission())) return false;
      if (watchSubRef.current) return true; // already watching

      try {
        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 3000,
            distanceInterval: 5,
          },
          (pos) => {
            const fix: Fix = {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy ?? null,
              timestamp: pos.timestamp,
            };
            setPosition(fix);
            onUpdate?.(fix);
          },
        );
        watchSubRef.current = sub;
        setTracking(true);
        return true;
      } catch {
        setError('Live location tracking is not available right now.');
        return false;
      }
    },
    [requestPermission],
  );

  const stopWatch = useCallback(() => {
    watchSubRef.current?.remove();
    watchSubRef.current = null;
    setTracking(false);
  }, []);

  return {
    permission,
    position,
    lastKnown,
    locating,
    error,
    tracking,
    requestPermission,
    locateNow,
    reverseGeocode,
    geocodeSearch,
    startWatch,
    stopWatch,
  };
}

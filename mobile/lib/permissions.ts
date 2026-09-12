import { Linking, Platform } from 'react-native';
import { Camera } from 'expo-camera';
import * as Location from 'expo-location';
import * as Contacts from 'expo-contacts';
import * as ImagePicker from 'expo-image-picker';

export interface PermissionResult {
  granted: boolean;
  /** false when the OS will never ask again — user must open Settings. */
  canAskAgain: boolean;
}

export type PermissionArea = 'camera' | 'microphone' | 'location' | 'contacts' | 'mediaLibrary';

async function check(area: PermissionArea): Promise<PermissionResult> {
  switch (area) {
    case 'camera': {
      const { status, canAskAgain } = await Camera.getCameraPermissionsAsync();
      return { granted: status === 'granted', canAskAgain };
    }
    case 'microphone': {
      const { status, canAskAgain } = await Camera.getMicrophonePermissionsAsync();
      return { granted: status === 'granted', canAskAgain };
    }
    case 'location': {
      const { status, canAskAgain } = await Location.getForegroundPermissionsAsync();
      return { granted: status === 'granted', canAskAgain };
    }
    case 'contacts': {
      const { status, canAskAgain } = await Contacts.getPermissionsAsync();
      return { granted: status === 'granted', canAskAgain };
    }
    case 'mediaLibrary': {
      const { status, canAskAgain } = await ImagePicker.getMediaLibraryPermissionsAsync();
      return { granted: status === 'granted', canAskAgain };
    }
  }
}

async function request(area: PermissionArea): Promise<PermissionResult> {
  switch (area) {
    case 'camera': {
      const { status, canAskAgain } = await Camera.requestCameraPermissionsAsync();
      return { granted: status === 'granted', canAskAgain };
    }
    case 'microphone': {
      const { status, canAskAgain } = await Camera.requestMicrophonePermissionsAsync();
      return { granted: status === 'granted', canAskAgain };
    }
    case 'location': {
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      return { granted: status === 'granted', canAskAgain };
    }
    case 'contacts': {
      const { status, canAskAgain } = await Contacts.requestPermissionsAsync();
      return { granted: status === 'granted', canAskAgain };
    }
    case 'mediaLibrary': {
      const { status, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      return { granted: status === 'granted', canAskAgain };
    }
  }
}

/** Check first; only prompt when not determined yet. */
export async function ensurePermission(
  area: PermissionArea,
): Promise<PermissionResult> {
  const current = await check(area);
  if (current.granted) return current;
  if (!current.canAskAgain) return current;
  return request(area);
}

export async function openAppSettings(): Promise<void> {
  await Linking.openSettings();
}

export function permissionMessage(area: PermissionArea): { title: string; message: string } {
  switch (area) {
    case 'camera':
      return {
        title: 'Camera access needed',
        message:
          'BuildTrack uses the camera to capture site progress photos, delivery proof and invoice scans.',
      };
    case 'microphone':
      return {
        title: 'Microphone access needed',
        message: 'Site progress videos need microphone access to record audio.',
      };
    case 'location':
      return {
        title: 'Location access needed',
        message:
          'Your location is used to pin the project site, verify worker attendance and track site visits. Location is never shared outside your company.',
      };
    case 'contacts':
      return {
        title: 'Contacts access needed',
        message:
          'Import worker details straight from your phone book — no typing names and numbers by hand.',
      };
    case 'mediaLibrary':
      return {
        title: 'Photo library access needed',
        message: 'Pick existing photos and videos of the site from your gallery.',
      };
  }
}

export const isAndroid = Platform.OS === 'android';

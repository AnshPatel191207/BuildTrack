import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';
import * as Contacts from 'expo-contacts';
import { ensurePermission } from '@/lib/permissions';

export interface ContactPerson {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

/**
 * Device contacts for the "Import workers from contacts" flow:
 * permission handling, paged read into a flat list, local search.
 */
export function useContacts() {
  const [granted, setGranted] = useState<boolean | null>(null);
  const [contacts, setContacts] = useState<ContactPerson[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<ContactPerson[]> => {
    setLoading(true);
    setError(null);
    try {
      const result = await ensurePermission('contacts');
      setGranted(result.granted);
      if (!result.granted) return [];

      // Read in pages of 2k to keep the JS bridge responsive.
      const all: ContactPerson[] = [];
      let pageOffset = 0;
      for (;;) {
        const page = await Contacts.getContactsAsync({
          fields: [
            Contacts.Fields.Name,
            Contacts.Fields.PhoneNumbers,
            Contacts.Fields.Emails,
          ],
          pageSize: 2000,
          pageOffset,
          sort: Contacts.SortTypes.FirstName,
        });
        for (const c of page.data) {
          all.push(toContactPerson(c));
        }
        pageOffset += page.data.length;
        if (!page.hasNextPage || page.data.length === 0) break;
      }
      setContacts(all);
      return all;
    } catch {
      setError('Could not read your contacts.');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Create a device contact from worker data (Add-to-contacts). */
  const createContact = useCallback(
    async (input: { name: string; phone?: string; email?: string; company?: string }) => {
      const result = await ensurePermission('contacts');
      if (!result.granted) return null;
      const id = await Contacts.addContactAsync({
        [Contacts.Fields.FirstName]: input.name.split(' ')[0] ?? input.name,
        ...(input.name.includes(' ')
          ? { [Contacts.Fields.LastName]: input.name.split(' ').slice(1).join(' ') }
          : {}),
        ...(input.phone
          ? {
              [Contacts.Fields.PhoneNumbers]: [{ label: 'mobile', number: input.phone }],
            }
          : {}),
        ...(input.email ? { [Contacts.Fields.Emails]: [{ label: 'work', email: input.email }] } : {}),
        ...(input.company ? { [Contacts.Fields.Company]: input.company } : {}),
      } as any);
      return id as string;
    },
    [],
  );

  const updateContactPhone = useCallback(
    async (contactId: string, phone: string) => {
      const result = await ensurePermission('contacts');
      if (!result.granted) return false;
      try {
        const contact = await Contacts.getContactByIdAsync(contactId);
        if (!contact) return false;
        const existing = contact.phoneNumbers ?? [];
        await Contacts.updateContactAsync({
          id: contact.id,
          phoneNumbers: [...existing, { label: 'work', number: phone }],
          firstName: contact.firstName,
          lastName: contact.lastName,
        } as any);
        return true;
      } catch {
        return false;
      }
    },
    [],
  );

  const deleteContact = useCallback(async (contactId: string) => {
    const result = await ensurePermission('contacts');
    if (!result.granted) return false;
    await Contacts.removeContactAsync(contactId);
    return true;
  }, []);

  const openContactCard = useCallback(async (name: string) => {
    try {
      // Best-effort jump into the native contacts app.
      if (Platform.OS === 'android') {
        await Linking.openURL('content://com.android.contacts/contacts');
      } else {
        await Contacts.presentContactPickerAsync(); // iOS fallback: picker sheet
        void name;
      }
    } catch {
      // no contacts app available — ignore
    }
  }, []);

  return {
    granted,
    contacts,
    loading,
    error,
    reload: load,
    createContact,
    updateContactPhone,
    deleteContact,
    openContactCard,
  };
}

function toContactPerson(c: any): ContactPerson {
  const withId = c as { id?: string };
  const primary =
    c.phoneNumbers?.find((p: any) => p.isPrimary === true) ?? c.phoneNumbers?.[0] ?? null;
  return {
    id: withId.id ?? '',
    name:
      c.name && c.name.trim().length > 0
        ? c.name
        : [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Unnamed',
    phone: primary?.number ?? null,
    email: c.emails?.[0]?.email ?? null,
  };
}

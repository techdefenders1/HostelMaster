import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client';
import { SystemSettings } from '../types';

interface BrandingContextType {
  settings: SystemSettings | null;
  refreshSettings: () => Promise<void>;
  updateBranding: (newSettings: Partial<SystemSettings>) => void;
  currency: string;
  logo: string | null;
  hostelName: string;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  const refreshSettings = async () => {
    try {
      const res = await api.get<{ settings: SystemSettings }>('/settings');
      setSettings(res.settings);
    } catch {
      // In unauthenticated mode, this will fail silently
    }
  };

  useEffect(() => {
    refreshSettings();
  }, []);

  const updateBranding = (newSettings: Partial<SystemSettings>) => {
    setSettings((prev) => (prev ? { ...prev, ...newSettings } : (newSettings as SystemSettings)));
  };

  const currency = settings?.currency || '₹';
  const logo = settings?.logo_data || null;
  const hostelName = settings?.hostel_name || 'HostelMaster';

  return (
    <BrandingContext.Provider
      value={{
        settings,
        refreshSettings,
        updateBranding,
        currency,
        logo,
        hostelName,
      }}
    >
      {children}
    </BrandingContext.Provider>
  );
};

export const useBranding = (): BrandingContextType => {
  const ctx = useContext(BrandingContext);
  if (!ctx) {
    return {
      settings: null,
      refreshSettings: async () => {},
      updateBranding: () => {},
      currency: '₹',
      logo: null,
      hostelName: 'HostelMaster',
    };
  }
  return ctx;
};

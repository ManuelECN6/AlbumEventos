import React, { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

// TypeScript declarations for Google APIs to avoid build errors
declare const gapi: any;
declare const google: any;

interface GoogleDriveImporterProps {
  onFilesSelected: (files: File[]) => Promise<void>;
  isProcessing: boolean;
}

// --- PLACEHOLDERS: Replace with your actual credentials from Google Cloud Console ---
// IMPORTANT: For this to work, you MUST enable "Google Drive API" and "Google Picker API"
// in your Google Cloud project and create OAuth 2.0 credentials (Client ID).
// Add your authorized JavaScript origins (e.g., your development and production URLs)
// to the OAuth 2.0 Client ID settings.
const GOOGLE_API_KEY = 'YOUR_GOOGLE_API_KEY'; 
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';

export const GoogleDriveImporter: React.FC<GoogleDriveImporterProps> = ({ onFilesSelected, isProcessing }) => {
  const [isApiLoading, setIsApiLoading] = useState(true);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  
  const tokenClient = useRef<any>(null);
  const gapiInited = useRef(false);
  const gisInited = useRef(false);

  useEffect(() => {
    // This effect ensures scripts are loaded only once
    const scriptGapi = document.createElement('script');
    scriptGapi.id = 'gapi-script';
    scriptGapi.src = 'https://apis.google.com/js/api.js';
    scriptGapi.async = true;
    scriptGapi.defer = true;
    scriptGapi.onload = () => gapi.load('client:picker', initializeGapiClient);
    if (!document.getElementById('gapi-script')) {
        document.body.appendChild(scriptGapi);
    }

    const scriptGis = document.createElement('script');
    scriptGis.id = 'gis-script';
    scriptGis.src = 'https://accounts.google.com/gsi/client';
    scriptGis.async = true;
    scriptGis.defer = true;
    scriptGis.onload = initializeGisClient;
    if (!document.getElementById('gis-script')) {
        document.body.appendChild(scriptGis);
    }
    
    return () => {
        const gapiEl = document.getElementById('gapi-script');
        const gisEl = document.getElementById('gis-script');
        if (gapiEl) document.body.removeChild(gapiEl);
        if (gisEl) document.body.removeChild(gisEl);
    }
  }, []);

  const initializeGapiClient = async () => {
    await gapi.client.init({
      apiKey: GOOGLE_API_KEY,
      discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
    });
    gapiInited.current = true;
    if (gisInited.current) setIsApiLoading(false);
  };

  const initializeGisClient = () => {
    tokenClient.current = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: (tokenResponse: any) => {
        if (tokenResponse && tokenResponse.access_token) {
          gapi.client.setToken(tokenResponse);
          createPicker(tokenResponse.access_token);
        }
      },
    });
    gisInited.current = true;
    if (gapiInited.current) setIsApiLoading(false);
  };

  const handleAuthClick = () => {
    if (gapi.client.getToken() === null) {
      tokenClient.current.requestAccessToken({ prompt: 'consent' });
    } else {
      createPicker(gapi.client.getToken().access_token);
    }
  };

  const pickerCallback = async (data: any) => {
    setIsPickerOpen(false);
    if (data.action === google.picker.Action.PICKED) {
      const token = gapi.client.getToken().access_token;
      const files: File[] = [];

      for (const doc of data.docs) {
        try {
          const res = await fetch(`https://www.googleapis.com/drive/v3/files/${doc.id}?alt=media`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const blob = await res.blob();
          files.push(new File([blob], doc.name, { type: doc.mimeType }));
        } catch (error) {
          console.error("Error fetching file from Drive:", doc.name, error);
        }
      }
      if (files.length > 0) {
        await onFilesSelected(files);
      }
    } else if (data.action === google.picker.Action.CANCEL) {
        setIsPickerOpen(false);
    }
  };

  const createPicker = (accessToken: string) => {
    if (isPickerOpen) return;
    setIsPickerOpen(true);
    const view = new google.picker.View(google.picker.ViewId.DOCS);
    view.setMimeTypes("image/png,image/jpeg,image/jpg,image/webp");
    
    const picker = new google.picker.PickerBuilder()
      .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
      .setOAuthToken(accessToken)
      .setDeveloperKey(GOOGLE_API_KEY)
      .addView(view)
      .setCallback(pickerCallback)
      .build();
    picker.setVisible(true);
  };
  
  if (GOOGLE_API_KEY.startsWith('YOUR_') || GOOGLE_CLIENT_ID.startsWith('YOUR_')) {
    return (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-xs font-medium text-center">
            <strong>Google Drive no configurado.</strong>
            <p className="font-normal">Se requiere configurar las credenciales de API en el código para habilitar la importación.</p>
        </div>
    );
  }

  return (
    <button 
      onClick={handleAuthClick} 
      disabled={isApiLoading || isProcessing || isPickerOpen}
      className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-bold text-sm shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {(isApiLoading || isProcessing) ? <Loader2 size={16} className="animate-spin" /> : <GoogleDriveIcon />}
      {isApiLoading ? 'Cargando API...' : isProcessing ? 'Importando...' : 'Importar de Google Drive'}
    </button>
  );
};

const GoogleDriveIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M19.1998 13.9997L14.3998 4.79971L9.5998 13.9997H19.1998Z" fill="#34A853"/>
        <path d="M7.4 17.1997L4.8 12.3997L9.6 3.19971H14.4L19.2 12.3997L16.8 17.1997H7.4Z" fill="#4285F4"/>
        <path d="M22.7998 16.3997L19.1998 9.99971H14.3998L17.9998 16.3997H22.7998Z" fill="#FFC107"/>
        <path d="M4.8002 12.3997L7.2002 17.1997L12.0002 17.1997L9.6002 12.3997H4.8002Z" fill="#EA4335"/>
    </svg>
);


import React, { useState, useEffect } from 'react';
import { EventConfig, Category, Photo, Participant } from '../types';
import { Save, Plus, Settings, Layout, Image, ArrowLeft, Check, X as XIcon, Folder, Users, Search, Grid, Eye, EyeOff, Lock, Unlock, ExternalLink, Palette, Upload, Type, FileText, Loader2, UserPlus, Trash2, CheckSquare, Square, UserCheck, HardDrive, Maximize2, RotateCcw, Flag, Calendar, User, Download, Camera, Smartphone, Monitor, CloudLightning, Ticket, Video, Image as ImageIcon, RefreshCw, AlertTriangle, Menu, ShieldAlert, CheckCircle } from 'lucide-react';
import { uploadFileToFirebase, recalculateEventStorageUsage } from '../services/firebaseService';
import { GoogleDriveImporter } from './GoogleDriveImporter';
import QRCode from "react-qr-code";

interface AdminPanelProps {
  events: EventConfig[];
  currentEventId: string;
  currentEventPhotos?: Photo[];
  isProcessing?: boolean;
  onUpdateEvent: (updatedEvent: EventConfig) => void;
  onUpdateField: (fieldPath: string, value: any) => void;
  onCreateEvent: () => void;
  onSelectEvent: (id: string) => void;
  onDeleteEvent: (id: string) => void;
  onDeletePhoto: (id: string) => void;
  onRestorePhoto: (id: string) => void;
  onPermanentDelete: (id: string) => Promise<void>;
  onArchivePhoto: (id: string) => void;
  onBulkDelete: (ids: string[]) => void;
  onBulkArchive: (ids: string[], shouldArchive: boolean) => void;
  onBulkRestore: (ids: string[]) => void;
  onBulkPermanentDelete: (ids: string[]) => Promise<void>;
  onDriveImport: (files: File[]) => Promise<void>;
  onResolveReport: (id: string) => Promise<void>;
  onExit: () => void;
}

// --- PLANTILLA POR DEFECTO ---
const DEFAULT_EVENT_TEMPLATE: EventConfig = {
    id: '',
    title: 'Nuevo Evento',
    subtitle: 'Descripción del evento',
    date: 'DD/MM/AAAA',
    participantsCount: 0,
    participants: [],
    photos: [],
    categories: [{ id: 'c1', name: 'General', color: '#3b82f6' }],
    allowUploads: true,
    allowDownloads: false, 
    allowedMediaTypes: ['photo', 'video'],
    storageLimit: 100, 
    maxPhotosPerPerson: 50, 
    maxVideosPerPerson: 10, 
    maxVideoSizeMB: 512, 
    totalEventSizeLimitGB: 5,
    totalUsageBytes: 0,
    clientName: 'Cliente Nuevo',
    downloadPassword: Math.random().toString(36).slice(-6),
    publicToken: '',
    theme: {
      backgroundColor: '#f5f0e6',
      textColor: '#1f2937',
      primaryColor: '#a87b51',
      primaryTextColor: '#ffffff',
      secondaryColor: '#4f46e5',
      secondaryTextColor: '#ffffff',
      statsTextColor: '#6b7280',
      headerTitleColor: '#1f2937',
      headerDateColor: '#6b7280',
      fontFamily: 'sans',
      avatarBackgroundColor: '#374151',
      avatarTextColor: '#ffffff',
      coverOverlayColor: '#000000',
      coverOverlayOpacity: 0.4,
      coverBlur: 0,
      coverImagePositionY: 50,
      coverImagePositionDesktopY: 50,
      galleryToolbarBg: '#ffffff',
      galleryToolbarText: '#1f2937',
      cardBackgroundColor: '#ffffff',
      cardTextColor: '#1f2937'
    },
    googleDriveUrl: '',
    isDriveBackupEnabled: false
};

// --- FUNCIÓN SEGURA PARA COLORES (CRASH PROOF) ---
const hexToRgba = (hex: any, alpha: number) => {
    try {
        if (!hex || typeof hex !== 'string') return 'transparent';
        if (hex.startsWith('rgba')) return hex;
        
        let c: any;
        if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
            c = hex.substring(1).split('');
            if (c.length === 3) {
                c = [c[0], c[0], c[1], c[1], c[2], c[2]];
            }
            c = '0x' + c.join('');
            return 'rgba(' + [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',') + ',' + alpha + ')';
        }
        return hex;
    } catch (e) {
        return 'transparent';
    }
};

// --- COMPONENTE COLOR PICKER ---
const ColorPicker = ({ label, value, onChange, fallback }: { label: string, value?: string, onChange: (val: string) => void, fallback: string }) => {
    const safeValue = value || fallback;
    
    return (
      <div className="flex flex-col">
          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2 tracking-wider">{label}</label>
          <div className="flex flex-col gap-3">
              <div className="relative w-full h-12 rounded-xl border-2 border-gray-200 shadow-sm overflow-hidden cursor-pointer group hover:border-[#4f46e5] transition-colors bg-white">
                   <input 
                      type="color" 
                      value={safeValue}
                      onChange={(e) => onChange(e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                      title="Clic para elegir color"
                  />
                  <div 
                      className="absolute inset-0 z-10 pointer-events-none transition-colors duration-200"
                      style={{ backgroundColor: safeValue }}
                  />
              </div>
              <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-mono font-bold">#</span>
                  <input 
                      type="text" 
                      value={(safeValue || '').replace('#', '').toUpperCase()}
                      onChange={(e) => {
                          const val = e.target.value;
                          if (/^[0-9A-Fa-f]*$/.test(val) && val.length <= 6) {
                              onChange('#' + val); 
                          }
                      }}
                      maxLength={6}
                      className="w-full pl-7 pr-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4f46e5] focus:border-[#4f46e5] outline-none font-mono text-gray-700 font-bold tracking-wide transition-all shadow-sm"
                      placeholder="HEX"
                      style={{ colorScheme: 'light' }}
                  />
              </div>
          </div>
      </div>
    );
};

// --- LIVE PREVIEW BLINDADO ---
const MobilePreview = ({ config, activePhotos }: { config: EventConfig, activePhotos: Photo[] }) => {
    // Fusión segura de tema
    const defaultTheme = DEFAULT_EVENT_TEMPLATE.theme!;
    const theme = { ...defaultTheme, ...(config.theme || {}) };
    
    const fontClass = theme.fontFamily === 'serif' ? 'font-serif' : 'font-sans';
    
    const previewPhotos = activePhotos && activePhotos.length > 0 ? activePhotos.slice(0, 4) : [
        { id: '1', thumbnail: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=400', author: { name: 'Ana', initials: 'AN', avatarColor: '#3b82f6' }, likes: 12, category: 'General', createdAt: new Date().toISOString(), title: 'Ejemplo', width: 400, height: 400 },
        { id: '2', thumbnail: 'https://images.unsplash.com/photo-1511285560982-1351cdeb9821?w=400', author: { name: 'Luis', initials: 'LU', avatarColor: '#ef4444' }, likes: 8, category: 'General', createdAt: new Date().toISOString(), title: 'Ejemplo', width: 400, height: 400 }
    ] as Photo[];

    const statsColor = theme.statsTextColor || theme.textColor;
    const participants = config.participants || [];
    const confirmedCount = participants.filter(p => p.status === 'confirmed').length;
    const limit = config.participantsCount || 0;
    const participantsDisplay = limit === 0 ? confirmedCount : `${confirmedCount}/${limit}`;
    const title = config.title || 'Nuevo Evento';
    const subtitle = config.subtitle || '';
    const date = config.date || '';
    const mobilePos = theme.coverImagePositionY || 50;

    return (
        <div className="sticky top-8 mx-auto w-[300px] h-[600px] bg-gray-900 rounded-[3rem] border-[8px] border-gray-900 shadow-2xl overflow-hidden flex flex-col select-none ring-4 ring-gray-200">
            <div className="h-7 bg-black w-full flex items-center justify-between px-6 z-30 shrink-0 absolute top-0 left-0 right-0 rounded-t-[2.5rem]">
                <span className="text-[10px] text-white font-medium pl-2">9:41</span>
                <div className="w-16 h-4 bg-black rounded-b-xl absolute left-1/2 -translate-x-1/2 top-0"></div>
                <div className="flex gap-1 pr-2">
                    <div className="w-3 h-3 bg-white rounded-full opacity-90"></div>
                </div>
            </div>

            <div 
                className={`flex-1 overflow-y-auto overflow-x-hidden flex flex-col relative ${fontClass} custom-scrollbar`}
                style={{ backgroundColor: theme.backgroundColor, color: theme.textColor }}
            >
                <div className="relative mb-4 shrink-0">
                    <div className="absolute inset-0 z-0 overflow-hidden h-full w-full">
                         {config.coverImage ? (
                             <img 
                                src={config.coverImage} 
                                className="w-full h-full object-cover transition-all duration-300" 
                                style={{ 
                                    objectPosition: `50% ${mobilePos}%`,
                                    filter: `blur(${theme.coverBlur || 0}px)` 
                                }}
                             />
                         ) : (
                             <div className="w-full h-full bg-gray-300"></div>
                         )}
                         <div 
                            className="absolute inset-0 z-0" 
                            style={{ backgroundColor: hexToRgba(theme.coverOverlayColor || '#000000', theme.coverOverlayOpacity ?? 0.4) }}
                        />
                    </div>

                    <div className={`relative z-10 pt-10 pb-4 px-4 ${config.coverImage ? '' : 'pt-10'}`}>
                        <div className="flex flex-col items-center gap-3 text-center">
                            {/* --- CORRECCIÓN AVATAR --- */}
                            {theme.avatarImage ? (
                                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/20 shadow-sm shrink-0">
                                    <img src={theme.avatarImage} className="w-full h-full object-cover" />
                                </div>
                            ) : (
                                <div 
                                    className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold shadow-sm shrink-0 uppercase border-2 border-white/20"
                                    style={{ backgroundColor: theme.avatarBackgroundColor, color: theme.avatarTextColor }}
                                >
                                    {(title || 'EV').substring(0, 2)}
                                </div>
                            )}

                            <div className="flex flex-col items-center w-full">
                                <h1 className="text-xl font-bold leading-tight mb-1 text-center" style={{ color: theme.headerTitleColor || theme.textColor }}>
                                    {title}
                                </h1>
                                <div className="flex flex-wrap items-center justify-center gap-2 text-[10px]">
                                    <div className="flex items-center gap-1" style={{ color: theme.headerDateColor || theme.textColor }}>
                                        <User size={10} />
                                        <span>{subtitle}</span>
                                    </div>
                                    <span className="opacity-50">•</span>
                                    <div className="flex items-center gap-1" style={{ color: theme.headerDateColor || theme.textColor }}>
                                        <Calendar size={10} />
                                        <span>{date}</span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-center gap-3 mt-3 text-[8px] font-bold uppercase tracking-wide" style={{ color: statsColor }}>
                                    <div className="flex flex-col items-center">
                                        <span className="text-xs leading-none">{previewPhotos.length}</span>
                                        <span>Fotos</span>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <span className="text-xs leading-none">{previewPhotos.reduce((a, b) => a + (b.likes || 0), 0)}</span>
                                        <span>Likes</span>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <span className="text-xs leading-none">{participantsDisplay}</span>
                                        <span>Invitados</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2 w-full mt-4">
                            {config.allowUploads && (
                                <div className="flex-1 flex items-center justify-center gap-1 py-2 rounded-full font-medium shadow-md text-[10px]" style={{ backgroundColor: theme.primaryColor, color: theme.primaryTextColor }}>
                                    <Camera size={12} /> Subir
                                </div>
                            )}
                            <div className="flex-1 flex items-center justify-center gap-1 py-2 rounded-full font-medium shadow-md text-[10px]" style={{ backgroundColor: theme.secondaryColor, color: theme.secondaryTextColor }}>
                                <Download size={12} /> Bajar
                            </div>
                        </div>
                    </div>
                </div>
                
                 <div className="px-3 pb-4">
                    <div className="grid grid-cols-1 gap-4">
                        {previewPhotos.map((photo, idx) => {
                            // --- PROTECCIÓN TOTAL CONTRA DATOS NULOS EN FOTOS ---
                            const author = photo?.author || { name: 'Anónimo', initials: 'AN', avatarColor: '#999' };
                            
                            return (
                                <div 
                                    key={photo.id || idx} 
                                    className="rounded-lg shadow-sm border overflow-hidden"
                                    style={{ 
                                        backgroundColor: theme.cardBackgroundColor || '#ffffff',
                                        borderColor: 'rgba(0,0,0,0.05)'
                                    }}
                                >
                                    <div className="p-2 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold" style={{ backgroundColor: author.avatarColor, color: '#fff' }}>
                                                {author.initials}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-[10px]" style={{ color: theme.cardTextColor }}>{author.name}</h3>
                                                <p className="text-[8px] opacity-80" style={{ color: theme.cardTextColor }}>Hace un momento</p>
                                            </div>
                                        </div>
                                        <Flag size={10} className="opacity-30" style={{ color: theme.cardTextColor }} />
                                    </div>

                                    <div className="bg-gray-100 aspect-[4/3] relative overflow-hidden">
                                        {photo.thumbnail ? (
                                            <img src={photo.thumbnail} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gray-200"><ImageIcon size={20} className="text-gray-400" /></div>
                                        )}
                                        <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm text-white text-[8px] px-1.5 py-0.5 rounded uppercase font-bold">
                                            {photo.category || 'General'}
                                        </div>
                                    </div>

                                    <div className="p-2 border-t" style={{ borderColor: 'rgba(0,0,0,0.05)' }}>
                                        <div className="flex items-center gap-1 text-[10px] font-medium" style={{ color: theme.cardTextColor }}>
                                            <span>{photo.likes || 0} Likes</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
            
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-20 h-1 bg-white/30 rounded-full z-40"></div>
        </div>
    );
};

export const AdminPanel: React.FC<AdminPanelProps> = ({ 
  events, 
  currentEventId, 
  currentEventPhotos = [],
  isProcessing = false,
  onUpdateEvent,
  onUpdateField,
  onCreateEvent, 
  onSelectEvent, 
  onDeleteEvent, 
  onDeletePhoto, 
  onRestorePhoto, 
  onPermanentDelete, 
  onArchivePhoto, 
  onBulkDelete, 
  onBulkArchive, 
  onBulkRestore, 
  onBulkPermanentDelete, 
  onDriveImport, 
  onResolveReport,
  onExit 
}) => {
  const activeEvent = events?.find(e => e.id === currentEventId) || events?.[0] || DEFAULT_EVENT_TEMPLATE;

  // ESTADO LOCAL INICIALIZADO DE FORMA SEGURA
  const [localConfig, setLocalConfig] = useState<EventConfig>(() => ({
      ...DEFAULT_EVENT_TEMPLATE,
      ...activeEvent,
      theme: { ...DEFAULT_EVENT_TEMPLATE.theme, ...(activeEvent?.theme || {}) },
      participants: activeEvent?.participants || [],
      categories: activeEvent?.categories || DEFAULT_EVENT_TEMPLATE.categories,
      photos: activeEvent?.photos || [],
      allowedMediaTypes: activeEvent?.allowedMediaTypes || ['photo']
  }));

  const [activeTab, setActiveTab] = useState<'general' | 'categories' | 'gallery' | 'clients' | 'participants' | 'appearance' | 'reports'>('general');
  const [searchTerm, setSearchTerm] = useState('');
  const [galleryView, setGalleryView] = useState<'active' | 'archived' | 'trash'>('active');
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<Photo | null>(null);
  const [photoToDelete, setPhotoToDelete] = useState<Photo | null>(null);
  const [showDeleteEventConfirm, setShowDeleteEventConfirm] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLinkCopied, setIsLinkCopied] = useState(false);
  const [isTokenLocked, setIsTokenLocked] = useState(true);
  const [newParticipantName, setNewParticipantName] = useState('');
  const [participantSearch, setParticipantSearch] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#3b82f6');
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  
  const [baseUrl, setBaseUrl] = useState(() => {
      if (typeof window !== 'undefined') {
          return localStorage.getItem('album_custom_domain') || window.location.origin;
      }
      return '';
  });

  useEffect(() => {
      if (baseUrl && typeof window !== 'undefined') {
          localStorage.setItem('album_custom_domain', baseUrl);
      }
  }, [baseUrl]);

  useEffect(() => {
    if (activeEvent?.id !== localConfig?.id) {
        setSelectedIds([]); 
        setIsTokenLocked(true); 
    }
    setLocalConfig({ 
        ...DEFAULT_EVENT_TEMPLATE,
        ...activeEvent,
        theme: { ...DEFAULT_EVENT_TEMPLATE.theme, ...(activeEvent?.theme || {}) },
        participants: activeEvent?.participants || [],
        categories: activeEvent?.categories || DEFAULT_EVENT_TEMPLATE.categories,
        photos: activeEvent?.photos || [],
        allowedMediaTypes: activeEvent?.allowedMediaTypes || ['photo']
    });
  }, [activeEvent]);

  const handleSave = () => {
    onUpdateEvent(localConfig);
    const btn = document.getElementById('save-btn');
    if(btn) {
        const originalText = btn.innerText;
        btn.innerText = '¡Guardado!';
        setTimeout(() => btn.innerText = originalText, 2000);
    }
  };

  const handleExitToSite = () => {
    const token = activeEvent.publicToken || activeEvent.id;
    let targetUrl = baseUrl.trim();
    if (!targetUrl.startsWith('http')) {
        targetUrl = 'https://' + targetUrl;
    }
    
    try {
        const url = new URL(targetUrl);
        url.searchParams.set('event', token);
        if (window.location.origin === url.origin) {
             window.location.href = url.toString();
        } else {
             window.open(url.toString(), '_blank');
        }
        onExit();
    } catch (e) {
        alert("El dominio configurado no es válido. Por favor revísalo en la pestaña Clientes.");
    }
  };

  const addParticipant = () => {
    const name = newParticipantName.trim();
    if (name) {
        const currentParticipants = localConfig.participants || [];
        const exists = currentParticipants.some(p => p.name.toLowerCase() === name.toLowerCase());
        if (exists) {
            alert("Ya existe un participante con este nombre.");
            return;
        }

        const newParticipant: Participant = {
            id: `p-${Date.now()}`,
            name: name,
            status: 'confirmed',
            addedAt: new Date().toISOString().split('T')[0]
        };
        const updatedParticipants = [...currentParticipants, newParticipant];
        setLocalConfig(prev => ({ ...prev, participants: updatedParticipants }));
        onUpdateField('participants', updatedParticipants);
        setNewParticipantName('');
    }
  };
  
  const isContentOwnedBy = (photo: Photo, participant: Participant) => {
      if (!photo) return false;
      if (photo.deviceId && photo.deviceId === participant.id) return true;
      
      const authorName = photo.author?.name || '';
      const legacyId = `legacy-${authorName.replace(/\s+/g, '-').toLowerCase()}`;
      if (participant.id === legacyId) return true;
      if (authorName === participant.name) return true;
      return false;
  };

  const getParticipantContent = (participant: Participant) => {
      const sourcePhotos = currentEventPhotos || [];
      const content = sourcePhotos.filter(photo => 
          !photo.isDeleted && isContentOwnedBy(photo, participant)
      );
      return { total: content.length };
  };

  const handleBannerChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      if (!activeEvent.id) return;
      setIsUploadingBanner(true);
      const file = e.target.files[0];
      try {
        const timestamp = Date.now();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const path = `eventos/${activeEvent.id}/assets/banner_${timestamp}_${sanitizedName}`;
        const url = await uploadFileToFirebase(file, path);
        
        setLocalConfig(prev => ({ ...prev, coverImage: url }));
        onUpdateField('coverImage', url);
      } catch (error) {
        alert("Error al subir la imagen.");
      } finally {
        setIsUploadingBanner(false);
      }
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      if (!activeEvent.id) return;
      setIsUploadingAvatar(true);
      const file = e.target.files[0];
      try {
        const timestamp = Date.now();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const path = `eventos/${activeEvent.id}/assets/avatar_${timestamp}_${sanitizedName}`;
        const url = await uploadFileToFirebase(file, path);
        
        // --- ARREGLO AVATAR: Forzamos la actualización segura del tema ---
        const currentTheme = localConfig.theme || DEFAULT_EVENT_TEMPLATE.theme!;
        const updatedTheme = { ...currentTheme, avatarImage: url };
        
        setLocalConfig(prev => ({ ...prev, theme: updatedTheme }));
        onUpdateField('theme', updatedTheme);
      } catch (error) {
        alert("Error al subir el avatar.");
      } finally {
        setIsUploadingAvatar(false);
      }
    }
  };
  
  const handleDownloadQR = () => {
      const svg = document.getElementById("qr-code-svg");
      if (!svg) return;
      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new window.Image();
      const size = 2000; 

      img.onload = () => {
          canvas.width = size;
          canvas.height = size;
          if (ctx) {
              ctx.fillStyle = "#FFFFFF";
              ctx.fillRect(0, 0, size, size);
              ctx.drawImage(img, 0, 0, size, size);
              const pngFile = canvas.toDataURL("image/png");
              const downloadLink = document.createElement("a");
              downloadLink.download = `QR_${(localConfig.title || 'Evento').replace(/\s+/g, '_')}_Impresion.png`;
              downloadLink.href = pngFile;
              downloadLink.click();
          }
      };
      img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  const handleAddCategory = () => {
    if (newCategoryName.trim()) {
        const newCat: Category = {
            id: `c-${Date.now()}`,
            name: newCategoryName.trim(),
            color: newCategoryColor
        };
        const currentCats = localConfig.categories || DEFAULT_EVENT_TEMPLATE.categories;
        const updatedCats = [...currentCats, newCat];
        setLocalConfig(prev => ({ ...prev, categories: updatedCats }));
        onUpdateField('categories', updatedCats);
        setNewCategoryName('');
        setNewCategoryColor('#3b82f6'); 
    }
  };

  const handleDeleteCategory = (id: string) => {
      const currentCats = localConfig.categories || [];
      if (currentCats.length <= 1) {
          alert("Debe haber al menos una categoría.");
          return;
      }
      const updatedCats = currentCats.filter(c => c.id !== id);
      setLocalConfig(prev => ({ ...prev, categories: updatedCats }));
      onUpdateField('categories', updatedCats);
  };
  
  const handleRecalculateStorage = async () => {
      if (!activeEvent.id) return;
      setIsRecalculating(true);
      try {
          const newTotal = await recalculateEventStorageUsage(activeEvent.id, currentEventPhotos || []);
          setLocalConfig(prev => ({ ...prev, totalUsageBytes: newTotal }));
      } catch (error) {
          console.error("Error recalculando espacio:", error);
          alert("Hubo un error al calcular el espacio. Revisa la consola.");
      } finally {
          setIsRecalculating(false);
      }
  };

  const displayedPhotos = (currentEventPhotos || []).filter(p => {
      if (!p) return false;
      if (galleryView === 'trash') return p.isDeleted;
      if (galleryView === 'archived') return p.isArchived && !p.isDeleted;
      return !p.isDeleted && !p.isArchived;
  });

  const reportedPhotos = (currentEventPhotos || []).filter(p => (p.reports || 0) > 0 && !p.isDeleted);

  const toggleSelectAll = () => {
      const targetIds = displayedPhotos.map(p => p.id);
      const allSelected = targetIds.length > 0 && targetIds.every(id => selectedIds.includes(id));
      if (allSelected) {
          setSelectedIds(prev => prev.filter(id => !targetIds.includes(id)));
      } else {
          setSelectedIds(prev => Array.from(new Set([...prev, ...targetIds])));
      }
  };

  const toggleSelection = (id: string) => {
      setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };
  
  const executeBulkDelete = async () => {
      if (selectedIds.length === 0) return;
      if (galleryView === 'trash') {
         setShowBulkDeleteConfirm(true);
      } else {
          onBulkDelete(selectedIds);
          setSelectedIds([]);
      }
  };
  
  const updateLocalTheme = (field: string, value: any) => {
      setLocalConfig(prev => ({ 
          ...prev, 
          theme: { 
              ...(prev.theme || DEFAULT_EVENT_TEMPLATE.theme!), 
              [field]: value 
          } 
      }));
  };

  const safeParticipants = localConfig.participants || [];
  const safeCategories = localConfig.categories || DEFAULT_EVENT_TEMPLATE.categories;

  const getCleanUrl = (url: string) => {
      let cleaned = url.trim().replace(/\/$/, '');
      if (!cleaned) return '';
      if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
          cleaned = 'https://' + cleaned;
      }
      return cleaned;
  };

  const finalBaseUrl = getCleanUrl(baseUrl);
  const finalLink = `${finalBaseUrl}?event=${activeEvent.publicToken || activeEvent.id}`;
  
  const theme = {
      ...DEFAULT_EVENT_TEMPLATE.theme!,
      ...(localConfig.theme || {})
  };

  const mobilePos = theme.coverImagePositionY || 50;
  const desktopPos = theme.coverImagePositionDesktopY ?? mobilePos;

  const usageBytes = localConfig.totalUsageBytes || 0;
  const limitBytes = (localConfig.totalEventSizeLimitGB || 5) * 1024 * 1024 * 1024;
  const usageGB = (usageBytes / (1024 * 1024 * 1024)).toFixed(2);
  const limitGB = localConfig.totalEventSizeLimitGB || 5;
  const usagePercentage = Math.min(100, (usageBytes / limitBytes) * 100);

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden font-sans text-gray-800">
      
      {isMobileSidebarOpen && (
        <div 
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-gray-900 text-gray-300 flex flex-col shadow-2xl transition-transform duration-300 lg:static lg:translate-x-0 shrink-0 ${
            isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6 border-b border-gray-800 flex items-center justify-between">
            <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Settings className="text-[#4f46e5]" />
                    Admin Panel
                </h2>
                <p className="text-[10px] text-gray-500 mt-1 tracking-wider uppercase">Gestor de Eventos</p>
            </div>
            <button 
                onClick={() => setIsMobileSidebarOpen(false)}
                className="lg:hidden p-1 text-gray-400 hover:text-white rounded-md hover:bg-gray-800 transition-colors"
            >
                <XIcon size={20} />
            </button>
        </div>

        <div className="p-4 border-b border-gray-800">
            <button 
                onClick={() => { onCreateEvent(); setIsMobileSidebarOpen(false); }}
                className="w-full bg-[#4f46e5] hover:bg-[#4338ca] text-white p-3 rounded-lg flex items-center justify-center gap-2 mb-4 transition-all shadow-lg shadow-indigo-900/20 font-bold text-sm"
            >
                <Plus size={16} /> Crear Nuevo Álbum
            </button>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                <input 
                    type="text" 
                    placeholder="Buscar evento..." 
                    className="w-full bg-gray-800 text-white pl-9 pr-3 py-2 rounded-lg text-xs border border-gray-700 focus:border-[#4f46e5] outline-none transition-colors"
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
            <div>
                <h3 className="text-[10px] font-bold text-gray-500 uppercase mb-3 px-2 tracking-widest">Mis Álbumes ({events?.length || 0})</h3>
                <ul className="space-y-1">
                    {/* SAFE LIST RENDERING: Check e.title exists */}
                    {events?.filter(e => (e.title || '').toLowerCase().includes(searchTerm.toLowerCase())).map(event => (
                    <li key={event.id}>
                        <button
                        onClick={() => { onSelectEvent(event.id); setIsMobileSidebarOpen(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all ${currentEventId === event.id ? 'bg-gray-800 text-white border-l-4 border-[#4f46e5]' : 'hover:bg-gray-800/50 hover:text-white'}`}
                        >
                         <Folder size={16} className={currentEventId === event.id ? 'text-[#4f46e5]' : 'text-gray-500'} />
                         <div className="text-left truncate">
                             <span className="block font-medium text-sm truncate">{event.title || 'Sin Título'}</span>
                             <span className="block text-[10px] text-gray-500">{event.clientName || 'Sin Cliente'}</span>
                         </div>
                        </button>
                    </li>
                    ))}
                </ul>
            </div>

            {currentEventId && (
                <div>
                    <h3 className="text-[10px] font-bold text-gray-500 uppercase mb-3 px-2 mt-4 border-t border-gray-800 pt-4 tracking-widest">
                        Configuración
                    </h3>
                    <ul className="space-y-1">
                        {[
                            { id: 'general', icon: Layout, label: 'General' },
                            { id: 'appearance', icon: Palette, label: 'Personalización' },
                            { id: 'categories', icon: Grid, label: 'Categorías' },
                            { id: 'participants', icon: Users, label: 'Participantes' },
                            { id: 'clients', icon: UserCheck, label: 'Clientes & QR' },
                            { id: 'gallery', icon: ImageIcon, label: 'Galería' },
                            { id: 'reports', icon: ShieldAlert, label: `Moderación${reportedPhotos.length > 0 ? ` (${reportedPhotos.length})` : ''}` },
                        ].map((item) => (
                            <li key={item.id}>
                                <button
                                    onClick={() => { setActiveTab(item.id as any); setIsMobileSidebarOpen(false); }}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm ${activeTab === item.id ? 'bg-[#4f46e5] text-white font-bold' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                                >
                                    <item.icon size={18} className={item.id === 'reports' && reportedPhotos.length > 0 ? 'text-red-500 animate-pulse' : ''} />
                                    {item.label}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </nav>
        
        <div className="p-4 border-t border-gray-800">
            <button onClick={handleExitToSite} className="w-full flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-xs px-2">
                <ArrowLeft size={14} /> Volver al Sitio
            </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto relative bg-gray-50 flex flex-col">
        <header className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 md:px-8 py-4 flex flex-col md:flex-row items-start md:items-center justify-between shadow-sm gap-4">
            <div className="flex items-center gap-3 w-full md:w-auto">
                <button 
                    onClick={() => setIsMobileSidebarOpen(true)}
                    className="lg:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <Menu size={24} />
                </button>
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2 flex-wrap">
                        {activeTab === 'general' && 'Configuración General'}
                        {activeTab === 'appearance' && 'Personalización'}
                        {activeTab === 'categories' && 'Categorías'}
                        {activeTab === 'gallery' && 'Contenido'}
                        {activeTab === 'clients' && 'Acceso & QR'}
                        {activeTab === 'participants' && 'Invitados'}
                        {activeTab === 'reports' && 'Moderación de Contenido'}
                    </h1>
                    <p className="text-gray-500 text-xs md:text-sm truncate max-w-[200px] md:max-w-none">Editando: {localConfig.title || 'Evento Nuevo'}</p>
                </div>
            </div>
            <div className="flex gap-2 self-end md:self-auto w-full md:w-auto justify-end">
                {activeTab === 'general' && (
                   <button 
                        onClick={() => setShowDeleteEventConfirm(true)}
                        className="px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg font-bold transition-colors flex items-center gap-2 text-xs md:text-sm"
                    >
                        <Trash2 size={16} /> <span className="hidden md:inline">Eliminar</span>
                   </button>
                )}
                <button 
                    id="save-btn"
                    onClick={handleSave} 
                    className="bg-[#4f46e5] hover:bg-[#4338ca] text-white px-4 py-2 md:px-6 md:py-2.5 rounded-lg shadow-lg shadow-indigo-200 font-bold flex items-center gap-2 transition-all transform active:scale-95 text-xs md:text-sm"
                >
                    <Save size={16} /> Guardar
                </button>
            </div>
        </header>

        <div className="p-4 md:p-8 max-w-7xl mx-auto w-full">
          
          {/* ... [ OTHER TABS OMITTED FOR BREVITY, ONLY SHOWING REPORTS TAB LOGIC ] ... */}
          
          {activeTab === 'reports' && (
               <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8">
                   <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                      <ShieldAlert className="text-red-500" /> Reportes Pendientes
                  </h3>
                  
                  {reportedPhotos.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-gray-400 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                          <CheckCircle size={48} className="mb-4 text-green-500 opacity-50" />
                          <p className="text-lg font-medium">Todo limpio</p>
                          <p className="text-sm">No hay fotos reportadas pendientes de revisión.</p>
                      </div>
                  ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                          {reportedPhotos.map(photo => (
                              <div key={photo.id} className="bg-white border border-red-100 rounded-xl shadow-sm overflow-hidden flex flex-col">
                                  <div className="relative aspect-video bg-gray-100">
                                      {photo.type === 'video' ? (
                                           <video src={photo.thumbnail} className="w-full h-full object-cover" muted />
                                      ) : (
                                           <img src={photo.thumbnail} className="w-full h-full object-cover" />
                                      )}
                                      <div className="absolute top-2 right-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md flex items-center gap-1">
                                          <Flag size={10} /> {photo.reports}
                                      </div>
                                  </div>
                                  <div className="p-4 flex-1 flex flex-col">
                                      <div className="flex items-center gap-2 mb-3">
                                          <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold">
                                              {photo.author.initials}
                                          </div>
                                          <div>
                                              <p className="text-xs font-bold text-gray-800">{photo.author.name}</p>
                                              <p className="text-[10px] text-gray-500">{new Date(photo.createdAt).toLocaleDateString()}</p>
                                          </div>
                                      </div>
                                      
                                      <div className="mt-auto grid grid-cols-2 gap-2">
                                          <button 
                                            onClick={() => onResolveReport(photo.id)}
                                            className="py-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                                          >
                                              <Check size={14} /> Aprobar
                                          </button>
                                          <button 
                                            onClick={() => {
                                                if (confirm("¿Estás seguro de enviar esta foto a la papelera?")) {
                                                    onDeletePhoto(photo.id);
                                                }
                                            }}
                                            className="py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                                          >
                                              <Trash2 size={14} /> Eliminar
                                          </button>
                                          <button 
                                            onClick={() => {
                                                 onArchivePhoto(photo.id);
                                                 // También limpiamos el reporte al archivar para que salga de esta lista
                                                 onResolveReport(photo.id);
                                            }}
                                            className="col-span-2 py-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                                          >
                                              <EyeOff size={14} /> Ocultar (Archivar)
                                          </button>
                                      </div>
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
               </div>
          )}
          
          {activeTab === 'appearance' && (
             <div className="flex flex-col lg:flex-row gap-8 items-start">
                 <div className="flex-1 space-y-6 w-full max-w-4xl">
                     <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-4">
                            <ImageIcon className="text-[#4f46e5]" /> Portada
                        </h3>
                        <div className="relative group border-2 border-dashed border-gray-300 rounded-xl p-1 hover:border-[#4f46e5] transition-colors bg-gray-50 h-48 md:h-64">
                            {localConfig.coverImage ? (
                                <div className="relative h-full rounded-lg overflow-hidden">
                                    <img 
                                        src={localConfig.coverImage} 
                                        className="w-full h-full object-cover transition-all duration-300" 
                                        style={{ 
                                            objectPosition: `50% ${desktopPos}%`,
                                            filter: `blur(${theme.coverBlur || 0}px)` 
                                        }}
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20">
                                            <label className="cursor-pointer bg-white text-gray-800 px-4 py-2 rounded-full font-bold text-sm hover:scale-105 transition-transform shadow-lg">
                                            Cambiar Imagen
                                            <input type="file" className="hidden" onChange={handleBannerChange} accept="image/*" />
                                            </label>
                                    </div>
                                    <div className="absolute top-2 right-2 bg-black/50 text-white text-[10px] px-2 py-1 rounded font-bold uppercase pointer-events-none">Vista Escritorio</div>
                                </div>
                            ) : (
                                <label className="flex flex-col items-center justify-center h-full cursor-pointer">
                                    {isUploadingBanner ? <Loader2 className="animate-spin text-[#4f46e5]" size={32} /> : <Upload size={32} className="text-gray-400 mb-2" />}
                                    <span className="text-sm text-gray-500 font-medium">Subir Portada</span>
                                    <input type="file" className="hidden" onChange={handleBannerChange} accept="image/*" />
                                </label>
                            )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-3 flex items-center gap-2">
                                    <Smartphone size={14} /> Posición Vertical (Móvil)
                                </label>
                                <input 
                                    type="range" 
                                    min="0" 
                                    max="100" 
                                    value={mobilePos} 
                                    onChange={(e) => updateLocalTheme('coverImagePositionY', Number(e.target.value))}
                                    className="w-full accent-[#4f46e5] h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                    style={{ colorScheme: 'light' }}
                                />
                            </div>

                            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-3 flex items-center gap-2">
                                    <Monitor size={14} /> Posición Vertical (Escritorio)
                                </label>
                                <input 
                                    type="range" 
                                    min="0" 
                                    max="100" 
                                    value={desktopPos} 
                                    onChange={(e) => updateLocalTheme('coverImagePositionDesktopY', Number(e.target.value))}
                                    className="w-full accent-[#4f46e5] h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                    style={{ colorScheme: 'light' }}
                                />
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                         <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-4">
                            <Palette className="text-[#4f46e5]" /> Colores Principales
                         </h3>
                         <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            <ColorPicker label="Fondo" value={theme.backgroundColor} onChange={(c) => updateLocalTheme('backgroundColor', c)} fallback="#f5f0e6"/>
                            <ColorPicker label="Texto" value={theme.textColor} onChange={(c) => updateLocalTheme('textColor', c)} fallback="#1f2937"/>
                            <ColorPicker label="Primario" value={theme.primaryColor} onChange={(c) => updateLocalTheme('primaryColor', c)} fallback="#a87b51"/>
                            <ColorPicker label="Secundario" value={theme.secondaryColor} onChange={(c) => updateLocalTheme('secondaryColor', c)} fallback="#4f46e5"/>
                         </div>
                    </div>
                    
                    {/* AVATAR UPLOAD SECTION */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                         <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-4">
                            <User className="text-[#4f46e5]" /> Avatar / Logo
                         </h3>
                         <div className="flex items-center gap-6">
                             <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-gray-200 shadow-md group">
                                 {theme.avatarImage ? (
                                     <img src={theme.avatarImage} className="w-full h-full object-cover" />
                                 ) : (
                                     <div 
                                        className="w-full h-full flex items-center justify-center font-bold text-xl uppercase"
                                        style={{ backgroundColor: theme.avatarBackgroundColor, color: theme.avatarTextColor }}
                                     >
                                         {(localConfig.title || 'EV').substring(0, 2)}
                                     </div>
                                 )}
                                 <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                     <label className="cursor-pointer">
                                         {isUploadingAvatar ? <Loader2 className="animate-spin text-white" /> : <Upload className="text-white" />}
                                         <input type="file" className="hidden" onChange={handleAvatarChange} accept="image/*" />
                                     </label>
                                 </div>
                             </div>
                             <div>
                                 <p className="text-sm font-bold text-gray-700 mb-1">Imagen de Perfil</p>
                                 <p className="text-xs text-gray-500 mb-3">Aparece en la parte superior del álbum.</p>
                                 <div className="flex gap-3">
                                     <ColorPicker label="Fondo (si no hay imagen)" value={theme.avatarBackgroundColor} onChange={(c) => updateLocalTheme('avatarBackgroundColor', c)} fallback="#374151" />
                                     <ColorPicker label="Texto (si no hay imagen)" value={theme.avatarTextColor} onChange={(c) => updateLocalTheme('avatarTextColor', c)} fallback="#ffffff" />
                                 </div>
                             </div>
                         </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                         <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-4">
                            <Type className="text-[#4f46e5]" /> Colores de Texto (Encabezado)
                         </h3>
                         <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                            <ColorPicker 
                                label="Título Principal" 
                                value={theme.headerTitleColor} 
                                onChange={(c) => updateLocalTheme('headerTitleColor', c)} 
                                fallback="#1f2937"
                            />
                            <ColorPicker 
                                label="Fecha y Subtítulo" 
                                value={theme.headerDateColor} 
                                onChange={(c) => updateLocalTheme('headerDateColor', c)} 
                                fallback="#6b7280"
                            />
                             <ColorPicker 
                                label="Estadísticas" 
                                value={theme.statsTextColor} 
                                onChange={(c) => updateLocalTheme('statsTextColor', c)} 
                                fallback="#6b7280"
                            />
                         </div>
                    </div>
                 </div>
                 
                 <div className="hidden xl:block w-[350px] shrink-0">
                    <div className="sticky top-24 flex justify-center">
                        <MobilePreview config={localConfig} activePhotos={currentEventPhotos || []} />
                    </div>
                </div>
             </div>
          )}
          
          {/* ... [ CATEGORIES TAB ] ... */}
          {activeTab === 'categories' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
                    <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-4">
                        <Plus className="text-[#4f46e5]" /> Añadir Categoría
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Nombre</label>
                            <input 
                                type="text" 
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#4f46e5] outline-none"
                                placeholder="Ej: Boda, Fiesta..."
                                style={{ colorScheme: 'light' }}
                            />
                        </div>
                        <div>
                            <ColorPicker label="Etiqueta" value={newCategoryColor} onChange={setNewCategoryColor} fallback="#3b82f6"/>
                        </div>
                        <button 
                            onClick={handleAddCategory}
                            disabled={!newCategoryName.trim()}
                            className="w-full py-3 bg-[#4f46e5] text-white rounded-lg font-bold shadow-md hover:bg-[#4338ca] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Añadir
                        </button>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <h3 className="text-lg font-bold text-gray-800 p-6 border-b border-gray-100">Categorías Activas</h3>
                    <div className="divide-y divide-gray-100">
                        {safeCategories.map((cat) => (
                            <div key={cat.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="w-8 h-8 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-white font-bold text-xs" style={{ backgroundColor: cat.color }}>
                                        {cat.name.substring(0, 2)}
                                    </div>
                                    <p className="font-bold text-gray-800">{cat.name}</p>
                                </div>
                                <button onClick={() => handleDeleteCategory(cat.id)} className="p-2 text-gray-400 hover:text-red-500 rounded-lg"><Trash2 size={18} /></button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
          )}

          {/* ... [ GENERAL TAB ] ... */}
          {activeTab === 'general' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                           <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><FileText className="text-[#4f46e5]" /> Información</h3>
                           <div className="space-y-4">
                               <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Título</label>
                                    <input type="text" value={localConfig.title} onChange={(e) => setLocalConfig({...localConfig, title: e.target.value})} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#4f46e5] outline-none" style={{ colorScheme: 'light' }} />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Fecha</label>
                                        <input type="text" value={localConfig.date} onChange={(e) => setLocalConfig({...localConfig, date: e.target.value})} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#4f46e5] outline-none" style={{ colorScheme: 'light' }} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Token URL</label>
                                        <div className="relative">
                                            <input 
                                                type="text" 
                                                value={localConfig.publicToken} 
                                                onChange={(e) => setLocalConfig({...localConfig, publicToken: e.target.value})} 
                                                className={`w-full pl-10 pr-10 py-2 rounded-lg border outline-none ${isTokenLocked ? 'bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed' : 'bg-white border-gray-300 focus:ring-2 focus:ring-[#4f46e5]'}`}
                                                disabled={isTokenLocked}
                                                style={{ colorScheme: 'light' }}
                                            />
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                                {isTokenLocked ? <Lock size={16} /> : <ExternalLink size={16} />}
                                            </div>
                                            <button 
                                                onClick={() => setIsTokenLocked(!isTokenLocked)}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-md transition-colors"
                                                title={isTokenLocked ? "Desbloquear para editar" : "Bloquear"}
                                            >
                                                {isTokenLocked ? <Lock size={14} /> : <Unlock size={14} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Subtítulo</label>
                                    <input type="text" value={localConfig.subtitle} onChange={(e) => setLocalConfig({...localConfig, subtitle: e.target.value})} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#4f46e5] outline-none" style={{ colorScheme: 'light' }} />
                                </div>
                           </div>
                      </div>

                      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                           <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><Lock className="text-[#4f46e5]" /> Accesos</h3>
                           <div className="space-y-4">
                               <div>
                                   <label className="block text-sm font-bold text-gray-700 mb-1">Contraseña Descarga</label>
                                   <div className="relative">
                                       <input type="text" value={localConfig.downloadPassword} onChange={(e) => setLocalConfig({...localConfig, downloadPassword: e.target.value})} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#4f46e5] outline-none" style={{ colorScheme: 'light' }} />
                                       <button onClick={() => setLocalConfig({...localConfig, downloadPassword: Math.random().toString(36).slice(-6)})} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs bg-gray-100 px-2 py-1 rounded font-bold">Generar</button>
                                   </div>
                               </div>
                               <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                                   <div className="flex items-center gap-3">
                                       <div className={`p-2 rounded-full ${localConfig.allowUploads ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{localConfig.allowUploads ? <Upload size={18} /> : <XIcon size={18} />}</div>
                                       <div><span className="block font-bold text-sm">Permitir Subidas</span><span className="text-xs text-gray-500">Invitados pueden aportar</span></div>
                                   </div>
                                   <input type="checkbox" checked={localConfig.allowUploads} onChange={(e) => setLocalConfig({...localConfig, allowUploads: e.target.checked})} className="w-5 h-5 accent-[#4f46e5]" style={{ colorScheme: 'light' }} />
                               </label>
                               <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                                   <div className="flex items-center gap-3">
                                       <div className={`p-2 rounded-full ${localConfig.allowDownloads ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{localConfig.allowDownloads ? <Download size={18} /> : <XIcon size={18} />}</div>
                                       <div><span className="block font-bold text-sm">Permitir Descargas</span><span className="text-xs text-gray-500">Invitados pueden bajar fotos</span></div>
                                   </div>
                                   <input type="checkbox" checked={localConfig.allowDownloads} onChange={(e) => setLocalConfig({...localConfig, allowDownloads: e.target.checked})} className="w-5 h-5 accent-[#4f46e5]" style={{ colorScheme: 'light' }} />
                               </label>
                           </div>

                           <div className="mt-4 pt-4 border-t border-gray-100">
                               <label className="block text-xs font-bold text-gray-500 uppercase mb-3">Formatos Permitidos</label>
                               <div className="flex gap-4">
                                   <label className={`flex-1 flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${localConfig.allowedMediaTypes?.includes('photo') ? 'bg-indigo-50 border-indigo-200' : 'hover:bg-gray-50'}`}>
                                       <div className="flex items-center gap-2">
                                           <ImageIcon size={18} className={localConfig.allowedMediaTypes?.includes('photo') ? 'text-indigo-600' : 'text-gray-400'} />
                                           <span className="text-sm font-bold text-gray-700">Fotos</span>
                                       </div>
                                       <input 
                                           type="checkbox" 
                                           checked={localConfig.allowedMediaTypes?.includes('photo')} 
                                           onChange={(e) => {
                                                const isChecked = e.target.checked;
                                                let newTypes = [...(localConfig.allowedMediaTypes || [])];
                                                if (isChecked) newTypes.push('photo');
                                                else newTypes = newTypes.filter(t => t !== 'photo');
                                                setLocalConfig({ ...localConfig, allowedMediaTypes: newTypes });
                                           }} 
                                           className="w-4 h-4 accent-[#4f46e5]" 
                                           style={{ colorScheme: 'light' }}
                                       />
                                   </label>
                                   <label className={`flex-1 flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${localConfig.allowedMediaTypes?.includes('video') ? 'bg-indigo-50 border-indigo-200' : 'hover:bg-gray-50'}`}>
                                       <div className="flex items-center gap-2">
                                           <Video size={18} className={localConfig.allowedMediaTypes?.includes('video') ? 'text-indigo-600' : 'text-gray-400'} />
                                           <span className="text-sm font-bold text-gray-700">Videos</span>
                                       </div>
                                       <input 
                                           type="checkbox" 
                                           checked={localConfig.allowedMediaTypes?.includes('video')} 
                                           onChange={(e) => {
                                                const isChecked = e.target.checked;
                                                let newTypes = [...(localConfig.allowedMediaTypes || [])];
                                                if (isChecked) newTypes.push('video');
                                                else newTypes = newTypes.filter(t => t !== 'video');
                                                setLocalConfig({ ...localConfig, allowedMediaTypes: newTypes });
                                           }} 
                                           className="w-4 h-4 accent-[#4f46e5]" 
                                           style={{ colorScheme: 'light' }}
                                       />
                                   </label>
                               </div>
                           </div>
                      </div>
                  </div>

                  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
                       <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><HardDrive className="text-[#4f46e5]" /> Límites</h3>
                       <div className="space-y-4">
                           <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex justify-between">
                                    <span>Límite Total del Evento (GB)</span>
                                    <span className="text-[#4f46e5]">{limitGB} GB</span>
                                </label>
                                <input 
                                    type="number" 
                                    value={localConfig.totalEventSizeLimitGB || 5} 
                                    onChange={(e) => setLocalConfig({...localConfig, totalEventSizeLimitGB: Number(e.target.value)})} 
                                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#4f46e5] outline-none mb-3"
                                    style={{ colorScheme: 'light' }}
                                />
                                <div className="mt-2">
                                    <div className="flex justify-between text-xs mb-1 font-medium text-gray-600">
                                        <span>Consumo Actual</span>
                                        <span>{usageGB} GB ({usagePercentage.toFixed(1)}%)</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                                        <div 
                                            className={`h-2.5 rounded-full transition-all duration-500 ${usagePercentage > 90 ? 'bg-red-500' : 'bg-green-500'}`} 
                                            style={{ width: `${usagePercentage}%` }}
                                        ></div>
                                    </div>
                                    {usagePercentage > 90 && (
                                        <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1 font-bold">
                                            <AlertTriangle size={10} /> Espacio casi lleno
                                        </p>
                                    )}
                                </div>
                                <button 
                                    onClick={handleRecalculateStorage}
                                    disabled={isRecalculating}
                                    className="w-full mt-3 flex items-center justify-center gap-2 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 text-xs font-bold py-2 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                                >
                                    {isRecalculating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                    {isRecalculating ? 'Calculando...' : 'Sincronizar Espacio Usado'}
                                </button>
                           </div>

                           <div className="grid grid-cols-2 gap-4">
                               <div>
                                   <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Max MB Foto</label>
                                   <input type="number" value={localConfig.storageLimit} onChange={(e) => setLocalConfig({...localConfig, storageLimit: Number(e.target.value)})} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#4f46e5] outline-none" style={{ colorScheme: 'light' }} />
                               </div>
                               <div>
                                   <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Max MB Video</label>
                                   <input type="number" value={localConfig.maxVideoSizeMB || 50} onChange={(e) => setLocalConfig({...localConfig, maxVideoSizeMB: Number(e.target.value)})} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#4f46e5] outline-none" style={{ colorScheme: 'light' }} />
                               </div>
                           </div>
                           <div className="grid grid-cols-2 gap-4">
                               <div>
                                   <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Max Fotos/Pers</label>
                                   <input type="number" value={localConfig.maxPhotosPerPerson} onChange={(e) => setLocalConfig({...localConfig, maxPhotosPerPerson: Number(e.target.value)})} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#4f46e5] outline-none" style={{ colorScheme: 'light' }} />
                               </div>
                               <div>
                                   <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Max Videos/Pers</label>
                                   <input type="number" value={localConfig.maxVideosPerPerson} onChange={(e) => setLocalConfig({...localConfig, maxVideosPerPerson: Number(e.target.value)})} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#4f46e5] outline-none" style={{ colorScheme: 'light' }} />
                               </div>
                           </div>
                       </div>
                  </div>
              </div>
          )}
          
          {/* ... [ GALLERY TAB ] ... */}
          {activeTab === 'gallery' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[calc(100vh-150px)]">
                 <div className="px-4 md:px-6 py-4 border-b border-gray-200 flex flex-col xl:flex-row items-center justify-between gap-4 shrink-0 bg-white z-20 sticky top-0">
                    <div className="flex items-center bg-gray-100 p-1 rounded-lg w-full xl:w-auto overflow-x-auto">
                        <button onClick={() => setGalleryView('active')} className={`flex-1 xl:flex-none px-3 md:px-4 py-2 rounded-md text-xs md:text-sm font-medium transition-all whitespace-nowrap ${galleryView === 'active' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Activa</button>
                        <button onClick={() => setGalleryView('archived')} className={`flex-1 xl:flex-none px-3 md:px-4 py-2 rounded-md text-xs md:text-sm font-medium transition-all whitespace-nowrap ${galleryView === 'archived' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Ocultos</button>
                        <button onClick={() => setGalleryView('trash')} className={`flex-1 xl:flex-none px-3 md:px-4 py-2 rounded-md text-xs md:text-sm font-medium transition-all whitespace-nowrap ${galleryView === 'trash' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-red-500'}`}>Papelera</button>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto justify-end">
                        <div className="flex items-center gap-2 text-[10px] md:text-xs font-bold text-green-600 bg-green-50 px-3 py-1.5 rounded-full border border-green-100 animate-pulse">
                            <CloudLightning size={12} /> Sync: {displayedPhotos.length}
                        </div>
                        <GoogleDriveImporter onFilesSelected={onDriveImport} isProcessing={isProcessing} />
                        {selectedIds.length > 0 && (
                             <div className="flex items-center gap-2 animate-fade-in">
                                 <span className="text-xs font-bold text-[#4f46e5] mr-2 hidden md:inline">{selectedIds.length} selec.</span>
                                 {galleryView === 'trash' ? (
                                     <>
                                         <button onClick={() => onBulkRestore(selectedIds)} className="px-3 py-1.5 bg-green-50 text-green-600 rounded-md text-xs font-bold">Restaurar</button>
                                         <button onClick={executeBulkDelete} className="px-3 py-1.5 bg-red-50 text-red-600 rounded-md text-xs font-bold">Eliminar</button>
                                     </>
                                 ) : (
                                     <>
                                         <button onClick={() => onBulkArchive(selectedIds, galleryView !== 'archived')} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-md text-xs font-bold">{galleryView === 'active' ? 'Ocultar' : 'Mostrar'}</button>
                                         <button onClick={executeBulkDelete} className="px-3 py-1.5 bg-red-50 text-red-600 rounded-md text-xs font-bold">Papelera</button>
                                     </>
                                 )}
                             </div>
                        )}
                        <button onClick={toggleSelectAll} className="text-gray-500 hover:text-[#4f46e5] flex items-center gap-2 text-xs md:text-sm font-medium px-2">
                            {displayedPhotos.length > 0 && displayedPhotos.every(p => selectedIds.includes(p.id)) ? <><CheckSquare size={16} /> <span className="hidden md:inline">Todo</span></> : <><Square size={16} /> <span className="hidden md:inline">Seleccionar Todo</span></>}
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50 custom-scrollbar">
                    {displayedPhotos.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                             <ImageIcon size={64} className="mb-4" />
                             <p>No hay imágenes en esta sección</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3 md:gap-4">
                            {displayedPhotos.map((photo, idx) => {
                                // --- SAFE AUTHOR ---
                                const author = photo?.author || { name: 'Anónimo', initials: 'AN', avatarColor: '#999' };

                                return (
                                    <div 
                                        key={photo.id || idx} 
                                        className="rounded-lg shadow-sm border overflow-hidden"
                                        style={{ 
                                            backgroundColor: theme.cardBackgroundColor || '#ffffff',
                                            borderColor: 'rgba(0,0,0,0.05)'
                                        }}
                                    >
                                        <div className="p-2 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold" style={{ backgroundColor: author.avatarColor, color: '#fff' }}>
                                                    {author.initials}
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-[10px]" style={{ color: theme.cardTextColor }}>{author.name}</h3>
                                                    <p className="text-[8px] opacity-80" style={{ color: theme.cardTextColor }}>Hace un momento</p>
                                                </div>
                                            </div>
                                            <Flag size={10} className="opacity-30" style={{ color: theme.cardTextColor }} />
                                        </div>

                                        <div className="bg-gray-100 aspect-[4/3] relative overflow-hidden">
                                            {photo.thumbnail ? (
                                                <img src={photo.thumbnail} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-gray-200"><ImageIcon size={24} className="text-gray-400"/></div>
                                            )}
                                            <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm text-white text-[8px] px-1.5 py-0.5 rounded uppercase font-bold">
                                                {photo.category || 'General'}
                                            </div>
                                        </div>

                                        <div className="p-2 border-t" style={{ borderColor: 'rgba(0,0,0,0.05)' }}>
                                            <div className="flex items-center gap-1 text-[10px] font-medium" style={{ color: theme.cardTextColor }}>
                                                <span>{photo.likes || 0} Likes</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
              </div>
          )}
          
          {/* ... [ CLIENTS TAB ] ... */}
          {activeTab === 'clients' && (
               <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8">
                   <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                      <UserCheck className="text-[#4f46e5]" /> Gestión de Cliente & Distribución
                  </h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      <div className="space-y-6">
                          <div>
                              <label className="block text-sm font-bold text-gray-700 mb-2">Nombre Cliente</label>
                              <input type="text" value={localConfig.clientName} onChange={(e) => setLocalConfig({...localConfig, clientName: e.target.value})} className="w-full p-4 bg-gray-800 text-white rounded-xl border border-gray-700 focus:ring-2 focus:ring-[#4f46e5] outline-none font-medium text-lg" />
                          </div>
                          
                          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                               <label className="block text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-2">
                                    <ExternalLink size={14} /> Dominio del Sitio (para QR y Enlaces)
                               </label>
                               <input 
                                    type="text" 
                                    value={baseUrl} 
                                    onChange={(e) => setBaseUrl(e.target.value)} 
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-[#4f46e5] outline-none mb-2"
                                    placeholder="https://tudominio.com"
                                    style={{ colorScheme: 'light' }}
                               />
                               <p className="text-[10px] text-gray-500">
                                   Edita esto si estás en localhost y quieres generar un QR para producción. Se guardará automáticamente.
                               </p>
                          </div>

                          <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
                              <h4 className="text-blue-800 font-bold flex items-center gap-2 mb-2"><ExternalLink size={18} /> Enlace Público</h4>
                              <p className="text-blue-600/80 text-xs mb-3 break-all font-mono">{finalLink}</p>
                              <button onClick={() => {navigator.clipboard.writeText(finalLink); setIsLinkCopied(true); setTimeout(() => setIsLinkCopied(false), 2000);}} className={`bg-white border px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 ${isLinkCopied ? 'text-green-600 border-green-200 bg-green-50' : 'text-blue-600 border-blue-200 hover:bg-blue-50'}`}>{isLinkCopied ? <><Check size={18} /> ¡Copiado!</> : 'Copiar Enlace'}</button>
                          </div>
                      </div>
                      <div className="bg-gray-50 p-8 rounded-xl border border-gray-200 flex flex-col items-center justify-center text-center">
                           <div className="bg-white p-4 rounded-xl shadow-sm mb-6">
                               <QRCode id="qr-code-svg" value={finalLink} size={180} level="H" />
                           </div>
                           <button onClick={handleDownloadQR} className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-300 rounded-full text-gray-700 font-bold hover:bg-gray-100 transition-all shadow-sm">Descargar QR PNG</button>
                      </div>
                  </div>
              </div>
          )}

          {activeTab === 'participants' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                 <div className="lg:col-span-4 space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-4">
                            <Ticket className="text-[#4f46e5]" />
                            Capacidad del Evento
                        </h3>
                        <div className="space-y-2">
                             <label className="block text-sm font-bold text-gray-700">Límite Máximo de Invitados</label>
                             <div className="relative">
                                <input 
                                    type="number" 
                                    value={localConfig.participantsCount || 0}
                                    onChange={(e) => setLocalConfig({...localConfig, participantsCount: Number(e.target.value)})}
                                    className="w-full pl-4 pr-12 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#4f46e5] outline-none font-bold"
                                    min="0"
                                    style={{ colorScheme: 'light' }}
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">PERS</span>
                             </div>
                             <p className="text-[11px] text-gray-500 leading-tight pt-1">
                                 Si estableces este valor en <strong>0</strong>, el evento tendrá acceso ilimitado. Si pones <strong>25</strong>, el usuario 26 no podrá subir fotos.
                             </p>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
                        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-4">
                            <UserPlus className="text-[#4f46e5]" />
                            Registrar Manualmente
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Nombre</label>
                                <input 
                                    type="text" 
                                    value={newParticipantName}
                                    onChange={(e) => setNewParticipantName(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#4f46e5] outline-none"
                                    style={{ colorScheme: 'light' }}
                                />
                            </div>
                            <button onClick={addParticipant} disabled={!newParticipantName.trim()} className="w-full py-3 bg-[#4f46e5] text-white rounded-lg font-bold shadow-md hover:bg-[#4338ca] transition-colors disabled:opacity-50">Añadir</button>
                        </div>
                    </div>
                </div>
                <div className="lg:col-span-8">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                             <h3 className="font-bold text-gray-700">Participantes ({safeParticipants.length})</h3>
                             <input 
                                type="text" 
                                placeholder="Buscar..." 
                                value={participantSearch} 
                                onChange={(e) => setParticipantSearch(e.target.value)} 
                                className="pl-3 pr-3 py-1.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-[#4f46e5] outline-none" 
                                style={{ colorScheme: 'light' }}
                             />
                        </div>
                        <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto custom-scrollbar">
                            {safeParticipants.length > 0 ? (
                                safeParticipants
                                .filter(p => p.name.toLowerCase().includes(participantSearch.toLowerCase()))
                                .map((p) => {
                                    const stats = getParticipantContent(p);
                                    return (
                                        <div key={p.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-600 text-xs">
                                                    {p.name.substring(0,2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-800">{p.name}</p>
                                                    <p className="text-xs text-gray-500">{p.id.slice(0, 8)}...</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <span className="block text-sm font-bold text-gray-800">{stats.total}</span>
                                                    <span className="text-[10px] text-gray-500 uppercase">Fotos</span>
                                                </div>
                                                <button onClick={() => {
                                                        const updated = safeParticipants.filter(part => part.id !== p.id);
                                                        setLocalConfig(prev => ({ ...prev, participants: updated }));
                                                        onUpdateField('participants', updated);
                                                    }} className="p-2 text-gray-400 hover:text-red-500 rounded-lg"><Trash2 size={16} /></button>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (<div className="p-8 text-center text-gray-400">No hay participantes registrados.</div>)}
                        </div>
                    </div>
                </div>
              </div>
          )}

        </div>
      </main>

      {/* MODALS (Delete Confirmations, Previews) - Same as before */}
      {showDeleteEventConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteEventConfirm(false)} />
              <div className="relative bg-white w-full max-w-md rounded-2xl p-8 shadow-2xl text-center">
                  <h3 className="text-2xl font-bold text-gray-800 mb-2">¿Eliminar Álbum?</h3>
                  <p className="text-gray-600 mb-8">Esta acción borrará todas las fotos permanentemente.</p>
                  <div className="flex gap-3 justify-center">
                      <button onClick={() => setShowDeleteEventConfirm(false)} className="px-6 py-3 rounded-lg bg-gray-100 text-gray-700 font-bold">Cancelar</button>
                      <button onClick={async () => { await onDeleteEvent(activeEvent.id); setShowDeleteEventConfirm(false); }} className="px-6 py-3 rounded-lg bg-red-600 text-white font-bold">Eliminar</button>
                  </div>
              </div>
          </div>
      )}

      {showBulkDeleteConfirm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowBulkDeleteConfirm(false)} />
              <div className="relative bg-white w-full max-w-sm rounded-xl p-6 shadow-2xl text-center">
                  <h3 className="text-lg font-bold text-gray-800 mb-2">¿Eliminar {selectedIds.length} fotos?</h3>
                  <div className="flex gap-3 justify-center mt-6">
                      <button onClick={() => setShowBulkDeleteConfirm(false)} className="px-4 py-2.5 rounded-lg bg-gray-100 text-gray-700 font-medium">Cancelar</button>
                      <button onClick={async () => { await onBulkPermanentDelete(selectedIds); setSelectedIds([]); setShowBulkDeleteConfirm(false); }} className="px-4 py-2.5 rounded-lg bg-red-600 text-white font-bold">Sí, Eliminar</button>
                  </div>
              </div>
          </div>
      )}

      {previewPhoto && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setPreviewPhoto(null)} />
              <div className="relative bg-white w-full max-w-4xl rounded-xl overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[90vh]">
                  <div className="flex-1 bg-black flex items-center justify-center relative min-h-[300px]">
                      {previewPhoto.type === 'video' ? <video src={previewPhoto.url} controls className="max-h-full max-w-full" /> : <img src={previewPhoto.url} className="max-h-full max-w-full object-contain" />}
                  </div>
                  <div className="w-full md:w-80 bg-white p-6 flex flex-col border-l border-gray-100 shrink-0 overflow-y-auto">
                       <h3 className="text-xl font-bold text-gray-800 mb-6">Detalles</h3>
                       <div className="mt-auto space-y-3">
                           {previewPhoto.isDeleted ? (
                               <>
                                    <button onClick={() => { onRestorePhoto(previewPhoto.id); setPreviewPhoto(null); }} className="w-full py-3 rounded-lg border border-green-200 text-green-600 font-bold">Restaurar</button>
                                    <button onClick={() => setPhotoToDelete(previewPhoto)} className="w-full py-3 rounded-lg bg-red-50 text-red-600 font-bold">Eliminar Definitivamente</button>
                               </>
                           ) : (
                               <>
                                    <button onClick={() => { onArchivePhoto(previewPhoto.id); setPreviewPhoto(prev => prev ? ({ ...prev, isArchived: !prev.isArchived }) : null); }} className="w-full py-3 rounded-lg border border-gray-200 text-gray-600 font-bold">{previewPhoto.isArchived ? 'Mostrar' : 'Ocultar'}</button>
                                    <button onClick={() => { onDeletePhoto(previewPhoto.id); setPreviewPhoto(prev => prev ? ({ ...prev, isDeleted: true }) : null); }} className="w-full py-3 rounded-lg border border-red-100 text-red-500 font-bold">Papelera</button>
                               </>
                           )}
                       </div>
                  </div>
              </div>
          </div>
      )}

      {photoToDelete && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPhotoToDelete(null)} />
              <div className="relative bg-white w-full max-w-sm rounded-xl p-6 shadow-2xl text-center">
                  <h3 className="text-lg font-bold text-gray-800 mb-2">¿Eliminar permanentemente?</h3>
                  <div className="flex gap-3 justify-center mt-6">
                      <button onClick={() => setPhotoToDelete(null)} className="px-4 py-2.5 rounded-lg bg-gray-100 text-gray-700 font-medium">Cancelar</button>
                      <button onClick={async () => { await onPermanentDelete(photoToDelete.id); setPhotoToDelete(null); setPreviewPhoto(null); }} className="px-4 py-2.5 rounded-lg bg-red-600 text-white font-bold">Sí, Eliminar</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

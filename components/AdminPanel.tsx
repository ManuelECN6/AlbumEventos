import React, { useState, useEffect, useCallback } from 'react';
import { EventConfig, Category, Photo, Participant } from '../types';
import { Save, Plus, Trash, Settings, Layout, Image, ArrowLeft, Pencil, Check, X as XIcon, LogOut, FolderPlus, Folder, Users, Search, Video, Grid, Eye, EyeOff, Lock, Link as LinkIcon, Copy, RefreshCw, UserCheck, ExternalLink, Menu, Maximize2, Calendar, Clock, CheckSquare, Square, UserPlus, Mail, BadgeCheck, AlertCircle, Palette, Upload, Type, Cloud, FileText, QrCode, Download, Loader2, HelpCircle, PieChart, Camera, PlayCircle, RotateCcw, Trash2, Filter, AlertTriangle, UserX, Heart, ImageIcon, Sliders, Droplet, Zap, User, CheckCircle, Info, Smartphone, Monitor } from 'lucide-react';
import { uploadFileToFirebase } from '../services/firebaseService';
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
  onExit: () => void;
}

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
    allowDownloads: false, // Default Disabled
    allowedMediaTypes: ['photo'],
    storageLimit: 100,
    maxPhotosPerPerson: 25,
    maxVideosPerPerson: 5,
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

const APP_URL = window.location.origin;

const hexToRgba = (hex: string, alpha: number) => {
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
};

// --- OPTIMIZED COLOR PICKER COMPONENT ---
const ColorPicker = ({ label, value, onChange, fallback }: { label: string, value?: string, onChange: (val: string) => void, fallback: string }) => {
    const [internalColor, setInternalColor] = useState(value || fallback);

    useEffect(() => {
        setInternalColor(value || fallback);
    }, [value, fallback]);

    const handleChange = (newColor: string) => {
        setInternalColor(newColor);
        onChange(newColor);
    };

    return (
      <div className="flex flex-col">
          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2 tracking-wider">{label}</label>
          <div className="flex flex-col gap-3">
              {/* Main Color Swatch / Picker */}
              <div className="relative w-full h-14 rounded-xl border-2 border-gray-200 shadow-sm overflow-hidden cursor-pointer group hover:border-[#4f46e5] transition-colors bg-white">
                   <input 
                      type="color" 
                      value={internalColor}
                      onChange={(e) => handleChange(e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                      title="Clic para elegir color"
                  />
                  <div 
                      className="absolute inset-0 z-10 pointer-events-none transition-colors duration-200"
                      style={{ backgroundColor: internalColor }}
                  />
              </div>

              {/* Hex Code Input - Below */}
              <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-mono font-bold">#</span>
                  <input 
                      type="text" 
                      value={internalColor.replace('#', '').toUpperCase()}
                      onChange={(e) => {
                          const val = e.target.value;
                          if (/^[0-9A-Fa-f]*$/.test(val) && val.length <= 6) {
                              const hex = '#' + val;
                              if (val.length === 3 || val.length === 6) {
                                  handleChange(hex);
                              }
                          }
                      }}
                      maxLength={6}
                      className="w-full pl-7 pr-3 py-2.5 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4f46e5] focus:border-[#4f46e5] outline-none font-mono text-gray-700 font-bold tracking-wide transition-all shadow-sm"
                      placeholder="HEX"
                  />
              </div>
          </div>
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
  onExit 
}) => {
  // Find the active event object
  const activeEvent = events?.find(e => e.id === currentEventId) || events?.[0] || DEFAULT_EVENT_TEMPLATE;

  // Local state for the form
  const [localConfig, setLocalConfig] = useState<EventConfig>({ ...activeEvent });
  const [activeTab, setActiveTab] = useState<'general' | 'categories' | 'gallery' | 'clients' | 'participants' | 'appearance'>('general');
  const [searchTerm, setSearchTerm] = useState('');

  // Gallery View Mode
  const [galleryView, setGalleryView] = useState<'active' | 'archived' | 'trash'>('active');
  const [filterParticipantId, setFilterParticipantId] = useState<string | null>(null);

  // Upload State
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Preview Modal State
  const [previewPhoto, setPreviewPhoto] = useState<Photo | null>(null);
  const [isDeletingPhoto, setIsDeletingPhoto] = useState(false);
  
  // Delete Confirmation Modal State (Event)
  const [showDeleteEventConfirm, setShowDeleteEventConfirm] = useState(false);

  // Delete Confirmation Modal State (Participant)
  const [participantToDelete, setParticipantToDelete] = useState<Participant | null>(null);
  // Delete Confirmation Modal State (Photo)
  const [photoToDelete, setPhotoToDelete] = useState<Photo | null>(null);
  
  // Bulk Delete Confirmation State
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  
  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Feedback State
  const [isLinkCopied, setIsLinkCopied] = useState(false);

  // Participants State
  const [newParticipantName, setNewParticipantName] = useState('');
  const [participantSearch, setParticipantSearch] = useState('');

  // Category State
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#3b82f6');

  // Update local form state when the selected event changes
  useEffect(() => {
    // Solo limpiar selección si cambiamos de álbum (ID distinto), no en updates del mismo
    if (activeEvent?.id !== localConfig?.id) {
        setSelectedIds([]); 
    }
    setLocalConfig({ ...activeEvent });
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

  const addParticipant = () => {
    const name = newParticipantName.trim();
    if (name) {
        const exists = localConfig.participants?.some(p => p.name.toLowerCase() === name.toLowerCase());
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
        // Actualizamos local y también campo directo
        const updatedParticipants = [...(localConfig.participants || []), newParticipant];
        setLocalConfig(prev => ({ ...prev, participants: updatedParticipants }));
        // Optimización: Guardar inmediatamente el participante
        onUpdateField('participants', updatedParticipants);
        setNewParticipantName('');
    }
  };
  
  const isContentOwnedBy = (photo: Photo, participant: Participant) => {
      if (photo.deviceId && photo.deviceId === participant.id) return true;
      const legacyId = `legacy-${photo.author.name.replace(/\s+/g, '-').toLowerCase()}`;
      if (participant.id === legacyId) return true;
      if (photo.author.name === participant.name) return true;
      return false;
  };

  const getParticipantContent = (participant: Participant) => {
      const sourcePhotos = currentEventPhotos || [];
      const content = sourcePhotos.filter(photo => 
          !photo.isDeleted && isContentOwnedBy(photo, participant)
      );
      const photosCount = content.filter(p => p.type !== 'video').length;
      const videosCount = content.filter(p => p.type === 'video').length;
      const previews = content.slice(0, 4).map(p => ({
          id: p.id,
          thumbnail: p.thumbnail,
          type: p.type
      }));
      return { photosCount, videosCount, previews, total: content.length };
  };

  const handleBannerChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      if (!activeEvent.id) {
          alert("Error: ID de evento no válido.");
          return;
      }
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
        console.error("Error subiendo portada:", error);
        alert("Error al subir la imagen.");
      } finally {
        setIsUploadingBanner(false);
      }
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      if (!activeEvent.id) {
          alert("Error: ID de evento no válido.");
          return;
      }
      setIsUploadingAvatar(true);
      const file = e.target.files[0];
      try {
        const timestamp = Date.now();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const path = `eventos/${activeEvent.id}/assets/avatar_${timestamp}_${sanitizedName}`;
        
        const url = await uploadFileToFirebase(file, path);
        const currentTheme = localConfig.theme || DEFAULT_EVENT_TEMPLATE.theme!;
        const updatedTheme = { ...currentTheme, avatarImage: url };
        setLocalConfig(prev => ({ ...prev, theme: updatedTheme }));
        onUpdateField('theme', updatedTheme);
      } catch (error) {
        console.error("Error subiendo avatar:", error);
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
      
      img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx?.drawImage(img, 0, 0);
          const pngFile = canvas.toDataURL("image/png");
          const downloadLink = document.createElement("a");
          downloadLink.download = `QR_${activeEvent.title.replace(/\s+/g, '_')}.png`;
          downloadLink.href = pngFile;
          downloadLink.click();
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
        const updatedCats = [...localConfig.categories, newCat];
        setLocalConfig(prev => ({
            ...prev,
            categories: updatedCats
        }));
        onUpdateField('categories', updatedCats);
        setNewCategoryName('');
        setNewCategoryColor('#3b82f6'); 
    }
  };

  const handleDeleteCategory = (id: string) => {
      if (localConfig.categories.length <= 1) {
          alert("Debe haber al menos una categoría.");
          return;
      }
      const updatedCats = localConfig.categories.filter(c => c.id !== id);
      setLocalConfig(prev => ({
          ...prev,
          categories: updatedCats
      }));
      onUpdateField('categories', updatedCats);
  };

  // --- BULK SELECTION HELPERS ---
  const displayedPhotos = currentEventPhotos.filter(p => {
      if (galleryView === 'trash') return p.isDeleted;
      if (galleryView === 'archived') return p.isArchived && !p.isDeleted;
      return !p.isDeleted && !p.isArchived;
  }).filter(p => !filterParticipantId || isContentOwnedBy(p, { id: filterParticipantId } as Participant));

  const toggleSelectAll = () => {
      const targetPhotos = displayedPhotos;
      const targetIds = targetPhotos.map(p => p.id);
      const allVisibleSelected = targetPhotos.length > 0 && targetPhotos.every(p => selectedIds.includes(p.id));
      if (allVisibleSelected) {
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

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden font-sans">
      <aside className="w-64 bg-gray-900 text-gray-300 flex flex-col shadow-2xl z-20 shrink-0">
        <div className="p-6 border-b border-gray-800">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Settings className="text-[#4f46e5]" />
            Admin Panel
          </h2>
          <p className="text-xs text-gray-500 mt-1 tracking-wider uppercase">Gestor de Eventos</p>
        </div>

        <div className="p-4 border-b border-gray-800">
            <button 
                onClick={onCreateEvent}
                className="w-full bg-[#4f46e5] hover:bg-[#4338ca] text-white p-3 rounded-lg flex items-center justify-center gap-2 mb-4 transition-all shadow-lg shadow-indigo-900/20 font-bold"
            >
                <Plus size={18} /> Crear Nuevo Álbum
            </button>

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                <input 
                    type="text" 
                    placeholder="Buscar evento..." 
                    className="w-full bg-gray-800 text-white pl-9 pr-3 py-2 rounded-lg text-sm border border-gray-700 focus:border-[#4f46e5] outline-none transition-colors"
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
            <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase mb-3 px-2">Mis Álbumes ({events?.length || 0})</h3>
                <ul className="space-y-1">
                    {events?.filter(e => e.title.toLowerCase().includes(searchTerm.toLowerCase()) || e.clientName?.toLowerCase().includes(searchTerm.toLowerCase())).map(event => (
                    <li key={event.id}>
                        <button
                        onClick={() => onSelectEvent(event.id)}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all ${currentEventId === event.id ? 'bg-gray-800 text-white shadow-md border-l-4 border-[#4f46e5]' : 'hover:bg-gray-800/50 hover:text-white'}`}
                        >
                         <Folder size={18} className={currentEventId === event.id ? 'text-[#4f46e5]' : 'text-gray-500'} />
                         <div className="text-left truncate">
                             <span className="block font-medium text-sm truncate">{event.title}</span>
                             <span className="block text-xs text-gray-500 flex items-center gap-1">
                                 <User size={10} /> {event.clientName}
                             </span>
                         </div>
                        </button>
                    </li>
                    ))}
                </ul>
            </div>

            {currentEventId && (
                <div>
                    <h3 className="text-xs font-bold text-gray-500 uppercase mb-3 px-2 mt-4 border-t border-gray-800 pt-4">
                        Editando: <span className="text-white">{activeEvent?.title}</span>
                    </h3>
                    <ul className="space-y-1">
                        {[
                            { id: 'general', icon: Layout, label: 'General' },
                            { id: 'appearance', icon: Palette, label: 'Personalización' },
                            { id: 'categories', icon: Grid, label: 'Categorías' },
                            { id: 'participants', icon: Users, label: 'Participantes' },
                            { id: 'clients', icon: UserCheck, label: 'Clientes' },
                            { id: 'gallery', icon: Image, label: 'Galería' },
                        ].map((item) => (
                            <li key={item.id}>
                                <button
                                    onClick={() => setActiveTab(item.id as any)}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm ${activeTab === item.id ? 'bg-[#4f46e5] text-white font-bold shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                                >
                                    <item.icon size={18} />
                                    {item.label}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </nav>
        
        <div className="p-4 border-t border-gray-800">
            <button onClick={onExit} className="w-full flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-sm px-2">
                <ArrowLeft size={16} /> Ver Frontend Cliente
            </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto relative bg-gray-50">
        <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between shadow-sm">
            <div>
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    {activeTab === 'general' && 'Vista Previa & Gestión'}
                    {activeTab === 'appearance' && 'Personalización'}
                    {activeTab === 'categories' && 'Gestión de Categorías'}
                    {activeTab === 'gallery' && 'Gestión de Imágenes'}
                    {activeTab === 'clients' && 'Gestión de Cliente'}
                    {activeTab === 'participants' && 'Lista de Participantes'}
                </h1>
                <p className="text-gray-500 text-sm">Editando álbum: {activeEvent?.title}</p>
            </div>
            <div className="flex gap-3">
                {activeTab === 'general' && (
                   <button 
                        onClick={() => setShowDeleteEventConfirm(true)}
                        className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm"
                    >
                        <Trash2 size={16} /> Eliminar Álbum
                   </button>
                )}
                <button 
                    id="save-btn"
                    onClick={handleSave} 
                    className="bg-[#4f46e5] hover:bg-[#4338ca] text-white px-6 py-2.5 rounded-lg shadow-lg shadow-indigo-200 font-bold flex items-center gap-2 transition-all transform active:scale-95"
                >
                    <Save size={18} /> Guardar Cambios
                </button>
            </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          {activeTab === 'appearance' && (
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-7 space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-4">
                            <ImageIcon className="text-[#4f46e5]" />
                            Cabecera & Branding
                        </h3>
                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Imagen de Portada</label>
                                <div className="relative group border-2 border-dashed border-gray-300 rounded-xl p-1 hover:border-[#4f46e5] transition-colors bg-gray-50">
                                    {localConfig.coverImage ? (
                                        <div className="relative h-48 rounded-lg overflow-hidden">
                                            <img 
                                                src={localConfig.coverImage} 
                                                className="w-full h-full object-cover" 
                                                alt="Cover" 
                                                style={{ 
                                                    objectPosition: `50% ${localConfig.theme?.coverImagePositionY || 50}%`,
                                                    filter: `blur(${localConfig.theme?.coverBlur || 0}px)` 
                                                }}
                                            />
                                            <div 
                                                className="absolute inset-0 pointer-events-none transition-colors duration-200"
                                                style={{ backgroundColor: hexToRgba(localConfig.theme?.coverOverlayColor || '#000000', localConfig.theme?.coverOverlayOpacity ?? 0.4) }}
                                            />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20">
                                                 <label className="cursor-pointer bg-white text-gray-800 px-4 py-2 rounded-full font-bold text-sm hover:scale-105 transition-transform shadow-lg">
                                                    Cambiar Imagen
                                                    <input type="file" className="hidden" onChange={handleBannerChange} accept="image/*" />
                                                 </label>
                                            </div>
                                        </div>
                                    ) : (
                                        <label className="flex flex-col items-center justify-center h-48 cursor-pointer hover:bg-gray-100 rounded-lg transition-colors">
                                            {isUploadingBanner ? <Loader2 className="animate-spin text-[#4f46e5]" size={32} /> : <Image size={32} className="text-gray-400 mb-2" />}
                                            <span className="text-sm text-gray-500 font-medium">Clic para subir imagen</span>
                                            <input type="file" className="hidden" onChange={handleBannerChange} accept="image/*" />
                                        </label>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
             </div>
          )}
          
          {activeTab === 'categories' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-4">
                            <Grid className="text-[#4f46e5]" />
                            Nueva Categoría
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Nombre</label>
                                <input 
                                    type="text" 
                                    value={newCategoryName}
                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#4f46e5] outline-none transition-all"
                                />
                            </div>
                            <div>
                                <ColorPicker 
                                    label="Color" 
                                    value={newCategoryColor} 
                                    onChange={setNewCategoryColor}
                                    fallback="#3b82f6"
                                />
                            </div>
                            <button 
                                onClick={handleAddCategory}
                                disabled={!newCategoryName.trim()}
                                className="w-full py-3 bg-[#4f46e5] text-white rounded-lg font-bold shadow-md hover:bg-[#4338ca] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                <Plus size={18} /> Añadir Categoría
                            </button>
                        </div>
                    </div>
                </div>
                <div className="lg:col-span-8">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="divide-y divide-gray-100">
                            {localConfig.categories.map((cat) => (
                                <div key={cat.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors group">
                                    <div className="flex items-center gap-4">
                                        <div 
                                            className="w-10 h-10 rounded-full shadow-sm border-2 border-white flex items-center justify-center text-white font-bold text-xs uppercase"
                                            style={{ backgroundColor: cat.color }}
                                        >
                                            {cat.name.substring(0, 2)}
                                        </div>
                                        <p className="font-bold text-gray-800">{cat.name}</p>
                                    </div>
                                    <button 
                                        onClick={() => handleDeleteCategory(cat.id)}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
          )}

          {activeTab === 'participants' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-4">
                            <UserPlus className="text-[#4f46e5]" />
                            Registrar Participante
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Nombre</label>
                                <input 
                                    type="text" 
                                    value={newParticipantName}
                                    onChange={(e) => setNewParticipantName(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#4f46e5] outline-none transition-all"
                                />
                            </div>
                            <button 
                                onClick={addParticipant}
                                disabled={!newParticipantName.trim()}
                                className="w-full py-3 bg-[#4f46e5] text-white rounded-lg font-bold shadow-md hover:bg-[#4338ca] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                <Plus size={18} /> Añadir Manualmente
                            </button>
                        </div>
                    </div>
                </div>
                <div className="lg:col-span-8">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                             <h3 className="font-bold text-gray-700">Lista de Participantes</h3>
                             <input 
                                    type="text" 
                                    placeholder="Buscar..."
                                    value={participantSearch}
                                    onChange={(e) => setParticipantSearch(e.target.value)}
                                    className="pl-3 pr-3 py-1.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-[#4f46e5] outline-none"
                                />
                        </div>
                        <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto custom-scrollbar">
                            {localConfig.participants && localConfig.participants.length > 0 ? (
                                localConfig.participants
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
                                                <button 
                                                    onClick={() => {
                                                        const updated = localConfig.participants.filter(part => part.id !== p.id);
                                                        setLocalConfig(prev => ({ ...prev, participants: updated }));
                                                        onUpdateField('participants', updated);
                                                    }}
                                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="p-8 text-center text-gray-400">No hay participantes registrados.</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
          )}

          {activeTab === 'general' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-6">
                      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                           <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <FileText className="text-[#4f46e5]" />
                                Información Básica
                           </h3>
                           <div className="space-y-4">
                               <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                                    <input type="text" value={localConfig.title} onChange={(e) => setLocalConfig({...localConfig, title: e.target.value})} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#4f46e5] outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                                    <input type="text" value={localConfig.date} onChange={(e) => setLocalConfig({...localConfig, date: e.target.value})} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#4f46e5] outline-none" />
                                </div>
                           </div>
                      </div>
                  </div>
              </div>
          )}
          
          {activeTab === 'gallery' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[calc(100vh-150px)]">
                <div className="px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 bg-white z-20 sticky top-0">
                    <div className="flex items-center bg-gray-100 p-1 rounded-lg w-full sm:w-auto">
                        <button onClick={() => setGalleryView('active')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${galleryView === 'active' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Activa</button>
                        <button onClick={() => setGalleryView('archived')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${galleryView === 'archived' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Ocultos</button>
                        <button onClick={() => setGalleryView('trash')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${galleryView === 'trash' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-red-500'}`}>Papelera</button>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                        <GoogleDriveImporter onFilesSelected={onDriveImport} isProcessing={isProcessing} />
                        {selectedIds.length > 0 && (
                             <div className="flex items-center gap-2 animate-fade-in">
                                 <span className="text-xs font-bold text-[#4f46e5] mr-2">{selectedIds.length} seleccionados</span>
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
                        <button onClick={toggleSelectAll} className="text-gray-500 hover:text-[#4f46e5] flex items-center gap-2 text-sm font-medium px-2">
                            {displayedPhotos.length > 0 && displayedPhotos.every(p => selectedIds.includes(p.id)) ? <><CheckSquare size={18} /> Todo</> : <><Square size={18} /> Seleccionar Todo</>}
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-gray-50 custom-scrollbar">
                    {displayedPhotos.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                             <Image size={64} className="mb-4" />
                             <p>No hay imágenes en esta sección</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            {displayedPhotos.map(photo => (
                                <div key={photo.id} className={`relative group aspect-square rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${selectedIds.includes(photo.id) ? 'border-[#4f46e5] ring-2 ring-[#4f46e5]/20' : 'border-gray-200 hover:border-gray-300'}`} onClick={() => toggleSelection(photo.id)}>
                                    <div className={`absolute top-2 left-2 z-10 w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedIds.includes(photo.id) ? 'bg-[#4f46e5] border-[#4f46e5] text-white' : 'bg-white/80 border-gray-300 hover:border-[#4f46e5]'}`}>
                                        {selectedIds.includes(photo.id) && <Check size={12} strokeWidth={4} />}
                                    </div>
                                    {photo.type === 'video' ? (
                                        <video src={photo.thumbnail} className="w-full h-full object-cover" muted />
                                    ) : (
                                        <img src={photo.thumbnail} className="w-full h-full object-cover" loading="lazy" />
                                    )}
                                    <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                        <button onClick={(e) => { e.stopPropagation(); setPreviewPhoto(photo); }} className="bg-white/90 hover:bg-white p-2 rounded-md shadow-sm"><Maximize2 size={16} /></button>
                                        {!photo.isDeleted && (
                                            <button onClick={(e) => { e.stopPropagation(); onArchivePhoto(photo.id); }} className="bg-white/90 hover:bg-white p-2 rounded-md shadow-sm">{photo.isArchived ? <Eye size={16} /> : <EyeOff size={16} />}</button>
                                        )}
                                        {photo.isDeleted ? (
                                             <button onClick={(e) => { e.stopPropagation(); onRestorePhoto(photo.id); }} className="bg-white/90 hover:bg-white p-2 rounded-md shadow-sm text-green-600"><RotateCcw size={16} /></button>
                                        ) : (
                                            <button onClick={(e) => { e.stopPropagation(); onDeletePhoto(photo.id); }} className="bg-white/90 hover:bg-white p-2 rounded-md shadow-sm text-red-500"><Trash2 size={16} /></button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
          )}
          
          {activeTab === 'clients' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
                  <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                      <UserCheck className="text-[#4f46e5]" /> Gestión de Cliente
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      <div className="space-y-6">
                          <div>
                              <label className="block text-sm font-bold text-gray-700 mb-2">Cliente</label>
                              <input type="text" value={localConfig.clientName} onChange={(e) => setLocalConfig({...localConfig, clientName: e.target.value})} className="w-full p-4 bg-gray-800 text-white rounded-xl border border-gray-700 focus:ring-2 focus:ring-[#4f46e5] outline-none font-medium text-lg" />
                          </div>
                          <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
                              <h4 className="text-blue-800 font-bold flex items-center gap-2 mb-2"><ExternalLink size={18} /> Enlace Público</h4>
                              <p className="text-blue-600/80 text-xs mb-3 break-all">{APP_URL}?event={activeEvent.publicToken || activeEvent.id}</p>
                              <button onClick={() => {navigator.clipboard.writeText(`${APP_URL}?event=${activeEvent.publicToken || activeEvent.id}`); setIsLinkCopied(true); setTimeout(() => setIsLinkCopied(false), 2000);}} className={`bg-white border px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 ${isLinkCopied ? 'text-green-600 border-green-200 bg-green-50' : 'text-blue-600 border-blue-200 hover:bg-blue-50'}`}>{isLinkCopied ? <><Check size={18} /> ¡Copiado!</> : 'Copiar Enlace'}</button>
                          </div>
                      </div>
                      <div className="bg-gray-50 p-8 rounded-xl border border-gray-200 flex flex-col items-center justify-center text-center">
                           <div className="bg-white p-4 rounded-xl shadow-sm mb-6">
                               <QRCode id="qr-code-svg" value={`${APP_URL}?event=${activeEvent.publicToken || activeEvent.id}`} size={180} level="H" />
                           </div>
                           <button onClick={handleDownloadQR} className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-300 rounded-full text-gray-700 font-bold hover:bg-gray-100 transition-all shadow-sm">Descargar QR</button>
                      </div>
                  </div>
              </div>
          )}
        </div>
      </main>

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
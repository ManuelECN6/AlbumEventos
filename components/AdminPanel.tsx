
import React, { useState, useEffect, useCallback } from 'react';
import { EventConfig, Category, Photo, Participant } from '../types';
import { Save, Plus, Trash, Settings, Layout, Image, ArrowLeft, Pencil, Check, X as XIcon, LogOut, FolderPlus, Folder, Users, Search, Video, Grid, Eye, EyeOff, Lock, Link as LinkIcon, Copy, RefreshCw, UserCheck, ExternalLink, Menu, Maximize2, Calendar, Clock, CheckSquare, Square, UserPlus, Mail, BadgeCheck, AlertCircle, Palette, Upload, Type, Cloud, FileText, QrCode, Download, Loader2, HelpCircle, PieChart, Camera, PlayCircle, RotateCcw, Trash2, Filter, AlertTriangle, UserX, Heart, ImageIcon, Sliders, Droplet, Zap, User, CheckCircle, Info } from 'lucide-react';
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
      galleryToolbarBg: '#ffffff',
      galleryToolbarText: '#1f2937',
      cardBackgroundColor: '#ffffff',
      cardTextColor: '#1f2937'
    },
    googleDriveUrl: '',
    isDriveBackupEnabled: false
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
  const activeEvent = events.find(e => e.id === currentEventId) || events[0];

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
  const [participantViewMode, setParticipantViewMode] = useState<'active' | 'trash'>('active');

  // Category State
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#3b82f6');

  // Update local form state when the selected event changes
  useEffect(() => {
    // Solo limpiar selección si cambiamos de álbum (ID distinto), no en updates del mismo
    if (activeEvent.id !== localConfig.id) {
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
        // Verificar si ya existe
        const exists = localConfig.participants?.some(p => p.name.toLowerCase() === name.toLowerCase());
        if (exists) {
            alert("Ya existe un participante con este nombre.");
            return;
        }

        const newParticipant: Participant = {
            id: `p-${Date.now()}`, // Manual IDs are prefixed with p-
            name: name,
            status: 'confirmed',
            addedAt: new Date().toISOString().split('T')[0]
        };
        setLocalConfig(prev => ({
            ...prev,
            participants: [...(prev.participants || []), newParticipant]
        }));
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
      setIsUploadingBanner(true);
      const file = e.target.files[0];
      try {
        const timestamp = Date.now();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        // ESTRICTA ESTRUCTURA DE CARPETAS: eventos/{ID}/assets/banner_{timestamp}
        const path = `eventos/${activeEvent.id}/assets/banner_${timestamp}_${sanitizedName}`;
        
        const url = await uploadFileToFirebase(file, path);
        setLocalConfig(prev => ({ ...prev, coverImage: url }));
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
      setIsUploadingAvatar(true);
      const file = e.target.files[0];
      try {
        const timestamp = Date.now();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        // ESTRICTA ESTRUCTURA DE CARPETAS: eventos/{ID}/assets/avatar_{timestamp}
        const path = `eventos/${activeEvent.id}/assets/avatar_${timestamp}_${sanitizedName}`;
        
        const url = await uploadFileToFirebase(file, path);
        const currentTheme = localConfig.theme || DEFAULT_EVENT_TEMPLATE.theme!;
        setLocalConfig(prev => ({ ...prev, theme: { ...currentTheme, avatarImage: url } }));
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

  // --- CATEGORY HANDLERS ---
  const handleAddCategory = () => {
    if (newCategoryName.trim()) {
        const newCat: Category = {
            id: `c-${Date.now()}`,
            name: newCategoryName.trim(),
            color: newCategoryColor
        };
        setLocalConfig(prev => ({
            ...prev,
            categories: [...prev.categories, newCat]
        }));
        setNewCategoryName('');
        setNewCategoryColor('#3b82f6'); 
    }
  };

  const handleDeleteCategory = (id: string) => {
      if (localConfig.categories.length <= 1) {
          alert("Debe haber al menos una categoría.");
          return;
      }
      setLocalConfig(prev => ({
          ...prev,
          categories: prev.categories.filter(c => c.id !== id)
      }));
  };

  // --- BULK SELECTION HELPERS ---
  
  // Filtered photos based on current view (active/trash/archived)
  const displayedPhotos = currentEventPhotos.filter(p => {
      if (galleryView === 'trash') return p.isDeleted;
      if (galleryView === 'archived') return p.isArchived && !p.isDeleted;
      return !p.isDeleted && !p.isArchived;
  }).filter(p => !filterParticipantId || isContentOwnedBy(p, { id: filterParticipantId } as Participant));

  const toggleSelectAll = () => {
      const targetPhotos = displayedPhotos;
      const targetIds = targetPhotos.map(p => p.id);
      
      // Verificamos si TODOS los visibles ya están seleccionados
      const allVisibleSelected = targetPhotos.length > 0 && targetPhotos.every(p => selectedIds.includes(p.id));
      
      if (allVisibleSelected) {
          // DESELECT OPERATION: Remove only the displayed photos from selection
          setSelectedIds(prev => prev.filter(id => !targetIds.includes(id)));
      } else {
          // SELECT OPERATION: Add displayed photos to selection (using Set to avoid duplicates)
          setSelectedIds(prev => Array.from(new Set([...prev, ...targetIds])));
      }
  };
  
  const toggleSelection = (id: string) => {
      setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };
  
  const executeBulkDelete = async () => {
      if (selectedIds.length === 0) return;
      
      // Si estamos en papelera, es borrado permanente -> EXIGIMOS CONFIRMACIÓN
      if (galleryView === 'trash') {
         setShowBulkDeleteConfirm(true);
      } else {
          // Soft delete -> Enviar a papelera (reversible)
          onBulkDelete(selectedIds);
          setSelectedIds([]);
      }
  };

  // --- HELPER FOR PREVIEW ---
  const hexToRgba = (hex: string, alpha: number) => {
      let c: any;
      if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
          c = hex.substring(1).split('');
          if (c.length === 3) c = [c[0], c[0], c[1], c[1], c[2], c[2]];
          c = '0x' + c.join('');
          return 'rgba(' + [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',') + ',' + alpha + ')';
      }
      return hex;
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-gray-300 flex flex-col shadow-2xl z-20 shrink-0">
        {/* ... (Sidebar Content Same as before) ... */}
        <div className="p-6 border-b border-gray-800">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Settings className="text-[#4f46e5]" />
            Admin Panel
          </h2>
          <p className="text-xs text-gray-500 mt-1 tracking-wider uppercase">Gestor de Eventos</p>
        </div>

        {/* Event Selector */}
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
                    placeholder="Buscar evento o cliente..." 
                    className="w-full bg-gray-800 text-white pl-9 pr-3 py-2 rounded-lg text-sm border border-gray-700 focus:border-[#4f46e5] outline-none transition-colors"
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
            <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase mb-3 px-2">Mis Álbumes ({events.length})</h3>
                <ul className="space-y-1">
                    {events.filter(e => e.title.toLowerCase().includes(searchTerm.toLowerCase()) || e.clientName?.toLowerCase().includes(searchTerm.toLowerCase())).map(event => (
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
                        Editando: <span className="text-white">{activeEvent.title}</span>
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

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative bg-gray-50">
        {/* Sticky Header */}
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
                <p className="text-gray-500 text-sm">Editando álbum: {activeEvent.title}</p>
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
                    {/* Header & Branding Config */}
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
                                            {/* OVERLAY DIV ADDED HERE */}
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
                                            <button 
                                                onClick={() => setLocalConfig(prev => ({ ...prev, coverImage: '' }))}
                                                className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-20"
                                            >
                                                <Trash size={14} />
                                            </button>
                                        </div>
                                    ) : (
                                        <label className="flex flex-col items-center justify-center h-48 cursor-pointer hover:bg-gray-100 rounded-lg transition-colors">
                                            {isUploadingBanner ? <Loader2 className="animate-spin text-[#4f46e5]" size={32} /> : <Image size={32} className="text-gray-400 mb-2" />}
                                            <span className="text-sm text-gray-500 font-medium">Clic para subir imagen</span>
                                            <span className="text-xs text-gray-400 mt-1">Recomendado: 1920x1080px</span>
                                            <input type="file" className="hidden" onChange={handleBannerChange} accept="image/*" />
                                        </label>
                                    )}
                                </div>
                                
                                {/* Sliders for Blur and Overlay Config */}
                                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                                    {/* Blur Control */}
                                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 h-full">
                                        <div className="flex justify-between items-center mb-3">
                                            <label className="block text-xs font-bold text-gray-500 uppercase">Desenfocar Fondo</label>
                                            <span className="text-xs font-mono text-gray-600 bg-white border border-gray-200 px-2 py-0.5 rounded">{localConfig.theme?.coverBlur || 0}px</span>
                                        </div>
                                        <input 
                                            type="range" 
                                            min="0" max="20" 
                                            value={localConfig.theme?.coverBlur || 0}
                                            onChange={(e) => setLocalConfig(prev => ({ ...prev, theme: { ...prev.theme!, coverBlur: parseInt(e.target.value) } }))}
                                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#4f46e5]"
                                        />
                                        <p className="text-[10px] text-gray-400 mt-3 leading-tight">
                                            Aplica un efecto borroso a la imagen de portada para mejorar la legibilidad del texto.
                                        </p>
                                    </div>

                                    {/* Overlay Control */}
                                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full border border-gray-300 shadow-sm" style={{ backgroundColor: localConfig.theme?.coverOverlayColor || '#000000' }}></div>
                                            Capa de Superposición
                                        </label>
                                        
                                        <div className="mb-4">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase">Opacidad</span>
                                                <span className="text-[10px] font-mono text-gray-600 bg-white border border-gray-200 px-2 py-0.5 rounded">{Math.round((localConfig.theme?.coverOverlayOpacity ?? 0.4) * 100)}%</span>
                                            </div>
                                            <input 
                                                type="range" 
                                                min="0" max="100" 
                                                value={(localConfig.theme?.coverOverlayOpacity ?? 0.4) * 100}
                                                onChange={(e) => setLocalConfig(prev => ({ ...prev, theme: { ...prev.theme!, coverOverlayOpacity: parseInt(e.target.value) / 100 } }))}
                                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#4f46e5]"
                                            />
                                        </div>

                                        <ColorPicker 
                                            label="Color del Overlay" 
                                            value={localConfig.theme?.coverOverlayColor} 
                                            onChange={(c) => setLocalConfig(prev => ({ ...prev, theme: { ...prev.theme!, coverOverlayColor: c } }))} 
                                            fallback="#000000"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Avatar / Logo del Evento</label>
                                    <div className="flex items-center gap-4">
                                        <div className="w-20 h-20 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden relative group">
                                             {localConfig.theme?.avatarImage ? (
                                                 <>
                                                    <img src={localConfig.theme.avatarImage} alt="Avatar" className="w-full h-full object-cover" />
                                                    <button 
                                                        onClick={() => setLocalConfig(prev => ({ ...prev, theme: { ...prev.theme!, avatarImage: '' } }))}
                                                        className="absolute inset-0 bg-black/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <Trash size={16} />
                                                    </button>
                                                 </>
                                             ) : (
                                                 <span 
                                                    className="text-2xl font-bold"
                                                    style={{ color: localConfig.theme?.avatarTextColor || '#ffffff' }}
                                                  >
                                                     {localConfig.title.substring(0,2).toUpperCase()}
                                                 </span>
                                             )}
                                             
                                             {!localConfig.theme?.avatarImage && (
                                                <div 
                                                    className="absolute inset-0 -z-10" 
                                                    style={{ backgroundColor: localConfig.theme?.avatarBackgroundColor || '#374151' }} 
                                                />
                                             )}
                                        </div>
                                        <div className="flex-1">
                                            <label className="block w-full">
                                                <span className="sr-only">Subir logo</span>
                                                <div className="bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 text-xs font-bold py-2 px-4 rounded-lg cursor-pointer text-center transition-colors flex items-center justify-center gap-2">
                                                    {isUploadingAvatar ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
                                                    Subir Logo Personalizado
                                                </div>
                                                <input type="file" className="hidden" onChange={handleAvatarChange} accept="image/*" />
                                            </label>
                                            <p className="text-[10px] text-gray-400 mt-2 leading-tight">
                                                O personaliza los colores del avatar por defecto abajo.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                     <div className="grid grid-cols-2 gap-3">
                                        <ColorPicker 
                                            label="Fondo Avatar" 
                                            value={localConfig.theme?.avatarBackgroundColor} 
                                            onChange={(c) => setLocalConfig(prev => ({ ...prev, theme: { ...prev.theme!, avatarBackgroundColor: c } }))} 
                                            fallback="#374151"
                                        />
                                        <ColorPicker 
                                            label="Texto Avatar" 
                                            value={localConfig.theme?.avatarTextColor} 
                                            onChange={(c) => setLocalConfig(prev => ({ ...prev, theme: { ...prev.theme!, avatarTextColor: c } }))} 
                                            fallback="#ffffff"
                                        />
                                     </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Colors & Style */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-4">
                            <Palette className="text-[#4f46e5]" />
                            Colores y Estilo Global
                        </h3>
                        
                        <div className="space-y-8">
                            {/* Primary & Secondary Buttons */}
                            <div>
                                <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                                    <Zap size={16} className="text-yellow-500" /> Botones de Acción
                                </h4>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
                                        <p className="text-xs font-bold text-gray-500 uppercase border-b border-gray-200 pb-2 mb-2">Botón Principal (Subir)</p>
                                        <ColorPicker 
                                            label="Fondo Principal" 
                                            value={localConfig.theme?.primaryColor} 
                                            onChange={(c) => setLocalConfig(prev => ({ ...prev, theme: { ...prev.theme!, primaryColor: c } }))} 
                                            fallback="#a87b51"
                                        />
                                        <ColorPicker 
                                            label="Texto Principal" 
                                            value={localConfig.theme?.primaryTextColor} 
                                            onChange={(c) => setLocalConfig(prev => ({ ...prev, theme: { ...prev.theme!, primaryTextColor: c } }))} 
                                            fallback="#ffffff"
                                        />
                                    </div>
                                    <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
                                        <p className="text-xs font-bold text-gray-500 uppercase border-b border-gray-200 pb-2 mb-2">Botón Secundario (Descargar)</p>
                                        <ColorPicker 
                                            label="Fondo Secundario" 
                                            value={localConfig.theme?.secondaryColor} 
                                            onChange={(c) => setLocalConfig(prev => ({ ...prev, theme: { ...prev.theme!, secondaryColor: c } }))} 
                                            fallback="#4f46e5"
                                        />
                                        <ColorPicker 
                                            label="Texto Secundario" 
                                            value={localConfig.theme?.secondaryTextColor} 
                                            onChange={(c) => setLocalConfig(prev => ({ ...prev, theme: { ...prev.theme!, secondaryTextColor: c } }))} 
                                            fallback="#ffffff"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Background & Typography */}
                            <div>
                                <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                                    <Droplet size={16} className="text-blue-400" /> Fondo y Tipografía
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                                    <ColorPicker 
                                        label="Color de Fondo General" 
                                        value={localConfig.theme?.backgroundColor} 
                                        onChange={(c) => setLocalConfig(prev => ({ ...prev, theme: { ...prev.theme!, backgroundColor: c } }))} 
                                        fallback="#f5f0e6"
                                    />
                                    <ColorPicker 
                                        label="Color Texto General" 
                                        value={localConfig.theme?.textColor} 
                                        onChange={(c) => setLocalConfig(prev => ({ ...prev, theme: { ...prev.theme!, textColor: c } }))} 
                                        fallback="#1f2937"
                                    />
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2 tracking-wider">Tipografía</label>
                                        <div className="flex flex-col gap-2">
                                            <button 
                                                onClick={() => setLocalConfig(prev => ({ ...prev, theme: { ...prev.theme!, fontFamily: 'sans' } }))}
                                                className={`px-3 py-3 rounded-lg border text-sm font-sans flex items-center justify-between ${localConfig.theme?.fontFamily === 'sans' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-700 border-gray-300'}`}
                                            >
                                                <span>Modern Sans</span>
                                                {localConfig.theme?.fontFamily === 'sans' && <Check size={14} />}
                                            </button>
                                            <button 
                                                onClick={() => setLocalConfig(prev => ({ ...prev, theme: { ...prev.theme!, fontFamily: 'serif' } }))}
                                                className={`px-3 py-3 rounded-lg border text-sm font-serif flex items-center justify-between ${localConfig.theme?.fontFamily === 'serif' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-700 border-gray-300'}`}
                                            >
                                                <span>Classic Serif</span>
                                                {localConfig.theme?.fontFamily === 'serif' && <Check size={14} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Gallery & Cards Customization */}
                            <div>
                                <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                                    <Layout size={16} className="text-indigo-500" /> Personalización de Galería y Tarjetas
                                </h4>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
                                         <p className="text-xs font-bold text-gray-500 uppercase border-b border-gray-200 pb-2 mb-2">Barra de Herramientas</p>
                                         <ColorPicker 
                                            label="Fondo Barra" 
                                            value={localConfig.theme?.galleryToolbarBg} 
                                            onChange={(c) => setLocalConfig(prev => ({ ...prev, theme: { ...prev.theme!, galleryToolbarBg: c } }))} 
                                            fallback="#ffffff"
                                        />
                                        <ColorPicker 
                                            label="Iconos/Texto Barra" 
                                            value={localConfig.theme?.galleryToolbarText} 
                                            onChange={(c) => setLocalConfig(prev => ({ ...prev, theme: { ...prev.theme!, galleryToolbarText: c } }))} 
                                            fallback="#1f2937"
                                        />
                                    </div>
                                    <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
                                        <p className="text-xs font-bold text-gray-500 uppercase border-b border-gray-200 pb-2 mb-2">Tarjeta de Foto</p>
                                        <ColorPicker 
                                            label="Fondo de Tarjeta" 
                                            value={localConfig.theme?.cardBackgroundColor} 
                                            onChange={(c) => setLocalConfig(prev => ({ ...prev, theme: { ...prev.theme!, cardBackgroundColor: c } }))} 
                                            fallback="#ffffff"
                                        />
                                        <ColorPicker 
                                            label="Texto Principal Tarjeta" 
                                            value={localConfig.theme?.cardTextColor} 
                                            onChange={(c) => setLocalConfig(prev => ({ ...prev, theme: { ...prev.theme!, cardTextColor: c } }))} 
                                            fallback="#1f2937"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Specific Text Colors */}
                            <div>
                                <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                                    <Type size={16} className="text-gray-600" /> Detalles de Texto
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                                    <ColorPicker 
                                        label="Título Cabecera" 
                                        value={localConfig.theme?.headerTitleColor} 
                                        onChange={(c) => setLocalConfig(prev => ({ ...prev, theme: { ...prev.theme!, headerTitleColor: c } }))} 
                                        fallback="#1f2937"
                                    />
                                    <ColorPicker 
                                        label="Fecha / Subtítulo" 
                                        value={localConfig.theme?.headerDateColor} 
                                        onChange={(c) => setLocalConfig(prev => ({ ...prev, theme: { ...prev.theme!, headerDateColor: c } }))} 
                                        fallback="#6b7280"
                                    />
                                    <ColorPicker 
                                        label="Estadísticas" 
                                        value={localConfig.theme?.statsTextColor} 
                                        onChange={(c) => setLocalConfig(prev => ({ ...prev, theme: { ...prev.theme!, statsTextColor: c } }))} 
                                        fallback="#6b7280"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                 </div>
                 
                 {/* LIVE PREVIEW COLUMN */}
                 <div className="lg:col-span-5">
                     <div className="sticky top-24">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-gray-500 uppercase flex items-center gap-2">
                                <Eye size={16} /> Vista Previa en Vivo
                            </h3>
                            <span className="text-[10px] bg-gray-200 px-2 py-1 rounded text-gray-500">Modo Móvil</span>
                        </div>
                        
                        <div className="border-[8px] border-gray-800 rounded-[2.5rem] overflow-hidden shadow-2xl bg-white h-[650px] relative flex flex-col w-full max-w-[350px] mx-auto">
                             {/* Mock Phone Status Bar */}
                             <div className="h-6 bg-gray-800 w-full flex items-center justify-between px-6 shrink-0 z-20 relative">
                                 <div className="w-12 h-3 bg-black rounded-b-lg mx-auto absolute left-0 right-0 top-0"></div>
                                 <span className="text-[8px] text-white font-medium">9:41</span>
                                 <div className="flex gap-1">
                                     <div className="w-3 h-2 bg-white rounded-sm"></div>
                                     <div className="w-3 h-2 bg-white rounded-sm"></div>
                                 </div>
                             </div>
                             
                             {/* APP CONTENT */}
                             <div 
                                className={`flex-1 overflow-y-auto relative ${localConfig.theme?.fontFamily === 'serif' ? 'font-serif' : 'font-sans'}`}
                                style={{ 
                                    backgroundColor: localConfig.theme?.backgroundColor || '#f5f0e6',
                                    color: localConfig.theme?.textColor || '#1f2937'
                                }}
                             >
                                 {/* Header Area */}
                                 <div className="relative min-h-[200px] flex flex-col justify-end p-4">
                                      {localConfig.coverImage && (
                                          <div className="absolute inset-0 z-0">
                                               <img 
                                                  src={localConfig.coverImage} 
                                                  className="w-full h-full object-cover" 
                                                  style={{ 
                                                      objectPosition: `50% ${localConfig.theme?.coverImagePositionY || 50}%`,
                                                      filter: `blur(${localConfig.theme?.coverBlur || 0}px)` 
                                                  }}
                                               />
                                               <div 
                                                    className="absolute inset-0" 
                                                    style={{ backgroundColor: hexToRgba(localConfig.theme?.coverOverlayColor || '#000000', localConfig.theme?.coverOverlayOpacity ?? 0.4) }}
                                               />
                                          </div>
                                      )}
                                      
                                      <div className="relative z-10 text-center">
                                          <div 
                                            className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center border-2 border-white/30 shadow-sm overflow-hidden"
                                            style={{ 
                                                backgroundColor: localConfig.theme?.avatarBackgroundColor || '#374151',
                                                color: localConfig.theme?.avatarTextColor || '#ffffff'
                                            }}
                                          >
                                              {localConfig.theme?.avatarImage ? (
                                                  <img src={localConfig.theme.avatarImage} className="w-full h-full object-cover" />
                                              ) : (
                                                  <span className="text-lg font-bold">{localConfig.title.substring(0,2).toUpperCase()}</span>
                                              )}
                                          </div>
                                          
                                          <h2 className="text-xl font-bold leading-tight mb-1" style={{ color: localConfig.theme?.headerTitleColor }}>
                                              {localConfig.title}
                                          </h2>
                                          <p className="text-xs mb-3 flex items-center justify-center gap-2" style={{ color: localConfig.theme?.headerDateColor }}>
                                              <span>{localConfig.subtitle}</span> • <span>{localConfig.date}</span>
                                          </p>
                                          
                                          <div className="flex justify-center gap-4 text-[10px] font-bold uppercase tracking-wide mb-4" style={{ color: localConfig.theme?.statsTextColor }}>
                                              <div className="flex flex-col"><span className="text-sm">124</span> Fotos</div>
                                              <div className="flex flex-col"><span className="text-sm">86</span> Likes</div>
                                              <div className="flex flex-col"><span className="text-sm">15</span> Invitados</div>
                                          </div>
                                          
                                          <div className="flex gap-2 justify-center">
                                              <div className="px-4 py-2 rounded-full text-xs font-bold shadow-sm flex items-center gap-1" style={{ backgroundColor: localConfig.theme?.primaryColor, color: localConfig.theme?.primaryTextColor }}>
                                                  <Camera size={12} /> Subir
                                              </div>
                                              <div className="px-4 py-2 rounded-full text-xs font-bold shadow-sm flex items-center gap-1" style={{ backgroundColor: localConfig.theme?.secondaryColor, color: localConfig.theme?.secondaryTextColor }}>
                                                  <Download size={12} />
                                              </div>
                                          </div>
                                      </div>
                                 </div>

                                 {/* Body / Grid Mockup */}
                                 <div className="p-4 space-y-3">
                                     {/* Mock Gallery Toolbar */}
                                     <div 
                                        className="p-3 rounded-xl shadow-sm flex items-center justify-between mb-2"
                                        style={{ 
                                            backgroundColor: localConfig.theme?.galleryToolbarBg || '#ffffff',
                                            color: localConfig.theme?.galleryToolbarText || '#1f2937'
                                        }}
                                     >
                                         <div className="flex items-center gap-2 font-bold text-xs">
                                             <Grid size={14} /> Galería
                                         </div>
                                         <div className="flex gap-1">
                                            <div className="w-6 h-6 rounded flex items-center justify-center" style={{ backgroundColor: localConfig.theme?.secondaryColor, color: localConfig.theme?.secondaryTextColor }}><Layout size={12} /></div>
                                         </div>
                                     </div>
                                     
                                     <div className="grid grid-cols-2 gap-2">
                                         {[1,2,3,4].map(i => (
                                             <div 
                                                key={i} 
                                                className="rounded-lg overflow-hidden shadow-sm relative group"
                                                style={{ 
                                                    backgroundColor: localConfig.theme?.cardBackgroundColor || '#ffffff' 
                                                }}
                                             >
                                                 {/* Card Header (Mock) */}
                                                 <div className="p-2 flex items-center gap-2">
                                                     <div className="w-4 h-4 rounded-full bg-gray-300"></div>
                                                     <span className="text-[8px] font-bold" style={{ color: localConfig.theme?.cardTextColor || '#1f2937' }}>Usuario</span>
                                                 </div>
                                                 
                                                 <div className="aspect-square bg-gray-200 flex items-center justify-center text-gray-400">
                                                     <ImageIcon size={24} />
                                                 </div>
                                                 
                                                 {/* Card Footer (Mock) */}
                                                 <div 
                                                    className="p-2 border-t flex justify-between items-center"
                                                    style={{ borderColor: hexToRgba(localConfig.theme?.cardTextColor || '#000000', 0.1) }}
                                                 >
                                                     <div className="flex items-center gap-1">
                                                         <Heart size={10} style={{ color: localConfig.theme?.cardTextColor || '#6b7280' }} />
                                                         <span className="text-[8px] font-bold" style={{ color: localConfig.theme?.cardTextColor || '#6b7280' }}>12</span>
                                                     </div>
                                                 </div>
                                             </div>
                                         ))}
                                     </div>
                                 </div>
                             </div>
                             
                             {/* Phone Home Indicator */}
                             <div className="absolute bottom-1 left-0 right-0 flex justify-center z-30">
                                 <div className="w-24 h-1 bg-gray-800 rounded-full opacity-20"></div>
                             </div>
                        </div>
                     </div>
                 </div>
            </div>
          )}
          {/* ... (rest of the file remains unchanged) ... */}
          {activeTab === 'categories' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Sidebar: Add New */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-4">
                            <Grid className="text-[#4f46e5]" />
                            Nueva Categoría
                        </h3>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Nombre de la Categoría</label>
                                <input 
                                    type="text" 
                                    value={newCategoryName}
                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                    placeholder="Ej: Boda, Fiesta, Viaje..."
                                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#4f46e5] outline-none transition-all"
                                />
                            </div>
                            
                            <div>
                                <ColorPicker 
                                    label="Color Identificativo" 
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
                    
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm text-blue-800">
                        <p className="flex gap-2">
                            <HelpCircle size={16} className="shrink-0 mt-0.5" />
                            <span>Las categorías ayudan a organizar las fotos en la galería pública. Cada foto tendrá una etiqueta con el color seleccionado.</span>
                        </p>
                    </div>
                </div>

                {/* Main: List */}
                <div className="lg:col-span-8">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                             <h3 className="font-bold text-gray-700">Categorías Existentes ({localConfig.categories.length})</h3>
                        </div>
                        
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
                                        <div>
                                            <p className="font-bold text-gray-800">{cat.name}</p>
                                            <p className="text-xs text-gray-400 font-mono">{cat.id}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={() => handleDeleteCategory(cat.id)}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Eliminar"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            
                            {localConfig.categories.length === 0 && (
                                <div className="p-8 text-center text-gray-400">
                                    No hay categorías definidas.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
          )}

          {activeTab === 'participants' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Sidebar: Add New */}
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
                                    placeholder="Ej: Juan Pérez"
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
                    
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm text-blue-800">
                        <p className="flex gap-2">
                            <HelpCircle size={16} className="shrink-0 mt-0.5" />
                            <span>Los participantes se registran automáticamente al subir fotos. Aquí puedes gestionar el acceso o añadir nombres manualmente.</span>
                        </p>
                    </div>
                </div>

                {/* Main: List */}
                <div className="lg:col-span-8">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                             <h3 className="font-bold text-gray-700">Lista de Participantes ({localConfig.participants?.length || 0})</h3>
                             <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                <input 
                                    type="text" 
                                    placeholder="Buscar..."
                                    value={participantSearch}
                                    onChange={(e) => setParticipantSearch(e.target.value)}
                                    className="pl-9 pr-3 py-1.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-[#4f46e5] outline-none"
                                />
                             </div>
                        </div>
                        
                        <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto custom-scrollbar">
                            {localConfig.participants && localConfig.participants.length > 0 ? (
                                localConfig.participants
                                .filter(p => p.name.toLowerCase().includes(participantSearch.toLowerCase()))
                                .map((p) => {
                                    const stats = getParticipantContent(p);
                                    // ID display logic for verification
                                    const shortId = p.id.startsWith('device-') 
                                        ? `ID: ..${p.id.slice(-6)}` 
                                        : p.id.startsWith('legacy-') ? 'Legacy' : 'Manual';

                                    return (
                                        <div key={p.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-600 text-xs">
                                                    {p.name.substring(0,2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-800 flex items-center gap-2">
                                                        {p.name}
                                                        <span className="text-[10px] font-normal px-1.5 py-0.5 bg-gray-100 rounded-md text-gray-400 border border-gray-200">
                                                            {shortId}
                                                        </span>
                                                    </p>
                                                    <p className="text-xs text-gray-500">Añadido: {p.addedAt}</p>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <span className="block text-sm font-bold text-gray-800">{stats.total}</span>
                                                    <span className="text-[10px] text-gray-500 uppercase">Fotos</span>
                                                </div>
                                                <button 
                                                    onClick={() => setParticipantToDelete(p)}
                                                    className="p-2 text-gray-400 hover:text-red-500 transition-colors bg-white border border-gray-200 hover:bg-red-50 rounded-lg"
                                                    title="Eliminar Participante"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="p-8 text-center text-gray-400">
                                    No hay participantes registrados.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
          )}

          {/* ... Other Tabs (General, Gallery, Clients) ... */}
          {activeTab === 'general' && (
              /* ... General Tab Content ... */
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* ... Content Hidden for brevity ... */}
                  <div className="lg:col-span-2 space-y-6">
                      {/* ... Main Info, Drive Backup, Config ... */}
                      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                           <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <FileText className="text-[#4f46e5]" />
                                Información Básica
                           </h3>
                           <div className="space-y-4">
                               <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Título del Evento</label>
                                    <input 
                                        type="text" 
                                        value={localConfig.title} 
                                        onChange={(e) => setLocalConfig({...localConfig, title: e.target.value})}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#4f46e5] outline-none"
                                    />
                                </div>
                                {/* ... subtitle, date ... */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Subtítulo / Tipo</label>
                                        <input 
                                            type="text" 
                                            value={localConfig.subtitle} 
                                            onChange={(e) => setLocalConfig({...localConfig, subtitle: e.target.value})}
                                            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#4f46e5] outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                                        <input 
                                            type="text" 
                                            value={localConfig.date} 
                                            onChange={(e) => setLocalConfig({...localConfig, date: e.target.value})}
                                            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#4f46e5] outline-none"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Cliente (Interno)</label>
                                    <input 
                                        type="text" 
                                        value={localConfig.clientName} 
                                        onChange={(e) => setLocalConfig({...localConfig, clientName: e.target.value})}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#4f46e5] outline-none"
                                    />
                                </div>
                           </div>
                      </div>

                      {/* Drive Backup */}
                      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                           {/* ... Drive backup content ... */}
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                    <Cloud className="text-blue-500" />
                                    Copia de Seguridad en Google Drive
                                </h3>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={localConfig.isDriveBackupEnabled || false} 
                                        onChange={(e) => setLocalConfig({...localConfig, isDriveBackupEnabled: e.target.checked})} 
                                        className="sr-only peer" 
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                            </div>
                            
                            <p className="text-sm text-gray-500 mb-6">
                                Sincroniza automáticamente todas las fotos subidas a una carpeta privada en tu Google Drive.
                            </p>

                            {localConfig.isDriveBackupEnabled && (
                                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 animate-fade-in">
                                    <div className="flex flex-col gap-4">
                                        {localConfig.googleDriveUrl ? (
                                            <div className="flex items-center justify-between p-3 bg-white border border-green-200 rounded-lg text-green-700 text-sm">
                                                <span className="flex items-center gap-2 font-bold">
                                                    <CheckCircle size={16} /> Conectado a Google Drive
                                                </span>
                                                <a href={localConfig.googleDriveUrl} target="_blank" rel="noopener noreferrer" className="text-green-600 underline hover:text-green-800 text-xs">
                                                    Abrir Carpeta
                                                </a>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-gray-600">No hay carpeta vinculada.</span>
                                                {/* We use a dedicated component to handle auth and folder creation */}
                                                <GoogleDriveBackup 
                                                    eventName={localConfig.title}
                                                    onFolderCreated={(folderId, folderUrl) => {
                                                        // Atomic update to ensure persistence
                                                        onUpdateField('googleDriveFolderId', folderId);
                                                        onUpdateField('googleDriveUrl', folderUrl);
                                                        setLocalConfig(prev => ({ ...prev, googleDriveUrl: folderUrl }));
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                      </div>

                      {/* Config & Limits */}
                      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                          {/* ... Limits content ... */}
                           <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <Sliders className="text-gray-600" />
                                Configuración y Límites
                           </h3>
                           
                           <div className="space-y-6">
                                <div className="flex items-center justify-between py-3 border-b border-gray-50">
                                    <div>
                                        <span className="block text-sm font-bold text-gray-700">Permitir Subidas</span>
                                        <span className="text-xs text-gray-500">Los invitados pueden añadir contenido</span>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={localConfig.allowUploads} onChange={(e) => setLocalConfig({...localConfig, allowUploads: e.target.checked})} className="sr-only peer" />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4f46e5]"></div>
                                    </label>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Cupo Participantes</label>
                                        <input 
                                            type="number" 
                                            value={localConfig.participantsCount} 
                                            onChange={(e) => setLocalConfig({...localConfig, participantsCount: parseInt(e.target.value)})}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#4f46e5] outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Límite Almacenamiento (MB)</label>
                                        <input 
                                            type="number" 
                                            value={localConfig.storageLimit || 100} 
                                            onChange={(e) => setLocalConfig({...localConfig, storageLimit: parseInt(e.target.value)})}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#4f46e5] outline-none"
                                        />
                                    </div>
                                </div>
                                
                                {/* ... More limits ... */}
                                 <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Máx Fotos / Persona</label>
                                        <input 
                                            type="number" 
                                            value={localConfig.maxPhotosPerPerson} 
                                            onChange={(e) => setLocalConfig({...localConfig, maxPhotosPerPerson: parseInt(e.target.value)})}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#4f46e5] outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Máx Videos / Persona</label>
                                        <input 
                                            type="number" 
                                            value={localConfig.maxVideosPerPerson} 
                                            onChange={(e) => setLocalConfig({...localConfig, maxVideosPerPerson: parseInt(e.target.value)})}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#4f46e5] outline-none"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-3">Tipos de Medios Permitidos</label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={localConfig.allowedMediaTypes.includes('photo')}
                                                onChange={(e) => {
                                                    const types = new Set(localConfig.allowedMediaTypes);
                                                    if (e.target.checked) types.add('photo');
                                                    else types.delete('photo');
                                                    setLocalConfig({...localConfig, allowedMediaTypes: Array.from(types)});
                                                }}
                                                className="rounded text-[#4f46e5] focus:ring-[#4f46e5]"
                                            />
                                            <span className="text-sm text-gray-700">Fotos</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={localConfig.allowedMediaTypes.includes('video')}
                                                onChange={(e) => {
                                                    const types = new Set(localConfig.allowedMediaTypes);
                                                    if (e.target.checked) types.add('video');
                                                    else types.delete('video');
                                                    setLocalConfig({...localConfig, allowedMediaTypes: Array.from(types)});
                                                }}
                                                className="rounded text-[#4f46e5] focus:ring-[#4f46e5]"
                                            />
                                            <span className="text-sm text-gray-700">Videos</span>
                                        </label>
                                    </div>
                                </div>
                           </div>
                      </div>
                  </div>

                  <div className="space-y-6">
                       {/* Right Column Stats */}
                       <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h3 className="text-sm font-bold text-gray-500 uppercase mb-4">Estadísticas Rápidas</h3>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="bg-gray-50 p-4 rounded-lg text-center">
                                    <span className="block text-2xl font-bold text-[#4f46e5]">{currentEventPhotos.filter(p => !p.isDeleted).length}</span>
                                    <span className="text-xs text-gray-500 uppercase font-bold">Archivos</span>
                                </div>
                                <div className="bg-gray-50 p-4 rounded-lg text-center">
                                    <span className="block text-2xl font-bold text-[#4f46e5]">{currentEventPhotos.filter(p => p.isDeleted).length}</span>
                                    <span className="text-xs text-gray-500 uppercase font-bold">Papelera</span>
                                </div>
                            </div>
                       </div>
                  </div>
              </div>
          )}
          
          {activeTab === 'gallery' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[calc(100vh-150px)]">
                {/* Header / Toolbar */}
                <div className="px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 bg-white z-20 sticky top-0">
                    <div className="flex items-center bg-gray-100 p-1 rounded-lg w-full sm:w-auto">
                        <button 
                            onClick={() => setGalleryView('active')} 
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${galleryView === 'active' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <Grid size={16} className="inline mr-2" /> Activa
                        </button>
                        <button 
                            onClick={() => setGalleryView('archived')} 
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${galleryView === 'archived' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <EyeOff size={16} className="inline mr-2" /> Ocultos
                        </button>
                        <button 
                            onClick={() => setGalleryView('trash')} 
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${galleryView === 'trash' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-red-500'}`}
                        >
                            <Trash2 size={16} className="inline mr-2" /> Papelera
                        </button>
                    </div>

                    {/* Bulk Actions - MOVED TO HEADER FOR VISIBILITY */}
                    <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                        
                        <GoogleDriveImporter 
                            onFilesSelected={onDriveImport}
                            isProcessing={isProcessing}
                        />
                        
                        {selectedIds.length > 0 && (
                             <div className="flex items-center gap-2 animate-fade-in">
                                 <span className="text-xs font-bold text-[#4f46e5] mr-2">{selectedIds.length} seleccionados</span>
                                 
                                 {galleryView === 'trash' ? (
                                     <>
                                         <button 
                                            onClick={() => onBulkRestore(selectedIds)}
                                            className="px-3 py-1.5 bg-green-50 text-green-600 rounded-md text-xs font-bold hover:bg-green-100 transition-colors flex items-center gap-1"
                                         >
                                             <RotateCcw size={12} /> Restaurar
                                         </button>
                                         <button 
                                            onClick={executeBulkDelete}
                                            className="px-3 py-1.5 bg-red-50 text-red-600 rounded-md text-xs font-bold hover:bg-red-100 transition-colors flex items-center gap-1"
                                         >
                                             <Trash2 size={12} /> Eliminar
                                         </button>
                                     </>
                                 ) : (
                                     <>
                                         <button 
                                            onClick={() => onBulkArchive(selectedIds, galleryView !== 'archived')}
                                            className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-md text-xs font-bold hover:bg-gray-200 transition-colors"
                                         >
                                             {galleryView === 'active' ? 'Ocultar' : 'Mostrar'}
                                         </button>
                                         <button 
                                            onClick={executeBulkDelete}
                                            className="px-3 py-1.5 bg-red-50 text-red-600 rounded-md text-xs font-bold hover:bg-red-100 transition-colors flex items-center gap-1"
                                         >
                                             <Trash2 size={12} /> Papelera
                                         </button>
                                     </>
                                 )}
                             </div>
                        )}

                        <button 
                            onClick={toggleSelectAll}
                            className="text-gray-500 hover:text-[#4f46e5] flex items-center gap-2 text-sm font-medium px-2"
                        >
                            {displayedPhotos.length > 0 && displayedPhotos.every(p => selectedIds.includes(p.id)) ? (
                                <><CheckSquare size={18} /> Todo</>
                            ) : (
                                <><Square size={18} /> Seleccionar Todo</>
                            )}
                        </button>
                    </div>
                </div>

                {/* Gallery Grid */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50 custom-scrollbar">
                    {displayedPhotos.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                             <Image size={64} className="mb-4" />
                             <p>No hay imágenes en esta sección</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            {displayedPhotos.map(photo => (
                                <div 
                                    key={photo.id} 
                                    className={`relative group aspect-square rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${selectedIds.includes(photo.id) ? 'border-[#4f46e5] ring-2 ring-[#4f46e5]/20' : 'border-gray-200 hover:border-gray-300'}`}
                                    onClick={() => toggleSelection(photo.id)}
                                >
                                    {/* Selection Checkbox */}
                                    <div className={`absolute top-2 left-2 z-10 w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedIds.includes(photo.id) ? 'bg-[#4f46e5] border-[#4f46e5] text-white' : 'bg-white/80 border-gray-300 hover:border-[#4f46e5]'}`}>
                                        {selectedIds.includes(photo.id) && <Check size={12} strokeWidth={4} />}
                                    </div>

                                    {/* Thumbnail */}
                                    {photo.type === 'video' ? (
                                        <video src={photo.thumbnail} className="w-full h-full object-cover" muted />
                                    ) : (
                                        <img src={photo.thumbnail} className="w-full h-full object-cover" loading="lazy" />
                                    )}
                                    
                                    {/* Info Overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                                        <p className="text-white text-xs font-bold truncate">{photo.author.name}</p>
                                        
                                        {galleryView === 'trash' && (
                                             <span className="flex items-center gap-1 text-[10px] text-red-300 mt-1">
                                                 <Trash2 size={10} /> Eliminado
                                             </span>
                                        )}
                                    </div>

                                    {/* Individual Actions */}
                                    <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                        {/* View Details */}
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setPreviewPhoto(photo); }}
                                            className="bg-white/90 hover:bg-white p-2 rounded-md shadow-sm text-gray-600 hover:text-[#4f46e5] transition-colors"
                                            title="Vista Rápida"
                                        >
                                            <Maximize2 size={16} />
                                        </button>

                                        {/* Toggle Visibility (Archive) */}
                                        {!photo.isDeleted && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onArchivePhoto(photo.id); }}
                                                className={`bg-white/90 hover:bg-white p-2 rounded-md shadow-sm transition-colors ${photo.isArchived ? 'text-gray-400 hover:text-green-600' : 'text-gray-600 hover:text-orange-500'}`}
                                                title={photo.isArchived ? "Mostrar en Galería" : "Ocultar Rápido"}
                                            >
                                                {photo.isArchived ? <Eye size={16} /> : <EyeOff size={16} />}
                                            </button>
                                        )}

                                        {/* Quick Delete (Trash) or Restore if already deleted */}
                                        {photo.isDeleted ? (
                                             <button 
                                                onClick={(e) => { e.stopPropagation(); onRestorePhoto(photo.id); }}
                                                className="bg-white/90 hover:bg-white p-2 rounded-md shadow-sm text-green-600 hover:text-green-700 transition-colors"
                                                title="Restaurar"
                                             >
                                                <RotateCcw size={16} />
                                             </button>
                                        ) : (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onDeletePhoto(photo.id); }}
                                                className="bg-white/90 hover:bg-white p-2 rounded-md shadow-sm text-red-500 hover:text-red-600 transition-colors"
                                                title="Eliminado Rápido"
                                            >
                                                <Trash2 size={16} />
                                            </button>
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
              /* ... Clients Content ... */
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
                  <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                      <UserCheck className="text-[#4f46e5]" /> Gestión de Cliente y Accesos
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      <div className="space-y-6">
                          <div>
                              <label className="block text-sm font-bold text-gray-700 mb-2">Nombre del Cliente</label>
                              <input 
                                type="text" 
                                value={localConfig.clientName}
                                onChange={(e) => setLocalConfig({...localConfig, clientName: e.target.value})}
                                className="w-full p-4 bg-gray-800 text-white rounded-xl border border-gray-700 focus:ring-2 focus:ring-[#4f46e5] outline-none font-medium text-lg"
                              />
                          </div>

                          <div>
                              <label className="block text-sm font-bold text-gray-700 mb-2">Contraseña de Descarga</label>
                              <div className="relative">
                                  <input 
                                    type="text" 
                                    value={localConfig.downloadPassword}
                                    onChange={(e) => setLocalConfig({...localConfig, downloadPassword: e.target.value})}
                                    className="w-full p-4 bg-gray-800 text-white rounded-xl border border-gray-700 focus:ring-2 focus:ring-[#4f46e5] outline-none font-mono tracking-wider"
                                  />
                                  <button 
                                    onClick={() => setLocalConfig({...localConfig, downloadPassword: Math.random().toString(36).slice(-8)})}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                                    title="Generar nueva"
                                  >
                                      <RefreshCw size={18} />
                                  </button>
                              </div>
                          </div>
                          
                          <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
                              <h4 className="text-blue-800 font-bold flex items-center gap-2 mb-2">
                                  <ExternalLink size={18} /> Enlace Público
                              </h4>
                              <p className="text-blue-600/80 text-xs mb-3 break-all">
                                  {window.location.origin}?event={activeEvent.publicToken || activeEvent.id}
                              </p>
                              <button 
                                onClick={() => {
                                    navigator.clipboard.writeText(`${window.location.origin}?event=${activeEvent.publicToken || activeEvent.id}`);
                                    setIsLinkCopied(true);
                                    setTimeout(() => setIsLinkCopied(false), 2000);
                                }}
                                className={`bg-white border px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 ${isLinkCopied ? 'text-green-600 border-green-200 bg-green-50' : 'text-blue-600 border-blue-200 hover:bg-blue-50'}`}
                              >
                                  {isLinkCopied ? (
                                      <>
                                          <Check size={18} /> ¡Enlace Copiado!
                                      </>
                                  ) : (
                                      <>
                                         Copiar Enlace
                                      </>
                                  )}
                              </button>
                          </div>
                      </div>
                      
                      {/* QR Code Section */}
                      <div className="bg-gray-50 p-8 rounded-xl border border-gray-200 flex flex-col items-center justify-center text-center">
                           <h4 className="text-gray-800 font-bold mb-6 flex items-center gap-2">
                               <QrCode className="text-[#4f46e5]" /> Código QR de Acceso Rápido
                           </h4>
                           
                           <div className="bg-white p-4 rounded-xl shadow-sm mb-6">
                               <QRCode 
                                    id="qr-code-svg"
                                    value={`${window.location.origin}?event=${activeEvent.publicToken || activeEvent.id}`} 
                                    size={180}
                                    level="H"
                               />
                           </div>
                           
                           <button 
                               onClick={handleDownloadQR}
                               className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-300 rounded-full text-gray-700 font-bold hover:bg-gray-100 hover:text-gray-900 transition-all shadow-sm hover:shadow-md"
                           >
                               <Download size={18} /> Descargar QR (PNG)
                           </button>
                           <p className="text-xs text-gray-400 mt-4 max-w-xs mx-auto">
                               Comparte este código con tus invitados para que accedan directamente a la galería sin escribir la URL.
                           </p>
                      </div>
                  </div>
              </div>
          )}

        </div>
      </main>

      {/* MODALS SECTION */}

      {/* Delete EVENT Confirm */}
      {showDeleteEventConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isProcessing && setShowDeleteEventConfirm(false)} />
              <div className="relative bg-white w-full max-w-md rounded-2xl p-8 shadow-2xl animate-fade-in-up text-center">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <AlertTriangle size={32} className="text-red-600" />
                  </div>
                  
                  <h3 className="text-2xl font-bold text-gray-800 mb-2">¿Eliminar este Álbum?</h3>
                  <p className="text-gray-600 mb-8">
                      Estás a punto de eliminar <strong>{activeEvent.title}</strong>. 
                      Esta acción borrará todas las fotos y datos asociados de forma permanente. No se puede deshacer.
                  </p>

                  <div className="flex gap-3 justify-center">
                      <button 
                          onClick={() => setShowDeleteEventConfirm(false)}
                          disabled={isProcessing}
                          className="px-6 py-3 rounded-lg bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 transition-colors"
                      >
                          Cancelar
                      </button>
                      <button 
                          onClick={async () => {
                              await onDeleteEvent(activeEvent.id);
                              setShowDeleteEventConfirm(false);
                          }}
                          disabled={isProcessing}
                          className="px-6 py-3 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-200 flex items-center gap-2"
                      >
                          {isProcessing ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />}
                          Sí, Eliminar
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Delete PARTICIPANT Confirm */}
      {participantToDelete && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setParticipantToDelete(null)} />
              <div className="relative bg-white w-full max-w-sm rounded-xl p-6 shadow-2xl animate-fade-in-up text-center">
                  <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                      <UserX size={28} />
                  </div>
                  
                  <h3 className="text-lg font-bold text-gray-800 mb-2">¿Eliminar Participante?</h3>
                  <p className="text-sm text-gray-600 mb-6">
                      Se eliminará a <strong>{participantToDelete.name}</strong> de la lista de invitados. Sus fotos no se borrarán, pero perderá su estado de confirmación.
                  </p>

                  <div className="flex gap-3 justify-center">
                      <button 
                          onClick={() => setParticipantToDelete(null)}
                          className="px-4 py-2.5 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors text-sm"
                      >
                          Cancelar
                      </button>
                      <button 
                          onClick={() => {
                              setLocalConfig(prev => ({
                                  ...prev,
                                  participants: prev.participants.filter(part => part.id !== participantToDelete.id)
                              }));
                              setParticipantToDelete(null);
                          }}
                          className="px-4 py-2.5 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-200 flex items-center gap-2 text-sm"
                      >
                          <Trash2 size={16} />
                          Sí, Eliminar
                      </button>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-4">
                      Recuerda pulsar "Guardar Cambios" para hacer efectiva la eliminación.
                  </p>
              </div>
          </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteConfirm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isProcessing && setShowBulkDeleteConfirm(false)} />
              <div className="relative bg-white w-full max-w-sm rounded-xl p-6 shadow-2xl animate-fade-in-up text-center">
                  <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                      <Trash2 size={28} />
                  </div>
                  
                  <h3 className="text-lg font-bold text-gray-800 mb-2">¿Eliminar {selectedIds.length} elementos?</h3>
                  <p className="text-sm text-gray-600 mb-6">
                      Estás a punto de eliminar <strong>{selectedIds.length} fotos</strong> de forma permanente. Esta acción no se puede deshacer.
                  </p>

                  <div className="flex gap-3 justify-center">
                      <button 
                          onClick={() => setShowBulkDeleteConfirm(false)}
                          disabled={isProcessing}
                          className="px-4 py-2.5 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors text-sm"
                      >
                          Cancelar
                      </button>
                      <button 
                          onClick={async () => {
                              try {
                                  await onBulkPermanentDelete(selectedIds);
                                  setSelectedIds([]);
                                  setShowBulkDeleteConfirm(false);
                              } catch (error) {
                                  console.error(error);
                              }
                          }}
                          disabled={isProcessing}
                          className="px-4 py-2.5 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-200 flex items-center gap-2 text-sm"
                      >
                          {isProcessing ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                          {isProcessing ? 'Eliminando...' : 'Sí, Eliminar'}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Photo Details Modal */}
      {previewPhoto && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setPreviewPhoto(null)} />
              <div className="relative bg-white w-full max-w-4xl rounded-xl overflow-hidden shadow-2xl flex flex-col md:flex-row animate-fade-in-up max-h-[90vh]">
                  <div className="flex-1 bg-black flex items-center justify-center relative min-h-[300px]">
                      {previewPhoto.type === 'video' ? (
                          <video src={previewPhoto.url} controls className="max-h-full max-w-full" />
                      ) : (
                          <img src={previewPhoto.url} className="max-h-full max-w-full object-contain" />
                      )}
                  </div>
                  <div className="w-full md:w-80 bg-white p-6 flex flex-col border-l border-gray-100 shrink-0 overflow-y-auto">
                       <div className="flex justify-between items-start mb-6">
                           <h3 className="text-xl font-bold text-gray-800">Detalles de la Foto</h3>
                           <button onClick={() => setPreviewPhoto(null)} className="text-gray-400 hover:text-gray-600"><XIcon size={24} /></button>
                       </div>

                       <div className="space-y-6 flex-1">
                           <div>
                               <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Estado</label>
                               <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${previewPhoto.isDeleted ? 'bg-red-100 text-red-600' : previewPhoto.isArchived ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-600'}`}>
                                   {previewPhoto.isDeleted ? <><Trash2 size={12} /> En Papelera</> : previewPhoto.isArchived ? <><EyeOff size={12} /> Oculto</> : <><Eye size={12} /> Visible</>}
                               </div>
                           </div>

                           <div>
                               <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Autor</label>
                               <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg">
                                   <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white" style={{ backgroundColor: previewPhoto.author.avatarColor }}>
                                       {previewPhoto.author.initials}
                                   </div>
                                   <div>
                                       <p className="font-bold text-gray-800 text-sm">{previewPhoto.author.name}</p>
                                   </div>
                               </div>
                           </div>
                       </div>

                       <div className="mt-8 pt-6 border-t border-gray-100 space-y-3">
                           {previewPhoto.isDeleted ? (
                               <>
                                    <button 
                                        onClick={() => { onRestorePhoto(previewPhoto.id); setPreviewPhoto(null); }}
                                        className="w-full py-3 rounded-lg border border-green-200 text-green-600 hover:bg-green-50 font-bold flex items-center justify-center gap-2 transition-colors"
                                    >
                                        <RotateCcw size={18} /> Restaurar
                                    </button>
                                    <button 
                                        onClick={() => setPhotoToDelete(previewPhoto)}
                                        className="w-full py-3 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-bold flex items-center justify-center gap-2 transition-colors"
                                    >
                                        <Trash2 size={18} />
                                        Eliminar Definitivamente
                                    </button>
                               </>
                           ) : (
                               <>
                                    <button 
                                        onClick={() => { onArchivePhoto(previewPhoto.id); setPreviewPhoto(prev => prev ? ({ ...prev, isArchived: !prev.isArchived }) : null); }}
                                        className="w-full py-3 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 font-bold flex items-center justify-center gap-2 transition-colors"
                                    >
                                        {previewPhoto.isArchived ? <><Eye size={18} /> Mostrar en Galería</> : <><EyeOff size={18} /> Ocultar de Galería</>}
                                    </button>
                                    <button 
                                        onClick={() => { onDeletePhoto(previewPhoto.id); setPreviewPhoto(prev => prev ? ({ ...prev, isDeleted: true }) : null); }}
                                        className="w-full py-3 rounded-lg border border-red-100 text-red-500 hover:bg-red-50 font-bold flex items-center justify-center gap-2 transition-colors"
                                    >
                                        <Trash2 size={18} /> Mover a Papelera
                                    </button>
                               </>
                           )}
                       </div>
                  </div>
              </div>
          </div>
      )}

      {/* Confirmation Modal for Permanent Delete PHOTO */}
      {photoToDelete && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isDeletingPhoto && setPhotoToDelete(null)} />
              <div className="relative bg-white w-full max-w-sm rounded-xl p-6 shadow-2xl animate-fade-in-up text-center">
                  <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                      <Trash2 size={28} />
                  </div>
                  
                  <h3 className="text-lg font-bold text-gray-800 mb-2">¿Eliminar permanentemente?</h3>
                  <p className="text-sm text-gray-600 mb-6">
                      Esta acción no se puede deshacer. La imagen se borrará de los servidores de forma definitiva.
                  </p>

                  <div className="flex gap-3 justify-center">
                      <button 
                          onClick={() => setPhotoToDelete(null)}
                          disabled={isDeletingPhoto}
                          className="px-4 py-2.5 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors text-sm"
                      >
                          Cancelar
                      </button>
                      <button 
                          onClick={async () => {
                              setIsDeletingPhoto(true);
                              try {
                                  await onPermanentDelete(photoToDelete.id);
                                  setPhotoToDelete(null);
                                  setPreviewPhoto(null);
                              } catch (error) {
                                  console.error(error);
                              } finally {
                                  setIsDeletingPhoto(false);
                              }
                          }}
                          disabled={isDeletingPhoto}
                          className="px-4 py-2.5 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-200 flex items-center gap-2 text-sm"
                      >
                          {isDeletingPhoto ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                          {isDeletingPhoto ? 'Eliminando...' : 'Sí, Eliminar'}
                      </button>
                  </div>
              </div>
          </div>
      )}
      
    </div>
  );
};

const GoogleDriveBackup = ({ eventName, onFolderCreated }: { eventName: string, onFolderCreated: (id: string, url: string) => void }) => {
    const [url, setUrl] = useState('');
    const [isEditing, setIsEditing] = useState(false);

    if (!isEditing) {
        return (
            <button 
                className="text-xs text-blue-600 underline hover:text-blue-800 flex items-center gap-1 font-bold" 
                onClick={() => setIsEditing(true)}
            >
                <ExternalLink size={12} /> Vincular Carpeta Manualmente
            </button>
        );
    }

    return (
        <div className="flex flex-col gap-2 w-full max-w-sm animate-fade-in mt-2">
            <input 
                type="text" 
                placeholder="Pega el enlace de la carpeta de Drive..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                autoFocus
            />
            <div className="flex gap-2">
                <button 
                    disabled={!url.trim()}
                    onClick={() => {
                        if(url.trim()) {
                            const folderId = 'manual-folder-' + Date.now();
                            onFolderCreated(folderId, url.trim());
                            setIsEditing(false);
                        }
                    }}
                    className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
                >
                    Guardar
                </button>
                <button 
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-bold rounded-md hover:bg-gray-200 transition-colors"
                >
                    Cancelar
                </button>
            </div>
            <p className="text-[10px] text-gray-400 italic">
                * La sincronización automática requiere configuración de API Cloud.
            </p>
        </div>
    );
};

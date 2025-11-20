
import React, { useState, useEffect, useCallback } from 'react';
import { EventConfig, Category, Photo, Participant } from '../types';
import { Save, Plus, Trash, Settings, Layout, Image, ArrowLeft, Pencil, Check, X as XIcon, LogOut, FolderPlus, Folder, Users, Search, Video, Grid, Eye, EyeOff, Lock, Link as LinkIcon, Copy, RefreshCw, UserCheck, ExternalLink, Menu, Maximize2, Calendar, Clock, CheckSquare, Square, UserPlus, Mail, BadgeCheck, AlertCircle, Palette, Upload, Type, Cloud, FileText, QrCode, Download, Loader2, HelpCircle, PieChart, Camera, PlayCircle, RotateCcw, Trash2, Filter, AlertTriangle, UserX, Heart, ImageIcon, Sliders, Droplet, Zap, User, CheckCircle } from 'lucide-react';
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
  onPermanentDelete: (id: string) => void;
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
      coverImagePositionY: 50
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
  
  // Delete Confirmation Modal State (Participant)
  const [participantToDelete, setParticipantToDelete] = useState<Participant | null>(null);
  // Delete Confirmation Modal State (Photo)
  const [photoToDelete, setPhotoToDelete] = useState<Photo | null>(null);
  
  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Participants State
  const [newParticipantName, setNewParticipantName] = useState('');
  const [participantSearch, setParticipantSearch] = useState('');
  const [participantViewMode, setParticipantViewMode] = useState<'active' | 'trash'>('active');

  // Category State
  const [newCategoryName, setNewCategoryName] = useState('');

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
    if (newParticipantName.trim()) {
        const newParticipant: Participant = {
            id: `p-${Date.now()}`,
            name: newParticipantName.trim(),
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

  // --- BULK SELECTION HELPERS ---
  
  // Filtered photos based on current view (active/trash/archived)
  const displayedPhotos = currentEventPhotos.filter(p => {
      if (galleryView === 'trash') return p.isDeleted;
      if (galleryView === 'archived') return p.isArchived && !p.isDeleted;
      return !p.isDeleted && !p.isArchived;
  }).filter(p => !filterParticipantId || isContentOwnedBy(p, { id: filterParticipantId } as Participant));

  const toggleSelectAll = () => {
      const targetPhotos = displayedPhotos;
      // Verificamos si TODOS los visibles ya están seleccionados
      const allVisibleSelected = targetPhotos.length > 0 && targetPhotos.every(p => selectedIds.includes(p.id));
      
      if (allVisibleSelected) {
          setSelectedIds([]); // Desmarcar todo
      } else {
          setSelectedIds(targetPhotos.map(p => p.id)); // Marcar todo
      }
  };
  
  const toggleSelection = (id: string) => {
      setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };
  
  const executeBulkDelete = async () => {
      if (selectedIds.length === 0) return;
      
      // Si estamos en papelera, es borrado permanente
      if (galleryView === 'trash') {
         if(confirm(`¿Estás seguro de eliminar permanentemente ${selectedIds.length} elementos? Esta acción no se puede deshacer.`)) {
             try {
                 await onBulkPermanentDelete(selectedIds);
                 setSelectedIds([]);
             } catch (e) {
                 // Error already handled in App.tsx alert
                 console.error(e);
             }
         }
      } else {
          // Soft delete
          onBulkDelete(selectedIds);
          setSelectedIds([]);
      }
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-gray-300 flex flex-col shadow-2xl z-20 shrink-0">
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
                            { id: 'appearance', icon: Palette, label: 'Personalización del Tema' },
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
                    {activeTab === 'appearance' && 'Personalización del Tema'}
                    {activeTab === 'categories' && 'Gestión de Categorías'}
                    {activeTab === 'gallery' && 'Gestión de Imágenes'}
                    {activeTab === 'clients' && 'Gestión de Cliente'}
                    {activeTab === 'participants' && 'Lista de Invitados'}
                </h1>
                <p className="text-gray-500 text-sm">Editando álbum: {activeEvent.title}</p>
            </div>
            <div className="flex gap-3">
                {activeTab === 'general' && (
                   <button 
                        onClick={() => onDeleteEvent(activeEvent.id)}
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
                
                {/* Left Column: Editor */}
                <div className="lg:col-span-7 space-y-6">
                    
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-4">
                            <ImageIcon className="text-[#4f46e5]" />
                            Cabecera & Branding
                        </h3>
                        
                        <div className="space-y-6">
                            {/* Cover Image */}
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
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                 <label className="cursor-pointer bg-white text-gray-800 px-4 py-2 rounded-full font-bold text-sm hover:scale-105 transition-transform shadow-lg">
                                                    Cambiar Imagen
                                                    <input type="file" className="hidden" onChange={handleBannerChange} accept="image/*" />
                                                 </label>
                                            </div>
                                            <button 
                                                onClick={() => setLocalConfig(prev => ({ ...prev, coverImage: '' }))}
                                                className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
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

                                {/* Ajustes de Portada (Solo visible si hay imagen) */}
                                {localConfig.coverImage && (
                                    <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4 animate-fade-in">
                                        <h4 className="text-xs font-bold text-gray-600 uppercase mb-2 flex items-center gap-2">
                                            <Sliders size={12} /> Ajustes de Portada
                                        </h4>
                                        
                                        {/* Posición Vertical */}
                                        <div>
                                            <div className="flex justify-between text-xs mb-1">
                                                <span className="text-gray-500">Posición Vertical</span>
                                                <span className="font-bold">{localConfig.theme?.coverImagePositionY || 50}%</span>
                                            </div>
                                            <input 
                                                type="range" 
                                                min="0" 
                                                max="100" 
                                                value={localConfig.theme?.coverImagePositionY || 50}
                                                onChange={(e) => setLocalConfig(prev => ({
                                                    ...prev,
                                                    theme: { ...prev.theme!, coverImagePositionY: parseInt(e.target.value) }
                                                }))}
                                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#4f46e5]"
                                            />
                                        </div>

                                        {/* Opacidad Overlay */}
                                        <div>
                                            <div className="flex justify-between text-xs mb-1">
                                                <span className="text-gray-500">Opacidad de Superposición</span>
                                                <span className="font-bold">{Math.round((localConfig.theme?.coverOverlayOpacity || 0) * 100)}%</span>
                                            </div>
                                            <input 
                                                type="range" 
                                                min="0" 
                                                max="100" 
                                                value={(localConfig.theme?.coverOverlayOpacity || 0) * 100}
                                                onChange={(e) => setLocalConfig(prev => ({
                                                    ...prev,
                                                    theme: { ...prev.theme!, coverOverlayOpacity: parseInt(e.target.value) / 100 }
                                                }))}
                                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#4f46e5]"
                                            />
                                        </div>

                                        {/* Blur */}
                                        <div>
                                            <div className="flex justify-between text-xs mb-1">
                                                <span className="text-gray-500">Desenfoque (Blur)</span>
                                                <span className="font-bold">{localConfig.theme?.coverBlur || 0}px</span>
                                            </div>
                                            <input 
                                                type="range" 
                                                min="0" 
                                                max="20" 
                                                value={localConfig.theme?.coverBlur || 0}
                                                onChange={(e) => setLocalConfig(prev => ({
                                                    ...prev,
                                                    theme: { ...prev.theme!, coverBlur: parseInt(e.target.value) }
                                                }))}
                                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#4f46e5]"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                {/* Avatar Upload */}
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
                                                 <span className="text-2xl font-bold text-gray-400">{localConfig.title.substring(0,2).toUpperCase()}</span>
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

                                {/* Avatar Colors (Fallback) */}
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

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-4">
                            <Palette className="text-pink-500" />
                            Colores & Tema
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                            <ColorPicker 
                                label="Fondo Principal" 
                                value={localConfig.theme?.backgroundColor} 
                                onChange={(c) => setLocalConfig(prev => ({ ...prev, theme: { ...prev.theme!, backgroundColor: c } }))} 
                                fallback="#f5f0e6"
                            />
                            <ColorPicker 
                                label="Texto General" 
                                value={localConfig.theme?.textColor} 
                                onChange={(c) => setLocalConfig(prev => ({ ...prev, theme: { ...prev.theme!, textColor: c } }))} 
                                fallback="#1f2937"
                            />
                            <ColorPicker 
                                label="Botón Principal" 
                                value={localConfig.theme?.primaryColor} 
                                onChange={(c) => setLocalConfig(prev => ({ ...prev, theme: { ...prev.theme!, primaryColor: c } }))} 
                                fallback="#a87b51"
                            />
                            <ColorPicker 
                                label="Botón Secundario" 
                                value={localConfig.theme?.secondaryColor} 
                                onChange={(c) => setLocalConfig(prev => ({ ...prev, theme: { ...prev.theme!, secondaryColor: c } }))} 
                                fallback="#4f46e5"
                            />
                             <ColorPicker 
                                label="Texto Botones" 
                                value={localConfig.theme?.primaryTextColor} 
                                onChange={(c) => setLocalConfig(prev => ({ ...prev, theme: { ...prev.theme!, primaryTextColor: c, secondaryTextColor: c } }))} 
                                fallback="#ffffff"
                            />
                            <ColorPicker 
                                label="Título Cabecera" 
                                value={localConfig.theme?.headerTitleColor} 
                                onChange={(c) => setLocalConfig(prev => ({ ...prev, theme: { ...prev.theme!, headerTitleColor: c } }))} 
                                fallback="#1f2937"
                            />
                        </div>

                        <div className="mt-8 pt-6 border-t border-gray-100">
                             <h4 className="text-xs font-bold text-gray-500 uppercase mb-4">Tipografía</h4>
                             <div className="flex gap-4">
                                 <button 
                                    onClick={() => setLocalConfig(prev => ({ ...prev, theme: { ...prev.theme!, fontFamily: 'sans' } }))}
                                    className={`flex-1 p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${localConfig.theme?.fontFamily === 'sans' ? 'border-[#4f46e5] bg-indigo-50/50 text-[#4f46e5]' : 'border-gray-200 hover:border-gray-300 text-gray-600'}`}
                                 >
                                     <span className="text-2xl font-sans">Aa</span>
                                     <span className="text-xs font-bold uppercase">Moderna (Sans)</span>
                                 </button>
                                 <button 
                                    onClick={() => setLocalConfig(prev => ({ ...prev, theme: { ...prev.theme!, fontFamily: 'serif' } }))}
                                    className={`flex-1 p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${localConfig.theme?.fontFamily === 'serif' ? 'border-[#4f46e5] bg-indigo-50/50 text-[#4f46e5]' : 'border-gray-200 hover:border-gray-300 text-gray-600'}`}
                                 >
                                     <span className="text-2xl font-serif">Aa</span>
                                     <span className="text-xs font-bold uppercase">Elegante (Serif)</span>
                                 </button>
                             </div>
                        </div>
                    </div>

                </div>

                {/* Right Column: Preview */}
                <div className="lg:col-span-5">
                    <div className="sticky top-24">
                        <div className="flex items-center gap-2 mb-4 text-gray-500 text-xs font-bold uppercase tracking-wider">
                            <Eye size={14} /> Vista Previa Rápida
                        </div>
                        
                        {/* Mini Phone Preview */}
                        <div className="bg-white p-2 rounded-[2.5rem] shadow-2xl border-8 border-gray-800 aspect-[9/19] overflow-hidden relative">
                            {/* Notch */}
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-6 bg-gray-800 rounded-b-xl z-20"></div>
                            
                            <div 
                                className="w-full h-full rounded-[1.8rem] overflow-hidden relative flex flex-col"
                                style={{ backgroundColor: localConfig.theme?.backgroundColor, color: localConfig.theme?.textColor }}
                            >
                                {/* Header Preview */}
                                <div className="relative h-40 shrink-0">
                                    {localConfig.coverImage ? (
                                        <img 
                                            src={localConfig.coverImage} 
                                            className="w-full h-full object-cover" 
                                            style={{ 
                                                objectPosition: `50% ${localConfig.theme?.coverImagePositionY || 50}%`,
                                                filter: `blur(${localConfig.theme?.coverBlur || 0}px)` 
                                            }}
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-gray-300 flex items-center justify-center text-gray-400">
                                            <Image size={32} />
                                        </div>
                                    )}
                                    <div 
                                        className="absolute inset-0" 
                                        style={{ backgroundColor: `rgba(0,0,0,${localConfig.theme?.coverOverlayOpacity || 0.4})` }} // Aproximación
                                    />
                                    
                                    {/* Avatar & Title Overlay */}
                                    <div className="absolute -bottom-10 left-4 right-4 flex flex-col items-center text-center z-10">
                                         <div className="w-20 h-20 rounded-full border-4 border-white shadow-md overflow-hidden flex items-center justify-center mb-2" style={{ backgroundColor: localConfig.theme?.avatarBackgroundColor, color: localConfig.theme?.avatarTextColor }}>
                                              {localConfig.theme?.avatarImage ? (
                                                  <img src={localConfig.theme.avatarImage} className="w-full h-full object-cover" />
                                              ) : (
                                                  <span className="text-xl font-bold">{localConfig.title.substring(0,2)}</span>
                                              )}
                                         </div>
                                    </div>
                                </div>

                                <div className="pt-12 px-4 text-center pb-4">
                                    <h3 className="font-bold text-lg leading-tight mb-1" style={{ color: localConfig.theme?.headerTitleColor }}>{localConfig.title}</h3>
                                    <p className="text-[10px] opacity-70 uppercase tracking-wide mb-4">{localConfig.date} • {localConfig.subtitle}</p>
                                    
                                    <div className="flex gap-2 justify-center mb-6">
                                        <div className="h-8 w-24 rounded-full" style={{ backgroundColor: localConfig.theme?.primaryColor }}></div>
                                        <div className="h-8 w-24 rounded-full" style={{ backgroundColor: localConfig.theme?.secondaryColor }}></div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="aspect-square rounded-lg bg-gray-100"></div>
                                        <div className="aspect-square rounded-lg bg-gray-100"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
          )}

          {activeTab === 'general' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                {/* Main Info Card */}
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

                {/* Google Drive Backup Section */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
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

                 {/* Configuration & Limits */}
                 <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
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

              {/* Right Column: Stats & Links */}
              <div className="space-y-6">
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
                                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setPreviewPhoto(photo); }}
                                            className="bg-white/90 hover:bg-white p-1.5 rounded-md shadow-sm text-gray-600 hover:text-[#4f46e5]"
                                            title="Ver Detalles"
                                        >
                                            <Maximize2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                
                {/* Empty Trash Button REMOVED - Replaced by top bar actions */}
            </div>
          )}
          
          {activeTab === 'clients' && (
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
                                onClick={() => navigator.clipboard.writeText(`${window.location.origin}?event=${activeEvent.publicToken || activeEvent.id}`)}
                                className="bg-white text-blue-600 border border-blue-200 px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-50 transition-colors"
                              >
                                  Copiar Enlace
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
                                        onClick={() => {
                                            if (confirm("¿Eliminar permanentemente?")) {
                                                onPermanentDelete(previewPhoto.id);
                                                setPreviewPhoto(null);
                                            }
                                        }}
                                        className="w-full py-3 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-bold flex items-center justify-center gap-2 transition-colors"
                                    >
                                        <Trash2 size={18} /> Eliminar
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

      {/* Google Drive Backup Component (Hidden Logic) */}
      {/* Helper component defined in App.tsx or separate file */}
    </div>
  );
};

// Dummy component for Google Drive Backup (Replace with actual implementation if needed)
const GoogleDriveBackup = ({ eventName, onFolderCreated }: { eventName: string, onFolderCreated: (id: string, url: string) => void }) => (
    <button className="text-xs text-blue-600 underline" onClick={() => alert("Funcionalidad simulada: Conectar Google Drive")}>
        Conectar Cuenta (Simulado)
    </button>
);

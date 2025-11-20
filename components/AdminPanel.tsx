
import React, { useState, useEffect, useCallback } from 'react';
import { EventConfig, Category, Photo, Participant } from '../types';
import { Save, Plus, Trash, Settings, Layout, Image, ArrowLeft, Pencil, Check, X as XIcon, LogOut, FolderPlus, Folder, Users, Search, Video, Grid, Eye, EyeOff, Lock, Link as LinkIcon, Copy, RefreshCw, UserCheck, ExternalLink, Menu, Maximize2, Calendar, Clock, CheckSquare, Square, UserPlus, Mail, BadgeCheck, AlertCircle, Palette, Upload, Type, Cloud, FileText, QrCode, Download, Loader2, HelpCircle, PieChart, Camera, PlayCircle, RotateCcw, Trash2, Filter, AlertTriangle, UserX, Heart, ImageIcon, Sliders, Droplet, Zap } from 'lucide-react';
import { uploadFileToFirebase } from '../services/firebaseService';

interface AdminPanelProps {
  events: EventConfig[];
  currentEventId: string;
  currentEventPhotos?: Photo[];
  isProcessing?: boolean;
  onUpdateEvent: (updatedEvent: EventConfig) => void;
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
  onEmptyTrash: () => void;
  onExit: () => void;
}

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
  onEmptyTrash, 
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
    setLocalConfig({ ...activeEvent });
    setSelectedIds([]); 
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

  const initiateRemoveParticipant = (id: string) => {
      const p = localConfig.participants?.find(p => p.id === id);
      if (p) setParticipantToDelete(p);
  };

  const confirmDeleteParticipant = () => {
      if(!participantToDelete) return;
      const id = participantToDelete.id;
      const currentParticipants = localConfig.participants || [];
      
      const updatedPhotos = (localConfig.photos || []).map(p => {
          if (!p.isDeleted && isContentOwnedBy(p, participantToDelete)) {
              return { ...p, isDeleted: true };
          }
          return p;
      });

      let updatedParticipants: Participant[];
      if (participantViewMode === 'trash') {
          updatedParticipants = currentParticipants.filter(p => p.id !== id);
      } else {
          updatedParticipants = currentParticipants.map(p => 
              p.id === id ? { ...p, status: 'declined' as const } : p
          );
      }
      
      const newConfig = {
          ...localConfig,
          photos: updatedPhotos,
          participants: updatedParticipants
      };
      
      setLocalConfig(newConfig);
      onUpdateEvent(newConfig);
      setParticipantToDelete(null);
  };

  const restoreParticipant = (id: string) => {
      const currentParticipants = localConfig.participants || [];
      const updatedParticipants = currentParticipants.map(p => 
          p.id === id ? { ...p, status: 'confirmed' as const } : p
      );
      const newConfig = { ...localConfig, participants: updatedParticipants };
      setLocalConfig(newConfig);
      onUpdateEvent(newConfig);
  };

  const handleViewParticipantContent = (participant: Participant) => {
      setFilterParticipantId(participant.id);
      setGalleryView(participant.status === 'declined' ? 'trash' : 'active');
      setActiveTab('gallery');
  };

  const addCategory = () => {
      if (newCategoryName.trim()) {
          const newCat: Category = {
              id: `c-${Date.now()}`,
              name: newCategoryName.trim(),
              color: '#3b82f6'
          };
          setLocalConfig(prev => ({
              ...prev,
              categories: [...prev.categories, newCat]
          }));
          setNewCategoryName('');
      }
  };

  const updateCategoryColor = (id: string, color: string) => {
      setLocalConfig(prev => ({
          ...prev,
          categories: prev.categories.map(c => c.id === id ? { ...c, color } : c)
      }));
  };

  const removeCategory = (id: string) => {
      if(localConfig.categories.length <= 1) {
          alert("Debe haber al menos una categoría.");
          return;
      }
      setLocalConfig(prev => ({
          ...prev,
          categories: prev.categories.filter(c => c.id !== id)
      }));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const targetPhotos = displayedPhotos;
    if (selectedIds.length === targetPhotos.length) {
        setSelectedIds([]);
    } else {
        setSelectedIds(targetPhotos.map(p => p.id));
    }
  };
  
  const executeBulkDelete = async () => {
      if(selectedIds.length === 0) return;
      if(galleryView === 'active' || galleryView === 'archived') {
          onBulkDelete(selectedIds);
          setSelectedIds([]);
      } else {
          if(confirm(`¿Eliminar permanentemente ${selectedIds.length} fotos?`)) {
              await onBulkPermanentDelete(selectedIds);
              setSelectedIds([]);
          }
      }
  };

  const executeBulkArchive = (shouldArchive: boolean) => {
      if(selectedIds.length === 0) return;
      onBulkArchive(selectedIds, shouldArchive);
      setSelectedIds([]);
  };

  // UPLOAD HANDLERS
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          try {
              setIsUploadingBanner(true);
              const path = `events/${currentEventId}/banner-${Date.now()}-${file.name}`;
              const downloadUrl = await uploadFileToFirebase(file, path);
              setLocalConfig(prev => ({ ...prev, coverImage: downloadUrl }));
              setIsUploadingBanner(false);
          } catch (error) {
              console.error("Error subiendo banner:", error);
              setIsUploadingBanner(false);
              alert("Error al subir la imagen de portada.");
          }
      }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          try {
              setIsUploadingAvatar(true);
              const path = `events/${currentEventId}/avatar-${Date.now()}-${file.name}`;
              const downloadUrl = await uploadFileToFirebase(file, path);
              updateThemeColor('avatarImage', downloadUrl);
              setIsUploadingAvatar(false);
          } catch (error) {
              console.error("Error subiendo avatar:", error);
              setIsUploadingAvatar(false);
              alert("Error al subir imagen de avatar.");
          }
      }
  };

  const handleRemoveCover = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if(confirm("¿Quitar imagen de portada?")) {
          setLocalConfig(prev => ({ ...prev, coverImage: '' }));
      }
  };
  
  const handleRemoveAvatar = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if(confirm("¿Quitar imagen de avatar?")) {
          updateThemeColor('avatarImage', '');
      }
  };

  const updateThemeColor = (key: string, value: string | number) => {
      setLocalConfig(prev => ({
          ...prev,
          theme: {
              ...(prev.theme || {
                  backgroundColor: '#f5f0e6',
                  textColor: '#1f2937',
                  primaryColor: '#a87b51',
                  secondaryColor: '#4f46e5',
                  primaryTextColor: '#ffffff',
                  secondaryTextColor: '#ffffff',
                  statsTextColor: '#6b7280',
                  headerTitleColor: '#1f2937',
                  headerDateColor: '#4b5563',
                  fontFamily: 'sans',
                  avatarBackgroundColor: '#374151',
                  avatarTextColor: '#ffffff',
                  avatarImage: '',
                  coverOverlayColor: '#000000',
                  coverOverlayOpacity: 0.4,
                  coverBlur: 0
              }),
              [key]: value
          }
      }));
  };

  const filteredEvents = events.filter(e => 
    e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.clientName && e.clientName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const visibleParticipants = (localConfig.participants || []).filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(participantSearch.toLowerCase());
      const isTrash = p.status === 'declined';
      if (participantViewMode === 'trash') return matchesSearch && isTrash;
      return matchesSearch && !isTrash;
  });
  
  const displayedPhotos = currentEventPhotos.filter(p => {
      if (p.isDeleted) {
          if (galleryView !== 'trash') return false;
      } else {
          if (galleryView === 'trash') return false;
          if (galleryView === 'archived' && !p.isArchived) return false;
          if (galleryView === 'active' && p.isArchived) return false;
      }
      if (filterParticipantId) {
          const participant = (localConfig.participants || []).find(part => part.id === filterParticipantId);
          if (participant) {
              if (!isContentOwnedBy(p, participant)) return false;
          }
      }
      return true;
  });
  
  const totalCapacity = localConfig.participantsCount || 0;
  const totalRegistered = (localConfig.participants || []).filter(p => p.status === 'confirmed').length;
  const remainingSpots = Math.max(0, totalCapacity - totalRegistered);
  const inputStyle = "w-full px-4 py-3 rounded-lg bg-[#374151] text-white border-none focus:ring-2 focus:ring-[#4f46e5] outline-none transition-all placeholder-gray-400 shadow-inner";
  const labelStyle = "block text-sm font-bold text-gray-700 mb-2";

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
    <div className="min-h-screen bg-gray-100 font-sans flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-72 bg-[#111827] text-gray-400 flex-shrink-0 flex flex-col h-auto md:h-screen md:sticky md:top-0 z-20 shadow-xl">
        <div className="p-6 border-b border-gray-800 flex items-center justify-between bg-[#1f2937]">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-3"><Settings className="text-white" size={24} />Admin Panel</h1>
            <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest font-bold">Gestor de Eventos</p>
          </div>
        </div>
        <div className="p-4 space-y-3 mt-2">
             <button onClick={onCreateEvent} className="w-full flex items-center justify-center gap-2 bg-[#4f46e5] hover:bg-[#4338ca] text-white px-4 py-3 rounded-lg transition-colors font-bold text-sm shadow-lg"><Plus size={18} strokeWidth={3} />Crear Nuevo Álbum</button>
            <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} /><input type="text" placeholder="Buscar evento o cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-[#1f2937] border border-gray-700 rounded-lg py-2 pl-9 pr-3 text-sm text-white focus:outline-none focus:border-gray-500 placeholder-gray-500"/></div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase mb-3 px-2">Mis Álbumes ({filteredEvents.length})</h3>
            <div className="space-y-2">
                {filteredEvents.map(event => (
                    <div key={event.id} className="flex items-center group relative">
                        <button onClick={() => onSelectEvent(event.id)} className={`flex-1 text-left px-4 py-3 rounded-lg flex items-start gap-3 transition-all text-sm ${event.id === currentEventId ? 'bg-[#1f2937] text-white font-medium shadow-md border-l-4 border-[#4f46e5]' : 'hover:bg-[#1f2937]/50 hover:text-gray-200 text-gray-400'}`}><Folder size={18} className={`mt-0.5 ${event.id === currentEventId ? 'text-[#4f46e5]' : 'text-gray-600'}`} /><div className="overflow-hidden"><span className="block truncate font-bold">{event.title}</span>{event.clientName && (<span className="block text-xs text-gray-500 truncate mt-1 flex items-center gap-1"><UserCheck size={12} />{event.clientName}</span>)}</div></button>
                    </div>
                ))}
            </div>
        </div>
        <div className="p-4 border-t border-gray-800 bg-[#111827]">
            <p className="px-4 text-xs font-bold text-gray-500 uppercase mb-2">Editando: <span className="text-white">{localConfig.title.substring(0, 12)}...</span></p>
            <nav className="space-y-1">
            <button onClick={() => setActiveTab('general')} className={`w-full text-left px-4 py-3 flex items-center gap-3 font-bold rounded-lg transition-colors text-sm ${activeTab === 'general' ? 'bg-[#4f46e5] text-white shadow-lg' : 'hover:bg-gray-800 text-gray-400 hover:text-white'}`}><Layout size={18} />General</button>
            <button onClick={() => setActiveTab('appearance')} className={`w-full text-left px-4 py-3 flex items-center gap-3 font-bold rounded-lg transition-colors text-sm ${activeTab === 'appearance' ? 'bg-[#4f46e5] text-white shadow-lg' : 'hover:bg-gray-800 text-gray-400 hover:text-white'}`}><Palette size={18} />Apariencia</button>
            <button onClick={() => setActiveTab('categories')} className={`w-full text-left px-4 py-3 flex items-center gap-3 font-bold rounded-lg transition-colors text-sm ${activeTab === 'categories' ? 'bg-[#4f46e5] text-white shadow-lg' : 'hover:bg-gray-800 text-gray-400 hover:text-white'}`}><Image size={18} />Categorías</button>
            <button onClick={() => setActiveTab('participants')} className={`w-full text-left px-4 py-3 flex items-center gap-3 font-bold rounded-lg transition-colors text-sm ${activeTab === 'participants' ? 'bg-[#4f46e5] text-white shadow-lg' : 'hover:bg-gray-800 text-gray-400 hover:text-white'}`}><Users size={18} />Participantes</button>
             <button onClick={() => setActiveTab('clients')} className={`w-full text-left px-4 py-3 flex items-center gap-3 font-bold rounded-lg transition-colors text-sm ${activeTab === 'clients' ? 'bg-[#4f46e5] text-white shadow-lg' : 'hover:bg-gray-800 text-gray-400 hover:text-white'}`}><UserCheck size={18} />Clientes</button>
            <button onClick={() => setActiveTab('gallery')} className={`w-full text-left px-4 py-3 flex items-center gap-3 font-bold rounded-lg transition-colors text-sm ${activeTab === 'gallery' ? 'bg-[#4f46e5] text-white shadow-lg' : 'hover:bg-gray-800 text-gray-400 hover:text-white'}`}><Grid size={18} />Galería</button>
            </nav>
        </div>
        <div className="p-4 border-t border-gray-800"><button onClick={onExit} className="w-full flex items-center gap-2 text-sm font-medium px-4 py-2 text-gray-500 hover:text-white transition-colors hover:bg-gray-800 rounded-md"><LogOut size={16} />Ver Frontend Cliente</button></div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto bg-[#f3f4f6] relative">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
           <div><h2 className="text-3xl font-bold text-gray-800 tracking-tight">{activeTab === 'general' ? 'Configuración General' : activeTab === 'appearance' ? 'Personalización del Tema' : activeTab === 'categories' ? 'Categorías de Fotos' : activeTab === 'clients' ? 'Gestión de Cliente' : activeTab === 'participants' ? 'Lista de Participantes' : 'Vista Previa & Gestión'}</h2><p className="text-gray-500 text-sm mt-1">Editando álbum: {localConfig.title}</p></div>
          <button id="save-btn" onClick={handleSave} className="flex items-center gap-2 px-8 py-3 bg-[#4f46e5] text-white rounded-lg hover:bg-[#4338ca] transition-all shadow-lg hover:shadow-xl font-bold"><Save size={18} />Guardar Cambios</button>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-200 min-h-[600px]">
            
            {activeTab === 'general' && (
                <div className="p-8 animate-fade-in">
                    <div className="mb-8"><h3 className="text-xl font-bold text-gray-800">Información del Evento</h3><p className="text-gray-500 text-sm mt-1">Estos datos se mostrarán en el encabezado de la galería del cliente.</p></div>
                    <div className="space-y-8 max-w-5xl">
                        <div><label className={labelStyle}>Título del Álbum / Evento</label><input type="text" value={localConfig.title} onChange={e => setLocalConfig(prev => ({...prev, title: e.target.value}))} className={inputStyle} placeholder="Ej: Boda de Ana y Carlos 2025" /></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div><label className={labelStyle}>Subtítulo / Descripción</label><input type="text" value={localConfig.subtitle} onChange={e => setLocalConfig(prev => ({...prev, subtitle: e.target.value}))} className={inputStyle}/></div><div><label className={labelStyle}>Fecha del Evento</label><input type="text" value={localConfig.date} onChange={e => setLocalConfig(prev => ({...prev, date: e.target.value}))} className={inputStyle}/></div></div>
                        <div><label className={`${labelStyle} flex items-center gap-2`}><Users size={18} className="text-gray-500" />Número de Participantes</label><div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center"><input type="number" value={localConfig.participantsCount} onChange={e => setLocalConfig(prev => ({...prev, participantsCount: parseInt(e.target.value) || 0}))} className={`${inputStyle} md:w-1/2`} /></div></div>
                        
                        <hr className="border-gray-100" />
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className={labelStyle}>Límite Almacenamiento (MB)</label>
                                <div className="relative">
                                    <input type="number" value={localConfig.storageLimit} onChange={e => setLocalConfig(prev => ({...prev, storageLimit: parseInt(e.target.value) || 0}))} className={inputStyle} />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">MB</span>
                                </div>
                            </div>
                            <div>
                                <label className={labelStyle}>Máx Fotos / Persona</label>
                                <input type="number" value={localConfig.maxPhotosPerPerson} onChange={e => setLocalConfig(prev => ({...prev, maxPhotosPerPerson: parseInt(e.target.value) || 0}))} className={inputStyle} />
                            </div>
                             <div>
                                <label className={labelStyle}>Máx Videos / Persona</label>
                                <input type="number" value={localConfig.maxVideosPerPerson} onChange={e => setLocalConfig(prev => ({...prev, maxVideosPerPerson: parseInt(e.target.value) || 0}))} className={inputStyle} />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className={labelStyle}>Tipos de Archivo Permitidos</label>
                            <div className="flex flex-col md:flex-row gap-4">
                                <label className="flex items-center gap-3 bg-gray-100 px-4 py-3 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors border border-gray-200 w-full md:w-auto">
                                    <input 
                                        type="checkbox" 
                                        checked={localConfig.allowedMediaTypes.includes('photo')}
                                        onChange={(e) => {
                                            const isChecked = e.target.checked;
                                            setLocalConfig(prev => ({
                                                ...prev,
                                                allowedMediaTypes: isChecked 
                                                    ? [...prev.allowedMediaTypes, 'photo']
                                                    : prev.allowedMediaTypes.filter(t => t !== 'photo')
                                            }))
                                        }}
                                        className="w-5 h-5 rounded text-[#4f46e5] focus:ring-[#4f46e5]"
                                    />
                                    <div className="flex items-center gap-2">
                                        <ImageIcon size={20} className="text-blue-500"/>
                                        <span className="font-medium text-gray-700">Fotos (JPG, PNG)</span>
                                    </div>
                                </label>
                                <label className="flex items-center gap-3 bg-gray-100 px-4 py-3 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors border border-gray-200 w-full md:w-auto">
                                    <input 
                                        type="checkbox" 
                                        checked={localConfig.allowedMediaTypes.includes('video')}
                                        onChange={(e) => {
                                            const isChecked = e.target.checked;
                                            setLocalConfig(prev => ({
                                                ...prev,
                                                allowedMediaTypes: isChecked 
                                                    ? [...prev.allowedMediaTypes, 'video']
                                                    : prev.allowedMediaTypes.filter(t => t !== 'video')
                                            }))
                                        }}
                                        className="w-5 h-5 rounded text-[#4f46e5] focus:ring-[#4f46e5]"
                                    />
                                     <div className="flex items-center gap-2">
                                        <Video size={20} className="text-purple-500"/>
                                        <span className="font-medium text-gray-700">Videos (MP4)</span>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <hr className="border-gray-100" />

                        <div className="bg-[#f9fafb] p-6 rounded-xl border border-gray-200 flex items-center justify-between"><div><h3 className="font-bold text-gray-900">Permitir subida de fotos</h3></div><button onClick={() => setLocalConfig(prev => ({...prev, allowUploads: !prev.allowUploads}))} className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-300 ${localConfig.allowUploads ? 'bg-[#22c55e]' : 'bg-gray-300'}`}><span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform duration-300 shadow-sm ${localConfig.allowUploads ? 'translate-x-7' : 'translate-x-1'}`} /></button></div>
                    </div>
                </div>
            )}

            {activeTab === 'appearance' && (
                <div className="p-8 animate-fade-in">
                     <div className="mb-8">
                        <h3 className="text-xl font-bold text-gray-800">Apariencia del Álbum</h3>
                        <p className="text-gray-500 text-sm mt-1">Personaliza los colores para que coincidan con la marca o el estilo del evento.</p>
                     </div>

                     <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                         <div className="lg:col-span-7 space-y-6">
                            
                            {/* Header & Branding Section */}
                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                                <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Image size={20} className="text-purple-600"/>Cabecera & Branding</h4>
                                
                                <div className="mb-6">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-3">Imagen de Portada</label>
                                    {localConfig.coverImage ? (
                                        <div className="relative rounded-lg overflow-hidden shadow-md border border-gray-300 group">
                                            <img src={localConfig.coverImage} alt="Cover" className="w-full h-40 object-cover" />
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                <label className="cursor-pointer p-2 bg-white rounded-full text-gray-700 hover:bg-gray-100"><Pencil size={16} /><input type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" /></label>
                                                <button type="button" onClick={handleRemoveCover} className="p-2 bg-white rounded-full text-red-600 hover:bg-red-50 z-20 relative shadow-sm"><Trash size={16} /></button>
                                            </div>
                                        </div>
                                    ) : (
                                        <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors bg-white relative">
                                            {isUploadingBanner ? <Loader2 size={24} className="text-purple-600 animate-spin" /> : <><Upload size={24} className="text-gray-400 mb-2" /><span className="text-sm text-gray-500 font-medium">Subir imagen</span></>}
                                            <input type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" disabled={isUploadingBanner} />
                                        </label>
                                    )}
                                </div>

                                <div className="mb-6">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-3">Avatar / Logo del Evento</label>
                                    <div className="flex items-center gap-6">
                                        {localConfig.theme?.avatarImage ? (
                                            <div className="relative group w-20 h-20 shrink-0">
                                                <img src={localConfig.theme.avatarImage} className="w-20 h-20 rounded-full object-cover border-2 border-gray-200 shadow-sm" alt="Avatar" />
                                                <button onClick={handleRemoveAvatar} className="absolute -top-1 -right-1 bg-red-100 text-red-600 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"><XIcon size={14} /></button>
                                            </div>
                                        ) : (
                                            <div className="w-20 h-20 rounded-full flex items-center justify-center text-xl font-bold shadow-sm shrink-0 border-2 border-gray-200" style={{ backgroundColor: localConfig.theme?.avatarBackgroundColor, color: localConfig.theme?.avatarTextColor }}>
                                                {localConfig.title.substring(0, 2)}
                                            </div>
                                        )}
                                        <div className="flex-1">
                                             <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors border border-gray-200 mb-2">
                                                {isUploadingAvatar ? <Loader2 size={16} className="animate-spin"/> : <Upload size={16} />}
                                                Subir Logo Personalizado
                                                <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" disabled={isUploadingAvatar} />
                                             </label>
                                             <p className="text-xs text-gray-400">O personaliza los colores del avatar por defecto abajo.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Colors Section */}
                             <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                                <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Palette size={20} className="text-pink-600"/>Colores & Tema</h4>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                                    <ColorPicker label="Fondo Principal" value={localConfig.theme?.backgroundColor} onChange={c => updateThemeColor('backgroundColor', c)} fallback="#f5f0e6" />
                                    <ColorPicker label="Texto General" value={localConfig.theme?.textColor} onChange={c => updateThemeColor('textColor', c)} fallback="#1f2937" />
                                    <ColorPicker label="Botón Principal" value={localConfig.theme?.primaryColor} onChange={c => updateThemeColor('primaryColor', c)} fallback="#a87b51" />
                                    <ColorPicker label="Botón Secundario" value={localConfig.theme?.secondaryColor} onChange={c => updateThemeColor('secondaryColor', c)} fallback="#4f46e5" />
                                    <ColorPicker label="Texto Botones" value={localConfig.theme?.primaryTextColor} onChange={c => updateThemeColor('primaryTextColor', c)} fallback="#ffffff" />
                                    <ColorPicker label="Título Cabecera" value={localConfig.theme?.headerTitleColor} onChange={c => updateThemeColor('headerTitleColor', c)} fallback="#1f2937" />
                                    <ColorPicker label="Fondo Avatar" value={localConfig.theme?.avatarBackgroundColor} onChange={c => updateThemeColor('avatarBackgroundColor', c)} fallback="#374151" />
                                    <ColorPicker label="Texto Avatar" value={localConfig.theme?.avatarTextColor} onChange={c => updateThemeColor('avatarTextColor', c)} fallback="#ffffff" />
                                    <ColorPicker label="Overlay Portada" value={localConfig.theme?.coverOverlayColor} onChange={c => updateThemeColor('coverOverlayColor', c)} fallback="#000000" />
                                </div>
                             </div>
                         </div>

                         <div className="lg:col-span-5">
                             <div className="sticky top-8">
                                 <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2"><Eye size={14}/> Vista Previa Rápida</h4>
                                 <div className="rounded-xl overflow-hidden shadow-2xl border border-gray-200" style={{ backgroundColor: localConfig.theme?.backgroundColor || '#f5f0e6' }}>
                                     {/* Mock Header */}
                                     <div className="relative h-32">
                                          <div className="absolute inset-0 bg-gray-300" style={{ backgroundImage: localConfig.coverImage ? `url(${localConfig.coverImage})` : 'none', backgroundSize: 'cover' }} />
                                          <div className="absolute inset-0" style={{ backgroundColor: hexToRgba(localConfig.theme?.coverOverlayColor || '#000000', localConfig.theme?.coverOverlayOpacity ?? 0.4) }} />
                                          <div className="absolute -bottom-8 left-6">
                                              {localConfig.theme?.avatarImage ? (
                                                  <img src={localConfig.theme.avatarImage} className="w-16 h-16 rounded-full border-4 border-white shadow-md object-cover" />
                                              ) : (
                                                <div className="w-16 h-16 rounded-full border-4 border-white shadow-md flex items-center justify-center text-lg font-bold" style={{ backgroundColor: localConfig.theme?.avatarBackgroundColor, color: localConfig.theme?.avatarTextColor }}>
                                                    {localConfig.title.substring(0,2)}
                                                </div>
                                              )}
                                          </div>
                                     </div>
                                     <div className="pt-10 px-6 pb-6">
                                         <h3 className="font-bold text-xl mb-1" style={{ color: localConfig.theme?.headerTitleColor }}>{localConfig.title}</h3>
                                         <p className="text-xs mb-4 opacity-70" style={{ color: localConfig.theme?.headerDateColor }}>{localConfig.date} • {localConfig.subtitle}</p>
                                         <div className="flex gap-2 mb-6">
                                             <div className="flex-1 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-sm" style={{ backgroundColor: localConfig.theme?.primaryColor, color: localConfig.theme?.primaryTextColor }}>Subir</div>
                                             <div className="flex-1 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-sm" style={{ backgroundColor: localConfig.theme?.secondaryColor, color: localConfig.theme?.secondaryTextColor }}>Descargar</div>
                                         </div>
                                         {/* Mock Grid */}
                                         <div className="grid grid-cols-2 gap-2">
                                             <div className="bg-gray-200 aspect-square rounded-lg" />
                                             <div className="bg-gray-200 aspect-square rounded-lg" />
                                         </div>
                                     </div>
                                 </div>
                             </div>
                         </div>
                     </div>
                </div>
            )}

            {activeTab === 'clients' && (
                 <div className="p-8 animate-fade-in">
                     <div className="mb-6 pb-4 border-b border-gray-100">
                        <h3 className="text-lg font-bold text-gray-800">Gestión de Cliente y Accesos</h3>
                     </div>
                     <div className="max-w-2xl space-y-6">
                         <div>
                             <label className={labelStyle}>Nombre del Cliente</label>
                             <input type="text" value={localConfig.clientName} onChange={e => setLocalConfig(prev => ({...prev, clientName: e.target.value}))} className={inputStyle} />
                         </div>
                          <div>
                             <label className={labelStyle}>Contraseña de Descarga</label>
                             <div className="relative">
                                <input type="text" value={localConfig.downloadPassword} onChange={e => setLocalConfig(prev => ({...prev, downloadPassword: e.target.value}))} className={inputStyle} />
                                <button onClick={() => setLocalConfig(prev => ({...prev, downloadPassword: Math.random().toString(36).slice(-8)}))} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-blue-600" title="Generar nueva"><RefreshCw size={16} /></button>
                             </div>
                         </div>
                         <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 flex items-start gap-3">
                             <ExternalLink className="text-blue-600 shrink-0 mt-1" size={20} />
                             <div>
                                 <h4 className="font-bold text-blue-800 mb-1">Enlace Público</h4>
                                 <p className="text-sm text-blue-600 break-all mb-2">{window.location.origin}?event={localConfig.publicToken}</p>
                                 <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}?event=${localConfig.publicToken}`)} className="text-xs font-bold bg-white text-blue-600 px-3 py-1 rounded border border-blue-200 hover:bg-blue-50">Copiar Enlace</button>
                             </div>
                         </div>
                     </div>
                 </div>
            )}

            {activeTab === 'categories' && (
                 <div className="p-8 animate-fade-in">
                     <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
                         <div><h3 className="text-lg font-bold text-gray-800">Gestión de Categorías</h3><p className="text-sm text-gray-500">Define las etiquetas para organizar las fotos.</p></div>
                     </div>
                     
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                         {localConfig.categories.map(cat => (
                             <div key={cat.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between group hover:shadow-md transition-shadow">
                                 <div className="flex items-center gap-3">
                                     <div className="w-8 h-8 rounded-full border border-gray-200 shadow-inner" style={{ backgroundColor: cat.color }} />
                                     <span className="font-bold text-gray-700">{cat.name}</span>
                                 </div>
                                 <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                     <div className="relative w-6 h-6 overflow-hidden rounded-full cursor-pointer border border-gray-300 hover:scale-110 transition-transform">
                                         <input type="color" value={cat.color} onChange={(e) => updateCategoryColor(cat.id, e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                         <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: cat.color }} />
                                     </div>
                                     <button onClick={() => removeCategory(cat.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"><Trash size={16}/></button>
                                 </div>
                             </div>
                         ))}
                     </div>

                     <div className="flex gap-3 max-w-md">
                         <input type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="Nueva Categoría..." className="flex-1 px-4 py-2.5 rounded-lg bg-gray-100 border-transparent focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors" onKeyDown={e => e.key === 'Enter' && addCategory()} />
                         <button onClick={addCategory} className="bg-blue-600 text-white px-4 py-2.5 rounded-lg font-bold hover:bg-blue-700 transition-colors flex items-center gap-2"><Plus size={18}/> Añadir</button>
                     </div>
                 </div>
            )}

            {activeTab === 'participants' && (
                 <div className="p-8 animate-fade-in">
                     <div className="flex flex-col md:flex-row justify-between items-end md:items-center mb-6 pb-4 border-b border-gray-100 gap-4">
                        <div><h3 className="text-lg font-bold text-gray-800">Lista de Participantes</h3><p className="text-sm text-gray-500">Gestiona quién ha subido contenido.</p></div>
                        <div className="flex bg-gray-100 p-1 rounded-lg">
                             <button onClick={() => setParticipantViewMode('active')} className={`px-4 py-1.5 text-sm font-bold rounded-md transition-colors ${participantViewMode === 'active' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>Activos</button>
                             <button onClick={() => setParticipantViewMode('trash')} className={`px-4 py-1.5 text-sm font-bold rounded-md transition-colors ${participantViewMode === 'trash' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'}`}>Eliminados</button>
                        </div>
                     </div>

                     <div className="mb-6 flex gap-4">
                         <div className="relative flex-1 max-w-md">
                             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                             <input type="text" value={participantSearch} onChange={e => setParticipantSearch(e.target.value)} placeholder="Buscar por nombre..." className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none" />
                         </div>
                         {participantViewMode === 'active' && (
                            <div className="flex gap-2">
                                <input type="text" value={newParticipantName} onChange={e => setNewParticipantName(e.target.value)} placeholder="Añadir manualmente..." className="px-4 py-2.5 rounded-lg border border-gray-200 w-48 focus:ring-2 focus:ring-blue-500 outline-none" />
                                <button onClick={addParticipant} className="bg-green-600 text-white p-2.5 rounded-lg hover:bg-green-700 transition-colors"><UserPlus size={20} /></button>
                            </div>
                         )}
                     </div>

                     <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm bg-white">
                         <table className="w-full text-left text-sm">
                             <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-xs">
                                 <tr>
                                     <th className="px-6 py-4">Participante</th>
                                     <th className="px-6 py-4 text-center">Estado</th>
                                     <th className="px-6 py-4 text-center">Fotos</th>
                                     <th className="px-6 py-4 text-center">Videos</th>
                                     <th className="px-6 py-4 text-right">Acciones</th>
                                 </tr>
                             </thead>
                             <tbody className="divide-y divide-gray-100">
                                 {visibleParticipants.length === 0 ? (
                                     <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">No se encontraron participantes.</td></tr>
                                 ) : (
                                     visibleParticipants.map(p => {
                                         const stats = getParticipantContent(p);
                                         return (
                                             <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                                                 <td className="px-6 py-4">
                                                     <div className="flex items-center gap-3">
                                                         <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm border border-blue-100">
                                                             {p.name.substring(0, 2).toUpperCase()}
                                                         </div>
                                                         <div>
                                                             <p className="font-bold text-gray-800">{p.name}</p>
                                                             <p className="text-xs text-gray-400">Añadido: {p.addedAt}</p>
                                                         </div>
                                                     </div>
                                                 </td>
                                                 <td className="px-6 py-4 text-center">
                                                     <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${p.status === 'confirmed' ? 'bg-green-100 text-green-700' : p.status === 'declined' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                         {p.status === 'confirmed' ? 'Confirmado' : p.status === 'declined' ? 'Eliminado' : 'Pendiente'}
                                                     </span>
                                                 </td>
                                                 <td className="px-6 py-4 text-center font-medium text-gray-600">{stats.photosCount}</td>
                                                 <td className="px-6 py-4 text-center font-medium text-gray-600">{stats.videosCount}</td>
                                                 <td className="px-6 py-4 text-right">
                                                     <div className="flex items-center justify-end gap-2">
                                                         <button onClick={() => handleViewParticipantContent(p)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Ver Contenido"><Eye size={18}/></button>
                                                         {participantViewMode === 'trash' ? (
                                                             <button onClick={() => restoreParticipant(p.id)} className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Restaurar"><RotateCcw size={18}/></button>
                                                         ) : null}
                                                         <button onClick={() => initiateRemoveParticipant(p.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title={participantViewMode === 'trash' ? "Eliminar Definitivamente" : "Mover a Papelera"}><Trash size={18}/></button>
                                                     </div>
                                                 </td>
                                             </tr>
                                         );
                                     })
                                 )}
                             </tbody>
                         </table>
                     </div>
                 </div>
            )}

             {activeTab === 'gallery' && (
                 <div className="p-8 animate-fade-in h-full flex flex-col relative">
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-6 pb-4 border-b border-gray-200">
                        <div className="flex-1"><h3 className="text-lg font-bold text-gray-800">Gestión de Imágenes</h3><p className="text-gray-500 text-sm mt-1">Organiza, oculta o elimina el contenido del álbum.</p></div>
                        <div className="flex bg-gray-100 p-1 rounded-lg gap-1">
                             <button onClick={() => { setGalleryView('active'); setSelectedIds([]); }} className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${galleryView === 'active' ? 'bg-white text-[#4f46e5] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Grid size={16} />Activa</button>
                             <button onClick={() => { setGalleryView('archived'); setSelectedIds([]); }} className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${galleryView === 'archived' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><EyeOff size={16} />Ocultos</button>
                             <button onClick={() => { setGalleryView('trash'); setSelectedIds([]); }} className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${galleryView === 'trash' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Trash2 size={16} />Papelera</button>
                        </div>
                    </div>
                    {filterParticipantId && (
                        <div className="mb-4 bg-blue-50 border border-blue-100 rounded-lg p-3 flex items-center justify-between animate-fade-in"><div className="flex items-center gap-2 text-blue-700"><Filter size={18} /><span className="text-sm font-bold">Filtrando por usuario: {(localConfig.participants || []).find(p => p.id === filterParticipantId)?.name || 'Usuario'}</span></div><button onClick={() => setFilterParticipantId(null)} className="text-xs bg-white border border-blue-200 text-blue-600 px-3 py-1.5 rounded hover:bg-blue-100 font-bold">Limpiar Filtro</button></div>
                    )}
                    <div className="flex justify-between items-center mb-4 pb-2 sticky top-0 bg-white z-10 pt-2">
                        <div className="flex items-center gap-4"><span className={`bg-opacity-10 px-3 py-1 rounded-full text-xs font-bold border ${galleryView === 'active' ? 'bg-blue-500 text-blue-700 border-blue-200' : galleryView === 'archived' ? 'bg-orange-500 text-orange-700 border-orange-200' : 'bg-red-500 text-red-700 border-red-200'}`}>{displayedPhotos.length} archivos {galleryView === 'trash' ? 'eliminados' : galleryView === 'archived' ? 'ocultos' : 'activos'}</span></div>
                        <div className="flex items-center gap-3">
                             {galleryView === 'trash' && displayedPhotos.length > 0 && (<button onClick={onEmptyTrash} disabled={isProcessing} className="flex items-center gap-2 text-sm font-bold text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-md transition-colors border border-transparent hover:border-red-100 mr-2 disabled:opacity-50 disabled:cursor-not-allowed" title="Eliminar todos los archivos permanentemente">{isProcessing ? <Loader2 className="animate-spin" size={16}/> : <AlertTriangle size={16} />}{isProcessing ? 'Vaciando...' : 'Vaciar Papelera'}</button>)}
                            <button onClick={toggleSelectAll} className="flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-[#4f46e5] transition-colors">{displayedPhotos.length > 0 && selectedIds.length === displayedPhotos.length ? (<CheckSquare size={20} className="text-[#4f46e5]" />) : (<Square size={20} />)}Seleccionar Todo</button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto pr-2 pb-20">
                         {displayedPhotos.length === 0 ? (
                            <div className="h-64 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                                {galleryView === 'active' ? <><Image size={48} className="mb-4 opacity-30" /><p>No hay fotos activas.</p></> : galleryView === 'archived' ? <><EyeOff size={48} className="mb-4 opacity-30" /><p>No hay fotos ocultas.</p></> : <><Trash2 size={48} className="mb-4 opacity-30" /><p>La papelera está vacía.</p></>}
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {displayedPhotos.map(photo => {
                                    const isSelected = selectedIds.includes(photo.id);
                                    return (
                                    <div key={photo.id} className={`relative group aspect-square rounded-lg overflow-hidden bg-gray-100 border transition-all duration-200 ${isSelected ? 'border-[#4f46e5] ring-2 ring-[#4f46e5] ring-offset-2' : photo.isArchived ? 'border-orange-300 ring-2 ring-orange-100' : 'border-gray-200'}`}>
                                        <div className="absolute top-2 left-2 z-30 cursor-pointer" onClick={(e) => { e.stopPropagation(); toggleSelect(photo.id); }}><div className={`w-6 h-6 rounded border shadow-sm flex items-center justify-center transition-colors ${isSelected ? 'bg-[#4f46e5] border-[#4f46e5]' : 'bg-white border-gray-300 hover:border-[#4f46e5]'}`}>{isSelected && <Check size={14} className="text-white" />}</div></div>
                                        {photo.type === 'video' ? (<video src={photo.thumbnail} className={`w-full h-full object-cover transition-all duration-300 ${photo.isArchived && galleryView === 'active' ? 'grayscale opacity-50 blur-[1px]' : ''} ${isSelected ? 'opacity-90' : ''}`} onLoadedMetadata={(e) => e.currentTarget.currentTime = 0.1}/>) : (<img src={photo.thumbnail} alt={photo.title} className={`w-full h-full object-cover transition-all duration-300 ${photo.isArchived && galleryView === 'active' ? 'grayscale opacity-50 blur-[1px]' : ''} ${isSelected ? 'opacity-90' : ''}`}/>)}
                                        {photo.isArchived && galleryView === 'active' && (<div className="absolute top-2 right-2 bg-orange-500 text-white text-[10px] px-2 py-1 rounded font-bold shadow-sm z-10 flex items-center gap-1"><EyeOff size={10} />OCULTO</div>)}
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 z-20">
                                            <button onClick={(e) => { e.stopPropagation(); setPreviewPhoto(photo); }} className="p-2 rounded-full bg-white hover:bg-blue-50 text-blue-500 hover:text-blue-600 transition-colors shadow-lg transform hover:scale-110" title="Vista rápida"><Maximize2 size={18} /></button>
                                            {galleryView === 'trash' ? (<button onClick={(e) => { e.stopPropagation(); onRestorePhoto(photo.id); }} className="p-2 rounded-full bg-white hover:bg-green-50 text-green-600 transition-colors shadow-lg transform hover:scale-110" title="Restaurar"><RotateCcw size={18} /></button>) : (<button onClick={(e) => { e.stopPropagation(); onArchivePhoto(photo.id); }} className={`p-2 rounded-full bg-white transition-colors shadow-lg transform hover:scale-110 ${photo.isArchived ? 'hover:bg-green-50 text-green-600' : 'hover:bg-orange-50 text-orange-600'}`} title={photo.isArchived ? "Mostrar" : "Ocultar"}>{photo.isArchived ? <Eye size={18} /> : <EyeOff size={18} />}</button>)}
                                            {galleryView === 'trash' ? (<button onClick={(e) => { e.stopPropagation(); setPhotoToDelete(photo); }} className="p-2 rounded-full bg-white hover:bg-red-50 text-red-600 transition-colors shadow-lg transform hover:scale-110" title="Eliminar Permanentemente"><Trash2 size={18} /></button>) : (<button onClick={(e) => { e.stopPropagation(); onDeletePhoto(photo.id); }} className="p-2 rounded-full bg-white hover:bg-red-50 text-red-600 transition-colors shadow-lg transform hover:scale-110" title="Mover a Papelera"><Trash size={18} /></button>)}
                                        </div>
                                        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent pointer-events-none z-10 flex flex-col justify-end h-16"><p className="text-white text-xs truncate font-medium pl-1">{photo.author.name}</p>{galleryView === 'trash' && (<p className="text-[10px] text-red-300 pl-1 flex items-center gap-1"><Trash2 size={10} /> Eliminado</p>)}</div>
                                        <div className="absolute inset-0 z-10" onClick={() => toggleSelect(photo.id)}/>
                                    </div>
                                )})}
                            </div>
                        )}
                    </div>
                    {selectedIds.length > 0 && (
                         <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#1f2937] text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-6 z-40 animate-fade-in-up border border-gray-700">
                            <div className="flex items-center gap-2 border-r border-gray-600 pr-6"><span className="font-bold text-lg">{selectedIds.length}</span><span className="text-sm text-gray-400">seleccionados</span></div>
                            <div className="flex items-center gap-2">
                                {galleryView === 'active' || galleryView === 'archived' ? (
                                    <><button onClick={() => executeBulkArchive(true)} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-700 rounded-md transition-colors text-sm font-medium text-orange-300 hover:text-orange-200" title="Ocultar"><EyeOff size={16} />Ocultar</button><div className="w-px h-6 bg-gray-600 mx-2"></div><button onClick={executeBulkDelete} className="flex items-center gap-2 px-3 py-1.5 hover:bg-red-900/50 rounded-md transition-colors text-sm font-medium text-red-400 hover:text-red-300" title="Mover a papelera"><Trash size={16} />Papelera</button></>
                                ) : (
                                    <><button onClick={() => { onBulkRestore(selectedIds); setSelectedIds([]); }} className="flex items-center gap-2 px-3 py-1.5 hover:bg-green-900/50 rounded-md transition-colors text-sm font-medium text-green-400 hover:text-green-300" title="Restaurar"><RotateCcw size={16} />Restaurar</button><div className="w-px h-6 bg-gray-600 mx-2"></div><button onClick={executeBulkDelete} disabled={isProcessing} className="flex items-center gap-2 px-3 py-1.5 hover:bg-red-900/50 rounded-md transition-colors text-sm font-medium text-red-400 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed" title="Eliminar definitivamente">{isProcessing ? <Loader2 className="animate-spin" size={16}/> : <Trash2 size={16} />}{isProcessing ? 'Procesando...' : 'Eliminar'}</button></>
                                )}
                            </div>
                            <button onClick={() => setSelectedIds([])} className="ml-2 p-1 hover:bg-gray-700 rounded-full text-gray-500 hover:text-white transition-colors"><XIcon size={16} /></button>
                        </div>
                    )}
                </div>
             )}
            </div>
      </main>
      
      {/* CONFIRMATION MODALS AND PREVIEW MODAL */}
      {/* ... (Remaining modals unchanged) */}
      {participantToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-fade-in-up border border-red-100 relative">
                  <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm"><AlertTriangle size={32} /></div>
                  <h3 className="text-xl font-bold text-gray-800 text-center mb-2">{participantViewMode === 'trash' ? '¿Eliminar Definitivamente?' : '¿Mover a Papelera?'}</h3>
                  <div className="text-center mb-6 bg-red-50 p-4 rounded-lg border border-red-100">
                      <p className="font-bold text-gray-800 text-lg mb-1">{participantToDelete.name}</p>
                      <p className="text-sm text-red-600 font-medium">{(() => { const stats = getParticipantContent(participantToDelete); if (participantViewMode === 'trash') { return "Esta acción no se puede deshacer."; } return stats.total > 0 ? `⚠️ Se moverán ${stats.total} fotos/videos a la papelera.` : "Este usuario se moverá a la lista de eliminados."; })()}</p>
                  </div>
                  <p className="text-center text-gray-500 text-sm mb-6 leading-relaxed">{participantViewMode === 'trash' ? "El registro del participante desaparecerá por completo de la base de datos." : "Podrás restaurar al participante y sus fotos desde la pestaña 'Papelera' si cambias de opinión."}</p>
                  <div className="flex gap-3"><button onClick={() => setParticipantToDelete(null)} className="flex-1 py-2.5 rounded-lg bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 transition-colors">Cancelar</button><button onClick={confirmDeleteParticipant} className="flex-1 py-2.5 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 transition-colors shadow-md flex items-center justify-center gap-2"><Trash2 size={18} />{participantViewMode === 'trash' ? 'Borrar Todo' : 'Eliminar'}</button></div>
              </div>
          </div>
      )}

      {photoToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-fade-in-up border border-red-100 relative">
                  <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm"><Trash2 size={32} /></div>
                  <h3 className="text-xl font-bold text-gray-800 text-center mb-2">¿Eliminar foto para siempre?</h3>
                  <div className="text-center mb-4"><div className="w-24 h-24 mx-auto rounded-lg overflow-hidden border border-gray-200 shadow-sm mb-2">{photoToDelete.type === 'video' ? (<video src={photoToDelete.thumbnail} className="w-full h-full object-cover" />) : (<img src={photoToDelete.thumbnail} className="w-full h-full object-cover" />)}</div><p className="text-xs text-gray-500">De: <span className="font-bold">{photoToDelete.author.name}</span></p></div>
                  <p className="text-center text-gray-500 text-sm mb-6 leading-relaxed">Esta acción es irreversible. La foto se borrará de la base de datos y no se podrá recuperar.</p>
                  <div className="flex gap-3"><button onClick={() => setPhotoToDelete(null)} className="flex-1 py-2.5 rounded-lg bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 transition-colors">Cancelar</button><button onClick={() => { onPermanentDelete(photoToDelete.id); setPhotoToDelete(null); }} className="flex-1 py-2.5 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 transition-colors shadow-md flex items-center justify-center gap-2"><Trash2 size={18} />Eliminar</button></div>
              </div>
          </div>
      )}

      {previewPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={() => setPreviewPhoto(null)}>
            <div className="bg-white rounded-xl max-w-4xl w-full max-h-[85vh] overflow-hidden shadow-2xl relative flex flex-col md:flex-row animate-fade-in-up" onClick={e => e.stopPropagation()}>
                <button onClick={() => setPreviewPhoto(null)} className="absolute top-4 right-4 z-10 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"><XIcon size={20}/></button>
                <div className="flex-1 bg-gray-100 flex items-center justify-center p-4 relative overflow-hidden">
                   <div className="absolute inset-0 opacity-10 blur-xl scale-110" style={{ backgroundImage: `url(${previewPhoto.thumbnail})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                   {previewPhoto.type === 'video' ? (<video src={previewPhoto.url} controls autoPlay className="max-w-full max-h-full object-contain shadow-lg relative z-10" />) : (<img src={previewPhoto.url} alt={previewPhoto.title} className="max-w-full max-h-full object-contain shadow-lg relative z-10" />)}
                </div>
                <div className="w-full md:w-80 bg-white p-6 border-l border-gray-100 overflow-y-auto shrink-0 flex flex-col">
                    <h3 className="text-xl font-bold text-gray-800 mb-6">Detalles de la Foto</h3>
                    <div className="space-y-6 flex-1">
                        <div><label className="text-xs font-bold text-gray-400 uppercase block mb-2">Estado</label>{previewPhoto.isDeleted ? (<div className="flex items-center gap-2 p-3 rounded-lg border bg-red-50 border-red-100 text-red-700"><Trash2 size={18}/><span className="text-sm font-bold">En Papelera</span></div>) : (<div className={`flex items-center gap-2 p-3 rounded-lg border ${previewPhoto.isArchived ? 'bg-orange-50 border-orange-100 text-orange-700' : 'bg-green-50 border-green-100 text-green-700'}`}>{previewPhoto.isArchived ? <EyeOff size={18}/> : <Eye size={18}/>}<span className="text-sm font-bold">{previewPhoto.isArchived ? 'Oculto en Galería' : 'Visible al Público'}</span></div>)}</div>
                        <div><label className="text-xs font-bold text-gray-400 uppercase block mb-2">Autor</label><div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100"><div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">{previewPhoto.author.initials}</div><span className="text-sm font-medium text-gray-700">{previewPhoto.author.name}</span></div></div>
                    </div>
                    <div className="pt-6 border-t border-gray-100 mt-4">
                        <div className="grid grid-cols-2 gap-3">
                            {!previewPhoto.isDeleted && (<button onClick={() => { onArchivePhoto(previewPhoto.id); setPreviewPhoto(prev => prev ? ({...prev, isArchived: !prev.isArchived}) : null); }} className={`flex flex-col items-center justify-center gap-1 p-3 rounded-lg border transition-colors text-xs font-bold ${previewPhoto.isArchived ? 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100' : 'bg-orange-50 border-orange-100 text-orange-600 hover:bg-orange-100'}`}>{previewPhoto.isArchived ? <Eye size={20} /> : <EyeOff size={20} />}{previewPhoto.isArchived ? 'Mostrar' : 'Ocultar'}</button>)}
                            {previewPhoto.isDeleted ? (<><button onClick={() => { onRestorePhoto(previewPhoto.id); setPreviewPhoto(null); }} className="flex flex-col items-center justify-center gap-1 p-3 rounded-lg bg-green-50 border border-green-100 text-green-600 hover:bg-green-100 transition-colors text-xs font-bold"><RotateCcw size={20} />Restaurar</button><button onClick={() => { setPhotoToDelete(previewPhoto); setPreviewPhoto(null); }} className="flex flex-col items-center justify-center gap-1 p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 hover:bg-red-100 transition-colors text-xs font-bold"><Trash2 size={20} />Eliminar</button></>) : (<button onClick={() => { onDeletePhoto(previewPhoto.id); setPreviewPhoto(null); }} className="flex flex-col items-center justify-center gap-1 p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 hover:bg-red-100 transition-colors text-xs font-bold"><Trash size={20} />Papelera</button>)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
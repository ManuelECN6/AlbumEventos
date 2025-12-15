
import React, { useState, useMemo, useEffect } from 'react';
import { 
  LayoutDashboard, Image as ImageIcon, Settings, Users, LogOut, Plus, Trash2, Check, X, 
  ChevronDown, Search, Filter, MoreVertical, Download, Upload, Shield, 
  AlertTriangle, Eye, EyeOff, RotateCcw, Maximize2, Flag, CheckCircle,
  Menu, Grid, List
} from 'lucide-react';
import { EventConfig, Photo, Participant } from '../types';
import { GoogleDriveImporter } from './GoogleDriveImporter';

// Helper Icon
const PictureIcon = ({ size = 24, className = "" }: { size?: number | string, className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
  </svg>
);

interface AdminPanelProps {
  events: EventConfig[];
  currentEventId: string;
  currentEventPhotos: Photo[];
  isProcessing: boolean;
  onUpdateEvent: (event: EventConfig) => Promise<void>;
  onUpdateField: (field: string, value: any) => Promise<void>;
  onCreateEvent: (title: string) => Promise<void>;
  onSelectEvent: (id: string) => void;
  onDeleteEvent: (id: string) => Promise<void>;
  onDeletePhoto: (id: string) => Promise<void>;
  onRestorePhoto: (id: string) => void;
  onPermanentDelete: (photo: Photo) => void;
  onArchivePhoto: (id: string) => void;
  onBulkDelete: (ids: string[]) => Promise<void>;
  onBulkArchive: (ids: string[], archive: boolean) => Promise<void>;
  onBulkRestore: (ids: string[]) => Promise<void>;
  onBulkPermanentDelete: (ids: string[]) => void;
  onDriveImport: (files: File[]) => Promise<void>;
  onResolveReport: (photoId: string) => Promise<void>;
  onExit: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  events,
  currentEventId,
  currentEventPhotos,
  isProcessing,
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
  const [activeTab, setActiveTab] = useState<'photos' | 'settings' | 'participants'>('photos');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<'all' | 'reported' | 'deleted' | 'archived'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [newEventTitle, setNewEventTitle] = useState('');
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<Photo | null>(null);

  const currentEvent = events.find(e => e.id === currentEventId) || events[0];

  // Theme helper
  const theme = currentEvent?.theme || {
    primaryColor: '#4f46e5',
    secondaryColor: '#4f46e5',
    cardBackgroundColor: '#ffffff',
    cardTextColor: '#1f2937'
  };

  // Filter photos
  const filteredPhotos = useMemo(() => {
    let result = [...currentEventPhotos];

    // Status Filter
    if (filter === 'deleted') {
      result = result.filter(p => p.isDeleted);
    } else if (filter === 'archived') {
      result = result.filter(p => p.isArchived && !p.isDeleted);
    } else if (filter === 'reported') {
      result = result.filter(p => (p.reports || 0) > 0 && !p.isDeleted);
    } else {
      // Default 'all' - shows active (non-deleted)
      // Usually admin wants to see everything active, maybe excluding deleted?
      // Let's say 'all' shows active (visible + archived).
      result = result.filter(p => !p.isDeleted);
    }

    // Search
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(p => 
        (p.author?.name || '').toLowerCase().includes(lower) ||
        (p.title || '').toLowerCase().includes(lower)
      );
    }

    return result;
  }, [currentEventPhotos, filter, searchTerm]);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredPhotos.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredPhotos.map(p => p.id));
    }
  };

  const executeBulkAction = async (action: 'delete' | 'archive' | 'restore' | 'permanent' | 'unarchive') => {
    if (selectedIds.length === 0) return;
    if (!confirm(`¿Confirmar acción en ${selectedIds.length} elementos?`)) return;

    if (action === 'delete') await onBulkDelete(selectedIds);
    if (action === 'restore') await onBulkRestore(selectedIds);
    if (action === 'archive') await onBulkArchive(selectedIds, true);
    if (action === 'unarchive') await onBulkArchive(selectedIds, false);
    if (action === 'permanent') onBulkPermanentDelete(selectedIds);

    setSelectedIds([]);
  };

  const handleCreateEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim()) return;
    await onCreateEvent(newEventTitle);
    setNewEventTitle('');
    setIsCreatingEvent(false);
  };

  return (
    <div className="flex h-screen bg-gray-50 text-gray-800 font-sans overflow-hidden">
      
      {/* Sidebar */}
      <aside className={`bg-white border-r border-gray-200 flex-shrink-0 transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-20'} flex flex-col z-20`}>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between h-16">
           {sidebarOpen ? <h1 className="font-bold text-xl text-gray-800 tracking-tight">Album<span className="text-indigo-600">Pro</span></h1> : <span className="font-bold text-xl text-indigo-600 mx-auto">AP</span>}
           <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 hover:bg-gray-100 rounded-md text-gray-500">
             {sidebarOpen ? <Menu size={20} /> : <Menu size={20} />}
           </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-6">
           {/* Events List */}
           <div>
              {sidebarOpen && <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-2">Eventos</h3>}
              <div className="space-y-1">
                 {events.map(ev => (
                   <button 
                      key={ev.id}
                      onClick={() => onSelectEvent(ev.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 transition-colors ${currentEventId === ev.id ? 'bg-indigo-50 text-indigo-700 font-medium' : 'hover:bg-gray-100 text-gray-600'}`}
                      title={ev.title}
                   >
                      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${currentEventId === ev.id ? 'bg-indigo-200 text-indigo-800' : 'bg-gray-200 text-gray-500'}`}>
                        {ev.title.substring(0, 2).toUpperCase()}
                      </div>
                      {sidebarOpen && <span className="truncate flex-1">{ev.title}</span>}
                   </button>
                 ))}
                 
                 {isCreatingEvent ? (
                    <form onSubmit={handleCreateEventSubmit} className="p-2 bg-gray-50 rounded-lg border border-gray-200 mt-2">
                       <input 
                         autoFocus
                         type="text" 
                         placeholder="Nombre..." 
                         className="w-full text-sm p-1.5 mb-2 border rounded"
                         value={newEventTitle}
                         onChange={e => setNewEventTitle(e.target.value)}
                       />
                       <div className="flex gap-2">
                         <button type="submit" className="flex-1 bg-indigo-600 text-white text-xs py-1 rounded">Crear</button>
                         <button type="button" onClick={() => setIsCreatingEvent(false)} className="flex-1 bg-gray-200 text-gray-600 text-xs py-1 rounded">Cancel</button>
                       </div>
                    </form>
                 ) : (
                    <button 
                      onClick={() => setIsCreatingEvent(true)}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-500 hover:text-indigo-600 hover:bg-gray-50 rounded-lg transition-colors border-2 border-dashed border-transparent hover:border-indigo-100"
                    >
                       <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><Plus size={16} /></div>
                       {sidebarOpen && <span>Nuevo Evento</span>}
                    </button>
                 )}
              </div>
           </div>
        </div>

        <div className="p-4 border-t border-gray-200">
           <button onClick={onExit} className="w-full flex items-center gap-3 text-gray-600 hover:text-red-600 px-2 py-2 rounded-lg hover:bg-red-50 transition-colors">
              <LogOut size={20} />
              {sidebarOpen && <span className="font-medium">Cerrar Sesión</span>}
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-10 shadow-sm">
           <div>
              <h2 className="text-2xl font-bold text-gray-800">{currentEvent?.title || 'Seleccionar Evento'}</h2>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                 <span className="px-2 py-0.5 bg-gray-100 rounded text-xs border border-gray-200">{currentEvent?.id}</span>
                 <span>•</span>
                 <span>{currentEvent?.date}</span>
                 <span>•</span>
                 <span>{currentEventPhotos.length} fotos</span>
              </div>
           </div>

           <div className="flex items-center gap-3">
              <nav className="flex bg-gray-100 p-1 rounded-lg">
                 <button onClick={() => setActiveTab('photos')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'photos' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Fotos</button>
                 <button onClick={() => setActiveTab('settings')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'settings' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Configuración</button>
                 <button onClick={() => setActiveTab('participants')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'participants' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Participantes</button>
              </nav>
           </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
           
           {/* PHOTOS TAB */}
           {activeTab === 'photos' && (
             <div className="space-y-6">
                {/* Toolbar */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                   <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                      <button onClick={() => setFilter('all')} className={`px-3 py-1.5 text-sm font-medium rounded-md whitespace-nowrap ${filter === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Todos</button>
                      <button onClick={() => setFilter('reported')} className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 whitespace-nowrap ${filter === 'reported' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                         <Flag size={14} /> Reportados
                      </button>
                      <button onClick={() => setFilter('archived')} className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 whitespace-nowrap ${filter === 'archived' ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                         <EyeOff size={14} /> Ocultos
                      </button>
                      <button onClick={() => setFilter('deleted')} className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 whitespace-nowrap ${filter === 'deleted' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                         <Trash2 size={14} /> Papelera
                      </button>
                   </div>

                   <div className="flex items-center gap-3 w-full md:w-auto">
                      <div className="relative flex-1 md:w-64">
                         <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                         <input 
                           type="text" 
                           placeholder="Buscar por autor..." 
                           className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none"
                           value={searchTerm}
                           onChange={e => setSearchTerm(e.target.value)}
                         />
                      </div>
                      <GoogleDriveImporter onFilesSelected={onDriveImport} isProcessing={isProcessing} />
                   </div>
                </div>

                {/* Bulk Actions Bar */}
                {selectedIds.length > 0 && (
                   <div className="bg-indigo-600 text-white p-3 rounded-lg shadow-md flex items-center justify-between animate-fade-in-up">
                      <div className="flex items-center gap-4">
                         <span className="font-bold ml-2">{selectedIds.length} seleccionados</span>
                         <button onClick={() => setSelectedIds([])} className="text-indigo-200 hover:text-white text-sm underline">Cancelar</button>
                      </div>
                      <div className="flex items-center gap-2">
                         {filter === 'deleted' ? (
                            <>
                               <button onClick={() => executeBulkAction('restore')} className="px-4 py-1.5 bg-white/20 hover:bg-white/30 rounded text-sm font-medium">Restaurar</button>
                               <button onClick={() => executeBulkAction('permanent')} className="px-4 py-1.5 bg-red-500 hover:bg-red-600 rounded text-sm font-medium">Eliminar Definitivamente</button>
                            </>
                         ) : (
                            <>
                               <button onClick={() => executeBulkAction(filter === 'archived' ? 'unarchive' : 'archive')} className="px-4 py-1.5 bg-white/20 hover:bg-white/30 rounded text-sm font-medium">{filter === 'archived' ? 'Mostrar' : 'Ocultar'}</button>
                               <button onClick={() => executeBulkAction('delete')} className="px-4 py-1.5 bg-red-500 hover:bg-red-600 rounded text-sm font-medium">Mover a Papelera</button>
                            </>
                         )}
                      </div>
                   </div>
                )}

                {/* Photo Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                   {filteredPhotos.map((photo, idx) => {
                      const author = photo.author || { name: 'Anon', initials: 'AN', avatarColor: '#999' };
                      return (
                         <div 
                            key={photo.id || idx} 
                            className={`rounded-lg shadow-sm border overflow-hidden group relative transition-all duration-200 ${selectedIds.includes(photo.id) ? 'ring-2 ring-indigo-500 ring-offset-2' : 'bg-white border-gray-200 hover:shadow-md'}`}
                            onClick={() => toggleSelection(photo.id)}
                         >
                            {/* Card Header */}
                            <div className="p-2 flex items-center justify-between border-b border-gray-50 bg-white">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: author.avatarColor }}>
                                        {author.initials}
                                    </div>
                                    <div className="truncate">
                                        <h3 className="font-bold text-xs text-gray-700 truncate">{author.name}</h3>
                                    </div>
                                </div>
                                {photo.reports ? (
                                   <div className="text-red-500 bg-red-50 px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                                      <Flag size={10} /> {photo.reports}
                                   </div>
                                ) : null}
                            </div>

                            {/* Image Area */}
                            <div className="aspect-square relative bg-gray-100 overflow-hidden">
                                {/* Checkbox Overlay */}
                                <div className="absolute top-2 left-2 z-10" onClick={e => e.stopPropagation()}>
                                    <button
                                        onClick={() => toggleSelection(photo.id)}
                                        className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${
                                            selectedIds.includes(photo.id)
                                            ? 'bg-indigo-600 border-indigo-600 text-white'
                                            : 'bg-white/80 border-gray-300 text-transparent hover:border-indigo-400'
                                        }`}
                                    >
                                        <Check size={14} strokeWidth={3} />
                                    </button>
                                </div>

                                {photo.type === 'video' ? (
                                   <div className="w-full h-full flex items-center justify-center bg-black">
                                      <video src={photo.thumbnail} className="w-full h-full object-cover opacity-80" />
                                      <div className="absolute inset-0 flex items-center justify-center text-white"><span className="bg-black/50 p-1 rounded-full"><CheckCircle size={16} /></span></div>
                                   </div>
                                ) : (
                                   <img 
                                      src={photo.thumbnail} 
                                      alt="thumbnail" 
                                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                      loading="lazy"
                                   />
                                )}

                                {/* Hover Actions */}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); setPreviewPhoto(photo); }}
                                      className="p-2 bg-white rounded-full text-gray-700 hover:text-indigo-600 hover:scale-110 transition-transform shadow-lg"
                                      title="Ver completa"
                                    >
                                       <Maximize2 size={16} />
                                    </button>

                                    {filter === 'deleted' ? (
                                       <>
                                         <button onClick={(e) => { e.stopPropagation(); onRestorePhoto(photo.id); }} className="p-2 bg-green-500 text-white rounded-full hover:scale-110 transition-transform shadow-lg" title="Restaurar"><RotateCcw size={16} /></button>
                                         <button onClick={(e) => { e.stopPropagation(); if(confirm('¿Eliminar definitivamente?')) onPermanentDelete(photo); }} className="p-2 bg-red-500 text-white rounded-full hover:scale-110 transition-transform shadow-lg" title="Eliminar"><X size={16} /></button>
                                       </>
                                    ) : (
                                       <>
                                         <button 
                                            onClick={(e) => { e.stopPropagation(); onArchivePhoto(photo.id); }} 
                                            className={`p-2 rounded-full text-white hover:scale-110 transition-transform shadow-lg ${photo.isArchived ? 'bg-indigo-500' : 'bg-gray-600 hover:bg-indigo-500'}`} 
                                            title={photo.isArchived ? "Mostrar" : "Ocultar"}
                                         >
                                            {photo.isArchived ? <Eye size={16} /> : <EyeOff size={16} />}
                                         </button>
                                         <button 
                                            onClick={(e) => { e.stopPropagation(); onDeletePhoto(photo.id); }} 
                                            className="p-2 bg-red-500 text-white rounded-full hover:scale-110 transition-transform shadow-lg" 
                                            title="Papelera"
                                         >
                                            <Trash2 size={16} />
                                         </button>
                                       </>
                                    )}
                                </div>
                                
                                {photo.reports && photo.reports > 0 && (
                                   <div className="absolute bottom-0 left-0 right-0 bg-red-500/90 text-white text-[10px] px-2 py-1 text-center font-bold">
                                      CONTENIDO REPORTADO
                                   </div>
                                )}
                            </div>
                         </div>
                      );
                   })}
                </div>
                
                {filteredPhotos.length === 0 && (
                   <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                         <ImageIcon size={32} />
                      </div>
                      <p className="font-medium">No se encontraron fotos</p>
                      <p className="text-sm">Prueba cambiando los filtros</p>
                   </div>
                )}
             </div>
           )}

           {/* SETTINGS TAB */}
           {activeTab === 'settings' && (
             <div className="max-w-3xl mx-auto space-y-8">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                   <h3 className="text-lg font-bold text-gray-800 mb-6 border-b pb-2 flex items-center gap-2">
                      <Settings size={20} className="text-gray-400" />
                      Información General
                   </h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                         <label className="block text-sm font-medium text-gray-700 mb-1">Título del Evento</label>
                         <input 
                           type="text" 
                           value={currentEvent.title} 
                           onChange={(e) => onUpdateField('title', e.target.value)}
                           className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500 outline-none" 
                         />
                      </div>
                      <div>
                         <label className="block text-sm font-medium text-gray-700 mb-1">Subtítulo / Cliente</label>
                         <input 
                           type="text" 
                           value={currentEvent.subtitle} 
                           onChange={(e) => onUpdateField('subtitle', e.target.value)}
                           className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500 outline-none" 
                         />
                      </div>
                      <div>
                         <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                         <input 
                           type="text" 
                           value={currentEvent.date} 
                           onChange={(e) => onUpdateField('date', e.target.value)}
                           className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500 outline-none" 
                         />
                      </div>
                      <div>
                         <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña de Descarga</label>
                         <input 
                           type="text" 
                           value={currentEvent.downloadPassword} 
                           onChange={(e) => onUpdateField('downloadPassword', e.target.value)}
                           className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500 outline-none font-mono bg-gray-50" 
                         />
                      </div>
                   </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                   <h3 className="text-lg font-bold text-gray-800 mb-6 border-b pb-2 flex items-center gap-2">
                      <Shield size={20} className="text-gray-400" />
                      Límites y Restricciones
                   </h3>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                         <label className="block text-sm font-medium text-gray-700 mb-1">Max. Fotos por Persona</label>
                         <input 
                           type="number" 
                           value={currentEvent.maxPhotosPerPerson} 
                           onChange={(e) => onUpdateField('maxPhotosPerPerson', parseInt(e.target.value))}
                           className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500 outline-none" 
                         />
                      </div>
                      <div>
                         <label className="block text-sm font-medium text-gray-700 mb-1">Max. Videos por Persona</label>
                         <input 
                           type="number" 
                           value={currentEvent.maxVideosPerPerson} 
                           onChange={(e) => onUpdateField('maxVideosPerPerson', parseInt(e.target.value))}
                           className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500 outline-none" 
                         />
                      </div>
                      <div>
                         <label className="block text-sm font-medium text-gray-700 mb-1">Límite Total Evento (GB)</label>
                         <input 
                           type="number" 
                           value={currentEvent.totalEventSizeLimitGB || 5} 
                           onChange={(e) => onUpdateField('totalEventSizeLimitGB', parseInt(e.target.value))}
                           className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500 outline-none" 
                         />
                      </div>
                   </div>
                   
                   <div className="mt-4 p-4 bg-gray-50 rounded-lg flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Permitir Subidas</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={currentEvent.allowUploads} onChange={(e) => onUpdateField('allowUploads', e.target.checked)} />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                   </div>
                   
                   <div className="mt-2 p-4 bg-gray-50 rounded-lg flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Permitir Descargas a Invitados</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={currentEvent.allowDownloads} onChange={(e) => onUpdateField('allowDownloads', e.target.checked)} />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                   </div>
                </div>

                <div className="bg-red-50 p-6 rounded-lg border border-red-100">
                   <h3 className="text-lg font-bold text-red-800 mb-4 flex items-center gap-2">
                      <AlertTriangle size={20} />
                      Zona de Peligro
                   </h3>
                   <div className="flex items-center justify-between">
                      <p className="text-sm text-red-600">Eliminar este evento y todos sus archivos permanentemente.</p>
                      <button 
                         onClick={() => { if(confirm('¡ADVERTENCIA! ¿Estás seguro de que quieres eliminar este evento y TODAS sus fotos? Esta acción NO se puede deshacer.')) onDeleteEvent(currentEvent.id); }}
                         className="px-4 py-2 bg-red-600 text-white rounded-md font-bold hover:bg-red-700 transition-colors"
                      >
                         Eliminar Evento
                      </button>
                   </div>
                </div>
             </div>
           )}

           {/* PARTICIPANTS TAB */}
           {activeTab === 'participants' && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                 <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-700">Lista de Invitados</h3>
                    <span className="text-sm text-gray-500">{currentEvent.participants?.length || 0} registrados</span>
                 </div>
                 <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500">
                       <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                          <tr>
                             <th className="px-6 py-3">Nombre</th>
                             <th className="px-6 py-3">ID Dispositivo</th>
                             <th className="px-6 py-3">Estado</th>
                             <th className="px-6 py-3">Fecha Registro</th>
                          </tr>
                       </thead>
                       <tbody>
                          {(currentEvent.participants || []).map((p, i) => (
                             <tr key={i} className="bg-white border-b hover:bg-gray-50">
                                <td className="px-6 py-4 font-medium text-gray-900">{p.name}</td>
                                <td className="px-6 py-4 font-mono text-xs">{p.id}</td>
                                <td className="px-6 py-4">
                                   <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 font-medium capitalize">
                                      {p.status}
                                   </span>
                                </td>
                                <td className="px-6 py-4">{p.addedAt}</td>
                             </tr>
                          ))}
                          {(!currentEvent.participants || currentEvent.participants.length === 0) && (
                             <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-gray-400">
                                   No hay participantes registrados aún.
                                </td>
                             </tr>
                          )}
                       </tbody>
                    </table>
                 </div>
              </div>
           )}

        </div>
      </main>

      {/* Preview Modal */}
      {previewPhoto && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setPreviewPhoto(null)}>
            <div className="relative max-w-5xl w-full max-h-screen flex flex-col items-center">
               <button onClick={() => setPreviewPhoto(null)} className="absolute -top-10 right-0 text-white hover:text-gray-300"><X size={32}/></button>
               {previewPhoto.type === 'video' ? (
                  <video src={previewPhoto.url} controls className="max-h-[85vh] w-auto rounded shadow-lg" />
               ) : (
                  <img src={previewPhoto.url} className="max-h-[85vh] w-auto rounded shadow-lg object-contain" alt="Preview" />
               )}
               <div className="mt-4 text-white text-center">
                  <p className="font-bold text-lg">{previewPhoto.author?.name}</p>
                  <p className="text-sm opacity-70">Subido el {new Date(previewPhoto.createdAt).toLocaleString()}</p>
                  {previewPhoto.reports ? <p className="text-red-400 font-bold mt-1 flex items-center justify-center gap-2"><Flag size={16}/> {previewPhoto.reports} Reportes</p> : null}
                  
                  {previewPhoto.reports ? (
                     <button onClick={(e) => { e.stopPropagation(); onResolveReport(previewPhoto.id); setPreviewPhoto(prev => prev ? {...prev, reports: 0} : null); }} className="mt-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-bold">
                        Marcar como seguro (Resolver Reporte)
                     </button>
                  ) : null}
               </div>
            </div>
         </div>
      )}

    </div>
  );
};

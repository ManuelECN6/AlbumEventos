import React, { useState, useEffect } from 'react';
import {
    Save, Plus, Settings, Layout, ArrowLeft, Check, X as XIcon, Folder, Users, Search, Grid,
    Eye, EyeOff, Lock, Unlock, ExternalLink, Palette, Upload, Type as TypeIcon, FileText,
    Loader2, UserPlus, Trash2, CheckSquare, Square, UserCheck, HardDrive, Maximize2,
    RotateCcw, Flag, Calendar, User, Download, Camera, Smartphone, Monitor, CloudLightning,
    Ticket, Video, RefreshCw, AlertTriangle, Menu, ShieldAlert, CheckCircle, LogOut, Copy,
    Loader, Wrench
} from 'lucide-react';
import {
    EventConfig, Category, Photo, Participant,
    uploadFileToFirebase, recalculateEventStorageUsage, reprocessEventPhotos,
    scanEventOrphanFiles, deleteStorageFilesBatch, repairNegativeLikes
} from '../services/firebaseService';
import { GoogleDriveImporter } from './GoogleDriveImporter';

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
    currentEventPhotos?: Photo[];
    isProcessing?: boolean;
    onUpdateEvent: (updatedEvent: EventConfig) => void;
    onUpdateField: (fieldPath: string, value: any) => void;
    onCreateEvent: (title: string) => Promise<void>;
    onSelectEvent: (id: string) => void;
    onDeleteEvent: (id: string) => void;
    onDeletePhoto: (id: string) => void;
    onRestorePhoto: (id: string) => void;
    onPermanentDelete: (photo: Photo) => Promise<void>;
    onArchivePhoto: (id: string) => void;
    onBulkDelete: (ids: string[]) => void;
    onBulkArchive: (ids: string[], shouldArchive: boolean) => void;
    onBulkRestore: (ids: string[]) => void;
    onBulkPermanentDelete: (ids: string[]) => Promise<void>;
    onDriveImport: (files: File[]) => Promise<void>;
    onResolveReport: (id: string) => Promise<void>;
    onExit: () => void;
    onViewSite?: () => void; // New prop for preview mode
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

const MobilePreview = ({ config, activePhotos }: { config: EventConfig, activePhotos: Photo[] }) => {
    const defaultTheme = DEFAULT_EVENT_TEMPLATE.theme!;
    const theme = { ...defaultTheme, ...(config.theme || {}) };
    const fontClass = theme.fontFamily === 'serif' ? 'font-serif' : 'font-sans';

    const previewPhotos = activePhotos && activePhotos.length > 0 ? activePhotos.slice(0, 4) : [
        { id: '1', thumbnail: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=400', author: { name: 'Ana', initials: 'AN', avatarColor: '#3b82f6' }, likes: 12, category: 'General', createdAt: new Date().toISOString(), title: 'Ejemplo', width: 400, height: 400 },
        { id: '2', thumbnail: 'https://images.unsplash.com/photo-1511285560982-1351cdeb9821?w=400', author: { name: 'Luis', initials: 'LU', avatarColor: '#ef4444' }, likes: 8, category: 'General', createdAt: new Date().toISOString(), title: 'Ejemplo', width: 400, height: 400 }
    ] as Photo[];

    const statsColor = theme.statsTextColor || theme.textColor;
    const participants = config.participants || [];
    const confirmedCount = (participants && Array.isArray(participants)) ? participants.filter(p => p.status === 'confirmed').length : 0;
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
                                            <div className="w-full h-full flex items-center justify-center bg-gray-200"><PictureIcon size={20} className="text-gray-400" /></div>
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
    onExit,
    onViewSite // Destructure new prop
}) => {
    const activeEvent = events?.find(e => e.id === currentEventId) || events?.[0] || DEFAULT_EVENT_TEMPLATE;

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

    const [showReprocessModal, setShowReprocessModal] = useState(false);
    const [showCreateEventModal, setShowCreateEventModal] = useState(false);
    const [newEventTitle, setNewEventTitle] = useState('');
    const [isCreatingEvent, setIsCreatingEvent] = useState(false);

    const [isScanningStorage, setIsScanningStorage] = useState(false);
    const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);
    const [repairStatus, setRepairStatus] = useState<{ type: 'success' | 'error' | 'loading' | null, message: string }>({ type: null, message: '' });
    const [orphanFiles, setOrphanFiles] = useState<string[]>([]);
    const [isCleaningStorage, setIsCleaningStorage] = useState(false);
    const [cleanupProgress, setCleanupProgress] = useState({ deleted: 0, total: 0 });
    const [cleanupResult, setCleanupResult] = useState<{ deleted: number; total: number } | null>(null);

    const [isReprocessing, setIsReprocessing] = useState(false);
    const [reprocessProgress, setReprocessProgress] = useState({ current: 0, total: 0 });
    const [reprocessResult, setReprocessResult] = useState<{ total: number; processed: number } | null>(null);

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
            photos: currentEventPhotos || activeEvent?.photos || [], // PRIORITY TO PROP
            allowedMediaTypes: activeEvent?.allowedMediaTypes || ['photo']
        });
    }, [activeEvent, currentEventPhotos]); // ADD currentEventPhotos dependency

    // ... (REST OF METHODS, NO CHANGES UNTIL RENDER) ...
    const handleCreateEventClick = () => {
        setNewEventTitle('');
        setShowCreateEventModal(true);
        setIsMobileSidebarOpen(false);
    };

    const handleCreateEventSubmit = async () => {
        if (!newEventTitle.trim()) return;
        setIsCreatingEvent(true);
        try {
            await onCreateEvent(newEventTitle);
            setShowCreateEventModal(false);
            setNewEventTitle('');
        } catch (e) {
            console.error("Error creating event", e);
        } finally {
            setIsCreatingEvent(false);
        }
    };

    const handleSave = () => {
        onUpdateEvent(localConfig);
        const btn = document.getElementById('save-btn');
        if (btn) {
            const originalText = btn.innerText;
            btn.innerText = '¡Guardado!';
            setTimeout(() => btn.innerText = originalText, 2000);
        }
    };

    const handleExitToSite = () => {
        // FIX: Support Preview Mode if available
        if (onViewSite) {
            onViewSite();
            return;
        }

        // FIX: Use ID directly to ensure reliable routing, preventing fallback to 'latest'
        const token = activeEvent.id; // activeEvent.publicToken || activeEvent.id;
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

    const handleDownloadQR = async () => {
        try {
            const data = encodeURIComponent(finalLink);

            // MISMO QR, pero en alta resolución para impresión
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&qzone=1&data=${data}`;

            const response = await fetch(qrUrl);
            const blob = await response.blob();

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');

            a.href = url;
            a.download = `QR_${(localConfig.title || 'Evento').replace(/\s+/g, '_')}_1000x1000.png`;

            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error descargando QR:', error);
            alert('No se pudo descargar el QR en alta resolución.');
        }
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

    const handleReprocessPhotos = async () => {
        if (!activeEvent?.id) return;
        const ok = confirm("⚠️ Reprocesar fotos antiguas\n\n• Convierte imágenes a WebP\n• Genera thumbnails\n• Reorganiza rutas\n• Elimina archivos legacy\n\n¿Deseas continuar?");
        if (!ok) return;
        setIsReprocessing(true);
        setReprocessResult(null);
        setReprocessProgress({ current: 0, total: 0 });
        try {
            const result = await reprocessEventPhotos(activeEvent.id, (current, total) => { setReprocessProgress({ current, total }); });
            setReprocessResult(result);
        } catch (err) {
            console.error("Error reprocesando fotos:", err);
            alert("❌ Error reprocesando fotos. Revisa la consola.");
        } finally {
            setIsReprocessing(false);
        }
    };

    const handleScanStorage = async () => {
        if (!activeEvent?.id) return;
        setIsScanningStorage(true);
        try {
            const files = await scanEventOrphanFiles(activeEvent.id);
            setOrphanFiles(files);
            if (files.length === 0) {
                alert("✅ ¡Todo limpio! No se encontraron archivos basura.");
            } else {
                setShowCleanupConfirm(true);
            }
        } catch (err) {
            console.error("Error escaneando:", err);
            alert("Error al escanear almacenamiento.");
        } finally {
            setIsScanningStorage(false);
        }
    };

    const handleConfirmCleanup = async () => {
        if (!activeEvent?.id || orphanFiles.length === 0) return;
        setIsCleaningStorage(true);
        setCleanupResult(null);
        setCleanupProgress({ deleted: 0, total: orphanFiles.length });
        try {
            const result = await deleteStorageFilesBatch(orphanFiles, (deleted, total) => { setCleanupProgress({ deleted, total }); });
            setCleanupResult(result);
            setOrphanFiles([]);
        } catch (err) {
            console.error("Error borrando:", err);
            alert("Error al borrar archivos.");
        } finally {
            setIsCleaningStorage(false);
        }
    };

    const displayedPhotos = (currentEventPhotos && Array.isArray(currentEventPhotos) ? currentEventPhotos : []).filter(p => {
        if (!p) return false;
        if (galleryView === 'trash') return p.isDeleted;
        if (galleryView === 'archived') return p.isArchived && !p.isDeleted;
        return !p.isDeleted && !p.isArchived;
    });

    const reportedPhotos = (currentEventPhotos && Array.isArray(currentEventPhotos) ? currentEventPhotos : []).filter(p => (p.reports || 0) > 0 && !p.isDeleted);

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

    // ... (REST OF UTILS) ...
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

            {/* ... (SIDEBAR) ... */}
            {isMobileSidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
                    onClick={() => setIsMobileSidebarOpen(false)}
                />
            )}

            <aside
                className={`fixed inset-y-0 left-0 z-50 w-72 bg-gray-900 text-gray-300 flex flex-col shadow-2xl transition-transform duration-300 lg:static lg:translate-x-0 shrink-0 ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                {/* ... (SIDEBAR CONTENT) ... */}
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
                        onClick={handleCreateEventClick}
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
                            {(events && Array.isArray(events) ? events : []).filter(e => (e.title || '').toLowerCase().includes(searchTerm.toLowerCase())).map(event => (
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
                                    { id: 'gallery', icon: PictureIcon, label: 'Galería' },
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

                <div className="p-4 border-t border-gray-800 space-y-2">
                    <button onClick={handleExitToSite} className="w-full flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-xs px-2 py-2">
                        <ArrowLeft size={14} /> Volver al Sitio
                    </button>
                    <button onClick={onExit} className="w-full flex items-center gap-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors text-xs px-2 py-2 font-bold">
                        <LogOut size={14} /> Cerrar Sesión
                    </button>
                </div>
            </aside>

            <main className="flex-1 overflow-y-auto relative bg-gray-50 flex flex-col">
                {/* ... (HEADER) ... */}
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

                    {/* ... (GENERAL TAB) ... */}
                    {activeTab === 'general' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* ... Same content ... */}
                            <div className="space-y-6">
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><FileText className="text-[#4f46e5]" /> Información</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">Título</label>
                                            <input type="text" value={localConfig.title} onChange={(e) => setLocalConfig({ ...localConfig, title: e.target.value })} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#4f46e5] outline-none" style={{ colorScheme: 'light' }} />
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-1">Fecha</label>
                                                <input type="text" value={localConfig.date} onChange={(e) => setLocalConfig({ ...localConfig, date: e.target.value })} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#4f46e5] outline-none" style={{ colorScheme: 'light' }} />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-1">Token URL</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={localConfig.publicToken}
                                                        onChange={(e) => setLocalConfig({ ...localConfig, publicToken: e.target.value })}
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
                                            <label className="block text-sm font-bold text-gray-700 mb-1">ID Interno (Carpeta Storage)</label>
                                            <div className="flex items-center gap-2">
                                                <code className="flex-1 bg-gray-100 p-2 rounded text-xs text-gray-600 font-mono break-all border border-gray-200 select-all">
                                                    eventos/{localConfig.id}
                                                </code>
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(`eventos/${localConfig.id}`);
                                                        alert("Ruta copiada al portapapeles");
                                                    }}
                                                    className="p-2 text-gray-500 hover:text-blue-600 bg-gray-100 hover:bg-blue-50 rounded-lg transition-colors border border-gray-200"
                                                    title="Copiar ruta"
                                                >
                                                    <Copy size={16} />
                                                </button>
                                            </div>
                                            <p className="text-[10px] text-gray-400 mt-1">
                                                Usa esta ruta para encontrar los archivos en Firebase Storage si el evento es antiguo.
                                            </p>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">Subtítulo</label>
                                            <input type="text" value={localConfig.subtitle} onChange={(e) => setLocalConfig({ ...localConfig, subtitle: e.target.value })} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#4f46e5] outline-none" style={{ colorScheme: 'light' }} />
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><Wrench className="text-[#4f46e5]" /> Mantenimiento</h3>
                                    <div className="space-y-4">


                                        <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
                                            <p className="text-xs text-indigo-800 mb-2 font-medium">Optimizar imágenes y archivos</p>
                                            <button
                                                onClick={handleReprocessPhotos}
                                                disabled={isReprocessing}
                                                className="w-full py-2 bg-white text-indigo-600 hover:bg-indigo-50 rounded border border-indigo-200 font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-sm"
                                            >
                                                {isReprocessing ? <Loader size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                                {isReprocessing ? 'Procesando...' : 'Reprocesar todo'}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><Lock className="text-[#4f46e5]" /> Accesos</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">Contraseña Descarga</label>
                                            <div className="relative">
                                                <input type="text" value={localConfig.downloadPassword} onChange={(e) => setLocalConfig({ ...localConfig, downloadPassword: e.target.value })} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#4f46e5] outline-none" style={{ colorScheme: 'light' }} />
                                                <button onClick={() => setLocalConfig({ ...localConfig, downloadPassword: Math.random().toString(36).slice(-6) })} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs bg-gray-100 px-2 py-1 rounded font-bold">Generar</button>
                                            </div>
                                        </div>
                                        <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-full ${localConfig.allowUploads ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{localConfig.allowUploads ? <Upload size={18} /> : <XIcon size={18} />}</div>
                                                <div><span className="block font-bold text-sm">Permitir Subidas</span><span className="text-xs text-gray-500">Invitados pueden aportar</span></div>
                                            </div>
                                            <input type="checkbox" checked={localConfig.allowUploads} onChange={(e) => setLocalConfig({ ...localConfig, allowUploads: e.target.checked })} className="w-5 h-5 accent-[#4f46e5]" style={{ colorScheme: 'light' }} />
                                        </label>
                                        <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-full ${localConfig.allowDownloads ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{localConfig.allowDownloads ? <Download size={18} /> : <XIcon size={18} />}</div>
                                                <div><span className="block font-bold text-sm">Permitir Descargas</span><span className="text-xs text-gray-500">Invitados pueden bajar fotos</span></div>
                                            </div>
                                            <input type="checkbox" checked={localConfig.allowDownloads} onChange={(e) => setLocalConfig({ ...localConfig, allowDownloads: e.target.checked })} className="w-5 h-5 accent-[#4f46e5]" style={{ colorScheme: 'light' }} />
                                        </label>
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-gray-100">
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-3">Formatos Permitidos</label>
                                        <div className="flex gap-4">
                                            <label className={`flex-1 flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${localConfig.allowedMediaTypes?.includes('photo') ? 'bg-indigo-50 border-indigo-200' : 'hover:bg-gray-50'}`}>
                                                <div className="flex items-center gap-2">
                                                    <PictureIcon size={18} className={localConfig.allowedMediaTypes?.includes('photo') ? 'text-indigo-600' : 'text-gray-400'} />
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
                                            onChange={(e) => setLocalConfig({ ...localConfig, totalEventSizeLimitGB: Number(e.target.value) })}
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
                                            <input type="number" value={localConfig.storageLimit} onChange={(e) => setLocalConfig({ ...localConfig, storageLimit: Number(e.target.value) })} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#4f46e5] outline-none" style={{ colorScheme: 'light' }} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Max MB Video</label>
                                            <input type="number" value={localConfig.maxVideoSizeMB || 50} onChange={(e) => setLocalConfig({ ...localConfig, maxVideoSizeMB: Number(e.target.value) })} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#4f46e5] outline-none" style={{ colorScheme: 'light' }} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Max Fotos/Pers</label>
                                            <input type="number" value={localConfig.maxPhotosPerPerson} onChange={(e) => setLocalConfig({ ...localConfig, maxPhotosPerPerson: Number(e.target.value) })} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#4f46e5] outline-none" style={{ colorScheme: 'light' }} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Max Videos/Pers</label>
                                            <input type="number" value={localConfig.maxVideosPerPerson} onChange={(e) => setLocalConfig({ ...localConfig, maxVideosPerPerson: Number(e.target.value) })} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#4f46e5] outline-none" style={{ colorScheme: 'light' }} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'general' && (
                        /* REINSERTION AT END OF GENERAL TAB */
                        <div className="bg-red-50 p-6 rounded-xl border border-red-100 mt-6">
                            <h3 className="text-lg font-bold text-red-800 mb-4 flex items-center gap-2 border-b border-red-200 pb-2">
                                <Wrench className="text-red-500" /> Mantenimiento & Reparación
                            </h3>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-bold text-red-900 text-sm">Reparar contadores de Likes negativos</p>
                                        <p className="text-xs text-red-700 mt-1">
                                            Si ves likes en "0" que bajan a negativo, usa esta herramienta. Convierte todos los negativos a 0 en la base de datos.
                                        </p>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            if (!activeEvent?.id) return;

                                            setRepairStatus({ type: 'loading', message: '⏳ Reparando likes...' });
                                            try {
                                                const count = await repairNegativeLikes(activeEvent.id);
                                                if (count > 0) {
                                                    setRepairStatus({ type: 'success', message: `✅ ¡Listo! Se arreglaron ${count} fotos.` });
                                                } else {
                                                    setRepairStatus({ type: 'success', message: '✅ Todo en orden. No había errores.' });
                                                }
                                            } catch (e) {
                                                setRepairStatus({ type: 'error', message: '❌ Error al intentar reparar.' });
                                                console.error(e);
                                            }
                                        }}
                                        className="px-4 py-2 bg-white border border-red-200 text-red-700 font-bold rounded-lg text-xs hover:bg-red-50 shadow-sm transition-all"
                                        disabled={repairStatus.type === 'loading'}
                                    >
                                        {repairStatus.type === 'loading' ? 'Reparando...' : 'Reparar Likes'}
                                    </button>
                                </div>
                                {repairStatus.message && (
                                    <div className={`mt-3 p-3 rounded-lg text-xs font-bold ${repairStatus.type === 'success' ? 'bg-green-100 text-green-700 border border-green-200' : repairStatus.type === 'error' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-gray-100 text-gray-600'}`}>
                                        {repairStatus.message}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'appearance' && (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-140px)]">
                            <div className="lg:col-span-8 overflow-y-auto pr-2 custom-scrollbar space-y-6 pb-20">

                                {/* 1. Cabecera & Portada */}
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                    <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-4"><Layout className="text-[#4f46e5]" /> Cabecera & Portada</h3>

                                    <div className="mb-6">
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="block text-xs font-bold text-gray-500 uppercase">Imagen de Portada</label>
                                            {isUploadingBanner && <span className="text-[#4f46e5] text-xs flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Subiendo...</span>}
                                        </div>

                                        <div className="relative w-full aspect-video bg-gray-100 rounded-lg overflow-hidden border border-gray-200 group shadow-sm mb-2">
                                            {localConfig.coverImage ? (
                                                <img
                                                    src={localConfig.coverImage}
                                                    className="w-full h-full object-cover transition-all duration-200"
                                                    style={{
                                                        objectPosition: `50% ${localConfig.theme?.coverImagePositionDesktopY ?? 50}%`,
                                                        filter: `blur(${localConfig.theme?.coverBlur || 0}px)`
                                                    }}
                                                />
                                            ) : (
                                                <div className="flex items-center justify-center w-full h-full text-gray-400">
                                                    <PictureIcon size={48} />
                                                </div>
                                            )}

                                            <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white cursor-pointer transition-opacity duration-200">
                                                <Upload size={32} className="mb-2" />
                                                <span className="text-sm font-bold">Cambiar Imagen</span>
                                                <span className="text-xs opacity-80 mt-1">Recomendado: 1920x1080</span>
                                                <input type="file" className="hidden" accept="image/*" onChange={handleBannerChange} disabled={isUploadingBanner} />
                                            </label>

                                            <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded pointer-events-none">
                                                Vista Escritorio ({localConfig.theme?.coverImagePositionDesktopY ?? 50}%)
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                                        <ColorPicker label="Color Superposición (Overlay)" value={localConfig.theme?.coverOverlayColor} onChange={(v) => updateLocalTheme('coverOverlayColor', v)} fallback="#000000" />

                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2 flex justify-between"><span>Opacidad Overlay</span><span>{Math.round((localConfig.theme?.coverOverlayOpacity ?? 0.4) * 100)}%</span></label>
                                            <input type="range" min="0" max="1" step="0.1" value={localConfig.theme?.coverOverlayOpacity ?? 0.4} onChange={(e) => updateLocalTheme('coverOverlayOpacity', parseFloat(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#4f46e5]" />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2 flex justify-between"><span>Desenfoque (Blur)</span><span>{localConfig.theme?.coverBlur ?? 0}px</span></label>
                                            <input type="range" min="0" max="20" step="1" value={localConfig.theme?.coverBlur ?? 0} onChange={(e) => updateLocalTheme('coverBlur', parseInt(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#4f46e5]" />
                                        </div>

                                        {/* Mobile Position Slider */}
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2 flex justify-between">
                                                <span className="flex items-center gap-1"><Smartphone size={12} /> Posición Vertical (Móvil)</span>
                                                <span>{localConfig.theme?.coverImagePositionY ?? 50}%</span>
                                            </label>
                                            <input
                                                type="range"
                                                min="0"
                                                max="100"
                                                step="1"
                                                value={localConfig.theme?.coverImagePositionY ?? 50}
                                                onChange={(e) => updateLocalTheme('coverImagePositionY', parseInt(e.target.value))}
                                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#4f46e5]"
                                            />
                                        </div>

                                        {/* Desktop Position Slider */}
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2 flex justify-between">
                                                <span className="flex items-center gap-1"><Monitor size={12} /> Posición Vertical (Escritorio)</span>
                                                <span>{localConfig.theme?.coverImagePositionDesktopY ?? (localConfig.theme?.coverImagePositionY ?? 50)}%</span>
                                            </label>
                                            <input
                                                type="range"
                                                min="0"
                                                max="100"
                                                step="1"
                                                value={localConfig.theme?.coverImagePositionDesktopY ?? (localConfig.theme?.coverImagePositionY ?? 50)}
                                                onChange={(e) => updateLocalTheme('coverImagePositionDesktopY', parseInt(e.target.value))}
                                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#4f46e5]"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-gray-100">
                                        <ColorPicker label="Color Título" value={localConfig.theme?.headerTitleColor} onChange={(v) => updateLocalTheme('headerTitleColor', v)} fallback="#1f2937" />
                                        <ColorPicker label="Color Subtítulos/Fecha" value={localConfig.theme?.headerDateColor} onChange={(v) => updateLocalTheme('headerDateColor', v)} fallback="#6b7280" />
                                    </div>
                                </div>

                                {/* 2. Avatar / Logo */}
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                    <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-4"><User size={20} className="text-[#4f46e5]" /> Avatar / Logo</h3>
                                    <div className="flex flex-col sm:flex-row gap-8">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-gray-100 shadow-sm relative group bg-gray-100">
                                                {localConfig.theme?.avatarImage ? (<img src={localConfig.theme.avatarImage} className="w-full h-full object-cover" />) : (<div className="w-full h-full flex items-center justify-center text-2xl font-bold uppercase" style={{ backgroundColor: localConfig.theme?.avatarBackgroundColor || '#374151', color: localConfig.theme?.avatarTextColor || '#ffffff' }}>{(localConfig.title || 'EV').substring(0, 2)}</div>)}
                                                <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white cursor-pointer transition-opacity"><Camera size={24} /><input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} disabled={isUploadingAvatar} /></label>
                                            </div>
                                            {isUploadingAvatar && <span className="text-xs text-[#4f46e5] font-bold">Subiendo...</span>}
                                            <button onClick={() => updateLocalTheme('avatarImage', '')} className="text-xs text-red-500 hover:text-red-700 underline" disabled={!localConfig.theme?.avatarImage}>Eliminar Imagen</button>
                                        </div>
                                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-6">
                                            <ColorPicker label="Fondo Avatar (Si no hay imagen)" value={localConfig.theme?.avatarBackgroundColor} onChange={(v) => updateLocalTheme('avatarBackgroundColor', v)} fallback="#374151" />
                                            <ColorPicker label="Texto Avatar" value={localConfig.theme?.avatarTextColor} onChange={(v) => updateLocalTheme('avatarTextColor', v)} fallback="#ffffff" />
                                        </div>
                                    </div>
                                </div>

                                {/* 3. Identidad & Colores */}
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                    <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-4">
                                        <Palette className="text-[#4f46e5]" /> Identidad & Colores
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                                        <ColorPicker label="Color Principal (Botones)" value={localConfig.theme?.primaryColor} onChange={(v) => updateLocalTheme('primaryColor', v)} fallback="#a87b51" />
                                        <ColorPicker label="Texto en Principal" value={localConfig.theme?.primaryTextColor} onChange={(v) => updateLocalTheme('primaryTextColor', v)} fallback="#ffffff" />
                                        <ColorPicker label="Color Secundario" value={localConfig.theme?.secondaryColor} onChange={(v) => updateLocalTheme('secondaryColor', v)} fallback="#4f46e5" />
                                        <ColorPicker label="Fondo Página" value={localConfig.theme?.backgroundColor} onChange={(v) => updateLocalTheme('backgroundColor', v)} fallback="#f5f0e6" />
                                        <ColorPicker label="Texto General" value={localConfig.theme?.textColor} onChange={(v) => updateLocalTheme('textColor', v)} fallback="#1f2937" />
                                    </div>
                                    <div className="mt-6 pt-6 border-t border-gray-100">
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-3">Tipografía</label>
                                        <div className="flex gap-4">
                                            <button onClick={() => updateLocalTheme('fontFamily', 'sans')} className={`flex-1 p-3 border rounded-lg text-sm font-sans flex items-center justify-center gap-2 transition-colors ${localConfig.theme?.fontFamily !== 'serif' ? 'border-[#4f46e5] bg-indigo-50 text-[#4f46e5] font-bold' : 'hover:bg-gray-50'}`}><TypeIcon size={16} /> Sans Serif (Moderno)</button>
                                            <button onClick={() => updateLocalTheme('fontFamily', 'serif')} className={`flex-1 p-3 border rounded-lg text-sm font-serif flex items-center justify-center gap-2 transition-colors ${localConfig.theme?.fontFamily === 'serif' ? 'border-[#4f46e5] bg-indigo-50 text-[#4f46e5] font-bold' : 'hover:bg-gray-50'}`}><TypeIcon size={16} /> Serif (Elegante)</button>
                                        </div>
                                    </div>
                                </div>

                                {/* 4. Galería & Tarjetas */}
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                    <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-4"><Grid size={20} className="text-[#4f46e5]" /> Galería & Tarjetas</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                                        <ColorPicker label="Fondo Tarjeta" value={localConfig.theme?.cardBackgroundColor} onChange={(v) => updateLocalTheme('cardBackgroundColor', v)} fallback="#ffffff" />
                                        <ColorPicker label="Texto Tarjeta" value={localConfig.theme?.cardTextColor} onChange={(v) => updateLocalTheme('cardTextColor', v)} fallback="#1f2937" />
                                        <ColorPicker label="Texto Estadísticas" value={localConfig.theme?.statsTextColor} onChange={(v) => updateLocalTheme('statsTextColor', v)} fallback="#6b7280" />
                                    </div>
                                </div>
                            </div>
                            <div className="hidden lg:block lg:col-span-4 pl-4 border-l border-gray-200">
                                <div className="sticky top-6">
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center mb-6">Vista Previa Móvil</h4>
                                    <MobilePreview config={localConfig} activePhotos={currentEventPhotos || []} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ... (REST OF TABS) ... */}
                    {/* ... keeping the rest of the file exactly as it was ... */}
                    {activeTab === 'categories' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* ... Content ... */}
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
                                        <ColorPicker label="Etiqueta" value={newCategoryColor} onChange={setNewCategoryColor} fallback="#3b82f6" />
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

                    {activeTab === 'clients' && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8">
                            <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                                <UserCheck className="text-[#4f46e5]" /> Gestión de Cliente & Distribución
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Nombre Cliente</label>
                                        <input type="text" value={localConfig.clientName} onChange={(e) => setLocalConfig({ ...localConfig, clientName: e.target.value })} className="w-full p-4 bg-gray-800 text-white rounded-xl border border-gray-700 focus:ring-2 focus:ring-[#4f46e5] outline-none font-medium text-lg" />
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
                                        <button onClick={() => { navigator.clipboard.writeText(finalLink); setIsLinkCopied(true); setTimeout(() => setIsLinkCopied(false), 2000); }} className={`bg-white border px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 ${isLinkCopied ? 'text-green-600 border-green-200 bg-green-50' : 'text-blue-600 border-blue-200 hover:bg-blue-50'}`}>{isLinkCopied ? <><Check size={18} /> ¡Copiado!</> : 'Copiar Enlace'}</button>
                                    </div>

                                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mt-6">
                                        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-4">
                                            <HardDrive className="text-[#4f46e5]" /> Respaldo Google Drive
                                        </h3>
                                        <div className="space-y-4">
                                            <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50 bg-gray-50">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-full ${localConfig.isDriveBackupEnabled ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'}`}>
                                                        <CloudLightning size={18} />
                                                    </div>
                                                    <div>
                                                        <span className="block font-bold text-sm">Habilitar Respaldo Automático</span>
                                                        <span className="text-xs text-gray-500">Copia fotos nuevas a Drive</span>
                                                    </div>
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    checked={localConfig.isDriveBackupEnabled || false}
                                                    onChange={(e) => setLocalConfig({ ...localConfig, isDriveBackupEnabled: e.target.checked })}
                                                    className="w-5 h-5 accent-[#4f46e5]"
                                                    style={{ colorScheme: 'light' }}
                                                />
                                            </label>

                                            {localConfig.isDriveBackupEnabled && (
                                                <div className="animate-fade-in space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-100">
                                                    <label className="block text-xs font-bold text-blue-800 uppercase">ID de Carpeta Drive</label>
                                                    <input
                                                        type="text"
                                                        value={localConfig.googleDriveFolderId || ''}
                                                        onChange={(e) => setLocalConfig({ ...localConfig, googleDriveFolderId: e.target.value })}
                                                        className="w-full px-3 py-2 rounded border border-blue-200 focus:ring-2 focus:ring-blue-400 outline-none text-sm bg-white"
                                                        placeholder="Ej: 1A2b3C..."
                                                    />
                                                    <p className="text-[10px] text-blue-600">
                                                        Copia el ID de la URL de tu carpeta de Google Drive. Requiere configurar permisos de API.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* MANTENIMIENTO */}


                                </div>
                                <div className="bg-gray-50 p-8 rounded-xl border border-gray-200 flex flex-col items-center justify-center text-center">
                                    <div className="bg-white p-4 rounded-xl shadow-sm mb-6">
                                        <img
                                            id="qr-code-img"
                                            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(finalLink)}`}
                                            alt="QR Code"
                                            className="w-[180px] h-[180px]"
                                            crossOrigin="anonymous"
                                        />
                                    </div>
                                    <button onClick={handleDownloadQR} className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-300 rounded-full text-gray-700 font-bold hover:bg-gray-100 transition-all shadow-sm">Descargar QR PNG</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'participants' && (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                            {/* ... Content ... */}
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
                                                onChange={(e) => setLocalConfig({ ...localConfig, participantsCount: Number(e.target.value) })}
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
                                                                    {p.name.substring(0, 2).toUpperCase()}
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

                    {/* ... (GALLERY, REPORTS, MODALS - No changes needed) ... */}
                    {/* ... keeping the rest of the file exactly as it was ... */}
                    {activeTab === 'gallery' && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[calc(100vh-150px)]">
                            {/* ... Gallery header and body ... */}
                            <div className="px-4 md:px-6 py-4 border-b border-gray-200 flex flex-col xl:flex-row items-center justify-between gap-4 shrink-0 bg-white z-20 sticky top-0">
                                {/* Tabs */}
                                <div className="flex items-center bg-gray-100 p-1 rounded-lg w-full xl:w-auto overflow-x-auto">
                                    <button onClick={() => setGalleryView('active')} className={`flex-1 xl:flex-none px-3 py-2 rounded-md text-xs font-medium ${galleryView === 'active' ? 'bg-white shadow-sm' : 'text-gray-500'}`}>Activa</button>
                                    <button onClick={() => setGalleryView('archived')} className={`flex-1 xl:flex-none px-3 py-2 rounded-md text-xs font-medium ${galleryView === 'archived' ? 'bg-white shadow-sm' : 'text-gray-500'}`}>Ocultos</button>
                                    <button onClick={() => setGalleryView('trash')} className={`flex-1 xl:flex-none px-3 py-2 rounded-md text-xs font-medium ${galleryView === 'trash' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'}`}>Papelera</button>
                                </div>

                                {/* Acciones */}
                                <div className="flex flex-wrap items-center gap-3 justify-end">
                                    {displayedPhotos.length > 0 && (
                                        <button
                                            onClick={toggleSelectAll}
                                            className="text-gray-500 hover:text-[#4f46e5] flex items-center gap-2 text-xs md:text-sm font-medium px-2"
                                        >
                                            {displayedPhotos.every(p => selectedIds.includes(p.id)) ? (
                                                <><CheckSquare size={16} /><span className="hidden md:inline">Todo</span></>
                                            ) : (
                                                <><Square size={16} /><span className="hidden md:inline">Seleccionar Todo</span></>
                                            )}
                                        </button>
                                    )}
                                    <GoogleDriveImporter onFilesSelected={onDriveImport} isProcessing={isProcessing} />
                                    <div className="flex flex-col items-end gap-1">
                                        <button
                                            onClick={handleScanStorage}
                                            disabled={isScanningStorage || isCleaningStorage}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-700 rounded-md text-xs font-bold disabled:opacity-50"
                                        >
                                            {isScanningStorage ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                            {isScanningStorage ? 'Escaneando...' : 'Limpiar basura'}
                                        </button>
                                    </div>
                                    {selectedIds.length > 0 && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-indigo-600">{selectedIds.length} selec.</span>
                                            {galleryView === 'trash' ? (
                                                <>
                                                    <button onClick={() => onBulkRestore(selectedIds)} className="px-3 py-1.5 bg-green-50 text-green-600 rounded-md text-xs font-bold">Restaurar</button>
                                                    <button onClick={executeBulkDelete} className="px-3 py-1.5 bg-red-50 text-red-600 rounded-md text-xs font-bold">Eliminar</button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => onBulkArchive(selectedIds, galleryView !== 'archived')} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-md text-xs font-bold">
                                                        {galleryView === 'active' ? 'Ocultar' : 'Mostrar'}
                                                    </button>
                                                    <button onClick={executeBulkDelete} className="px-3 py-1.5 bg-red-50 text-red-600 rounded-md text-xs font-bold">Papelera</button>
                                                    <button onClick={() => setShowReprocessModal(true)} className="px-3 py-1.5 bg-orange-100 text-orange-700 rounded-md text-xs font-bold">Reprocesar</button>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* BODY */}
                            <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50 custom-scrollbar">
                                {displayedPhotos.length === 0 ? (
                                    <div className="h-full flex items-center justify-center text-gray-400">No hay imágenes</div>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3 md:gap-4">
                                        {displayedPhotos.map((photo, idx) => {
                                            const author = photo?.author || { name: 'Anónimo', initials: 'AN', avatarColor: '#999' };
                                            return (
                                                <div
                                                    key={photo.id || idx}
                                                    className="rounded-lg shadow-sm border overflow-hidden group relative"
                                                    style={{
                                                        backgroundColor: theme.cardBackgroundColor || '#ffffff',
                                                        borderColor: 'rgba(0,0,0,0.05)'
                                                    }}
                                                >
                                                    {/* BOTÓN SELECCIÓN */}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleSelection(photo.id);
                                                        }}
                                                        className="absolute top-2 left-2 z-30 bg-white/90 backdrop-blur rounded-md p-1 shadow hover:scale-105 transition"
                                                    >
                                                        {selectedIds.includes(photo.id) ? (
                                                            <CheckSquare size={16} className="text-indigo-600" />
                                                        ) : (
                                                            <Square size={16} className="text-gray-400" />
                                                        )}
                                                    </button>

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
                                                            <img src={photo.thumbnail} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center bg-gray-200"><PictureIcon size={24} className="text-gray-400" /></div>
                                                        )}
                                                        <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm text-white text-[8px] px-1.5 py-0.5 rounded uppercase font-bold z-10">
                                                            {photo.category || 'General'}
                                                        </div>
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center gap-2 z-20">
                                                            <button onClick={(e) => { e.stopPropagation(); setPreviewPhoto(photo); }} className="p-2 bg-white rounded-full text-gray-700 hover:text-blue-600 shadow-lg hover:scale-110 transition-transform" title="Ver"><Maximize2 size={16} /></button>
                                                            {photo.isDeleted ? (
                                                                <button onClick={(e) => { e.stopPropagation(); onRestorePhoto(photo.id); }} className="p-2 bg-white rounded-full text-green-600 hover:text-green-700 shadow-lg hover:scale-110 transition-transform" title="Restaurar"><RotateCcw size={16} /></button>
                                                            ) : (
                                                                <>
                                                                    <button onClick={(e) => { e.stopPropagation(); onArchivePhoto(photo.id); }} className={`p-2 bg-white rounded-full shadow-lg hover:scale-110 transition-transform ${photo.isArchived ? 'text-indigo-600' : 'text-gray-600 hover:text-indigo-600'}`} title={photo.isArchived ? "Mostrar" : "Ocultar"}>{photo.isArchived ? <Eye size={16} /> : <EyeOff size={16} />}</button>
                                                                    <button onClick={(e) => { e.stopPropagation(); onDeletePhoto(photo.id); }} className="p-2 bg-white rounded-full text-red-500 hover:text-red-600 shadow-lg hover:scale-110 transition-transform" title="Papelera"><Trash2 size={16} /></button>
                                                                </>
                                                            )}
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
                                            {/* ... Report card content ... */}
                                            <div className="relative aspect-video bg-gray-100">
                                                {photo.type === 'video' ? <video src={photo.thumbnail} className="w-full h-full object-cover" muted /> : <img src={photo.thumbnail} className="w-full h-full object-cover" />}
                                                <div className="absolute top-2 right-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md flex items-center gap-1"><Flag size={10} /> {photo.reports}</div>
                                            </div>
                                            <div className="p-4 flex-1 flex flex-col">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold">{photo.author.initials}</div>
                                                    <div><p className="text-xs font-bold text-gray-800">{photo.author.name}</p><p className="text-[10px] text-gray-500">{new Date(photo.createdAt).toLocaleDateString()}</p></div>
                                                </div>
                                                <div className="mt-auto grid grid-cols-2 gap-2">
                                                    <button onClick={() => onResolveReport(photo.id)} className="py-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors"><Check size={14} /> Aprobar</button>
                                                    <button onClick={() => { if (confirm("¿Estás seguro de enviar esta foto a la papelera?")) onDeletePhoto(photo.id); }} className="py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors"><Trash2 size={14} /> Eliminar</button>
                                                    <button onClick={() => { onArchivePhoto(photo.id); onResolveReport(photo.id); }} className="col-span-2 py-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors"><EyeOff size={14} /> Ocultar (Archivar)</button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                </div>
            </main >

            {/* MODALS */}
            {/* ... keeping the modals as they were ... */}
            {
                showDeleteEventConfirm && (
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
                )
            }

            {
                showBulkDeleteConfirm && (
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
                )
            }

            {
                previewPhoto && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setPreviewPhoto(null)} />
                        <div className="relative bg-white w-full max-w-4xl rounded-xl overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[90vh]">
                            <button onClick={() => setPreviewPhoto(null)} className="absolute top-3 right-3 z-50 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors backdrop-blur-sm md:text-gray-500 md:bg-transparent md:hover:bg-gray-100"><XIcon size={24} /></button>
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
                )
            }

            {
                photoToDelete && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPhotoToDelete(null)} />
                        <div className="relative bg-white w-full max-w-sm rounded-xl p-6 shadow-2xl text-center">
                            <h3 className="text-lg font-bold text-gray-800 mb-2">¿Eliminar permanentemente?</h3>
                            <div className="flex gap-3 justify-center mt-6">
                                <button onClick={() => setPhotoToDelete(null)} className="px-4 py-2.5 rounded-lg bg-gray-100 text-gray-700 font-medium">Cancelar</button>
                                <button onClick={async () => { await onPermanentDelete(photoToDelete); setPhotoToDelete(null); setPreviewPhoto(null); }} className="px-4 py-2.5 rounded-lg bg-red-600 text-white font-bold">Sí, Eliminar</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {
                showReprocessModal && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isReprocessing && setShowReprocessModal(false)} />
                        <div className="relative bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl">
                            <h3 className="text-xl font-bold text-gray-800 mb-2">🔁 Reprocesar fotos antiguas</h3>
                            <p className="text-sm text-gray-600 mb-4">Esta acción:<br />• Convierte imágenes a WebP<br />• Genera thumbnails<br />• Reorganiza rutas<br />• Elimina archivos legacy</p>
                            {isReprocessing ? (
                                <div className="space-y-3">
                                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden"><div className="bg-orange-500 h-2 transition-all" style={{ width: reprocessProgress.total > 0 ? `${(reprocessProgress.current / reprocessProgress.total) * 100}%` : '0%' }} /></div>
                                    <p className="text-xs text-gray-600 text-center">Procesando {reprocessProgress.current} de {reprocessProgress.total}</p>
                                </div>
                            ) : reprocessResult ? (
                                <div className="text-sm text-green-700 font-bold text-center">✅ {reprocessResult.processed} de {reprocessResult.total} fotos reprocesadas</div>
                            ) : (
                                <div className="flex gap-3 justify-end mt-6">
                                    <button onClick={() => setShowReprocessModal(false)} className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 font-bold">Cancelar</button>
                                    <button onClick={handleReprocessPhotos} className="px-4 py-2 rounded-lg bg-orange-500 text-white font-bold hover:bg-orange-600">Iniciar</button>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }

            {
                showCleanupConfirm && (
                    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isCleaningStorage && setShowCleanupConfirm(false)} />
                        <div className="relative bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl text-center">
                            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 size={32} /></div>
                            <h3 className="text-xl font-bold text-gray-800 mb-2">Archivos Basura Detectados</h3>
                            <p className="text-sm text-gray-600 mb-6">Se encontraron <strong>{orphanFiles.length}</strong> archivos en el almacenamiento que no están referenciados en la base de datos (huérfanos). ¿Deseas eliminarlos permanentemente?</p>
                            {isCleaningStorage ? (
                                <div className="space-y-3">
                                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden"><div className="bg-red-500 h-2 transition-all duration-300" style={{ width: `${(cleanupProgress.deleted / cleanupProgress.total) * 100}%` }}></div></div>
                                    <p className="text-xs font-bold text-red-600 animate-pulse">Eliminando {cleanupProgress.deleted} de {cleanupProgress.total}...</p>
                                </div>
                            ) : cleanupResult ? (
                                <div className="space-y-4">
                                    <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm font-bold">✅ Limpieza completada: {cleanupResult.deleted} archivos eliminados.</div>
                                    <button onClick={() => setShowCleanupConfirm(false)} className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg">Cerrar</button>
                                </div>
                            ) : (
                                <div className="flex gap-3 justify-center">
                                    <button onClick={() => setShowCleanupConfirm(false)} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg">Cancelar</button>
                                    <button onClick={handleConfirmCleanup} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-md">Sí, limpiar todo</button>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }

            {/* NEW: CREATE EVENT MODAL */}
            {
                showCreateEventModal && (
                    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isCreatingEvent && setShowCreateEventModal(false)} />
                        <div className="relative bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-fade-in-up">
                            <div className="flex flex-col items-center mb-6">
                                <div className="w-14 h-14 bg-indigo-100 text-[#4f46e5] rounded-full flex items-center justify-center mb-3">
                                    <Plus size={28} />
                                </div>
                                <h3 className="text-xl font-bold text-gray-800">Crear Nuevo Álbum</h3>
                                <p className="text-sm text-gray-500 text-center mt-1">
                                    Esto creará una carpeta única en la nube.
                                </p>
                            </div>

                            {isCreatingEvent ? (
                                <div className="flex flex-col items-center py-4">
                                    <Loader2 size={32} className="animate-spin text-[#4f46e5] mb-2" />
                                    <p className="text-sm font-bold text-gray-600">Creando espacio...</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Nombre del Evento</label>
                                        <input
                                            type="text"
                                            value={newEventTitle}
                                            onChange={(e) => setNewEventTitle(e.target.value)}
                                            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#4f46e5] outline-none font-medium bg-white text-gray-900 placeholder-gray-400"
                                            placeholder="Ej: Boda María & Juan"
                                            autoFocus
                                            style={{ colorScheme: 'light' }}
                                        />
                                    </div>
                                    <div className="flex gap-3 pt-2">
                                        <button
                                            onClick={() => setShowCreateEventModal(false)}
                                            className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={handleCreateEventSubmit}
                                            disabled={!newEventTitle.trim()}
                                            className="flex-1 py-3 bg-[#4f46e5] hover:bg-[#4338ca] text-white font-bold rounded-xl shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:shadow-none transition-all"
                                        >
                                            Crear
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }

        </div >
    );
};
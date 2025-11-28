export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface Participant {
  id: string;
  name: string;
  email?: string;
  status: 'confirmed' | 'pending' | 'declined';
  addedAt: string;
}

export interface Photo {
  id: string;
  url: string;
  thumbnail: string;
  width: number;
  height: number;
  title?: string;
  description?: string;
  category: string;
  likes: number;
  likedByMe?: boolean;
  isArchived?: boolean; // Hidden from guests
  isDeleted?: boolean; // Soft deleted (In Recycle Bin)
  createdAt: string;
  author: {
    name: string;
    initials: string;
    avatarColor: string;
  };
  type?: 'photo' | 'video';
  deviceId?: string; // ID to identify the uploader/device
}

export interface AlbumSection {
  id: string;
  title: string;
  date: string;
}

export interface GeminiResponse {
  text: string;
}

export interface EventTheme {
  backgroundColor: string;
  textColor: string;
  
  // Avatar / Identity
  avatarBackgroundColor?: string;
  avatarTextColor?: string;
  avatarImage?: string; // URL for custom avatar image

  // Cover / Header Customization
  coverOverlayColor?: string; // Color of the overlay layer
  coverOverlayOpacity?: number; // 0.0 to 1.0
  coverBlur?: number; // px value for blur effect
  coverImagePositionY?: number; // Percentage for object-position (Mobile/Default)
  coverImagePositionDesktopY?: number; // Percentage for object-position (Desktop specific)

  // Buttons (Formerly Primary/Secondary)
  primaryColor: string; // Botón Subir
  primaryTextColor?: string;
  secondaryColor?: string;
  secondaryTextColor?: string;

  // Typography & Colors
  statsTextColor?: string;
  headerTitleColor?: string;
  headerDateColor?: string;
  fontFamily?: 'sans' | 'serif';

  // Gallery UI
  galleryToolbarBg?: string;
  galleryToolbarText?: string;
  cardBackgroundColor?: string;
  cardTextColor?: string;
}

export interface EventConfig {
  id: string;
  title: string;
  subtitle: string;
  date: string;
  coverImage?: string;
  participantsCount: number;
  participants: Participant[];
  photos: Photo[];
  categories: Category[];
  allowUploads: boolean;
  allowedMediaTypes: ('photo' | 'video')[];
  storageLimit: number;
  maxPhotosPerPerson: number;
  maxVideosPerPerson: number;
  maxVideoSizeMB?: number;
  clientName: string;
  downloadPassword: string;
  publicToken: string;
  theme?: EventTheme;
  googleDriveUrl?: string;
  isDriveBackupEnabled?: boolean;
  googleDriveFolderId?: string;
}
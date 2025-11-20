

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
  coverImagePositionY?: number; // Percentage for object-position

  // Buttons (Formerly Primary/Secondary)
  primaryColor: string; // Botón Subir
  primaryTextColor?: string; 
  secondaryColor: string; // Botón Descargar
  secondaryTextColor?: string; 
  
  // Text Specifics
  statsTextColor?: string; 
  headerTitleColor?: string; 
  headerDateColor?: string; 
  
  fontFamily?: 'sans' | 'serif'; 
}

export interface EventConfig {
  id: string; // Unique ID for the album
  title: string;
  subtitle: string;
  date: string;
  coverImage?: string; // URL for header background image
  participantsCount: number; // For the stats display
  participants?: Participant[]; // List of specific participants
  photos: Photo[]; // PERSISTED PHOTOS for the event
  categories: Category[];
  allowUploads: boolean;
  allowedMediaTypes: ('photo' | 'video')[];
  storageLimit: number; // MB per person
  maxPhotosPerPerson: number; // Limit of photos per upload session/person
  maxVideosPerPerson: number; // Limit of videos per upload session/person
  clientName?: string; // Name of the client assigned to this album
  downloadPassword?: string; // Password required for downloading the album
  publicToken?: string; // Unique token for public sharing link
  theme?: EventTheme; // Custom colors for the album
  googleDriveUrl?: string; // URL to the Google Drive backup folder
  isDriveBackupEnabled?: boolean; // Toggle to enable/disable the backup feature
}
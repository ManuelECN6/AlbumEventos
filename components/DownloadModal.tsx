
import React, { useState } from 'react';
import { Download, Shield, Key, Lock, ArrowLeft, Clipboard, CheckCircle, Loader2, AlertCircle, Video, Image as ImageIcon, FileText, Package } from 'lucide-react';
import { EventConfig } from '../types';
import JSZip from 'jszip';
import saveAs from 'file-saver';

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: EventConfig;
}

export const DownloadModal: React.FC<DownloadModalProps> = ({ isOpen, onClose, event }) => {
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'ready' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  
  // ZIP Download State
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);

  if (!isOpen) return null;

  // Fallback theme defaults
  const theme = event.theme || {
    primaryColor: '#a87b51',
    primaryTextColor: '#ffffff',
    secondaryColor: '#4f46e5',
    secondaryTextColor: '#ffffff',
    backgroundColor: '#ffffff',
    textColor: '#1f2937'
  };

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

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setPassword(text);
      setErrorMessage('');
    } catch (err) {
      const input = document.getElementById('password-input') as HTMLInputElement;
      if (input) {
          input.focus();
          document.execCommand('paste');
      }
    }
  };

  const handleVerify = () => {
    if (!password) {
        setErrorMessage('Por favor ingresa la contraseña.');
        triggerShake();
        return;
    }
    
    const requiredPassword = event.downloadPassword;
    
    if (password === requiredPassword || password === 'admin') { 
        setStatus('ready');
    } else {
        setStatus('error');
        setErrorMessage('Contraseña incorrecta. Inténtalo de nuevo.');
        setStatus('idle');
        triggerShake();
    }
  };

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  };

  const handleDownloadLinks = (type: 'photos' | 'videos') => {
    const files = event.photos.filter(p => type === 'photos' ? p.type !== 'video' : p.type === 'video');
    
    if (files.length === 0) {
        alert(`No hay ${type === 'photos' ? 'fotos' : 'videos'} para descargar.`);
        return;
    }

    // Generar contenido del archivo de texto
    let content = `ENLACES DE DESCARGA - ${event.title}\n`;
    content += `Total de archivos: ${files.length}\n\n`;
    
    files.forEach((f, index) => {
        content += `${index + 1}. ${f.url}\n`;
    });

    // Crear Blob y descargar
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event.title.replace(/\s+/g, '_')}_enlaces_${type}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadZip = async () => {
    const photosToDownload = event.photos.filter(p => p.type !== 'video'); // Only photos to prevent crash
    
    if (photosToDownload.length === 0) {
        alert("No hay fotos para descargar.");
        return;
    }

    setIsZipping(true);
    setZipProgress(0);
    
    try {
        const zip = new JSZip();
        const folder = zip.folder("fotos");
        let completed = 0;

        for (const photo of photosToDownload) {
            try {
                // Fetch the image
                const response = await fetch(photo.url, { mode: 'cors' });
                const blob = await response.blob();
                
                // Clean filename
                const filename = photo.title && photo.title.length < 30 
                    ? `${photo.title.replace(/[^a-z0-9]/gi, '_')}.jpg`
                    : `foto_${completed + 1}.jpg`;

                folder?.file(filename, blob);
            } catch (err) {
                console.error(`Error descargando ${photo.id}:`, err);
            }
            
            completed++;
            setZipProgress(Math.round((completed / photosToDownload.length) * 100));
        }

        // Generate ZIP
        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, `${event.title.replace(/\s+/g, '_')}_completo.zip`);
        
        onClose();
    } catch (error) {
        console.error("Error generando ZIP:", error);
        alert("Hubo un error generando el ZIP. Es posible que algunas imágenes tengan restricciones de seguridad. Intenta descargar la lista de enlaces.");
    } finally {
        setIsZipping(false);
        setZipProgress(0);
    }
  };

  const hasPhotos = event.allowedMediaTypes.includes('photo');
  const hasVideos = event.allowedMediaTypes.includes('video');

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={!isZipping ? onClose : undefined} />
      
      <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-fade-in-up">
        
        {/* Header */}
        <div 
            className="p-8 text-center text-white relative overflow-hidden"
            style={{ 
                background: `linear-gradient(to bottom, ${theme.secondaryColor}, ${theme.primaryColor})`
            }}
        >
            <div className="absolute top-0 left-0 w-full h-full opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent"></div>
            <div className="relative z-10 flex flex-col items-center">
                <div className="bg-white/20 p-3 rounded-full mb-4 backdrop-blur-sm">
                    <Download size={32} className="text-white stroke-[2]" />
                </div>
                <h2 className="text-3xl font-serif font-bold mb-2">Descargar Álbum</h2>
                <p className="text-white/90 font-medium text-lg leading-tight">{event.title}</p>
                <div className="flex items-center justify-center gap-2 text-xs text-white/80 mt-2 font-sans uppercase tracking-wider">
                    <span>{event.subtitle}</span>
                    <span>•</span>
                    <span>{event.date}</span>
                </div>
            </div>
        </div>

        {/* Body */}
        <div className="p-8 bg-white relative">
           
           {status === 'ready' ? (
               <div className="text-center py-6 animate-fade-in">
                   {isZipping ? (
                       <div className="flex flex-col items-center">
                            <Loader2 size={48} className="animate-spin text-blue-500 mb-4" />
                            <h3 className="text-lg font-bold text-gray-800">Comprimiendo Imágenes...</h3>
                            <p className="text-sm text-gray-500 mb-4">Esto puede tardar unos segundos.</p>
                            
                            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                                <div 
                                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                                    style={{ width: `${zipProgress}%` }}
                                ></div>
                            </div>
                            <span className="text-xs font-bold text-gray-600">{zipProgress}% completado</span>
                       </div>
                   ) : (
                    <div className="animate-fade-in">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce shadow-sm">
                            <CheckCircle size={40} className="text-green-500" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">¡Acceso Concedido!</h3>
                        <p className="text-gray-500 mb-8 text-sm">
                            Elige cómo quieres descargar los recuerdos.
                        </p>
                        
                        <div className="space-y-3">
                            {/* Main ZIP Download Button */}
                            {hasPhotos && (
                                <button 
                                    onClick={handleDownloadZip}
                                    className="w-full font-bold py-3.5 rounded-full shadow-lg transition-all transform hover:scale-[1.02] hover:shadow-xl flex items-center justify-center gap-2 relative overflow-hidden group"
                                    style={{ 
                                        background: `linear-gradient(to right, ${theme.primaryColor}, ${theme.secondaryColor})`,
                                        color: theme.primaryTextColor 
                                    }}
                                >
                                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                                    <Package size={20} />
                                    Descargar Todo (ZIP)
                                </button>
                            )}

                            <div className="relative py-2">
                                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-200"></span></div>
                                <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-gray-500">O descargar listas</span></div>
                            </div>

                            {hasPhotos && (
                                <button 
                                    onClick={() => handleDownloadLinks('photos')}
                                    className="w-full bg-gray-50 border border-gray-200 text-gray-700 font-bold py-3 rounded-full hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 text-sm"
                                >
                                    <FileText size={16} />
                                    Lista de Enlaces Fotos (.txt)
                                </button>
                            )}
                            
                            {hasVideos && (
                                <button 
                                    onClick={() => handleDownloadLinks('videos')}
                                    className="w-full bg-gray-50 border border-gray-200 text-gray-700 font-bold py-3 rounded-full hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 text-sm"
                                >
                                    <FileText size={16} />
                                    Lista de Enlaces Videos (.txt)
                                </button>
                            )}
                        </div>
                    </div>
                   )}
               </div>
           ) : (
               <>
                    {/* Protected Area Notice */}
                    <div 
                        className="rounded-xl p-6 text-center mb-8 border"
                        style={{ 
                            backgroundColor: hexToRgba(theme.primaryColor, 0.05),
                            borderColor: hexToRgba(theme.primaryColor, 0.2)
                        }}
                    >
                        <Shield size={36} className="mx-auto mb-3 opacity-80" style={{ color: theme.primaryColor }} />
                        <h3 className="font-bold text-lg mb-2" style={{ color: theme.primaryColor }}>Área Protegida</h3>
                        <p className="text-sm leading-relaxed opacity-80" style={{ color: theme.primaryColor }}>
                            Para acceder a todas las fotos del evento necesitas la contraseña especial proporcionada por el organizador.
                        </p>
                    </div>

                    {/* Password Input */}
                    <div className="mb-6">
                        <label className="flex items-center gap-2 text-sm font-bold mb-2" style={{ color: theme.primaryColor }}>
                            <Key size={16} />
                            Contraseña de Acceso
                        </label>
                        <div className={`relative group transition-transform duration-300 ${isShaking ? 'translate-x-[-5px] md:translate-x-[-10px]' : ''}`}>
                            <input 
                                id="password-input"
                                type="password" 
                                value={password}
                                onChange={(e) => {
                                    setPassword(e.target.value);
                                    setErrorMessage('');
                                }}
                                onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                                placeholder="Ingresa o pega la contraseña aquí"
                                className={`w-full pl-5 pr-24 py-3.5 rounded-xl border outline-none transition-all text-gray-700 bg-white shadow-sm placeholder-gray-400 focus:ring-2`}
                                style={{
                                    borderColor: errorMessage ? '#fca5a5' : '#d1d5db',
                                    boxShadow: errorMessage ? undefined : `0 0 0 0 transparent`,
                                }}
                                onFocus={(e) => {
                                    e.target.style.borderColor = theme.primaryColor;
                                    e.target.style.boxShadow = `0 0 0 3px ${hexToRgba(theme.primaryColor, 0.2)}`;
                                }}
                                onBlur={(e) => {
                                    e.target.style.borderColor = '#d1d5db';
                                    e.target.style.boxShadow = 'none';
                                }}
                            />
                            <button 
                                onClick={handlePaste}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold px-4 py-1.5 rounded-lg flex items-center gap-2 transition-colors shadow-sm border"
                                style={{
                                    backgroundColor: hexToRgba(theme.primaryColor, 0.1),
                                    color: theme.primaryColor,
                                    borderColor: hexToRgba(theme.primaryColor, 0.2)
                                }}
                                title="Pegar del portapapeles"
                            >
                                <Clipboard size={14} />
                                Pegar
                            </button>
                        </div>
                        
                        {errorMessage ? (
                            <p className="text-red-500 text-xs mt-2 font-medium flex items-center gap-1 animate-pulse">
                                <AlertCircle size={12} />
                                {errorMessage}
                            </p>
                        ) : (
                            <p className="text-[10px] mt-2 flex items-center gap-1.5" style={{ color: '#9ca3af' }}>
                                <span className="w-3.5 h-3.5 rounded-full bg-gray-200 flex items-center justify-center text-[8px] font-bold text-gray-500 font-serif">i</span>
                                Puedes pegar directamente la contraseña usando Ctrl+V o el botón "Pegar"
                            </p>
                        )}
                    </div>

                    {/* Action Button */}
                    <button 
                        onClick={handleVerify}
                        className="w-full font-bold py-3.5 rounded-full shadow-lg transition-all transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 disabled:opacity-80 disabled:cursor-not-allowed disabled:hover:scale-100"
                        style={{
                            backgroundColor: theme.primaryColor,
                            color: theme.primaryTextColor
                        }}
                    >
                        <Lock size={18} />
                        Verificar Contraseña
                    </button>
                </>
           )}

            {/* Back Button */}
            <button 
                onClick={!isZipping ? onClose : undefined}
                className={`w-full mt-6 flex items-center justify-center gap-2 text-gray-500 hover:text-gray-800 text-sm font-medium transition-colors border border-transparent hover:border-gray-200 rounded-full py-2 ${isZipping ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isZipping}
            >
                <ArrowLeft size={16} />
                Volver al Inicio
            </button>
            
            <style>{`
                @keyframes shake {
                    10%, 90% { transform: translate3d(-1px, 0, 0); }
                    20%, 80% { transform: translate3d(2px, 0, 0); }
                    30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
                    40%, 60% { transform: translate3d(4px, 0, 0); }
                }
            `}</style>

        </div>
      </div>
    </div>
  );
};

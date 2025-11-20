import React from 'react';
import { ArrowDown } from 'lucide-react';

export const Hero: React.FC = () => {
  const handleScroll = () => {
    const gallery = document.getElementById('gallery');
    if (gallery) {
      gallery.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="relative h-[70vh] md:h-[85vh] w-full overflow-hidden flex items-center justify-center">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src="https://picsum.photos/id/42/1920/1080" 
          alt="Cover" 
          className="w-full h-full object-cover filter brightness-[0.65]"
        />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center text-white px-4 max-w-4xl mx-auto animate-fade-in-up">
        <div className="mb-6 flex justify-center">
           <span className="px-4 py-1 border border-white/30 bg-white/10 backdrop-blur-md rounded-full text-xs font-bold tracking-[0.2em] uppercase">
             Colección 2023 - 2024
           </span>
        </div>
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-serif font-bold mb-6 leading-tight tracking-tight">
          Momentos <br/> Inolvidables
        </h1>
        <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto font-light mb-10 leading-relaxed">
          Un recorrido visual a través de nuestros días más especiales. 
          Cada imagen cuenta una historia que perdura para siempre.
        </p>
        
        <button 
          onClick={handleScroll}
          className="group flex flex-col items-center justify-center mx-auto text-white/60 hover:text-white transition-colors duration-300"
        >
          <span className="text-xs uppercase tracking-widest mb-2">Ver Galería</span>
          <ArrowDown className="animate-bounce" size={24} />
        </button>
      </div>
    </div>
  );
};
'use client';
import React from 'react';

export const PerspectiveGrid = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes grid-drift {
          0% { background-position: 0 0; }
          100% { background-position: 0 60px; }
        }
        .perspective-container {
          perspective: 600px;
        }
        .grid-plane {
          background-image: 
            linear-gradient(rgba(0, 240, 255, 0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 240, 255, 0.08) 1px, transparent 1px);
          background-size: 60px 60px;
          transform: rotateX(55deg) translateY(-15%);
          animation: grid-drift 3s linear infinite;
          -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 75%);
          mask-image: linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 75%);
        }
      `}} />

      {/* Radial vignette overlay */}
      <div 
        className="absolute inset-0 z-10" 
        style={{
          background: 'radial-gradient(ellipse at 50% 50%, transparent 25%, #020813 85%)'
        }}
      />

      {/* Grid Plane */}
      <div className="absolute inset-0 flex items-center justify-center perspective-container">
        <div 
          className="grid-plane absolute top-[-50%] left-[-50%] w-[200%] h-[200%]"
        />
      </div>
      
      {/* Optional faint radial grid behind it all */}
      <div className="absolute inset-0 flex items-center justify-center opacity-10">
        <div className="w-[800px] h-[800px] rounded-full border border-[#00f0ff] border-dashed" />
        <div className="absolute w-[1200px] h-[1200px] rounded-full border border-[#00f0ff] border-dotted opacity-50" />
      </div>
    </div>
  );
};

export default PerspectiveGrid;

import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './AnimatedMapBackground.css';

const defaultCenter = [77.5946, 12.9716];
const defaultZoom = 12;

const AnimatedMapBackground = () => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const animationFrameRef = useRef(null);
  const targetOffsetRef = useRef({ dx: 0, dy: 0 });
  const currentOffsetRef = useRef({ dx: 0, dy: 0 });

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,

      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: defaultCenter,
      zoom: defaultZoom,
      interactive: false,
    });

    mapRef.current = map;

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (map) {
        map.remove();
      }
    };
  }, []);

  useEffect(() => {
    let lastTime = 0;
    const throttleMs = 50;

    const handleMouseMove = (e) => {
      const currentTime = Date.now();
      if (currentTime - lastTime < throttleMs) return;
      lastTime = currentTime;

      const width = window.innerWidth || 1;
      const height = window.innerHeight || 1;
      const x = e.clientX;
      const y = e.clientY;

      const nx = (x / width) * 2 - 1;
      const ny = (y / height) * 2 - 1;

      targetOffsetRef.current = {
        dx: nx * 0.03,
        dy: ny * 0.03,
      };
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  useEffect(() => {
    let lastTime = 0;
    const throttleMs = 16;

    const animate = (currentTime) => {
      if (currentTime - lastTime < throttleMs) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }
      lastTime = currentTime;

      if (mapRef.current) {
        const { dx: targetDx, dy: targetDy } = targetOffsetRef.current;
        const { dx, dy } = currentOffsetRef.current;

        const deltaX = Math.abs(targetDx - dx);
        const deltaY = Math.abs(targetDy - dy);
        
        if (deltaX < 0.0001 && deltaY < 0.0001) {
          animationFrameRef.current = requestAnimationFrame(animate);
          return;
        }

        const easedDx = dx + (targetDx - dx) * 0.05;
        const easedDy = dy + (targetDy - dy) * 0.05;
        currentOffsetRef.current = { dx: easedDx, dy: easedDy };

        const newCenter = [
          defaultCenter[0] - easedDx,
          defaultCenter[1] - easedDy,
        ];

        mapRef.current.jumpTo({
          center: newCenter,
          zoom: defaultZoom,
        });
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <div className="animated-map-background">
      <div ref={mapContainerRef} className="map-canvas" />
    </div>
  );
};

export default AnimatedMapBackground;

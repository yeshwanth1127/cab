import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './AnimatedMapBackground.css';

const defaultCenter = [77.5946, 12.9716]; // [lng, lat] for Bangalore
const defaultZoom = 12;

const AnimatedMapBackground = () => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const animationFrameRef = useRef(null);
  const targetOffsetRef = useRef({ dx: 0, dy: 0 });
  const currentOffsetRef = useRef({ dx: 0, dy: 0 });

  // Initialize MapLibre map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      // Carto Positron vector style for light/white background
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: defaultCenter,
      zoom: defaultZoom,
      interactive: false, // purely visual background
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

  // Track mouse globally and set target offset (opposite direction)
  useEffect(() => {
    const handleMouseMove = (e) => {
      const width = window.innerWidth || 1;
      const height = window.innerHeight || 1;
      const x = e.clientX;
      const y = e.clientY;

      // Normalize to -1..1
      const nx = (x / width) * 2 - 1;
      const ny = (y / height) * 2 - 1;

      // Opposite to cursor, small lng/lat offsets
      targetOffsetRef.current = {
        dx: nx * 0.03, // lng delta
        dy: ny * 0.03, // lat delta
      };
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // Animate center for parallax effect
  useEffect(() => {
    const animate = () => {
      if (mapRef.current) {
        const { dx: targetDx, dy: targetDy } = targetOffsetRef.current;
        const { dx, dy } = currentOffsetRef.current;

        // Smooth easing
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


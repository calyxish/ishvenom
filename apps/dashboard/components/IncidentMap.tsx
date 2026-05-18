'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { DistrictStat } from '@/lib/api';

/**
 * Country centroid lookup — rough, enough to place a marker on the map
 * for every country we expect data from. District-level polygons require
 * a shapefile and are post-hackathon work.
 */
const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  GH: [-1.0232, 7.9465],
  NG: [8.6753, 9.082],
  SN: [-14.4524, 14.4974],
  CI: [-5.5471, 7.54],
  ML: [-3.9962, 17.5707],
  BF: [-1.5616, 12.2383],
  NE: [8.0817, 17.6078],
  TD: [18.7322, 15.4542],
  SD: [30.2176, 12.8628],
  ET: [40.4897, 9.145],
  KE: [37.9062, -0.0236],
  TZ: [34.8888, -6.369],
  UG: [32.2903, 1.3733],
  RW: [29.8739, -1.9403],
  EG: [30.8025, 26.8206],
  MR: [-10.9408, 21.0079],
  LY: [17.2283, 26.3351],
  CM: [12.3547, 7.3697],
  CD: [21.7587, -4.0383],
  ZA: [22.9375, -30.5595],
};

// IshVenom design tokens for map elements (hex required by MapLibre)
const TOKENS = {
  bg:      '#0F0D15', // ish-bg  — map background / water fill
  surface: '#0F172A', // ish-surface — popup bg
  border:  '#1E293B', // ish-border  — popup border, circle stroke
  text:    '#F0F9FF', // ish-text
  muted:   '#64748B', // ish-text-muted — labels
  accent:  '#0EA5E9', // ish-accent — low bite-ratio circles
  warning: '#F59E0B', // ish-warning — mid bite-ratio
  danger:  '#EF4444', // ish-danger  — high bite-ratio
};

const SOURCE_ID = 'ishvenom-incidents';
const LAYER_ID  = 'ishvenom-circles';

export function IncidentMap({ districts }: { districts: DistrictStat[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef       = useRef<maplibregl.Map | null>(null);

  function toGeoJson(): GeoJSON.FeatureCollection {
    const features: GeoJSON.Feature[] = [];
    for (const d of districts) {
      const centroid = COUNTRY_CENTROIDS[d.country];
      if (!centroid) continue;
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: centroid },
        properties: {
          country:       d.country,
          district:      d.district ?? 'Unknown',
          encounterCount: d.encounterCount,
          biteCount:     d.biteCount,
          topSpecies:    d.topSpecies ?? 'n/a',
          biteRatio:     d.encounterCount ? d.biteCount / d.encounterCount : 0,
        },
      });
    }
    return { type: 'FeatureCollection', features };
  }

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      // Dark vector style — OSM tiles inverted via CSS so the basemap matches
      // the IshVenom dark theme without needing a paid tile provider.
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap contributors',
          },
        },
        layers: [
          {
            id: 'background',
            type: 'background',
            paint: { 'background-color': TOKENS.bg },
          },
          {
            id: 'osm',
            type: 'raster',
            source: 'osm',
            // CSS invert + hue-rotate applied via the container — see the
            // .maplibregl-map rule in the style tag below.
          },
        ],
      },
      center: [20, 5],
      zoom: 2.5,
    });

    // Invert the raster tile layer to get a dark map.
    // Applied directly on the canvas element via JS so we don't need global CSS.
    map.on('load', () => {
      const canvas = map.getCanvas();
      canvas.style.filter = 'invert(1) hue-rotate(180deg)';

      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: toGeoJson(),
      });

      map.addLayer({
        id: LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['get', 'encounterCount'],
            0, 5,
            100, 22,
            1000, 40,
          ],
          'circle-color': [
            'interpolate', ['linear'], ['get', 'biteRatio'],
            0,   TOKENS.accent,   // low ratio  → purple
            0.5, TOKENS.warning,  // mid ratio  → amber
            1,   TOKENS.danger,   // high ratio → red
          ],
          'circle-opacity': 0.85,
          'circle-stroke-width': 1.5,
          // Invert the stroke too so it contrasts against the inverted basemap
          'circle-stroke-color': '#F5F3FF',
        },
      });

      // Popup on click
      map.on('click', LAYER_ID, (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as {
          country: string;
          district: string;
          encounterCount: number;
          biteCount: number;
          topSpecies: string;
        };
        new maplibregl.Popup({ offset: 12 })
          .setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
          .setHTML(
            `<div style="
               background:${TOKENS.surface};
               color:${TOKENS.text};
               border:1px solid ${TOKENS.border};
               border-radius:12px;
               padding:12px 14px;
               font-family:system-ui,sans-serif;
               font-size:12px;
               line-height:1.6;
               min-width:160px;
             ">
               <div style="font-weight:700;margin-bottom:6px;">
                 ${p.country} — ${p.district}
               </div>
               <div style="color:${TOKENS.muted}">
                 Encounters: <span style="color:${TOKENS.text}">${p.encounterCount}</span><br/>
                 Bites: <span style="color:${TOKENS.danger}">${p.biteCount}</span><br/>
                 Top species: <span style="color:${TOKENS.text};font-style:italic">${p.topSpecies}</span>
               </div>
             </div>`,
          )
          .addTo(map);
      });

      map.on('mouseenter', LAYER_ID, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', LAYER_ID, () => { map.getCanvas().style.cursor = ''; });
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update source when districts prop changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (source) source.setData(toGeoJson());
  }, [districts]);

  return <div ref={containerRef} className="w-full h-full" />;
}

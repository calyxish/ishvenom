'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { DistrictStat } from '@/lib/api';
import { useThemeTokens } from '@/lib/useThemeTokens';

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

const SOURCE_ID = 'ishvenom-incidents';
const LAYER_ID  = 'ishvenom-circles';

export function IncidentMap({ districts }: { districts: DistrictStat[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef       = useRef<maplibregl.Map | null>(null);
  const tokens       = useThemeTokens();

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
      // Vector-style basemap — OSM raster with a CSS filter applied so
      // it matches the active IshVenom theme.
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
            paint: { 'background-color': tokens.bg },
          },
          {
            id: 'osm',
            type: 'raster',
            source: 'osm',
          },
        ],
      },
      center: [20, 5],
      zoom: 2.5,
    });

    map.on('load', () => {
      // Dark-mode: invert the raster tiles. Light-mode: leave them alone.
      // We re-check this in the theme effect below, so this is just the
      // first paint.
      applyBasemapFilter(map, tokens.bg);

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
            0,   tokens.accent,   // low ratio  → cyan
            0.5, tokens.warning,  // mid ratio  → amber
            1,   tokens.danger,   // high ratio → red
          ],
          'circle-opacity': 0.85,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': tokens.surface,
        },
      });

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
               background:${tokens.surface};
               color:${tokens.text};
               border:1px solid ${tokens.border};
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
               <div style="color:${tokens.textSecondary}">
                 Encounters: <span style="color:${tokens.text}">${p.encounterCount}</span><br/>
                 Bites: <span style="color:${tokens.danger}">${p.biteCount}</span><br/>
                 Top species: <span style="color:${tokens.text};font-style:italic">${p.topSpecies}</span>
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
    // We intentionally only run this on mount — subsequent theme/data
    // changes are handled by the two effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-apply circle colors + basemap filter when the theme changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!map.isStyleLoaded()) {
      map.once('load', () => applyThemeToLayers(map, tokens));
      return;
    }
    applyThemeToLayers(map, tokens);
  }, [tokens]);

  // Update source when districts prop changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (source) source.setData(toGeoJson());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [districts]);

  return <div ref={containerRef} className="w-full h-full" />;
}

// ─── helpers ────────────────────────────────────────────────────────

function applyBasemapFilter(map: maplibregl.Map, bg: string) {
  // Dark backgrounds → invert the OSM tiles so the basemap matches the
  // dark theme without needing a paid vector tile provider. Light bg
  // leaves the tiles as-is.
  const canvas = map.getCanvas();
  const isDark = isDarkColor(bg);
  canvas.style.filter = isDark ? 'invert(1) hue-rotate(180deg)' : 'none';
}

function applyThemeToLayers(map: maplibregl.Map, tokens: { bg: string; accent: string; warning: string; danger: string; surface: string }) {
  applyBasemapFilter(map, tokens.bg);
  try {
    map.setPaintProperty('background', 'background-color', tokens.bg);
  } catch {
    // Background layer might not exist yet — safe to ignore.
  }
  try {
    map.setPaintProperty(LAYER_ID, 'circle-color', [
      'interpolate', ['linear'], ['get', 'biteRatio'],
      0,   tokens.accent,
      0.5, tokens.warning,
      1,   tokens.danger,
    ]);
    map.setPaintProperty(LAYER_ID, 'circle-stroke-color', tokens.surface);
  } catch {
    // Layer might not be added yet — safe to ignore.
  }
}

function isDarkColor(hex: string): boolean {
  // Quick luminance heuristic — used only to decide whether to invert OSM.
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return true;
  const v = parseInt(m[1]!, 16);
  const r = (v >> 16) & 0xff;
  const g = (v >> 8) & 0xff;
  const b = v & 0xff;
  // Rec. 709 luma.
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luma < 128;
}

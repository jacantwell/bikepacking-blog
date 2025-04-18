"use client";

import { useState, useEffect } from 'react';
import Map, { Source, Layer, NavigationControl } from 'react-map-gl/mapbox';
import { SummaryActivity } from '@/services/strava/api';
import { processActivities } from '@/lib/activity-processor';

// You'll need to add these environment variables in .env.local
// NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token

interface JourneyMapProps {
  activities: SummaryActivity[];
  startDate: string;
}

export function JourneyMap({ activities, startDate }: JourneyMapProps) {
  const [viewState, setViewState] = useState({
    longitude: 0,
    latitude: 30,
    zoom: 2
  });
  
  const [journeyData, setJourneyData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Detect dark mode
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  useEffect(() => {
    // Check if dark mode is enabled
    setIsDarkMode(document.documentElement.classList.contains('dark'));
    
    // Process activities data
    if (activities && activities.length) {
      const processedData = processActivities(activities, startDate);
      setJourneyData(processedData);
    }
    
    setIsLoading(false);
  }, [activities, startDate]);
  
  // Map style based on dark/light mode
  const mapStyle = isDarkMode 
    ? "mapbox://styles/mapbox/dark-v11" 
    : "mapbox://styles/mapbox/outdoors-v12";

  return (
    <section className="mb-16 md:mb-20">
      <h2 className="mb-8 text-4xl md:text-5xl font-bold tracking-tighter leading-tight">
        My Journey Map
      </h2>
      <div className="relative h-96 md:h-[600px] w-full rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-200 dark:bg-slate-700">
            <p>Loading map...</p>
          </div>
        ) : (
          <>
            {/* The actual map component */}
            <Map
              {...viewState}
              onMove={evt => setViewState(evt.viewState)}
              mapStyle={mapStyle}
              mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
              style={{ width: '100%', height: '100%' }}
            >
              <NavigationControl position="top-right" />
              
              {/* Render journey polylines if data is available */}
              {journeyData && journeyData.features.length > 0 && (
                <Source id="journey-routes" type="geojson" data={journeyData}>
                  <Layer
                    id="journey-lines"
                    type="line"
                    paint={{
                      'line-color': isDarkMode ? '#ff6b6b' : '#ff4400',
                      'line-width': 3,
                      'line-opacity': 0.8
                    }}
                  />
                </Source>
              )}
            </Map>
          </>
        )}
      </div>
      <div className="mt-4 flex justify-between text-sm">
        <div>Start: {new Date(startDate).toLocaleDateString()}</div>
        <div>{activities.length} activities</div>
      </div>
      
      {/* You can add additional information or controls here */}
      <div className="mt-6 text-sm text-gray-600 dark:text-gray-400">
        <p>This map displays my journey across the world based on Strava activities.</p>
      </div>
    </section>
  );
}
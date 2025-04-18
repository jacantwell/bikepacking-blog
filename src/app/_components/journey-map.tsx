"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import Map, { Source, Layer, NavigationControl, Marker, Popup, ViewState, ViewStateChangeEvent, LineLayerSpecification } from 'react-map-gl/mapbox';
import { SummaryActivity } from '@/services/strava/api';
import { processActivities, calculateBounds } from '@/lib/activity-processor';

interface JourneyMapProps {
  activities: SummaryActivity[];
  startDate: string;
}

// Helper function to format distance
function formatDistance(meters: number | undefined, unit: string | undefined): string {
  if (!meters) return '0 m';
  if (unit === "km") return (meters / 1000).toFixed(1) + ' km';
  return meters ? meters + ' m' : '0 m';
}

// Helper function to format date
function formatDate(dateString: string | undefined): string {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// Helper function to format time
function formatTime(seconds: number | undefined): string {
  if (!seconds) return '0m';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function JourneyMap({ activities, startDate }: JourneyMapProps) {
  const [currentViewState, setCurrentViewState] = useState<ViewState>({
    longitude: 0,
    latitude: 30,
    zoom: 2,
    bearing: 0,
    pitch: 0,
    padding: { top: 40, bottom: 40, left: 40, right: 40 }
  });
  


  const [journeyData, setJourneyData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // State for activity hover and selection
  const [hoveredActivity, setHoveredActivity] = useState<SummaryActivity | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<SummaryActivity | null>(null);
  const [popupInfo, setPopupInfo] = useState<{
    longitude: number;
    latitude: number;
    activity: SummaryActivity;
  } | null>(null);
  
  // State for current location marker
  const [currentLocation, setCurrentLocation] = useState<{
    longitude: number;
    latitude: number;
    activity: SummaryActivity;
  } | null>(null);
  
  // Stats
  const [stats, setStats] = useState({
    totalDistance: 0,
    totalElevationGain: 0,
    totalActivities: 0,
    activityTypes: {} as Record<string, number>
  });
  
  // Auto fit bounds when map data changes
  const fitBounds = useCallback(() => {
    if (!activities || activities.length === 0) return;
    
    const bounds = calculateBounds(activities);
    if (!bounds) return;
    
    // Get map element to calculate the right padding
    const mapContainer = document.getElementById('journey-map');
    if (!mapContainer) return;
    
    // Add some padding to the bounds
    const [minLng, minLat, maxLng, maxLat] = bounds;
    
    // Calculate the center
    const centerLng = (minLng + maxLng) / 2;
    const centerLat = (minLat + maxLat) / 2;
    
    // Calculate appropriate zoom level
    // This is an approximation - smaller differences need higher zoom
    const lngDiff = Math.abs(maxLng - minLng);
    const latDiff = Math.abs(maxLat - minLat);
    const maxDiff = Math.max(lngDiff, latDiff);
    
    // Logarithmic scale for zoom - adjust constants as needed
    let zoom = 1;
    if (maxDiff > 0) {
      zoom = Math.min(15, Math.max(1, Math.floor(8 - Math.log(maxDiff) / Math.log(2))));
    }
    
    // Update the view state
    setCurrentViewState(prev => ({
      ...prev,
      longitude: centerLng,
      latitude: centerLat,
      zoom: zoom,
    }));
  }, [activities]);
  
  // Find most recent activity and set current location
  const findCurrentLocation = useCallback(() => {
    if (!activities || activities.length === 0) return;
    
    // Sort activities by date, most recent first
    const sortedActivities = [...activities].sort((a, b) => {
      const dateA = new Date(a.start_date || '').getTime();
      const dateB = new Date(b.start_date || '').getTime();
      return dateB - dateA; // Descending order
    });
    
    const mostRecent = sortedActivities[0];
    
    console.log('Most recent activity:', mostRecent);
    console.log('Endlatlng:', mostRecent.end_latlng);
    
    // Try to get the end point if available
    if (mostRecent.end_latlng && mostRecent.end_latlng.length === 2) {
      setCurrentLocation({
        latitude: mostRecent.end_latlng[0],
        longitude: mostRecent.end_latlng[1],
        activity: mostRecent
      });
    }
  }, [activities]);
  
  // Effect to handle dark mode
  useEffect(() => {
    // Check if dark mode is enabled
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    
    checkDarkMode();
    
    // Add listener for theme changes
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);
  
  // Process activities and calculate stats
  useEffect(() => {
    if (activities && activities.length) {
      // Process GeoJSON data
      const processedData = processActivities(activities, startDate);
      setJourneyData(processedData);
      
      // Calculate statistics
      let totalDistance = 0;
      const activityTypes: Record<string, number> = {};
      
      activities.forEach(activity => {
        if (activity.distance) {
          totalDistance += activity.distance;
        }

        if (activity.total_elevation_gain) {
          stats.totalElevationGain += activity.total_elevation_gain;
        }
        
        if (activity.type) {
          activityTypes[activity.type] = (activityTypes[activity.type] || 0) + 1;
        }
      });
      
      setStats({
        totalDistance,
        totalElevationGain: stats.totalElevationGain,
        totalActivities: activities.length,
        activityTypes
      });
      
      // Find current location marker
      findCurrentLocation();
      
      // Fit map to activity bounds after a short delay
      setTimeout(fitBounds, 500);
    }
    
    setIsLoading(false);
  }, [activities, startDate, fitBounds, findCurrentLocation]);
  
  // Map style based on dark/light mode
  const mapStyle = isDarkMode 
  ? "mapbox://styles/mapbox/dark-v11" 
  : "mapbox://styles/mapbox/outdoors-v12";
  
  // console.log('Current location:', currentLocation);
  // Layer styles
  const lineLayer: LineLayerSpecification = {
    id: 'journey-lines',
    type: 'line',
    source: 'journey-routes',
    paint: {
      'line-color': [
        'match',
        ['get', 'type'],
        'Ride', isDarkMode ? '#ff6b6b' : '#e03131',
        isDarkMode ? '#ff9f40' : '#f2711c' // default color
      ],
      'line-width': 3,
      'line-opacity': 0.8
    }
  };
  
  // Handle map click
  const handleMapClick = (event: any) => {
    // Get features at click point
    const features = event.features || [];
    
    if (features.length > 0) {
      // Find the activity that corresponds to the clicked feature
      const featureId = features[0].properties.id;
      const activity = activities.find(a => a.id === featureId);
      
      if (activity) {
        setSelectedActivity(activity);
        
        // Get coordinates for the popup - use the first point of the activity
        if (activity.start_latlng && activity.start_latlng.length === 2) {
          setPopupInfo({
            longitude: activity.start_latlng[1],
            latitude: activity.start_latlng[0],
            activity
          });
        }
      }
    } else {
      // Clicked away from a feature
      setSelectedActivity(null);
      setPopupInfo(null);
    }
  };
  
  // Callbacks for map interactions
  const onMouseEnter = useCallback(() => {
    // Change cursor to pointer when hovering over a feature
    const mapCanvas = document.querySelector('.mapboxgl-canvas-container');
    if (mapCanvas) {
      mapCanvas.classList.add('cursor-pointer');
    }
  }, []);
  
  const onMouseLeave = useCallback(() => {
    // Restore default cursor
    const mapCanvas = document.querySelector('.mapboxgl-canvas-container');
    if (mapCanvas) {
      mapCanvas.classList.remove('cursor-pointer');
    }
  }, []);
  
  // Button handler for fitting bounds
  const handleFitBounds = () => {
    fitBounds();
  };

  return (
    <section className="mb-16 md:mb-20">
      <h2 className="mb-4 text-4xl md:text-5xl font-bold tracking-tighter leading-tight">
        My Journey Map
      </h2>
      
      {/* Stats summary */}
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg p-3 shadow-sm">
          <h3 className="text-lg font-semibold">Total Distance</h3>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {formatDistance(stats.totalDistance, 'km')}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg p-3 shadow-sm">
          <h3 className="text-lg font-semibold">Activities</h3>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {stats.totalActivities}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg p-3 shadow-sm">
          <h3 className="text-lg font-semibold">Total Elevation</h3>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
          {formatDistance(stats.totalElevationGain, undefined)}
          </p>
        </div>
      </div>
      
      {/* The map container */}
      <div className="relative h-96 md:h-[600px] w-full rounded-lg overflow-hidden" id="journey-map">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-200 dark:bg-slate-700">
            <p>Loading map...</p>
          </div>
        ) : (
          <>
            {/* The actual map component */}
            <Map
              {...currentViewState}
              onMove={(evt: ViewStateChangeEvent) => setCurrentViewState(evt.viewState)}
              mapStyle={mapStyle}
              mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
              style={{ width: '100%', height: '100%' }}
              interactiveLayerIds={['journey-lines']}
              onClick={handleMapClick}
              onMouseEnter={onMouseEnter}
              onMouseLeave={onMouseLeave}
            >
              <NavigationControl position="top-right" />
              
              {/* Custom control for fit bounds */}
              <div className="absolute top-2 left-2">
                <button 
                  onClick={handleFitBounds}
                  className="bg-white dark:bg-slate-700 p-2 rounded shadow"
                  title="Fit map to journey"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                  </svg>
                </button>
              </div>

                            
              Current location marker
              {currentLocation && (
                  <Marker
                    longitude={currentLocation.longitude}
                    latitude={currentLocation.latitude}
                    anchor="center"
                  >
                    <div className="w-60 h-60 bg-black-500 rounded-full border-2 border-white" />
                  </Marker>
                )}

              {/* Render journey polylines if data is available */}
              {journeyData && journeyData.features.length > 0 && (
                <Source id="journey-routes" type="geojson" data={journeyData}>
                  <Layer {...lineLayer} />
                </Source>
              )}
              
            </Map>
          </>
        )}
      </div>
      
      {/* Map legend */}
        {/* {currentLocation && (
          <div className="ml-auto flex items-center">
            <div className={`inline-flex items-center justify-center w-6 h-6 p-1 rounded-full ${isDarkMode ? 'bg-slate-800' : 'bg-white'} border-2 border-red-500 text-red-500 mr-1`}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="5.5" cy="17.5" r="3.5" />
              <circle cx="18.5" cy="17.5" r="3.5" />
              <path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h2" />
            </svg>
            </div>
            <span>Current location</span>
          </div>
        )} */}
      
      
      {/* Selected activity details */}
      {selectedActivity && (
        <div className="mt-6 bg-white dark:bg-slate-800 rounded-lg p-4 shadow-md">
          <h3 className="text-xl font-bold mb-2">{selectedActivity.name}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Date</p>
              <p>{formatDate(selectedActivity.start_date)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Type</p>
              <p>{selectedActivity.type}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Distance</p>
              <p>{formatDistance(selectedActivity.distance, 'km')}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Duration</p>
              <p>{formatTime(selectedActivity.elapsed_time)}</p>
            </div>
          </div>
          
          {/* Additional details if available */}
          {selectedActivity.total_elevation_gain && (
            <div className="mt-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">Elevation Gain</p>
              <p>{selectedActivity.total_elevation_gain} m</p>
            </div>
          )}
          
          {/* Is this the current location? */}
          {currentLocation && currentLocation.activity.id === selectedActivity.id && (
            <div className="mt-3 inline-block px-3 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-100 rounded-full text-sm">
              Current Location
            </div>
          )}
          
          {/* Show link to Strava activity */}
          {selectedActivity.id && (
            <div className="mt-4">
              <a 
                href={`https://www.strava.com/activities/${selectedActivity.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded transition-colors"
              >
                View on Strava
              </a>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
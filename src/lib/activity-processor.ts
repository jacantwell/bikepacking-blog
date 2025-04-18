import { SummaryActivity } from '@/services/strava/api';
import { decodePolyline } from './polyline';

// This function processes Strava activities into a format suitable for displaying on the map
export function processActivities(activities: SummaryActivity[], startDate: string) {
  if (!activities || activities.length === 0) {
    return {
      type: 'FeatureCollection',
      features: []
    };
  }
  
  // Filter activities by startDate
  const filteredActivities = activities.filter(activity => 
    new Date(activity.start_date || '') >= new Date(startDate)
  );
  
  // Sort chronologically
  const sortedActivities = filteredActivities.sort((a, b) => {
    const dateA = new Date(a.start_date || '').getTime();
    const dateB = new Date(b.start_date || '').getTime();
    return dateA - dateB;
  });
  
  // Transform to GeoJSON for the map
  const features = sortedActivities
    .filter(activity => activity.map?.summary_polyline)
    .map(activity => {
      // In the actual implementation, this will decode the polyline and convert to GeoJSON
      const coordinates = decodePolyline(activity.map?.summary_polyline || '')
        .map(([lat, lng]) => [lng, lat]); // GeoJSON uses [lng, lat] format
        
      return {
        type: 'Feature',
        properties: {
          id: activity.id,
          name: activity.name,
          type: activity.type,
          date: activity.start_date,
          distance: activity.distance
        },
        geometry: {
          type: 'LineString',
          coordinates
        }
      };
    });
    
  return {
    type: 'FeatureCollection',
    features
  };
}
import { SummaryActivity } from '@/services/strava/api';
import { decodePolyline } from './polyline';

// GeoJSON types
interface GeoJSONFeature {
  type: 'Feature';
  properties: {
    id?: number;
    name?: string;
    type?: string;
    date?: string;
    distance?: number;
    [key: string]: any;
  };
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
}

interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

/**
 * Processes Strava activities into GeoJSON format for the map
 * 
 * @param activities List of activities from Strava API
 * @param startDate ISO date string for the beginning of the journey
 * @returns GeoJSON FeatureCollection
 */
export function processActivities(
  activities: SummaryActivity[], 
  startDate: string
): GeoJSONFeatureCollection {
  if (!activities || activities.length === 0) {
    return {
      type: 'FeatureCollection',
      features: []
    };
  }
  
  // Filter activities by startDate
  const filteredActivities = activities.filter(activity => 
    activity.start_date && new Date(activity.start_date) >= new Date(startDate)
  );
  
  // Sort chronologically
  const sortedActivities = filteredActivities.sort((a, b) => {
    const dateA = new Date(a.start_date || '').getTime();
    const dateB = new Date(b.start_date || '').getTime();
    return dateA - dateB;
  });
  
  console.log(`Processing ${sortedActivities.length} activities for map display`);
  
  // Transform to GeoJSON for the map
  const features: GeoJSONFeature[] = [];
  
  // Process each activity
  sortedActivities
    .filter(activity => !!activity.map?.summary_polyline)
    .forEach(activity => {
      // Decode the polyline into coordinate points
      const decodedPoints = decodePolyline(activity.map?.summary_polyline || '');
      
      // Convert from [lat, lng] to [lng, lat] format for GeoJSON
      const coordinates = decodedPoints.map(([lat, lng]) => [lng, lat] as [number, number]);
      
      // Skip if no valid coordinates
      if (coordinates.length === 0) {
        console.warn(`Activity ${activity.id} has no valid coordinates`);
        return; // Skip this activity
      }
      
      // Add valid feature to the array
      features.push({
        type: 'Feature',
        properties: {
          id: activity.id,
          name: activity.name,
          type: activity.type,
          date: activity.start_date,
          distance: activity.distance,
          sport_type: activity.sport_type,
          start_date_local: activity.start_date_local,
          elapsed_time: activity.elapsed_time,
          total_elevation_gain: activity.total_elevation_gain
        },
        geometry: {
          type: 'LineString',
          coordinates
        }
      });
    });
    
  return {
    type: 'FeatureCollection',
    features
  };
}

/**
 * Calculate the bounding box of all activities
 * Useful for setting the initial map view
 * 
 * @param activities List of activities
 * @returns [minLng, minLat, maxLng, maxLat] or null if no valid coordinates
 */
export function calculateBounds(activities: SummaryActivity[]): [number, number, number, number] | null {
  if (!activities || activities.length === 0) {
    return null;
  }
  
  let minLat = 90;
  let maxLat = -90;
  let minLng = 180;
  let maxLng = -180;
  let hasValidCoordinates = false;
  
  // Process start/end points
  activities.forEach(activity => {
    // Check start coordinates
    if (activity.start_latlng && activity.start_latlng.length === 2) {
      const [lat, lng] = activity.start_latlng;
      hasValidCoordinates = true;
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
    }
    
    // Check end coordinates
    if (activity.end_latlng && activity.end_latlng.length === 2) {
      const [lat, lng] = activity.end_latlng;
      hasValidCoordinates = true;
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
    }
    
    // Process polylines for more accurate bounds
    if (activity.map?.summary_polyline) {
      const points = decodePolyline(activity.map.summary_polyline);
      
      points.forEach(([lat, lng]) => {
        hasValidCoordinates = true;
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
      });
    }
  });
  
  return hasValidCoordinates ? [minLng, minLat, maxLng, maxLat] : null;
}

/**
 * Groups activities by type
 * @param activities List of activities
 * @returns Object with activity types as keys and counts as values
 */
export function groupActivitiesByType(activities: SummaryActivity[]): Record<string, number> {
  const result: Record<string, number> = {};
  
  activities.forEach(activity => {
    if (activity.type) {
      result[activity.type] = (result[activity.type] || 0) + 1;
    }
  });
  
  return result;
}

/**
 * Calculates total distance of all activities
 * @param activities List of activities
 * @returns Total distance in meters
 */
export function calculateTotalDistance(activities: SummaryActivity[]): number {
  return activities.reduce((total, activity) => total + (activity.distance || 0), 0);
}
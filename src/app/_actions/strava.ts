'use server';

import { SummaryActivity } from '@/services/strava/api';
import { StravaClient } from '@/lib/strava-client';

/**
 * Gets journey activities from Strava using the refresh token flow
 * @param startDate The date from which to fetch activities, in ISO format
 */
export async function getJourneyActivities(startDate: string = '2023-01-01T00:00:00Z') {
  try {
    // Create a new Strava client - this will use environment variables
    const stravaClient = new StravaClient();
    
    // Convert start date to epoch timestamp (required by Strava API)
    const after = Math.floor(new Date(startDate).getTime() / 1000);
    
    // Fetch all activities after the start date, handling pagination automatically
    const activities = await stravaClient.getAllActivitiesAfter(after);
    
    console.log(`Fetched ${activities.length} activities from Strava API`);
    
    return {
      activities,
      startDate
    };
  } catch (error) {
    console.error('Error fetching Strava activities:', error);
    // Fall back to mock data if the API fails
    return getMockActivities(startDate);
  }
}

/**
 * Fallback function to get mock data if API fails
 */
function getMockActivities(startDate: string) {
  console.log('Using mock Strava data');
  
  // Mock data for initial testing
  const mockActivities: SummaryActivity[] = [
    {
      id: 1,
      name: 'Morning Run',
      start_date: '2023-01-05T08:00:00Z',
      distance: 5000,
      type: 'Run',
      map: {
        summary_polyline: 'mock_polyline_data'
      }
    },
    {
      id: 2,
      name: 'Evening Ride',
      start_date: '2023-01-07T18:00:00Z',
      distance: 15000,
      type: 'Ride',
      map: {
        summary_polyline: 'mock_polyline_data'
      }
    },
    {
      id: 3,
      name: 'Weekend Hike',
      start_date: '2023-01-14T10:00:00Z',
      distance: 8000,
      type: 'Hike',
      map: {
        summary_polyline: 'mock_polyline_data'
      }
    }
  ];
  
  return {
    activities: mockActivities,
    startDate
  };
}
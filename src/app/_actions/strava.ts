'use server';

import { Configuration } from '@/services/strava/configuration';
import { ActivitiesApi, SummaryActivity } from '@/services/strava/api';

// In a production app, this token would be managed properly with OAuth flow
// For now, we'll use a static token stored in environment variables
const STRAVA_ACCESS_TOKEN = process.env.STRAVA_ACCESS_TOKEN;

export async function getJourneyActivities(startDate: string = '2023-01-01T00:00:00Z') {
  try {
    // Check if we have a token
    if (!STRAVA_ACCESS_TOKEN) {
      console.error('No Strava access token found');
      return getMockActivities(startDate);
    }
    
    // Set up the Strava API client
    const config = new Configuration({
      accessToken: STRAVA_ACCESS_TOKEN
    });
    
    const activitiesApi = new ActivitiesApi(config);
    
    // Convert start date to epoch timestamp (required by Strava API)
    const after = Math.floor(new Date(startDate).getTime() / 1000);
    
    // Fetch activities - handle pagination to get all activities since the start date
    const activities = await fetchAllActivities(activitiesApi, after);
    
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

// Helper function to fetch all activities with pagination
async function fetchAllActivities(
  api: ActivitiesApi, 
  after: number, 
  page = 1, 
  allActivities: SummaryActivity[] = []
): Promise<SummaryActivity[]> {
  try {
    const perPage = 200; // Maximum allowed by Strava API
    const response = await api.getLoggedInAthleteActivities(
      undefined, // before
      after,
      page,
      perPage
    );
    
    const newActivities = response.data || [];
    const activities = [...allActivities, ...newActivities];
    
    // If we got a full page, there might be more to fetch
    if (newActivities.length === perPage) {
      return fetchAllActivities(api, after, page + 1, activities);
    }
    
    return activities;
  } catch (error) {
    console.error('Error in pagination for Strava activities:', error);
    // Return what we've got so far
    return allActivities;
  }
}

// Fallback function to get mock data if API fails
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
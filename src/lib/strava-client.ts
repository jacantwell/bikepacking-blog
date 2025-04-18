import axios from 'axios';
import { SummaryActivity, DetailedActivity } from '@/services/strava/api';

/**
 * Strava API client for handling authentication and API requests
 */
export class StravaClient {
  private clientId: string;
  private clientSecret: string;
  private refreshToken: string;
  private accessToken: string | null = null;

  constructor(
    clientId?: string,
    clientSecret?: string,
    refreshToken?: string
  ) {
    // Use environment variables if not provided
    this.clientId = clientId || process.env.STRAVA_CLIENT_ID || '';
    this.clientSecret = clientSecret || process.env.STRAVA_CLIENT_SECRET || '';
    this.refreshToken = refreshToken || process.env.STRAVA_REFRESH_TOKEN || '';

    if (!this.clientId || !this.clientSecret || !this.refreshToken) {
      throw new Error('Missing Strava API credentials. Please set STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, and STRAVA_REFRESH_TOKEN environment variables.');
    }
  }

  /**
   * Get a fresh access token using the refresh token
   */
  private async getAccessToken(): Promise<string> {
    try {
      const response = await axios.post('https://www.strava.com/oauth/token', {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
        grant_type: 'refresh_token',
      });

      this.accessToken = response.data.access_token;
      return this.accessToken || "";
    } catch (error) {
      console.error('Failed to refresh Strava access token:', error);
      throw new Error('Failed to authenticate with Strava');
    }
  }

  /**
   * Make an authenticated request to the Strava API
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'PUT',
    endpoint: string,
    data?: any,
    params?: any
  ): Promise<T> {
    // Ensure we have an access token
    if (!this.accessToken) {
      await this.getAccessToken();
    }

    try {
      const url = `https://www.strava.com/api/v3/${endpoint}`;
      const headers = {
        'Authorization': `Bearer ${this.accessToken}`
      };

      const response = await axios.request<T>({
        method,
        url,
        data,
        params,
        headers
      });

      return response.data;
    } catch (error: any) {
      // If unauthorized, try refreshing the token once
      if (error.response && error.response.status === 401) {
        // Token expired, get a fresh one and retry
        await this.getAccessToken();
        
        const url = `https://www.strava.com/api/v3/${endpoint}`;
        const headers = {
          'Authorization': `Bearer ${this.accessToken}`
        };

        const response = await axios.request<T>({
          method,
          url,
          data,
          params,
          headers
        });
        
        return response.data;
      }
      
      // Other error, just throw
      throw error;
    }
  }

  /**
   * Get a list of activities with pagination
   */
  async getActivities(perPage: number = 30, page: number = 1): Promise<SummaryActivity[]> {
    return this.request<SummaryActivity[]>('GET', 'athlete/activities', undefined, {
      per_page: perPage,
      page: page
    });
  }

  /**
   * Get all activities after a certain date
   * This handles pagination automatically
   */
  async getAllActivitiesAfter(after: number): Promise<SummaryActivity[]> {
    let page = 1;
    const perPage = 200; // Maximum allowed by Strava
    let allActivities: SummaryActivity[] = [];
    let hasMoreActivities = true;

    while (hasMoreActivities) {
      const activities = await this.getActivities(perPage, page);
      
      if (activities.length === 0) {
        hasMoreActivities = false;
      } else {
        // Filter activities by date
        const filteredActivities = activities.filter(activity => {
          const activityTime = new Date(activity.start_date || '').getTime() / 1000;
          return activityTime >= after && activity.type === 'Ride';
        });
  
        allActivities = [...allActivities, ...filteredActivities];
        
        // Check if we got fewer activities than requested, which means we reached the end
        // Also check if the oldest activity is still after our "after" timestamp
        if (activities.length < perPage || 
            (activities.length > 0 && 
             new Date(activities[activities.length - 1].start_date || '').getTime() / 1000 < after)) {
          hasMoreActivities = false;
        } else {
          page++;
        }
      }
    }

    return allActivities;
  }

  /**
   * Get details of a specific activity
   */
  async getActivity(id: string | number): Promise<DetailedActivity> {
    return this.request<DetailedActivity>('GET', `activities/${id}`);
  }

  /**
   * Get the most recent activity
   */
  async getLatestActivity(): Promise<DetailedActivity> {
    const activities = await this.getActivities(1);
    if (activities.length === 0) {
      throw new Error('No activities found');
    }
    return this.getActivity(activities[0].id!);
  }
}
import axios from 'axios';

/**
 * TomTom REST API configuration and utility functions
 */
export class TomTomService {
  constructor() {
    this.apiKey = "d4088216-d1d1-43ef-811f-40bdb64c89d5";
    if (!this.apiKey) {
      console.warn("TomTom API key not found. Some features may not work.");
    }
    this.baseUrl = 'https://api.tomtom.com/routing/1';
  }

  /**
   * Get optimized route between multiple points
   * @param {Array} waypoints - Array of coordinates [{lat, lng}, ...]
   * @returns {Promise<Object>} Optimized route data
   */
  async getOptimizedRoute(waypoints) {
    if (!this.apiKey) {
      throw new Error("TomTom API key not configured");
    }
    if (!Array.isArray(waypoints) || waypoints.length < 2) {
      throw new Error("At least two waypoints required");
    }
    try {
      // TomTom expects lat,lon:lat,lon:... format
      const locations = waypoints.map(wp => `${wp.lat},${wp.lng}`).join(':');
      const url = `${this.baseUrl}/calculateRoute/${locations}/json`;
      const params = {
        key: this.apiKey,
        computeBestOrder: true,
        routeType: 'fastest',
        traffic: true,
        travelMode: 'car',
        instructionsType: 'text',
      };
      const response = await axios.get(url, { params });
      const route = response.data.routes[0];
      return {
        distance: route.summary.lengthInMeters,
        duration: route.summary.travelTimeInSeconds,
        optimizedWaypoints: waypoints, // TomTom REST API does not return best order, so this is a limitation
        polyline: route.legs.map(leg => leg.points),
        legs: route.legs
      };
    } catch (error) {
      console.error('TomTom REST API Error:', error?.response?.data || error);
      throw error;
    }
  }

  /**
   * Calculate distance and duration between two points
   * @param {Object} origin - {lat, lng}
   * @param {Object} destination - {lat, lng}
   * @returns {Promise<Object>} Distance and duration data
   */
  async getDistanceMatrix(origin, destination) {
    if (!this.apiKey) {
      throw new Error("TomTom API key not configured");
    }
    try {
      const locations = `${origin.lat},${origin.lng}:${destination.lat},${destination.lng}`;
      const url = `${this.baseUrl}/calculateRoute/${locations}/json`;
      const params = {
        key: this.apiKey,
        routeType: 'fastest',
        traffic: true,
        travelMode: 'car',
      };
      const response = await axios.get(url, { params });
      const route = response.data.routes[0];
      return {
        distance: route.summary.lengthInMeters,
        duration: route.summary.travelTimeInSeconds,
        mode: 'car'
      };
    } catch (error) {
      console.error('TomTom Distance Matrix REST API Error:', error?.response?.data || error);
      throw error;
    }
  }

  /**
   * Get estimated delivery time based on route
   * @param {Object} origin - Origin coordinates
   * @param {Object} destination - Destination coordinates
   * @param {Date} pickupTime - Estimated pickup time
   * @returns {Promise<Object>} Delivery time estimation
   */
  async getDeliveryTimeEstimate(origin, destination, pickupTime = new Date()) {
    try {
      const routeData = await this.getDistanceMatrix(origin, destination);
      const bufferMinutes = 15;
      const totalMinutes = Math.ceil(routeData.duration / 60) + bufferMinutes;
      const estimatedDeliveryTime = new Date(pickupTime.getTime() + (totalMinutes * 60 * 1000));
      return {
        estimatedDuration: { value: routeData.duration, text: `${Math.round(routeData.duration/60)} min` },
        estimatedDistance: { value: routeData.distance, text: `${(routeData.distance/1000).toFixed(2)} km` },
        pickupTime: pickupTime,
        estimatedDeliveryTime: estimatedDeliveryTime,
        totalMinutes: totalMinutes
      };
    } catch (error) {
      console.error('Delivery time estimation error:', error);
      throw error;
    }
  }
}

export default new TomTomService(); 
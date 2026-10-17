/**
 * Missing global public datasets — partner ports only.
 */

export interface UtilityNetworkPort {
  isConfigured(): boolean;
}

export interface TrafficFeedPort {
  isConfigured(): boolean;
}

export interface EmergencyOperationsPort {
  isConfigured(): boolean;
}

export class UnconfiguredUtilityNetwork implements UtilityNetworkPort {
  isConfigured(): boolean {
    return false;
  }
}

export class UnconfiguredTrafficFeed implements TrafficFeedPort {
  isConfigured(): boolean {
    return false;
  }
}

export class UnconfiguredEmergencyOperations implements EmergencyOperationsPort {
  isConfigured(): boolean {
    return false;
  }
}

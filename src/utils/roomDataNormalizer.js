/**
 * Normalizes room amenities data to ensure all values are booleans
 * Handles cases where amenities might be sent as objects (e.g., { icon: 'safe' })
 * 
 * @param {Object} amenities - The amenities object to normalize
 * @returns {Object} - Normalized amenities object with all boolean values
 */
function normalizeAmenities(amenities) {
  if (!amenities || typeof amenities !== 'object') {
    return {};
  }

  // Define all valid amenity keys from the Room schema
  const validAmenityKeys = ['wifi', 'ac', 'tv', 'minibar', 'balcony', 'seaView', 'roomService', 'safe'];
  const normalized = {};

  // Process each valid amenity key
  validAmenityKeys.forEach(key => {
    const value = amenities[key];
    
    if (value === undefined || value === null) {
      // If not provided, default to false
      normalized[key] = false;
    } else if (typeof value === 'boolean') {
      // Already a boolean, use as is
      normalized[key] = value;
    } else if (typeof value === 'object' && value !== null) {
      // If it's an object (like { icon: 'safe' }), treat as enabled
      normalized[key] = true;
    } else if (typeof value === 'string') {
      // Convert string to boolean
      normalized[key] = value === 'true' || value === '1';
    } else if (typeof value === 'number') {
      // Convert number to boolean (0 = false, anything else = true)
      normalized[key] = value !== 0;
    } else {
      // Fallback: convert to boolean
      normalized[key] = Boolean(value);
    }
  });

  return normalized;
}

/**
 * Normalizes room update data to ensure amenities are properly formatted
 * 
 * @param {Object} roomData - The room data to normalize
 * @returns {Object} - Normalized room data
 */
function normalizeRoomUpdateData(roomData) {
  const normalized = { ...roomData };

  // Normalize amenities if present
  if (normalized.amenities) {
    normalized.amenities = normalizeAmenities(normalized.amenities);
  }

  return normalized;
}

module.exports = {
  normalizeAmenities,
  normalizeRoomUpdateData
};


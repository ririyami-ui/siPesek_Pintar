/**
 * Generates a simple hash string for a given data object.
 * This is used to create unique cache keys based on the actual content of the data.
 * @param {any} data - The data to hash (object, array, string, etc.)
 * @returns {string} - A string representation of the hash.
 */
export const generateDataHash = (data) => {
    try {
        const str = JSON.stringify(data);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(36);
    } catch (e) {
        console.error("Hashing failed:", e);
        return Date.now().toString(36); // Fallback to time if stringify fails
    }
};

import { toJavanese } from 'carakanjs';

/**
 * Transliterates Latin text to Javanese Script (Hanacaraka).
 * @param {string} text - The Latin text to transliterate.
 * @returns {string} The transliterated Javanese script.
 */
export const toHanacaraka = (text) => {
    if (!text) return '';
    try {
        return toJavanese(text);
    } catch (error) {
        console.error('Transliteration error:', error);
        return text;
    }
};

/**
 * Checks if a subject is a regional language and returns the region.
 * @param {string} subject - The subject name.
 * @returns {string|null} The region name (e.g., 'Jawa', 'Sunda') or null.
 */
export const getRegionFromSubject = (subject) => {
    if (!subject) return null;
    const match = subject.match(/bahasa daerah\s*\(([^)]+)\)/i);
    return match ? match[1] : null;
};

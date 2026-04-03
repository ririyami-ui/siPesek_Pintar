import axios from 'axios';

// Get base URL from detected Laravel global
const baseURL = window.Laravel?.apiBaseUrl || '/api';
console.log('Axios baseURL:', baseURL);

const api = axios.create({
    baseURL: baseURL,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
    withCredentials: true, // For Sanctum CSRF protection
});

// Request interceptor
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor
api.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        if (error.response && error.response.status === 401) {
            localStorage.removeItem('token');
            const baseUrl = window.Laravel?.baseUrl || '';
            // If baseUrl is empty or just '/', use relative path
            const target = (baseUrl && baseUrl !== '/') ? (baseUrl + '/login') : '/login';
            window.location.href = target;
        }
        
        if (error.response && error.response.status === 403) {
            // Forbidden access - user is logged in but doesn't have permission
            // Instead of window.location.href (which reloads the app), we should let the UI handle it
            // or redirect to the root which will then decide the correct dashboard based on role
            console.error('Access Forbidden: User does not have required permissions');
        }
        
        return Promise.reject(error);
    }
);

export default api;

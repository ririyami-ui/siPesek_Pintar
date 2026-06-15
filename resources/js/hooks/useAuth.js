import { useState, useEffect } from 'react';
import api from '../lib/axios';

export const useAuth = () => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem('token');
            if (token) {
                try {
                    const response = await api.get('/me');
                    setUser(response.data);
                } catch (error) {
                    setUser(null);
                }
            }
            setLoading(false);
        };
        checkAuth();
    }, []);

    return { user, loading };
};

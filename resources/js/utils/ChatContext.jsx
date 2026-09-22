import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import api from '../lib/axios';

const STORAGE_KEY = 'smart-school-chat-history';
const MAX_HISTORY = 50;

const ChatContext = createContext();

export const useChat = () => useContext(ChatContext);

export const ChatProvider = ({ children }) => {
  const [chatHistory, setChatHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isThinking, setIsThinking] = useState(false);

  // Load chat history from localStorage on mount (optional, to maintain session)
  useEffect(() => {
    const savedChat = localStorage.getItem(STORAGE_KEY);
    if (savedChat) {
      try {
        const parsed = JSON.parse(savedChat);
        setChatHistory(Array.isArray(parsed) ? parsed.slice(-MAX_HISTORY) : []);
      } catch (e) {
        console.error("Failed to parse chat history", e);
      }
    }
  }, []);

  // Save chat history to localStorage when it changes
  useEffect(() => {
    if (chatHistory.length > 0) {
      try {
        const persisted = chatHistory.slice(-MAX_HISTORY).map((message) => {
          if (!message || typeof message !== 'object' || !('image' in message)) {
            return message;
          }
          const { image, ...rest } = message;
          return rest;
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
      } catch (e) {
        console.error("Failed to save chat history", e);
      }
    }
  }, [chatHistory]);

  const addMessageToHistory = useCallback((message) => {
    setChatHistory(prev => {
      const next = [...prev, message];
      return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
    });
  }, []);

  const clearChat = useCallback(() => {
    setChatHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo(() => ({
    chatHistory,
    setChatHistory,
    loadingHistory,
    addMessageToHistory,
    isThinking,
    setIsThinking,
    clearChat,
  }), [chatHistory, setChatHistory, loadingHistory, addMessageToHistory, isThinking, setIsThinking, clearChat]);

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};
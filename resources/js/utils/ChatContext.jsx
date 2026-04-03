import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../lib/axios';

const ChatContext = createContext();

export const useChat = () => useContext(ChatContext);

export const ChatProvider = ({ children }) => {
  const [chatHistory, setChatHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isThinking, setIsThinking] = useState(false);

  // Load chat history from localStorage on mount (optional, to maintain session)
  useEffect(() => {
    const savedChat = localStorage.getItem('smart-school-chat-history');
    if (savedChat) {
      try {
        setChatHistory(JSON.parse(savedChat));
      } catch (e) {
        console.error("Failed to parse chat history", e);
      }
    }
  }, []);

  // Save chat history to localStorage when it changes
  useEffect(() => {
    if (chatHistory.length > 0) {
      localStorage.setItem('smart-school-chat-history', JSON.stringify(chatHistory));
    }
  }, [chatHistory]);

  const addMessageToHistory = (message) => {
    setChatHistory(prev => [...prev, message]);
  };

  const clearChat = () => {
    setChatHistory([]);
    localStorage.removeItem('smart-school-chat-history');
  };

  const value = {
    chatHistory,
    setChatHistory,
    loadingHistory,
    addMessageToHistory,
    isThinking,
    setIsThinking,
    clearChat,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};
import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Sparkles } from 'lucide-react';
import { polishJournalText } from '../utils/gemini';
import toast from 'react-hot-toast';

import { useSettings } from '../utils/SettingsContext';

const StyledInput = ({ 
  label, 
  type = 'text', 
  voiceEnabled = false, 
  onPolish, 
  containerClassName,
  className,
  ...props 
}) => {
  const { geminiModel } = useSettings();
  const [isListening, setIsListening] = useState(false);
  const [isPolishing, setIsPolishing] = useState(false);
  const [recognition, setRecognition] = useState(null);

  useEffect(() => {
    if (voiceEnabled && window.ActiveXObject === undefined && (window.SpeechRecognition || window.webkitSpeechRecognition)) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recog = new SpeechRecognition();
      recog.continuous = false;
      recog.interimResults = false;
      recog.lang = 'id-ID';

      recog.onstart = () => setIsListening(true);
      recog.onend = () => setIsListening(false);
      recog.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
        toast.error('Gagal merekam suara: ' + event.error);
      };

      recog.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (props.onChange) {
          const fakeEvent = {
            target: {
              value: props.value ? `${props.value} ${transcript}` : transcript,
              name: props.name
            }
          };
          props.onChange(fakeEvent);
        }
      };

      setRecognition(recog);
    }
  }, [voiceEnabled, props.value, props.onChange, props.name]);

  const toggleListening = () => {
    if (!recognition) {
      toast.error('Browser Anda tidak mendukung perekaman suara.');
      return;
    }
    if (isListening) {
      recognition.stop();
    } else {
      recognition.start();
    }
  };

  const handlePolish = async () => {
    if (!props.value) return;
    setIsPolishing(true);
    try {
      const polished = await polishJournalText(props.value, geminiModel);
      if (props.onChange) {
        props.onChange({
          target: {
            value: polished,
            name: props.name
          }
        });
      }
      toast.success('Teks telah dirapikan oleh AI!');
    } catch (error) {
      toast.error('Gagal merapikan teks.');
    } finally {
      setIsPolishing(false);
    }
  };

  const inputClasses = `w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all dark:text-white placeholder-gray-400 ${className || ''}`;

  return (
    <div className={`space-y-1.5 ${containerClassName || 'w-full'}`}>
      {label && <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">{label}</label>}
      <div className="relative group">
        {type === 'textarea' ? (
          <textarea
            {...props}
            className={`${inputClasses} min-h-[100px] resize-y pr-12`}
          />
        ) : (
          <input
            {...props}
            type={type}
            className={`${inputClasses} ${voiceEnabled ? 'pr-12' : ''}`}
          />
        )}

        {voiceEnabled && (
          <div className="absolute right-2 top-2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity focus-within:opacity-100">
            <button
              type="button"
              onClick={toggleListening}
              className={`p-1.5 rounded-lg transition-colors ${isListening ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-600 dark:text-gray-400 dark:hover:bg-gray-500'}`}
              title={isListening ? "Berhenti merekam" : "Mulai merekam suara"}
            >
              {isListening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
            {props.value && (
              <button
                type="button"
                onClick={handlePolish}
                disabled={isPolishing}
                className={`p-1.5 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-900/60 transition-colors ${isPolishing ? 'animate-spin' : ''}`}
                title="Rapikan dengan AI"
              >
                <Sparkles size={16} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StyledInput;

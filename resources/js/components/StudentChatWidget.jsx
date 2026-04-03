import React, { useState, useEffect, useRef } from 'react';
import { Bot, X, Send, MessageCircle } from 'lucide-react';
import api from '../lib/axios';

const StudentChatWidget = () => {
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [messages, setMessages] = useState([
        { role: 'ai', text: 'Halo Ayah/Bunda! 👋 Senang sekali bisa menyapa hari ini. Saya Si Pintar, asisten AI yang siap jadi teman ngobrol seputar perkembangan belajar Ananda di sekolah. Ada yang bisa Si Pintar bantu cari infonya? 😊' }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const chatEndRef = useRef(null);

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (isChatOpen) scrollToBottom();
    }, [messages, isChatOpen]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim() || isTyping) return;

        const userMsg = { role: 'user', text: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsTyping(true);

        try {
            const res = await api.post('/student/chat', {
                message: input,
                history: messages.slice(-6).map(m => ({
                    role: m.role === 'ai' ? 'model' : 'user',
                    parts: [{ text: m.text }]
                }))
            });
            setMessages(prev => [...prev, { role: 'ai', text: res.data.response }]);
        } catch (err) {
            setMessages(prev => [...prev, { role: 'ai', text: 'Waduh, koneksi saya agak terganggu nih Pak/Bu. Coba tanya lagi ya? 🙏' }]);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <div className="fixed bottom-[calc(80px+env(safe-area-inset-bottom,0px))] lg:bottom-10 right-4 sm:right-6 z-[100] flex flex-col items-end gap-4 pointer-events-none">
            {/* Chat Window */}
            {isChatOpen && (
                <div className="pointer-events-auto w-[calc(100vw-2rem)] sm:w-[380px] h-[550px] max-h-[calc(100vh-160px)] bg-white dark:bg-slate-900 rounded-[2rem] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.3)] border border-slate-100 dark:border-white/10 flex flex-col overflow-hidden animate-fade-in-up">
                    {/* Header */}
                    <div className="p-5 bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-between shrink-0 relative z-[100] shadow-lg shadow-emerald-600/10">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md">
                                <Bot size={22} className="text-white" />
                            </div>
                            <div>
                                <p className="font-black text-sm tracking-tight leading-none mb-1">Si Pintar</p>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse shadow-[0_0_8px_rgba(110,231,183,0.5)]" />
                                    <p className="text-[9px] font-black opacity-80 uppercase tracking-[0.15em] text-emerald-50">AI Assistant Online</p>
                                </div>
                            </div>
                        </div>
                        <button 
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsChatOpen(false);
                            }}
                            className="p-2.5 -mr-1 hover:bg-white/20 rounded-2xl transition-all active:scale-90 cursor-pointer relative z-[110]"
                            aria-label="Tutup Chat"
                        >
                            <X size={20} className="text-white" />
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-5 no-scrollbar bg-slate-50/50 dark:bg-black/20">
                        {messages.map((m, i) => (
                            <div key={i} className={`flex ${m.role === 'ai' ? 'justify-start' : 'justify-end'} animate-fade-in-up`} style={{ animationDelay: `${i * 50}ms` }}>
                                <div className={`max-w-[85%] p-4 rounded-2xl text-[13px] shadow-sm leading-relaxed ${
                                    m.role === 'ai' 
                                        ? 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-tl-none border border-slate-100 dark:border-white/5 font-medium' 
                                        : 'bg-emerald-600 text-white rounded-tr-none shadow-md shadow-emerald-600/20 font-bold'
                                }`}>
                                    <p>{m.text}</p>
                                </div>
                            </div>
                        ))}
                        {isTyping && (
                            <div className="flex justify-start">
                                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl rounded-tl-none border border-slate-100 dark:border-white/5 shadow-sm">
                                    <div className="flex gap-1.5">
                                        <div className="w-2 h-2 bg-emerald-500/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <div className="w-2 h-2 bg-emerald-500/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <div className="w-2 h-2 bg-emerald-500/80 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Input Area */}
                    <form onSubmit={handleSendMessage} className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-white/5 shrink-0">
                        <div className="relative flex items-center gap-2">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="Tanya perkembangan anak..."
                                    disabled={isTyping}
                                    className="w-full bg-slate-100 dark:bg-slate-800 border-2 border-transparent focus:border-emerald-500/30 rounded-2xl py-3 pl-4 pr-12 text-sm font-bold text-slate-700 dark:text-white focus:ring-4 focus:ring-emerald-500/10 transition-all placeholder:text-slate-400 placeholder:font-medium"
                                />
                                <button
                                    type="submit"
                                    disabled={isTyping || !input.trim()}
                                    className="absolute right-1.5 top-1.5 bottom-1.5 px-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:scale-95 active:scale-90 flex items-center justify-center shadow-md shadow-emerald-600/20"
                                >
                                    <Send size={18} />
                                </button>
                            </div>
                        </div>
                        <p className="text-[10px] text-center text-slate-400 mt-3 font-bold uppercase tracking-widest opacity-60">Hanya menjawab seputar data akademik siswa</p>
                    </form>
                </div>
            )}

            {/* Floating Button */}
            {!isChatOpen && (
                <button
                    onClick={() => setIsChatOpen(true)}
                    className="pointer-events-auto group relative w-14 h-14 bg-emerald-600 text-white rounded-2xl shadow-xl shadow-emerald-600/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-500 backdrop-blur-md border border-white/20"
                >
                    <div className="absolute inset-0 bg-emerald-400 rounded-2xl animate-ping opacity-10 group-hover:opacity-30" />
                    <div className="absolute inset-0 bg-gradient-to-tr from-emerald-600 to-teal-500 rounded-2xl opacity-100" />
                    <MessageCircle size={24} className="relative z-10 opacity-100 group-hover:rotate-12 transition-transform duration-500" />
                    
                    {/* Notification Badge */}
                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 border-2 border-white dark:border-slate-900 rounded-full flex items-center justify-center animate-bounce shadow-lg">
                        <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    </div>
                </button>
            )}
        </div>
    );
};

export default StudentChatWidget;


import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Transaction, Account, Loan, Plan, Category } from '../../types';
import { createChatSession, formatFinancialData } from '../../services/ai';
import { Chat, GenerateContentResponse } from "@google/genai";
import Spinner from '../ui/Spinner';
import { useLanguage } from '../../contexts/LanguageContext';

interface Message {
    id: string;
    role: 'user' | 'model';
    text: string;
}

const AIPage: React.FC = () => {
    const { user } = useAuth();
    const { t } = useLanguage();
    
    // Data State
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loans, setLoans] = useState<Loan[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [dataLoaded, setDataLoaded] = useState(false);

    // Chat State
    const [chatSession, setChatSession] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // 1. Fetch Data on Mount
    useEffect(() => {
        const fetchFinancialData = async () => {
            if (!user) return;
            try {
                // Fetch Accounts
                const accSnap = await getDocs(collection(db, `users/${user.uid}/accounts`));
                const accData = accSnap.docs.map(d => ({ id: d.id, ...d.data() } as Account));
                setAccounts(accData);

                // Fetch Categories
                const catSnap = await getDocs(collection(db, `users/${user.uid}/categories`));
                const catData = catSnap.docs.map(d => ({ id: d.id, ...d.data() } as Category));
                setCategories(catData);

                // Fetch Plans
                const planSnap = await getDocs(collection(db, `users/${user.uid}/plans`));
                const planData = planSnap.docs.map(d => ({ id: d.id, ...d.data() } as Plan));
                setPlans(planData);

                // Fetch Loans
                const loanSnap = await getDocs(collection(db, `users/${user.uid}/loans`));
                const loanData = loanSnap.docs.map(d => ({ id: d.id, ...d.data() } as Loan));
                setLoans(loanData);

                // Fetch Transactions (Current Month)
                const now = new Date();
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                const txQuery = query(
                    collection(db, `users/${user.uid}/transactions`),
                    where('date', '>=', Timestamp.fromDate(startOfMonth))
                );
                const txSnap = await getDocs(txQuery);
                const txData = txSnap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
                setTransactions(txData);

                setDataLoaded(true);
            } catch (e) {
                console.error("Failed to fetch data for AI", e);
            }
        };

        fetchFinancialData();
    }, [user]);

    // 2. Initialize Chat
    useEffect(() => {
        if (dataLoaded) {
            const chat = createChatSession();
            setChatSession(chat);
            
            // Add initial greeting
            setMessages([{
                id: 'init',
                role: 'model',
                text: "Hệ thống Vệ binh Tài chính (Fin-Sentinel) đã kích hoạt. Tôi đã sẵn sàng bảo vệ nguồn tiền của bạn. Bạn có muốn tôi thực hiện kiểm toán tài chính tháng này ngay không?"
            }]);
        }
    }, [dataLoaded]);

    // 3. Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = async (textOverride?: string) => {
        const messageText = textOverride || input.trim();
        if (!messageText || !chatSession) return;

        // Add User Message
        const userMsg: Message = { id: Date.now().toString(), role: 'user', text: messageText };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsTyping(true);

        try {
            // If this is the first time asking for analysis, inject data
            let promptToSend = messageText;
            
            // Heuristic: If user asks for "report", "analyze", "kiểm toán", inject data context
            if (messageText.toLowerCase().includes('kiểm toán') || 
                messageText.toLowerCase().includes('báo cáo') || 
                messageText.toLowerCase().includes('tình hình') ||
                messageText.toLowerCase().includes('audit')) {
                
                const financialContext = formatFinancialData(transactions, accounts, plans, loans, categories);
                promptToSend = `${financialContext}\n\n${messageText}`;
            }

            const result = await chatSession.sendMessageStream({ message: promptToSend });
            
            // Prepare placeholder for streaming response
            const botMsgId = (Date.now() + 1).toString();
            setMessages(prev => [...prev, { id: botMsgId, role: 'model', text: '' }]);

            let fullText = '';
            for await (const chunk of result) {
                const c = chunk as GenerateContentResponse;
                const chunkText = c.text || '';
                fullText += chunkText;
                
                setMessages(prev => prev.map(msg => 
                    msg.id === botMsgId ? { ...msg, text: fullText } : msg
                ));
            }
        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: "⚠️ Kết nối bị gián đoạn. Vui lòng thử lại." }]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleAuditClick = () => {
        handleSend("Hãy thực hiện kiểm toán tài chính tháng này và lập báo cáo tình trạng.");
    };

    if (!dataLoaded) return <div className="flex h-full items-center justify-center"><Spinner /></div>;

    return (
        <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-900 relative">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 p-4 shadow-sm border-b dark:border-gray-700 z-10 flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <span className="text-2xl">🛡️</span> Fin-Sentinel AI
                    </h1>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Senior Financial Analyst</p>
                </div>
                <button 
                    onClick={handleAuditClick}
                    className="bg-red-600 hover:bg-red-700 text-white text-sm font-bold py-2 px-3 rounded shadow animate-pulse"
                >
                    🚨 Audit Ngay
                </button>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl p-4 shadow-sm whitespace-pre-wrap ${
                            msg.role === 'user' 
                                ? 'bg-blue-600 text-white rounded-br-none' 
                                : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-none border dark:border-gray-700'
                        }`}>
                            {msg.text}
                        </div>
                    </div>
                ))}
                {isTyping && (
                     <div className="flex justify-start">
                        <div className="bg-white dark:bg-gray-800 p-3 rounded-2xl rounded-bl-none shadow-sm border dark:border-gray-700">
                            <div className="flex space-x-1">
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 p-3 border-t dark:border-gray-700">
                <form 
                    onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                    className="flex items-center gap-2 max-w-4xl mx-auto"
                >
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Hỏi về tài chính, xin lời khuyên..."
                        className="flex-1 p-3 rounded-full border dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button 
                        type="submit" 
                        disabled={!input.trim() || isTyping}
                        className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full disabled:bg-blue-300 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                        </svg>
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AIPage;

'use client';

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

import React, { useState, useRef, useEffect } from 'react';
import { useFinanceStore } from '../../store/useFinanceStore';
import { Send, Sparkles, Trash2, ArrowRight, HelpCircle, X } from 'lucide-react';

interface CommandCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandCenter: React.FC<CommandCenterProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const { 
    chatHistory, 
    addChatMessage, 
    clearChatHistory, 
    setData, 
    setMetrics,
    setQualityIssues,
    setLoading, 
    isLoading 
  } = useFinanceStore();

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll chat history to the bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const refreshState = async () => {
    try {
      const dataRes = await fetch(`${API_URL}/data`);
      if (dataRes.ok) setData(await dataRes.json());
      
      const metricsRes = await fetch(`${API_URL}/metrics`);
      if (metricsRes.ok) setMetrics(await metricsRes.json());

      const issuesRes = await fetch(`${API_URL}/quality-issues`);
      if (issuesRes.ok) setQualityIssues(await issuesRes.json());
    } catch (e) {
      console.error(e);
    }
  };

  const handleSend = async (customQuery?: string) => {
    const textToSend = customQuery || query;
    if (!textToSend.trim()) return;

    // 1. Add User message to chat
    addChatMessage({ sender: 'user', text: textToSend });
    if (!customQuery) setQuery('');
    setLoading(true);

    try {
      // 2. Call FastAPI chat intelligence engine
      const chatRes = await fetch(`${API_URL}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: textToSend })
      });
      
      if (!chatRes.ok) {
        throw new Error("API Connection Error");
      }

      const chatResult = await chatRes.json();
      
      // 3. Add Copilot response
      addChatMessage({ sender: 'copilot', text: chatResult.response });

      // 4. Check if an actionable transaction modifier tool was triggered!
      if (chatResult.action) {
        const actionRes = await fetch(`${API_URL}/ai/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tool: chatResult.action.tool,
            params: chatResult.action.params
          })
        });

        if (actionRes.ok) {
          const actionResult = await actionRes.json();
          // Update store directly with purified dataset returned by backend!
          if (actionResult.data) {
            setData(actionResult.data);
            addChatMessage({ 
              sender: 'copilot', 
              text: `⚡ **Live Update Executed:** ${actionResult.message}. The dashboard, ledger grids, and metrics recalculated successfully in real-time!`
            });
            // Re-fetch standard metrics and forecasts
            await refreshState();
          }
        } else {
          addChatMessage({
            sender: 'copilot',
            text: '❌ There was an error executing this transaction action. Verify backend validations.'
          });
        }
      }
    } catch (e) {
      console.error(e);
      addChatMessage({
        sender: 'copilot',
        text: `❌ Could not establish connection to the AI Co-Pilot control plane. Please verify that FastAPI is running on \`${API_URL}\`.`
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePillClick = (suggestion: string) => {
    handleSend(suggestion);
  };

  return (
    <div className={`border-l border-borderDark bg-[#0A0E1A] h-screen sticky top-0 shrink-0 flex flex-col justify-between print:hidden transition-all duration-300 ease-in-out ${
      isOpen ? 'w-96 opacity-100' : 'w-0 opacity-0 overflow-hidden border-l-0'
    }`}>
      {/* Sidebar Header */}
      <div className='p-6 border-b border-borderDark/40 flex justify-between items-center bg-[#0C1222]'>
        <h2 className='text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2'>
          <span className='w-2 h-2 bg-indigo-400 rounded-full animate-pulse shadow-glowPurple'></span>
          AI Co-Pilot Control Plane
        </h2>
        <div className='flex items-center gap-1'>
          <button 
            onClick={clearChatHistory}
            title='Clear Chat History'
            className='p-1.5 hover:bg-[#12192A] rounded-lg text-slate-400 hover:text-slate-200 transition-colors'
          >
            <Trash2 className='w-3.5 h-3.5' />
          </button>
          <button 
            onClick={onClose}
            title='Close Panel'
            className='p-1.5 hover:bg-[#12192A] rounded-lg text-slate-400 hover:text-slate-200 transition-colors'
          >
            <X className='w-3.5 h-3.5' />
          </button>
        </div>
      </div>

      {/* Message Feed Grid */}
      <div className='flex-1 overflow-y-auto p-6 space-y-4 text-xs scroll-smooth bg-[#080C16]'>
        {chatHistory.map((msg, i) => (
          <div 
            key={i} 
            className={`flex flex-col max-w-[85%] ${msg.sender === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'}`}
          >
            <div className={`p-3 rounded-2xl leading-relaxed font-medium ${
              msg.sender === 'user' 
                ? 'bg-indigo-600 text-white rounded-br-none shadow-glowPurple' 
                : 'bg-[#0D1322] border border-borderDark/60 text-slate-300 rounded-bl-none'
            }`}>
              {/* Render markdown style line breaks and bold keywords */}
              {msg.text.split('\n').map((line, l) => {
                if (!line.trim() && l !== 0) return <div key={l} className="h-1.5"></div>;
                const isH3 = line.startsWith('### ');
                const isH4 = line.startsWith('#### ');
                const isList = line.startsWith('- ');
                
                let content = line;
                if (isH3) content = content.replace('### ', '');
                if (isH4) content = content.replace('#### ', '');
                if (isList) content = content.replace('- ', '');

                const parsedLine = content.split('**').map((chunk, c) => (
                  c % 2 === 1 ? <strong key={c} className='text-white font-bold'>{chunk}</strong> : chunk
                ));

                if (isH3) return <h3 key={l} className="text-sm font-extrabold text-white mt-3 mb-1.5 border-b border-borderDark/40 pb-1.5 leading-snug">{parsedLine}</h3>;
                if (isH4) return <h4 key={l} className="text-xs font-bold text-indigo-300 mt-2.5 mb-1">{parsedLine}</h4>;
                if (isList) return <div key={l} className="ml-1.5 mt-1.5 flex gap-2"><span className="text-indigo-400 font-bold shrink-0">•</span><span className="leading-relaxed">{parsedLine}</span></div>;
                
                return <p key={l} className={l > 0 ? 'mt-1.5 leading-relaxed' : 'leading-relaxed'}>{parsedLine}</p>;
              })}
            </div>
            <span className='text-3xs text-slate-500 mt-1 uppercase font-semibold tracking-wider px-1'>{msg.timestamp}</span>
          </div>
        ))}
        {isLoading && (
          <div className='flex items-center gap-2 text-slate-500 italic mr-auto p-1'>
            <span className='w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping'></span>
            AI is analyzing database directives...
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Suggested Pill Commands */}
      <div className='px-6 py-4 bg-[#080C16] border-t border-borderDark/20 space-y-2'>
        <p className='text-3xs font-extrabold uppercase text-slate-500 tracking-wider flex items-center gap-1.5'>
          <Sparkles className='w-3 h-3 text-indigo-400' />
          Actionable Directives
        </p>
        <div className='flex flex-wrap gap-1.5'>
          {[
            'Flag expenses over ₹50,000 as High Risk',
            'Categorize Google as Cloud Infrastructure',
            'Clean duplicate rows',
            'Reset ledger'
          ].map((pill, p) => (
            <button
              key={p}
              onClick={() => handlePillClick(pill)}
              disabled={isLoading}
              className='text-3xs bg-[#0D1322] border border-borderDark hover:border-indigo-500/40 text-slate-400 hover:text-slate-200 px-2.5 py-1.5 rounded-full transition-all text-left font-medium disabled:opacity-40'
            >
              {pill}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Prompt Footer */}
      <div className='p-6 bg-[#0D1222] border-t border-borderDark/40 flex items-center gap-3'>
        <form 
          className='relative flex-1'
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
        >
          <input 
            className='w-full bg-[#080B15] border border-borderDark rounded-xl py-3 pl-4 pr-12 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-all font-medium'
            placeholder='Type a question or transaction command...'
            value={query}
            disabled={isLoading}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button 
            type="submit"
            disabled={isLoading || !query.trim()}
            className='absolute right-2 top-2 p-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg transition-colors shadow-glowPurple'
          >
            <Send className='w-3 h-3' />
          </button>
        </form>
      </div>
    </div>
  );
};

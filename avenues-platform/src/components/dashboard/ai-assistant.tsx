'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MessageCircle, X, Send, Bot, User, Sparkles } from 'lucide-react';
import { useStore, getLatestNonZeroIndex } from '@/store';
import { formatCurrency, formatNumber } from '@/lib/utils';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const GREETINGS = [
  "Hello! I'm Avenues Intelligence. Ask me anything about your clinical or financial data.",
  "Hi there! I can answer questions about revenue, admissions, occupancy, claims, and more.",
  "Welcome! Try asking me: 'What was total revenue?' or 'How are admissions trending?'"
];

export function AiAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: GREETINGS[Math.floor(Math.random() * GREETINGS.length)],
      timestamp: new Date(),
    }
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const years = useStore((state) => state.years);
  const currentYear = useStore((state) => state.currentYear);

  // Build a knowledge base from the current year's data
  const knowledge = useMemo(() => {
    const data = years.get(currentYear);
    if (!data) return null;

    const dash = data.dashboard;
    const loc = data.location;
    const claims = data.claims;

    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Revenue
    const totalRevenue = dash?.totalRevenue || 0;
    const monthRevenue = dash?.monthRevenue || [];
    const bestRevenueMonth = monthRevenue.length > 0
      ? MONTHS[monthRevenue.indexOf(Math.max(...monthRevenue.filter(v => v > 0)))] || 'N/A'
      : 'N/A';
    const worstRevenueMonth = monthRevenue.length > 0
      ? MONTHS[monthRevenue.indexOf(Math.min(...monthRevenue.filter(v => v > 0)))] || 'N/A'
      : 'N/A';

    // Admissions
    const casualty = dash?.admCasualty || [];
    const inpatient = dash?.admInpatient || [];
    const day = dash?.admDay || [];
    const totalCasualty = casualty.reduce((s, v) => s + v, 0);
    const totalInpatient = inpatient.reduce((s, v) => s + v, 0);
    const totalDay = day.reduce((s, v) => s + v, 0);
    const totalAdmissions = totalCasualty + totalInpatient + totalDay;

    // Theatre
    const theatreCases = dash?.theatreCases || [];
    const totalTheatre = theatreCases.reduce((s, v) => s + v, 0);

    // Pharmacy
    const pharmacyRx = dash?.pharmacyRx || [];
    const totalRx = pharmacyRx.reduce((s, v) => s + v, 0);

    // Occupancy
    const occupancy = dash?.occupancyBeds || [];
    const lastOccIdx = getLatestNonZeroIndex(occupancy);
    const currentOccupancy = lastOccIdx >= 0 ? occupancy[lastOccIdx] : 0;

    // Episodes
    const epsFinalised = dash?.epsFinalised || [];
    const totalEps = epsFinalised.reduce((s, v) => s + v, 0);

    // Claims
    const totalClaims = claims?.totalClaims || 0;
    const totalClaimed = claims?.totalClaimed || 0;
    const approved = claims?.approved || 0;
    const rejected = claims?.rejected || 0;
    const pending = claims?.pending || 0;

    // Location
    const totalDoctors = loc?.doctors?.length || 0;
    const topDoctor = loc?.doctors?.[0];
    const totalLocationEpisodes = loc?.episodes || 0;

    return {
      year: currentYear,
      totalRevenue, monthRevenue, bestRevenueMonth, worstRevenueMonth,
      totalAdmissions, totalCasualty, totalInpatient, totalDay,
      totalTheatre, totalRx, currentOccupancy,
      totalEps, totalClaims, totalClaimed, approved, rejected, pending,
      totalDoctors, topDoctor, totalLocationEpisodes,
      MONTHS,
    };
  }, [years, currentYear]);

  // Heuristic NLP: match keywords to data answers
  const generateResponse = (query: string): string => {
    if (!knowledge) {
      return "I don't have any data loaded yet. Please upload your CSV files first via the Upload page.";
    }

    const q = query.toLowerCase().trim();

    // Revenue questions
    if (q.includes('revenue') || q.includes('income') || q.includes('earned') || q.includes('money')) {
      if (q.includes('best') || q.includes('highest') || q.includes('top month')) {
        return `📈 The **best revenue month** in ${knowledge.year} was **${knowledge.bestRevenueMonth}** with ${formatCurrency(Math.max(...knowledge.monthRevenue.filter(v => v > 0)))}.`;
      }
      if (q.includes('worst') || q.includes('lowest') || q.includes('least')) {
        return `📉 The **weakest revenue month** in ${knowledge.year} was **${knowledge.worstRevenueMonth}** with ${formatCurrency(Math.min(...knowledge.monthRevenue.filter(v => v > 0)))}.`;
      }
      if (q.includes('trend') || q.includes('trending')) {
        const nonZero = knowledge.monthRevenue.filter(v => v > 0);
        if (nonZero.length >= 2) {
          const recent = nonZero[nonZero.length - 1];
          const prior = nonZero[nonZero.length - 2];
          const pctChange = ((recent - prior) / prior * 100).toFixed(1);
          const direction = recent > prior ? 'up' : 'down';
          return `📊 Revenue is trending **${direction} ${Math.abs(Number(pctChange))}%** month-over-month. Latest month: ${formatCurrency(recent)}, prior month: ${formatCurrency(prior)}.`;
        }
      }
      return `💰 **Total Revenue** for ${knowledge.year}: **${formatCurrency(knowledge.totalRevenue)}**.\n\nBest month: ${knowledge.bestRevenueMonth} | Weakest month: ${knowledge.worstRevenueMonth}.`;
    }

    // Admissions
    if (q.includes('admission') || q.includes('admitted') || q.includes('casualty') || q.includes('inpatient')) {
      if (q.includes('casualty')) {
        return `🏥 **Casualty admissions** in ${knowledge.year}: **${formatNumber(knowledge.totalCasualty)}** patients.`;
      }
      if (q.includes('inpatient') || q.includes('in-patient')) {
        return `🛏️ **Inpatient admissions** in ${knowledge.year}: **${formatNumber(knowledge.totalInpatient)}** patients.`;
      }
      return `📋 **Total Admissions** for ${knowledge.year}: **${formatNumber(knowledge.totalAdmissions)}**\n\n- Casualty: ${formatNumber(knowledge.totalCasualty)}\n- Inpatient: ${formatNumber(knowledge.totalInpatient)}\n- Day: ${formatNumber(knowledge.totalDay)}`;
    }

    // Occupancy
    if (q.includes('occupancy') || q.includes('capacity') || q.includes('beds') || q.includes('full')) {
      const level = knowledge.currentOccupancy > 90 ? '⚠️ Critical' : knowledge.currentOccupancy > 75 ? '🟡 Moderate' : '🟢 Healthy';
      return `🏥 **Current Ward Occupancy**: **${knowledge.currentOccupancy.toFixed(1)}%** (${level})\n\nThis represents the most recent period's average bed occupancy across all wards.`;
    }

    // Theatre
    if (q.includes('theatre') || q.includes('theater') || q.includes('surgery') || q.includes('surgical')) {
      return `🔬 **Total Theatre Cases** for ${knowledge.year}: **${formatNumber(knowledge.totalTheatre)}** procedures completed.`;
    }

    // Pharmacy
    if (q.includes('pharmacy') || q.includes('prescription') || q.includes('medication') || q.includes('drug')) {
      return `💊 **Total Prescriptions Dispensed** in ${knowledge.year}: **${formatNumber(knowledge.totalRx)}** scripts filled.`;
    }

    // Claims
    if (q.includes('claim') || q.includes('medical aid') || q.includes('apac') || q.includes('insurance')) {
      if (q.includes('reject')) {
        const rejRate = knowledge.totalClaims > 0 ? (knowledge.rejected / knowledge.totalClaims * 100).toFixed(1) : '0';
        return `❌ **Rejected Claims**: **${formatNumber(knowledge.rejected)}** (${rejRate}% rejection rate)\n\nOut of ${formatNumber(knowledge.totalClaims)} total claims submitted.`;
      }
      if (q.includes('pending') || q.includes('outstanding')) {
        return `⏳ **Pending Claims**: **${formatNumber(knowledge.pending)}** claims still awaiting adjudication, valued at an estimated portion of the ${formatCurrency(knowledge.totalClaimed)} total claimed.`;
      }
      return `📄 **Claims Summary** for ${knowledge.year}:\n\n- Total Claims: ${formatNumber(knowledge.totalClaims)}\n- Total Claimed: ${formatCurrency(knowledge.totalClaimed)}\n- Approved: ${formatNumber(knowledge.approved)}\n- Rejected: ${formatNumber(knowledge.rejected)}\n- Pending: ${formatNumber(knowledge.pending)}`;
    }

    // Episodes
    if (q.includes('episode') || q.includes('finalised') || q.includes('finalized')) {
      return `📝 **Episodes Finalised** in ${knowledge.year}: **${formatNumber(knowledge.totalEps)}** episodes.`;
    }

    // Doctors
    if (q.includes('doctor') || q.includes('physician') || q.includes('specialist') || q.includes('clinician')) {
      let response = `👨‍⚕️ **${knowledge.totalDoctors} doctors** contributed to clinical activity in ${knowledge.year}.`;
      if (knowledge.topDoctor) {
        response += `\n\nTop performing doctor: **${knowledge.topDoctor.name}** — ${formatNumber(knowledge.topDoctor.episodes)} episodes, ${formatCurrency(knowledge.topDoctor.revenue)} revenue.`;
      }
      return response;
    }

    // Summary / overview
    if (q.includes('summary') || q.includes('overview') || q.includes('dashboard') || q.includes('kpi') || q.includes('how are we doing')) {
      return `📊 **${knowledge.year} Executive Summary**\n\n` +
        `- 💰 Revenue: ${formatCurrency(knowledge.totalRevenue)}\n` +
        `- 📋 Admissions: ${formatNumber(knowledge.totalAdmissions)}\n` +
        `- 🔬 Theatre Cases: ${formatNumber(knowledge.totalTheatre)}\n` +
        `- 💊 Prescriptions: ${formatNumber(knowledge.totalRx)}\n` +
        `- 📝 Episodes Finalised: ${formatNumber(knowledge.totalEps)}\n` +
        `- 🏥 Occupancy: ${knowledge.currentOccupancy.toFixed(1)}%\n` +
        `- 📄 Claims Filed: ${formatNumber(knowledge.totalClaims)}`;
    }

    // Help
    if (q.includes('help') || q.includes('what can you') || q.includes('what do you')) {
      return `I can help you with:\n\n` +
        `- **Revenue** — "What was total revenue?" / "Best revenue month?"\n` +
        `- **Admissions** — "Total admissions?" / "Casualty numbers?"\n` +
        `- **Occupancy** — "Current bed occupancy?"\n` +
        `- **Theatre** — "How many surgeries?"\n` +
        `- **Pharmacy** — "Prescriptions dispensed?"\n` +
        `- **Claims** — "Claims summary?" / "Rejection rate?"\n` +
        `- **Doctors** — "Top performing doctor?"\n` +
        `- **Summary** — "How are we doing?" / "Give me a KPI overview"`;
    }

    return `I'm not sure how to answer that specific question yet. Try asking about **revenue**, **admissions**, **occupancy**, **theatre**, **pharmacy**, **claims**, or **doctors**. You can also say **"summary"** for a full KPI overview!`;
  };

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    const response = generateResponse(input);
    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: response,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center"
        aria-label="Toggle AI Assistant"
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[400px] max-h-[520px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-teal-600 to-emerald-600 text-white">
            <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Avenues Intelligence</h3>
              <p className="text-xs text-teal-100">Ask about your data</p>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 max-h-[340px]">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="h-7 w-7 rounded-full bg-teal-100 dark:bg-teal-900 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-teal-600 text-white rounded-br-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-sm'
                }`}>
                  {msg.content}
                </div>
                {msg.role === 'user' && (
                  <div className="h-7 w-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="border-t border-slate-200 dark:border-slate-800 px-4 py-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about revenue, admissions..."
                className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="h-9 w-9 rounded-lg bg-teal-600 text-white flex items-center justify-center hover:bg-teal-700 disabled:opacity-40 transition-colors"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

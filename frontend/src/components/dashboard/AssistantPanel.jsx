import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { FiSend } from 'react-icons/fi';
import { assistantReply } from '../../utils/explainers.js';

function Bubble({ role, text }) {
    const isUser = role === 'user';
    return (
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
            <div
                className={`max-w-[85%] rounded-3xl px-4 py-3 text-sm leading-relaxed ${isUser
                        ? 'bg-gradient-to-r from-indigo-500/70 to-purple-500/70 text-white border border-white/10'
                        : 'glass text-slate-200/85'
                    }`}
            >
                {String(text || '')
                    .split('\n')
                    .map((line, idx) => (
                        <div key={idx}>{line}</div>
                    ))}
            </div>
        </div>
    );
}

export default function AssistantPanel({ lastRecord }) {
    const [messages, setMessages] = useState(() => [
        {
            id: 'boot',
            role: 'bot',
            text: 'Hi, I’m TruthLens AI Assistant. Ask: “Why is this fake?” after you run a detection.'
        }
    ]);
    const [input, setInput] = useState('');
    const listRef = useRef(null);

    const canExplain = Boolean(lastRecord);

    const placeholder = useMemo(
        () => (canExplain ? 'Ask: Why is this fake? / What is the trust score? / What next?' : 'Run a detection first…'),
        [canExplain]
    );

    function push(role, text) {
        setMessages((prev) => [...prev, { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, role, text }]);
        queueMicrotask(() => {
            const el = listRef.current;
            if (el) el.scrollTop = el.scrollHeight;
        });
    }

    function onSend() {
        const q = input.trim();
        if (!q) return;
        setInput('');
        push('user', q);

        try {
            const reply = assistantReply({ question: q, lastRecord });
            push('bot', reply);
        } catch (e) {
            toast.error(e?.message || 'Assistant failed');
        }
    }

    return (
        <div className="glass rounded-3xl p-5">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <div className="text-sm font-semibold text-slate-200/70">AI Assistant</div>
                    <div className="mt-1 text-xs text-slate-200/60">Explainable answers for your latest result</div>
                </div>
                <div className="glass rounded-2xl px-3 py-2 text-xs text-slate-200/70">
                    {canExplain ? 'Context loaded' : 'No context'}
                </div>
            </div>

            <div ref={listRef} className="mt-4 h-[360px] space-y-3 overflow-y-auto rounded-2xl bg-white/5 p-4">
                {messages.map((m) => (
                    <Bubble key={m.id} role={m.role} text={m.text} />
                ))}
            </div>

            <div className="mt-4 flex items-center gap-2">
                <input
                    className="input"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={placeholder}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') onSend();
                    }}
                />
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    className="btn-grad shrink-0 px-4"
                    onClick={onSend}
                >
                    <FiSend />
                </motion.button>
            </div>
        </div>
    );
}

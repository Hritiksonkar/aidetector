import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UploadCloud,
  ShieldCheck,
  AlertTriangle,
  BrainCircuit,
  FileVideo,
  Image as ImageIcon,
  CheckCircle2,
  XCircle,
  RefreshCcw,
  Zap
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL;

const extractFirstUrl = (text) => {
  if (!text) return '';
  const trimmed = String(text).trim();
  const match = trimmed.match(/https?:\/\/[^\s<>"']+/i);
  return (match ? match[0] : trimmed).trim();
};

function App() {
  const [file, setFile] = useState(null);
  const [urlInput, setUrlInput] = useState('');
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' or 'url'
  const [preview, setPreview] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // Status: 'idle', 'uploading', 'analyzing', 'success', 'error'
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const fileInputRef = useRef(null);

  const handleFile = (selectedFile) => {
    if (!selectedFile) return;

    const isImage = selectedFile.type.startsWith('image/');
    const isVideo = selectedFile.type.startsWith('video/');

    if (!isImage && !isVideo) {
      setErrorMsg("Please upload a valid image or video file.");
      setStatus('error');
      return;
    }

    setFile(selectedFile);
    setUrlInput('');
    setStatus('idle');
    setResult(null);
    setErrorMsg('');
    setProgress(0);

    // Create preview
    const objectUrl = URL.createObjectURL(selectedFile);
    setPreview({ url: objectUrl, type: isImage ? 'image' : 'video' });
  };

  const handleUrlSubmit = (e) => {
    if (e) e.preventDefault();
    if (!urlInput.trim()) return;

    const cleanedUrl = extractFirstUrl(urlInput);

    // Auto-detect type from extension as fallback, or use image as default visual
    const isVideo = cleanedUrl.match(/\.(mp4|webm|mov|avi)($|\?)/i);

    setFile(null);
    setStatus('idle');
    setResult(null);
    setErrorMsg('');
    setProgress(0);
    setPreview({ url: cleanedUrl, type: isVideo ? 'video' : 'image' });
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setActiveTab('upload');
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const simulateProgress = () => {
    setStatus('analyzing');
    setProgress(0);
    const duration = 3000;
    const interval = 50;
    const steps = duration / interval;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const nextProg = Math.min((currentStep / steps) * 100, 95); // hold at 95 until API returns
      setProgress(nextProg);
      if (currentStep >= steps) clearInterval(timer);
    }, interval);

    return timer;
  };

  const handleAnalyze = async () => {
    if (!file && !urlInput) return;

    const timer = simulateProgress();

    const formData = new FormData();
    if (file) {
      formData.append('file', file);
    } else if (urlInput) {
      formData.append('url', extractFirstUrl(urlInput));
    }

    try {
      const response = await axios.post(`${API_URL}/detect`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      clearInterval(timer);
      setProgress(100);
      setResult(response.data);
      setStatus('success');

    } catch (error) {
      clearInterval(timer);
      console.error("API Error:", error);
      setErrorMsg(error.response?.data?.detail || "An error occurred during analysis.");
      setStatus('error');
    }
  };

  const resetAll = () => {
    setFile(null);
    setUrlInput('');
    if (preview && preview.url && preview.url.startsWith('blob:')) {
      URL.revokeObjectURL(preview.url);
    }
    setPreview(null);
    setStatus('idle');
    setResult(null);
    setProgress(0);
    setErrorMsg('');
  };

  const getResultStyleCode = () => {
    if (!result) return 'blue';
    if (result.prediction === "AI Generated") return 'red';
    if (result.prediction === "Suspicious") return 'yellow';
    return 'green';
  };

  const colorMap = {
    red: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/50', glow: 'shadow-red-500/20' },
    yellow: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/50', glow: 'shadow-yellow-500/20' },
    green: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/50', glow: 'shadow-green-500/20' },
    blue: { bg: 'bg-indigo-500/20', text: 'text-indigo-400', border: 'border-indigo-500/50', glow: 'shadow-indigo-500/20' }
  };

  const themeTheme = colorMap[getResultStyleCode()];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30 overflow-hidden relative">
      {/* Dynamic Background Effects */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full blur-[120px] opacity-20 transition-colors duration-1000 ${status === 'success' ? 'bg-' + getResultStyleCode() + '-500' : 'bg-indigo-600'}`}></div>
        <div className={`absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full blur-[150px] opacity-20 transition-colors duration-1000 ${status === 'success' ? 'bg-' + getResultStyleCode() + '-600' : 'bg-purple-600'}`}></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay"></div>
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-12 flex flex-col min-h-screen">

        {/* Header */}
        <header className="flex items-center justify-between mb-16">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.2)]">
              <ShieldCheck className="w-6 h-6 text-indigo-400" />
            </div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 to-purple-400 tracking-tight">
              Truth Shield
            </h1>
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-slate-400 text-sm font-medium flex items-center gap-2 bg-slate-900/50 px-4 py-2 rounded-full border border-slate-800"
          >
            <BrainCircuit className="w-4 h-4 text-indigo-400" />
            AI vs Real Detector Engine
          </motion.div>
        </header>

        {/* Main Content Grid */}
        <main className="flex-1 flex flex-col lg:flex-row gap-8 items-stretch">

          {/* Left Column: Upload / Preview */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="flex-1 flex flex-col"
          >
            <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/60 rounded-3xl p-8 flex-1 flex flex-col shadow-2xl relative overflow-hidden">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <Zap className="w-5 h-5 text-indigo-400" />
                Media Analysis
              </h2>

              {(!file && !preview?.url) ? (
                <div className="flex-1 flex flex-col">
                  {/* Tabs */}
                  <div className="flex bg-slate-800/50 p-1 rounded-xl mb-6">
                    <button
                      onClick={() => setActiveTab('upload')}
                      className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'upload' ? 'bg-indigo-500 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      File Upload
                    </button>
                    <button
                      onClick={() => setActiveTab('url')}
                      className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'url' ? 'bg-indigo-500 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      Use URL
                    </button>
                  </div>

                  {activeTab === 'upload' ? (
                    <div
                      className={`flex-1 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-8 transition-all duration-300 ease-out z-10
                        ${isDragging ? 'border-indigo-400 bg-indigo-500/10 scale-[1.02]' : 'border-slate-700 bg-slate-800/30 hover:bg-slate-800/50 hover:border-slate-600'}
                      `}
                      onDragOver={onDragOver}
                      onDragLeave={onDragLeave}
                      onDrop={onDrop}
                      onClick={() => fileInputRef.current?.click()}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="w-20 h-20 rounded-full bg-slate-800 shadow-inner flex items-center justify-center mb-6 ring-4 ring-slate-900">
                        <UploadCloud className={`w-10 h-10 ${isDragging ? 'text-indigo-400' : 'text-slate-400'} transition-colors`} />
                      </div>
                      <h3 className="text-xl font-medium mb-2 text-slate-200">Drag & Drop Media</h3>
                      <p className="text-slate-500 text-sm text-center mb-6 max-w-xs">
                        Upload images (JPG, PNG) or videos (MP4, WEBM) to verify their authenticity.
                      </p>
                      <button className="px-6 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 rounded-lg font-medium transition-all text-sm">
                        Browse Files
                      </button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*,video/*"
                        onChange={(e) => handleFile(e.target.files[0])}
                      />
                    </div>
                  ) : (
                    <div className="flex-1 rounded-2xl border border-slate-700 bg-slate-800/30 flex flex-col justify-center p-8 transition-all duration-300">
                      <h3 className="text-lg font-medium mb-2 text-slate-200 text-center">Import via Link</h3>
                      <p className="text-slate-500 text-sm text-center mb-6 max-w-xs mx-auto">
                        Paste a direct media URL or a social link (YouTube, Instagram).
                      </p>
                      <form onSubmit={handleUrlSubmit} className="flex flex-col gap-4 max-w-sm mx-auto w-full relative">
                        <input
                          type="url"
                          placeholder="https://example.com/media.mp4"
                          value={urlInput}
                          onChange={(e) => setUrlInput(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 placeholder-slate-600 shadow-inner"
                          required
                        />
                        <button
                          type="submit"
                          className="w-full py-3 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 rounded-xl font-medium transition-all text-sm shadow-sm"
                        >
                          Extract & Analyze
                        </button>

                        <div className="mt-2 flex items-start gap-2 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400/80">
                          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <p className="text-[10px] leading-relaxed">
                            <strong>Ethical & Legal Notice:</strong> We do not permanently store content fetched from proprietary platforms like YouTube or Instagram. This is processed temporarily for demonstration purposes. Users are advised to prefer direct file uploads for production deployments.
                          </p>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col z-10">
                  <div className="relative flex-1 rounded-2xl overflow-hidden bg-black/40 border border-slate-700/50 group flex items-center justify-center mb-6">
                    {preview.type === 'image' ? (
                      <img src={preview.url} alt="Preview" className="max-w-full max-h-[300px] object-contain" />
                    ) : (
                      <video src={preview.url} controls className="max-w-full max-h-[300px] object-contain" />
                    )}

                    {/* Scanning overlay effect */}
                    {status === 'analyzing' && (
                      <motion.div
                        initial={{ top: '0%' }}
                        animate={{ top: ['0%', '100%', '0%'] }}
                        transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
                        className="absolute left-0 right-0 h-1 bg-indigo-500/80 shadow-[0_0_20px_rgba(99,102,241,1)] z-20"
                      />
                    )}

                    {(status === 'idle' || status === 'error') && (
                      <button
                        onClick={(e) => { e.stopPropagation(); resetAll(); }}
                        className="absolute top-3 right-3 w-8 h-8 bg-black/60 hover:bg-red-500/80 rounded-full flex items-center justify-center backdrop-blur-md transition-colors border border-white/10 z-30"
                      >
                        <XCircle className="w-5 h-5 text-white" />
                      </button>
                    )}
                  </div>

                  {status === 'idle' && (
                    <button
                      onClick={handleAnalyze}
                      className="w-full py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 font-semibold shadow-[0_0_20px_rgba(99,102,241,0.4)] transition-all hover:scale-[1.01] active:scale-[0.98] flex items-center justify-center gap-2 text-white"
                    >
                      <BrainCircuit className="w-5 h-5" />
                      Run Deepfake Analysis
                    </button>
                  )}

                  {status === 'error' && (
                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex flex-col items-center justify-center gap-3 text-center">
                      <div className="flex items-center gap-2 font-medium">
                        <AlertTriangle className="w-5 h-5" />
                        Analysis Failed
                      </div>
                      <p className="text-sm opacity-80">{errorMsg}</p>
                      <button onClick={resetAll} className="px-4 py-2 mt-2 text-sm bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-colors font-medium border border-red-500/20">
                        Try Again
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>

          {/* Right Column: Execution / Results */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="flex-1 lg:max-w-md flex flex-col"
          >
            <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/60 rounded-3xl p-8 flex-1 flex flex-col shadow-2xl justify-between h-full">
              <div>
                <h2 className="text-xl font-semibold mb-8 flex items-center gap-2 text-slate-200">
                  <ShieldCheck className="w-5 h-5 text-indigo-400" />
                  Verification Report
                </h2>

                <AnimatePresence mode="wait">
                  {status === 'idle' && !result && (
                    <motion.div
                      key="idle"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="flex flex-col items-center justify-center h-48 text-slate-500 space-y-4"
                    >
                      <div className="w-16 h-16 rounded-2xl bg-slate-800/50 flex items-center justify-center border border-slate-700/50">
                        <ShieldCheck className="w-8 h-8 opacity-40" />
                      </div>
                      <p className="text-sm font-medium">Upload media to generate report</p>
                    </motion.div>
                  )}

                  {status === 'analyzing' && (
                    <motion.div
                      key="analyzing"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="flex flex-col h-full justify-center space-y-8 mt-10"
                    >
                      <div className="flex flex-col items-center justify-center space-y-6">
                        <div className="relative w-24 h-24">
                          <div className="absolute inset-0 rounded-full border-t-2 border-indigo-500 animate-[spin_1.5s_linear_infinite]"></div>
                          <div className="absolute inset-4 rounded-full border-b-2 border-purple-500 animate-[spin_2s_linear_infinite_reverse]"></div>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <BrainCircuit className="w-8 h-8 text-indigo-400 animate-pulse" />
                          </div>
                        </div>
                        <div className="text-center">
                          <h3 className="text-lg font-medium text-slate-200">Running Neural Network</h3>
                          <p className="text-sm text-slate-400 mt-1">Extracting spatial & temporal features...</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-medium text-slate-400">
                          <span>Processing Data</span>
                          <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ ease: "linear" }}
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {status === 'success' && result && (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="space-y-6"
                    >
                      {/* Prediction Hero */}
                      <div className={`p-6 rounded-2xl border ${themeTheme.border} ${themeTheme.bg} shadow-lg ${themeTheme.glow} relative overflow-hidden backdrop-blur-md`}>
                        <div className="absolute top-0 right-0 p-4 opacity-20">
                          <ShieldCheck className={`w-24 h-24 ${themeTheme.text}`} />
                        </div>
                        <p className="text-sm font-semibold uppercase tracking-wider opacity-80 mb-1 text-slate-300">Detection Result</p>
                        <h3 className={`text-3xl font-bold ${themeTheme.text} flex items-center gap-3 relative z-10`}>
                          {result.prediction === "Real" ? <CheckCircle2 className="w-8 h-8" /> : <AlertTriangle className="w-8 h-8" />}
                          {result.prediction}
                        </h3>
                      </div>

                      {/* Confidence Score Bar */}
                      <div className="space-y-3 p-5 rounded-2xl bg-slate-800/40 border border-slate-700/50">
                        <div className="flex justify-between items-end">
                          <span className="text-sm font-medium text-slate-300">Authenticity Score</span>
                          <span className="text-2xl font-bold text-slate-100">{result.confidence_score}<span className="text-sm text-slate-500 font-normal">/10</span></span>
                        </div>
                        <div className="h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-700">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(result.confidence_score / 10) * 100}%` }}
                            transition={{ duration: 1.5, ease: "easeOut" }}
                            className={`h-full bg-gradient-to-r ${result.confidence_score > 6 ? 'from-emerald-600 to-green-400' : result.confidence_score > 3 ? 'from-yellow-600 to-yellow-400' : 'from-red-600 to-rose-400'}`}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-500 uppercase font-bold px-1">
                          <span>0</span>
                          <span>AI Generated</span>
                          <span>Suspicious</span>
                          <span>Real</span>
                          <span>10</span>
                        </div>

                        {(typeof result.real_percent === 'number' || typeof result.ai_percent === 'number') && (
                          <div className="text-xs text-slate-400 flex justify-between pt-1">
                            <span>Real: <span className="text-slate-200 font-medium">{result.real_percent ?? Math.round((result.confidence_score / 10) * 100)}%</span></span>
                            <span>AI: <span className="text-slate-200 font-medium">{result.ai_percent ?? Math.round(100 - (result.confidence_score / 10) * 100)}%</span></span>
                          </div>
                        )}
                      </div>

                      {/* Explainability / Meta */}
                      <div className="p-5 rounded-2xl bg-slate-800/40 border border-slate-700/50 space-y-3">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-700 pb-2">Forensic Details</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-slate-500 text-xs block mb-1">Source / Name</span>
                            <span className="text-slate-200 font-medium truncate block" title={file ? file.name : urlInput}>
                              {file ? file.name : (urlInput ? new URL(urlInput).hostname : 'Media')}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 text-xs block mb-1">Format</span>
                            <span className="text-slate-200 font-medium capitalize flex items-center gap-1">
                              {preview.type === 'video' ? <FileVideo className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
                              {preview.type}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 text-xs block mb-1">Input Method</span>
                            <span className="text-slate-200 font-medium">{result.source_type || (file ? "Uploaded" : "URL")}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 text-xs block mb-1">Processing Time</span>
                            <span className="text-slate-200 font-medium">{result.processing_time || "N/A"}</span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-slate-500 text-xs block mb-1">Analysis Note</span>
                            <span className="text-slate-300">
                              {result.prediction === "AI Generated" && "High probability of synthetic manipulation detected in spatial frequencies and edge variance."}
                              {result.prediction === "Suspicious" && "Detected mild anomalies. Media might be compressed, heavily edited, or partially synthesized."}
                              {result.prediction === "Real" && "Natural variance and consistent temporal/spatial patterns align with authentic camera captures."}
                            </span>
                          </div>
                        </div>
                      </div>

                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Bottom Actions */}
              {status === 'success' && (
                <motion.button
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  onClick={resetAll}
                  className="mt-8 w-full py-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 shadow-md transition-colors flex items-center justify-center gap-2 text-slate-200 font-medium"
                >
                  <RefreshCcw className="w-4 h-4" />
                  Analyze Another File
                </motion.button>
              )}
            </div>
          </motion.div>

        </main>
      </div>
    </div>
  );
}

export default App;

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { Play, Loader2, Volume2, Download, Sparkles, UploadCloud, Image as ImageIcon, Bookmark, Save, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface Preset {
  id: string;
  name: string;
  gender: 'Male' | 'Female';
  voice: string;
  language: string;
  emotion: string;
  age: string;
  effect: string;
  backgroundEffect: string;
}

const VOICES = {
  Male: ['Charon', 'Fenrir'],
  Female: ['Puck', 'Kore', 'Zephyr']
};

const LANGUAGES = ['English', 'Bangla'];
const EMOTIONS = ['Neutral', 'Cheerful', 'Serious', 'Sad', 'Excited'];
const AGES = ['Default', 'Child', 'Teenager', 'Young Adult', 'Middle-Aged', 'Elderly'];
const EFFECTS = ['None', 'Telephone', 'Muffled', 'Echo', 'Robot', 'Whisper', 'Megaphone'];
const BACKGROUND_EFFECTS = ['None', 'Nature', 'City Traffic', 'Rain', 'Cafe', 'Office', 'Soft Piano'];

function createWavBlob(base64Data: string, sampleRate: number = 24000): Blob {
  const binaryString = atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
  
  const buffer = new ArrayBuffer(44 + bytes.length);
  const view = new DataView(buffer);
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + bytes.length, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, bytes.length, true);
  new Uint8Array(buffer, 44).set(bytes);

  return new Blob([buffer], { type: 'audio/wav' });
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'tts'>('tts');
  const [text, setText] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female'>('Male');
  const [voice, setVoice] = useState(VOICES['Male'][0]);
  const [language, setLanguage] = useState('English');
  const [emotion, setEmotion] = useState('Neutral');
  const [age, setAge] = useState('Default');
  const [effect, setEffect] = useState('None');
  const [backgroundEffect, setBackgroundEffect] = useState('None');
  
  const [presets, setPresets] = useState<Preset[]>([]);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appIcon, setAppIcon] = useState<string | null>(null);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);

  const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setAppIcon(URL.createObjectURL(e.target.files[0]));
  };

  useEffect(() => {
    const saved = localStorage.getItem('jahids-voice-presets');
    if (saved) {
      try {
        setPresets(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load presets', e);
      }
    }
  }, []);

  const savePreset = () => {
    if (!newPresetName.trim()) return;
    const newPreset: Preset = {
      id: Date.now().toString(),
      name: newPresetName.trim(),
      gender,
      voice,
      language,
      emotion,
      age,
      effect,
      backgroundEffect
    };
    const updatedPresets = [...presets, newPreset];
    setPresets(updatedPresets);
    localStorage.setItem('jahids-voice-presets', JSON.stringify(updatedPresets));
    setNewPresetName('');
    setShowPresetModal(false);
  };

  const loadPreset = (preset: Preset) => {
    setGender(preset.gender);
    setVoice(preset.voice);
    setLanguage(preset.language);
    setEmotion(preset.emotion);
    setAge(preset.age);
    setEffect(preset.effect);
    setBackgroundEffect(preset.backgroundEffect);
  };

  const generateSpeech = async (promptText: string, selectedVoice: string) => {
    setIsGenerating(true); setError(null); setAudioUrl(null);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: promptText }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } } },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        setAudioUrl(URL.createObjectURL(createWavBlob(base64Audio, 24000)));
      } else setError("No audio data returned.");
    } catch (err: any) {
      setError(err.message || "Error generating audio.");
    } finally { setIsGenerating(false); }
  };

  const handleGenerateTTS = () => {
    if (!text.trim()) return;
    let finalPrompt = text;
    if (language === 'Bangla') finalPrompt = `Speak the following text in Bengali (Bangla): ${text}`;
    if (emotion !== 'Neutral') finalPrompt = `Say ${emotion.toLowerCase()}: ${finalPrompt}`;
    if (age !== 'Default') finalPrompt = `Speak like a ${age.toLowerCase()} person: ${finalPrompt}`;
    if (effect !== 'None') finalPrompt = `Apply a ${effect.toLowerCase()} voice effect: ${finalPrompt}`;
    if (backgroundEffect !== 'None') finalPrompt = `Include background sounds of ${backgroundEffect.toLowerCase()}: ${finalPrompt}`;
    
    generateSpeech(finalPrompt, voice);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 text-slate-900 font-sans selection:bg-indigo-500/30">
      <header className="bg-white/60 backdrop-blur-xl sticky top-0 z-50 border-b border-slate-200/60 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div 
              className="relative w-12 h-12 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center cursor-pointer group shadow-sm"
              onClick={() => iconInputRef.current?.click()}
            >
              {appIcon ? (
                <img src={appIcon} alt="App Icon" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="w-6 h-6 text-slate-400 group-hover:text-indigo-500 transition-colors" />
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <UploadCloud className="w-4 h-4 text-white" />
              </div>
              <input type="file" ref={iconInputRef} onChange={handleIconUpload} accept="image/*" className="hidden" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-display tracking-tight text-slate-900">
                Jahid's Voice
              </h1>
              <p className="text-xs text-indigo-600 font-semibold tracking-wide uppercase">The Art of Your Speech</p>
            </div>
          </div>
          
          <nav className="hidden sm:flex items-center gap-2 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200">
            {[
              { id: 'tts', label: 'Speech Synthesis', icon: Volume2 }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id as any); setAudioUrl(null); setError(null); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === tab.id 
                    ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50' 
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <AnimatePresence mode="wait">
          {activeTab === 'tts' && (
            <motion.div
              key="tts"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="bg-white border border-slate-200 rounded-[2rem] p-6 sm:p-8 shadow-xl shadow-slate-200/50 space-y-8">
                
                {/* Presets Section */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 gap-4">
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <Bookmark className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                    <select
                      className="w-full sm:w-auto bg-white border border-slate-200 rounded-xl p-2.5 text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm min-w-[200px]"
                      onChange={(e) => {
                        const p = presets.find(p => p.id === e.target.value);
                        if (p) loadPreset(p);
                        e.target.value = ""; // reset after load
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>Load a preset...</option>
                      {presets.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={() => setShowPresetModal(true)}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-indigo-200 text-indigo-600 rounded-xl text-sm font-semibold hover:bg-indigo-50 transition-colors shadow-sm"
                  >
                    <Save className="w-4 h-4" />
                    Save Current Settings
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                  <div className="space-y-3">
                    <label className="block text-sm font-semibold text-slate-700">Language</label>
                    <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm">
                      {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className="block text-sm font-semibold text-slate-700">Emotion</label>
                    <select value={emotion} onChange={(e) => setEmotion(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm">
                      {EMOTIONS.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className="block text-sm font-semibold text-slate-700">Age</label>
                    <select value={age} onChange={(e) => setAge(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm">
                      {AGES.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className="block text-sm font-semibold text-slate-700">Voice Effect</label>
                    <select value={effect} onChange={(e) => setEffect(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm">
                      {EFFECTS.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className="block text-sm font-semibold text-slate-700">Background</label>
                    <select value={backgroundEffect} onChange={(e) => setBackgroundEffect(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm">
                      {BACKGROUND_EFFECTS.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-semibold text-slate-700">Voice Model</label>
                    <div className="flex bg-slate-100 rounded-lg p-1">
                      {(['Male', 'Female'] as const).map(g => (
                        <button key={g} onClick={() => { setGender(g); setVoice(VOICES[g][0]); }} className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${gender === g ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {VOICES[gender].map((v) => (
                      <button
                        key={v}
                        onClick={() => setVoice(v)}
                        className={`py-3 px-4 rounded-xl text-sm font-semibold transition-all border ${
                          voice === v ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-slate-700">Text Content</label>
                  <textarea
                    rows={5}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-5 text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all resize-none text-lg leading-relaxed shadow-inner"
                    placeholder="Enter the text you want to synthesize..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                  />
                </div>

                <button
                  onClick={handleGenerateTTS}
                  disabled={isGenerating || !text.trim()}
                  className="w-full flex items-center justify-center py-4 px-6 rounded-2xl text-base font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/30"
                >
                  {isGenerating ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Generating...</>
                  ) : (
                    <><Sparkles className="w-5 h-5 mr-2" /> Generate Speech</>
                  )}
                </button>
              </div>
            </motion.div>
          )}


        </AnimatePresence>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-sm flex items-center font-medium"
          >
            <div className="w-2 h-2 rounded-full bg-red-600 mr-3 animate-pulse" />
            {error}
          </motion.div>
        )}

        <AnimatePresence>
          {audioUrl && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="mt-8 bg-white border border-slate-200 rounded-3xl p-6 shadow-xl shadow-slate-200/50"
            >
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="flex-shrink-0 p-4 bg-indigo-50 rounded-full border border-indigo-100 hidden sm:block">
                  <Play className="w-6 h-6 text-indigo-600 ml-1" />
                </div>
                <div className="flex-grow w-full">
                  <audio ref={audioRef} src={audioUrl} controls autoPlay className="w-full h-12 rounded-lg" />
                </div>
                <div className="flex-shrink-0 w-full sm:w-auto">
                   <a
                    href={audioUrl}
                    download={`jahids-voice-tts-${Date.now()}.wav`}
                    className="w-full sm:w-auto flex items-center justify-center p-3.5 bg-slate-900 text-white hover:bg-slate-800 rounded-xl transition-colors font-semibold shadow-md"
                  >
                    <Download className="w-5 h-5 sm:mr-0 mr-2" />
                    <span className="sm:hidden">Download</span>
                  </a>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Preset Modal */}
      <AnimatePresence>
        {showPresetModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-slate-900">Save Preset</h3>
                <button onClick={() => setShowPresetModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <input
                type="text"
                placeholder="Preset Name (e.g., Deep Cinematic)"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none mb-6"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newPresetName.trim()) savePreset();
                }}
              />
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowPresetModal(false)}
                  className="px-4 py-2 text-slate-600 font-semibold hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={savePreset}
                  disabled={!newPresetName.trim()}
                  className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-md"
                >
                  Save
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

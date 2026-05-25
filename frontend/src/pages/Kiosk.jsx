import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Loader2, Mic, Square, Volume2 } from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000/api';
const WS_BASE = 'ws://127.0.0.1:8000/ws/session';

const LANGUAGES = [
  { label: 'Auto', value: 'Auto-Detect', speech: 'en-IN' },
  { label: 'English', value: 'English', speech: 'en-IN' },
  { label: 'हिन्दी', value: 'Hindi', speech: 'hi-IN' },
  { label: 'ಕನ್ನಡ', value: 'Kannada', speech: 'kn-IN' },
];

function Kiosk() {
  const navigate = useNavigate();
  const recognitionRef = useRef(null);
  const wsRef = useRef(null);
  const [sessionId, setSessionId] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [messages, setMessages] = useState([]);
  const [aiResponse, setAiResponse] = useState('Starting VoiceCare...');
  const [language, setLanguage] = useState(LANGUAGES[0]);
  const [completeReport, setCompleteReport] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function bootSession() {
      const response = await fetch(`${API_BASE}/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_point: 'kiosk', language_preference: language.value }),
      });
      const data = await response.json();
      if (!isMounted) return;

      setSessionId(data.session_id);
      setAiResponse(data.message);
      setMessages([{ role: 'assistant', content: data.message }]);

      const websocket = new WebSocket(`${WS_BASE}/${data.session_id}`);
      wsRef.current = websocket;
      websocket.onmessage = (event) => {
        setAiResponse(event.data);
        setMessages((current) => [...current, { role: 'assistant', content: event.data }]);
        speak(event.data);
      };
      websocket.onerror = () => {
        setAiResponse('Connection issue. Please ask reception staff for help.');
      };
    }

    bootSession().catch(() => {
      setAiResponse('Unable to start kiosk session. Please check the backend server.');
    });

    return () => {
      isMounted = false;
      wsRef.current?.close();
    };
  }, []);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = language.speech;

    recognition.onresult = (event) => {
      let currentTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        currentTranscript += event.results[i][0].transcript;
      }
      setTranscript(currentTranscript);

      const latest = event.results[event.results.length - 1];
      if (latest?.isFinal && currentTranscript.trim()) {
        sendTranscript(currentTranscript.trim());
      }
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
  }, [language]);

  const sendTranscript = (text) => {
    if (!text || wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(text);
    setMessages((current) => [...current, { role: 'user', content: text }]);
    setAiResponse('Processing your response...');
    setTranscript('');
  };

  const toggleListening = () => {
    if (completeReport) return;
    if (isListening) {
      recognitionRef.current?.stop();
      if (transcript.trim()) sendTranscript(transcript.trim());
      setIsListening(false);
      return;
    }

    setTranscript('');
    recognitionRef.current?.start();
    setIsListening(true);
  };

  const endSession = async () => {
    if (!sessionId || isEnding) return;
    setIsEnding(true);
    recognitionRef.current?.stop();

    const response = await fetch(`${API_BASE}/session/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    });
    const report = await response.json();
    setCompleteReport(report);
    setAiResponse('Your intake is complete. The report is ready for the doctor.');
    wsRef.current?.close();
    setIsEnding(false);
  };

  const speak = (text) => {
    if (!window.speechSynthesis || !text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language.speech;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      <header className="p-5 flex items-center justify-between border-b border-slate-800 bg-slate-900">
        <button
          onClick={() => navigate('/')}
          className="p-3 hover:bg-slate-800 transition-colors flex items-center gap-2 text-slate-300"
        >
          <ArrowLeft size={24} />
          <span className="font-medium text-lg hidden md:block">Back</span>
        </button>
        <h1 className="text-2xl font-bold text-sky-300">VoiceCare Kiosk</h1>
        <div className="flex gap-2">
          {LANGUAGES.map((item) => (
            <button
              key={item.value}
              onClick={() => setLanguage(item)}
              className={`px-4 py-2 text-sm font-medium border transition-colors ${
                language.value === item.value
                  ? 'bg-sky-500 text-white border-sky-400'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 p-6">
        <section className="flex flex-col items-center justify-center">
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 p-8 text-center">
            <Volume2 className="mx-auto text-sky-400 mb-4" size={32} />
            <p className="text-2xl md:text-3xl font-light text-white leading-relaxed">
              {aiResponse}
            </p>
          </div>

          <div className="w-full max-w-4xl min-h-28 flex items-center justify-center mt-8">
            {transcript && (
              <p className="text-xl md:text-2xl text-sky-100 italic text-center bg-sky-950 p-5 border border-sky-800">
                "{transcript}"
              </p>
            )}
          </div>

          {completeReport ? (
            <div className="mt-8 flex items-center gap-3 text-emerald-300 text-xl">
              <CheckCircle size={32} />
              Report ready for doctor dashboard
            </div>
          ) : (
            <div className="mt-8 flex flex-col sm:flex-row items-center gap-4">
              <button
                onClick={toggleListening}
                className={`relative flex items-center justify-center w-32 h-32 rounded-full transition-all shadow-2xl ${
                  isListening ? 'bg-rose-500 scale-105' : 'bg-sky-500'
                }`}
              >
                {isListening ? <Square size={48} className="text-white fill-current" /> : <Mic size={56} className="text-white" />}
              </button>
              <button
                onClick={endSession}
                disabled={isEnding}
                className="h-14 px-6 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-semibold"
              >
                {isEnding ? <Loader2 className="animate-spin" /> : 'Finish Intake'}
              </button>
            </div>
          )}

          <p className="mt-6 text-lg font-medium text-slate-400">
            {isListening ? 'Tap microphone again to stop' : 'Tap microphone to speak'}
          </p>
        </section>

        <aside className="bg-slate-900 border border-slate-800 p-4 overflow-y-auto max-h-[calc(100vh-120px)]">
          <h2 className="text-sm font-semibold text-slate-400 uppercase mb-4">Live Transcript</h2>
          <div className="space-y-3">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`p-3 text-sm ${
                  message.role === 'assistant'
                    ? 'bg-slate-800 text-slate-200'
                    : 'bg-emerald-950 text-emerald-100 border border-emerald-800'
                }`}
              >
                <span className="block text-xs uppercase text-slate-500 mb-1">
                  {message.role === 'assistant' ? 'VoiceCare' : 'Patient'}
                </span>
                {message.content}
              </div>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
}

export default Kiosk;

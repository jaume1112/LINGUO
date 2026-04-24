import { useState, useRef, useEffect } from "react";
import { 
  Languages, 
  Send, 
  BookOpen, 
  History as HistoryIcon, 
  Settings, 
  Sparkles,
  ChevronRight,
  ArrowRight,
  Mic,
  MicOff,
  Trash2,
  X,
  AlertTriangle,
  Download,
  Info,
  Maximize2,
  Key,
  Volume2,
  Camera,
  RefreshCw,
  Image as ImageIcon,
  UserCheck,
  Zap,
  Heart,
  Library,
  Turtle,
  Dumbbell,
  Gamepad2,
  CheckCircle2,
  Target,
  User,
  WifiOff,
  Pencil,
  Search,
  ArrowLeftRight,
  Globe,
  ExternalLink
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Markdown from "react-markdown";
import { GoogleGenAI, Type } from "@google/genai";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { ApiKeysManager } from "./components/ApiKeysManager";
import { preloadLanguage, translateOffline, OFFLINE_SUPPORTED_LANGS, ISO_LANG_MAP } from "./lib/offlineTranslator";
// En lugar de importar Tesseract directamente al inicio:
// import Tesseract from "tesseract.js";

// Creamos un import dinámico dentro de la función donde se utiliza
async function performOCR(imageSrc: string) {
  const Tesseract = await import("tesseract.js");
  const result = await Tesseract.recognize(imageSrc, 'spa'); // o el idioma necesario
  return result.data.text;
}
import { TUTOR_PHRASES, STATIC_LANGUAGES, TESSERACT_LANG_MAP, FLAG_MAP } from "./constants";

/** Utility for Tailwind classes */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface TranslationResult {
  translation: string;
  originalText?: string;
  phonetic?: string;
  explanation: string;
  grammarBreakdown?: {
    term: string;
    description: string;
  }[];
  culturalNote?: string;
  tips: string[];
  pronunciationTip?: string;
  source?: string;
  target?: string;
}

interface HistoryItem {
  id: string;
  original: string;
  translated: string;
  timestamp: number;
  source: string;
  target: string;
  fullResult?: TranslationResult;
}

export default function App() {
  const [input, setInput] = useState(() => localStorage.getItem("linguo_current_input") || "");
  const [sourceLang, setSourceLang] = useState(() => localStorage.getItem("linguo_source_lang") || "Auto");
  const [targetLang, setTargetLang] = useState(() => localStorage.getItem("linguo_target_lang") || "Inglés");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    const saved = localStorage.getItem("linguo_history");
    return saved ? JSON.parse(saved) : [];
  });
  const [showSettings, setShowSettings] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInIframe, setIsInIframe] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isApiKeyReady, setIsApiKeyReady] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>(() => localStorage.getItem("linguo_model") || "gemini-3-flash-preview");
  const [activeApiKey, setActiveApiKey] = useState<string>("");
  const [apiDiagnostics, setApiDiagnostics] = useState<string>("Esperando diagnóstico...");
  const [swStatus, setSwStatus] = useState<string>("No detectado");
  const [promptStatus, setPromptStatus] = useState<string>("Esperando evento...");
  const [isStandalone, setIsStandalone] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(() => localStorage.getItem("linguo_current_img"));
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [isFormal, setIsFormal] = useState<boolean>(() => localStorage.getItem("linguo_is_formal") === "true");
  const [isSlowMode, setIsSlowMode] = useState(false);
  const [uiLang, setUiLang] = useState<'es' | 'ca'>(() => (localStorage.getItem("linguo_ui_lang") as 'es' | 'ca') || 'es');
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [hiddenLangs, setHiddenLangs] = useState<string[]>(() => {
    const saved = localStorage.getItem("linguo_hidden_langs");
    return saved ? JSON.parse(saved) : [];
  });
  const [sttAlternatives, setSttAlternatives] = useState<string[]>([]);
  const [showSttPicker, setShowSttPicker] = useState(false);
  const [zoom, setZoom] = useState(() => Number(localStorage.getItem("linguo_zoom")) || 1);
  const [showZoomBadge, setShowZoomBadge] = useState(false);
  const zoomTimerRef = useRef<any>(null);
  const pinchRef = useRef({ lastDist: 0 });
  const [showLangPicker, setShowLangPicker] = useState<false | 'source' | 'target'>(false);

  useEffect(() => {
    localStorage.setItem("linguo_zoom", zoom.toString());
    setShowZoomBadge(true);
    if (zoomTimerRef.current) clearTimeout(zoomTimerRef.current);
    zoomTimerRef.current = setTimeout(() => setShowZoomBadge(false), 5000);
  }, [zoom]);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        setZoom(z => Math.min(Math.max(z + (e.deltaY > 0 ? -0.05 : 0.05), 0.5), 2.5));
      }
    };
    
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchRef.current.lastDist = Math.hypot(
          e.touches[0].pageX - e.touches[1].pageX,
          e.touches[0].pageY - e.touches[1].pageY
        );
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dist = Math.hypot(
          e.touches[0].pageX - e.touches[1].pageX,
          e.touches[0].pageY - e.touches[1].pageY
        );
        const delta = (dist - pinchRef.current.lastDist) / 300;
        setZoom(z => Math.min(Math.max(z + delta, 0.5), 2.5));
        pinchRef.current.lastDist = dist;
      }
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey) {
        if (e.key === '+' || e.key === '=') { e.preventDefault(); setZoom(z => Math.min(z + 0.1, 2.5)); }
        if (e.key === '-') { e.preventDefault(); setZoom(z => Math.max(z - 0.1, 0.5)); }
        if (e.key === '0') { e.preventDefault(); setZoom(1); }
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('keydown', handleKey);
    
    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('keydown', handleKey);
    };
  }, []);

  const T = {
    es: {
      study: "Estudio",
      history: "Historial",
      vault: "Mi Baúl",
      settings: "Ajustes",
      welcome: "Palabra de Sabiduría",
      input: "Entrada de Dades",
      translate: "Traducir",
      offline: "MODO OFFLINE",
      camera: "Cámara",
      gallery: "Galería",
      dictate: "Dictar",
      voicePackTitle: "Voz Offline (Android)",
      voicePackLabel: "Para dictar sin internet, ve a Ajustes > Idioma > Dictado por voz de Google > Idiomas descargados.",
      deleteLang: "Eliminar Idioma",
      confirmDelete: "¿Seguro que quieres quitar este idioma de tu parrilla?",
      sttAmbiguity: "¿Qué idioma estás hablando?"
    },
    ca: {
      study: "Estudi",
      history: "Historial",
      vault: "El meu Baúl",
      settings: "Ajustos",
      welcome: "Paraula de Saviesa",
      input: "Entrada de Dades",
      translate: "Traduir",
      offline: "MODALITAT OFFLINE",
      camera: "Càmera",
      gallery: "Galeria",
      dictate: "Dictar",
      voicePackTitle: "Veu Offline (Android)",
      voicePackLabel: "Per dictar sense internet, ves a Ajustos > Idioma > Dictat per veu de Google > Idiomes descarregats.",
      deleteLang: "Eliminar Idioma",
      confirmDelete: "Segur que vols treure aquest idioma de la teva graella?",
      sttAmbiguity: "Quin idioma estàs parlant?"
    }
  }[uiLang];
  const [favorites, setFavorites] = useState<TranslationResult[]>(() => {
    const saved = localStorage.getItem("linguo_favorites");
    return saved ? JSON.parse(saved) : [];
  });
  const [showVault, setShowVault] = useState(false);
  const [showTrainingCenter, setShowTrainingCenter] = useState(false);
  const [trainingMode, setTrainingMode] = useState<'none' | 'roleplay' | 'quiz' | 'shadowing'>('none');
  const [trainingMessage, setTrainingMessage] = useState("");
  const [shadowingScore, setShadowingScore] = useState<number | null>(null);
  const [shadowingFeedback, setShadowingFeedback] = useState<string | null>(null);
  const [quizOptionSelected, setQuizOptionSelected] = useState<string | null>(null);
  const [quizScore, setQuizScore] = useState({ correct: 0, total: 0 });
  const [roleplayStep, setRoleplayStep] = useState(0);
  const [activeSelector, setActiveSelector] = useState<'source' | 'target'>('target');
  const [isOffline, setIsOffline] = useState(false);
  const [editingFavIndex, setEditingFavIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ originalText: "", translation: "" });
  
  const [downloadedModels, setDownloadedModels] = useState<string[]>(() => {
    const saved = localStorage.getItem("linguo_downloaded_models");
    return saved ? JSON.parse(saved) : [];
  });
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [currentDownloadPair, setCurrentDownloadPair] = useState("");
  const [offlineSearch, setOfflineSearch] = useState("");
  const [customLangs, setCustomLangs] = useState<{name: string, flag: string, color: string}[]>(() => {
    const saved = localStorage.getItem("linguo_custom_langs");
    return saved ? JSON.parse(saved) : [];
  });
  
  useEffect(() => {
    /* const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    }; */
  }, []);
  
  // Refs para evitar cierres obsoletos y gestionar estado real del micro
  const recognitionStateRef = useRef({ trainingMode, handleTraining, targetLang, sourceLang });
  const swapLanguages = () => {
    if (sourceLang === 'Auto') return;
    const temp = sourceLang;
    setSourceLang(targetLang);
    setTargetLang(temp);
  };
  const isActuallyListeningRef = useRef(false);

  useEffect(() => {
    recognitionStateRef.current = { trainingMode, handleTraining, targetLang, sourceLang };
  }, [trainingMode, handleTraining, targetLang, sourceLang]);

  // Actualizar idioma de reconocimiento si cambia sourceLang
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = ISO_LANG_MAP[sourceLang] || "es-ES";
    }
  }, [sourceLang]);

  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const selectedFileRef = useRef<File | null>(null);

  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [micPermission, setMicPermission] = useState<string>("unknown");
  const isIframe = window.self !== window.top;
  const [wordOfTheDay, setWordOfTheDay] = useState<{
    phrase: string, 
    meaning: string,
    pronunciation: string,
    usage: string,
    language: string
  } | null>(null);
  const [showWordDetails, setShowWordDetails] = useState(false);

  const LANGUAGES = [
    ...STATIC_LANGUAGES,
    ...customLangs
  ];

  const refreshWordOfTheDay = (force: boolean = false) => {
    const today = new Date().toDateString();
    const lastWordDate = localStorage.getItem("linguo_word_date");
    const savedWord = localStorage.getItem("linguo_word_data");
    const parsedWord = savedWord ? JSON.parse(savedWord) : null;

    if (!force && parsedWord && parsedWord.pronunciation && lastWordDate === today) {
      setWordOfTheDay(parsedWord);
    } else {
      let randomWord;
      // Evitar repetir la misma palabra si forzamos el cambio
      do {
        randomWord = TUTOR_PHRASES[Math.floor(Math.random() * TUTOR_PHRASES.length)];
      } while (force && randomWord.phrase === wordOfTheDay?.phrase);

      setWordOfTheDay(randomWord);
      localStorage.setItem("linguo_word_date", today);
      localStorage.setItem("linguo_word_data", JSON.stringify(randomWord));
    }
  };

  // Determinar color de acento dinámico
  const currentThemeColor = LANGUAGES.find(l => l.name === targetLang)?.color || "#f59e0b";

  useEffect(() => {
    // Guardar modelo si cambia
    localStorage.setItem("linguo_model", selectedModel);
    localStorage.setItem("linguo_is_formal", isFormal.toString());
    localStorage.setItem("linguo_favorites", JSON.stringify(favorites));
  }, [selectedModel, isFormal, favorites]);

  useEffect(() => {
    setIsInIframe(window.self !== window.top);
    
    // Check if already installed
    const checkStandalone = () => {
      const isS = window.matchMedia('(display-mode: standalone)').matches || 
                 (window.navigator as any).standalone || 
                 document.referrer.includes('android-app://');
      setIsStandalone(!!isS);
    };
    checkStandalone();
  }, []);

  // Key Detection
  useEffect(() => {
    const envKey = process.env.GEMINI_API_KEY;
    const effectiveKey = (activeApiKey || envKey)?.replace(/['"`]+/g, '').trim();
    const isValid = !!(effectiveKey && effectiveKey.length > 20);
    
    if (!effectiveKey) {
      setApiDiagnostics("SISTEMA: No se detecta ninguna clave. Usa el menú de ajustes.");
    } else {
      setApiDiagnostics("SISTEMA: Conexión lista.");
    }
    
    setIsApiKeyReady(isValid);
  }, [activeApiKey]);

  useEffect(() => {
    // Service Worker Status
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        setSwStatus(reg.active ? "SISTEMA ACTIVO" : "PENDIENTE");
      });
      if (navigator.serviceWorker.controller) {
        setSwStatus("SISTEMA ACTIVO");
      }
    }

    // PWA Install detection
    const handleBeforeInstall = (e: any) => {
      console.log('Evento beforeinstallprompt capturado en App');
      e.preventDefault();
      setDeferredPrompt(e);
      setPromptStatus("¡LISTO PARA INSTALAR!");
    };
    
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    
    window.addEventListener('appinstalled', () => {
      console.log('PWA: Instalada con éxito');
      setDeferredPrompt(null);
      setIsStandalone(true);
    });

    window.addEventListener('pwa-ready', () => {
      if ((window as any).deferredInstallPrompt) {
        setDeferredPrompt((window as any).deferredInstallPrompt);
        setPromptStatus("¡LISTO PARA INSTALAR!");
      }
    });

    // Check if it was already captured in index.html
    if ((window as any).deferredInstallPrompt) {
      setDeferredPrompt((window as any).deferredInstallPrompt);
      setPromptStatus("¡LISTO!");
    }

    // Load history
    const saved = localStorage.getItem("linguo_history");
    if (saved) setHistory(JSON.parse(saved));

    // Generar palabra del día cada 24h aprox o si no existe
    refreshWordOfTheDay();

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("linguo_history", JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem("linguo_downloaded_models", JSON.stringify(downloadedModels));
  }, [downloadedModels]);

  useEffect(() => {
    localStorage.setItem("linguo_custom_langs", JSON.stringify(customLangs));
  }, [customLangs]);

  useEffect(() => {
    localStorage.setItem("linguo_hidden_langs", JSON.stringify(hiddenLangs));
  }, [hiddenLangs]);

  // Sincronizar banderas de idiomas personalizados si han cambiado en el mapa global
  useEffect(() => {
    setCustomLangs(prev => prev.map(l => ({
      ...l,
      flag: l.flag === "🌐" ? (FLAG_MAP[l.name] || "🌐") : l.flag
    })));
  }, []);

  const installFullPackForPair = async (src: string, tgt: string) => {
    setApiDiagnostics(`SISTEMA: Preparando paquete completo para ${src} ➔ ${tgt}...`);
    
    // Si ninguno es inglés, necesitamos el puente
    if (src !== 'Inglés' && tgt !== 'Inglés') {
      // Necesitamos: src -> en, en -> tgt (y viceversa para que sea bidireccional)
      await downloadLanguageModel(src, "Inglés");
      await downloadLanguageModel("Inglés", src);
      await downloadLanguageModel("Inglés", tgt);
      await downloadLanguageModel(tgt, "Inglés");
    } else {
      // Si uno es inglés, descarga directa bidireccional
      await downloadLanguageModel(src, tgt);
      await downloadLanguageModel(tgt, src);
    }
    
    setApiDiagnostics(`SISTEMA: Combinación ${src} ➔ ${tgt} lista para uso Offline.`);
  };

  const installNewLanguage = async (langName: string) => {
    if (!ISO_LANG_MAP[langName]) return;
    
    // 1. Añadir a la lista de idiomas si no está
    if (!customLangs.find(l => l.name === langName) && !LANGUAGES.find(l => l.name === langName)) {
      setCustomLangs(prev => [...prev, { name: langName, flag: FLAG_MAP[langName] || "🌐", color: "#6366f1" }]);
    }
    // Si ya existe pero estaba oculto, lo desocultamos
    if (hiddenLangs.includes(langName)) {
      setHiddenLangs(prev => prev.filter(l => l !== langName));
    }

    // 2. Descargar modelo base para el idioma
    await installFullPackForPair("Inglés", langName);
    
    // 3. Generar una "sabiduría" inicial para ese idioma si hay internet
    if (navigator.onLine && isApiKeyReady) {
      try {
        const envKey = process.env.GEMINI_API_KEY;
        const key = (activeApiKey || envKey)?.replace(/['"`]+/g, '').trim();
        const ai = new GoogleGenAI({ apiKey: key! });
        const prompt = `Genera una frase representativa en ${langName} con su traducción al español, pronunciación y contexto. Responde solo en JSON: {"phrase": "...", "meaning": "...", "pronunciation": "...", "usage": "...", "language": "${langName}"}`;
        
        const res = await ai.models.generateContent({
          model: "gemini-1.5-flash",
          contents: prompt,
          config: { responseMimeType: "application/json" }
        });

        const data = JSON.parse(res.text);
        setWordOfTheDay(data);
        setShowWordDetails(true);
      } catch (e) {
        console.error("No se pudo generar saludo inicial.");
      }
    }
  };

  const downloadLanguageModel = async (src: string, tgt: string) => {
    const s = ISO_LANG_MAP[src];
    const t = ISO_LANG_MAP[tgt];
    if (!s || !t) {
      setError(`El idioma ${src} o ${tgt} no es compatible con el motor offline.`);
      return;
    }

    const pairId = `${s}-${t}`;
    setIsDownloading(true);
    setDownloadProgress(0);
    setCurrentDownloadPair(`${src} → ${tgt}`);

    try {
      // Forzar la descarga inicial del modelo llamando a la utilidad
      await translateOffline("test", src, tgt, (p: number) => {
        setDownloadProgress(Math.round(p));
      });
      setDownloadedModels(prev => [...new Set([...prev, pairId])]);
      setApiDiagnostics(`SISTEMA: Modelo ${pairId} listo para uso offline.`);
    } catch (err: any) {
      setError(`Error de descarga: ${err.message}`);
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  // Persistir modelos descargados
  useEffect(() => {
    localStorage.setItem("linguo_downloaded_models", JSON.stringify(downloadedModels));
  }, [downloadedModels]);

  // Monitorizar permiso de micro
  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'microphone' as any }).then(p => {
        setMicPermission(p.state);
        p.onchange = () => setMicPermission(p.state);
      }).catch(() => setMicPermission("unsupported"));
    }
  }, []);

  // Voice recognition setup
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = ISO_LANG_MAP[sourceLang] || "es-ES";

      recognitionRef.current.onresult = (event: any) => {
        const { trainingMode, handleTraining } = recognitionStateRef.current;
        const transcript = event.results[0]?.[0]?.transcript;
        if (!transcript) return;

        if (trainingMode === 'shadowing') {
          handleTraining(transcript);
        } else {
          // Sobrescribir en lugar de concatenar si es una frase nueva (mejora UX solicitada)
          setInput(transcript);
          
          // Detección de ambigüedad si estamos en Auto
          const { sourceLang } = recognitionStateRef.current;
          if (sourceLang === 'Auto') {
            const lowers = transcript.trim().toLowerCase();
            const polysemic = [
              "hola", "amiga", "amigo", "ciao", "si", "no", "agaza", "agafa", 
              "coche", "cotxe", "bon", "vui", "menjar", "voy", "manchar", "manjar", "vull"
            ];
            const isGreek = /[\u0370-\u03FF]/.test(transcript);
            
            // Si la transcripción suena a algo que no existe en español pero sí en catalán (o viceversa)
            // o si son palabras cortas muy similares.
            const wordCount = lowers.split(/\s+/).length;
            const soundsLikeCA = lowers.includes("agaza") || lowers.includes("agafa") || lowers.includes("cotxe") || 
                                 lowers.includes("vui") || lowers.includes("menjar") || lowers.includes("voy manchar") ||
                                 lowers.includes("vull");

            // Si detectamos patrones fonéticos de riesgo o frases cortas ambiguas
            if ((wordCount <= 6 && polysemic.some(p => lowers.includes(p))) || isGreek || soundsLikeCA) {
              setSttAlternatives(["Español", "Catalán", "Italiano", "Griego"]);
              setShowSttPicker(true);
            }
          }
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech Error:", event.error);
        if (event.error === 'not-allowed') {
          setError("Micro bloqueado por el navegador. Pulsa el botón de abajo 'Abrir en ventana nueva' para activarlo correctamente.");
        } else if (event.error === 'network') {
          setError("Error de red en el dictado.");
        }
        setIsListening(false);
        isActuallyListeningRef.current = false;
      };

      recognitionRef.current.onstart = () => {
        setIsListening(true);
        isActuallyListeningRef.current = true;
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        isActuallyListeningRef.current = false;
      };
    }
  }, []);

  const toggleListening = async () => {
    if (!recognitionRef.current) {
      setError("Tu navegador no soporta dictado por voz.");
      return;
    }

    if (isActuallyListeningRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        setIsListening(false);
        isActuallyListeningRef.current = false;
      }
    } else {
      setError(null);
      setResult(null); // Limpiar resultado anterior al empezar a escuchar
      setInput("");    // Limpiar input anterior

      // Intentar forzar petición de permiso si no está garantizado (solución robusta para móviles)
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasMic = devices.some(d => d.kind === 'audioinput');
        if (!hasMic) {
          setError("No se detecta ningún micrófono conectado a tu dispositivo.");
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop()); // Cerramos el stream inmediatamente, solo queríamos el permiso
      } catch (err: any) {
        console.error("Permission Primer Error:", err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError("Acceso al micrófono denegado. Pulsa el 'candado' junto a la URL y activa el Micrófono, o usa 'Abrir en nueva ventana'.");
          return;
        }
      }
      
      const sttVoiceMap: Record<string, string> = {
        "Inglés": "en-US", "Francés": "fr-FR", "Alemán": "de-DE",
        "Italiano": "it-IT", "Portugués": "pt-PT", "Chino": "zh-CN",
        "Japonés": "ja-JP", "Coreano": "ko-KR", "Ruso": "ru-RU",
        "Hindi": "hi-IN", "Árabe": "ar-SA", "Árabe Egipcio": "ar-EG", "Ucraniano": "uk-UA",
        "Hebreo": "he-IL", "Catalán": "ca-ES", "Rumano": "ro-RO", "Eusquera": "eu-ES",
        "Latín": "it-IT", "Esperanto": "eo", "Quechua": "es-PE", "Maya": "es-MX", "Español": "es-ES",
        "Griego": "el-GR", "Griego Antiguo": "el-GR", "Mandinga": "fr-FR"
      };

      const { trainingMode, targetLang, sourceLang } = recognitionStateRef.current;
      
      if (trainingMode === 'shadowing') {
        recognitionRef.current.lang = sttVoiceMap[targetLang] || "en-US";
      } else {
        recognitionRef.current.lang = sourceLang === 'Auto' ? 'es-ES' : (sttVoiceMap[sourceLang] || "es-ES");
      }
      
      try {
        recognitionRef.current.start();
      } catch (err: any) {
        console.error("Failed to start recognition:", err);
        if (err.name === 'InvalidStateError') {
          // Si ya estaba arrancado por error de sincronización, intentamos pararlo y avisar
          try { recognitionRef.current.stop(); } catch(e) {}
          setIsListening(false);
          isActuallyListeningRef.current = false;
        }
        setError("Error al iniciar micrófono. Reintenta.");
      }
    }
  };

  const loadTranslation = (item: HistoryItem | TranslationResult) => {
    // Si es un HistoryItem (del historial)
    if ('fullResult' in item && item.fullResult) {
      setSourceLang(item.source);
      setTargetLang(item.target);
      setInput(item.original);
      setResult(item.fullResult);
    } 
    // Si es un TranslationResult (del baúl)
    else {
      const res = item as TranslationResult;
      if (res.source) setSourceLang(res.source);
      if (res.target) setTargetLang(res.target);
      if (res.originalText) setInput(res.originalText);
      setResult(res);
      setShowVault(false);
    }
    
    // Scroll suave al inicio del resultado para que pueda interactuar (Voz, etc.)
    window.scrollTo({ top: 300, behavior: 'smooth' });
  };

  const deleteHistoryItem = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  const startEditingFav = (index: number, fav: TranslationResult) => {
    setEditingFavIndex(index);
    setEditForm({ 
      originalText: fav.originalText || "", 
      translation: fav.translation 
    });
  };

  const saveFavEdit = () => {
    if (editingFavIndex === null) return;
    const newFavs = [...favorites];
    newFavs[editingFavIndex] = {
      ...newFavs[editingFavIndex],
      originalText: editForm.originalText,
      translation: editForm.translation
    };
    setFavorites(newFavs);
    setEditingFavIndex(null);
  };

  const speakText = (text: string) => {
    if (!window.speechSynthesis) {
      setError("TTS not supported.");
      return;
    }
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = isSlowMode ? 0.5 : 1;
    
    // Buscar voz disponible dinámicamente según el idioma
    const voices = window.speechSynthesis.getVoices();
    const langCode = ISO_LANG_MAP[targetLang]?.split('-')[0] || 'es';
    
    // Prioridad: 1. Voz exacta, 2. Voz idioma, 3. Voz por defecto
    const matchingVoice = voices.find(v => v.lang.startsWith(ISO_LANG_MAP[targetLang] || '')) ||
                          voices.find(v => v.lang.startsWith(langCode)) ||
                          voices.find(v => v.lang.startsWith('es'));
    
    if (matchingVoice) {
      utterance.voice = matchingVoice;
      utterance.lang = matchingVoice.lang;
    }
    
    window.speechSynthesis.speak(utterance);
  };

  // Presistencia de Estado Crítico
  useEffect(() => {
    localStorage.setItem("linguo_source_lang", sourceLang);
    localStorage.setItem("linguo_target_lang", targetLang);
  }, [sourceLang, targetLang]);

  useEffect(() => {
    localStorage.setItem("linguo_history", JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem("linguo_current_input", input);
  }, [input]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError("Solo imágenes.");
      return;
    }

    setError(null);
    setLoading(true);

    // Guardamos referencia mínima
    selectedFileRef.current = file;

    // Compresión agresiva inmediata para salvar RAM
    const reader = new FileReader();
    reader.onload = (re) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const previewSize = 300; 
        canvas.width = previewSize;
        canvas.height = (img.height / img.width) * previewSize;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const thumb = canvas.toDataURL('image/jpeg', 0.4);
        setSelectedImage(thumb);
        localStorage.setItem("linguo_current_img", thumb); // PERSISTENCIA PARA REINICIOS
        setLoading(false);
      };
      img.src = re.target?.result as string;
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const handleOnlineTranslation = async (activeInput: string, usedOfflineOcr: boolean) => {
    const isVisionRequest = !!selectedFileRef.current;
    const envKey = process.env.GEMINI_API_KEY;
    const effectiveKey = activeApiKey || envKey;
    const key = effectiveKey?.replace(/['"`]+/g, '').trim();
    
    if (!key || key === 'undefined' || key === 'null' || key === '') {
      throw new Error("SIN CLAVE: Introduce tu API Key en los ajustes (icono del engranaje abajo a la izquierda).");
    }

    const systemInstruction = `Eres un sistema de traducción PEDAGÓGICO y LITERAL. 
TU REGLA DE ORO: Debes traducir el texto PALABRA POR PALABRA. 
${isFormal ? '- TONO: FORMAL. Usa formas de cortesía (Usted, Vous, Sie, etc.). Traducción educada e impecable.' : '- TONO: COLEGA/SLANG. Usa lenguaje de la calle, contracciones y términos coloquiales reales. Explica las jergas.'}
- Si el texto dice "Fumar mata", la traducción DEBE ser el equivalente exacto de "Fumar mata" (ej: "Fumer tue" en francés), NUNCA una interpretación como "Prohibido fumar" o "Défense de fumer".
- Eres un ESCÁNER DE TEXTO HUMANO. Tu primera misión es transcribir exactamente lo que ves, sin ignorar palabras ni añadir cortesía que no existe.
- Si hay una imagen, ignora el fondo y el paisaje; concéntrate ÚNICAMENTE en extraer los caracteres del texto.
- No resumas. No parafrasees. Traduce fielmente.`;

    const promptText = `TRADUCCIÓN REQUERIDA:
Idioma Origen: ${sourceLang === 'Auto' ? 'DETECTAR AUTOMÁTICAMENTE' : sourceLang}
Idioma Destino: ${targetLang}
${isVisionRequest ? 'IMAGEN ADJUNTA: Extrae el texto y tradúcelo literalmente.' : 'TEXTO A TRADUCIR: "' + activeInput + '"'}
${activeInput && isVisionRequest ? 'Contexto adicional: ' : ''}${activeInput && isVisionRequest ? activeInput : ''}

Responde solo en JSON:
{
  "translation": "Traducción palabra por palabra",
  "originalText": "Transcripción íntegra del texto original",
  "phonetic": "Pronunciación intuitiva del Idioma Destino",
  "explanation": "Análisis del significado real en el idioma del usuario",
  "grammarBreakdown": [{"term": "Palabra", "description": "Función"}],
  "culturalNote": "Contexto de uso real",
  "tips": ["Consejo"],
  "pronunciationTip": "Instrucción física breve para mejorar la pronunciación (ej: 'Coloca la lengua...')"
}`;

    let contents: any;

    // Procesamiento Ultra-Estructurado para evitar Crash
    if (selectedFileRef.current || selectedImage) {
      try {
        const base64Data = await new Promise<string>((resolve, reject) => {
          // Si el archivo original se perdió por reinicio, usamos la miniatura persistente
          if (!selectedFileRef.current && selectedImage) {
            resolve(selectedImage.split(',')[1]);
            return;
          }
          
          const file = selectedFileRef.current!;
          const reader = new FileReader();
          reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              const MAX_OCR = 850; 
              let w = img.width;
              let h = img.height;
              if (w > MAX_OCR) { h *= MAX_OCR / w; w = MAX_OCR; }
              canvas.width = w; canvas.height = h;
              const ctx = canvas.getContext('2d');
              ctx?.drawImage(img, 0, 0, w, h);
              resolve(canvas.toDataURL('image/jpeg', 0.6).split(',')[1]);
            };
            img.onerror = reject;
            img.src = e.target?.result as string;
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        contents = [
          { inlineData: { data: base64Data, mimeType: 'image/jpeg' } },
          { text: promptText }
        ];
      } catch (imgErr) {
        throw new Error("Memoria insuficiente del terminal. Prueba con una foto de la galería.");
      }
    } else {
      contents = promptText;
    }

    const ai = new GoogleGenAI({ apiKey: key });
    
    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: isVisionRequest ? { parts: contents } : contents,
      config: {
        systemInstruction,
        responseMimeType: "application/json"
      }
    });

    const outputText = response.text;

    if (!outputText) throw new Error("Sin respuesta de la IA. Por favor, reintenta.");

    try {
      const data = JSON.parse(outputText) as TranslationResult;
      data.source = sourceLang;
      data.target = targetLang;
      setResult(data);
      setSelectedImage(null);
      selectedFileRef.current = null; // Limpieza final solo al éxito
      
      // Auto-pronunciación de la traducción
      if (data.translation) {
        speakText(data.translation);
      }
      
      const newItem: HistoryItem = {
        id: Math.random().toString(36).substring(7),
        original: data.originalText || activeInput || "Imagen",
        translated: data.translation,
        timestamp: Date.now(),
        source: sourceLang,
        target: targetLang,
        fullResult: data
      };
      setHistory(prev => [newItem, ...prev.slice(0, 9)]);
    } catch (parseErr) {
      console.error("Parse error:", response.text);
      throw new Error("La IA envió datos ilegibles. Pulsa traducir de nuevo.");
    }
  };

  const handleTranslate = async () => {
    if ((!input.trim() && !selectedImage) || loading) return;
    
    setLoading(true);
    setError(null);
    setResult(null);

    const sCode = ISO_LANG_MAP[sourceLang];
    const tCode = ISO_LANG_MAP[targetLang];

    try {
      let activeInput = input;
      let usedOfflineOcr = false;

      // 1. VERIFICACIÓN OFFLINE + OCR LOCAL (Siempre disponible para intentar OCR si hay imagen offline)
      
        // ¿Hay imagen pero no hay texto? Intentamos OCR Offline
        if ((selectedImage || selectedFileRef.current) && !input.trim()) {
          setApiDiagnostics("SISTEMA: Iniciando Visión Artificial Offline...");
          setIsOcrLoading(true);
          try {
            const tesseractLang = TESSERACT_LANG_MAP[sourceLang] || 'eng';
            const { data: { text } } = await (await import("tesseract.js")).recognize(
              selectedImage || "", 
              tesseractLang,
              { logger: m => console.log(m) }
            );
            
            if (!text || text.trim().length === 0) {
              throw new Error("No se detectó texto en la imagen (Modo Offline).");
            }
            
            activeInput = text.trim();
            setInput(activeInput);
            usedOfflineOcr = true;
          } catch (ocrErr: any) {
            throw new Error(`Error en Visión Offline: ${ocrErr.message}`);
          } finally {
            setIsOcrLoading(false);
          }
        }

        const sCode = ISO_LANG_MAP[sourceLang];
        const tCode = ISO_LANG_MAP[targetLang];
        const pairId = `${sCode}-${tCode}`;

        if (downloadedModels.includes(pairId)) {
          try {
            const offlineTranslation = await translateOffline(activeInput, sourceLang, targetLang);
            const offlineData: TranslationResult = {
              translation: offlineTranslation,
              originalText: activeInput,
              explanation: `*Traducción generada mediante IA local (Offline)*.${usedOfflineOcr ? ' El texto fue extraído mediante Visión Artificial local.' : ''} Sin conexión a internet, el análisis gramatical y cultural está limitado.`,
              tips: ["Vuelve a traducir con conexión para obtener detalles culturales y gramaticales profundos."],
              source: sourceLang,
              target: targetLang
            };
            setResult(offlineData);
            
            const newItem: HistoryItem = {
              id: Math.random().toString(36).substring(7),
              original: activeInput,
              translated: offlineTranslation,
              timestamp: Date.now(),
              source: sourceLang,
              target: targetLang,
              fullResult: offlineData
            };
            setHistory(prev => [newItem, ...prev.slice(0, 9)]);
            setLoading(false);
            return;
          } catch (offlineErr) {
            console.warn("Fallo en traducción offline, intentando online:", offlineErr);
            // Fallo silencioso: continuamos al código de abajo para intentar Online
          }
        }
        
        // Intentamos siempre la traducción online
        await handleOnlineTranslation(activeInput, usedOfflineOcr);

    } catch (e: any) {
      console.error("DEBUG API ERROR:", e);
      let msg = e.message || "Error al traducir.";
      
      // Manejo de errores amigable
      if (e.message && (e.message.includes("429") || e.message.toLowerCase().includes("quota"))) {
        msg = "¡SERVICIO SATURADO! Google ha pausado las traducciones unos segundos por exceso de uso. Espera 10 segundos y vuelve a intentarlo.";
      }
      
      if (msg.toLowerCase().includes("not found") || msg.toLowerCase().includes("404")) {
        msg = `MODELO NO ENCONTRADO (404): El modelo seleccionado '${selectedModel}' no está disponible para tu clave. Prueba con otro modelo en Ajustes.`;
      }
      
      if (e.status) msg = `(Error ${e.status}): ${msg}`;
      setError(msg);

      setApiDiagnostics(null);
      setIsOcrLoading(false);
    } finally {
        setLoading(false);
    }
  };

  async function handleTraining(userResponse?: string) {
    setLoading(true);
    setError(null);
    try {
      const envKey = process.env.GEMINI_API_KEY;
      const effectiveKey = activeApiKey || envKey;
      const key = effectiveKey?.replace(/['"`]+/g, '').trim();
      if (!key) throw new Error("API Key requerida.");

      const ai = new GoogleGenAI({ apiKey: key });
      let prompt = "";
      let systemInstruction = "";

      if (trainingMode === 'roleplay') {
        systemInstruction = `Eres un nativo en un escenario de simulacro: "${trainingMessage}".
        Tu misión:
        1. Responde de forma natural al usuario en ${targetLang}.
        2. Analiza su respuesta anterior (si existe) y corrígela pedagógicamente.
        3. Mantén la conversación viva.
        Responde en JSON:
        {
          "response": "Tu respuesta en ${targetLang}",
          "correction": "Explicación de errores del usuario en español",
          "advice": "Consejo para sonar más nativo",
          "phonetic": "Pronunciación de tu respuesta"
        }`;
        prompt = userResponse || "Hola, empecemos el simulacro.";
      } else if (trainingMode === 'shadowing') {
        systemInstruction = `Eres un experto fonetista. Tu tarea es evaluar la pronunciación del usuario para el idioma ${targetLang}.
        
        Frase objetivo: "${trainingMessage}"
        Texto capturado por el micro: "${userResponse}"
        
        Instrucciones críticas:
        1. Identificación de Idioma: Determina si el texto capturado se asemeja al idioma ${targetLang}. Si el usuario habló en otro idioma (ej. español), penaliza la puntuación y menciónalo.
        2. Comparación Fonética: Compara la frase objetivo con lo capturado. Detecta errores comunes de hispanohablantes (ej. confusión de vocales, r fuerte vs suave, aspiraciones).
        3. Puntuación: Dale un score de 1 a 100 basado en la fidelidad.
        4. Feedback: Sé animador pero preciso. Explica qué sonidos específicos debe mejorar.
        
        Responde estrictamente en JSON:
        {
          "score": número,
          "feedback": "Feedback en español detallado, indicando si el idioma detectado es correcto."
        }`;
        prompt = `Evaluación de shadowing: Objetivo "${trainingMessage}", Usuario dijo "${userResponse}"`;
      }

      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json"
        }
      });

      const data = JSON.parse(response.text);
      if (trainingMode === 'roleplay') {
        setResult({
          translation: data.response,
          explanation: data.correction,
          phonetic: data.phonetic,
          tips: [data.advice],
          grammarBreakdown: []
        });
        setRoleplayStep(prev => prev + 1);
      } else if (trainingMode === 'shadowing') {
        setShadowingScore(data.score);
        setShadowingFeedback(data.feedback);
      }
    } catch (err: any) {
      setError("Error en el entrenamiento: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleInstall = async () => {
    if (!deferredPrompt) {
      setShowInstallHelp(true);
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  return (
    <div 
      className="flex flex-col h-screen bg-[#09090b] text-zinc-100 font-sans selection:bg-amber-500/30 overflow-hidden"
      style={{ scale: zoom, transformOrigin: 'top center' }}
    >
      <AnimatePresence>
        {showZoomBadge && (
          <motion.div 
            initial={{ y: -50, opacity: 0, x: '-50%' }}
            animate={{ y: 0, opacity: 1, x: '-50%' }}
            exit={{ y: -50, opacity: 0, x: '-50%' }}
            className="fixed top-20 left-1/2 z-[100] flex items-center gap-2 pointer-events-none"
          >
            <div className="bg-amber-500 text-black px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-2xl flex items-center gap-3">
              <span>Zoom: {Math.round(zoom * 100)}%</span>
              {zoom !== 1 && (
                <button 
                  onClick={() => setZoom(1)}
                  className="pointer-events-auto bg-black/20 hover:bg-black/40 px-2 py-0.5 rounded-md text-[8px] transition-colors"
                >
                  RESET 100%
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Header - Technical & Clean */}
      <header className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between sticky top-0 bg-[#09090b]/90 backdrop-blur-xl z-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center shadow-inner group relative">
             <Languages className={cn("transition-all duration-500", isApiKeyReady && !isOffline ? "text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)]" : "text-zinc-700")} size={22} />
             {isOffline && (
               <div className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5 border border-black animate-pulse">
                <WifiOff size={8} className="text-white" />
               </div>
             )}
          </div>
          <div className="flex flex-col">
            <h1 className="font-mono font-black text-lg tracking-tighter leading-none italic uppercase">LINGUO <span className="text-amber-500">PRO</span></h1>
            <div className="flex items-center gap-1.5 mt-1">
              <div className={cn("w-1.5 h-1.5 rounded-full", isApiKeyReady && !isOffline ? "bg-green-500 shadow-[0_0_5px_#22c55e]" : "bg-red-500 animate-pulse")} />
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-400">
                {isOffline ? "Offline Mode" : (isApiKeyReady ? "Hardware Active" : "Key Error / Check Settings")}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {!isStandalone && (
            <button 
              onClick={() => window.open(window.location.href, '_blank')}
              className="p-2.5 bg-zinc-900 border border-zinc-800 hover:border-amber-500/50 rounded-xl text-zinc-400 transition-all active:scale-95"
              title="Abrir en ventana nueva"
            >
              <Maximize2 size={18} />
            </button>
          )}
          
          {deferredPrompt && !isStandalone && (
            <button 
              onClick={handleInstall}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-black font-bold rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.2)] hover:bg-amber-400 transition-all text-xs uppercase"
            >
              <Download size={16} />
              <span>Instalar</span>
            </button>
          )}
          
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-xl text-zinc-400 transition-all"
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full space-y-8">
        {/* Widget: Palabra del día - Ahora más visible */}
        <AnimatePresence>
          {wordOfTheDay && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setShowWordDetails(true)}
              className="bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/20 rounded-3xl p-5 flex items-center justify-between gap-4 cursor-pointer hover:border-amber-500/40 transition-all group"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-amber-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">Sabiduría del Tutor</span>
                </div>
                <p className="text-xl font-black text-white italic tracking-tight">"{wordOfTheDay.phrase}"</p>
                <p className="text-xs text-zinc-400 font-medium">{wordOfTheDay.meaning} • {wordOfTheDay.language}</p>
              </div>
              <div className="bg-amber-500/20 p-3 rounded-2xl group-hover:scale-110 transition-transform">
                <BookOpen size={24} className="text-amber-500" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Acceso al Centro de Entrenamiento */}
        <section className="px-1">
          <button 
            onClick={() => setShowTrainingCenter(true)}
            className="w-full p-6 bg-zinc-900 border border-zinc-800 rounded-3xl flex items-center justify-between group hover:border-amber-500/50 transition-all shadow-xl"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Dumbbell className="text-amber-500" size={24} />
              </div>
              <div className="text-left">
                <h2 className="text-sm font-black uppercase tracking-widest text-white">Centro de Entrenamiento</h2>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter">Entrena tu pronunciación y fluidez</p>
              </div>
            </div>
            <ChevronRight className="text-zinc-700 group-hover:text-amber-500 group-hover:translate-x-1 transition-all" size={20} />
          </button>
        </section>
        <input 
          type="file" 
          ref={fileInputRef} 
          accept="image/*" 
          onChange={handleImageChange} 
          className="hidden" 
        />
        <input 
          type="file" 
          ref={cameraInputRef} 
          accept="image/*" 
          capture="environment"
          onChange={handleImageChange} 
          className="hidden" 
        />

        {/* Banner de Instalación Compacto */}
        {!isStandalone && !isInIframe && (
          <motion.div 
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="px-2"
          >
            <button 
              onClick={handleInstall}
              className="w-full py-4 bg-amber-500 text-black rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 active:scale-95 transition-all shadow-lg"
            >
              <Download size={18} strokeWidth={3} className={cn(deferredPrompt && "animate-bounce")} />
              {deferredPrompt ? "INSTALAR LINGUO EN TU MÓVIL" : `PREPARANDO SISTEMA...`}
            </button>
          </motion.div>
        )}

        {/* Selector de Idiomas - Nueva Versión Compacta */}
        <section className="space-y-4 px-1">
          <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-[2.5rem] p-4 flex items-center justify-between shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-1.5 flex-1">
              {/* Botón Origen */}
              <button 
                onClick={() => setShowLangPicker('source')}
                className="flex flex-col items-start gap-1 p-3 flex-1 rounded-3xl hover:bg-white/5 transition-all group"
              >
                <span className="text-[8px] font-black uppercase text-zinc-500 tracking-[0.2em] group-hover:text-amber-500 transition-colors">Origen</span>
                <div className="flex items-center gap-2">
                  <span className="text-xl">
                    {LANGUAGES.find(l => l.name === sourceLang)?.flag || "🌐"}
                  </span>
                  <span className="text-sm font-black uppercase tracking-tighter text-white">{sourceLang}</span>
                </div>
              </button>

              {/* Icono de Intercambio */}
              <div className="px-1">
                <button 
                  onClick={() => {
                    if (sourceLang !== 'Auto') {
                      swapLanguages();
                      setResult(null);
                      window.speechSynthesis.cancel();
                    }
                  }}
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-all border",
                    sourceLang === 'Auto' 
                      ? "bg-zinc-800/10 border-zinc-800 text-zinc-700 cursor-not-allowed" 
                      : "bg-zinc-800 border-zinc-700 text-amber-500 hover:scale-110 active:rotate-180"
                  )}
                >
                  <ArrowLeftRight size={18} />
                </button>
              </div>

              {/* Botón Destino */}
              <button 
                onClick={() => setShowLangPicker('target')}
                className="flex flex-col items-end gap-1 p-3 flex-1 rounded-3xl hover:bg-white/5 transition-all group"
              >
                <span className="text-[8px] font-black uppercase text-zinc-500 tracking-[0.2em] group-hover:text-amber-500 transition-colors">Traducción</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black uppercase tracking-tighter text-white">{targetLang}</span>
                  <span className="text-xl">
                    {LANGUAGES.find(l => l.name === targetLang)?.flag || "🌐"}
                  </span>
                </div>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between px-2">
            <div className="flex gap-2">
               <button 
                onClick={() => setShowVault(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-2xl border border-zinc-800 bg-zinc-900/50 text-zinc-400 text-[9px] font-black uppercase tracking-widest hover:text-white transition-all shadow-lg"
              >
                <Library size={12} />
                Mi Baúl ({favorites.length})
              </button>
            </div>

            <button 
              onClick={() => setIsFormal(!isFormal)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-2xl border transition-all text-[9px] font-black uppercase tracking-widest",
                isFormal 
                  ? "bg-zinc-800 border-zinc-700 text-zinc-400" 
                  : "bg-amber-500/10 border-amber-500/20 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.1)]"
              )}
            >
              {isFormal ? <UserCheck size={12} /> : <Zap size={12} />}
              {isFormal ? "Formal" : "Colega"}
            </button>
          </div>
        </section>

        {/* Input Area */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-400 italic">{T.input}</label>
            <div className="flex gap-2">
              <button 
                onClick={() => cameraInputRef.current?.click()}
                className="p-2 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white rounded-xl transition-all flex items-center gap-2"
                title={T.camera}
              >
                <Camera size={16} />
                <span className="text-[9px] font-bold uppercase">{T.camera}</span>
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-2 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white rounded-xl transition-all flex items-center gap-2"
                title={T.gallery}
              >
                <ImageIcon size={16} />
                <span className="text-[9px] font-bold uppercase">{T.gallery}</span>
              </button>
              <button 
                onClick={toggleListening}
                className={cn(
                  "p-2 rounded-xl transition-all border flex items-center gap-2",
                  isListening 
                    ? "bg-red-500/20 border-red-500 text-red-500 animate-pulse" 
                    : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white"
                )}
              >
                {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                <span className="text-[9px] font-bold uppercase">{isListening ? (uiLang === 'es' ? 'Escuchando' : 'Escoltant') : T.dictate}</span>
              </button>
            </div>
          </div>

          {loading && !selectedImage && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 flex flex-col items-center justify-center gap-4 animate-pulse">
              <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-300">
                {isOcrLoading ? "ESCANEANDO IMAGEN..." : "TRADUCIENDO..."}
              </p>
            </div>
          )}
          {selectedImage && (
            <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden p-2">
              <img 
                src={selectedImage} 
                alt="Previsualización" 
                className="w-full max-h-48 object-contain rounded-xl"
              />
              <button 
                onClick={() => {
                  setSelectedImage(null);
                  selectedFileRef.current = null;
                  localStorage.removeItem("linguo_current_img");
                }}
                className="absolute top-4 right-4 p-2 bg-black/60 backdrop-blur-md text-white rounded-full hover:bg-black transition-all"
              >
                <X size={16} />
              </button>
            </div>
          )}

          <div className="relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={selectedImage ? "Añade una descripción (opcional)..." : "Escribe aquí el texto que quieres traducir..."}
              className="w-full h-40 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 outline-none transition-all resize-none placeholder:text-zinc-600 shadow-inner"
            />
          </div>
          
          <button
            onClick={handleTranslate}
            disabled={(!input.trim() && !selectedImage) || loading}
            className="w-full py-5 bg-white text-black font-black rounded-2xl hover:bg-zinc-200 transition-all disabled:opacity-30 flex items-center justify-center gap-3 group shadow-2xl active:scale-[0.98] border-b-4 border-zinc-400"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
            ) : (
              <>
                <span className="tracking-[0.2em] uppercase text-xs">{T.translate}</span>
                <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </section>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex gap-3 text-red-400 text-sm"
          >
            <AlertTriangle className="shrink-0" size={18} />
            <div className="space-y-2 w-full">
              <div>
                <p className="font-bold uppercase text-[10px] tracking-widest">Error detectado</p>
                <p>{error}</p>
              </div>
              
              { (error.toLowerCase().includes("micro") || isIframe || micPermission === 'denied') && (
                <button 
                  onClick={() => window.open(window.location.href, '_blank')}
                  className="w-full mt-2 py-2 bg-red-500/20 border border-red-500/40 rounded-xl text-[10px] font-black uppercase hover:bg-red-500/30 transition-all flex items-center justify-center gap-2"
                >
                  <Maximize2 size={12} />
                  Abrir en nueva ventana para activar micro
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* Result Area */}
        {result && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
          >
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-amber-500/10 transition-colors" />
              
              {/* Header: Translation + Phonetic */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: currentThemeColor }} />
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80" style={{ color: currentThemeColor }}>Traducción Maestra</label>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setIsSlowMode(!isSlowMode)}
                      className={cn(
                        "p-3 rounded-2xl transition-all active:scale-90 border",
                        isSlowMode ? "bg-amber-500/10 border-amber-500/50 text-amber-500" : "bg-zinc-900 border-zinc-800 text-zinc-500"
                      )}
                      title="Velocidad Tortuga"
                    >
                      <Turtle size={20} />
                    </button>
                    <button 
                      onClick={() => {
                        const isFav = favorites.some(f => f.translation === result.translation);
                        if (isFav) {
                          setFavorites(prev => prev.filter(f => f.translation !== result.translation));
                        } else {
                          setFavorites(prev => [result, ...prev]);
                        }
                      }}
                      className={cn(
                        "p-3 rounded-2xl transition-all active:scale-90 border",
                        favorites.some(f => f.translation === result.translation) ? "bg-red-500/10 border-red-500 text-red-500" : "bg-zinc-900 border-zinc-800 text-zinc-500"
                      )}
                      title="Guardar en el Baúl"
                    >
                      <Heart size={20} fill={favorites.some(f => f.translation === result.translation) ? "currentColor" : "none"} />
                    </button>
                    <button 
                      onClick={() => speakText(result.translation)}
                      className="p-3 text-black rounded-2xl transition-all active:scale-90"
                      style={{ backgroundColor: currentThemeColor, boxShadow: `0 0 20px ${currentThemeColor}66` }}
                    >
                      <Volume2 size={20} />
                    </button>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <p className="text-4xl font-black text-white tracking-tight leading-tight">{result.translation}</p>
                  {result.phonetic && (
                    <p className="text-zinc-400 font-mono text-xs tracking-wide">/{result.phonetic}/</p>
                  )}
                </div>
              </div>

              <div className="h-px bg-zinc-800/50" />

              {/* Grammar Breakdown Section */}
              {result.grammarBreakdown && result.grammarBreakdown.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <BookOpen size={14} className="text-zinc-400" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-300">Desglose Gramatical</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {result.grammarBreakdown.map((item, i) => (
                      <div key={i} className="bg-black/20 rounded-xl p-3 border border-zinc-800/50">
                        <span className="text-xs font-bold" style={{ color: currentThemeColor }}>{item.term}</span>
                        <p className="text-[11px] text-zinc-300 mt-1">{item.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Explanation Markdown */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Info size={14} className="text-zinc-400" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-300 italic">Análisis del Tutor</span>
                </div>
                <div className="text-zinc-200 leading-relaxed text-sm bg-zinc-950/50 p-4 rounded-2xl border border-zinc-800/20" style={{ borderColor: `${currentThemeColor}22` }}>
                  <Markdown>{result.explanation}</Markdown>
                </div>
              </div>

              {/* Cultural Note */}
              {result.pronunciationTip && (
                <div className="p-4 rounded-2xl flex gap-3 shadow-[0_0_15px_rgba(0,0,0,0.1)] border" style={{ backgroundColor: `${currentThemeColor}11`, borderColor: `${currentThemeColor}33` }}>
                  <Volume2 style={{ color: currentThemeColor }} className="shrink-0" size={16} />
                  <div className="space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: currentThemeColor }}>Consejo de Pronunciación</span>
                    <p className="text-[11px] text-zinc-200 leading-snug italic">"{result.pronunciationTip}"</p>
                  </div>
                </div>
              )}

              {/* Cultural Note */}
              {result.culturalNote && (
                <div className="p-4 rounded-2xl flex gap-3 border" style={{ backgroundColor: `${currentThemeColor}05`, borderColor: `${currentThemeColor}11` }}>
                  <Languages style={{ color: currentThemeColor }} className="shrink-0" size={16} />
                  <div className="space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: currentThemeColor }}>Contexto Cultural</span>
                    <p className="text-[11px] text-zinc-300 leading-snug">{result.culturalNote}</p>
                  </div>
                </div>
              )}

              {/* Tips */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2">
                {result.tips.map((tip, i) => (
                  <div key={i} className="bg-zinc-950 border border-zinc-800/80 p-4 rounded-2xl flex gap-3 group/tip hover:border-amber-500/30 transition-colors">
                    <Sparkles className="text-amber-500 shrink-0 group-hover/tip:scale-110 transition-transform" size={16} />
                    <p className="text-[11px] text-zinc-400 leading-snug">{tip}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* History */}
        {history.length > 0 && (
          <section className="space-y-4 pt-4 pb-12">
            <div className="flex flex-col gap-4 px-1">
              <div className="flex items-center justify-between">
                <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-400 italic">Cronología de Aprendizaje</h2>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-zinc-500" />
                  <span className="text-[10px] font-mono text-zinc-400 uppercase">{history.length} ITEMS</span>
                </div>
              </div>
              
              <button 
                onClick={() => {
                  if (isResetting) {
                    setHistory([]);
                    setIsResetting(false);
                  } else {
                    setIsResetting(true);
                    setTimeout(() => setIsResetting(false), 3000); // 3 segundos para confirmar
                  }
                }}
                className={cn(
                  "w-full py-4 border rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] group font-black uppercase tracking-[0.2em] text-[10px]",
                  isResetting 
                    ? "bg-red-500 text-white border-red-500 animate-pulse" 
                    : "border-red-500/20 bg-red-500/5 text-red-500 hover:bg-red-500/10"
                )}
              >
                <Trash2 size={16} className={isResetting ? "animate-bounce" : "group-hover:rotate-12 transition-transform"} />
                <span>{isResetting ? "PULSA OTRA VEZ PARA BORRAR" : "RESETEAR TODO EL HISTORIAL"}</span>
              </button>
            </div>
            
            <div className="space-y-3">
              {history.map(item => (
                <div 
                  key={item.id} 
                  onClick={() => loadTranslation(item)}
                  className="bg-zinc-900/30 border border-zinc-900 p-5 rounded-2xl flex items-center justify-between group hover:border-zinc-800 transition-all cursor-pointer active:scale-[0.98]"
                >
                  <div className="min-w-0 pr-4">
                    <p className="text-xs text-zinc-400 truncate">{item.original}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-zinc-100">{item.translated}</p>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          speakText(item.translated);
                        }}
                        className="text-amber-500 hover:text-amber-400 p-1 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Volume2 size={12} />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteHistoryItem(item.id);
                        }}
                        className="text-red-500 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-all border border-transparent hover:border-red-500/20 rounded-lg ml-1"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <HistoryIcon size={14} className="text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="py-12 text-center border-t border-zinc-900 mx-6 mt-4">
        <a 
          href="https://github.com/jaume1112" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-[10px] font-mono text-zinc-500 hover:text-white transition-colors font-black uppercase tracking-[0.4em] inline-flex items-center gap-2 group"
        >
          <span>©</span>
          <span className="underline decoration-zinc-800 underline-offset-4 group-hover:decoration-amber-500">Jaume</span>
          <span>2026</span>
          <ExternalLink size={10} className="text-zinc-800 group-hover:text-amber-500 transition-colors" />
        </a>
      </footer>

      {/* STT Ambiguity Picker */}
      <AnimatePresence>
        {showSttPicker && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setShowSttPicker(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-xs bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4 shadow-2xl"
            >
              <div className="text-center space-y-1">
                <Mic size={24} className="mx-auto text-amber-500 animate-pulse" />
                <h3 className="text-sm font-black uppercase tracking-tight text-white">{T.sttAmbiguity}</h3>
                <p className="text-[10px] text-zinc-500 italic">"{input}"</p>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {sttAlternatives.map(alt => (
                  <button
                    key={alt}
                    onClick={() => {
                      const isGrecoText = /[\u0370-\u03FF]/.test(input);
                      const lowers = input.toLowerCase();
                      setSourceLang(alt);
                      setShowSttPicker(false);
                      
                      // Mapeo inteligente para corregir lo oído
                      let fixedInput = input;

                      if (isGrecoText && alt === "Español" && input.includes("ολα")) fixedInput = "hola amiga";
                      if (isGrecoText && alt === "Catalán" && input.includes("ολα")) fixedInput = "hola amiga";
                      
                      // Corrección para "agaza" -> "agafa" o "coger"
                      if (lowers.includes("agaza")) {
                        if (alt === "Catalán") fixedInput = input.replace(/agaza/gi, "agafa");
                        if (alt === "Español") fixedInput = input.replace(/agaza/gi, "coger");
                      }
                      if (lowers.includes("cotxe")) {
                        if (alt === "Español") fixedInput = input.replace(/cotxe/gi, "coche");
                      }
                      if (lowers.includes("coche")) {
                        if (alt === "Catalán") fixedInput = input.replace(/coche/gi, "cotxe");
                      }

                      setInput(fixedInput);
                      // Corrección fonética para "vui menjar" -> "vull menjar"
                      if (fixedInput.toLowerCase().includes("voy manchar") || fixedInput.toLowerCase().includes("vui menjar")) {
                        if (alt === "Catalán") setInput("vull menjar");
                      }

                      if (fixedInput.trim()) {
                        setTimeout(handleTranslate, 100);
                      }
                    }}
                    className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-[10px] font-bold rounded-xl transition-all border border-zinc-700"
                  >
                    IDENTIFICAR COMO {alt.toUpperCase()}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Detalles de la Sabiduría (Palabra del día) */}
      <AnimatePresence>
        {showWordDetails && wordOfTheDay && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-0">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowWordDetails(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-[32px] overflow-hidden shadow-2xl"
            >
              <div className="relative p-8 space-y-6">
                <button 
                  onClick={() => setShowWordDetails(false)}
                  className="absolute top-6 right-6 p-2 text-zinc-500 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>

                <div className="space-y-4 pt-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center">
                      <BookOpen className="text-amber-500" size={24} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-white italic tracking-tight">"{wordOfTheDay.phrase}"</h2>
                      <p className="text-amber-500 text-[10px] font-bold uppercase tracking-widest">{wordOfTheDay.language}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl space-y-3">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Traducción</span>
                        <p className="text-lg font-bold text-white leading-tight">{wordOfTheDay.meaning}</p>
                      </div>
                      
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Pronunciación</span>
                        <p className="text-zinc-300 font-mono text-sm tracking-wide bg-zinc-950/50 p-2 rounded-lg italic">
                          {wordOfTheDay.pronunciation}
                        </p>
                      </div>
                    </div>

                    <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl space-y-2">
                       <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Uso y Contexto</span>
                       <p className="text-sm text-zinc-400 leading-relaxed italic border-l-2 border-amber-500/30 pl-4">
                         {wordOfTheDay.usage}
                       </p>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex flex-col gap-3">
                  <button 
                    onClick={() => setShowWordDetails(false)}
                    className="w-full py-4 bg-zinc-100 hover:bg-white text-black font-black uppercase tracking-widest text-xs rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-white/5"
                  >
                    Entendido
                  </button>
                  <button 
                    onClick={() => refreshWordOfTheDay(true)}
                    className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white font-bold uppercase tracking-widest text-[10px] rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 border border-zinc-800"
                  >
                    <RefreshCw size={12} />
                    Ver otra sabiduría
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
            onClick={() => setShowSettings(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-sm p-8 space-y-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-bold">{T.settings.toUpperCase()}</h3>
                  <div className="flex gap-1 bg-black/40 p-1 rounded-lg border border-zinc-800">
                    {['es', 'ca'].map(lang => (
                      <button
                        key={lang}
                        onClick={() => {
                          setUiLang(lang as 'es' | 'ca');
                          localStorage.setItem("linguo_ui_lang", lang);
                        }}
                        className={cn(
                          "px-2 py-1 rounded-md text-[9px] font-black transition-all",
                          uiLang === lang ? "bg-amber-500 text-black shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                        )}
                      >
                        {lang.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-zinc-800 rounded-xl">
                  <X size={20} />
                </button>
              </div>
              
              <div className="space-y-4 max-h-[60vh] overflow-y-auto px-1 -mx-1 scrollbar-hide">
                <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl space-y-3 shadow-inner">
                  <div className="flex flex-col gap-1 mb-2">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-300">PWA Link Status</span>
                    <div className="flex items-center justify-between text-[9px] font-mono">
                      <span className="text-zinc-400">Service Worker:</span>
                      <span className={cn(swStatus.includes("ACTIVO") ? "text-green-500" : "text-amber-500")}>{swStatus}</span>
                    </div>
                    <div className="flex items-center justify-between text-[9px] font-mono">
                      <span className="text-zinc-400">Instalación:</span>
                      <span className={cn(promptStatus === "¡LISTO PARA INSTALAR!" ? "text-green-500 font-bold" : "text-zinc-400")}>{promptStatus}</span>
                    </div>
                    <div className="flex items-center justify-between text-[9px] font-mono pt-1 border-t border-zinc-900/50 mt-1">
                      <span className="text-zinc-400">Permiso Micro:</span>
                      <span className={cn(micPermission === 'granted' ? "text-green-500" : "text-amber-500 font-bold")}>{micPermission.toUpperCase()}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-zinc-400">
                      <Key size={14} />
                      <span className="text-[10px] font-mono font-bold uppercase tracking-widest">Diagnóstico de Enlace</span>
                    </div>
                    <div className={cn("w-2 h-2 rounded-full", isApiKeyReady ? "bg-green-500 shadow-[0_0_8px_#22c55e]" : "bg-red-500 animate-pulse")} />
                  </div>
                  
                  <div className="font-mono text-[9px] text-zinc-300 bg-black/40 p-2 rounded border border-zinc-900 break-all">
                    {apiDiagnostics}
                  </div>

                  <button 
                    onClick={async () => {
                      setApiDiagnostics("PROBANDO...");
                      try {
                        const envKey = process.env.GEMINI_API_KEY;
                        const key = (activeApiKey || envKey)?.replace(/['"`]+/g, '').trim();
                        if (!key) throw new Error("No hay clave.");
                        const ai = new GoogleGenAI({ apiKey: key });
                        await ai.models.generateContent({ model: "gemini-3.1-flash-lite-preview", contents: "test" });
                        setApiDiagnostics("ÉXITO: Conexión establecida.");
                      } catch (e: any) {
                        setApiDiagnostics(`ERROR: ${e.message}`);
                      }
                    }}
                    className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-[10px] font-bold rounded-lg border border-zinc-700 transition-all active:scale-95"
                  >
                    TEST DE CONEXIÓN
                  </button>

                  <ApiKeysManager onKeyChange={setActiveApiKey} />

                  {/* Selector de Modelos */}
                  <div className="space-y-2 pt-2">
                    <label className="text-[9px] font-bold text-zinc-400 uppercase flex items-center gap-2">
                      <Sparkles size={11} className="text-amber-500" />
                      Cerebro de la IA
                    </label>
                    <div className="space-y-1.5">
                      {[
                        { id: "gemini-3-flash-preview", name: "Gemini 3 Flash", desc: "Equilibrado (Recomendado)" },
                        { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro", desc: "Máximo intelecto (Más lento)" },
                        { id: "gemini-3.1-flash-lite-preview", name: "Gemini 3.1 Lite", desc: "Máxima velocidad / Baja saturación" }
                      ].map(m => (
                        <button
                          key={m.id}
                          onClick={() => setSelectedModel(m.id)}
                          className={cn(
                            "w-full px-3 py-2.5 rounded-xl border text-left transition-all flex flex-col gap-0.5",
                            selectedModel === m.id 
                              ? "bg-amber-500/10 border-amber-500/50 text-amber-500 shadow-sm" 
                              : "bg-black/40 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                          )}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="text-[10px] font-black uppercase tracking-tighter">{m.name}</span>
                            {selectedModel === m.id && <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />}
                          </div>
                          <span className={cn("text-[8px] font-medium opacity-60", selectedModel === m.id ? "text-amber-500" : "text-zinc-600")}>
                            {m.desc}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-[9px] text-zinc-400 leading-tight italic">
                    Prioridad: Manual &gt; Entorno. Obtenla gratis en: <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-amber-600 hover:text-amber-500 underline">Google AI Studio</a>
                  </p>
                </div>

                <div className="p-4 bg-zinc-950 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Info size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Estado Sistema</span>
                  </div>
                  <p className="text-xs text-zinc-300">Esta aplicación utiliza Google Gemini para proporcionar tutoría de idiomas avanzada.</p>
                </div>
                
                  {/* Offline Manager */}
                  <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl space-y-3">
                    <label className="text-[9px] font-bold text-zinc-500 uppercase flex items-center gap-2">
                       <Download size={11} className="text-amber-500" />
                       Gestor de Idiomas Offline
                    </label>

                    <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl space-y-3">
                      <label className="text-[9px] font-bold text-zinc-500 uppercase flex items-center gap-2">
                         <Zap size={11} className="text-amber-500" />
                         Selección Actual: {sourceLang} ➔ {targetLang}
                      </label>
                      
                      {sourceLang !== 'Auto' ? (
                        <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-2">
                          {(() => {
                            const sCode = ISO_LANG_MAP[sourceLang];
                            const tCode = ISO_LANG_MAP[targetLang];
                            const directId = `${sCode}-${tCode}`;
                            const isDirect = downloadedModels.includes(directId);
                            const hasBridge = downloadedModels.includes(`${sCode}-en`) && downloadedModels.includes(`en-${tCode}`);
                            const isReady = isDirect || hasBridge || (sCode === 'en' && downloadedModels.includes(`en-${tCode}`)) || (tCode === 'en' && downloadedModels.includes(`${sCode}-en`));

                            return (
                              <>
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-medium text-zinc-400 italic">Estado Multidireccional:</span>
                                  <div className="flex items-center gap-1.5">
                                    <div className={cn("w-1.5 h-1.5 rounded-full", isReady ? "bg-green-500 shadow-[0_0_8px_#22c55e]" : "bg-red-500/50 animate-pulse")} />
                                    <span className={cn("text-[9px] font-black uppercase tracking-tighter", isReady ? "text-green-500" : "text-zinc-500")}>
                                      {isReady ? "COBERTURA TOTAL (IDA/VUELTA)" : "REQUIERE INTERNET"}
                                    </span>
                                  </div>
                                </div>
                                
                                {!isReady && !isDownloading && (
                                  <button 
                                    onClick={() => installFullPackForPair(sourceLang, targetLang)}
                                    className="w-full py-2 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-500 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all"
                                  >
                                    Descargar Paquete {sourceLang} ➔ {targetLang}
                                  </button>
                                )}

                                {isReady && (
                                  <p className="text-[8px] text-zinc-500 italic leading-tight">
                                    {isDirect ? "✓ Modelo directo instalado." : "✓ Funcionando mediante enlace inteligente (Bridge)."}
                                  </p>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      ) : (
                        <p className="text-[9px] text-zinc-500 italic px-1">Selecciona un idioma específico en la pantalla principal para gestionar su modo offline.</p>
                      )}
                    </div>

                    {isDownloading && (
                      <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-2xl space-y-3">
                        <div className="flex justify-between items-center text-[10px] font-mono">
                          <span className="text-amber-500 font-bold uppercase tracking-tighter">Descargando cerebro {currentDownloadPair}</span>
                          <span className="text-amber-500">{downloadProgress}%</span>
                        </div>
                        <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                          <motion.div 
                            className="bg-amber-500 h-full shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                            initial={{ width: 0 }}
                            animate={{ width: `${downloadProgress}%` }}
                          />
                        </div>
                        <p className="text-[8px] text-zinc-500 italic">No cierres la app. Peso aprox: 180MB.</p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-2">
                       <span className="text-[8px] font-black uppercase text-zinc-500 tracking-widest pl-1 pt-2">Prioridades (Español como eje)</span>
                       {[
                         { s: "Español", t: "Inglés", id: "es-en" },
                         { s: "Inglés", t: "Español", id: "en-es" },
                         { s: "Español", t: "Francés", id: "es-fr" },
                         { s: "Francés", t: "Español", id: "fr-es" },
                         { s: "Ruso", t: "Inglés", id: "ru-en" },
                         { s: "Chino", t: "Inglés", id: "zh-en" },
                         { s: "Urdu", t: "Inglés", id: "ur-en" },
                         { s: "Latín", t: "Inglés", id: "la-en" }
                       ].map(pair => {
                         const isDone = downloadedModels.includes(pair.id);
                         const sFlag = LANGUAGES.find(l => l.name === pair.s)?.flag || "🌐";
                         const tFlag = LANGUAGES.find(l => l.name === pair.t)?.flag || "🌐";
                         
                         return (
                           <div key={pair.id} className="flex gap-1">
                             <button
                               disabled={isDownloading || isDone}
                               onClick={() => downloadLanguageModel(pair.s, pair.t)}
                               className={cn(
                                 "flex-1 flex items-center justify-between px-4 py-3 rounded-2xl border transition-all",
                                 isDone 
                                   ? "bg-green-500/5 border-green-500/20 text-green-500" 
                                   : "bg-zinc-800/10 border-zinc-800 text-zinc-400 hover:border-zinc-700 active:scale-95"
                               )}
                             >
                               <div className="flex items-center gap-2">
                                 <span className="text-xs">{sFlag} ➔ {tFlag}</span>
                                 <span className="text-[9px] font-black uppercase tracking-widest">{pair.s} ➔ {pair.t}</span>
                               </div>
                               {isDone ? (
                                 <div className="flex items-center gap-1">
                                   <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_5px_#22c55e]" />
                                   <CheckCircle2 size={14} />
                                 </div>
                               ) : (
                                 <Download size={12} className="opacity-50" />
                               )}
                             </button>
                             {isDone && (
                               <button 
                                 onClick={() => {
                                   if (confirm(`¿Eliminar ${pair.s} ➔ ${pair.t}?`)) {
                                     setDownloadedModels(prev => prev.filter(m => m !== pair.id));
                                   }
                                 }}
                                 className="px-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl hover:bg-red-500/20 transition-all"
                               >
                                 <Trash2 size={14} />
                               </button>
                             )}
                           </div>
                         );
                       })}
                    </div>

                    {/* Buscador Dinámico de Idiomas del Mundo */}
                    <div className="space-y-2 pt-2 border-t border-zinc-900">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={14} />
                        <input 
                          value={offlineSearch}
                          onChange={(e) => setOfflineSearch(e.target.value)}
                          placeholder="Buscar otro idioma (ej: Islandés, Swahili...)"
                          className="w-full bg-black border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-[10px] focus:ring-1 focus:ring-amber-500 outline-none text-zinc-300"
                        />
                      </div>

                      {offlineSearch && (
                        <div className="bg-black/80 border border-zinc-800 rounded-2xl overflow-hidden max-h-40 overflow-y-auto shadow-2xl">
                          {OFFLINE_SUPPORTED_LANGS
                            .filter(l => l.toLowerCase().startsWith(offlineSearch.toLowerCase()))
                            .slice(0, 10)
                            .map(match => (
                              <button
                                key={match}
                                onClick={() => {
                                  installNewLanguage(match);
                                  setOfflineSearch("");
                                }}
                                className="w-full px-4 py-3 text-left hover:bg-zinc-900 border-b border-zinc-900 last:border-0 flex items-center justify-between group"
                              >
                                <span className="text-[10px] font-bold text-zinc-400 group-hover:text-amber-500">{match}</span>
                                <Globe size={12} className="text-zinc-700" />
                              </button>
                            ))}
                        </div>
                      )}
                    </div>

                    {/* Listado Completo de Instalados (Visible Siempre abajo) */}
                    {downloadedModels.length > 0 && (
                      <div className="space-y-1.5 pt-2 border-t border-zinc-900">
                        <span className="text-[8px] font-black uppercase text-zinc-500 tracking-widest pl-1">Recursos Instalados ({downloadedModels.length})</span>
                        <div className="flex flex-wrap gap-1">
                          {downloadedModels.map(id => {
                            const [s, t] = id.split("-");
                            const sName = Object.keys(ISO_LANG_MAP).find(k => ISO_LANG_MAP[k] === s) || s;
                            const tName = Object.keys(ISO_LANG_MAP).find(k => ISO_LANG_MAP[k] === t) || t;
                            const sFlag = LANGUAGES.find(l => l.name === sName)?.flag || "🌐";
                            const tFlag = LANGUAGES.find(l => l.name === tName)?.flag || "🌐";
                            
                            return (
                              <div key={id} className="flex items-center gap-1.5 px-2 py-1 bg-zinc-900 border border-zinc-800 rounded-lg group">
                                <span className="text-[10px]">{sFlag}{tFlag}</span>
                                <span className="text-[8px] font-bold text-zinc-400 uppercase">{s}-{t}</span>
                                <button 
                                  onClick={() => setDownloadedModels(prev => prev.filter(m => m !== id))}
                                  className="text-zinc-600 hover:text-red-500 transition-colors"
                                >
                                  <X size={10} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-4 bg-zinc-950 rounded-2xl space-y-3 border border-amber-500/10">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500">Gestión Offline</p>
                    <p className="text-[10px] text-zinc-400">Selecciona un idioma para descargar sus modelos de traducción a tu dispositivo y usarlos sin internet.</p>
                    <select 
                      onChange={async (e) => {
                        const langName = e.target.value;
                        if (!langName) return;
                        const code = ISO_LANG_MAP[langName];
                        alert(`Descargando modelos para ${langName}. Esto puede tardar dependiendo de tu conexión.`);
                        try {
                          // Simplificación: precargamos un modelo m2m100 como base universal
                          await preloadLanguage(`Xenova/m2m100_418M`, (prog) => console.log(`Progreso: ${prog}`));
                          setDownloadedModels([...downloadedModels, code]);
                          alert(`Modelos para ${langName} descargados con éxito.`);
                        } catch (err: any) {
                          const errorMsg = err.message || "Error desconocido";
                          const div = document.createElement('div');
                          div.style.position = 'fixed';
                          div.style.top = '10%';
                          div.style.left = '10%';
                          div.style.width = '80%';
                          div.style.background = '#09090b';
                          div.style.color = 'white';
                          div.style.padding = '20px';
                          div.style.border = '2px solid red';
                          div.style.zIndex = '9999';
                          div.innerHTML = `
                            <p>Error (copia esto):</p>
                            <textarea style="width:100%; height:100px; color:black;">${errorMsg}</textarea>
                            <button onclick="this.parentElement.remove()">Cerrar</button>
                          `;
                          document.body.appendChild(div);
                        }
                      }}
                      className="w-full bg-zinc-900 border border-zinc-800 p-2 rounded-lg text-xs"
                    >
                      <option value="">Selecciona idioma...</option>
                      {OFFLINE_SUPPORTED_LANGS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>

                  <div className="p-4 bg-zinc-950 rounded-2xl space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Privacidad</p>
                    <p className="text-xs text-zinc-400">Tus traducciones se guardan localmente en este dispositivo y no se comparten.</p>
                  </div>

                  <div className="pt-4">
                    <button 
                      onClick={() => {
                        if (deferredPrompt) {
                          deferredPrompt.prompt();
                        } else {
                          alert("Chrome aún no ha solicitado la instalación. Pulsa los 3 puntos del navegador y busca 'Instalar aplicación' o 'Añadir a pantalla de inicio'. Si no aparece, espera unos segundos y refresca.");
                        }
                      }}
                      className={cn(
                        "w-full py-3 mb-2 border rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2",
                        deferredPrompt 
                          ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/20"
                          : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
                      )}
                    >
                      <Download size={12} />
                      {deferredPrompt ? "Instalar Aplicación" : "Instalar (Manual si no disponible)"}
                    </button>
                    <div className="text-[10px] text-zinc-600 mb-2">
                       {deferredPrompt ? "¡Listo para instalar!" : "Esperando Chrome... pulsa arriba si no aparece."}
                    </div>
                    {apiDiagnostics.includes("403") && (
                      <div className="p-3 mb-2 bg-red-900/20 border border-red-900/40 text-red-500 rounded-xl text-[10px] font-bold">
                        ⚠️ Tu API Key parece estar bloqueada. Ve a Ajustes, elimina la API Key y recarga la app.
                      </div>
                    )}
                   <button 
                     onClick={() => {
                        if (confirm("¿Seguro? Esto borrará tu historial, favoritos y reiniciará la app para arreglar posibles errores técnicos.")) {
                           localStorage.clear();
                           if ('serviceWorker' in navigator) {
                             navigator.serviceWorker.getRegistrations().then(registrations => {
                               for(let r of registrations) r.unregister();
                             });
                           }
                           window.location.reload();
                        }
                     }}
                     className="w-full py-3 bg-red-900/20 border border-red-900/40 text-red-500 rounded-xl text-[10px] font-black uppercase hover:bg-red-900/30 transition-all flex items-center justify-center gap-2"
                   >
                     <RefreshCw size={12} />
                     Resetear Aplicación (Limpiar Caché)
                   </button>
                </div>
              </div>

              <button 
                onClick={() => setShowSettings(false)}
                className="w-full py-4 bg-amber-500 text-black font-black text-xs uppercase rounded-2xl shadow-[0_0_20px_rgba(245,158,11,0.3)] active:scale-95 transition-all mt-4"
              >
                VOLVER AL TRADUCTOR
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Install Help Modal */}
      <AnimatePresence>
        {showInstallHelp && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-[60] flex items-center justify-center p-6"
            onClick={() => setShowInstallHelp(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-sm p-8 space-y-6 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="text-center space-y-4">
                <div className="w-20 h-20 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Download className="text-amber-500" size={40} />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tighter">Cómo instalar en tu Redmi</h3>
                <div className="space-y-4 text-left">
                  <div className="flex gap-4">
                    <div className="w-6 h-6 rounded-full bg-amber-500 text-black flex items-center justify-center shrink-0 font-bold text-xs mt-1">1</div>
                    <p className="text-xs text-zinc-400">Pulsa los <span className="text-white font-bold">3 PUNTOS</span> en la esquina superior derecha de Chrome.</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-6 h-6 rounded-full bg-amber-500 text-black flex items-center justify-center shrink-0 font-bold text-xs mt-1">2</div>
                    <p className="text-xs text-zinc-400">Busca y pulsa la opción <span className="text-white font-bold">"INSTALAR APLICACIÓN"</span>.</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-6 h-6 rounded-full bg-amber-500 text-black flex items-center justify-center shrink-0 font-bold text-xs mt-1">3</div>
                    <p className="text-xs text-zinc-400">Si solo aparece "Añadir a pantalla de inicio", espera 10 segundos y vuelve a probar.</p>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setShowInstallHelp(false)}
                className="w-full py-4 bg-white text-black font-black text-xs uppercase rounded-2xl active:scale-95 transition-all mt-4"
              >
                ENTENDIDO
              </button>
            </motion.div>
          </motion.div>
        )}
        {/* Modal: Mi Baúl (Favoritos) */}
        {showVault && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowVault(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              className="relative w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
            >
              <div className="p-8 border-b border-zinc-900 flex items-center justify-between bg-zinc-900/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-500/10 rounded-2xl flex items-center justify-center">
                    <Heart className="text-red-500 animate-pulse" size={20} fill="currentColor" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tighter text-white">Mi Baúl</h3>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{favorites.length} Perlas de sabiduría</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowVault(false)}
                  className="p-3 hover:bg-zinc-800 rounded-2xl text-zinc-500 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-4 flex-1 scrollbar-hide">
                {favorites.length === 0 ? (
                  <div className="py-20 text-center space-y-4">
                    <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto opacity-20">
                      <Library size={32} />
                    </div>
                    <p className="text-zinc-500 text-sm italic">Tu baúl está vacío. Pulsa el corazón en cualquier traducción para guardarla aquí.</p>
                  </div>
                ) : (
                  favorites.map((fav, index) => (
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      key={index} 
                      onClick={() => loadTranslation(fav)}
                      className="bg-zinc-900/40 border border-zinc-800/50 p-5 rounded-3xl space-y-3 group hover:border-amber-500/30 transition-all cursor-pointer active:scale-[0.98]"
                    >
                      {editingFavIndex === index ? (
                        <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-bold text-zinc-500 uppercase">Texto Original</label>
                            <input 
                              value={editForm.originalText}
                              onChange={(e) => setEditForm(prev => ({ ...prev, originalText: e.target.value }))}
                              className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-amber-500 outline-none"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-bold text-zinc-500 uppercase">Traducción</label>
                            <input 
                              value={editForm.translation}
                              onChange={(e) => setEditForm(prev => ({ ...prev, translation: e.target.value }))}
                              className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-amber-500 outline-none"
                            />
                          </div>
                          <div className="flex gap-2 pt-2">
                            <button 
                              onClick={saveFavEdit}
                              className="flex-1 py-3 bg-amber-500 text-black font-black text-[10px] rounded-xl active:scale-95 transition-all"
                            >
                              GUARDAR CAMBIOS
                            </button>
                            <button 
                              onClick={() => setEditingFavIndex(null)}
                              className="px-4 py-3 bg-zinc-800 text-zinc-400 font-bold text-[10px] rounded-xl active:scale-95 transition-all"
                            >
                              CANCELAR
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between items-start">
                            <div className="space-y-1">
                              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{fav.originalText || "Sin original"}</p>
                              <p className="text-xl font-black text-white tracking-tight leading-tight">{fav.translation}</p>
                            </div>
                            <div className="flex gap-2">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  speakText(fav.translation);
                                }}
                                className="p-2 bg-zinc-800 text-zinc-400 hover:text-amber-500 rounded-xl transition-all"
                              >
                                <Volume2 size={16} />
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEditingFav(index, fav);
                                }}
                                className="p-2 bg-zinc-800 text-zinc-400 hover:text-amber-500 rounded-xl transition-all"
                              >
                                <Pencil size={16} />
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFavorites(prev => prev.filter(f => f.translation !== fav.translation));
                                }}
                                className="p-2 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 transition-all active:scale-90"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                          <div className="p-3 bg-black/40 rounded-xl border border-zinc-800/50">
                            <p className="text-[11px] text-zinc-400 line-clamp-2 italic leading-relaxed">
                              {fav.explanation.replace(/[#*]/g, '')}
                            </p>
                          </div>
                        </>
                      )}
                    </motion.div>
                  ))
                )}
              </div>

              <div className="p-6 bg-zinc-900/30 border-t border-zinc-900">
                <button 
                  onClick={() => setShowVault(false)}
                  className="w-full py-4 bg-white text-black font-black text-xs uppercase rounded-2xl active:scale-95 transition-all"
                >
                  Volver al estudio
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Modal: Centro de Entrenamiento */}
        {showTrainingCenter && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (trainingMode === 'none') setShowTrainingCenter(false);
              }}
              className="absolute inset-0 bg-black/95 backdrop-blur-2xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className={cn(
                "relative w-full max-w-xl bg-zinc-950 border rounded-[40px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]",
                trainingMode === 'none' ? "border-zinc-800" : "border-amber-500/30"
              )}
            >
              {/* Header Entrenamiento */}
              <div className="p-8 border-b border-zinc-900 flex items-center justify-between bg-zinc-900/20">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center">
                    <Dumbbell className="text-amber-500" size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tighter text-white">Centro de Entrenamiento</h3>
                    <p className="text-[10px] font-bold text-amber-500/60 uppercase tracking-[0.2em] italic">Potencia tu nivel en {targetLang}</p>
                    {isIframe && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                        <span className="text-[8px] font-black uppercase text-blue-500/80 tracking-widest">Puente de Voz Activo (Iframe)</span>
                      </div>
                    )}
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setTrainingMode('none');
                    setShowTrainingCenter(false);
                    setResult(null);
                    setShadowingScore(null);
                    setShadowingFeedback(null);
                  }}
                  className="p-3 hover:bg-zinc-800 rounded-2xl text-zinc-500 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 overflow-y-auto flex-1 space-y-8 scrollbar-hide">
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-5 bg-red-500/10 border border-red-500/20 rounded-3xl flex gap-4 text-red-400 text-sm mb-4"
                  >
                    <AlertTriangle className="shrink-0 text-red-500" size={24} />
                    <div className="space-y-2 w-full">
                      <div>
                        <p className="font-bold uppercase text-[10px] tracking-widest text-red-500/80">Aviso del Sistema</p>
                        <p className="leading-tight">{error}</p>
                      </div>
                      { (error.toLowerCase().includes("micro") || isIframe || micPermission === 'denied') && (
                        <button 
                          onClick={() => window.open(window.location.href, '_blank')}
                          className="w-full mt-2 py-3 bg-red-500/20 border border-red-500/30 rounded-2xl text-[10px] font-black uppercase hover:bg-red-500/40 transition-all flex items-center justify-center gap-2 text-red-200"
                        >
                          <Maximize2 size={12} />
                          Abrir en ventana nueva para activar micro
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}

                {trainingMode === 'none' ? (
                  <div className="grid grid-cols-1 gap-4">
                    {/* Modo 1: Roleplay */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between px-2">
                        <h4 className="font-black uppercase tracking-widest text-white text-sm">Simulacro de Vida Real</h4>
                        <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                          <User className="text-blue-500" size={20} />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {[
                          { id: "restaurante", name: "En un Restaurante", desc: "Pide la cena y pregunta por ingredientes.", icon: "🍽️" },
                          { id: "medico", name: "En el Médico", desc: "Explica tus síntomas y pide una receta.", icon: "🏥" },
                          { id: "aeropuerto", name: "En el Aeropuerto", desc: "Factura tu maletas y pregunta por la puerta.", icon: "✈️" },
                          { id: "calle", name: "Perdido en la Ciudad", desc: "Pregunta por una dirección a un nativo.", icon: "🗺️" }
                        ].map(scene => (
                          <button 
                            key={scene.id}
                            onClick={() => {
                              setTrainingMode('roleplay');
                              setTrainingMessage(scene.name + ": " + scene.desc);
                              handleTraining(); // Inicia la conversación
                            }}
                            className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl text-left hover:border-blue-500/50 transition-all flex items-center gap-4 group"
                          >
                            <span className="text-2xl group-hover:scale-110 transition-transform">{scene.icon}</span>
                            <div>
                               <p className="text-xs font-black uppercase text-white">{scene.name}</p>
                               <p className="text-[10px] text-zinc-500">{scene.desc}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Modo 2: Quiz de Favoritos */}
                    <button 
                      onClick={() => {
                        if (favorites.length === 0) {
                          setError("Necesitas guardar frases en tu Baúl primero.");
                          return;
                        }
                        setTrainingMode('quiz');
                        const randomFav = favorites[Math.floor(Math.random() * favorites.length)];
                        setTrainingMessage(randomFav.translation);
                      }}
                      className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-3xl text-left space-y-3 hover:border-amber-500/50 transition-all group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center">
                          <Gamepad2 className="text-red-500" size={20} />
                        </div>
                        <ChevronRight className="text-zinc-800 group-hover:text-red-500 transition-colors" size={16} />
                      </div>
                      <h4 className="font-black uppercase tracking-widest text-white text-sm">Quiz del Baúl</h4>
                        <p className="text-xs text-zinc-500 leading-relaxed">¿Cuánto recuerdas de lo que has guardado? Un test rápido de tus perlas de sabiduría.</p>
                    </button>

                    {/* Modo 3: Shadowing */}
                    <button 
                      onClick={() => {
                        setTrainingMode('shadowing');
                        setTrainingMessage(input || wordOfTheDay?.phrase || "Hola");
                      }}
                      className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-3xl text-left space-y-3 hover:border-amber-500/50 transition-all group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                          <Target className="text-emerald-500" size={20} />
                        </div>
                        <ChevronRight className="text-zinc-800 group-hover:text-emerald-500 transition-colors" size={16} />
                      </div>
                      <h4 className="font-black uppercase tracking-widest text-white text-sm">Shadowing (Pronunciación)</h4>
                      <p className="text-xs text-zinc-500 leading-relaxed">Escucha al tutor y repite. La IA detectará tus fallos y te pondrá una nota.</p>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Interfaz de cada modo activo */}
                    {trainingMode === 'roleplay' && (
                      <div className="space-y-6">
                         <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl flex gap-3">
                           <Info size={16} className="text-blue-500 mt-1" />
                           <p className="text-xs text-zinc-400 italic">Estás: <b>{trainingMessage}</b>. Habla con la IA como si estuvieras allí.</p>
                         </div>

                         {result ? (
                            <div className="space-y-4">
                               <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-[24px] space-y-3">
                                  <div className="flex items-center gap-2">
                                    <User size={14} className="text-blue-500" />
                                    <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">IA Nativa</span>
                                  </div>
                                  <p className="text-2xl font-black text-white italic tracking-tight underline decoration-blue-500/20 underline-offset-8">"{result.translation}"</p>
                                  <div className="flex items-center gap-2">
                                    <button onClick={() => speakText(result.translation)} className="px-3 py-1 bg-zinc-800 rounded-lg text-[10px] text-zinc-400 font-bold hover:text-white uppercase">Escuchar</button>
                                    <span className="text-[10px] text-zinc-600 font-mono italic">/{result.phonetic}/</span>
                                  </div>
                               </div>

                               <div className="p-5 bg-zinc-950 border border-zinc-900 rounded-[24px] space-y-2">
                                  <div className="flex items-center gap-2">
                                    <Sparkles size={14} className="text-amber-500" />
                                    <span className="text-[10px] font-black uppercase text-amber-500 tracking-widest">Corrección del Tutor</span>
                                  </div>
                                  <p className="text-xs text-zinc-300 leading-relaxed italic">"{result.explanation}"</p>
                                  <div className="h-px bg-zinc-800 w-full my-2" />
                                  <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-tight">Consejo: <span className="text-zinc-300 italic normal-case font-medium">{result.tips[0]}</span></p>
                               </div>
                            </div>
                         ) : (
                            <div className="py-20 text-center">
                               <div className="animate-pulse w-2 w-2 bg-blue-500 rounded-full mx-auto" />
                               <p className="text-xs text-zinc-600 mt-4 uppercase font-black tracking-widest">Esperando inicio...</p>
                            </div>
                         )}

                         <div className="relative pt-4">
                            <textarea 
                               placeholder="Responde aquí..."
                               className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-sm focus:ring-1 focus:ring-blue-500 outline-none h-32"
                               onKeyDown={(e) => {
                                 if (e.key === 'Enter' && !e.shiftKey) {
                                   e.preventDefault();
                                   handleTraining(e.currentTarget.value);
                                   e.currentTarget.value = "";
                                 }
                               }}
                            />
                            <div className="mt-2 flex justify-between items-center px-1">
                               <p className="text-[9px] text-zinc-600 uppercase font-black">Pulsa ENTER para enviar</p>
                               <button 
                                 onClick={() => {
                                   const text = (document.querySelector('textarea') as HTMLTextAreaElement).value;
                                   handleTraining(text);
                                   (document.querySelector('textarea') as HTMLTextAreaElement).value = "";
                                 }}
                                 className="px-4 py-2 bg-blue-500 text-black text-[10px] font-black uppercase rounded-xl active:scale-95 transition-all"
                               >
                                 Responder
                               </button>
                            </div>
                         </div>
                      </div>
                    )}

                {trainingMode === 'shadowing' && (
                       <div className="space-y-8 text-center pb-8">
                          <div className="space-y-4">
                             <span className="text-[10px] font-black uppercase text-emerald-500 tracking-[0.3em]">Repite después de mí</span>
                             <p className="text-3xl font-black text-white italic leading-tight">"{trainingMessage}"</p>
                             <div className="flex justify-center gap-4">
                                <button 
                                  onClick={() => speakText(trainingMessage)}
                                  className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-all shadow-xl"
                                >
                                  <Volume2 size={24} />
                                </button>
                                <button 
                                  onClick={toggleListening}
                                  className={cn(
                                    "w-16 h-16 rounded-full border flex items-center justify-center transition-all shadow-xl",
                                    isListening ? "bg-red-500 animate-pulse border-red-500 text-white" : "bg-white text-black"
                                  )}
                                >
                                  {isListening ? <MicOff size={24} /> : <Mic size={24} />}
                                </button>
                             </div>
                          </div>

                          {shadowingScore !== null && (
                             <motion.div 
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="space-y-4"
                             >
                                <div className="inline-flex flex-col items-center p-8 bg-zinc-900/50 border border-zinc-800 rounded-[40px]">
                                   <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-2">Puntuación</span>
                                   <span className={cn(
                                     "text-7xl font-black italic tracking-tighter",
                                     shadowingScore > 80 ? "text-emerald-500" : shadowingScore > 50 ? "text-amber-500" : "text-red-500"
                                   )}>{shadowingScore}</span>
                                   <div className="flex gap-1 mt-4">
                                      {[...Array(5)].map((_, i) => (
                                        <div key={i} className={cn("w-2 h-2 rounded-full", i < (shadowingScore/20) ? "bg-emerald-500 shadow-[0_0_8px_#10b981]" : "bg-zinc-800")} />
                                      ))}
                                   </div>
                                </div>
                                <div className="p-4 bg-zinc-900/80 rounded-2xl border border-zinc-800">
                                   <p className="text-xs text-zinc-300 italic italic leading-relaxed font-medium">"{shadowingFeedback}"</p>
                                </div>
                             </motion.div>
                          )}
                       </div>
                    )}

                    {trainingMode === 'quiz' && (
                      <div className="space-y-8 text-center pb-8">
                         <div className="space-y-4">
                            <span className="text-[10px] font-black uppercase text-red-500 tracking-[0.3em]">¿Cómo se traduce esto?</span>
                            <div className="p-8 bg-zinc-900 border border-zinc-800 rounded-[32px]">
                               <p className="text-2xl font-black text-white italic">"{favorites.find(f => f.translation === trainingMessage)?.originalText || "???"}"</p>
                            </div>
                         </div>

                         <div className="grid grid-cols-1 gap-3">
                            {/* Generamos 3 opciones falsas + 1 verdadera */}
                            {[trainingMessage, ...favorites.filter(f => f.translation !== trainingMessage).slice(0, 2).map(f => f.translation)].sort().map((option, i) => (
                               <button 
                                 key={i}
                                 onClick={() => {
                                   setQuizOptionSelected(option);
                                   if (option === trainingMessage) {
                                     setQuizScore(prev => ({ ...prev, correct: prev.correct + 1, total: prev.total + 1 }));
                                   } else {
                                     setQuizScore(prev => ({ ...prev, total: prev.total + 1 }));
                                   }
                                   // Siguiente pregunta después de 1.5s
                                   setTimeout(() => {
                                     const randomFav = favorites[Math.floor(Math.random() * favorites.length)];
                                     setTrainingMessage(randomFav.translation);
                                     setQuizOptionSelected(null);
                                   }, 1500);
                                 }}
                                 disabled={quizOptionSelected !== null}
                                 className={cn(
                                   "p-5 rounded-2xl font-bold transition-all border text-left flex justify-between items-center group",
                                   quizOptionSelected === null 
                                     ? "bg-zinc-900 border-zinc-800 hover:border-amber-500/50" 
                                     : option === trainingMessage 
                                       ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" 
                                       : option === quizOptionSelected 
                                         ? "bg-red-500/10 border-red-500 text-red-500" 
                                         : "bg-zinc-900/50 border-zinc-900 opacity-50"
                                 )}
                               >
                                 <span className="text-sm">{option}</span>
                                 {quizOptionSelected !== null && option === trainingMessage && <CheckCircle2 size={16} />}
                                 {quizOptionSelected === option && option !== trainingMessage && <X size={16} />}
                               </button>
                            ))}
                         </div>

                         <div className="flex items-center justify-center gap-4 pt-4">
                            <div className="flex flex-col items-center">
                               <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Aciertos</span>
                               <span className="text-2xl font-black text-white">{quizScore.correct}</span>
                            </div>
                            <div className="w-px h-8 bg-zinc-800" />
                            <div className="flex flex-col items-center">
                               <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Total</span>
                               <span className="text-2xl font-black text-white">{quizScore.total}</span>
                            </div>
                         </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {trainingMode !== 'none' && (
                <div className="p-6 bg-zinc-900/30 border-t border-zinc-900">
                  <button 
                    onClick={() => {
                      setTrainingMode('none');
                      setResult(null);
                      setShadowingScore(null);
                    }}
                    className="w-full py-4 border border-zinc-800 text-zinc-400 hover:text-white font-black text-[10px] tracking-widest uppercase rounded-2xl active:scale-95 transition-all"
                  >
                    Elegir otro modo
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Selección de Idiomas (Pestaña) */}
      <AnimatePresence>
        {showLangPicker && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 backdrop-blur-3xl z-[150] flex items-end sm:items-center justify-center p-0 sm:p-6"
            onClick={() => setShowLangPicker(false)}
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-zinc-950 border-t sm:border border-zinc-800 w-full max-w-lg rounded-t-[3rem] sm:rounded-[3rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-8 border-b border-zinc-900 flex items-center justify-between bg-zinc-900/20">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center">
                    <Globe className="text-amber-500" size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tighter text-white">
                      {showLangPicker === 'source' ? "Idioma de Entrada" : "Idioma de Salida"}
                    </h3>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                      {showLangPicker === 'source' ? "Selecciona qué vas a decir o fotografiar" : "Selecciona el idioma al que quieres traducir"}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowLangPicker(false)}
                  className="p-3 hover:bg-zinc-800 rounded-2xl text-zinc-500 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto grid grid-cols-3 gap-3 scrollbar-hide flex-1">
                {LANGUAGES
                  .filter(l => !hiddenLangs.includes(l.name))
                  .filter(l => showLangPicker === 'target' ? l.name !== 'Auto' : true)
                  .map(lang => {
                    const isActive = showLangPicker === 'source' ? sourceLang === lang.name : targetLang === lang.name;
                    const hasOffline = downloadedModels.some(id => id.includes(ISO_LANG_MAP[lang.name]));
                    
                    return (
                      <button
                        key={lang.name}
                        onClick={() => {
                          if (showLangPicker === 'source') {
                            setSourceLang(lang.name);
                          } else {
                            setTargetLang(lang.name);
                          }
                          setShowLangPicker(false);
                        }}
                        className={cn(
                          "group p-4 rounded-[2rem] border transition-all flex flex-col items-center gap-2 relative",
                          isActive 
                            ? "bg-amber-500 border-amber-500 text-black shadow-2xl scale-105 z-10" 
                            : "bg-zinc-900/40 border-zinc-900 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-900"
                        )}
                      >
                        <span className="text-2xl group-hover:scale-125 transition-transform duration-300">{lang.flag}</span>
                        <span className="text-[10px] font-black uppercase tracking-tighter">{lang.name}</span>
                        {hasOffline && (
                          <div className={cn(
                            "absolute top-2 right-2 w-2 h-2 rounded-full",
                            isActive ? "bg-white" : "bg-green-500"
                          )} />
                        )}
                      </button>
                    );
                  })}
              </div>

              <div className="p-8 bg-zinc-900/30 border-t border-zinc-900">
                <button 
                  onClick={() => setShowLangPicker(false)}
                  className="w-full py-4 bg-white text-black font-black text-xs uppercase rounded-2xl active:scale-95 transition-all shadow-xl"
                >
                  GUARDAR SELECCIÓN
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

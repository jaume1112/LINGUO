import { pipeline } from '@xenova/transformers';

let translator: any = null;
let currentModel: string | null = null;

// Extended mapping for Opus-MT models
export const ISO_LANG_MAP: Record<string, string> = {
  "Afrikáans": "af", "Albanés": "sq", "Alemán": "de", "Amhárico": "am", "Árabe": "ar",
  "Armenio": "hy", "Azerbaiyano": "az", "Bascú": "eu", "Bielorruso": "be", "Bengalí": "bn",
  "Bosnio": "bs", "Búlgaro": "bg", "Catalán": "ca", "Cebuano": "ceb", "Chichewa": "ny",
  "Chino": "zh", "Coreano": "ko", "Corso": "co", "Croata": "hr", "Checo": "cs",
  "Danés": "da", "Holandés": "nl", "Inglés": "en", "Esperanto": "eo", "Estonio": "et",
  "Filipino": "tl", "Finlandés": "fi", "Francés": "fr", "Frisón": "fy", "Gallego": "gl",
  "Georgiano": "ka", "Griego": "el", "Gujarati": "gu", "Criollo haitiano": "ht",
  "Hausa": "ha", "Hawaiano": "haw", "Hebreo": "he", "Hindi": "hi", "Hmong": "hmn",
  "Húngaro": "hu", "Islandés": "is", "Igbo": "ig", "Indonesio": "id", "Irlandés": "ga",
  "Italiano": "it", "Japonés": "ja", "Javanés": "jw", "Kannada": "kn", "Kazajo": "kk",
  "Jemer": "km", "Kinyarwanda": "rw", "Kurdo": "ku", "Kirguís": "ky", "Lao": "lo",
  "Latín": "la", "Letón": "lv", "Lituano": "lt", "Luxemburgués": "lb", "Macedonio": "mk",
  "Malgache": "mg", "Malayo": "ms", "Malayalam": "ml", "Maltés": "mt", "Maorí": "mi",
  "Marathi": "mr", "Mongol": "mn", "Birmano": "my", "Nepalí": "ne", "Noruego": "no",
  "Oriya": "or", "Pashto": "ps", "Persa": "fa", "Polaco": "pl", "Portugués": "pt",
  "Punjabi": "pa", "Rumano": "ro", "Ruso": "ru", "Samoano": "sm", "Gaelico escocés": "gd",
  "Serbio": "sr", "Sesotho": "st", "Shona": "sn", "Sindhi": "sd", "Cingalés": "si",
  "Eslovaco": "sk", "Esloveno": "sl", "Somalí": "so", "Español": "es", "Sundanés": "su",
  "Swahili": "sw", "Sueco": "sv", "Tayiko": "tg", "Tamil": "ta", "Tártaro": "tt",
  "Telugu": "te", "Tailandés": "th", "Turco": "tr", "Turcomano": "tk", "Ucraniano": "uk",
  "Urdu": "ur", "Uigur": "ug", "Uzbeko": "uz", "Vietnamita": "vi", "Galés": "cy",
  "Xhosa": "xh", "Yiddish": "yi", "Yoruba": "yo", "Zulú": "zu"
};

export async function preloadLanguage(modelId: string, onProgress?: (progress: number) => void) {
  try {
    console.log(`Pre-cargando modelo: ${modelId}`);
    return await pipeline('translation', modelId, {
      progress_callback: (info: any) => {
        if (info.status === 'progress' && onProgress) {
          onProgress(info.progress);
        }
      }
    });
  } catch (e: any) {
    console.error(`Error pre-cargando ${modelId}:`, e);
    throw new Error(`Error descargando modelo (${modelId}): ${e.message || 'No se pudo conectar a HuggingFace. Verifica tu conexión a internet.'}`);
  }
}
export async function translateOffline(
  text: string, 
  source: string, 
  target: string, 
  onProgress?: (progress: number) => void
) {
  const src = ISO_LANG_MAP[source];
  const tgt = ISO_LANG_MAP[target];

  if (!src || !tgt) {
    throw new Error(`Este par (${source} -> ${target}) no está soportado offline por el motor Opus-MT.`);
  }

  // Priority search for Xenova-optimized models (ONNX)
  const modelOptions = [
    `Xenova/opus-mt-${src}-${tgt}`,
    `Xenova/opus-mt-tc-big-${src}-${tgt}`,
  ];

  // Specific linguistic family fallbacks for English bridges
  if (tgt === 'en') {
    modelOptions.push(`Xenova/opus-mt-mul-en`);
    // Indic languages fallback (Urdu, Hindi, etc.)
    if (['ur', 'hi', 'bn', 'gu', 'pa', 'mr', 'ta', 'te', 'kn', 'ml', 'or', 'si', 'ne'].includes(src)) {
      modelOptions.push(`Xenova/opus-mt-inc-en`);
    }
  }

  if (src === 'en') {
    modelOptions.push(`Xenova/opus-mt-en-mul`);
    if (['ur', 'hi', 'bn', 'gu', 'pa', 'mr', 'ta', 'te', 'kn', 'ml', 'or', 'si', 'ne'].includes(tgt)) {
      modelOptions.push(`Xenova/opus-mt-en-inc`);
    }
  }
  
  // Generic multilingual fallbacks for ANY pair with English
  if (tgt === 'en') modelOptions.push(`Xenova/opus-mt-mul-en`);
  if (src === 'en') modelOptions.push(`Xenova/opus-mt-en-mul`);

  // ULTIMATE FALLBACK: M2M100 (Support for 100 languages, very stable but larger)
  // This model is a tank - it translates almost anything offline.
  modelOptions.push(`Xenova/m2m100_418M`);

  let lastError = null;

  if (currentModel !== `Xenova/opus-mt-${src}-${tgt}`) {
    for (const modelId of modelOptions) {
      try {
        console.log(`Intentando cargar modelo: ${modelId}`);
        translator = await pipeline('translation', modelId, {
          progress_callback: (info: any) => {
            if (info.status === 'progress' && onProgress) {
              onProgress(info.progress);
            }
          }
        });
        currentModel = modelId;
        break; // Éxito
      } catch (e: any) {
        console.error(`Fallo al cargar modelo ${modelId}, intentando siguiente:`, e.message);
        lastError = e;
        continue; // Probar siguiente si falla
      }
    }

    if (!currentModel || !translator) {
      // SMART BRIDGE: Si falla el modelo directo, intentamos usar inglés como puente
      if (src !== 'en' && tgt !== 'en') {
        try {
          const step1 = await translateOffline(text, source, "Inglés", onProgress);
          return await translateOffline(step1, "Inglés", target, onProgress);
        } catch (bridgeErr) {
           return "Error: No se encontró modelo offline para esta combinación. Por favor, realiza la traducción con conexión.";
        }
      }
      return "Info: Este par requiere conexión para la traducción.";
    }
  }

  const output = await translator(text);
  return output[0].translation_text;
}

export const OFFLINE_SUPPORTED_LANGS = Object.keys(ISO_LANG_MAP);

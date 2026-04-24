import React from 'react';

export const TUTOR_PHRASES = [
  { 
    phrase: "C'est la vie", 
    meaning: "Así es la vida / Es lo que hay", 
    pronunciation: "[se la ví]", 
    usage: "Se usa para aceptar una situación decepcionante que no se puede cambiar. Refleja la mentalidad francesa de aceptar el destino con elegancia.",
    language: "Francés" 
  },
  { 
    phrase: "Break a leg", 
    meaning: "¡Mucha mierda! / Éxito", 
    pronunciation: "[breik a leg]", 
    usage: "En el teatro inglés, desear 'buena suerte' da mala suerte. Se dice 'rómpete una pierna' para engañar al destino. ¡Es el equivalente a nuestro 'mucha mierda'!",
    language: "Inglés" 
  },
  { 
    phrase: "Ganz toll", 
    meaning: "¡Qué maravilla! / Estupendo", 
    pronunciation: "[gants tol]", 
    usage: "En alemán, 'ganz' (totalmente) refuerza a 'toll' (genial). Úsalo para demostrar un entusiasmo sincero y vibrante por algo.",
    language: "Alemán" 
  },
  { 
    phrase: "Fer pinya", 
    meaning: "Unirse / Trabajar en equipo", 
    pronunciation: "[fer pinya]",
    usage: "Expresión catalana que viene de los 'castellers' (torres humanas). Significa que todos trabajamos juntos para lograr un objetivo común.",
    language: "Catalán"
  },
  { 
    phrase: "Nosce te ipsum", 
    meaning: "Conócete a ti mismo", 
    pronunciation: "[nos-ke te ip-sum]", 
    usage: "Famosa inscripción del templo de Delfos en Griego Antiguo. Refleja la sabiduría clásica que dio origen a la filosofía occidental.",
    language: "Griego Antiguo" 
  },
  { 
    phrase: "𓇋𓏏𓈖𓇳", 
    meaning: "Atón (El disco solar)", 
    pronunciation: "[a-ten]", 
    usage: "Escritura jeroglífica del antiguo Egipto. Representa el sol y fue el centro de la revolución religiosa de Akenatón.",
    language: "Egipcio (Jeroglíficos)" 
  },
  { 
    phrase: "I ni ce", 
    meaning: "Hola / Gracias", 
    pronunciation: "[i ni che]", 
    usage: "Saludo básico en Mandinga. Es una de las lenguas más importantes de África Occidental, hablada en Gambia, Senegal y Guinea.",
    language: "Mandinga" 
  },
  { 
    phrase: "Som-hi!", 
    meaning: "¡Vamos! / ¡Adelante!", 
    pronunciation: "[som-i]", 
    usage: "El grito de guerra catalán por excelencia. Se usa para animar a alguien a empezar algo o para celebrar que nos ponemos en marcha juntos.",
    language: "Catalán" 
  }
];

export const STATIC_LANGUAGES = [
  { name: "Auto", flag: "🪄", color: "#f59e0b" },
  { name: "Chino", flag: "🇨🇳", color: "#ef4444" },
  { name: "Inglés", flag: "🇺🇸", color: "#3b82f6" },
  { name: "Francés", flag: "🇫🇷", color: "#2563eb" },
  { name: "Alemán", flag: "🇩🇪", color: "#fbbf24" },
  { name: "Italiano", flag: "🇮🇹", color: "#16a34a" },
  { name: "Japonés", flag: "🇯🇵", color: "#dc2626" },
  { name: "Coreano", flag: "🇰🇷", color: "#6366f1" },
  { name: "Portugués", flag: "🇵🇹", color: "#0d9488" },
  { name: "Ruso", flag: "🇷🇺", color: "#60a5fa" },
  { name: "Árabe", flag: "🇸🇦", color: "#059669" },
  { name: "Árabe Egipcio", flag: "🇪🇬", color: "#ef4444" },
  { name: "Español", flag: "🇪🇸", color: "#ef4444" },
  { 
    name: "Catalán", 
    color: "#fbbf24",
    flag: (
      <svg className="w-5 h-3.5 rounded-[2px]" viewBox="0 0 9 9" preserveAspectRatio="none">
        <rect width="9" height="9" fill="#FFD700" />
        <rect width="9" height="1" y="1" fill="#CC0000" />
        <rect width="9" height="1" y="3" fill="#CC0000" />
        <rect width="9" height="1" y="5" fill="#CC0000" />
        <rect width="9" height="1" y="7" fill="#CC0000" />
      </svg>
    )
  },
  { 
    name: "Eusquera", 
    color: "#15803d",
    flag: (
      <svg className="w-5 h-3.5 rounded-[2px]" viewBox="0 0 560 400">
        <rect width="560" height="400" fill="#ce2b37" />
        <path d="M0 0 L560 400 M560 0 L0 400" stroke="#009b48" strokeWidth="43" />
        <path d="M280 0 L280 400 M0 200 L560 200" stroke="#ffffff" strokeWidth="43" />
      </svg>
    )
  },
  { name: "Rumano", flag: "🇷🇴", color: "#3b82f6" },
  { name: "Ucraniano", flag: "🇺🇦", color: "#38bdf8" },
  { name: "Hebreo", flag: "🇮🇱", color: "#93c5fd" },
  { name: "Hindi", flag: "🇮🇳", color: "#f97316" },
  { name: "Latín", flag: "🏛️", color: "#facc15" },
  { name: "Esperanto", flag: "🟢", color: "#16a34a" },
  { name: "Quechua", flag: "⛰️", color: "#ea580c" },
  { name: "Maya", flag: "🗿", color: "#1d4ed8" },
  { name: "Griego", flag: "🇬🇷", color: "#3b82f6" },
  { name: "Griego Antiguo", flag: "📜", color: "#f59e0b" },
  { name: "Egipcio (Jeroglíficos)", flag: "𓁹", color: "#fbbf24" },
  { name: "Mandinga", flag: "🇬🇲", color: "#16a34a" },
  { name: "Moldavo", flag: "🇲🇩", color: "#b91c1c" }
];

export const TESSERACT_LANG_MAP: Record<string, string> = {
  "Inglés": "eng", "Español": "spa", "Francés": "fra", "Alemán": "deu",
  "Italiano": "ita", "Portugués": "por", "Catalán": "cat", "Rumano": "ron",
  "Ruso": "rus", "Chino": "chi_sim", "Japonés": "jpn", "Coreano": "kor",
  "Ucraniano": "ukr", "Griego": "ell", "Moldavo": "ron"
};

export const FLAG_MAP: Record<string, string> = {
  "Urdu": "🇵🇰", "Islandés": "🇮🇸", "Swahili": "🇰🇪", "Zulú": "🇿🇦", 
  "Turco": "🇹🇷", "Polaco": "🇵🇱", "Holandés": "🇳🇱", "Sueco": "🇸🇪",
  "Danés": "🇩🇰", "Noruego": "🇳🇴", "Finlandés": "🇫🇮", "Vietnamita": "🇻🇳",
  "Tailandés": "🇹🇭", "Indonesio": "🇮🇩", "Albanyès": "🇦🇱", "Búlgaro": "🇧🇬",
  "Croata": "🇭🇷", "Checo": "🇨🇿", "Griego": "🇬🇷", "Húngaro": "🇭🇺",
  "Hebreo": "🇮🇱", "Hindi": "🇮🇳", "Rumano": "🇷🇴", "Ucraniano": "🇺🇦"
};

import i18next from 'i18next';
import Backend from 'i18next-fs-backend';
import Middleware from 'i18next-http-middleware';

i18next
  .use(Backend)
  .use(Middleware.LanguageDetector)
  .init({
    fallbackLng: 'en', // Default language if translation is missing
    preload: ['en', 'es', 'fr', 'de'], // Preload these languages
    backend: {
      loadPath: './src/locales/{{lng}}/translation.json', // Path to translation files
    },
    detection: {
      order: ['querystring', 'header', 'cookie'], // Detection priorities
      caches: ['cookie'], // Cache user language in cookies
    },
    debug: false, // Enable for debugging language issues
    interpolation: {
      escapeValue: false, // React handles escaping by default
    },
  });

export default i18next;

// import i18n from 'i18n';
// import path from 'path';
// import { fileURLToPath } from 'url';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// i18n.configure({
//   // Supported languages
//   locales: ['en', 'es'],

//   // Default language
//   defaultLocale: 'en',

//   // Location of translation files
//   directory: path.join(__dirname, '../locales'),

//   // Enable object notation (allows nested translations)
//   objectNotation: true,

//   // Retain key if missing translation
//   retainKeyOnMissing: true,

//   // Add timestamp to missing translations in development
//   updateFiles: process.env.NODE_ENV === 'development',

//   // Header name for language detection
//   header: 'accept-language',

//   // Query parameter to override language
//   queryParameter: 'lang',

//   // API response structure
//   api: {
//     __: 't', // Now we can use req.t() instead of req.__()
//   },
// });

// export default i18n;

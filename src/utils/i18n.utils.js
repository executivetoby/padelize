const i18nMiddleware = (req, res, next) => {
  // Check query parameter first, then header, then default
  const locale =
    req.query.lang || req.headers['accept-language']?.split(',')[0] || 'en';

  req.setLocale(locale);

  // Add language to response locals for views if needed
  res.locals.currentLocale = locale;
  res.locals.locales = i18n.getLocales();

  next();
};

export default i18nMiddleware;

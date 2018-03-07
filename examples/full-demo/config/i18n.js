const axios = require('axios')

const localeMap = {
  'de': ['de', 'at', 'ch'],
  'bs': ['ba']
}

const locales = ['en', 'de', 'bs']

module.exports = {
  allLocales: locales,
  defaultLocale: 'en',
  messages: require('../locales/json/translations.json') || {},
  defaultLocaleInRoutes: false,
  usingRouter: true,
  routingStyle: 'redirect',
  forceReloadOnSwitch: false,
  storageMethod: 'cookie',
  storageKey: 'full_demo_active_locale',
  cookieExpirationInDays: 182
}

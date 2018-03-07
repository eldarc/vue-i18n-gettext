const { Extractor, Compiler } = require('vue-gettext-tools')
const gettextOptions = require('../config/i18n')

const extractorConfig = {verbose: true}
const compilerConfig = {verbose: true}
const locales = gettextOptions.allLocales

Extractor(extractorConfig, ['src/**/*.{vue,js}'], 'locales/po/dictionary.pot')
Compiler(compilerConfig, 'locales/po/dictionary.pot', 'locales/po/', 'locales/json/', locales)

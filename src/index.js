import VueI18n from 'vue-i18n'
import gettextFunctions from './gettext'
import Component from './component'
import Directive from './directive'

/* @flow */
function plugin (Vue: any, options: Object = {}) {
  // Expose gettext functions.
  Vue.prototype.$gettext = gettextFunctions._gettext
  Vue.prototype.$pgettext = gettextFunctions._pgettext
  Vue.prototype.$ngettext = gettextFunctions._ngettext
  Vue.prototype.$npgettext = gettextFunctions._npgettext
  Vue.prototype.$_i = gettextFunctions._i18nInterpolate

  // Updates the selected language and if router prefixing is configured redirects to the proper language route.
  Vue.prototype.$changeLocale = function (locale) {
    if (this.$i18nGettext.allLocales.includes(locale)) {
      const oldLocale = this.$i18n.locale
      const _routePath = this.$route.matched[0].path.replace(':_locale', locale === this.$i18nGettext.defaultLocale ? '' : locale)

      // Switch locale.
      this.$i18n.locale = locale

      if (this.$i18nGettext.storageMethod !== 'custom') {
        switchMethods[this.$i18nGettext.storageMethod].save(this.$i18nGettext.storageKey, locale, oldLocale, this.$i18nGettext.cookieExpirationInDays)
      } else {
        this.$i18nGettext.storageFunctions.save(this.$i18nGettext.storageKey, locale, oldLocale)
      }

      // If router prefixing is enabled, push route.
      this.$router.push(_routePath)
      window.location.reload()
    }
  }

  // Converts a router link to the version of the current language.
  Vue.prototype.$localeLink = function (link) {
    link = '/' + (this.$i18n.locale !== this.$i18nGettext.defaultLocale ? this.$i18n.locale : '') + '/' + (this.$i18nGettext.allLocales.includes(link) ? '' : link)
    link = link.replace(new RegExp('/{2,}', 'giu'), '/')

    if (link > 1 && link.charAt(link.length - 1) === '/') {
      link.path = link.path.slice(0, -1)
    }

    return link
  }

  // Makes <translate> available as a global component.
  Vue.component('translate', Component(Vue))

  // An option to support translation with HTML content: `v-translate`.
  Vue.directive('translate', Directive)
}

// Built-in methods for changing and selecting the locale.
const switchMethods = {
  session: {
    save (key, newLocale, oldLocale) {
      window.sessionStorage.setItem(key, newLocale)
    },
    load (key) {
      return window.sessionStorage.getItem(key)
    }
  },
  local: {
    save (key, newLocale, oldLocale) {
      window.localStorage.setItem(key, newLocale)
    },
    load (key) {
      return window.localStorage.getItem(key)
    }
  },
  cookie: {
    save (key, newLocale, oldLocale, expirationInDays) {
      function setCookie (cname, cvalue, exdays) {
        const d = new Date()
        d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000))
        const expires = 'expires=' + d.toUTCString()
        document.cookie = cname + '=' + cvalue + ';' + expires + ';path=/'
      }

      setCookie(key, newLocale, expirationInDays || 365)
    },
    load (key) {
      function getCookie (cname) {
        const name = cname + '='
        const decodedCookie = decodeURIComponent(document.cookie)
        const ca = decodedCookie.split(';')
        for (let i = 0; i < ca.length; i++) {
          let c = ca[i]
          while (c.charAt(0) === ' ') {
            c = c.substring(1)
          }
          if (c.indexOf(name) === 0) {
            return c.substring(name.length, c.length)
          }
        }
        return ''
      }

      return getCookie(key)
    }
  }
}

// Parse configuration and return normalized values.
const parseOptions = (options) => {
  // Mapping of vue-i18n settings.
  // messages: {},
  // locale: '', // Convert this to defaultLocale. defaultLocale has priority if both are present.
  // fallbackLocale: '', // Ignore this parameter
  // dateTimeFormats, // Allowed
  // numberFormats, // Allowed
  // formatter, // Ignore
  // missing, // Ignore
  // fallbackRoot, // Ignore
  // sync, // Ignore
  // silentTranslationWarn // Ignore, but use in gettext instance.

  if (options.locale) {
    options.defaultLocale = options.defaultLocale ? options.defaultLocale : options.locale
  }

  const _options = {
    messages: options.messages || {},
    defaultLocale: options.defaultLocale || 'en',
    allLocales: options.allLocales || (options.defaultLocale ? [options.defaultLocale] : ['en']),
    usingRouter: options.usingRouter || false,
    routingStyle: options.routingStyle || 'changeLocale',
    storageMethod: typeof options.storageMethod !== 'object' ? (['session', 'local', 'cookie'].includes(options.storageMethod.trim()) ? options.storageMethod.trim() : 'local') : 'custom',
    storageKey: options.storageKey || '_vue_i18n_gettext_locale',
    cookieExpirationInDays: options.cookieExpirationInDays || 30,
    customOnLoad: options.customOnLoad
  }

  if (_options.storageMethod === 'custom') {
    _options.storageFunctions = options.storageMethod
  }

  return _options
}

// Make an instance of vue-i18n and add additional configuration options.
const GettextInstance = (Vue, options) => {
  const setLocale = (locale) => {
    let savedLocale
    if (options.storageMethod !== 'custom') {
      savedLocale = switchMethods[options.storageMethod].load(options.storageKey)
    } else {
      savedLocale = options.storageFunctions.load(options.storageKey)
    }

    if (savedLocale && savedLocale !== locale) {
      return savedLocale
    }

    return locale
  }

  // Load the `vue-i18n` dependency.
  Vue.use(VueI18n)

  // Parse options.
  options = parseOptions(options)

  const _i18n = new VueI18n({
    locale: setLocale(options.defaultLocale),
    messages: options.messages,
    dateTimeFormats: options.dateTimeFormats,
    numberFormats: options.numberFormats
  })

  const _i18nGettext = options

  Vue.prototype.$i18nGettext = _i18nGettext

  return _i18n
}

// Locale route converts a router route to multiple routes with language prefix.
// Example: path `/about-us` with allLanguages having `en,de,es` as languages and `en` as defaultLanguage will generate
// routes with following paths: '/about-us', '/de/about-us', '/es/about-us'
class LocaleRoute {
  constructor (options) {
    const config = parseOptions(options)

    this.defaultLocale = config.defaultLocale
    this.allLocales = config.allLocales
    this.storageMethod = config.storageMethod
    this.storageKey = config.storageKey
    this.storageFunctions = config.storageFunctions

    if (this.storageMethod !== 'custom') {
      this.savedLocale = switchMethods[this.storageMethod].load(this.storageKey) || this.defaultLocale
    } else {
      this.savedLocale = this.storageFunctions.load(this.storageKey) || this.defaultLocale
    }
  }

  set (route) {
    const _originalRoute = Object.assign({}, route)
    const _prefixedRoute = Object.assign({}, route)
    const _plainPath = route.path

    // If the route is plain, detect the selected locale and redirect to the proper URL.
    _originalRoute.name = '__default:' + _plainPath
    _originalRoute.beforeEnter = (to, from, next) => {
      if (this.savedLocale !== this.defaultLocale && to.fullPath === _plainPath) {
        let _nextPath = '/' + this.savedLocale + '/' + _plainPath
        _nextPath = _nextPath.replace(new RegExp('/{2,}', 'giu'), '/')
        next(_nextPath)
      }

      next()
    }

    // Based on the `_locale` in URL select active locale.
    _prefixedRoute.path = '/:_locale/' + _prefixedRoute.path
    _prefixedRoute.path = _prefixedRoute.path.replace(new RegExp('/{2,}', 'giu'), '/')

    if (!_prefixedRoute.params) {
      _prefixedRoute.params = {}
    }
    _prefixedRoute.params._locale = this.defaultLocale

    _prefixedRoute.beforeEnter = (to, from, next) => {
      if (!this.allLocales.includes(to.params._locale)) {
        next({ name: '__default:' + to.fullPath })
      } else if (to.params._locale === this.defaultLocale && to.fullPath !== _plainPath) {
        next(_plainPath)
      }

      next()
    }

    return [_originalRoute, _prefixedRoute]
  }
}

const gettextMixin = {
  created () {
    if (this.$i18nGettext.customOnLoad && typeof this.$i18nGettext.customOnLoad === 'function') {
      this.$i18nGettext.customOnLoad(this)
    }

    // TODO: Add global process override.
    if (this.$i18nGettext.usingRouter && this.$i18nGettext.routingStyle === 'changeLocale') {
      if (this.$route.params._locale !== this.$i18n.locale) {
        this.$changeLocale(this.$route.params._locale)
      }
    } else if (this.$i18nGettext.usingRouter && this.$i18nGettext.routingStyle === 'redirect') {
      if (this.$route.params._locale !== this.$i18n.locale) {
        if (this.$i18n.locale === this.$i18nGettext.defaultLocale) {
          const _next = this.$route.matched[0].path.replace(':_locale', '')
          this.$router.push({ name: '__default:' + (_next || '/') })
        } else {
          this.$router.push(this.$route.matched[0].path.replace(':_locale', this.$i18n.locale))
        }
      }
    }
  }
}

plugin.version = '__VERSION__'

export { plugin as VueGettext, GettextInstance, LocaleRoute, gettextMixin, VueI18n }

export default plugin

if (typeof window !== 'undefined' && window.Vue) {
  window.Vue.use(plugin)
}

import VueI18n from 'vue-i18n'
import pathToRegexp from 'path-to-regexp'
import gettextFunctions from './gettext'
import Component from './component'
import Directive from './directive'

/* @flow */
function plugin (Vue: any, options: Object = {}, router) {
  // Expose gettext functions.
  Vue.prototype.$gettext = gettextFunctions._gettext
  Vue.prototype.$pgettext = gettextFunctions._pgettext
  Vue.prototype.$ngettext = gettextFunctions._ngettext
  Vue.prototype.$npgettext = gettextFunctions._npgettext
  Vue.prototype.$_i = gettextFunctions._i18nInterpolate

  // Changes the active locale.
  Vue.prototype.$changeLocale = function (locale) {
    // TODO: Move this helper function to a global helpers object.
    const _matchedPathtoPath = (path, replace, replacement) => {
      const _path = path.replace(replace, replacement).replace(new RegExp('/{2,}', 'giu'), '/')
      return _path !== '' ? _path : '/'
    }

    if (this.$i18nGettext.allLocales.includes(locale)) {
      const oldLocale = this.$i18n.locale

      if (this.$i18nGettext.storageMethod !== 'custom') {
        switchMethods[this.$i18nGettext.storageMethod].save(this.$i18nGettext.storageKey, locale, oldLocale, this.$i18nGettext.cookieExpirationInDays)
      } else {
        this.$i18nGettext.storageFunctions.save(this.$i18nGettext.storageKey, locale, oldLocale)
      }

      this.$i18n.locale = locale

      if (this.$i18nGettext.usingRouter) {
        this.$route.params._locale = locale
        this.$router.push({
          name: '__locale:' + _matchedPathtoPath(this.$route.matched[0].path, ':_locale', ''),
          params: Object.assign(this.$route.params, { _locale: locale, _changeLocale: true })
        })
        window.location.reload()
      } else {
        window.location.reload()
      }
    }
  }

  // Converts a router link to the version of the current locale.
  Vue.prototype.$localeLink = function (link) {
    const toPath = pathToRegexp.compile(link.replace('$locale', ':_locale?'))
    const path = toPath({ _locale: this.$i18n.locale === this.$i18nGettext.defaultLocale ? (this.$i18nGettext.defaultLocaleInRoutes ? this.$i18n.locale : undefined) : this.$i18n.locale })
    return path === '' ? '/' : path
  }

  // Makes <translate> available as a global component.
  Vue.component('translate', Component(Vue))

  // An option to support translation with HTML content: `v-translate`.
  Vue.directive('translate', Directive)
}

// Built-in methods for changing, selecting and storing the locale.
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
    defaultLocaleInRoutes: options.defaultLocaleInRoutes || false,
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

// Default gettext router guard to help proper routing when there are locales in the URL path.
const GettextRouterGuard = function (options, router) {
  const config = parseOptions(options)

  const _path = (path, replacement) => {
    const _path = path.replace('$locale', replacement).replace(new RegExp('/{2,}', 'giu'), '/')
    return _path !== '' ? _path : '/'
  }

  // TODO: Move this helper function to a global helpers object.
  const _matchedPathtoPath = (path, replace, replacement) => {
    const _path = path.replace(replace, replacement).replace(new RegExp('/{2,}', 'giu'), '/')
    return _path !== '' ? _path : '/'
  }

  // Prepare the routes to be ready for translation purposes.
  // Duplicate all routes, and make a `blank` and a `locale` version.
  // Blank versions are paths without the `_locale` parameter, and locale versions are paths with the `:_locale` parameter.
  // Delete the previous router paths, and set it to the newly prepared routes array.
  const _modifiedRoutes = []

  router.options.routes.forEach((route) => {
    const blankPath = _path(route.path, '')
    const localePath = _path(route.path, ':_locale')

    _modifiedRoutes.push(Object.assign(
      Object.assign({}, route),
      {
        name: '__blank:' + blankPath,
        path: blankPath
      }
    ))
    _modifiedRoutes.push(Object.assign(
      Object.assign({}, route),
      {
        name: '__locale:' + blankPath,
        path: localePath
      }
    ))
  })
  router.options.routes = []
  router.addRoutes(_modifiedRoutes)

  // Get saved locale data.
  let savedLocale
  if (config.storageMethod !== 'custom') {
    savedLocale = switchMethods[config.storageMethod].load(config.storageKey)
  } else {
    savedLocale = config.storageFunctions.load(config.storageKey)
  }

  return (to, from, next) => {
    const localeSwitch = to.params._changeLocale

    if (to.params._locale) {
      if (!config.allLocales.includes(to.params._locale)) {
        // Fallback to the path without the `_locale` parameter if the parsed `_locale` value isn't in the configuration locales list.
        // If the request URL, for example, was `domain.com/about-us`, and the router matched `about-us` as the locale,
        // the matched path `/:_locale` will be converted to `/about-us` and send to the router as the next path.
        // This route was prepared in advance and a name was set in the form of `__blank:{{path}}`.
        const localeReplacement = to.params._locale
        delete to.params._locale
        next({
          name: '__blank:' + _matchedPathtoPath(to.matched[0].path, ':_locale', localeReplacement),
          params: to.params,
          hash: to.hash,
          query: to.query
        })
      } else {
        if (to.params._locale !== savedLocale && !localeSwitch) {
          if (config.routingStyle === 'redirect') {
            // Change the parsed locale to the saved locale if the config says that there should be always a redirection to the saved locale.
            next({
              name: '__locale:' + _matchedPathtoPath(to.matched[0].path, ':_locale', ''),
              params: Object.assign(to.params, { _locale: savedLocale }),
              hash: to.hash,
              query: to.query
            })
          } else if (config.routingStyle === 'changeLocale') {
            // Don't change the path, but change the selected locale if the config defines the routing style to `changeLocale`.
            if (config.storageMethod !== 'custom') {
              switchMethods[config.storageMethod].save(config.storageKey, to.params._locale, savedLocale, config.cookieExpirationInDays)
            } else {
              config.storageFunctions.save(config.storageKey, to.params._locale, savedLocale)
            }

            router.go({
              name: to.name,
              params: to.params,
              hash: to.hash,
              query: to.query
            })
          }
        } else if (config.defaultLocaleInRoutes === false && to.params._locale === config.defaultLocale) {
          // If the parsed `_locale` is equal to the default locale, and the config says that there are no URLs which include the default locale
          // replace the `_locale` and redirect to the named blank version.
          delete to.params._locale
          next({
            name: '__blank:' + _matchedPathtoPath(to.matched[0].path, ':_locale', ''),
            params: to.params,
            hash: to.hash,
            query: to.query
          })
        } else {
          next()
        }
      }
    } else {
      if (config.defaultLocale !== savedLocale && !localeSwitch) {
        if (config.routingStyle === 'redirect') {
          // Change the parsed locale to the saved locale if the config says that there should be always a redirection to the saved locale.
          next({
            name: '__locale:' + _matchedPathtoPath(to.matched[0].path, ':_locale', ''),
            params: Object.assign(to.params, { _locale: savedLocale }),
            hash: to.hash,
            query: to.query
          })
        } else if (config.routingStyle === 'changeLocale') {
          // Don't change the path, but change the selected locale if the config defines the routing style to `changeLocale`.
          if (config.storageMethod !== 'custom') {
            switchMethods[config.storageMethod].save(config.storageKey, config.defaultLocale, savedLocale, config.cookieExpirationInDays)
          } else {
            config.storageFunctions.save(config.storageKey, config.defaultLocale, savedLocale)
          }

          router.go({
            name: to.name,
            params: to.params,
            hash: to.hash,
            query: to.query
          })
        }
      } else if (config.defaultLocaleInRoutes === true) {
        // If the config says that there cannot be an URL without a locale, redirect a blank route to a locale route.
        next({
          name: '__locale:' + _matchedPathtoPath(to.matched[0].path, ':_locale', ''),
          params: Object.assign(to.params, { _locale: config.defaultLocale }),
          hash: to.hash,
          query: to.query
        })
      } else {
        next()
      }
    }
  }
}

const gettextMixin = {
  created () {
    if (this.$i18nGettext.customOnLoad && typeof this.$i18nGettext.customOnLoad === 'function') {
      this.$i18nGettext.customOnLoad(this)
    }
  }
}

plugin.version = '__VERSION__'

export { plugin as VueGettext, GettextInstance, GettextRouterGuard, gettextMixin, VueI18n }

export default plugin

if (typeof window !== 'undefined' && window.Vue) {
  window.Vue.use(plugin)
}

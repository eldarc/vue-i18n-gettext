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
  Vue.prototype.$npgettext = gettextFunctions._npgettext“
  Vue.prototype.$_i = gettextFunctions._i18nInterpolate

  // Updates the selected language and if router prefixing is configured redirects to the proper language route.
  Vue.prototype.$changeLocale = function (locale) {
    const oldLocale = this.$i18n.locale
    const _routePath = this.$route.matched[0].path.replace(':_locale', locale)

    // Switch locale.
    this.$i18n.locale = locale
    switchMethods[this.$i18nGettext.storageMethod].save(this.$i18nGettext.storageKey, locale, oldLocale)

    // If router prefixing is enabled, push route.
    this.$router.push(_routePath)
    window.location.reload()
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
  }
}

// Make an instance of vue-i18n and add additional configuration options.
const GettextInstance = (Vue, options) => {
  const setLocale = (locale) => {
    const savedLocale = switchMethods[options.storageMethod].load(options.storageKey)

    if (savedLocale && savedLocale !== locale) {
      return savedLocale
    }

    return locale
  }

  // Load the `vue-i18n` dependency.
  Vue.use(VueI18n)

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

  const _i18n = new VueI18n({
    locale: setLocale(options.defaultLocale || 'en'),
    messages: options.messages,
    dateTimeFormats: options.dateTimeFormats,
    numberFormats: options.numberFormats
  })

  const _i18nGettext = {
    defaultLocale: options.defaultLocale || 'en',
    allLocales: options.allLocales || (options.defaultLocale ? [options.defaultLocale] : ['en']),
    usingRouter: options.usingRouter || false,
    routingStyle: options.routingStyle || 'changeLocale',
    storageMethod: options.storageMethod || 'local',
    storageKey: options.storageKey || '_vue_i18n_gettext_locale'
  }

  Vue.prototype.$i18nGettext = _i18nGettext

  return _i18n
}

// Locale route converts a router route to multiple routes with language prefix.
// Example: path `/about-us` with allLanguages having `en,de,es` as languages and `en` as defaultLanguage will generate
// routes with following paths: '/about-us', '/de/about-us', '/es/about-us'
function LocaleRoute (config) {
  this.defaultLocale = config.defaultLocale
  this.allLocales = config.allLocales
  this.storageMethod = config.storageMethod
  this.storageKey = config.storageKey

  this.set = function (route) {
    const _originalRoute = Object.assign({}, route)
    const _prefixedRoute = Object.assign({}, route)
    const _plainPath = route.path

    // If the route is plain, detect the selected locale and redirect to the proper URL.
    const savedLocale = switchMethods[this.storageMethod].load(this.storageKey)
    _originalRoute.beforeEnter = (to, from, next) => {
      if (savedLocale !== this.defaultLocale && to.fullPath === _plainPath) {
        let _nextPath = '/' + savedLocale + '/' + _plainPath
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
      if (to.params._locale === this.defaultLocale && to.fullPath !== _plainPath) {
        next(_plainPath)
      }

      next()
    }

    return [_originalRoute, _prefixedRoute]
  }
}

const gettextMixin = {
  created () {
    if (this.$i18nGettext.usingRouter && this.$i18nGettext.routingStyle === 'changeLocale') {
      if (this.$route.params._locale !== this.$i18n.locale) {
        this.$i18n.locale = this.$route.params._locale
      }
    } else if (this.$i18nGettext.usingRouter && this.$i18nGettext.routingStyle === 'redirect') {
      if (this.$route.params._locale !== this.$i18n.locale) {
        this.$router.push(this.$route.matched[0].path.replace(':_locale', this.$i18n.locale))
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

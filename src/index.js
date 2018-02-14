import pathToRegexp from 'path-to-regexp'
import gettextFunctions from './gettext'
import miniparser from './miniparser'
import Component from './component'
import Directive from './directive'
import { warn } from './util'
import uuid from './uuid'

/* @flow */
function plugin (Vue: any, options: Object = {}, router, marked) {
  // Expose gettext functions.
  Vue.prototype.$gettext = gettextFunctions._gettext
  Vue.prototype.$pgettext = gettextFunctions._pgettext
  Vue.prototype.$ngettext = gettextFunctions._ngettext
  Vue.prototype.$npgettext = gettextFunctions._npgettext
  Vue.prototype.$_i = gettextFunctions._i18nInterpolate

  // Expose gettext parser helper.
  Vue.prototype.$parseGettext = function (input, n, nCount) {
    try {
      const parsedGettextCall = miniparser(input)

      if (parsedGettextCall.identifier === 'ngettext' || parsedGettextCall.identifier === 'npgettext') {
        if (n && typeof n === 'number') {
          parsedGettextCall.parameters[parsedGettextCall.parameters.length - 1] = n
          nCount.counter = nCount.counter + 1
        } else {
          parsedGettextCall.parameters[parsedGettextCall.parameters.length - 1] = 1
        }
      }

      return this['$' + parsedGettextCall.identifier](...parsedGettextCall.parameters)
    } catch (err) {
      if (err.message !== 'NOT_STRING' && err.message !== 'INVALID_START') {
        warn(`[gettext-miniparser] ${input} => ${err}`)
      }
      return input
    }
  }
  Vue.prototype.$parseObjectGettext = function (input, ns, values) {
    // Walk object and call $parseGettext for each string.
    // Think about how to inject multiple plural values
    if (typeof input === 'object') {
      const self = this
      const output = JSON.parse(JSON.stringify(input))
      const nCount = {
        counter: 0,
        getN () {
          if (ns[this.counter]) {
            return ns[this.counter]
          } else {
            return undefined
          }
        }
      }

      ;(function walkObject (pointer) {
        const keys = Object.keys(pointer)

        for (let i = 0; i < keys.length; i++) {
          if (typeof pointer[keys[i]] === 'string') {
            if (ns) {
              pointer[keys[i]] = self.$parseGettext(pointer[keys[i]], nCount.getN(), nCount)
            } else {
              pointer[keys[i]] = self.$parseGettext(pointer[keys[i]])
            }

            if (values && typeof values === 'object') {
              pointer[keys[i]] = self.$_i(pointer[keys[i]], values)
            }
          } else if (typeof pointer[keys[i]] === 'object') {
            walkObject(pointer[keys[i]])
          }
        }
      })(output)

      return output
    } else {
      return this.$parseGettext(input, ns)
    }
  }

  // Parse options to config.
  const config = parseOptions(options)

  // Load the saved locale.
  // TODO: Move load and save of stored keys to helper functions.
  let savedLocale
  if (config.storageMethod !== 'custom') {
    savedLocale = switchMethods[config.storageMethod].load(config.storageKey)
  } else {
    savedLocale = config.storageFunctions.load(config.storageKey)
  }

  // Modify the router so that is compatible with locale routing and switching.
  // TODO: Move this helper function to a global helpers object.
  const _path = (path, replace, replacement) => {
    const _path = path.replace(replace, replacement).replace(new RegExp('/{2,}', 'giu'), '/')
    return _path !== '' ? _path : '/'
  }

  // Prepare the routes to be ready for translation purposes.
  // Duplicate all routes, and make a `blank` and a `locale` version.
  // Blank versions are paths without the `_locale` parameter, and locale versions are paths with the `:_locale` parameter.
  // Delete the previous router paths, and set it to the newly prepared routes array.
  const _modifiedRoutes = []
  if (router) {
    // Duplicate routes and assign valid names.
    router.options.routes.forEach((_route) => {
      const blankPath = _path(_route.path, '$locale', '')
      const localePath = _path(_route.path, '$locale', ':_locale')

      const i18nId = uuid()
      _modifiedRoutes.push(Object.assign(
        Object.assign({}, _route),
        {
          name: _route.name ? _route.name : i18nId,
          path: blankPath,
          meta: {
            i18nId: i18nId,
            localized: false
          }
        }
      ))

      const localeName = '__locale:' + i18nId
      _modifiedRoutes.push(Object.assign(
        Object.assign({}, _route),
        {
          name: localeName,
          path: config.routeAutoPrefix ? '/:_locale?' + localePath : localePath,
          meta: {
            seedI18n: i18nId,
            localized: true
          }
        }
      ))

      // Remove names from sub-routes in the __locale version.
      const currentRoute = _modifiedRoutes[_modifiedRoutes.length - 1]
      if (currentRoute.children) {
        currentRoute.children = JSON.parse(JSON.stringify(currentRoute.children))

        ;(function removeNames (_currentRoute) {
          _currentRoute.children.forEach((childRoute) => {
            childRoute.name = null

            if (!childRoute.meta) {
              childRoute.meta = {}
            }

            childRoute.meta.childOfLocale = localeName

            if (childRoute.children && childRoute.children.length > 0) {
              removeNames(childRoute)
            }
          })
        })(currentRoute)
      }
    })

    // Reset routes.
    // delete router.options.routes
    router.matcher = new (Object.getPrototypeOf(router)).constructor({
      mode: 'history',
      routes: []
    }).matcher

    // Add new routes.
    router.addRoutes(_modifiedRoutes)
    // console.log(_modifiedRoutes)
    // console.log(_modifiedRoutes)
    // console.log(_mapLocaleNameToOriginal)
    // console.log(router.options.routes)

    // Inject the gettext router guard to the router.
    router.beforeEach((to, from, next) => {
      if ((to.params._locale && !config.allLocales.includes(to.params._locale)) || (to.params._locale && to.params._locale === config.defaultLocale && !config.defaultLocaleInRoutes)) {
        // If the route is matched as the homepage or the locale is the default locale (and default locale in the url is disabled),
        // use the locale parameter to find the actual wanted route (which is located in the seed routes).
        const validLocaleMatchPath = to.matched[0].path.replace(':_locale?', '__locale__/' + to.params._locale)
        const validLocaleMatch = router.match(validLocaleMatchPath) // TODO: Check what match can return.
        const validMatch = _modifiedRoutes.find((route) => route.meta.i18nId === validLocaleMatch.meta.seedI18n)

        next({
          name: validMatch.name,
          params: Object.assign(to.params, { _locale: config.defaultLocale }),
          hash: to.hash,
          query: to.query
        })
      } else if (to.params._locale === config.defaultLocale && !to.meta.localized && config.defaultLocaleInRoutes) {
        // If the wanted route has no locale in it, but the configuration requires all locales (even the default) to be
        // in the URL, redirect to the one with the locale.
        next({
          name: '__locale:' + to.meta.i18nId,
          params: Object.assign(to.params, { _locale: undefined }),
          hash: to.hash,
          query: to.query
        })
      } else if (to.params._locale) {
        // If the localized URL is valid
      }

      next()
    })

    // Inject the gettext router guard to the router.
    // router.beforeEach((to, from, next) => {
    //   console.log(to)
    //   const localeSwitch = to.params._changeLocale
    //
    //   if (to.params._locale) {
    //     if (!config.allLocales.includes(to.params._locale)) {
    //       // Fallback to the path without the `_locale` parameter if the parsed `_locale` value isn't in the configuration locales list.
    //       // If the request URL, for example, was `domain.com/about-us`, and the router matched `about-us` as the locale,
    //       // the matched path `/:_locale` will be converted to `/about-us` and send to the router as the next path.
    //       // This route was prepared in advance and a name was set in the form of `__blank:{{path}}`.
    //       const localeReplacement = to.params._locale
    //       delete to.params._locale
    //       next({
    //         name: _mapLocaleNameToOriginal._get('__blank:' + _matchedPathtoPath(to.matched[to.matched.length - 1].path, ':_locale?', localeReplacement)),
    //         params: to.params,
    //         hash: to.hash,
    //         query: to.query
    //       })
    //     } else {
    //       if (to.params._locale !== savedLocale && !localeSwitch) {
    //         if (config.routingStyle === 'redirect') {
    //           // Change the parsed locale to the saved locale if the config says that there should be always a redirection to the saved locale.
    //           next({
    //             name: '__locale:' + _matchedPathtoPath(to.matched[to.matched.length - 1].path, ':_locale?', ''),
    //             params: Object.assign(to.params, { _locale: savedLocale }),
    //             hash: to.hash,
    //             query: to.query
    //           })
    //         } else if (config.routingStyle === 'changeLocale') {
    //           // Don't change the path, but change the selected locale if the config defines the routing style to `changeLocale`.
    //           if (config.storageMethod !== 'custom') {
    //             switchMethods[config.storageMethod].save(config.storageKey, to.params._locale, savedLocale, config.cookieExpirationInDays)
    //           } else {
    //             config.storageFunctions.save(config.storageKey, to.params._locale, savedLocale)
    //           }
    //
    //           router.go({
    //             name: to.name,
    //             params: to.params,
    //             hash: to.hash,
    //             query: to.query
    //           })
    //         }
    //       } else if (config.defaultLocaleInRoutes === false && to.params._locale === config.defaultLocale) {
    //         // If the parsed `_locale` is equal to the default locale, and the config says that there are no URLs which include the default locale
    //         // replace the `_locale` and redirect to the named blank version.
    //         delete to.params._locale
    //         next({
    //           name: _mapLocaleNameToOriginal._get('__blank:' + _matchedPathtoPath(to.matched[to.matched.length - 1] ? to.matched[to.matched.length - 1].path : to.path, ':_locale?', '')),
    //           params: to.params,
    //           hash: to.hash,
    //           query: to.query
    //         })
    //       } else {
    //         next()
    //       }
    //     }
    //   } else {
    //     if (config.defaultLocale !== savedLocale && !localeSwitch) {
    //       if (config.routingStyle === 'redirect') {
    //         // Change the parsed locale to the saved locale if the config says that there should be always a redirection to the saved locale.
    //         next({
    //           name: '__locale:' + _matchedPathtoPath(to.matched[to.matched.length - 1].path, ':_locale?', ''),
    //           params: Object.assign(to.params, { _locale: savedLocale }),
    //           hash: to.hash,
    //           query: to.query
    //         })
    //       } else if (config.routingStyle === 'changeLocale') {
    //         // Don't change the path, but change the selected locale if the config defines the routing style to `changeLocale`.
    //         if (config.storageMethod !== 'custom') {
    //           switchMethods[config.storageMethod].save(config.storageKey, config.defaultLocale, savedLocale, config.cookieExpirationInDays)
    //         } else {
    //           config.storageFunctions.save(config.storageKey, config.defaultLocale, savedLocale)
    //         }
    //
    //         router.go({
    //           name: to.name,
    //           params: to.params,
    //           hash: to.hash,
    //           query: to.query
    //         })
    //       }
    //     } else if (config.defaultLocaleInRoutes === true) {
    //       // If the config says that there cannot be an URL without a locale, redirect a blank route to a locale route.
    //       next({
    //         name: '__locale:' + _matchedPathtoPath(to.matched[to.matched.length - 1].path, ':_locale?', ''),
    //         params: Object.assign(to.params, { _locale: config.defaultLocale }),
    //         hash: to.hash,
    //         query: to.query
    //       })
    //     } else {
    //       next()
    //     }
    //   }
    // })
  }

  // Expose parsed configuration to the Vue instance.
  Vue.prototype.$i18nRoutes = _modifiedRoutes
  Vue.prototype.$i18n = new Vue({
    data () {
      config.activeLocale = savedLocale && savedLocale !== config.defaultLocale ? savedLocale : config.defaultLocale
      return config
    },
    methods: {
      getLocaleMessage (key) {
        return this.messages[key]
      }
    }
  })

  // Changes the active locale.
  Vue.prototype.$changeLocale = function (locale) {
    if (this.$i18n.allLocales.includes(locale)) {
      const oldLocale = this.$i18n.activeLocale

      if (this.$i18n.storageMethod !== 'custom') {
        switchMethods[this.$i18n.storageMethod].save(this.$i18n.storageKey, locale, oldLocale, this.$i18n.cookieExpirationInDays)
      } else {
        this.$i18n.storageFunctions.save(this.$i18n.storageKey, locale, oldLocale)
      }

      if (!this.$i18n.forceReloadOnSwitch) {
        this.$i18n.activeLocale = locale
      }

      if (this.$i18n.usingRouter && router) {
        if (!this.$i18n.defaultLocaleInRoutes && locale === this.$i18n.defaultLocale && this.$route.meta.localized === true) {
          const targetRoute = this.$i18nRoutes.find((route) => route.meta.i18nId === this.$route.meta.seedI18n)
          this.$router.push({
            name: targetRoute.name,
            params: Object.assign(this.$route.params, { _locale: undefined, _changeLocale: true }),
            hash: this.$route.hash,
            query: this.$route.query
          })
        } else if (this.$route.meta.localized === true) {
          this.$router.push({
            name: this.$route.name,
            params: Object.assign(this.$route.params, { _locale: locale, _changeLocale: true }),
            hash: this.$route.hash,
            query: this.$route.query
          })
        } else {
          const targetRoute = this.$i18nRoutes.find((route) => route.meta.seedI18n === this.$route.meta.i18nId)
          this.$router.push({
            name: targetRoute.name,
            params: Object.assign(this.$route.params, { _locale: locale, _changeLocale: true }),
            hash: this.$route.hash,
            query: this.$route.query
          })
        }

        if (this.$i18n.forceReloadOnSwitch) {
          window.location.reload()
        }
      } else {
        if (this.$i18n.forceReloadOnSwitch) {
          window.location.reload()
        }
      }
    }
  }

  // Converts a router link to the version of the current locale.
  const _localeLink = function (link) {
    let toPath
    if (this.$i18n.routeAutoPrefix) {
      toPath = pathToRegexp.compile(_path('/:_locale?/' + link))
    } else {
      toPath = pathToRegexp.compile(link.replace('$locale', ':_locale?'))
    }

    const path = toPath({ _locale: this.$i18n.activeLocale === this.$i18n.defaultLocale ? (this.$i18n.defaultLocaleInRoutes ? this.$i18n.activeLocale : undefined) : this.$i18n.activeLocale })
    return path === '' ? '/' : path
  }
  Vue.prototype.$localeLink = _localeLink
  Vue.prototype.$L = _localeLink

  // Makes <translate> available as a global component.
  Vue.component('translate', Component(Vue, marked))

  // An option to support translation with HTML content: `v-translate`.
  Vue.directive('translate', Directive(marked))
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
  const _options = {
    messages: options.messages || {},
    defaultLocale: options.defaultLocale || 'en',
    allLocales: options.allLocales || (options.defaultLocale ? [options.defaultLocale] : ['en']),
    forceReloadOnSwitch: options.forceReloadOnSwitch || true,
    usingRouter: options.usingRouter || false,
    defaultLocaleInRoutes: options.defaultLocaleInRoutes || true,
    routingStyle: options.routingStyle || 'changeLocale',
    routeAutoPrefix: options.routeAutoPrefix || true,
    // TODO: Implement better storageMethod parsing.
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

const gettextMixin = {
  created () {
    if (this.$i18n.customOnLoad && typeof this.$i18n.customOnLoad === 'function') {
      this.$i18n.customOnLoad(this)
    }
  }
}

plugin.version = '__VERSION__'

export { plugin as VueGettext, gettextMixin }

export default plugin

if (typeof window !== 'undefined' && window.Vue) {
  window.Vue.use(plugin)
}

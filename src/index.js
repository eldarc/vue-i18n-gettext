import pathToRegexp from 'path-to-regexp'
import gettextFunctions from './gettext'
import miniparser from './miniparser'
import Component from './component'
import Directive from './directive'
import { warn } from './util'
import uuid from './uuid'
import cloneDeep from 'lodash.clonedeep'

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
      const output = cloneDeep(input)
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
    savedLocale = switchMethods[config.storageMethod].load(config.storageKey) || config.defaultLocale
  } else {
    savedLocale = config.storageFunctions.load(config.storageKey) || config.defaultLocale
  }

  // Modify the router so that is compatible with locale routing and switching.
  // TODO: Move this helper function to a global helpers object.
  const _path = (path, replace, replacement) => {
    const _path = path.replace(replace, replacement).replace(new RegExp('/{2,}', 'giu'), '/')
    return _path !== '' ? _path : '/'
  }

  // Prepare the routes to be ready for translation purposes.
  // Duplicate all routes, and make a `blank` and a `locale` version.
  // Blank versions are paths without the `_locale` parameter, and locale versions are paths with the `:_locale?` parameter.
  // Delete the previous router paths, and set it to the newly prepared routes array.
  const _modifiedRoutes = []
  if (router) {
    // Duplicate routes and assign valid names.
    router.options.routes.forEach((_route) => {
      // Prepare seed routes.
      const i18nId = uuid()
      _modifiedRoutes.push(Object.assign(
        Object.assign({}, _route),
        {
          name: _route.name ? _route.name : i18nId,
          path: !config.routeAutoPrefix ? _path(_route.path, '$locale', '') : _route.path,
          meta: Object.assign(cloneDeep(_route.meta), {
            i18nId: i18nId,
            localized: false
          })
        }
      ))

      // Prepare children of the seed route.
      const currentSeedRoute = _modifiedRoutes[_modifiedRoutes.length - 1]
      if (currentSeedRoute.children && currentSeedRoute.children.length > 0) {
        ;(function modifyChild (_currentRoute) {
          _currentRoute.children.forEach((childRoute) => {
            const i18nId = uuid()
            childRoute.name = childRoute.name || i18nId

            if (!childRoute.meta) {
              childRoute.meta = {}
            }

            childRoute.meta = Object.assign(cloneDeep(childRoute.meta), {
              i18nId: i18nId,
              localized: false
            })

            if (childRoute.children && childRoute.children.length > 0) {
              modifyChild(childRoute)
            }
          })
        })(currentSeedRoute)
      }

      // Prepare locale routes.
      _modifiedRoutes.push(Object.assign(
        Object.assign({}, currentSeedRoute),
        {
          name: '__locale:' + currentSeedRoute.meta.i18nId,
          path: config.routeAutoPrefix ? _path('/:_locale?/' + currentSeedRoute.path) : currentSeedRoute.path,
          meta: Object.assign(cloneDeep(currentSeedRoute.meta), {
            i18nId: undefined,
            seedI18nId: currentSeedRoute.meta.i18nId,
            localized: true,
            seedRoute: currentSeedRoute
          }),
          redirect: currentSeedRoute.redirect ? '/:_locale?' + currentSeedRoute.redirect : undefined
        }
      ))
      delete _modifiedRoutes[_modifiedRoutes.length - 1].meta.i18nId

      // Prepare children of the locale route.
      const currentLocaleRoute = _modifiedRoutes[_modifiedRoutes.length - 1]
      if (currentLocaleRoute.children && currentLocaleRoute.children.length > 0) {
        // Duplicate the children array, and then restore references to the original child except for
        // following keys: children, meta.
        const childrenInstance = cloneDeep(currentLocaleRoute.children)

        ;(function adjustLocaleSubroutes (currentRoutes, childrenReference) {
          currentRoutes.forEach((childRoute, i) => {
            const objectKeys = Object.keys(childRoute)

            objectKeys.forEach((key) => {
              if (key !== 'children' && key !== 'meta') {
                childRoute[key] = childrenReference[i][key]
              }
            })

            if (childRoute.children && childRoute.children.length > 0) {
              adjustLocaleSubroutes(childRoute.children, childrenReference[i].children)
            }
          })
        })(childrenInstance, currentLocaleRoute.children)

        // Add new names for locale subroutes, and add additional meta data.
        ;(function modifyChild (currentRoutes, childrenReference) {
          currentRoutes.forEach((childRoute, i) => {
            childRoute.name = '__locale:' + childRoute.meta.i18nId

            if (!childRoute.meta) {
              childRoute.meta = {}
            }

            childRoute.meta = Object.assign(childRoute.meta, {
              i18nId: undefined,
              seedI18n: childRoute.meta.i18nId,
              localized: true,
              seedRoute: childrenReference[i]
            })

            if (childRoute.children && childRoute.children.length > 0) {
              modifyChild(childRoute.children, childrenReference[i].children)
            }
          })
        })(childrenInstance, currentLocaleRoute.children)
        currentLocaleRoute.children = childrenInstance
      }
    })

    // Reset routes.
    router.matcher = new (Object.getPrototypeOf(router)).constructor({
      mode: 'history',
      routes: []
    }).matcher

    // Add new routes.
    router.addRoutes(_modifiedRoutes)
    console.log(_modifiedRoutes)

    // Inject the gettext router guard to the router.
    router.beforeEach((to, from, next) => {
      let actualTo

      // Have always a locale set.
      if (!to.params._locale) {
        to.params._locale = config.defaultLocale
      }

      // Verify that the valid `to` route is selected.
      if (!config.allLocales.includes(to.params._locale)) {
        const validLocaleMatchPath = to.matched[0].path.replace(':_locale?', '__locale__/' + to.params._locale)
        const validLocaleMatch = router.match(validLocaleMatchPath)
        actualTo = validLocaleMatch.meta.seedRoute
      }

      // Set `to` to the actual match.
      if (actualTo) {
        actualTo.params = to.params
        actualTo.hash = to.hash
        actualTo.query = to.query
        actualTo._actual = true

        if (!config.allLocales.includes(actualTo.params._locale)) {
          actualTo.params._locale = config.defaultLocale
        }

        to = actualTo
      }

      // Record if the path request came from a normal request or while changing the saved locale.
      const localeSwitch = to.params._localeSwitch

      // Helper for defining the `next` object.
      const defineNext = function (name, params) {
        return {
          name: name || to.name,
          params: params ? Object.assign(to.params, params) : to.params,
          hash: to.hash,
          query: to.query
        }
      }

      // Handle the default locale.
      const routeDefaultLocale = (_changeLocale) => {
        // If the saved locale is equal to the default locale make sure that the URL format is correct.
        if (to.meta.localized && !config.defaultLocaleInRoutes) {
          const _next = defineNext(to.meta.seedRoute.name)

          if (_changeLocale) {
            router.go(_next)
          } else {
            next(_next)
          }
        } else if (!to.meta.localized && config.defaultLocaleInRoutes) {
          const _next = defineNext('__locale:' + to.meta.i18nId)

          if (_changeLocale) {
            router.go(_next)
          } else {
            next(_next)
          }
        } else if (_changeLocale) {
          router.go(defineNext())
        }
      }

      // Helper for saving the new locale.
      const saveLocale = function (newLocale) {
        if (config.storageMethod !== 'custom') {
          switchMethods[config.storageMethod].save(config.storageKey, newLocale, savedLocale, config.cookieExpirationInDays)
        } else {
          config.storageFunctions.save(config.storageKey, newLocale, savedLocale)
        }
      }

      // Parse the route when it contains a locale that is not currently selected.
      if (to.params._locale !== savedLocale && !localeSwitch) {
        if (to.meta.localized) {
          if (to.params._locale !== config.defaultLocale) {
            if (config.routingStyle === 'changeLocale') {
              saveLocale(to.params._locale)
              router.go(defineNext())
            } else if (config.routingStyle === 'redirect') {
              next(defineNext(null, { _locale: savedLocale }))
            }
          } else {
            if (config.routingStyle === 'changeLocale') {
              saveLocale(to.params._locale)
              routeDefaultLocale(true)
            } else if (config.routingStyle === 'redirect') {
              next(defineNext(null, { _locale: savedLocale }))
            }
          }
        } else {
          if (to.params._locale !== config.defaultLocale) {
            if (config.routingStyle === 'changeLocale') {
              saveLocale(to.params._locale)
              router.go(defineNext('__locale:' + to.meta.i18nId))
            } else if (config.routingStyle === 'redirect') {
              next(defineNext('__locale:' + to.meta.i18nId, { _locale: savedLocale }))
            }
          } else {
            if (config.routingStyle === 'changeLocale') {
              saveLocale(to.params._locale)
              routeDefaultLocale(true)
            } else if (config.routingStyle === 'redirect') {
              next(defineNext('__locale:' + to.meta.i18nId, { _locale: savedLocale }))
            }
          }
        }
      } else if (to.params._locale === config.defaultLocale && !localeSwitch) {
        routeDefaultLocale()
      }

      // If there is a detection of an route that was mismatch originally, reroute to the valid match.
      if (actualTo) {
        next(actualTo)
      }
      next()
    })
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
        let _next

        if (!this.$i18n.defaultLocaleInRoutes && locale === this.$i18n.defaultLocale && this.$route.meta.localized === true) {
          _next = {
            name: this.$route.meta.seedRoute.name,
            params: Object.assign(this.$route.params, { _locale: undefined, _localeSwitch: true }),
            hash: this.$route.hash,
            query: this.$route.query
          }
        } else if (this.$route.meta.localized === true) {
          _next = {
            name: this.$route.name,
            params: Object.assign(this.$route.params, { _locale: locale, _localeSwitch: true }),
            hash: this.$route.hash,
            query: this.$route.query
          }
        } else {
          _next = {
            name: '__locale:' + this.$route.meta.i18nId,
            params: Object.assign(this.$route.params, { _locale: locale, _localeSwitch: true }),
            hash: this.$route.hash,
            query: this.$route.query
          }
        }

        if (this.$i18n.forceReloadOnSwitch) {
          this.$router.push(_next)
          window.location.reload()
        } else {
          this.$router.push(_next)
        }
      } else {
        if (this.$i18n.forceReloadOnSwitch) {
          window.location.reload()
        }
      }
    }
  }

  // Converts a router link to the version of the current locale.
  const _localeLink = function (location) {
    if (typeof location === 'string') {
      let toPath
      if (this.$i18n.routeAutoPrefix) {
        toPath = pathToRegexp.compile(_path('/:_locale?/' + location))
      } else {
        toPath = pathToRegexp.compile(location.replace('$locale', ':_locale?'))
      }

      const path = toPath({ _locale: this.$i18n.activeLocale === this.$i18n.defaultLocale ? (this.$i18n.defaultLocaleInRoutes ? this.$i18n.activeLocale : undefined) : this.$i18n.activeLocale })
      return path === '' ? '/' : path
    } else {
      return location
    }
    // TODO: Add support when the object contains name and/or path.
  }
  Vue.prototype.$localeLink = _localeLink
  Vue.prototype.$ll = _localeLink

  // Expose the locale version of the router.
  if (config.usingRouter && router) {
    router.locPush = (location, onComplete, onAbort) => {
      router.push(location ? router.app.$localeLink(location) : location, onComplete, onAbort)
    }

    router.locReplace = (location, onComplete, onAbort) => {
      router.replace(location ? router.app.$localeLink(location) : location, onComplete, onAbort)
    }

    router.locGo = (n) => {
      if (typeof n === 'string') {
        router.go(n ? router.app.$localeLink(n) : n)
      } else {
        router.go(n)
      }
      // TODO: Check if route object support is needed.
    }
    // TODO: Test support for router.resolve and router.getMatchedComponents
  }

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
    forceReloadOnSwitch: options.forceReloadOnSwitch === undefined ? true : options.forceReloadOnSwitch,
    usingRouter: options.usingRouter === undefined ? false : options.usingRouter,
    defaultLocaleInRoutes: options.defaultLocaleInRoutes === undefined ? false : options.defaultLocaleInRoutes,
    routingStyle: options.routingStyle || 'changeLocale',
    routeAutoPrefix: options.routeAutoPrefix === undefined ? true : options.routeAutoPrefix,
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

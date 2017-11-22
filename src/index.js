import VueI18n from 'vue-i18n'
import gettextFunctions from './gettext'
import Component from './component'
import Directive from './directive'

/* @flow */
function plugin (Vue: any, options: Object = {}) {
  // Load the `vue-i18n` dependency.
  if (!Vue.$i18n) {
    Vue.use(VueI18n)
  }

  // Expose gettext functions.
  Vue.prototype.$gettext = gettextFunctions._gettext
  Vue.prototype.$pgettext = gettextFunctions._pgettext
  Vue.prototype.$ngettext = gettextFunctions._ngettext
  Vue.prototype.$npgettext = gettextFunctions._npgettext
  Vue.prototype.$_i18n = gettextFunctions._i18nInterpolate

  // Makes <translate> available as a global component.
  Vue.component('translate', Component(Vue))

  // An option to support translation with HTML content: `v-translate`.
  Vue.directive('translate', Directive)
}

plugin.version = '__VERSION__'

export { plugin as VueI18nGettext, VueI18n }

export default plugin

if (typeof window !== 'undefined' && window.Vue) {
  window.Vue.use(plugin)
}

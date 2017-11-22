import uuid from './uuid'
const marked = require('marked')

const updateTranslation = (el, binding, vnode) => {
  const self = vnode.context
  const attrs = vnode.data.attrs || {}
  let msgid = el.dataset.msgid
  const tContext = attrs['t-context']
  const tN = attrs['t-n']
  let _tN = tN
  const tPlural = attrs['t-plural']
  let tParams = attrs['t-params'] || {}
  const md = attrs['md']
  const markdown = attrs['markdown']
  const isPlural = tN !== undefined && tPlural !== undefined

  // If there are parameters inside the `v-translate` directive attribute merge them with params.
  // `vue-translate` values have the priority compared to `t-params`.
  if (binding.value && typeof binding.value === 'object') {
    tParams = Object.assign(tParams, binding.value)
  }

  // Replace n with a value from the params if they are set.
  // If n isn't a string than it's assumed that a numeric value has been passed, and that value will be used
  // to determine the plural form (instead of the replace).
  if (_tN && (typeof _tN === 'string') && tParams) {
    _tN = tN.trim()

    if (tParams.hasOwnProperty(_tN) && tParams[_tN]) {
      _tN = tParams[_tN]
    } else {
      _tN = undefined
    }
  } else if (typeof _tN !== 'number') {
    _tN = undefined
  }

  if (!isPlural && (tN || tPlural)) {
    throw new Error('`translate-n` and `translate-plural` attributes must be used together:' + msgid + '.')
  }

  if (el.innerHTML.trim() !== el.innerText) {
    // Content is HTML.
    // Set the string to be the innerHTML, but striped of white spaces and Vue's automatically added data-v attributes.
    msgid = el.innerHTML.replace(/>\s*/giu, '>').replace(/\s*</giu, '<').trim().replace(/\s*data-v-[a-zA-Z0-9]{8,}=".?"/giu, '')
  } else {
    // Content is text.
    // Set the string to be only text.
    msgid = el.innerText
  }

  let translation = null

  if (isPlural && tContext) {
    translation = self.$npgettext(tContext, msgid, isPlural ? tPlural : null, _tN)
  } else if (isPlural) {
    translation = self.$ngettext(msgid, isPlural ? tPlural : null, _tN)
  } else if (tContext) {
    translation = self.$pgettext(tContext, msgid)
  } else {
    translation = self.$gettext(msgid)
  }

  // Interpolate values from the parent component and from the parameters object.
  translation = self.$_i18n(translation, Object.assign(self, typeof tParams === 'object' ? tParams : {}))

  if ((markdown !== undefined && markdown !== false) || (md !== undefined && md !== false)) {
    el.innerHTML = marked(translation)
  } else {
    el.innerHTML = translation
  }
}

export default {
  bind (el, binding, vnode) {
    // https://vuejs.org/v2/guide/conditional.html#Controlling-Reusable-Elements-with-key
    // https://vuejs.org/v2/api/#key
    if (!vnode.key) {
      vnode.key = uuid()
    }

    // Get the raw HTML and store it in the element's dataset (as advised in Vue's official guide).
    el.dataset.msgid = el.innerHTML

    updateTranslation(el, binding, vnode)
  }
}

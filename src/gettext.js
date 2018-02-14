import plurals from './plurals'
import interpolate from './interpolate'

// Translation items indexed as:
// "FIRST_CONTEXT": {
//   "Message.": {
//     "msgid": "Message.",
//       "msgctxt": "FIRST_CONTEXT",
//       "msgstr": [
//       ""
//     ]
//   },
//  ...
// },
// "$$NOCONTEXT": {
//   "Message.": {
//     "msgid": "Message.",
//       "msgstr": [
//       ""
//     ]
//   },
//  ...
// }

// Singular
const _gettext = function (msgid) {
  const message = this.$i18n.getLocaleMessage(this.$i18n.activeLocale)['$$NOCONTEXT'][msgid]

  if (!message) {
    return msgid
  } else {
    return message.msgstr[0] || message.msgid
  }
}

// Context + Singular
const _pgettext = function (msgctxt, msgid) {
  let message
  if (this.$i18n.getLocaleMessage(this.$i18n.activeLocale)[msgctxt]) {
    message = this.$i18n.getLocaleMessage(this.$i18n.activeLocale)[msgctxt][msgid]
  }

  if (!message) {
    return msgid
  } else {
    return message.msgstr[0] || message.msgid
  }
}

// Plural
const _ngettext = function (msgid, msgidPlural, n) {
  const message = this.$i18n.getLocaleMessage(this.$i18n.activeLocale)['$$NOCONTEXT'][msgid]

  if (!message) {
    return Math.abs(n) === 1 ? msgid : msgidPlural
  } else {
    const pluralIndex = plurals.getTranslationIndex(this.$i18n.activeLocale, n)
    let _msgidPlural = message.msgstr[pluralIndex]

    if (!_msgidPlural) {
      if (Math.abs(n) === 1) {
        _msgidPlural = message.msgstr[0] || message.msgid
      } else {
        _msgidPlural = message.msgstr[1] || (message.msgid_plural || msgidPlural)
      }
    }

    return _msgidPlural
  }
}

// Context + Plural
const _npgettext = function (msgctxt, msgid, msgidPlural, n) {
  let message
  if (this.$i18n.getLocaleMessage(this.$i18n.activeLocale)[msgctxt]) {
    message = this.$i18n.getLocaleMessage(this.$i18n.activeLocale)[msgctxt][msgid]
  }

  if (!message) {
    return Math.abs(n) === 1 ? msgid : msgidPlural
  } else {
    const pluralIndex = plurals.getTranslationIndex(this.$i18n.activeLocale, n)
    let _msgidPlural = message.msgstr[pluralIndex]

    if (!_msgidPlural) {
      if (Math.abs(n) === 1) {
        _msgidPlural = message.msgstr[0] || message.msgid
      } else {
        _msgidPlural = message.msgstr[1] || (message.msgid_plural || msgidPlural)
      }
    }

    return _msgidPlural
  }
}

// Interpolate and return a string.
const _i18nInterpolate = function (msgid, values) {
  return interpolate(msgid, 'string', values)
}

export default { _i18nInterpolate, _gettext, _pgettext, _ngettext, _npgettext }

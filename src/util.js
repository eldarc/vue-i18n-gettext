const warn = (msg, err) => {
  if (typeof console !== 'undefined') {
    console.warn('[vue-i18n-gettext] ' + msg)

    if (err) {
      console.warn(err.stack)
    }
  }
}

const isObject = (obj) => {
  return obj !== null && typeof obj === 'object'
}

const stripVData = (input) => {
  return input.replace(/\s*data-v-[a-zA-Z0-9]{8,}=".*?"/giu, '')
}

const stripHTMLWhitespace = (input) => {
  return input.replace(/>\s{2,}/giu, '> ').replace(/\s{2,}</giu, ' <')
}

export { warn, isObject, stripVData, stripHTMLWhitespace }

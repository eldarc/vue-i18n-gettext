const stripVData = (input) => {
  return input.replace(/\s*data-v-[a-zA-Z0-9]{8,}=".*?"/giu, '')
}

const stripHTMLWhitespace = (input) => {
  return input.replace(/>\s*/giu, '>').replace(/\s*</giu, '<')
}

export { stripVData, stripHTMLWhitespace }

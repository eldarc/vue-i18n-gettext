// This is a specialized parser for parsing strings which contain a gettext function.
// Its main purpose is to parse gettext from a string in a .json file
export default function (string) {
  if (typeof string !== 'string') {
    throw Error('NOT_STRING')
  } else {
    string = string.trim()
  }

  if (string[0] === '$') {
    const expressionIdentifier = string.substr(1, 2)

    if (['ge', 'pg', 'ng', 'np'].includes(expressionIdentifier)) {
      let paramtersString = string
      let fullIdentifier = null

      switch (expressionIdentifier) {
        case 'ge':
          fullIdentifier = 'gettext'
          paramtersString = paramtersString.substr(8)
          break
        case 'pg':
          fullIdentifier = 'pgettext'
          paramtersString = paramtersString.substr(9)
          break
        case 'ng':
          fullIdentifier = 'ngettext'
          paramtersString = paramtersString.substr(9)
          break
        case 'np':
          fullIdentifier = 'npgettext'
          paramtersString = paramtersString.substr(10)
      }

      const parameters = parseParameters(expressionIdentifier, paramtersString.trim())

      return {
        identifier: fullIdentifier,
        parameters
      }
    } else {
      throw Error('NO_GETTEXT_IDENTIFIER')
    }
  } else {
    throw Error('INVALID_START')
  }

  function parseParameters (expressionIdentifier, parametersString) {
    const parameters = []
    const inputLength = parametersString.length

    if (inputLength > 0) {
      if (parametersString[0] !== '(') {
        throw Error('NO_START_BRACKET')
      }
      if (parametersString[inputLength - 1] !== ')') {
        throw Error('NO_END_BRACKET')
      }

      // Parameters structure.
      parametersString = parametersString.substr(1).slice(0, -1)
      const allowedNumberOfParameters = (function () {
        switch (expressionIdentifier) {
          case 'ge':
            return 1
          case 'pg':
            return 2
          case 'ng':
            return 3
          case 'np':
            return 4
        }
      })()

      // Characters iterator.
      let allowedQuoteSymbol = null
      let parameterBuffer = []
      for (let i = 0; i < parametersString.length; i++) {
        const char = parametersString.charAt(i)

        // Handle characters when parsing the last paramter that's supposed to be an integer and must not be wrapped with quotation marks.
        if (allowedQuoteSymbol === ',') {
          if (parameterBuffer.length > 0) {
            parameterBuffer.push(char)
          } else {
            if (char.trim().length === 0) {
              continue
            } else if (char === ',') {
              parameterBuffer.push(' ')
            } else {
              throw Error('MISSING_COMMA_BEFORE_LAST_PARAMETER')
            }
          }

          if (i === parametersString.length - 1) {
            if (parameterBuffer.length === 0) {
              throw Error('UNDEFINED_LAST_PARAMETER')
            } else {
              const parameterValue = parameterBuffer.join('').trim()

              if (!(!isNaN(+parameterValue) || parameterValue === '$n')) {
                if (parameterValue.indexOf(',') !== -1) {
                  throw Error('TOO_MANY_PARAMETERS')
                }
                throw Error('LAST_PARAMETER_NOT_NUMBER')
              }

              parameters.push(parameterValue === '$n' ? '$n' : +parameterValue)
            }
          }

          continue
        }

        // Handle characters when parsing normal text parameters.
        if (allowedQuoteSymbol === null && (char === '\'' || char === '"')) {
          allowedQuoteSymbol = char
        } else if ((allowedQuoteSymbol === '\'' && char === '\'') || (allowedQuoteSymbol === '"' && char === '"')) {
          const previousChar = i >= 1 ? parametersString.charAt(i - 1) : null

          if (previousChar !== '\\') {
            if (parameters.length >= allowedNumberOfParameters) {
              throw Error('TOO_MANY_PARAMETERS')
            } else {
              const parameterValue = parameterBuffer.join('')

              // Add a valid parameter to the parameters array.
              parameters.push(parameterValue)
              parameterBuffer = []

              // Change the quote symbol when expecting the next parameter to be an integer instead of a string.
              if ((expressionIdentifier === 'ng' && parameters.length === 2) || (expressionIdentifier === 'np' && parameters.length === 3)) {
                allowedQuoteSymbol = ','
              } else {
                allowedQuoteSymbol = null
              }
            }
          } else {
            parameterBuffer.push(char)
          }
        } else if (allowedQuoteSymbol !== null && allowedQuoteSymbol !== undefined && allowedQuoteSymbol !== false && char !== '\\') {
          parameterBuffer.push(char)
        }
      }

      if (parameters.length < allowedNumberOfParameters) {
        throw Error('PARAMETERS_INCORRECT')
      } else {
        return parameters
      }
    } else {
      throw Error('NO_PARAMETERS')
    }
  }
}

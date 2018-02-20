/*!
 * vue-i18n-gettext v0.0.7 
 * (c) 2018 Eldar Cejvanovic
 * Released under the MIT License.
 */
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

/**
 * Expose `pathToRegexp`.
 */
var pathToRegexp_1 = pathToRegexp;
var parse_1 = parse;
var compile_1 = compile;
var tokensToFunction_1 = tokensToFunction;
var tokensToRegExp_1 = tokensToRegExp;

/**
 * Default configs.
 */
var DEFAULT_DELIMITER = '/';
var DEFAULT_DELIMITERS = './';

/**
 * The main path matching regexp utility.
 *
 * @type {RegExp}
 */
var PATH_REGEXP = new RegExp([
  // Match escaped characters that would otherwise appear in future matches.
  // This allows the user to escape special characters that won't transform.
  '(\\\\.)',
  // Match Express-style parameters and un-named parameters with a prefix
  // and optional suffixes. Matches appear as:
  //
  // "/:test(\\d+)?" => ["/", "test", "\d+", undefined, "?"]
  // "/route(\\d+)"  => [undefined, undefined, undefined, "\d+", undefined]
  '(?:\\:(\\w+)(?:\\(((?:\\\\.|[^\\\\()])+)\\))?|\\(((?:\\\\.|[^\\\\()])+)\\))([+*?])?'
].join('|'), 'g');

/**
 * Parse a string for the raw tokens.
 *
 * @param  {string}  str
 * @param  {Object=} options
 * @return {!Array}
 */
function parse (str, options) {
  var tokens = [];
  var key = 0;
  var index = 0;
  var path = '';
  var defaultDelimiter = (options && options.delimiter) || DEFAULT_DELIMITER;
  var delimiters = (options && options.delimiters) || DEFAULT_DELIMITERS;
  var pathEscaped = false;
  var res;

  while ((res = PATH_REGEXP.exec(str)) !== null) {
    var m = res[0];
    var escaped = res[1];
    var offset = res.index;
    path += str.slice(index, offset);
    index = offset + m.length;

    // Ignore already escaped sequences.
    if (escaped) {
      path += escaped[1];
      pathEscaped = true;
      continue
    }

    var prev = '';
    var next = str[index];
    var name = res[2];
    var capture = res[3];
    var group = res[4];
    var modifier = res[5];

    if (!pathEscaped && path.length) {
      var k = path.length - 1;

      if (delimiters.indexOf(path[k]) > -1) {
        prev = path[k];
        path = path.slice(0, k);
      }
    }

    // Push the current path onto the tokens.
    if (path) {
      tokens.push(path);
      path = '';
      pathEscaped = false;
    }

    var partial = prev !== '' && next !== undefined && next !== prev;
    var repeat = modifier === '+' || modifier === '*';
    var optional = modifier === '?' || modifier === '*';
    var delimiter = prev || defaultDelimiter;
    var pattern = capture || group;

    tokens.push({
      name: name || key++,
      prefix: prev,
      delimiter: delimiter,
      optional: optional,
      repeat: repeat,
      partial: partial,
      pattern: pattern ? escapeGroup(pattern) : '[^' + escapeString(delimiter) + ']+?'
    });
  }

  // Push any remaining characters.
  if (path || index < str.length) {
    tokens.push(path + str.substr(index));
  }

  return tokens
}

/**
 * Compile a string to a template function for the path.
 *
 * @param  {string}             str
 * @param  {Object=}            options
 * @return {!function(Object=, Object=)}
 */
function compile (str, options) {
  return tokensToFunction(parse(str, options))
}

/**
 * Expose a method for transforming tokens into the path function.
 */
function tokensToFunction (tokens) {
  // Compile all the tokens into regexps.
  var matches = new Array(tokens.length);

  // Compile all the patterns before compilation.
  for (var i = 0; i < tokens.length; i++) {
    if (typeof tokens[i] === 'object') {
      matches[i] = new RegExp('^(?:' + tokens[i].pattern + ')$');
    }
  }

  return function (data, options) {
    var path = '';
    var encode = (options && options.encode) || encodeURIComponent;

    for (var i = 0; i < tokens.length; i++) {
      var token = tokens[i];

      if (typeof token === 'string') {
        path += token;
        continue
      }

      var value = data ? data[token.name] : undefined;
      var segment;

      if (Array.isArray(value)) {
        if (!token.repeat) {
          throw new TypeError('Expected "' + token.name + '" to not repeat, but got array')
        }

        if (value.length === 0) {
          if (token.optional) { continue }

          throw new TypeError('Expected "' + token.name + '" to not be empty')
        }

        for (var j = 0; j < value.length; j++) {
          segment = encode(value[j]);

          if (!matches[i].test(segment)) {
            throw new TypeError('Expected all "' + token.name + '" to match "' + token.pattern + '"')
          }

          path += (j === 0 ? token.prefix : token.delimiter) + segment;
        }

        continue
      }

      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        segment = encode(String(value));

        if (!matches[i].test(segment)) {
          throw new TypeError('Expected "' + token.name + '" to match "' + token.pattern + '", but got "' + segment + '"')
        }

        path += token.prefix + segment;
        continue
      }

      if (token.optional) {
        // Prepend partial segment prefixes.
        if (token.partial) { path += token.prefix; }

        continue
      }

      throw new TypeError('Expected "' + token.name + '" to be ' + (token.repeat ? 'an array' : 'a string'))
    }

    return path
  }
}

/**
 * Escape a regular expression string.
 *
 * @param  {string} str
 * @return {string}
 */
function escapeString (str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, '\\$1')
}

/**
 * Escape the capturing group by escaping special characters and meaning.
 *
 * @param  {string} group
 * @return {string}
 */
function escapeGroup (group) {
  return group.replace(/([=!:$/()])/g, '\\$1')
}

/**
 * Get the flags for a regexp from the options.
 *
 * @param  {Object} options
 * @return {string}
 */
function flags (options) {
  return options && options.sensitive ? '' : 'i'
}

/**
 * Pull out keys from a regexp.
 *
 * @param  {!RegExp} path
 * @param  {Array=}  keys
 * @return {!RegExp}
 */
function regexpToRegexp (path, keys) {
  if (!keys) { return path }

  // Use a negative lookahead to match only capturing groups.
  var groups = path.source.match(/\((?!\?)/g);

  if (groups) {
    for (var i = 0; i < groups.length; i++) {
      keys.push({
        name: i,
        prefix: null,
        delimiter: null,
        optional: false,
        repeat: false,
        partial: false,
        pattern: null
      });
    }
  }

  return path
}

/**
 * Transform an array into a regexp.
 *
 * @param  {!Array}  path
 * @param  {Array=}  keys
 * @param  {Object=} options
 * @return {!RegExp}
 */
function arrayToRegexp (path, keys, options) {
  var parts = [];

  for (var i = 0; i < path.length; i++) {
    parts.push(pathToRegexp(path[i], keys, options).source);
  }

  return new RegExp('(?:' + parts.join('|') + ')', flags(options))
}

/**
 * Create a path regexp from string input.
 *
 * @param  {string}  path
 * @param  {Array=}  keys
 * @param  {Object=} options
 * @return {!RegExp}
 */
function stringToRegexp (path, keys, options) {
  return tokensToRegExp(parse(path, options), keys, options)
}

/**
 * Expose a function for taking tokens and returning a RegExp.
 *
 * @param  {!Array}  tokens
 * @param  {Array=}  keys
 * @param  {Object=} options
 * @return {!RegExp}
 */
function tokensToRegExp (tokens, keys, options) {
  options = options || {};

  var strict = options.strict;
  var end = options.end !== false;
  var delimiter = escapeString(options.delimiter || DEFAULT_DELIMITER);
  var delimiters = options.delimiters || DEFAULT_DELIMITERS;
  var endsWith = [].concat(options.endsWith || []).map(escapeString).concat('$').join('|');
  var route = '';
  var isEndDelimited = false;

  // Iterate over the tokens and create our regexp string.
  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i];

    if (typeof token === 'string') {
      route += escapeString(token);
      isEndDelimited = i === tokens.length - 1 && delimiters.indexOf(token[token.length - 1]) > -1;
    } else {
      var prefix = escapeString(token.prefix);
      var capture = token.repeat
        ? '(?:' + token.pattern + ')(?:' + prefix + '(?:' + token.pattern + '))*'
        : token.pattern;

      if (keys) { keys.push(token); }

      if (token.optional) {
        if (token.partial) {
          route += prefix + '(' + capture + ')?';
        } else {
          route += '(?:' + prefix + '(' + capture + '))?';
        }
      } else {
        route += prefix + '(' + capture + ')';
      }
    }
  }

  if (end) {
    if (!strict) { route += '(?:' + delimiter + ')?'; }

    route += endsWith === '$' ? '$' : '(?=' + endsWith + ')';
  } else {
    if (!strict) { route += '(?:' + delimiter + '(?=' + endsWith + '))?'; }
    if (!isEndDelimited) { route += '(?=' + delimiter + '|' + endsWith + ')'; }
  }

  return new RegExp('^' + route, flags(options))
}

/**
 * Normalize the given path string, returning a regular expression.
 *
 * An empty array can be passed in for the keys, which will hold the
 * placeholder key descriptions. For example, using `/user/:id`, `keys` will
 * contain `[{ name: 'id', delimiter: '/', optional: false, repeat: false }]`.
 *
 * @param  {(string|RegExp|Array)} path
 * @param  {Array=}                keys
 * @param  {Object=}               options
 * @return {!RegExp}
 */
function pathToRegexp (path, keys, options) {
  if (path instanceof RegExp) {
    return regexpToRegexp(path, keys)
  }

  if (Array.isArray(path)) {
    return arrayToRegexp(/** @type {!Array} */ (path), keys, options)
  }

  return stringToRegexp(/** @type {string} */ (path), keys, options)
}

pathToRegexp_1.parse = parse_1;
pathToRegexp_1.compile = compile_1;
pathToRegexp_1.tokensToFunction = tokensToFunction_1;
pathToRegexp_1.tokensToRegExp = tokensToRegExp_1;

/**
 * Plural Forms
 *
 * This is a list of the plural forms, as used by Gettext PO, that are appropriate to each language.
 * http://docs.translatehouse.org/projects/localization-guide/en/latest/l10n/pluralforms.html
 *
 * This is a replica of angular-gettext's plural.js
 * https://github.com/rubenv/angular-gettext/blob/master/src/plural.js
 */
var plurals = {

  getTranslationIndex: function (languageCode, n) {
    n = Number.isNaN(parseInt(n)) ? 1 : parseInt(n);  // Fallback to singular.

    // Extract the ISO 639 language code. The ISO 639 standard defines
    // two-letter codes for many languages, and three-letter codes for
    // more rarely used languages.
    // https://www.gnu.org/software/gettext/manual/html_node/Language-Codes.html#Language-Codes
    if (languageCode.length > 2 && languageCode !== 'pt_BR') {
      languageCode = languageCode.split('_')[0];
    }

    switch (languageCode) {
      case 'ay':  // Aymará
      case 'bo':  // Tibetan
      case 'cgg': // Chiga
      case 'dz':  // Dzongkha
      case 'fa':  // Persian
      case 'id':  // Indonesian
      case 'ja':  // Japanese
      case 'jbo': // Lojban
      case 'ka':  // Georgian
      case 'kk':  // Kazakh
      case 'km':  // Khmer
      case 'ko':  // Korean
      case 'ky':  // Kyrgyz
      case 'lo':  // Lao
      case 'ms':  // Malay
      case 'my':  // Burmese
      case 'sah': // Yakut
      case 'su':  // Sundanese
      case 'th':  // Thai
      case 'tt':  // Tatar
      case 'ug':  // Uyghur
      case 'vi':  // Vietnamese
      case 'wo':  // Wolof
      case 'zh':  // Chinese
        // 1 form
        return 0
      case 'is':  // Icelandic
        // 2 forms
        return (n % 10 !== 1 || n % 100 === 11) ? 1 : 0
      case 'jv':  // Javanese
        // 2 forms
        return n !== 0 ? 1 : 0
      case 'mk':  // Macedonian
        // 2 forms
        return n === 1 || n % 10 === 1 ? 0 : 1
      case 'ach': // Acholi
      case 'ak':  // Akan
      case 'am':  // Amharic
      case 'arn': // Mapudungun
      case 'br':  // Breton
      case 'fil': // Filipino
      case 'fr':  // French
      case 'gun': // Gun
      case 'ln':  // Lingala
      case 'mfe': // Mauritian Creole
      case 'mg':  // Malagasy
      case 'mi':  // Maori
      case 'oc':  // Occitan
      case 'pt_BR':  // Brazilian Portuguese
      case 'tg':  // Tajik
      case 'ti':  // Tigrinya
      case 'tr':  // Turkish
      case 'uz':  // Uzbek
      case 'wa':  // Walloon
      /* eslint-disable */
      /* Disable "Duplicate case label" because there are 2 forms of Chinese plurals */
      case 'zh':  // Chinese
        /* eslint-enable */
        // 2 forms
        return n > 1 ? 1 : 0
      case 'lv':  // Latvian
        // 3 forms
        return (n % 10 === 1 && n % 100 !== 11 ? 0 : n !== 0 ? 1 : 2)
      case 'lt':  // Lithuanian
        // 3 forms
        return (n % 10 === 1 && n % 100 !== 11 ? 0 : n % 10 >= 2 && (n % 100 < 10 || n % 100 >= 20) ? 1 : 2)
      case 'be':  // Belarusian
      case 'bs':  // Bosnian
      case 'hr':  // Croatian
      case 'ru':  // Russian
      case 'sr':  // Serbian
      case 'uk':  // Ukrainian
        // 3 forms
        return (
          n % 10 === 1 && n % 100 !== 11 ? 0 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 1 : 2)
      case 'mnk': // Mandinka
        // 3 forms
        return (n === 0 ? 0 : n === 1 ? 1 : 2)
      case 'ro':  // Romanian
        // 3 forms
        return (n === 1 ? 0 : (n === 0 || (n % 100 > 0 && n % 100 < 20)) ? 1 : 2)
      case 'pl':  // Polish
        // 3 forms
        return (n === 1 ? 0 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 1 : 2)
      case 'cs':  // Czech
      case 'sk':  // Slovak
        // 3 forms
        return (n === 1) ? 0 : (n >= 2 && n <= 4) ? 1 : 2
      case 'csb': // Kashubian
        // 3 forms
        return (n === 1) ? 0 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 1 : 2
      case 'sl':  // Slovenian
        // 4 forms
        return (n % 100 === 1 ? 0 : n % 100 === 2 ? 1 : n % 100 === 3 || n % 100 === 4 ? 2 : 3)
      case 'mt':  // Maltese
        // 4 forms
        return (n === 1 ? 0 : n === 0 || (n % 100 > 1 && n % 100 < 11) ? 1 : (n % 100 > 10 && n % 100 < 20) ? 2 : 3)
      case 'gd':  // Scottish Gaelic
        // 4 forms
        return (n === 1 || n === 11) ? 0 : (n === 2 || n === 12) ? 1 : (n > 2 && n < 20) ? 2 : 3
      case 'cy':  // Welsh
        // 4 forms
        return (n === 1) ? 0 : (n === 2) ? 1 : (n !== 8 && n !== 11) ? 2 : 3
      case 'kw':  // Cornish
        // 4 forms
        return (n === 1) ? 0 : (n === 2) ? 1 : (n === 3) ? 2 : 3
      case 'ga':  // Irish
        // 5 forms
        return n === 1 ? 0 : n === 2 ? 1 : (n > 2 && n < 7) ? 2 : (n > 6 && n < 11) ? 3 : 4
      case 'ar':  // Arabic
        // 6 forms
        return (n === 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n % 100 >= 3 && n % 100 <= 10 ? 3 : n % 100 >= 11 ? 4 : 5)
      default: // Everything else
        return n !== 1 ? 1 : 0
    }
  }
};

var warn = function (msg, err) {
  if (typeof console !== 'undefined') {
    console.warn('[vue-i18n-gettext] ' + msg);

    if (err) {
      console.warn(err.stack);
    }
  }
};

var isObject = function (obj) {
  return obj !== null && typeof obj === 'object'
};

var stripVData = function (input) {
  return input.replace(/[\t-\r \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]*data\-v\-[0-9A-Za-z\u017F\u212A]{8,}="(?:[\0-\t\x0B\f\x0E-\u2027\u202A-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])*?"/gi, '')
};

var stripHTMLWhitespace = function (input) {
  return input.replace(/>[\t-\r \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]{2,}/gi, '> ').replace(/[\t-\r \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]{2,}</gi, ' <')
};

/*  */
var BaseFormatter = function BaseFormatter () {
  this._caches = Object.create(null);
};

BaseFormatter.prototype.interpolate = function interpolate (message, values) {
  var tokens = this._caches[message];
  if (!tokens) {
    tokens = parse$1(message);
    this._caches[message] = tokens;
  }
  return compile$1(tokens, values)
};

var RE_TOKEN_LIST_VALUE = /^(\d)+/;
var RE_TOKEN_NAMED_VALUE = /^(\w)+/;

function parse$1 (format) {
  var tokens = [];
  var position = 0;

  var text = '';
  while (position < format.length) {
    var char = format[position++];
    if (char === '{') {
      if (text) {
        tokens.push({ type: 'text', value: text });
      }

      text = '';
      var sub = '';
      char = format[position++];
      while (char !== '}') {
        sub += char;
        char = format[position++];
      }

      var type = RE_TOKEN_LIST_VALUE.test(sub)
        ? 'list'
        : RE_TOKEN_NAMED_VALUE.test(sub)
          ? 'named'
          : 'unknown';
      tokens.push({ value: sub, type: type });
    } else if (char === '$') {
      // when found rails i18n syntax, skip text capture
      if (format[(position)] !== '{') {
        text += char;
      }
    } else {
      text += char;
    }
  }

  text && tokens.push({ type: 'text', value: text });

  return tokens
}

function compile$1 (tokens, values) {
  var compiled = [];
  var index = 0;

  var mode = Array.isArray(values)
    ? 'list'
    : isObject(values)
      ? 'named'
      : 'unknown';
  if (mode === 'unknown') { return compiled }

  while (index < tokens.length) {
    var token = tokens[index];
    switch (token.type) {
      case 'text':
        compiled.push(token.value);
        break
      case 'list':
        compiled.push(values[parseInt(token.value, 10)]);
        break
      case 'named':
        if (mode === 'named') {
          // Helper function which loops trought the object to get a nested attribute value.
          var getAttributeValue = function (objectPath) {
            var levels = objectPath.split('.');
            var currentValue = values;

            if (levels.length > 0) {
              for (var i = 0; i < levels.length; i++) {
                currentValue = currentValue[levels[i]];
              }

              return currentValue
            }

            return undefined
          };

          // If the token value is inside an object (a dot is detected in the token.value / object path) loop through object attributes to get the value.
          // If the token value has not been detected as an object path try to get the value based on that token.
          if (token.value.indexOf('.') !== -1) {
            compiled.push(getAttributeValue(token.value));
          } else {
            compiled.push((values)[token.value]);
          }
        } else {
          if (process.env.NODE_ENV !== 'production') {
            warn(("Type of token '" + (token.type) + "' and format of value '" + mode + "' don't match!"));
          }
        }
        break
      case 'unknown':
        if (process.env.NODE_ENV !== 'production') {
          warn("Detect 'unknown' type of token!");
        }
        break
    }
    index++;
  }

  return compiled
}

var interpolate$1 = function (message, interpolateMode, values) {
  var formatter = new BaseFormatter();
  var ret = formatter.interpolate(message, values);
  // if interpolateMode is **not** 'string' ('row'),
  // return the compiled data (e.g. ['foo', VNode, 'bar']) with formatter
  return interpolateMode === 'string' ? ret.join('') : ret
};

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
var _gettext = function (msgid) {
  var message = this.$i18n.getLocaleMessage(this.$i18n.activeLocale)['$$NOCONTEXT'][msgid];

  if (!message) {
    return msgid
  } else {
    return message.msgstr[0] || message.msgid
  }
};

// Context + Singular
var _pgettext = function (msgctxt, msgid) {
  var message;
  if (this.$i18n.getLocaleMessage(this.$i18n.activeLocale)[msgctxt]) {
    message = this.$i18n.getLocaleMessage(this.$i18n.activeLocale)[msgctxt][msgid];
  }

  if (!message) {
    return msgid
  } else {
    return message.msgstr[0] || message.msgid
  }
};

// Plural
var _ngettext = function (msgid, msgidPlural, n) {
  var message = this.$i18n.getLocaleMessage(this.$i18n.activeLocale)['$$NOCONTEXT'][msgid];

  if (!message) {
    return Math.abs(n) === 1 ? msgid : msgidPlural
  } else {
    var pluralIndex = plurals.getTranslationIndex(this.$i18n.activeLocale, n);
    var _msgidPlural = message.msgstr[pluralIndex];

    if (!_msgidPlural) {
      if (Math.abs(n) === 1) {
        _msgidPlural = message.msgstr[0] || message.msgid;
      } else {
        _msgidPlural = message.msgstr[1] || (message.msgid_plural || msgidPlural);
      }
    }

    return _msgidPlural
  }
};

// Context + Plural
var _npgettext = function (msgctxt, msgid, msgidPlural, n) {
  var message;
  if (this.$i18n.getLocaleMessage(this.$i18n.activeLocale)[msgctxt]) {
    message = this.$i18n.getLocaleMessage(this.$i18n.activeLocale)[msgctxt][msgid];
  }

  if (!message) {
    return Math.abs(n) === 1 ? msgid : msgidPlural
  } else {
    var pluralIndex = plurals.getTranslationIndex(this.$i18n.activeLocale, n);
    var _msgidPlural = message.msgstr[pluralIndex];

    if (!_msgidPlural) {
      if (Math.abs(n) === 1) {
        _msgidPlural = message.msgstr[0] || message.msgid;
      } else {
        _msgidPlural = message.msgstr[1] || (message.msgid_plural || msgidPlural);
      }
    }

    return _msgidPlural
  }
};

// Interpolate and return a string.
var _i18nInterpolate = function (msgid, values) {
  return interpolate$1(msgid, 'string', values)
};

var gettextFunctions = { _i18nInterpolate: _i18nInterpolate, _gettext: _gettext, _pgettext: _pgettext, _ngettext: _ngettext, _npgettext: _npgettext };

// This is a specialized parser for parsing strings which contain a gettext function.
// Its main purpose is to parse gettext from a string in a .json file
var miniparser = function (string) {
  if (typeof string !== 'string') {
    throw Error('NOT_STRING')
  } else {
    string = string.trim();
  }

  if (string[0] === '$') {
    var expressionIdentifier = string.substr(1, 2);

    if (['ge', 'pg', 'ng', 'np'].includes(expressionIdentifier)) {
      var paramtersString = string;
      var fullIdentifier = null;

      switch (expressionIdentifier) {
        case 'ge':
          fullIdentifier = 'gettext';
          paramtersString = paramtersString.substr(8);
          break
        case 'pg':
          fullIdentifier = 'pgettext';
          paramtersString = paramtersString.substr(9);
          break
        case 'ng':
          fullIdentifier = 'ngettext';
          paramtersString = paramtersString.substr(9);
          break
        case 'np':
          fullIdentifier = 'npgettext';
          paramtersString = paramtersString.substr(10);
      }

      var parameters = parseParameters(expressionIdentifier, paramtersString.trim());

      return {
        identifier: fullIdentifier,
        parameters: parameters
      }
    } else {
      throw Error('NO_GETTEXT_IDENTIFIER')
    }
  } else {
    throw Error('INVALID_START')
  }

  function parseParameters (expressionIdentifier, parametersString) {
    var parameters = [];
    var inputLength = parametersString.length;

    if (inputLength > 0) {
      if (parametersString[0] !== '(') {
        throw Error('NO_START_BRACKET')
      }
      if (parametersString[inputLength - 1] !== ')') {
        throw Error('NO_END_BRACKET')
      }

      // Parameters structure.
      parametersString = parametersString.substr(1).slice(0, -1);
      var allowedNumberOfParameters = (function () {
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
      })();

      // Characters iterator.
      var allowedQuoteSymbol = null;
      var parameterBuffer = [];
      for (var i = 0; i < parametersString.length; i++) {
        var char = parametersString.charAt(i);

        // Handle characters when parsing the last paramter that's supposed to be an integer and must not be wrapped with quotation marks.
        if (allowedQuoteSymbol === ',') {
          if (parameterBuffer.length > 0) {
            parameterBuffer.push(char);
          } else {
            if (char.trim().length === 0) {
              continue
            } else if (char === ',') {
              parameterBuffer.push(' ');
            } else {
              throw Error('MISSING_COMMA_BEFORE_LAST_PARAMETER')
            }
          }

          if (i === parametersString.length - 1) {
            if (parameterBuffer.length === 0) {
              throw Error('UNDEFINED_LAST_PARAMETER')
            } else {
              var parameterValue = parameterBuffer.join('').trim();

              if (!(!isNaN(+parameterValue) || parameterValue === '$n')) {
                if (parameterValue.indexOf(',') !== -1) {
                  throw Error('TOO_MANY_PARAMETERS')
                }
                throw Error('LAST_PARAMETER_NOT_NUMBER')
              }

              parameters.push(parameterValue === '$n' ? '$n' : +parameterValue);
            }
          }

          continue
        }

        // Handle characters when parsing normal text parameters.
        if (allowedQuoteSymbol === null && (char === '\'' || char === '"')) {
          allowedQuoteSymbol = char;
        } else if ((allowedQuoteSymbol === '\'' && char === '\'') || (allowedQuoteSymbol === '"' && char === '"')) {
          var previousChar = i >= 1 ? parametersString.charAt(i - 1) : null;

          if (previousChar !== '\\') {
            if (parameters.length >= allowedNumberOfParameters) {
              throw Error('TOO_MANY_PARAMETERS')
            } else {
              var parameterValue$1 = parameterBuffer.join('');

              // Add a valid parameter to the parameters array.
              parameters.push(parameterValue$1);
              parameterBuffer = [];

              // Change the quote symbol when expecting the next parameter to be an integer instead of a string.
              if ((expressionIdentifier === 'ng' && parameters.length === 2) || (expressionIdentifier === 'np' && parameters.length === 3)) {
                allowedQuoteSymbol = ',';
              } else {
                allowedQuoteSymbol = null;
              }
            }
          } else {
            parameterBuffer.push(char);
          }
        } else if (allowedQuoteSymbol !== null && allowedQuoteSymbol !== undefined && allowedQuoteSymbol !== false && char !== '\\') {
          parameterBuffer.push(char);
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
};

// UUID v4 generator (RFC4122 compliant).
//
// https://gist.github.com/jcxplorer/823878

function uuid () {
  var uuid = '';
  var i;
  var random;

  for (i = 0; i < 32; i++) {
    random = Math.random() * 16 | 0;
    if (i === 8 || i === 12 || i === 16 || i === 20) {
      uuid += '-';
    }
    uuid += (i === 12 ? 4 : (i === 16 ? (random & 3 | 8) : random)).toString(16);
  }

  return uuid
}

var Component = function (Vue, marked) {
  return {
    name: 'translate',

    created: function created () {
      this.msgid = '';
      this.msgidHTML = false;

      // Replace n with a value from the params if they are set.
      // If n isn't a string than it's assumed that a numeric value has been passed, and that value will be used
      // to determine the plural form (instead of the replace).
      if (this.tN && (typeof this.tN === 'string') && this.tParams) {
        this._tN = this.tN.trim();

        if (this.tParams.hasOwnProperty(this._tN) && this.tParams[this._tN]) {
          this._tN = this.tParams[this._tN];
        } else {
          this._tN = undefined;
        }
      } else {
        this._tN = this.tN;
      }

      this.isPlural = this._tN !== undefined && this.tPlural !== undefined;
      if (!this.isPlural && (this._tN || this.tPlural)) {
        throw new Error(("`t-n` and `t-plural` attributes must be used together: " + (this.msgid) + "."))
      }

      // Only raw content needs to be stored, before mounting.
      // This is required to get the correct string from the translations.
      // If there is only text, then it will be extracted from `_renderChildren`.
      // If there are HTML elements than a new helper component is initialized and `_renderChildren` are passed to it.
      // The helper component should be mounted manually silently.
      // From there the `innerHTML` is taken and white spaces removed. Also data-v attributes are removed.
      // The `vue-gettext-tools` extract option will also strip white spaces, so that keys can be matched.
      if (this.$options._renderChildren) {
        if (this.$options._renderChildren.length &&
          this.$options._renderChildren.length === 1 &&
          this.$options._renderChildren[0].hasOwnProperty('text') &&
          this.$options._renderChildren[0].text !== undefined &&
          this.$options._renderChildren[0].hasOwnProperty('tag') &&
          this.$options._renderChildren[0].tag === undefined) {
          this.msgid = this.$options._renderChildren[0].text.trim();
        } else {
          var self = this;

          // Mount helper component.
          var HelperComponent = Vue.component('i18n-helper-component', {
            render: function (createElement) {
              return createElement(
                'div',
                self.$options._renderChildren
              )
            }
          });

          var component = new HelperComponent().$mount();

          // Set the string to be the innerHTML of the helper component, but striped of white spaces and Vue's automatically added data-v attributes.
          this.msgid = stripVData(stripHTMLWhitespace(component.$el.innerHTML).trim());
          this.msgidHTML = true;
          component.$destroy();
        }
      }
    },

    props: {
      tag: {
        type: String,
        default: 'span'
      },
      tN: {
        type: [String, Number],
        required: false
      },
      tPlural: {
        type: String,
        required: false
      },
      tContext: {
        type: String,
        required: false
      },
      tComment: {
        type: String,
        required: false
      },
      tParams: {
        type: Object,
        required: false
      },
      md: {
        required: false
      },
      markdown: {
        required: false
      }
    },

    computed: {
      translation: function translation () {
        var translation = null;

        if (this.isPlural && this.tContext) {
          translation = this.$npgettext(this.tContext, this.msgid, this.isPlural ? this.tPlural : null, this._tN);
        } else if (this.isPlural) {
          translation = this.$ngettext(this.msgid, this.isPlural ? this.tPlural : null, this._tN);
        } else if (this.tContext) {
          translation = this.$pgettext(this.tContext, this.msgid);
        } else {
          translation = this.$gettext(this.msgid);
        }

        // Interpolate values from the parent component and from the parameters object.
        translation = this.$_i(translation, Object.assign(this.$parent, typeof this.tParams === 'object' ? this.tParams : {}));

        if (marked !== undefined && (this.markdown !== undefined && this.markdown !== false) || (this.md !== undefined && this.md !== false)) {
          this.msgidHTML = true;
          return marked(translation)
        } else {
          return translation
        }
      }
    },

    render: function render (createElement) {
      // https://vuejs.org/v2/guide/conditional.html#Controlling-Reusable-Elements-with-key
      // https://vuejs.org/v2/api/#key
      if (!this.$vnode.key) {
        this.$vnode.key = uuid();
      }

      // https://github.com/vuejs/vue/blob/a4fcdb/src/compiler/parser/index.js#L209
      return createElement(this.tag, [this.translation])
    },

    mounted: function mounted () {
      if (this.msgidHTML) {
        this.$el.innerHTML = this.$el.innerText;
      }
    }
  }
};

var Directive = function (marked) {
  return {
    bind: function bind (el, binding, vnode) {
      // https://vuejs.org/v2/guide/conditional.html#Controlling-Reusable-Elements-with-key
      // https://vuejs.org/v2/api/#key
      if (!vnode.key) {
        vnode.key = uuid();
      }

      var self = vnode.context;
      var attrs = vnode.data.attrs || {};
      var msgid = el.innerHTML;
      var tContext = attrs['t-context'];
      var tN = attrs['t-n'];
      var _tN = tN;
      var tPlural = attrs['t-plural'];
      var tParams = attrs['t-params'] || {};
      var md = attrs['md'];
      var markdown = attrs['markdown'];
      var isPlural = tN !== undefined && tPlural !== undefined;

      // If there are parameters inside the `v-translate` directive attribute merge them with params.
      // `vue-translate` values have the priority compared to `t-params`.
      if (binding.value && typeof binding.value === 'object') {
        tParams = Object.assign(tParams, binding.value);
      }

      // Replace n with a value from the params if they are set.
      // If n isn't a string than it's assumed that a numeric value has been passed, and that value will be used
      // to determine the plural form (instead of the replace).
      if (_tN && (typeof _tN === 'string') && tParams) {
        _tN = tN.trim();

        if (tParams.hasOwnProperty(_tN) && tParams[_tN]) {
          _tN = tParams[_tN];
        } else {
          _tN = undefined;
        }
      } else if (typeof _tN !== 'number') {
        _tN = undefined;
      }

      if (!isPlural && (tN || tPlural)) {
        throw new Error('`translate-n` and `translate-plural` attributes must be used together:' + msgid + '.')
      }

      if (el.innerHTML.trim() !== el.innerText) {
        // Content is HTML.
        // Set the string to be the innerHTML, but striped of white spaces and Vue's automatically added data-v attributes.
        msgid = stripVData(stripHTMLWhitespace(el.innerHTML).trim());
      } else {
        // Content is text.
        // Set the string to be only text.
        msgid = el.innerText;
      }

      var translation = null;

      if (isPlural && tContext) {
        translation = self.$npgettext(tContext, msgid, isPlural ? tPlural : null, _tN);
      } else if (isPlural) {
        translation = self.$ngettext(msgid, isPlural ? tPlural : null, _tN);
      } else if (tContext) {
        translation = self.$pgettext(tContext, msgid);
      } else {
        translation = self.$gettext(msgid);
      }

      // Interpolate values from the parent component and from the parameters object.
      translation = self.$_i(translation, Object.assign(self, typeof tParams === 'object' ? tParams : {}));

      if (marked !== undefined && (markdown !== undefined && markdown !== false) || (md !== undefined && md !== false)) {
        el.innerHTML = marked(translation);
      } else {
        el.innerHTML = translation;
      }
    }
  }

};

/*  */
function plugin (Vue, options, router, marked) {
  if ( options === void 0 ) options = {};

  // Expose gettext functions.
  Vue.prototype.$gettext = gettextFunctions._gettext;
  Vue.prototype.$pgettext = gettextFunctions._pgettext;
  Vue.prototype.$ngettext = gettextFunctions._ngettext;
  Vue.prototype.$npgettext = gettextFunctions._npgettext;
  Vue.prototype.$_i = gettextFunctions._i18nInterpolate;

  // Expose gettext parser helper.
  Vue.prototype.$parseGettext = function (input, n, nCount) {
    try {
      var parsedGettextCall = miniparser(input);

      if (parsedGettextCall.identifier === 'ngettext' || parsedGettextCall.identifier === 'npgettext') {
        if (n && typeof n === 'number') {
          parsedGettextCall.parameters[parsedGettextCall.parameters.length - 1] = n;
          nCount.counter = nCount.counter + 1;
        } else {
          parsedGettextCall.parameters[parsedGettextCall.parameters.length - 1] = 1;
        }
      }

      return (ref = this)['$' + parsedGettextCall.identifier].apply(ref, parsedGettextCall.parameters)
    } catch (err) {
      if (err.message !== 'NOT_STRING' && err.message !== 'INVALID_START') {
        warn(("[gettext-miniparser] " + input + " => " + err));
      }
      return input
    }
    var ref;
  };
  Vue.prototype.$parseObjectGettext = function (input, ns, values) {
    // Walk object and call $parseGettext for each string.
    // Think about how to inject multiple plural values
    if (typeof input === 'object') {
      var self = this;
      var output = JSON.parse(JSON.stringify(input));
      var nCount = {
        counter: 0,
        getN: function getN () {
          if (ns[this.counter]) {
            return ns[this.counter]
          } else {
            return undefined
          }
        }
      };(function walkObject (pointer) {
        var keys = Object.keys(pointer);

        for (var i = 0; i < keys.length; i++) {
          if (typeof pointer[keys[i]] === 'string') {
            if (ns) {
              pointer[keys[i]] = self.$parseGettext(pointer[keys[i]], nCount.getN(), nCount);
            } else {
              pointer[keys[i]] = self.$parseGettext(pointer[keys[i]]);
            }

            if (values && typeof values === 'object') {
              pointer[keys[i]] = self.$_i(pointer[keys[i]], values);
            }
          } else if (typeof pointer[keys[i]] === 'object') {
            walkObject(pointer[keys[i]]);
          }
        }
      })(output);

      return output
    } else {
      return this.$parseGettext(input, ns)
    }
  };

  // Parse options to config.
  var config = parseOptions(options);

  // Load the saved locale.
  // TODO: Move load and save of stored keys to helper functions.
  var savedLocale;
  if (config.storageMethod !== 'custom') {
    savedLocale = switchMethods[config.storageMethod].load(config.storageKey) || config.defaultLocale;
  } else {
    savedLocale = config.storageFunctions.load(config.storageKey) || config.defaultLocale;
  }

  // Modify the router so that is compatible with locale routing and switching.
  // TODO: Move this helper function to a global helpers object.
  var _path = function (path, replace, replacement) {
    var _path = path.replace(replace, replacement).replace(new RegExp('/{2,}', 'giu'), '/');
    return _path !== '' ? _path : '/'
  };

  // Prepare the routes to be ready for translation purposes.
  // Duplicate all routes, and make a `blank` and a `locale` version.
  // Blank versions are paths without the `_locale` parameter, and locale versions are paths with the `:_locale?` parameter.
  // Delete the previous router paths, and set it to the newly prepared routes array.
  var _modifiedRoutes = [];
  if (router) {
    // Duplicate routes and assign valid names.
    router.options.routes.forEach(function (_route) {
      // Prepare seed routes.
      var i18nId = uuid();
      _modifiedRoutes.push(Object.assign(
        Object.assign({}, _route),
        {
          name: _route.name ? _route.name : i18nId,
          path: !config.routeAutoPrefix ? _path(_route.path, '$locale', '') : _route.path,
          meta: {
            i18nId: i18nId,
            localized: false
          }
        }
      ));

      // Prepare children of the seed route.
      var currentSeedRoute = _modifiedRoutes[_modifiedRoutes.length - 1];
      if (currentSeedRoute.children && currentSeedRoute.children.length > 0) {
        (function modifyChild (_currentRoute) {
          _currentRoute.children.forEach(function (childRoute) {
            var i18nId = uuid();
            childRoute.name = childRoute.name || i18nId;

            if (!childRoute.meta) {
              childRoute.meta = {};
            }

            childRoute.meta = {
              i18nId: i18nId,
              localized: false
            };

            if (childRoute.children && childRoute.children.length > 0) {
              modifyChild(childRoute);
            }
          });
        })(currentSeedRoute);
      }

      // Prepare locale routes.
      _modifiedRoutes.push(Object.assign(
        Object.assign({}, currentSeedRoute),
        {
          name: '__locale:' + currentSeedRoute.meta.i18nId,
          path: config.routeAutoPrefix ? _path('/:_locale?/' + currentSeedRoute.path) : currentSeedRoute.path,
          meta: {
            i18nId: undefined,
            seedI18nId: currentSeedRoute.meta.i18nId,
            localized: true,
            seedRoute: currentSeedRoute
          },
          redirect: currentSeedRoute.redirect ? '/:_locale?' + currentSeedRoute.redirect : undefined
        }
      ));
      delete _modifiedRoutes[_modifiedRoutes.length - 1].meta.i18nId;

      // Prepare children of the locale route.
      var currentLocaleRoute = _modifiedRoutes[_modifiedRoutes.length - 1];
      if (currentLocaleRoute.children && currentLocaleRoute.children.length > 0) {
        // Duplicate the children array, and then restore references to the original child except for
        // following keys: children, meta.
        var childrenInstance = JSON.parse(JSON.stringify(currentLocaleRoute.children));(function adjustLocaleSubroutes (currentRoutes, childrenReference) {
          currentRoutes.forEach(function (childRoute, i) {
            var objectKeys = Object.keys(childRoute);

            objectKeys.forEach(function (key) {
              if (key !== 'children' && key !== 'meta') {
                childRoute[key] = childrenReference[i][key];
              }
            });

            if (childRoute.children && childRoute.children.length > 0) {
              adjustLocaleSubroutes(childRoute.children, childrenReference[i].children);
            }
          });
        })(childrenInstance, currentLocaleRoute.children)

        // Add new names for locale subroutes, and add additional meta data.
        ;(function modifyChild (currentRoutes, childrenReference) {
          currentRoutes.forEach(function (childRoute, i) {
            childRoute.name = '__locale:' + childRoute.meta.i18nId;

            if (!childRoute.meta) {
              childRoute.meta = {};
            }

            childRoute.meta = Object.assign(childRoute.meta, {
              i18nId: undefined,
              seedI18n: childRoute.meta.i18nId,
              localized: true,
              seedRoute: childrenReference[i]
            });

            if (childRoute.children && childRoute.children.length > 0) {
              modifyChild(childRoute.children, childrenReference[i].children);
            }
          });
        })(childrenInstance, currentLocaleRoute.children);
        currentLocaleRoute.children = childrenInstance;
      }
    });

    // Reset routes.
    router.matcher = new (Object.getPrototypeOf(router)).constructor({
      mode: 'history',
      routes: []
    }).matcher;

    // Add new routes.
    router.addRoutes(_modifiedRoutes);

    // Inject the gettext router guard to the router.
    router.beforeEach(function (to, from, next) {
      var actualTo;

      // Have always a locale set.
      if (!to.params._locale) {
        to.params._locale = config.defaultLocale;
      }

      // Verify that the valid `to` route is selected.
      if (!config.allLocales.includes(to.params._locale)) {
        var validLocaleMatchPath = to.matched[0].path.replace(':_locale?', '__locale__/' + to.params._locale);
        var validLocaleMatch = router.match(validLocaleMatchPath);
        actualTo = validLocaleMatch.meta.seedRoute;
      }

      // Set `to` to the actual match.
      if (actualTo) {
        actualTo.params = Object.assign(to.params, { _detected: true });
        actualTo.hash = to.hash;
        actualTo.query = to.query;
        actualTo._actual = true;

        if (!config.allLocales.includes(actualTo.params._locale)) {
          actualTo.params._locale = config.defaultLocale;
        }

        to = actualTo;
      }

      // Record if the path request came from a normal request or while changing the saved locale.
      var localeSwitch = to.params._changeLocale;

      // Helper for defining the `next` object.
      var defineNext = function (name, params) {
        return {
          name: name || to.name,
          params: params ? Object.assign(to.params, params) : to.params,
          hash: to.hash,
          query: to.query
        }
      };

      // Handle the default locale.
      var routeDefaultLocale = function (_changeLocale) {
        // If the saved locale is equal to the default locale make sure that the URL format is correct.
        if (to.meta.localized && !config.defaultLocaleInRoutes) {
          var _next = defineNext(to.meta.seedRoute.name);

          if (_changeLocale) {
            router.go(_next);
          } else {
            next(_next);
          }
        } else if (!to.meta.localized && config.defaultLocaleInRoutes) {
          var _next$1 = defineNext('__locale:' + to.meta.i18nId);

          if (_changeLocale) {
            router.go(_next$1);
          } else {
            next(_next$1);
          }
        } else if (_changeLocale) {
          router.go(defineNext());
        }
      };

      // Helper for saving the new locale.
      var saveLocale = function (newLocale) {
        if (config.storageMethod !== 'custom') {
          switchMethods[config.storageMethod].save(config.storageKey, newLocale, savedLocale, config.cookieExpirationInDays);
        } else {
          config.storageFunctions.save(config.storageKey, newLocale, savedLocale);
        }
      };

      // Parse the route when it contains a locale that is not currently selected.
      if (to.params._locale !== savedLocale) {
        if (to.meta.localized) {
          if (to.params._locale !== config.defaultLocale) {
            if (config.routingStyle === 'changeLocale') {
              saveLocale(to.params._locale);
              router.go(defineNext());
            } else if (config.routingStyle === 'redirect') {
              next(defineNext(null, { _locale: savedLocale }));
            }
          } else {
            if (config.routingStyle === 'changeLocale') {
              saveLocale(to.params._locale);
              routeDefaultLocale(true);
            } else if (config.routingStyle === 'redirect') {
              next(defineNext(null, { _locale: savedLocale }));
            }
          }
        } else {
          if (to.params._locale !== config.defaultLocale) {
            if (config.routingStyle === 'changeLocale') {
              saveLocale(to.params._locale);
              router.go(defineNext('__locale:' + to.meta.i18nId));
            } else if (config.routingStyle === 'redirect') {
              next(defineNext('__locale:' + to.meta.i18nId, { _locale: savedLocale }));
            }
          } else {
            if (config.routingStyle === 'changeLocale') {
              saveLocale(to.params._locale);
              routeDefaultLocale(true);
            } else if (config.routingStyle === 'redirect') {
              next(defineNext('__locale:' + to.meta.i18nId, { _locale: savedLocale }));
            }
          }
        }
      } else if (to.params._locale === config.defaultLocale) {
        routeDefaultLocale();
      }

      // If there is a detection of an route that was mismatch originally, reroute to the valid match.
      if (actualTo && !actualTo.params._detected) {
        next(actualTo);
      }
      next();
    });
  }

  // Expose parsed configuration to the Vue instance.
  Vue.prototype.$i18nRoutes = _modifiedRoutes;
  Vue.prototype.$i18n = new Vue({
    data: function data () {
      config.activeLocale = savedLocale && savedLocale !== config.defaultLocale ? savedLocale : config.defaultLocale;
      return config
    },
    methods: {
      getLocaleMessage: function getLocaleMessage (key) {
        return this.messages[key]
      }
    }
  });

  // Changes the active locale.
  Vue.prototype.$changeLocale = function (locale) {
    if (this.$i18n.allLocales.includes(locale)) {
      var oldLocale = this.$i18n.activeLocale;

      if (this.$i18n.storageMethod !== 'custom') {
        switchMethods[this.$i18n.storageMethod].save(this.$i18n.storageKey, locale, oldLocale, this.$i18n.cookieExpirationInDays);
      } else {
        this.$i18n.storageFunctions.save(this.$i18n.storageKey, locale, oldLocale);
      }

      if (!this.$i18n.forceReloadOnSwitch) {
        this.$i18n.activeLocale = locale;
      }

      if (this.$i18n.usingRouter && router) {
        if (!this.$i18n.defaultLocaleInRoutes && locale === this.$i18n.defaultLocale && this.$route.meta.localized === true) {
          this.$router.push({
            name: this.$route.meta.seedRoute.name,
            params: Object.assign(this.$route.params, { _locale: undefined, _changeLocale: true }),
            hash: this.$route.hash,
            query: this.$route.query
          });
        } else if (this.$route.meta.localized === true) {
          this.$router.push({
            name: this.$route.name,
            params: Object.assign(this.$route.params, { _locale: locale, _changeLocale: true }),
            hash: this.$route.hash,
            query: this.$route.query
          });
        } else {
          this.$router.push({
            name: '__locale:' + this.$route.meta.i18nId,
            params: Object.assign(this.$route.params, { _locale: locale, _changeLocale: true }),
            hash: this.$route.hash,
            query: this.$route.query
          });
        }

        if (this.$i18n.forceReloadOnSwitch) {
          window.location.reload();
        }
      } else {
        if (this.$i18n.forceReloadOnSwitch) {
          window.location.reload();
        }
      }
    }
  };

  // Converts a router link to the version of the current locale.
  var _localeLink = function (link) {
    var toPath;
    if (this.$i18n.routeAutoPrefix) {
      toPath = pathToRegexp_1.compile(_path('/:_locale?/' + link));
    } else {
      toPath = pathToRegexp_1.compile(link.replace('$locale', ':_locale?'));
    }

    var path = toPath({ _locale: this.$i18n.activeLocale === this.$i18n.defaultLocale ? (this.$i18n.defaultLocaleInRoutes ? this.$i18n.activeLocale : undefined) : this.$i18n.activeLocale });
    return path === '' ? '/' : path
  };
  Vue.prototype.$localeLink = _localeLink;
  Vue.prototype.$L = _localeLink;

  // Makes <translate> available as a global component.
  Vue.component('translate', Component(Vue, marked));

  // An option to support translation with HTML content: `v-translate`.
  Vue.directive('translate', Directive(marked));
}

// Built-in methods for changing, selecting and storing the locale.
var switchMethods = {
  session: {
    save: function save (key, newLocale, oldLocale) {
      window.sessionStorage.setItem(key, newLocale);
    },
    load: function load (key) {
      return window.sessionStorage.getItem(key)
    }
  },
  local: {
    save: function save$1 (key, newLocale, oldLocale) {
      window.localStorage.setItem(key, newLocale);
    },
    load: function load$1 (key) {
      return window.localStorage.getItem(key)
    }
  },
  cookie: {
    save: function save$2 (key, newLocale, oldLocale, expirationInDays) {
      function setCookie (cname, cvalue, exdays) {
        var d = new Date();
        d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
        var expires = 'expires=' + d.toUTCString();
        document.cookie = cname + '=' + cvalue + ';' + expires + ';path=/';
      }

      setCookie(key, newLocale, expirationInDays || 365);
    },
    load: function load$2 (key) {
      function getCookie (cname) {
        var name = cname + '=';
        var decodedCookie = decodeURIComponent(document.cookie);
        var ca = decodedCookie.split(';');
        for (var i = 0; i < ca.length; i++) {
          var c = ca[i];
          while (c.charAt(0) === ' ') {
            c = c.substring(1);
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
};

// Parse configuration and return normalized values.
var parseOptions = function (options) {
  var _options = {
    messages: options.messages || {},
    defaultLocale: options.defaultLocale || 'en',
    allLocales: options.allLocales || (options.defaultLocale ? [options.defaultLocale] : ['en']),
    forceReloadOnSwitch: options.forceReloadOnSwitch || true,
    usingRouter: options.usingRouter || false,
    defaultLocaleInRoutes: options.defaultLocaleInRoutes || false,
    routingStyle: options.routingStyle || 'changeLocale',
    routeAutoPrefix: options.routeAutoPrefix || true,
    // TODO: Implement better storageMethod parsing.
    storageMethod: typeof options.storageMethod !== 'object' ? (['session', 'local', 'cookie'].includes(options.storageMethod.trim()) ? options.storageMethod.trim() : 'local') : 'custom',
    storageKey: options.storageKey || '_vue_i18n_gettext_locale',
    cookieExpirationInDays: options.cookieExpirationInDays || 30,
    customOnLoad: options.customOnLoad
  };

  if (_options.storageMethod === 'custom') {
    _options.storageFunctions = options.storageMethod;
  }

  return _options
};

var gettextMixin = {
  created: function created () {
    if (this.$i18n.customOnLoad && typeof this.$i18n.customOnLoad === 'function') {
      this.$i18n.customOnLoad(this);
    }
  }
};

plugin.version = '0.0.7';

if (typeof window !== 'undefined' && window.Vue) {
  window.Vue.use(plugin);
}

exports.VueGettext = plugin;
exports.gettextMixin = gettextMixin;
exports['default'] = plugin;

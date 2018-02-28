/*!
 * vue-i18n-gettext v0.0.11 
 * (c) 2018 Eldar Cejvanovic
 * Released under the MIT License.
 */
(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(factory((global.VueI18nGettext = global.VueI18nGettext || {})));
}(this, (function (exports) { 'use strict';

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
          {
            warn(("Type of token '" + (token.type) + "' and format of value '" + mode + "' don't match!"));
          }
        }
        break
      case 'unknown':
        {
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
  var renderTranslation = function (el, binding, vnode, useJustCache) {
    var self = vnode.context;
    var attrs = vnode.data.attrs || {};
    var msgid = el.dataset.i18nCachedMsgid || el.innerHTML;
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

    // Cache msgid.
    if (!el.dataset.i18nCachedMsgid) {
      if (el.innerHTML.trim() !== el.innerText) {
        // Content is HTML.
        // Set the string to be the innerHTML, but striped of white spaces and Vue's automatically added data-v attributes.
        msgid = stripVData(stripHTMLWhitespace(el.innerHTML).trim());
      } else {
        // Content is text.
        // Set the string to be only text.
        msgid = el.innerText;
      }

      el.dataset.i18nCachedMsgid = msgid;
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

    el.dataset.i18nBoundLocale = self.$i18n.activeLocale;
  };

  return {
    bind: function bind (el, binding, vnode) {
      renderTranslation(el, binding, vnode);
    },
    update: function update (el, binding, vnode) {
      renderTranslation(el, binding, vnode);
    }
  }
};

var commonjsGlobal = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};





function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}

var lodash_clonedeep = createCommonjsModule(function (module, exports) {
/**
 * lodash (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright jQuery Foundation and other contributors <https://jquery.org/>
 * Released under MIT license <https://lodash.com/license>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 */

/** Used as the size to enable large array optimizations. */
var LARGE_ARRAY_SIZE = 200;

/** Used to stand-in for `undefined` hash values. */
var HASH_UNDEFINED = '__lodash_hash_undefined__';

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    arrayTag = '[object Array]',
    boolTag = '[object Boolean]',
    dateTag = '[object Date]',
    errorTag = '[object Error]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]',
    mapTag = '[object Map]',
    numberTag = '[object Number]',
    objectTag = '[object Object]',
    promiseTag = '[object Promise]',
    regexpTag = '[object RegExp]',
    setTag = '[object Set]',
    stringTag = '[object String]',
    symbolTag = '[object Symbol]',
    weakMapTag = '[object WeakMap]';

var arrayBufferTag = '[object ArrayBuffer]',
    dataViewTag = '[object DataView]',
    float32Tag = '[object Float32Array]',
    float64Tag = '[object Float64Array]',
    int8Tag = '[object Int8Array]',
    int16Tag = '[object Int16Array]',
    int32Tag = '[object Int32Array]',
    uint8Tag = '[object Uint8Array]',
    uint8ClampedTag = '[object Uint8ClampedArray]',
    uint16Tag = '[object Uint16Array]',
    uint32Tag = '[object Uint32Array]';

/**
 * Used to match `RegExp`
 * [syntax characters](http://ecma-international.org/ecma-262/7.0/#sec-patterns).
 */
var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;

/** Used to match `RegExp` flags from their coerced string values. */
var reFlags = /\w*$/;

/** Used to detect host constructors (Safari). */
var reIsHostCtor = /^\[object .+?Constructor\]$/;

/** Used to detect unsigned integer values. */
var reIsUint = /^(?:0|[1-9]\d*)$/;

/** Used to identify `toStringTag` values supported by `_.clone`. */
var cloneableTags = {};
cloneableTags[argsTag] = cloneableTags[arrayTag] =
cloneableTags[arrayBufferTag] = cloneableTags[dataViewTag] =
cloneableTags[boolTag] = cloneableTags[dateTag] =
cloneableTags[float32Tag] = cloneableTags[float64Tag] =
cloneableTags[int8Tag] = cloneableTags[int16Tag] =
cloneableTags[int32Tag] = cloneableTags[mapTag] =
cloneableTags[numberTag] = cloneableTags[objectTag] =
cloneableTags[regexpTag] = cloneableTags[setTag] =
cloneableTags[stringTag] = cloneableTags[symbolTag] =
cloneableTags[uint8Tag] = cloneableTags[uint8ClampedTag] =
cloneableTags[uint16Tag] = cloneableTags[uint32Tag] = true;
cloneableTags[errorTag] = cloneableTags[funcTag] =
cloneableTags[weakMapTag] = false;

/** Detect free variable `global` from Node.js. */
var freeGlobal = typeof commonjsGlobal == 'object' && commonjsGlobal && commonjsGlobal.Object === Object && commonjsGlobal;

/** Detect free variable `self`. */
var freeSelf = typeof self == 'object' && self && self.Object === Object && self;

/** Used as a reference to the global object. */
var root = freeGlobal || freeSelf || Function('return this')();

/** Detect free variable `exports`. */
var freeExports = 'object' == 'object' && exports && !exports.nodeType && exports;

/** Detect free variable `module`. */
var freeModule = freeExports && 'object' == 'object' && module && !module.nodeType && module;

/** Detect the popular CommonJS extension `module.exports`. */
var moduleExports = freeModule && freeModule.exports === freeExports;

/**
 * Adds the key-value `pair` to `map`.
 *
 * @private
 * @param {Object} map The map to modify.
 * @param {Array} pair The key-value pair to add.
 * @returns {Object} Returns `map`.
 */
function addMapEntry(map, pair) {
  // Don't return `map.set` because it's not chainable in IE 11.
  map.set(pair[0], pair[1]);
  return map;
}

/**
 * Adds `value` to `set`.
 *
 * @private
 * @param {Object} set The set to modify.
 * @param {*} value The value to add.
 * @returns {Object} Returns `set`.
 */
function addSetEntry(set, value) {
  // Don't return `set.add` because it's not chainable in IE 11.
  set.add(value);
  return set;
}

/**
 * A specialized version of `_.forEach` for arrays without support for
 * iteratee shorthands.
 *
 * @private
 * @param {Array} [array] The array to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns `array`.
 */
function arrayEach(array, iteratee) {
  var index = -1,
      length = array ? array.length : 0;

  while (++index < length) {
    if (iteratee(array[index], index, array) === false) {
      break;
    }
  }
  return array;
}

/**
 * Appends the elements of `values` to `array`.
 *
 * @private
 * @param {Array} array The array to modify.
 * @param {Array} values The values to append.
 * @returns {Array} Returns `array`.
 */
function arrayPush(array, values) {
  var index = -1,
      length = values.length,
      offset = array.length;

  while (++index < length) {
    array[offset + index] = values[index];
  }
  return array;
}

/**
 * A specialized version of `_.reduce` for arrays without support for
 * iteratee shorthands.
 *
 * @private
 * @param {Array} [array] The array to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @param {*} [accumulator] The initial value.
 * @param {boolean} [initAccum] Specify using the first element of `array` as
 *  the initial value.
 * @returns {*} Returns the accumulated value.
 */
function arrayReduce(array, iteratee, accumulator, initAccum) {
  var index = -1,
      length = array ? array.length : 0;

  if (initAccum && length) {
    accumulator = array[++index];
  }
  while (++index < length) {
    accumulator = iteratee(accumulator, array[index], index, array);
  }
  return accumulator;
}

/**
 * The base implementation of `_.times` without support for iteratee shorthands
 * or max array length checks.
 *
 * @private
 * @param {number} n The number of times to invoke `iteratee`.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the array of results.
 */
function baseTimes(n, iteratee) {
  var index = -1,
      result = Array(n);

  while (++index < n) {
    result[index] = iteratee(index);
  }
  return result;
}

/**
 * Gets the value at `key` of `object`.
 *
 * @private
 * @param {Object} [object] The object to query.
 * @param {string} key The key of the property to get.
 * @returns {*} Returns the property value.
 */
function getValue(object, key) {
  return object == null ? undefined : object[key];
}

/**
 * Checks if `value` is a host object in IE < 9.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a host object, else `false`.
 */
function isHostObject(value) {
  // Many host objects are `Object` objects that can coerce to strings
  // despite having improperly defined `toString` methods.
  var result = false;
  if (value != null && typeof value.toString != 'function') {
    try {
      result = !!(value + '');
    } catch (e) {}
  }
  return result;
}

/**
 * Converts `map` to its key-value pairs.
 *
 * @private
 * @param {Object} map The map to convert.
 * @returns {Array} Returns the key-value pairs.
 */
function mapToArray(map) {
  var index = -1,
      result = Array(map.size);

  map.forEach(function(value, key) {
    result[++index] = [key, value];
  });
  return result;
}

/**
 * Creates a unary function that invokes `func` with its argument transformed.
 *
 * @private
 * @param {Function} func The function to wrap.
 * @param {Function} transform The argument transform.
 * @returns {Function} Returns the new function.
 */
function overArg(func, transform) {
  return function(arg) {
    return func(transform(arg));
  };
}

/**
 * Converts `set` to an array of its values.
 *
 * @private
 * @param {Object} set The set to convert.
 * @returns {Array} Returns the values.
 */
function setToArray(set) {
  var index = -1,
      result = Array(set.size);

  set.forEach(function(value) {
    result[++index] = value;
  });
  return result;
}

/** Used for built-in method references. */
var arrayProto = Array.prototype,
    funcProto = Function.prototype,
    objectProto = Object.prototype;

/** Used to detect overreaching core-js shims. */
var coreJsData = root['__core-js_shared__'];

/** Used to detect methods masquerading as native. */
var maskSrcKey = (function() {
  var uid = /[^.]+$/.exec(coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO || '');
  return uid ? ('Symbol(src)_1.' + uid) : '';
}());

/** Used to resolve the decompiled source of functions. */
var funcToString = funcProto.toString;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Used to detect if a method is native. */
var reIsNative = RegExp('^' +
  funcToString.call(hasOwnProperty).replace(reRegExpChar, '\\$&')
  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
);

/** Built-in value references. */
var Buffer = moduleExports ? root.Buffer : undefined,
    Symbol = root.Symbol,
    Uint8Array = root.Uint8Array,
    getPrototype = overArg(Object.getPrototypeOf, Object),
    objectCreate = Object.create,
    propertyIsEnumerable = objectProto.propertyIsEnumerable,
    splice = arrayProto.splice;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeGetSymbols = Object.getOwnPropertySymbols,
    nativeIsBuffer = Buffer ? Buffer.isBuffer : undefined,
    nativeKeys = overArg(Object.keys, Object);

/* Built-in method references that are verified to be native. */
var DataView = getNative(root, 'DataView'),
    Map = getNative(root, 'Map'),
    Promise = getNative(root, 'Promise'),
    Set = getNative(root, 'Set'),
    WeakMap = getNative(root, 'WeakMap'),
    nativeCreate = getNative(Object, 'create');

/** Used to detect maps, sets, and weakmaps. */
var dataViewCtorString = toSource(DataView),
    mapCtorString = toSource(Map),
    promiseCtorString = toSource(Promise),
    setCtorString = toSource(Set),
    weakMapCtorString = toSource(WeakMap);

/** Used to convert symbols to primitives and strings. */
var symbolProto = Symbol ? Symbol.prototype : undefined,
    symbolValueOf = symbolProto ? symbolProto.valueOf : undefined;

/**
 * Creates a hash object.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function Hash(entries) {
  var this$1 = this;

  var index = -1,
      length = entries ? entries.length : 0;

  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this$1.set(entry[0], entry[1]);
  }
}

/**
 * Removes all key-value entries from the hash.
 *
 * @private
 * @name clear
 * @memberOf Hash
 */
function hashClear() {
  this.__data__ = nativeCreate ? nativeCreate(null) : {};
}

/**
 * Removes `key` and its value from the hash.
 *
 * @private
 * @name delete
 * @memberOf Hash
 * @param {Object} hash The hash to modify.
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function hashDelete(key) {
  return this.has(key) && delete this.__data__[key];
}

/**
 * Gets the hash value for `key`.
 *
 * @private
 * @name get
 * @memberOf Hash
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function hashGet(key) {
  var data = this.__data__;
  if (nativeCreate) {
    var result = data[key];
    return result === HASH_UNDEFINED ? undefined : result;
  }
  return hasOwnProperty.call(data, key) ? data[key] : undefined;
}

/**
 * Checks if a hash value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf Hash
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function hashHas(key) {
  var data = this.__data__;
  return nativeCreate ? data[key] !== undefined : hasOwnProperty.call(data, key);
}

/**
 * Sets the hash `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf Hash
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the hash instance.
 */
function hashSet(key, value) {
  var data = this.__data__;
  data[key] = (nativeCreate && value === undefined) ? HASH_UNDEFINED : value;
  return this;
}

// Add methods to `Hash`.
Hash.prototype.clear = hashClear;
Hash.prototype['delete'] = hashDelete;
Hash.prototype.get = hashGet;
Hash.prototype.has = hashHas;
Hash.prototype.set = hashSet;

/**
 * Creates an list cache object.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function ListCache(entries) {
  var this$1 = this;

  var index = -1,
      length = entries ? entries.length : 0;

  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this$1.set(entry[0], entry[1]);
  }
}

/**
 * Removes all key-value entries from the list cache.
 *
 * @private
 * @name clear
 * @memberOf ListCache
 */
function listCacheClear() {
  this.__data__ = [];
}

/**
 * Removes `key` and its value from the list cache.
 *
 * @private
 * @name delete
 * @memberOf ListCache
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function listCacheDelete(key) {
  var data = this.__data__,
      index = assocIndexOf(data, key);

  if (index < 0) {
    return false;
  }
  var lastIndex = data.length - 1;
  if (index == lastIndex) {
    data.pop();
  } else {
    splice.call(data, index, 1);
  }
  return true;
}

/**
 * Gets the list cache value for `key`.
 *
 * @private
 * @name get
 * @memberOf ListCache
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function listCacheGet(key) {
  var data = this.__data__,
      index = assocIndexOf(data, key);

  return index < 0 ? undefined : data[index][1];
}

/**
 * Checks if a list cache value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf ListCache
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function listCacheHas(key) {
  return assocIndexOf(this.__data__, key) > -1;
}

/**
 * Sets the list cache `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf ListCache
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the list cache instance.
 */
function listCacheSet(key, value) {
  var data = this.__data__,
      index = assocIndexOf(data, key);

  if (index < 0) {
    data.push([key, value]);
  } else {
    data[index][1] = value;
  }
  return this;
}

// Add methods to `ListCache`.
ListCache.prototype.clear = listCacheClear;
ListCache.prototype['delete'] = listCacheDelete;
ListCache.prototype.get = listCacheGet;
ListCache.prototype.has = listCacheHas;
ListCache.prototype.set = listCacheSet;

/**
 * Creates a map cache object to store key-value pairs.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function MapCache(entries) {
  var this$1 = this;

  var index = -1,
      length = entries ? entries.length : 0;

  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this$1.set(entry[0], entry[1]);
  }
}

/**
 * Removes all key-value entries from the map.
 *
 * @private
 * @name clear
 * @memberOf MapCache
 */
function mapCacheClear() {
  this.__data__ = {
    'hash': new Hash,
    'map': new (Map || ListCache),
    'string': new Hash
  };
}

/**
 * Removes `key` and its value from the map.
 *
 * @private
 * @name delete
 * @memberOf MapCache
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function mapCacheDelete(key) {
  return getMapData(this, key)['delete'](key);
}

/**
 * Gets the map value for `key`.
 *
 * @private
 * @name get
 * @memberOf MapCache
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function mapCacheGet(key) {
  return getMapData(this, key).get(key);
}

/**
 * Checks if a map value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf MapCache
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function mapCacheHas(key) {
  return getMapData(this, key).has(key);
}

/**
 * Sets the map `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf MapCache
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the map cache instance.
 */
function mapCacheSet(key, value) {
  getMapData(this, key).set(key, value);
  return this;
}

// Add methods to `MapCache`.
MapCache.prototype.clear = mapCacheClear;
MapCache.prototype['delete'] = mapCacheDelete;
MapCache.prototype.get = mapCacheGet;
MapCache.prototype.has = mapCacheHas;
MapCache.prototype.set = mapCacheSet;

/**
 * Creates a stack cache object to store key-value pairs.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function Stack(entries) {
  this.__data__ = new ListCache(entries);
}

/**
 * Removes all key-value entries from the stack.
 *
 * @private
 * @name clear
 * @memberOf Stack
 */
function stackClear() {
  this.__data__ = new ListCache;
}

/**
 * Removes `key` and its value from the stack.
 *
 * @private
 * @name delete
 * @memberOf Stack
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function stackDelete(key) {
  return this.__data__['delete'](key);
}

/**
 * Gets the stack value for `key`.
 *
 * @private
 * @name get
 * @memberOf Stack
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function stackGet(key) {
  return this.__data__.get(key);
}

/**
 * Checks if a stack value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf Stack
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function stackHas(key) {
  return this.__data__.has(key);
}

/**
 * Sets the stack `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf Stack
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the stack cache instance.
 */
function stackSet(key, value) {
  var cache = this.__data__;
  if (cache instanceof ListCache) {
    var pairs = cache.__data__;
    if (!Map || (pairs.length < LARGE_ARRAY_SIZE - 1)) {
      pairs.push([key, value]);
      return this;
    }
    cache = this.__data__ = new MapCache(pairs);
  }
  cache.set(key, value);
  return this;
}

// Add methods to `Stack`.
Stack.prototype.clear = stackClear;
Stack.prototype['delete'] = stackDelete;
Stack.prototype.get = stackGet;
Stack.prototype.has = stackHas;
Stack.prototype.set = stackSet;

/**
 * Creates an array of the enumerable property names of the array-like `value`.
 *
 * @private
 * @param {*} value The value to query.
 * @param {boolean} inherited Specify returning inherited property names.
 * @returns {Array} Returns the array of property names.
 */
function arrayLikeKeys(value, inherited) {
  // Safari 8.1 makes `arguments.callee` enumerable in strict mode.
  // Safari 9 makes `arguments.length` enumerable in strict mode.
  var result = (isArray(value) || isArguments(value))
    ? baseTimes(value.length, String)
    : [];

  var length = result.length,
      skipIndexes = !!length;

  for (var key in value) {
    if ((inherited || hasOwnProperty.call(value, key)) &&
        !(skipIndexes && (key == 'length' || isIndex(key, length)))) {
      result.push(key);
    }
  }
  return result;
}

/**
 * Assigns `value` to `key` of `object` if the existing value is not equivalent
 * using [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
 * for equality comparisons.
 *
 * @private
 * @param {Object} object The object to modify.
 * @param {string} key The key of the property to assign.
 * @param {*} value The value to assign.
 */
function assignValue(object, key, value) {
  var objValue = object[key];
  if (!(hasOwnProperty.call(object, key) && eq(objValue, value)) ||
      (value === undefined && !(key in object))) {
    object[key] = value;
  }
}

/**
 * Gets the index at which the `key` is found in `array` of key-value pairs.
 *
 * @private
 * @param {Array} array The array to inspect.
 * @param {*} key The key to search for.
 * @returns {number} Returns the index of the matched value, else `-1`.
 */
function assocIndexOf(array, key) {
  var length = array.length;
  while (length--) {
    if (eq(array[length][0], key)) {
      return length;
    }
  }
  return -1;
}

/**
 * The base implementation of `_.assign` without support for multiple sources
 * or `customizer` functions.
 *
 * @private
 * @param {Object} object The destination object.
 * @param {Object} source The source object.
 * @returns {Object} Returns `object`.
 */
function baseAssign(object, source) {
  return object && copyObject(source, keys(source), object);
}

/**
 * The base implementation of `_.clone` and `_.cloneDeep` which tracks
 * traversed objects.
 *
 * @private
 * @param {*} value The value to clone.
 * @param {boolean} [isDeep] Specify a deep clone.
 * @param {boolean} [isFull] Specify a clone including symbols.
 * @param {Function} [customizer] The function to customize cloning.
 * @param {string} [key] The key of `value`.
 * @param {Object} [object] The parent object of `value`.
 * @param {Object} [stack] Tracks traversed objects and their clone counterparts.
 * @returns {*} Returns the cloned value.
 */
function baseClone(value, isDeep, isFull, customizer, key, object, stack) {
  var result;
  if (customizer) {
    result = object ? customizer(value, key, object, stack) : customizer(value);
  }
  if (result !== undefined) {
    return result;
  }
  if (!isObject(value)) {
    return value;
  }
  var isArr = isArray(value);
  if (isArr) {
    result = initCloneArray(value);
    if (!isDeep) {
      return copyArray(value, result);
    }
  } else {
    var tag = getTag(value),
        isFunc = tag == funcTag || tag == genTag;

    if (isBuffer(value)) {
      return cloneBuffer(value, isDeep);
    }
    if (tag == objectTag || tag == argsTag || (isFunc && !object)) {
      if (isHostObject(value)) {
        return object ? value : {};
      }
      result = initCloneObject(isFunc ? {} : value);
      if (!isDeep) {
        return copySymbols(value, baseAssign(result, value));
      }
    } else {
      if (!cloneableTags[tag]) {
        return object ? value : {};
      }
      result = initCloneByTag(value, tag, baseClone, isDeep);
    }
  }
  // Check for circular references and return its corresponding clone.
  stack || (stack = new Stack);
  var stacked = stack.get(value);
  if (stacked) {
    return stacked;
  }
  stack.set(value, result);

  if (!isArr) {
    var props = isFull ? getAllKeys(value) : keys(value);
  }
  arrayEach(props || value, function(subValue, key) {
    if (props) {
      key = subValue;
      subValue = value[key];
    }
    // Recursively populate clone (susceptible to call stack limits).
    assignValue(result, key, baseClone(subValue, isDeep, isFull, customizer, key, value, stack));
  });
  return result;
}

/**
 * The base implementation of `_.create` without support for assigning
 * properties to the created object.
 *
 * @private
 * @param {Object} prototype The object to inherit from.
 * @returns {Object} Returns the new object.
 */
function baseCreate(proto) {
  return isObject(proto) ? objectCreate(proto) : {};
}

/**
 * The base implementation of `getAllKeys` and `getAllKeysIn` which uses
 * `keysFunc` and `symbolsFunc` to get the enumerable property names and
 * symbols of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Function} keysFunc The function to get the keys of `object`.
 * @param {Function} symbolsFunc The function to get the symbols of `object`.
 * @returns {Array} Returns the array of property names and symbols.
 */
function baseGetAllKeys(object, keysFunc, symbolsFunc) {
  var result = keysFunc(object);
  return isArray(object) ? result : arrayPush(result, symbolsFunc(object));
}

/**
 * The base implementation of `getTag`.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the `toStringTag`.
 */
function baseGetTag(value) {
  return objectToString.call(value);
}

/**
 * The base implementation of `_.isNative` without bad shim checks.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a native function,
 *  else `false`.
 */
function baseIsNative(value) {
  if (!isObject(value) || isMasked(value)) {
    return false;
  }
  var pattern = (isFunction(value) || isHostObject(value)) ? reIsNative : reIsHostCtor;
  return pattern.test(toSource(value));
}

/**
 * The base implementation of `_.keys` which doesn't treat sparse arrays as dense.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */
function baseKeys(object) {
  if (!isPrototype(object)) {
    return nativeKeys(object);
  }
  var result = [];
  for (var key in Object(object)) {
    if (hasOwnProperty.call(object, key) && key != 'constructor') {
      result.push(key);
    }
  }
  return result;
}

/**
 * Creates a clone of  `buffer`.
 *
 * @private
 * @param {Buffer} buffer The buffer to clone.
 * @param {boolean} [isDeep] Specify a deep clone.
 * @returns {Buffer} Returns the cloned buffer.
 */
function cloneBuffer(buffer, isDeep) {
  if (isDeep) {
    return buffer.slice();
  }
  var result = new buffer.constructor(buffer.length);
  buffer.copy(result);
  return result;
}

/**
 * Creates a clone of `arrayBuffer`.
 *
 * @private
 * @param {ArrayBuffer} arrayBuffer The array buffer to clone.
 * @returns {ArrayBuffer} Returns the cloned array buffer.
 */
function cloneArrayBuffer(arrayBuffer) {
  var result = new arrayBuffer.constructor(arrayBuffer.byteLength);
  new Uint8Array(result).set(new Uint8Array(arrayBuffer));
  return result;
}

/**
 * Creates a clone of `dataView`.
 *
 * @private
 * @param {Object} dataView The data view to clone.
 * @param {boolean} [isDeep] Specify a deep clone.
 * @returns {Object} Returns the cloned data view.
 */
function cloneDataView(dataView, isDeep) {
  var buffer = isDeep ? cloneArrayBuffer(dataView.buffer) : dataView.buffer;
  return new dataView.constructor(buffer, dataView.byteOffset, dataView.byteLength);
}

/**
 * Creates a clone of `map`.
 *
 * @private
 * @param {Object} map The map to clone.
 * @param {Function} cloneFunc The function to clone values.
 * @param {boolean} [isDeep] Specify a deep clone.
 * @returns {Object} Returns the cloned map.
 */
function cloneMap(map, isDeep, cloneFunc) {
  var array = isDeep ? cloneFunc(mapToArray(map), true) : mapToArray(map);
  return arrayReduce(array, addMapEntry, new map.constructor);
}

/**
 * Creates a clone of `regexp`.
 *
 * @private
 * @param {Object} regexp The regexp to clone.
 * @returns {Object} Returns the cloned regexp.
 */
function cloneRegExp(regexp) {
  var result = new regexp.constructor(regexp.source, reFlags.exec(regexp));
  result.lastIndex = regexp.lastIndex;
  return result;
}

/**
 * Creates a clone of `set`.
 *
 * @private
 * @param {Object} set The set to clone.
 * @param {Function} cloneFunc The function to clone values.
 * @param {boolean} [isDeep] Specify a deep clone.
 * @returns {Object} Returns the cloned set.
 */
function cloneSet(set, isDeep, cloneFunc) {
  var array = isDeep ? cloneFunc(setToArray(set), true) : setToArray(set);
  return arrayReduce(array, addSetEntry, new set.constructor);
}

/**
 * Creates a clone of the `symbol` object.
 *
 * @private
 * @param {Object} symbol The symbol object to clone.
 * @returns {Object} Returns the cloned symbol object.
 */
function cloneSymbol(symbol) {
  return symbolValueOf ? Object(symbolValueOf.call(symbol)) : {};
}

/**
 * Creates a clone of `typedArray`.
 *
 * @private
 * @param {Object} typedArray The typed array to clone.
 * @param {boolean} [isDeep] Specify a deep clone.
 * @returns {Object} Returns the cloned typed array.
 */
function cloneTypedArray(typedArray, isDeep) {
  var buffer = isDeep ? cloneArrayBuffer(typedArray.buffer) : typedArray.buffer;
  return new typedArray.constructor(buffer, typedArray.byteOffset, typedArray.length);
}

/**
 * Copies the values of `source` to `array`.
 *
 * @private
 * @param {Array} source The array to copy values from.
 * @param {Array} [array=[]] The array to copy values to.
 * @returns {Array} Returns `array`.
 */
function copyArray(source, array) {
  var index = -1,
      length = source.length;

  array || (array = Array(length));
  while (++index < length) {
    array[index] = source[index];
  }
  return array;
}

/**
 * Copies properties of `source` to `object`.
 *
 * @private
 * @param {Object} source The object to copy properties from.
 * @param {Array} props The property identifiers to copy.
 * @param {Object} [object={}] The object to copy properties to.
 * @param {Function} [customizer] The function to customize copied values.
 * @returns {Object} Returns `object`.
 */
function copyObject(source, props, object, customizer) {
  object || (object = {});

  var index = -1,
      length = props.length;

  while (++index < length) {
    var key = props[index];

    var newValue = customizer
      ? customizer(object[key], source[key], key, object, source)
      : undefined;

    assignValue(object, key, newValue === undefined ? source[key] : newValue);
  }
  return object;
}

/**
 * Copies own symbol properties of `source` to `object`.
 *
 * @private
 * @param {Object} source The object to copy symbols from.
 * @param {Object} [object={}] The object to copy symbols to.
 * @returns {Object} Returns `object`.
 */
function copySymbols(source, object) {
  return copyObject(source, getSymbols(source), object);
}

/**
 * Creates an array of own enumerable property names and symbols of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names and symbols.
 */
function getAllKeys(object) {
  return baseGetAllKeys(object, keys, getSymbols);
}

/**
 * Gets the data for `map`.
 *
 * @private
 * @param {Object} map The map to query.
 * @param {string} key The reference key.
 * @returns {*} Returns the map data.
 */
function getMapData(map, key) {
  var data = map.__data__;
  return isKeyable(key)
    ? data[typeof key == 'string' ? 'string' : 'hash']
    : data.map;
}

/**
 * Gets the native function at `key` of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {string} key The key of the method to get.
 * @returns {*} Returns the function if it's native, else `undefined`.
 */
function getNative(object, key) {
  var value = getValue(object, key);
  return baseIsNative(value) ? value : undefined;
}

/**
 * Creates an array of the own enumerable symbol properties of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of symbols.
 */
var getSymbols = nativeGetSymbols ? overArg(nativeGetSymbols, Object) : stubArray;

/**
 * Gets the `toStringTag` of `value`.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the `toStringTag`.
 */
var getTag = baseGetTag;

// Fallback for data views, maps, sets, and weak maps in IE 11,
// for data views in Edge < 14, and promises in Node.js.
if ((DataView && getTag(new DataView(new ArrayBuffer(1))) != dataViewTag) ||
    (Map && getTag(new Map) != mapTag) ||
    (Promise && getTag(Promise.resolve()) != promiseTag) ||
    (Set && getTag(new Set) != setTag) ||
    (WeakMap && getTag(new WeakMap) != weakMapTag)) {
  getTag = function(value) {
    var result = objectToString.call(value),
        Ctor = result == objectTag ? value.constructor : undefined,
        ctorString = Ctor ? toSource(Ctor) : undefined;

    if (ctorString) {
      switch (ctorString) {
        case dataViewCtorString: return dataViewTag;
        case mapCtorString: return mapTag;
        case promiseCtorString: return promiseTag;
        case setCtorString: return setTag;
        case weakMapCtorString: return weakMapTag;
      }
    }
    return result;
  };
}

/**
 * Initializes an array clone.
 *
 * @private
 * @param {Array} array The array to clone.
 * @returns {Array} Returns the initialized clone.
 */
function initCloneArray(array) {
  var length = array.length,
      result = array.constructor(length);

  // Add properties assigned by `RegExp#exec`.
  if (length && typeof array[0] == 'string' && hasOwnProperty.call(array, 'index')) {
    result.index = array.index;
    result.input = array.input;
  }
  return result;
}

/**
 * Initializes an object clone.
 *
 * @private
 * @param {Object} object The object to clone.
 * @returns {Object} Returns the initialized clone.
 */
function initCloneObject(object) {
  return (typeof object.constructor == 'function' && !isPrototype(object))
    ? baseCreate(getPrototype(object))
    : {};
}

/**
 * Initializes an object clone based on its `toStringTag`.
 *
 * **Note:** This function only supports cloning values with tags of
 * `Boolean`, `Date`, `Error`, `Number`, `RegExp`, or `String`.
 *
 * @private
 * @param {Object} object The object to clone.
 * @param {string} tag The `toStringTag` of the object to clone.
 * @param {Function} cloneFunc The function to clone values.
 * @param {boolean} [isDeep] Specify a deep clone.
 * @returns {Object} Returns the initialized clone.
 */
function initCloneByTag(object, tag, cloneFunc, isDeep) {
  var Ctor = object.constructor;
  switch (tag) {
    case arrayBufferTag:
      return cloneArrayBuffer(object);

    case boolTag:
    case dateTag:
      return new Ctor(+object);

    case dataViewTag:
      return cloneDataView(object, isDeep);

    case float32Tag: case float64Tag:
    case int8Tag: case int16Tag: case int32Tag:
    case uint8Tag: case uint8ClampedTag: case uint16Tag: case uint32Tag:
      return cloneTypedArray(object, isDeep);

    case mapTag:
      return cloneMap(object, isDeep, cloneFunc);

    case numberTag:
    case stringTag:
      return new Ctor(object);

    case regexpTag:
      return cloneRegExp(object);

    case setTag:
      return cloneSet(object, isDeep, cloneFunc);

    case symbolTag:
      return cloneSymbol(object);
  }
}

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  length = length == null ? MAX_SAFE_INTEGER : length;
  return !!length &&
    (typeof value == 'number' || reIsUint.test(value)) &&
    (value > -1 && value % 1 == 0 && value < length);
}

/**
 * Checks if `value` is suitable for use as unique object key.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is suitable, else `false`.
 */
function isKeyable(value) {
  var type = typeof value;
  return (type == 'string' || type == 'number' || type == 'symbol' || type == 'boolean')
    ? (value !== '__proto__')
    : (value === null);
}

/**
 * Checks if `func` has its source masked.
 *
 * @private
 * @param {Function} func The function to check.
 * @returns {boolean} Returns `true` if `func` is masked, else `false`.
 */
function isMasked(func) {
  return !!maskSrcKey && (maskSrcKey in func);
}

/**
 * Checks if `value` is likely a prototype object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
 */
function isPrototype(value) {
  var Ctor = value && value.constructor,
      proto = (typeof Ctor == 'function' && Ctor.prototype) || objectProto;

  return value === proto;
}

/**
 * Converts `func` to its source code.
 *
 * @private
 * @param {Function} func The function to process.
 * @returns {string} Returns the source code.
 */
function toSource(func) {
  if (func != null) {
    try {
      return funcToString.call(func);
    } catch (e) {}
    try {
      return (func + '');
    } catch (e) {}
  }
  return '';
}

/**
 * This method is like `_.clone` except that it recursively clones `value`.
 *
 * @static
 * @memberOf _
 * @since 1.0.0
 * @category Lang
 * @param {*} value The value to recursively clone.
 * @returns {*} Returns the deep cloned value.
 * @see _.clone
 * @example
 *
 * var objects = [{ 'a': 1 }, { 'b': 2 }];
 *
 * var deep = _.cloneDeep(objects);
 * console.log(deep[0] === objects[0]);
 * // => false
 */
function cloneDeep(value) {
  return baseClone(value, true, true);
}

/**
 * Performs a
 * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
 * comparison between two values to determine if they are equivalent.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 * @example
 *
 * var object = { 'a': 1 };
 * var other = { 'a': 1 };
 *
 * _.eq(object, object);
 * // => true
 *
 * _.eq(object, other);
 * // => false
 *
 * _.eq('a', 'a');
 * // => true
 *
 * _.eq('a', Object('a'));
 * // => false
 *
 * _.eq(NaN, NaN);
 * // => true
 */
function eq(value, other) {
  return value === other || (value !== value && other !== other);
}

/**
 * Checks if `value` is likely an `arguments` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
 *  else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */
function isArguments(value) {
  // Safari 8.1 makes `arguments.callee` enumerable in strict mode.
  return isArrayLikeObject(value) && hasOwnProperty.call(value, 'callee') &&
    (!propertyIsEnumerable.call(value, 'callee') || objectToString.call(value) == argsTag);
}

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null && isLength(value.length) && !isFunction(value);
}

/**
 * This method is like `_.isArrayLike` except that it also checks if `value`
 * is an object.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array-like object,
 *  else `false`.
 * @example
 *
 * _.isArrayLikeObject([1, 2, 3]);
 * // => true
 *
 * _.isArrayLikeObject(document.body.children);
 * // => true
 *
 * _.isArrayLikeObject('abc');
 * // => false
 *
 * _.isArrayLikeObject(_.noop);
 * // => false
 */
function isArrayLikeObject(value) {
  return isObjectLike(value) && isArrayLike(value);
}

/**
 * Checks if `value` is a buffer.
 *
 * @static
 * @memberOf _
 * @since 4.3.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a buffer, else `false`.
 * @example
 *
 * _.isBuffer(new Buffer(2));
 * // => true
 *
 * _.isBuffer(new Uint8Array(2));
 * // => false
 */
var isBuffer = nativeIsBuffer || stubFalse;

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a function, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8-9 which returns 'object' for typed array and other constructors.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This method is loosely based on
 * [`ToLength`](http://ecma-international.org/ecma-262/7.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is the
 * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
 * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Creates an array of the own enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects. See the
 * [ES spec](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)
 * for more details.
 *
 * @static
 * @since 0.1.0
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keys(new Foo);
 * // => ['a', 'b'] (iteration order is not guaranteed)
 *
 * _.keys('hi');
 * // => ['0', '1']
 */
function keys(object) {
  return isArrayLike(object) ? arrayLikeKeys(object) : baseKeys(object);
}

/**
 * This method returns a new empty array.
 *
 * @static
 * @memberOf _
 * @since 4.13.0
 * @category Util
 * @returns {Array} Returns the new empty array.
 * @example
 *
 * var arrays = _.times(2, _.stubArray);
 *
 * console.log(arrays);
 * // => [[], []]
 *
 * console.log(arrays[0] === arrays[1]);
 * // => false
 */
function stubArray() {
  return [];
}

/**
 * This method returns `false`.
 *
 * @static
 * @memberOf _
 * @since 4.13.0
 * @category Util
 * @returns {boolean} Returns `false`.
 * @example
 *
 * _.times(2, _.stubFalse);
 * // => [false, false]
 */
function stubFalse() {
  return false;
}

module.exports = cloneDeep;
});

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
      var output = lodash_clonedeep(input);
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
          meta: Object.assign(lodash_clonedeep(_route.meta), {
            i18nId: i18nId,
            localized: false
          })
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

            childRoute.meta = Object.assign(lodash_clonedeep(childRoute.meta), {
              i18nId: i18nId,
              localized: false
            });

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
          meta: Object.assign(lodash_clonedeep(currentSeedRoute.meta), {
            i18nId: undefined,
            seedI18nId: currentSeedRoute.meta.i18nId,
            localized: true,
            seedRoute: currentSeedRoute
          }),
          redirect: currentSeedRoute.redirect ? '/:_locale?' + currentSeedRoute.redirect : undefined
        }
      ));
      delete _modifiedRoutes[_modifiedRoutes.length - 1].meta.i18nId;

      // Prepare children of the locale route.
      var currentLocaleRoute = _modifiedRoutes[_modifiedRoutes.length - 1];
      if (currentLocaleRoute.children && currentLocaleRoute.children.length > 0) {
        // Duplicate the children array, and then restore references to the original child except for
        // following keys: children, meta.
        var childrenInstance = lodash_clonedeep(currentLocaleRoute.children);(function adjustLocaleSubroutes (currentRoutes, childrenReference) {
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
    console.log(_modifiedRoutes);

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
        actualTo.params = to.params;
        actualTo.hash = to.hash;
        actualTo.query = to.query;
        actualTo._actual = true;

        if (!config.allLocales.includes(actualTo.params._locale)) {
          actualTo.params._locale = config.defaultLocale;
        }

        to = actualTo;
      }

      // Record if the path request came from a normal request or while changing the saved locale.
      var localeSwitch = to.params._localeSwitch;

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
      if (to.params._locale !== savedLocale && !localeSwitch) {
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
      } else if (to.params._locale === config.defaultLocale && !localeSwitch) {
        routeDefaultLocale();
      }

      // If there is a detection of an route that was mismatch originally, reroute to the valid match.
      if (actualTo) {
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
        var _next;

        if (!this.$i18n.defaultLocaleInRoutes && locale === this.$i18n.defaultLocale && this.$route.meta.localized === true) {
          _next = {
            name: this.$route.meta.seedRoute.name,
            params: Object.assign(this.$route.params, { _locale: undefined, _localeSwitch: true }),
            hash: this.$route.hash,
            query: this.$route.query
          };
        } else if (this.$route.meta.localized === true) {
          _next = {
            name: this.$route.name,
            params: Object.assign(this.$route.params, { _locale: locale, _localeSwitch: true }),
            hash: this.$route.hash,
            query: this.$route.query
          };
        } else {
          _next = {
            name: '__locale:' + this.$route.meta.i18nId,
            params: Object.assign(this.$route.params, { _locale: locale, _localeSwitch: true }),
            hash: this.$route.hash,
            query: this.$route.query
          };
        }

        if (this.$i18n.forceReloadOnSwitch) {
          this.$router.push(_next);
          window.location.reload();
        } else {
          this.$router.push(_next);
        }
      } else {
        if (this.$i18n.forceReloadOnSwitch) {
          window.location.reload();
        }
      }
    }
  };

  // Converts a router link to the version of the current locale.
  var _localeLink = function (location) {
    if (typeof location === 'string') {
      var toPath;
      if (this.$i18n.routeAutoPrefix) {
        toPath = pathToRegexp_1.compile(_path('/:_locale?/' + location));
      } else {
        toPath = pathToRegexp_1.compile(location.replace('$locale', ':_locale?'));
      }

      var path = toPath({ _locale: this.$i18n.activeLocale === this.$i18n.defaultLocale ? (this.$i18n.defaultLocaleInRoutes ? this.$i18n.activeLocale : undefined) : this.$i18n.activeLocale });
      return path === '' ? '/' : path
    } else {
      return location
    }
    // TODO: Add support when the object contains name and/or path.
  };
  Vue.prototype.$localeLink = _localeLink;
  Vue.prototype.$ll = _localeLink;

  // Expose the locale version of the router.
  if (config.usingRouter && router) {
    router.locPush = function (location, onComplete, onAbort) {
      router.push(location ? router.app.$localeLink(location) : location, onComplete, onAbort);
    };

    router.locReplace = function (location, onComplete, onAbort) {
      router.replace(location ? router.app.$localeLink(location) : location, onComplete, onAbort);
    };

    router.locGo = function (n) {
      if (typeof n === 'string') {
        router.go(n ? router.app.$localeLink(n) : n);
      } else {
        router.go(n);
      }
      // TODO: Check if route object support is needed.
    };
    // TODO: Test support for router.resolve and router.getMatchedComponents
  }

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

plugin.version = '0.0.11';

if (typeof window !== 'undefined' && window.Vue) {
  window.Vue.use(plugin);
}

exports.VueGettext = plugin;
exports.gettextMixin = gettextMixin;
exports['default'] = plugin;

Object.defineProperty(exports, '__esModule', { value: true });

})));

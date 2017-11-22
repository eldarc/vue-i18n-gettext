/*!
 * vue-i18n-gettext v0.0.1 
 * (c) 2017 Eldar Cejvanovic
 * Released under the MIT License.
 */
/*!
 * vue-i18n v7.3.2 
 * (c) 2017 kazuya kawaguchi
 * Released under the MIT License.
 */
/*  */

/**
 * utilites
 */

function warn (msg, err) {
  if (typeof console !== 'undefined') {
    console.warn('[vue-i18n] ' + msg);
    /* istanbul ignore if */
    if (err) {
      console.warn(err.stack);
    }
  }
}

function isObject (obj) {
  return obj !== null && typeof obj === 'object'
}

var toString = Object.prototype.toString;
var OBJECT_STRING = '[object Object]';
function isPlainObject (obj) {
  return toString.call(obj) === OBJECT_STRING
}

function isNull (val) {
  return val === null || val === undefined
}

function parseArgs () {
  var arguments$1 = arguments;

  var args = [], len = arguments.length;
  while ( len-- ) { args[ len ] = arguments$1[ len ]; }

  var locale = null;
  var params = null;
  if (args.length === 1) {
    if (isObject(args[0]) || Array.isArray(args[0])) {
      params = args[0];
    } else if (typeof args[0] === 'string') {
      locale = args[0];
    }
  } else if (args.length === 2) {
    if (typeof args[0] === 'string') {
      locale = args[0];
    }
    /* istanbul ignore if */
    if (isObject(args[1]) || Array.isArray(args[1])) {
      params = args[1];
    }
  }

  return { locale: locale, params: params }
}

function getOldChoiceIndexFixed (choice) {
  return choice
    ? choice > 1
      ? 1
      : 0
    : 1
}

function getChoiceIndex (choice, choicesLength) {
  choice = Math.abs(choice);

  if (choicesLength === 2) { return getOldChoiceIndexFixed(choice) }

  return choice ? Math.min(choice, 2) : 0
}

function fetchChoice (message, choice) {
  /* istanbul ignore if */
  if (!message && typeof message !== 'string') { return null }
  var choices = message.split('|');

  choice = getChoiceIndex(choice, choices.length);
  if (!choices[choice]) { return message }
  return choices[choice].trim()
}

function looseClone (obj) {
  return JSON.parse(JSON.stringify(obj))
}

function remove (arr, item) {
  if (arr.length) {
    var index = arr.indexOf(item);
    if (index > -1) {
      return arr.splice(index, 1)
    }
  }
}

var hasOwnProperty = Object.prototype.hasOwnProperty;
function hasOwn (obj, key) {
  return hasOwnProperty.call(obj, key)
}

function merge (target) {
  var arguments$1 = arguments;

  var output = Object(target);
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments$1[i];
    if (source !== undefined && source !== null) {
      var key = (void 0);
      for (key in source) {
        if (hasOwn(source, key)) {
          if (isObject(source[key])) {
            output[key] = merge(output[key], source[key]);
          } else {
            output[key] = source[key];
          }
        }
      }
    }
  }
  return output
}

function looseEqual (a, b) {
  if (a === b) { return true }
  var isObjectA = isObject(a);
  var isObjectB = isObject(b);
  if (isObjectA && isObjectB) {
    try {
      var isArrayA = Array.isArray(a);
      var isArrayB = Array.isArray(b);
      if (isArrayA && isArrayB) {
        return a.length === b.length && a.every(function (e, i) {
          return looseEqual(e, b[i])
        })
      } else if (!isArrayA && !isArrayB) {
        var keysA = Object.keys(a);
        var keysB = Object.keys(b);
        return keysA.length === keysB.length && keysA.every(function (key) {
          return looseEqual(a[key], b[key])
        })
      } else {
        /* istanbul ignore next */
        return false
      }
    } catch (e) {
      /* istanbul ignore next */
      return false
    }
  } else if (!isObjectA && !isObjectB) {
    return String(a) === String(b)
  } else {
    return false
  }
}

var canUseDateTimeFormat =
  typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat !== 'undefined';

var canUseNumberFormat =
  typeof Intl !== 'undefined' && typeof Intl.NumberFormat !== 'undefined';

/*  */

function extend (Vue) {
  Vue.prototype.$t = function (key) {
    var arguments$1 = arguments;

    var values = [], len = arguments.length - 1;
    while ( len-- > 0 ) { values[ len ] = arguments$1[ len + 1 ]; }

    var i18n = this.$i18n;
    return i18n._t.apply(i18n, [ key, i18n.locale, i18n._getMessages(), this ].concat( values ))
  };

  Vue.prototype.$tc = function (key, choice) {
    var arguments$1 = arguments;

    var values = [], len = arguments.length - 2;
    while ( len-- > 0 ) { values[ len ] = arguments$1[ len + 2 ]; }

    var i18n = this.$i18n;
    return i18n._tc.apply(i18n, [ key, i18n.locale, i18n._getMessages(), this, choice ].concat( values ))
  };

  Vue.prototype.$te = function (key, locale) {
    var i18n = this.$i18n;
    return i18n._te(key, i18n.locale, i18n._getMessages(), locale)
  };

  Vue.prototype.$d = function (value) {
    var arguments$1 = arguments;

    var args = [], len = arguments.length - 1;
    while ( len-- > 0 ) { args[ len ] = arguments$1[ len + 1 ]; }

    return (ref = this.$i18n).d.apply(ref, [ value ].concat( args ))
    var ref;
  };

  Vue.prototype.$n = function (value) {
    var arguments$1 = arguments;

    var args = [], len = arguments.length - 1;
    while ( len-- > 0 ) { args[ len ] = arguments$1[ len + 1 ]; }

    return (ref = this.$i18n).n.apply(ref, [ value ].concat( args ))
    var ref;
  };
}

/*  */

var mixin = {
  beforeCreate: function beforeCreate () {
    var options = this.$options;
    options.i18n = options.i18n || (options.__i18n ? {} : null);

    if (options.i18n) {
      if (options.i18n instanceof VueI18n) {
        // init locale messages via custom blocks
        if (options.__i18n) {
          try {
            var localeMessages = {};
            options.__i18n.forEach(function (resource) {
              localeMessages = merge(localeMessages, JSON.parse(resource));
            });
            Object.keys(localeMessages).forEach(function (locale) {
              options.i18n.mergeLocaleMessage(locale, localeMessages[locale]);
            });
          } catch (e) {
            if (process.env.NODE_ENV !== 'production') {
              warn("Cannot parse locale messages via custom blocks.", e);
            }
          }
        }
        this._i18n = options.i18n;
        this._i18nWatcher = this._i18n.watchI18nData();
        this._i18n.subscribeDataChanging(this);
        this._subscribing = true;
      } else if (isPlainObject(options.i18n)) {
        // component local i18n
        if (this.$root && this.$root.$i18n && this.$root.$i18n instanceof VueI18n) {
          options.i18n.root = this.$root.$i18n;
          options.i18n.fallbackLocale = this.$root.$i18n.fallbackLocale;
          options.i18n.silentTranslationWarn = this.$root.$i18n.silentTranslationWarn;
        }

        // init locale messages via custom blocks
        if (options.__i18n) {
          try {
            var localeMessages$1 = {};
            options.__i18n.forEach(function (resource) {
              localeMessages$1 = merge(localeMessages$1, JSON.parse(resource));
            });
            options.i18n.messages = localeMessages$1;
          } catch (e) {
            if (process.env.NODE_ENV !== 'production') {
              warn("Cannot parse locale messages via custom blocks.", e);
            }
          }
        }

        this._i18n = new VueI18n(options.i18n);
        this._i18nWatcher = this._i18n.watchI18nData();
        this._i18n.subscribeDataChanging(this);
        this._subscribing = true;

        if (options.i18n.sync === undefined || !!options.i18n.sync) {
          this._localeWatcher = this.$i18n.watchLocale();
        }
      } else {
        if (process.env.NODE_ENV !== 'production') {
          warn("Cannot be interpreted 'i18n' option.");
        }
      }
    } else if (this.$root && this.$root.$i18n && this.$root.$i18n instanceof VueI18n) {
      // root i18n
      this._i18n = this.$root.$i18n;
      this._i18n.subscribeDataChanging(this);
      this._subscribing = true;
    } else if (options.parent && options.parent.$i18n && options.parent.$i18n instanceof VueI18n) {
      // parent i18n
      this._i18n = options.parent.$i18n;
      this._i18n.subscribeDataChanging(this);
      this._subscribing = true;
    }
  },

  beforeDestroy: function beforeDestroy () {
    if (!this._i18n) { return }

    if (this._subscribing) {
      this._i18n.unsubscribeDataChanging(this);
      delete this._subscribing;
    }

    if (this._i18nWatcher) {
      this._i18nWatcher();
      delete this._i18nWatcher;
    }

    if (this._localeWatcher) {
      this._localeWatcher();
      delete this._localeWatcher;
    }

    this._i18n = null;
  }
};

/*  */

var component = {
  name: 'i18n',
  functional: true,
  props: {
    tag: {
      type: String,
      default: 'span'
    },
    path: {
      type: String,
      required: true
    },
    locale: {
      type: String
    },
    places: {
      type: [Array, Object]
    }
  },
  render: function render (h, ref) {
    var props = ref.props;
    var data = ref.data;
    var children = ref.children;
    var parent = ref.parent;

    var i18n = parent.$i18n;

    children = (children || []).filter(function (child) {
      return child.tag || (child.text = child.text.trim())
    });

    if (!i18n) {
      if (process.env.NODE_ENV !== 'production') {
        warn('Cannot find VueI18n instance!');
      }
      return children
    }

    var path = props.path;
    var locale = props.locale;

    var params = {};
    var places = props.places || {};

    var hasPlaces = Array.isArray(places)
      ? places.length > 0
      : Object.keys(places).length > 0;

    var everyPlace = children.every(function (child) {
      if (child.data && child.data.attrs) {
        var place = child.data.attrs.place;
        return (typeof place !== 'undefined') && place !== ''
      }
    });

    if (hasPlaces && children.length > 0 && !everyPlace) {
      warn('If places prop is set, all child elements must have place prop set.');
    }

    if (Array.isArray(places)) {
      places.forEach(function (el, i) {
        params[i] = el;
      });
    } else {
      Object.keys(places).forEach(function (key) {
        params[key] = places[key];
      });
    }

    children.forEach(function (child, i) {
      var key = everyPlace
        ? ("" + (child.data.attrs.place))
        : ("" + i);
      params[key] = child;
    });

    return h(props.tag, data, i18n.i(path, locale, params))
  }
};

/*  */

function bind$1 (el, binding, vnode) {
  if (!assert(el, vnode)) { return }

  t$1(el, binding, vnode);
}

function update (el, binding, vnode, oldVNode) {
  if (!assert(el, vnode)) { return }

  if (localeEqual(el, vnode) && looseEqual(binding.value, binding.oldValue)) { return }

  t$1(el, binding, vnode);
}

function assert (el, vnode) {
  var vm = vnode.context;
  if (!vm) {
    warn('not exist Vue instance in VNode context');
    return false
  }

  if (!vm.$i18n) {
    warn('not exist VueI18n instance in Vue instance');
    return false
  }

  return true
}

function localeEqual (el, vnode) {
  var vm = vnode.context;
  return el._locale === vm.$i18n.locale
}

function t$1 (el, binding, vnode) {
  var value = binding.value;

  var ref = parseValue(value);
  var path = ref.path;
  var locale = ref.locale;
  var args = ref.args;
  if (!path && !locale && !args) {
    warn('not support value type');
    return
  }

  if (!path) {
    warn('required `path` in v-t directive');
    return
  }

  var vm = vnode.context;
  el._vt = el.textContent = (ref$1 = vm.$i18n).t.apply(ref$1, [ path ].concat( makeParams(locale, args) ));
  el._locale = vm.$i18n.locale;
  var ref$1;
}

function parseValue (value) {
  var path;
  var locale;
  var args;

  if (typeof value === 'string') {
    path = value;
  } else if (isPlainObject(value)) {
    path = value.path;
    locale = value.locale;
    args = value.args;
  }

  return { path: path, locale: locale, args: args }
}

function makeParams (locale, args) {
  var params = [];

  locale && params.push(locale);
  if (args && (Array.isArray(args) || isPlainObject(args))) {
    params.push(args);
  }

  return params
}

var Vue;

function install (_Vue) {
  Vue = _Vue;

  var version = (Vue.version && Number(Vue.version.split('.')[0])) || -1;
  /* istanbul ignore if */
  if (process.env.NODE_ENV !== 'production' && install.installed) {
    warn('already installed.');
    return
  }
  install.installed = true;

  /* istanbul ignore if */
  if (process.env.NODE_ENV !== 'production' && version < 2) {
    warn(("vue-i18n (" + (install.version) + ") need to use Vue 2.0 or later (Vue: " + (Vue.version) + ")."));
    return
  }

  Object.defineProperty(Vue.prototype, '$i18n', {
    get: function get () { return this._i18n }
  });

  extend(Vue);
  Vue.mixin(mixin);
  Vue.directive('t', { bind: bind$1, update: update });
  Vue.component(component.name, component);

  // use object-based merge strategy
  var strats = Vue.config.optionMergeStrategies;
  strats.i18n = strats.methods;
}

/*  */

var BaseFormatter = function BaseFormatter () {
  this._caches = Object.create(null);
};

BaseFormatter.prototype.interpolate = function interpolate (message, values) {
  var tokens = this._caches[message];
  if (!tokens) {
    tokens = parse(message);
    this._caches[message] = tokens;
  }
  return compile(tokens, values)
};

var RE_TOKEN_LIST_VALUE = /^(\d)+/;
var RE_TOKEN_NAMED_VALUE = /^(\w)+/;

function parse (format) {
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
    } else if (char === '%') {
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

function compile (tokens, values) {
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
          compiled.push((values)[token.value]);
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

/*  */

/**
 *  Path paerser
 *  - Inspired:
 *    Vue.js Path parser
 */

// actions
var APPEND = 0;
var PUSH = 1;
var INC_SUB_PATH_DEPTH = 2;
var PUSH_SUB_PATH = 3;

// states
var BEFORE_PATH = 0;
var IN_PATH = 1;
var BEFORE_IDENT = 2;
var IN_IDENT = 3;
var IN_SUB_PATH = 4;
var IN_SINGLE_QUOTE = 5;
var IN_DOUBLE_QUOTE = 6;
var AFTER_PATH = 7;
var ERROR = 8;

var pathStateMachine = [];

pathStateMachine[BEFORE_PATH] = {
  'ws': [BEFORE_PATH],
  'ident': [IN_IDENT, APPEND],
  '[': [IN_SUB_PATH],
  'eof': [AFTER_PATH]
};

pathStateMachine[IN_PATH] = {
  'ws': [IN_PATH],
  '.': [BEFORE_IDENT],
  '[': [IN_SUB_PATH],
  'eof': [AFTER_PATH]
};

pathStateMachine[BEFORE_IDENT] = {
  'ws': [BEFORE_IDENT],
  'ident': [IN_IDENT, APPEND],
  '0': [IN_IDENT, APPEND],
  'number': [IN_IDENT, APPEND]
};

pathStateMachine[IN_IDENT] = {
  'ident': [IN_IDENT, APPEND],
  '0': [IN_IDENT, APPEND],
  'number': [IN_IDENT, APPEND],
  'ws': [IN_PATH, PUSH],
  '.': [BEFORE_IDENT, PUSH],
  '[': [IN_SUB_PATH, PUSH],
  'eof': [AFTER_PATH, PUSH]
};

pathStateMachine[IN_SUB_PATH] = {
  "'": [IN_SINGLE_QUOTE, APPEND],
  '"': [IN_DOUBLE_QUOTE, APPEND],
  '[': [IN_SUB_PATH, INC_SUB_PATH_DEPTH],
  ']': [IN_PATH, PUSH_SUB_PATH],
  'eof': ERROR,
  'else': [IN_SUB_PATH, APPEND]
};

pathStateMachine[IN_SINGLE_QUOTE] = {
  "'": [IN_SUB_PATH, APPEND],
  'eof': ERROR,
  'else': [IN_SINGLE_QUOTE, APPEND]
};

pathStateMachine[IN_DOUBLE_QUOTE] = {
  '"': [IN_SUB_PATH, APPEND],
  'eof': ERROR,
  'else': [IN_DOUBLE_QUOTE, APPEND]
};

/**
 * Check if an expression is a literal value.
 */

var literalValueRE = /^\s?(true|false|-?[\d.]+|'[^']*'|"[^"]*")\s?$/;
function isLiteral (exp) {
  return literalValueRE.test(exp)
}

/**
 * Strip quotes from a string
 */

function stripQuotes (str) {
  var a = str.charCodeAt(0);
  var b = str.charCodeAt(str.length - 1);
  return a === b && (a === 0x22 || a === 0x27)
    ? str.slice(1, -1)
    : str
}

/**
 * Determine the type of a character in a keypath.
 */

function getPathCharType (ch) {
  if (ch === undefined || ch === null) { return 'eof' }

  var code = ch.charCodeAt(0);

  switch (code) {
    case 0x5B: // [
    case 0x5D: // ]
    case 0x2E: // .
    case 0x22: // "
    case 0x27: // '
    case 0x30: // 0
      return ch

    case 0x5F: // _
    case 0x24: // $
    case 0x2D: // -
      return 'ident'

    case 0x20: // Space
    case 0x09: // Tab
    case 0x0A: // Newline
    case 0x0D: // Return
    case 0xA0:  // No-break space
    case 0xFEFF:  // Byte Order Mark
    case 0x2028:  // Line Separator
    case 0x2029:  // Paragraph Separator
      return 'ws'
  }

  // a-z, A-Z
  if ((code >= 0x61 && code <= 0x7A) || (code >= 0x41 && code <= 0x5A)) {
    return 'ident'
  }

  // 1-9
  if (code >= 0x31 && code <= 0x39) { return 'number' }

  return 'else'
}

/**
 * Format a subPath, return its plain form if it is
 * a literal string or number. Otherwise prepend the
 * dynamic indicator (*).
 */

function formatSubPath (path) {
  var trimmed = path.trim();
  // invalid leading 0
  if (path.charAt(0) === '0' && isNaN(path)) { return false }

  return isLiteral(trimmed) ? stripQuotes(trimmed) : '*' + trimmed
}

/**
 * Parse a string path into an array of segments
 */

function parse$1 (path) {
  var keys = [];
  var index = -1;
  var mode = BEFORE_PATH;
  var subPathDepth = 0;
  var c;
  var key;
  var newChar;
  var type;
  var transition;
  var action;
  var typeMap;
  var actions = [];

  actions[PUSH] = function () {
    if (key !== undefined) {
      keys.push(key);
      key = undefined;
    }
  };

  actions[APPEND] = function () {
    if (key === undefined) {
      key = newChar;
    } else {
      key += newChar;
    }
  };

  actions[INC_SUB_PATH_DEPTH] = function () {
    actions[APPEND]();
    subPathDepth++;
  };

  actions[PUSH_SUB_PATH] = function () {
    if (subPathDepth > 0) {
      subPathDepth--;
      mode = IN_SUB_PATH;
      actions[APPEND]();
    } else {
      subPathDepth = 0;
      key = formatSubPath(key);
      if (key === false) {
        return false
      } else {
        actions[PUSH]();
      }
    }
  };

  function maybeUnescapeQuote () {
    var nextChar = path[index + 1];
    if ((mode === IN_SINGLE_QUOTE && nextChar === "'") ||
      (mode === IN_DOUBLE_QUOTE && nextChar === '"')) {
      index++;
      newChar = '\\' + nextChar;
      actions[APPEND]();
      return true
    }
  }

  while (mode !== null) {
    index++;
    c = path[index];

    if (c === '\\' && maybeUnescapeQuote()) {
      continue
    }

    type = getPathCharType(c);
    typeMap = pathStateMachine[mode];
    transition = typeMap[type] || typeMap['else'] || ERROR;

    if (transition === ERROR) {
      return // parse error
    }

    mode = transition[0];
    action = actions[transition[1]];
    if (action) {
      newChar = transition[2];
      newChar = newChar === undefined
        ? c
        : newChar;
      if (action() === false) {
        return
      }
    }

    if (mode === AFTER_PATH) {
      return keys
    }
  }
}





function empty (target) {
  /* istanbul ignore else */
  if (Array.isArray(target)) {
    return target.length === 0
  } else {
    return false
  }
}

var I18nPath = function I18nPath () {
  this._cache = Object.create(null);
};

/**
 * External parse that check for a cache hit first
 */
I18nPath.prototype.parsePath = function parsePath (path) {
  var hit = this._cache[path];
  if (!hit) {
    hit = parse$1(path);
    if (hit) {
      this._cache[path] = hit;
    }
  }
  return hit || []
};

/**
 * Get path value from path string
 */
I18nPath.prototype.getPathValue = function getPathValue (obj, path) {
  if (!isObject(obj)) { return null }

  var paths = this.parsePath(path);
  if (empty(paths)) {
    return null
  } else {
    var length = paths.length;
    var ret = null;
    var last = obj;
    var i = 0;
    while (i < length) {
      var value = last[paths[i]];
      if (value === undefined) {
        last = null;
        break
      }
      last = value;
      i++;
    }

    ret = last;
    return ret
  }
};

/*  */

var VueI18n = function VueI18n (options) {
  var this$1 = this;
  if ( options === void 0 ) { options = {}; }

  var locale = options.locale || 'en-US';
  var fallbackLocale = options.fallbackLocale || 'en-US';
  var messages = options.messages || {};
  var dateTimeFormats = options.dateTimeFormats || {};
  var numberFormats = options.numberFormats || {};

  this._vm = null;
  this._formatter = options.formatter || new BaseFormatter();
  this._missing = options.missing || null;
  this._root = options.root || null;
  this._sync = options.sync === undefined ? true : !!options.sync;
  this._fallbackRoot = options.fallbackRoot === undefined
    ? true
    : !!options.fallbackRoot;
  this._silentTranslationWarn = options.silentTranslationWarn === undefined
    ? false
    : !!options.silentTranslationWarn;
  this._dateTimeFormatters = {};
  this._numberFormatters = {};
  this._path = new I18nPath();
  this._dataListeners = [];

  this._exist = function (message, key) {
    if (!message || !key) { return false }
    return !isNull(this$1._path.getPathValue(message, key))
  };

  this._initVM({
    locale: locale,
    fallbackLocale: fallbackLocale,
    messages: messages,
    dateTimeFormats: dateTimeFormats,
    numberFormats: numberFormats
  });
};

var prototypeAccessors = { vm: {},messages: {},dateTimeFormats: {},numberFormats: {},locale: {},fallbackLocale: {},missing: {},formatter: {},silentTranslationWarn: {} };

VueI18n.prototype._initVM = function _initVM (data) {
  var silent = Vue.config.silent;
  Vue.config.silent = true;
  this._vm = new Vue({ data: data });
  Vue.config.silent = silent;
};

VueI18n.prototype.subscribeDataChanging = function subscribeDataChanging (vm) {
  this._dataListeners.push(vm);
};

VueI18n.prototype.unsubscribeDataChanging = function unsubscribeDataChanging (vm) {
  remove(this._dataListeners, vm);
};

VueI18n.prototype.watchI18nData = function watchI18nData () {
  var self = this;
  return this._vm.$watch('$data', function () {
    var i = self._dataListeners.length;
    while (i--) {
      Vue.nextTick(function () {
        self._dataListeners[i] && self._dataListeners[i].$forceUpdate();
      });
    }
  }, { deep: true })
};

VueI18n.prototype.watchLocale = function watchLocale () {
  /* istanbul ignore if */
  if (!this._sync || !this._root) { return null }
  var target = this._vm;
  return this._root.vm.$watch('locale', function (val) {
    target.$set(target, 'locale', val);
    target.$forceUpdate();
  }, { immediate: true })
};

prototypeAccessors.vm.get = function () { return this._vm };

prototypeAccessors.messages.get = function () { return looseClone(this._getMessages()) };
prototypeAccessors.dateTimeFormats.get = function () { return looseClone(this._getDateTimeFormats()) };
prototypeAccessors.numberFormats.get = function () { return looseClone(this._getNumberFormats()) };

prototypeAccessors.locale.get = function () { return this._vm.locale };
prototypeAccessors.locale.set = function (locale) {
  this._vm.$set(this._vm, 'locale', locale);
};

prototypeAccessors.fallbackLocale.get = function () { return this._vm.fallbackLocale };
prototypeAccessors.fallbackLocale.set = function (locale) {
  this._vm.$set(this._vm, 'fallbackLocale', locale);
};

prototypeAccessors.missing.get = function () { return this._missing };
prototypeAccessors.missing.set = function (handler) { this._missing = handler; };

prototypeAccessors.formatter.get = function () { return this._formatter };
prototypeAccessors.formatter.set = function (formatter) { this._formatter = formatter; };

prototypeAccessors.silentTranslationWarn.get = function () { return this._silentTranslationWarn };
prototypeAccessors.silentTranslationWarn.set = function (silent) { this._silentTranslationWarn = silent; };

VueI18n.prototype._getMessages = function _getMessages () { return this._vm.messages };
VueI18n.prototype._getDateTimeFormats = function _getDateTimeFormats () { return this._vm.dateTimeFormats };
VueI18n.prototype._getNumberFormats = function _getNumberFormats () { return this._vm.numberFormats };

VueI18n.prototype._warnDefault = function _warnDefault (locale, key, result, vm) {
  if (!isNull(result)) { return result }
  if (this.missing) {
    this.missing.apply(null, [locale, key, vm]);
  } else {
    if (process.env.NODE_ENV !== 'production' && !this._silentTranslationWarn) {
      warn(
        "Cannot translate the value of keypath '" + key + "'. " +
        'Use the value of keypath as default.'
      );
    }
  }
  return key
};

VueI18n.prototype._isFallbackRoot = function _isFallbackRoot (val) {
  return !val && !isNull(this._root) && this._fallbackRoot
};

VueI18n.prototype._interpolate = function _interpolate (
  locale,
  message,
  key,
  host,
  interpolateMode,
  values
) {
  if (!message) { return null }

  var pathRet = this._path.getPathValue(message, key);
  if (Array.isArray(pathRet)) { return pathRet }

  var ret;
  if (isNull(pathRet)) {
    /* istanbul ignore else */
    if (isPlainObject(message)) {
      ret = message[key];
      if (typeof ret !== 'string') {
        if (process.env.NODE_ENV !== 'production' && !this._silentTranslationWarn) {
          warn(("Value of key '" + key + "' is not a string!"));
        }
        return null
      }
    } else {
      return null
    }
  } else {
    /* istanbul ignore else */
    if (typeof pathRet === 'string') {
      ret = pathRet;
    } else {
      if (process.env.NODE_ENV !== 'production' && !this._silentTranslationWarn) {
        warn(("Value of key '" + key + "' is not a string!"));
      }
      return null
    }
  }

  // Check for the existance of links within the translated string
  if (ret.indexOf('@:') >= 0) {
    ret = this._link(locale, message, ret, host, interpolateMode, values);
  }

  return !values ? ret : this._render(ret, interpolateMode, values)
};

VueI18n.prototype._link = function _link (
  locale,
  message,
  str,
  host,
  interpolateMode,
  values
) {
    var this$1 = this;

  var ret = str;

  // Match all the links within the local
  // We are going to replace each of
  // them with its translation
  var matches = ret.match(/(@:[\w\-_|.]+)/g);
  for (var idx in matches) {
    // ie compatible: filter custom array
    // prototype method
    if (!matches.hasOwnProperty(idx)) {
      continue
    }
    var link = matches[idx];
    // Remove the leading @:
    var linkPlaceholder = link.substr(2);
    // Translate the link
    var translated = this$1._interpolate(
      locale, message, linkPlaceholder, host,
      interpolateMode === 'raw' ? 'string' : interpolateMode,
      interpolateMode === 'raw' ? undefined : values
    );

    if (this$1._isFallbackRoot(translated)) {
      if (process.env.NODE_ENV !== 'production' && !this$1._silentTranslationWarn) {
        warn(("Fall back to translate the link placeholder '" + linkPlaceholder + "' with root locale."));
      }
      /* istanbul ignore if */
      if (!this$1._root) { throw Error('unexpected error') }
      var root = this$1._root;
      translated = root._translate(
        root._getMessages(), root.locale, root.fallbackLocale,
        linkPlaceholder, host, interpolateMode, values
      );
    }
    translated = this$1._warnDefault(locale, linkPlaceholder, translated, host);

    // Replace the link with the translated
    ret = !translated ? ret : ret.replace(link, translated);
  }

  return ret
};

VueI18n.prototype._render = function _render (message, interpolateMode, values) {
  var ret = this._formatter.interpolate(message, values);
  // if interpolateMode is **not** 'string' ('row'),
  // return the compiled data (e.g. ['foo', VNode, 'bar']) with formatter
  return interpolateMode === 'string' ? ret.join('') : ret
};

VueI18n.prototype._translate = function _translate (
  messages,
  locale,
  fallback,
  key,
  host,
  interpolateMode,
  args
) {
  var res =
    this._interpolate(locale, messages[locale], key, host, interpolateMode, args);
  if (!isNull(res)) { return res }

  res = this._interpolate(fallback, messages[fallback], key, host, interpolateMode, args);
  if (!isNull(res)) {
    if (process.env.NODE_ENV !== 'production' && !this._silentTranslationWarn) {
      warn(("Fall back to translate the keypath '" + key + "' with '" + fallback + "' locale."));
    }
    return res
  } else {
    return null
  }
};

VueI18n.prototype._t = function _t (key, _locale, messages, host) {
    var arguments$1 = arguments;

    var values = [], len = arguments.length - 4;
    while ( len-- > 0 ) { values[ len ] = arguments$1[ len + 4 ]; }

  if (!key) { return '' }

  var parsedArgs = parseArgs.apply(void 0, values);
    var locale = parsedArgs.locale || _locale;

  var ret = this._translate(
    messages, locale, this.fallbackLocale, key,
    host, 'string', parsedArgs.params
  );
  if (this._isFallbackRoot(ret)) {
    if (process.env.NODE_ENV !== 'production' && !this._silentTranslationWarn) {
      warn(("Fall back to translate the keypath '" + key + "' with root locale."));
    }
    /* istanbul ignore if */
    if (!this._root) { throw Error('unexpected error') }
    return (ref = this._root).t.apply(ref, [ key ].concat( values ))
  } else {
    return this._warnDefault(locale, key, ret, host)
  }
    var ref;
};

VueI18n.prototype.t = function t (key) {
    var arguments$1 = arguments;

    var values = [], len = arguments.length - 1;
    while ( len-- > 0 ) { values[ len ] = arguments$1[ len + 1 ]; }

  return (ref = this)._t.apply(ref, [ key, this.locale, this._getMessages(), null ].concat( values ))
    var ref;
};

VueI18n.prototype._i = function _i (key, locale, messages, host, values) {
  var ret =
    this._translate(messages, locale, this.fallbackLocale, key, host, 'raw', values);
  if (this._isFallbackRoot(ret)) {
    if (process.env.NODE_ENV !== 'production' && !this._silentTranslationWarn) {
      warn(("Fall back to interpolate the keypath '" + key + "' with root locale."));
    }
    if (!this._root) { throw Error('unexpected error') }
    return this._root.i(key, locale, values)
  } else {
    return this._warnDefault(locale, key, ret, host)
  }
};

VueI18n.prototype.i = function i (key, locale, values) {
  /* istanbul ignore if */
  if (!key) { return '' }

  if (typeof locale !== 'string') {
    locale = this.locale;
  }

  return this._i(key, locale, this._getMessages(), null, values)
};

VueI18n.prototype._tc = function _tc (
  key,
  _locale,
  messages,
    host,
    choice
) {
    var arguments$1 = arguments;

    var values = [], len = arguments.length - 5;
    while ( len-- > 0 ) { values[ len ] = arguments$1[ len + 5 ]; }

    if (!key) { return '' }
  if (choice === undefined) {
    choice = 1;
  }
  return fetchChoice((ref = this)._t.apply(ref, [ key, _locale, messages, host ].concat( values )), choice)
    var ref;
};

VueI18n.prototype.tc = function tc (key, choice) {
    var arguments$1 = arguments;

    var values = [], len = arguments.length - 2;
    while ( len-- > 0 ) { values[ len ] = arguments$1[ len + 2 ]; }

  return (ref = this)._tc.apply(ref, [ key, this.locale, this._getMessages(), null, choice ].concat( values ))
    var ref;
};

VueI18n.prototype._te = function _te (key, locale, messages) {
    var arguments$1 = arguments;

    var args = [], len = arguments.length - 3;
    while ( len-- > 0 ) { args[ len ] = arguments$1[ len + 3 ]; }

  var _locale = parseArgs.apply(void 0, args).locale || locale;
  return this._exist(messages[_locale], key)
};

VueI18n.prototype.te = function te (key, locale) {
  return this._te(key, this.locale, this._getMessages(), locale)
};

VueI18n.prototype.getLocaleMessage = function getLocaleMessage (locale) {
  return looseClone(this._vm.messages[locale] || {})
};

VueI18n.prototype.setLocaleMessage = function setLocaleMessage (locale, message) {
  this._vm.messages[locale] = message;
};

  VueI18n.prototype.mergeLocaleMessage = function mergeLocaleMessage (locale, message) {
  this._vm.messages[locale] = Vue.util.extend(this._vm.messages[locale] || {}, message);
};

VueI18n.prototype.getDateTimeFormat = function getDateTimeFormat (locale) {
  return looseClone(this._vm.dateTimeFormats[locale] || {})
};

VueI18n.prototype.setDateTimeFormat = function setDateTimeFormat (locale, format) {
  this._vm.dateTimeFormats[locale] = format;
};

VueI18n.prototype.mergeDateTimeFormat = function mergeDateTimeFormat (locale, format) {
  this._vm.dateTimeFormats[locale] = Vue.util.extend(this._vm.dateTimeFormats[locale] || {}, format);
};

VueI18n.prototype._localizeDateTime = function _localizeDateTime (
  value,
  locale,
  fallback,
  dateTimeFormats,
  key
) {
  var _locale = locale;
  var formats = dateTimeFormats[_locale];

  // fallback locale
  if (isNull(formats) || isNull(formats[key])) {
    if (process.env.NODE_ENV !== 'production') {
      warn(("Fall back to '" + fallback + "' datetime formats from '" + locale + " datetime formats."));
    }
    _locale = fallback;
    formats = dateTimeFormats[_locale];
  }

  if (isNull(formats) || isNull(formats[key])) {
    return null
  } else {
    var format = formats[key];
    var id = _locale + "__" + key;
    var formatter = this._dateTimeFormatters[id];
    if (!formatter) {
      formatter = this._dateTimeFormatters[id] = new Intl.DateTimeFormat(_locale, format);
    }
    return formatter.format(value)
  }
};

VueI18n.prototype._d = function _d (value, locale, key) {
  /* istanbul ignore if */
  if (process.env.NODE_ENV !== 'production' && !VueI18n.availabilities.dateTimeFormat) {
    warn('Cannot format a Date value due to not support Intl.DateTimeFormat.');
    return ''
  }

  if (!key) {
    return new Intl.DateTimeFormat(locale).format(value)
  }

  var ret =
    this._localizeDateTime(value, locale, this.fallbackLocale, this._getDateTimeFormats(), key);
  if (this._isFallbackRoot(ret)) {
    if (process.env.NODE_ENV !== 'production') {
      warn(("Fall back to datetime localization of root: key '" + key + "' ."));
    }
    /* istanbul ignore if */
    if (!this._root) { throw Error('unexpected error') }
    return this._root.d(value, key, locale)
  } else {
    return ret || ''
  }
};

VueI18n.prototype.d = function d (value) {
    var arguments$1 = arguments;

    var args = [], len = arguments.length - 1;
    while ( len-- > 0 ) { args[ len ] = arguments$1[ len + 1 ]; }

  var locale = this.locale;
  var key = null;

  if (args.length === 1) {
    if (typeof args[0] === 'string') {
      key = args[0];
    } else if (isObject(args[0])) {
      if (args[0].locale) {
        locale = args[0].locale;
      }
      if (args[0].key) {
        key = args[0].key;
      }
    }
  } else if (args.length === 2) {
    if (typeof args[0] === 'string') {
        key = args[0];
      }
      if (typeof args[1] === 'string') {
      locale = args[1];
    }
  }

  return this._d(value, locale, key)
};

VueI18n.prototype.getNumberFormat = function getNumberFormat (locale) {
  return looseClone(this._vm.numberFormats[locale] || {})
};

VueI18n.prototype.setNumberFormat = function setNumberFormat (locale, format) {
  this._vm.numberFormats[locale] = format;
};

VueI18n.prototype.mergeNumberFormat = function mergeNumberFormat (locale, format) {
  this._vm.numberFormats[locale] = Vue.util.extend(this._vm.numberFormats[locale] || {}, format);
};

VueI18n.prototype._localizeNumber = function _localizeNumber (
  value,
  locale,
  fallback,
  numberFormats,
  key
) {
  var _locale = locale;
  var formats = numberFormats[_locale];

  // fallback locale
  if (isNull(formats) || isNull(formats[key])) {
    if (process.env.NODE_ENV !== 'production') {
      warn(("Fall back to '" + fallback + "' number formats from '" + locale + " number formats."));
    }
    _locale = fallback;
    formats = numberFormats[_locale];
  }

  if (isNull(formats) || isNull(formats[key])) {
    return null
  } else {
    var format = formats[key];
    var id = _locale + "__" + key;
    var formatter = this._numberFormatters[id];
    if (!formatter) {
      formatter = this._numberFormatters[id] = new Intl.NumberFormat(_locale, format);
    }
    return formatter.format(value)
  }
};

VueI18n.prototype._n = function _n (value, locale, key) {
  /* istanbul ignore if */
  if (process.env.NODE_ENV !== 'production' && !VueI18n.availabilities.numberFormat) {
    warn('Cannot format a Date value due to not support Intl.NumberFormat.');
    return ''
  }

  if (!key) {
    return new Intl.NumberFormat(locale).format(value)
  }

  var ret =
    this._localizeNumber(value, locale, this.fallbackLocale, this._getNumberFormats(), key);
  if (this._isFallbackRoot(ret)) {
    if (process.env.NODE_ENV !== 'production') {
      warn(("Fall back to number localization of root: key '" + key + "' ."));
    }
    /* istanbul ignore if */
    if (!this._root) { throw Error('unexpected error') }
    return this._root.n(value, key, locale)
  } else {
    return ret || ''
  }
};

VueI18n.prototype.n = function n (value) {
    var arguments$1 = arguments;

    var args = [], len = arguments.length - 1;
    while ( len-- > 0 ) { args[ len ] = arguments$1[ len + 1 ]; }

  var locale = this.locale;
  var key = null;

  if (args.length === 1) {
    if (typeof args[0] === 'string') {
      key = args[0];
    } else if (isObject(args[0])) {
      if (args[0].locale) {
        locale = args[0].locale;
      }
      if (args[0].key) {
        key = args[0].key;
      }
    }
  } else if (args.length === 2) {
    if (typeof args[0] === 'string') {
      key = args[0];
    }
    if (typeof args[1] === 'string') {
      locale = args[1];
    }
  }

  return this._n(value, locale, key)
};

Object.defineProperties( VueI18n.prototype, prototypeAccessors );

VueI18n.availabilities = {
  dateTimeFormat: canUseDateTimeFormat,
  numberFormat: canUseNumberFormat
};
VueI18n.install = install;
VueI18n.version = '7.3.2';

/* istanbul ignore if */
if (typeof window !== 'undefined' && window.Vue) {
  window.Vue.use(VueI18n);
}

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
  var message = this.$i18n.getLocaleMessage(this.$i18n.locale)['$$NOCONTEXT'][msgid];

  if (!message) {
    return msgid
  } else {
    return message.msgstr[0] || message.msgid
  }
};

// Context + Singular
var _pgettext = function (msgctxt, msgid) {
  var message;
  if (this.$i18n.getLocaleMessage(this.$i18n.locale)[msgctxt]) {
    message = this.$i18n.getLocaleMessage(this.$i18n.locale)[msgctxt][msgid];
  }

  if (!message) {
    return msgid
  } else {
    return message.msgstr[0] || message.msgid
  }
};

// Plural
var _ngettext = function (msgid, msgidPlural, n) {
  var message = this.$i18n.getLocaleMessage(this.$i18n.locale)['$$NOCONTEXT'][msgid];

  if (!message) {
    return Math.abs(n) === 1 ? msgid : msgidPlural
  } else {
    var pluralIndex = plurals.getTranslationIndex(this.$i18n.locale, n);
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
  if (this.$i18n.getLocaleMessage(this.$i18n.locale)[msgctxt]) {
    message = this.$i18n.getLocaleMessage(this.$i18n.locale)[msgctxt][msgid];
  }

  if (!message) {
    return Math.abs(n) === 1 ? msgid : msgidPlural
  } else {
    var pluralIndex = plurals.getTranslationIndex(this.$i18n.locale, n);
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
  return this.$i18n._render(msgid, 'string', values)
};

var gettextFunctions = { _i18nInterpolate: _i18nInterpolate, _gettext: _gettext, _pgettext: _pgettext, _ngettext: _ngettext, _npgettext: _npgettext };

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

var stripVData = function (input) {
  return input.replace(/[\t-\r \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]*data\-v\-[0-9A-Za-z\u017F\u212A]{8,}="(?:[\0-\t\x0B\f\x0E-\u2027\u202A-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])*?"/gi, '')
};

var stripHTMLWhitespace = function (input) {
  return input.replace(/>[\t-\r \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]*/gi, '>').replace(/[\t-\r \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]*</gi, '<')
};

var marked = require('marked');

var Component = function (Vue) {
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
        translation = this.$_i18n(translation, Object.assign(this.$parent, typeof this.tParams === 'object' ? this.tParams : {}));

        if ((this.markdown !== undefined && this.markdown !== false) || (this.md !== undefined && this.md !== false)) {
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

var marked$1 = require('marked');

var Directive = {
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
      console.log(msgid);
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
    translation = self.$_i18n(translation, Object.assign(self, typeof tParams === 'object' ? tParams : {}));

    if ((markdown !== undefined && markdown !== false) || (md !== undefined && md !== false)) {
      el.innerHTML = marked$1(translation);
    } else {
      el.innerHTML = translation;
    }
  }
};

/*  */
function plugin (Vue, options) {
  if ( options === void 0 ) options = {};

  // Load the `vue-i18n` dependency.
  if (!Vue.$i18n) {
    Vue.use(VueI18n);
  }

  // Expose gettext functions.
  Vue.prototype.$gettext = gettextFunctions._gettext;
  Vue.prototype.$pgettext = gettextFunctions._pgettext;
  Vue.prototype.$ngettext = gettextFunctions._ngettext;
  Vue.prototype.$npgettext = gettextFunctions._npgettext;
  Vue.prototype.$_i18n = gettextFunctions._i18nInterpolate;

  // Makes <translate> available as a global component.
  Vue.component('translate', Component(Vue));

  // An option to support translation with HTML content: `v-translate`.
  Vue.directive('translate', Directive);
}

plugin.version = '0.0.1';

if (typeof window !== 'undefined' && window.Vue) {
  window.Vue.use(plugin);
}

export { plugin as VueI18nGettext, VueI18n };export default plugin;

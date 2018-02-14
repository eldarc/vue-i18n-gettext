import BaseFormatter from './format'

export default function (message, interpolateMode, values) {
  const formatter = new BaseFormatter()
  const ret = formatter.interpolate(message, values)
  // if interpolateMode is **not** 'string' ('row'),
  // return the compiled data (e.g. ['foo', VNode, 'bar']) with formatter
  return interpolateMode === 'string' ? ret.join('') : ret
}

exports.escapedAnchor = function (anchor) {
  if (typeof anchor !== 'string') return null
  return anchor.replace('+', '___').replace('.', '__')
}
